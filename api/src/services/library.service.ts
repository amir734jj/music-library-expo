import type {
  ArtistSubscriptionSummary,
  CreateSubscriptionRequest,
  NowPlayingSummary,
  StationCachedTrackSummary,
  StationSummary,
  TrendingSummary,
  UserAlertSummary,
} from "@music-library/core";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash } from "node:crypto";
import { isInteger } from "lodash-es";
import { In, Repository } from "typeorm";

import {
  ArtistSubscription,
  CachedTrack,
  GlobalConfigRow,
  PlayObservation,
  Station,
  UserAlert,
} from "#entities";
import { EncryptedTrackStorageService } from "./encrypted-track-storage.service.js";
import { stationGenrePrioritySql } from "./station-genre-policy.js";

@Injectable()
export class LibraryService {
  constructor(
    @InjectRepository(Station) private readonly stations: Repository<Station>,
    @InjectRepository(PlayObservation)
    private readonly observations: Repository<PlayObservation>,
    @InjectRepository(CachedTrack) private readonly tracks: Repository<CachedTrack>,
    @InjectRepository(ArtistSubscription)
    private readonly subscriptions: Repository<ArtistSubscription>,
    @InjectRepository(UserAlert) private readonly alerts: Repository<UserAlert>,
    @InjectRepository(GlobalConfigRow)
    private readonly config: Repository<GlobalConfigRow>,
    private readonly storage: EncryptedTrackStorageService,
  ) {}

  async listStations(query?: string): Promise<StationSummary[]> {
    const builder = this.stations.createQueryBuilder("station");
    const search = normalizeSearch(query);
    if (search) {
      builder.where(
        "LOWER(station.name) LIKE :search OR LOWER(station.genre) LIKE :search OR LOWER(station.streamUrl) LIKE :search",
        { search },
      );
    }
    const stations = await builder
      .addSelect(stationGenrePrioritySql("station"), "genre_priority")
      .orderBy("genre_priority", "ASC")
      .addOrderBy("station.name", "ASC")
      .limit(200)
      .getMany();
    return stations.map(toStationSummary);
  }

  async listNowPlaying(query?: string): Promise<NowPlayingSummary[]> {
    const builder = this.stations
      .createQueryBuilder("station")
      .where("station.lastMetadataAt IS NOT NULL");
    const search = normalizeSearch(query);
    if (search) {
      builder.andWhere(
        "LOWER(COALESCE(station.currentArtist, '')) LIKE :search OR LOWER(COALESCE(station.currentTitle, '')) LIKE :search OR LOWER(station.name) LIKE :search",
        { search },
      );
    }
    const stations = await builder
      .orderBy("station.lastMetadataAt", "DESC")
      .limit(100)
      .getMany();
    return stations.map(toNowPlayingSummary);
  }

  async getNowPlaying(stationId: string): Promise<NowPlayingSummary | null> {
    const station = await this.stations.findOneBy({ id: stationId });
    return station?.lastMetadataAt ? toNowPlayingSummary(station) : null;
  }

  getStation(stationId: string): Promise<Station | null> {
    return this.stations.findOneBy({ id: stationId });
  }

  async enableCapture(stationId: string): Promise<boolean> {
    const result = await this.stations.update({ id: stationId }, { isProbeEnabled: true });
    return (result.affected ?? 0) > 0;
  }

  async listTrending(query?: string): Promise<TrendingSummary[]> {
    const cacheConfig = await this.loadCacheConfig();
    if (!cacheConfig) return [];
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1_000);
    const builder = this.observations
      .createQueryBuilder("observation")
      .innerJoinAndSelect("observation.station", "station")
      .where("observation.observedAt >= :cutoff", { cutoff })
      .andWhere("observation.artist IS NOT NULL");
    const search = normalizeSearch(query);
    if (search) {
      builder.andWhere(
        "LOWER(observation.artist) LIKE :search OR LOWER(COALESCE(observation.title, '')) LIKE :search",
        { search },
      );
    }
    const observations = await builder
      .orderBy("observation.observedAt", "DESC")
      .limit(10_000)
      .getMany();
    const tracks = await this.tracks
      .createQueryBuilder("track")
      .where("track.expiresAt > :now", { now: new Date() })
      .andWhere("track.keyFingerprint = :fingerprint", {
        fingerprint: cacheConfig.keyFingerprint,
      })
      .orderBy("track.createdAt", "DESC")
      .limit(10_000)
      .getMany();
    const availableTracks = new Map<string, CachedTrack>();
    for (const track of tracks) {
      if (
        !availableTracks.has(trackKey(track.normalizedArtist, track.normalizedTitle)) &&
        (await this.storage.exists(track.filePath))
      ) {
        availableTracks.set(trackKey(track.normalizedArtist, track.normalizedTitle), track);
      }
    }

    const groups = new Map<string, PlayObservation[]>();
    for (const observation of observations) {
      if (!observation.artist?.trim()) continue;
      const key = trackKey(normalize(observation.artist), normalize(observation.title ?? ""));
      const group = groups.get(key) ?? [];
      group.push(observation);
      groups.set(key, group);
    }

    return [...groups.entries()]
      .map(([key, group]) => {
        const latest = group[0]!;
        const track = availableTracks.get(key);
        return {
          artist: latest.artist!.trim(),
          title: latest.title?.trim() || null,
          observationCount: group.length,
          stationCount: new Set(group.map((item) => item.stationId)).size,
          lastObservedAt: latest.observedAt.toISOString(),
          lastStationId: latest.stationId,
          lastStationName: latest.station.name,
          lastStationStreamUrl: latest.station.streamUrl,
          bitrateKbps: track?.bitrateKbps ?? null,
          durationMs: track?.durationMs ?? estimateDuration(track),
          cachedTrackId: track?.id ?? null,
          cachedUntil: track?.expiresAt.toISOString() ?? null,
        } satisfies TrendingSummary;
      })
      .filter(
        (trend) =>
          trend.cachedTrackId !== null &&
          trend.durationMs !== null &&
          trend.durationMs >= cacheConfig.minimumDurationSeconds * 1_000,
      )
      .sort(
        (left, right) =>
          right.observationCount - left.observationCount ||
          right.stationCount - left.stationCount ||
          right.lastObservedAt.localeCompare(left.lastObservedAt),
      )
      .slice(0, 100);
  }

  async listStationCachedTracks(stationId: string): Promise<StationCachedTrackSummary[]> {
    const cacheConfig = await this.loadCacheConfig();
    if (!cacheConfig) return [];
    const cutoff = new Date(
      Date.now() - cacheConfig.retentionHours * 60 * 60 * 1_000,
    );
    const observations = await this.observations.find({
      where: { stationId },
      order: { observedAt: "DESC" },
      take: 1_000,
    });
    const recent = observations.filter(
      (observation) => observation.observedAt >= cutoff && observation.artist,
    );
    const tracks = await this.tracks
      .createQueryBuilder("track")
      .where("track.expiresAt > :now", { now: new Date() })
      .andWhere("track.keyFingerprint = :fingerprint", {
        fingerprint: cacheConfig.keyFingerprint,
      })
      .orderBy("track.createdAt", "DESC")
      .getMany();
    const byKey = new Map(tracks.map((track) => [
      trackKey(track.normalizedArtist, track.normalizedTitle),
      track,
    ]));
    const result = new Map<string, StationCachedTrackSummary>();
    for (const observation of recent) {
      const artist = observation.artist!;
      const track = byKey.get(trackKey(normalize(artist), normalize(observation.title ?? "")));
      if (!track || result.has(track.id) || !(await this.storage.exists(track.filePath))) continue;
      result.set(track.id, {
        cachedTrackId: track.id,
        artist: track.artist,
        title: track.title,
        observedAt: observation.observedAt.toISOString(),
        cachedUntil: track.expiresAt.toISOString(),
      });
    }
    return [...result.values()].sort((left, right) =>
      left.observedAt.localeCompare(right.observedAt),
    );
  }

  getCachedTrack(cachedTrackId: string): Promise<CachedTrack | null> {
    return this.tracks.findOneBy({ id: cachedTrackId });
  }

  async listSubscriptions(userId: string): Promise<ArtistSubscriptionSummary[]> {
    const subscriptions = await this.subscriptions.find({
      where: { userId },
      order: { artistName: "ASC" },
    });
    return subscriptions.map(toSubscriptionSummary);
  }

  async subscriptionExists(userId: string, normalizedArtistName: string): Promise<boolean> {
    return this.subscriptions.existsBy({ userId, normalizedArtistName });
  }

  async createSubscription(
    userId: string,
    request: CreateSubscriptionRequest,
  ): Promise<ArtistSubscriptionSummary> {
    const subscription = await this.subscriptions.save({
      userId,
      artistName: request.artistName,
      normalizedArtistName: normalize(request.artistName),
      captureEnabled: request.captureEnabled,
      createdAt: new Date(),
    });
    return toSubscriptionSummary(subscription);
  }

  async deleteSubscription(userId: string, id: string): Promise<boolean> {
    const result = await this.subscriptions.delete({ id, userId });
    return (result.affected ?? 0) > 0;
  }

  async listAlerts(userId: string): Promise<UserAlertSummary[]> {
    const alerts = await this.alerts.find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: 100,
    });
    if (!alerts.length) return [];
    const [subscriptions, observations] = await Promise.all([
      this.subscriptions.findBy({
        id: In(alerts.map((alert) => alert.artistSubscriptionId)),
      }),
      this.observations.find({
        where: { id: In(alerts.map((alert) => alert.playObservationId)) },
        relations: { station: true },
      }),
    ]);
    const subscriptionById = new Map(subscriptions.map((item) => [item.id, item]));
    const observationById = new Map(observations.map((item) => [item.id, item]));
    return alerts.flatMap((alert) => {
      const subscription = subscriptionById.get(alert.artistSubscriptionId);
      const observation = observationById.get(alert.playObservationId);
      if (!subscription || !observation) return [];
      return [{
        id: alert.id,
        artistName: subscription.artistName,
        stationName: observation.station.name,
        trackTitle: observation.title,
        observedAt: observation.observedAt.toISOString(),
      }];
    });
  }

  private async loadCacheConfig(): Promise<{
    keyFingerprint: string;
    minimumDurationSeconds: number;
    retentionHours: number;
  } | null> {
    const rows = await this.config.findBy([
      { key: "TRENDING_CACHE_ENCRYPTION_KEY" },
      { key: "TRENDING_MINIMUM_DURATION_SECONDS" },
      { key: "TRENDING_CACHE_RETENTION_HOURS" },
    ]);
    const values = new Map(rows.map((row) => [row.key, row.value]));
    const key = decodeCacheKey(values.get("TRENDING_CACHE_ENCRYPTION_KEY"));
    if (!key) return null;
    return {
      keyFingerprint: createKeyFingerprint(key),
      minimumDurationSeconds: positiveInteger(
        values.get("TRENDING_MINIMUM_DURATION_SECONDS"),
        30,
      ),
      retentionHours: positiveInteger(values.get("TRENDING_CACHE_RETENTION_HOURS"), 24),
    };
  }
}

function normalizeSearch(query?: string): string | null {
  const value = query?.trim().toLowerCase();
  return value ? `%${value}%` : null;
}

function normalize(value: string): string {
  return value.trim().toLocaleUpperCase("en-US");
}

function trackKey(artist: string, title: string): string {
  return `${artist}\u0000${title}`;
}

function toStationSummary(station: Station): StationSummary {
  return {
    id: station.id,
    name: station.name,
    genre: station.genre,
    streamUrl: station.streamUrl,
    isProbeEnabled: station.isProbeEnabled,
    lastProbedAt: station.lastProbedAt?.toISOString() ?? null,
  };
}

function toNowPlayingSummary(station: Station): NowPlayingSummary {
  return {
    stationId: station.id,
    stationName: station.name,
    artist: station.currentArtist,
    title: station.currentTitle,
    rawMetadata: station.currentRawMetadata ?? "",
    observedAt: station.lastMetadataAt!.toISOString(),
    confidence: Number(station.currentConfidence),
    streamUrl: station.streamUrl,
  };
}

function estimateDuration(track?: CachedTrack): number | null {
  if (!track?.bitrateKbps || track.bitrateKbps <= 0) return null;
  return Math.round((Number(track.plaintextLength) * 8) / track.bitrateKbps);
}

function toSubscriptionSummary(
  subscription: ArtistSubscription,
): ArtistSubscriptionSummary {
  return {
    id: subscription.id,
    artistName: subscription.artistName,
    createdAt: subscription.createdAt.toISOString(),
    captureEnabled: subscription.captureEnabled,
  };
}

function decodeCacheKey(value?: string): Buffer | null {
  if (!value) return null;
  const key = Buffer.from(value, "base64");
  return key.byteLength === 32 ? key : null;
}

function createKeyFingerprint(key: Buffer): string {
  return createHash("sha256").update(key).digest("hex");
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return isInteger(parsed) && parsed > 0 ? parsed : fallback;
}