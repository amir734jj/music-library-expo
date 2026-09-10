import type {
  GlobalConfigModel,
  ProbeStatusSummary,
  StationSummary,
  TrendingCacheStatusSummary,
  UpdateGlobalConfigRequest,
  UpdateUserRequest,
  UserResponse,
} from "@music-library/core";
import { UserRole } from "@music-library/core";
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash, randomBytes } from "node:crypto";
import { isString } from "lodash-es";
import { Repository } from "typeorm";

import { CachedTrack, Station, User } from "#entities";

import { EncryptedTrackStorageService } from "./encrypted-track-storage.service.js";
import {
  CONFIG_KEYS,
  decodeKey,
  GlobalConfigService,
  normalizeConfigKey,
} from "./global-config.service.js";
import { StationProbeStatusService } from "./station-probe-status.service.js";

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Station) private readonly stations: Repository<Station>,
    @InjectRepository(CachedTrack) private readonly tracks: Repository<CachedTrack>,
    private readonly config: GlobalConfigService,
    private readonly storage: EncryptedTrackStorageService,
    private readonly probeStatus: StationProbeStatusService,
  ) {}

  async listUsers(): Promise<UserResponse[]> {
    return (await this.users.find({ order: { email: "ASC" } })).map(userResponse);
  }

  async updateUser(currentUserId: string, id: string, request: UpdateUserRequest): Promise<void> {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException();
    const nextRole = request.role ?? user.role;
    const removesAdmin = user.role === UserRole.Admin && nextRole !== UserRole.Admin;
    const disablesAdmin = user.role === UserRole.Admin && !request.isActive;
    if (id === currentUserId && (removesAdmin || !request.isActive)) {
      throw new ForbiddenException("You cannot disable or demote your own account");
    }
    if ((removesAdmin || disablesAdmin) && (await this.activeAdminCount()) <= 1) {
      throw new ForbiddenException("The last active administrator cannot be disabled or demoted");
    }
    user.displayName = request.displayName?.trim() || null;
    user.isActive = request.isActive;
    user.role = nextRole;
    await this.users.save(user);
  }

  async deleteUser(currentUserId: string, id: string): Promise<void> {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException();
    if (id === currentUserId) {
      throw new ForbiddenException("You cannot delete your own account");
    }
    if (user.role === UserRole.Admin && user.isActive && (await this.activeAdminCount()) <= 1) {
      throw new ForbiddenException("The last active administrator cannot be deleted");
    }
    await this.users.remove(user);
  }

  getConfig(): Promise<GlobalConfigModel> {
    return this.config.get();
  }

  async updateConfig(request: UpdateGlobalConfigRequest, userId: string): Promise<void> {
    const current = await this.config.get();
    const nextKeyValue = Object.entries(request.values).find(
      ([key]) => normalizeConfigKey(key) === CONFIG_KEYS.trendingCacheEncryptionKey,
    )?.[1];
    if (isString(nextKeyValue) && nextKeyValue !== current.trendingCacheEncryptionKey) {
      const oldKey = decodeKey(current.trendingCacheEncryptionKey);
      const nextKey = decodeKey(nextKeyValue);
      if (!nextKey) throw new Error("Cache key must be a Base64-encoded 32-byte value");
      await this.rotateCacheKey(oldKey, nextKey);
    }
    await this.config.save(request, userId);
    const updated = await this.config.get();
    await this.enforceCacheLimit(updated.trendingCacheMaxSizeMegabytes);
  }

  async rotateCacheEncryptionKey(userId: string): Promise<GlobalConfigModel> {
    const encryptionKey = randomBytes(32).toString("base64");
    await this.updateConfig({
      values: { [CONFIG_KEYS.trendingCacheEncryptionKey]: encryptionKey },
    }, userId);
    return this.config.get();
  }

  async cacheStatus(): Promise<TrendingCacheStatusSummary> {
    const tracks = await this.tracks.find();
    let sizeBytes = 0;
    for (const track of tracks) sizeBytes += await this.storage.size(track.filePath);
    return { sizeBytes, songCount: tracks.length };
  }

  async clearCache(): Promise<void> {
    const tracks = await this.tracks.find();
    await Promise.all(tracks.map((track) => this.storage.delete(track.filePath)));
    await this.tracks.clear();
  }

  async listStations(): Promise<StationSummary[]> {
    return (await this.stations.find({ order: { name: "ASC" } })).map(stationSummary);
  }

  async updateStationProbe(id: string, isProbeEnabled: boolean): Promise<void> {
    const result = await this.stations.update({ id }, { isProbeEnabled });
    if (!(result.affected ?? 0)) throw new NotFoundException();
  }

  async updateAllStationProbes(isProbeEnabled: boolean): Promise<number> {
    const result = await this.stations
      .createQueryBuilder()
      .update(Station)
      .set({ isProbeEnabled })
      .execute();
    return result.affected ?? 0;
  }

  async getProbeStatus(query: string | undefined, page: number, pageSize: number): Promise<ProbeStatusSummary> {
    const normalizedPage = Math.max(1, page);
    const normalizedPageSize = Math.min(200, Math.max(1, pageSize));
    const builder = this.stations.createQueryBuilder("station");
    const search = query?.trim().toLowerCase();
    if (search) {
      builder.where(
        "LOWER(station.name) LIKE :search OR LOWER(station.genre) LIKE :search OR LOWER(station.streamUrl) LIKE :search",
        { search: `%${search}%` },
      );
    }
    const matchingStationCount = await builder.getCount();
    const stations = await builder
      .orderBy("station.isProbeEnabled", "DESC")
      .addOrderBy("station.name", "ASC")
      .skip((normalizedPage - 1) * normalizedPageSize)
      .take(normalizedPageSize)
      .getMany();
    const [enabledStationCount, config] = await Promise.all([
      this.stations.countBy({ isProbeEnabled: true }),
      this.config.get(),
    ]);
    const runtime = this.probeStatus.snapshot();
    return {
      probingEnabled: config.probingEnabled,
      lastBatchStartedAt: runtime.lastBatchStartedAt?.toISOString() ?? null,
      lastBatchCompletedAt: runtime.lastBatchCompletedAt?.toISOString() ?? null,
      activeProbeCount: runtime.activeProbes.size,
      enabledStationCount,
      matchingStationCount,
      page: normalizedPage,
      pageSize: normalizedPageSize,
      stations: stations.map((station) => ({
        ...stationSummary(station),
        isProbing: runtime.activeProbes.has(station.id),
        probeStartedAt: runtime.activeProbes.get(station.id)?.toISOString() ?? null,
        lastMetadataAt: station.lastMetadataAt?.toISOString() ?? null,
        consecutiveProbeFailures: station.consecutiveProbeFailures,
      })),
    };
  }

  private activeAdminCount(): Promise<number> {
    return this.users.countBy({ role: UserRole.Admin, isActive: true });
  }

  private async rotateCacheKey(oldKey: Buffer | null, nextKey: Buffer): Promise<void> {
    const tracks = await this.tracks.find();
    for (const track of tracks) {
      if (!oldKey) {
        await this.storage.delete(track.filePath);
        await this.tracks.remove(track);
        continue;
      }
      try {
        const content = await this.storage.read(track.filePath, oldKey);
        const stored = await this.storage.save(content, nextKey);
        const oldPath = track.filePath;
        track.filePath = stored.filePath;
        track.keyFingerprint = stored.keyFingerprint;
        await this.tracks.save(track);
        await this.storage.delete(oldPath);
      } catch {
        await this.storage.delete(track.filePath);
        await this.tracks.remove(track);
      }
    }
  }

  private async enforceCacheLimit(maximumMegabytes: number): Promise<void> {
    const maximumBytes = maximumMegabytes * 1_024 * 1_024;
    const tracks = await this.tracks.find({ order: { createdAt: "ASC" } });
    const sizes = await Promise.all(tracks.map((track) => this.storage.size(track.filePath)));
    let total = sizes.reduce((sum, size) => sum + size, 0);
    for (let index = 0; index < tracks.length && total > maximumBytes; index++) {
      const track = tracks[index]!;
      await this.storage.delete(track.filePath);
      await this.tracks.remove(track);
      total -= sizes[index] ?? 0;
    }
  }
}

function userResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isActive: user.isActive,
    roles: [user.role],
  };
}

function stationSummary(station: Station): StationSummary {
  return {
    id: station.id,
    name: station.name,
    genre: station.genre,
    streamUrl: station.streamUrl,
    isProbeEnabled: station.isProbeEnabled,
    lastProbedAt: station.lastProbedAt?.toISOString() ?? null,
  };
}