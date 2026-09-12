import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { isInteger } from "lodash-es";
import { randomUUID } from "node:crypto";
import { Repository } from "typeorm";

import { CachedTrack, GlobalConfigRow } from "#entities";
import {
  EncryptedTrackStorageService,
  StreamTrackCaptureService,
  TrackCaptureQueue,
} from "#services";

@Injectable()
export class TrackCaptureWorker {
  private readonly logger = new Logger(TrackCaptureWorker.name);
  private running = false;

  constructor(
    private readonly queue: TrackCaptureQueue,
    private readonly capture: StreamTrackCaptureService,
    private readonly storage: EncryptedTrackStorageService,
    @InjectRepository(CachedTrack) private readonly tracks: Repository<CachedTrack>,
    @InjectRepository(GlobalConfigRow) private readonly config: Repository<GlobalConfigRow>,
  ) {}

  async onModuleInit(): Promise<void> {
    const keyRow = await this.config.findOneBy({ key: "TRENDING_CACHE_ENCRYPTION_KEY" });
    const key = decodeKey(keyRow?.value);
    if (!key) return;
    const tracks = await this.tracks.find();
    for (const track of tracks) {
      const legacyPath = track.filePath;
      let encryptedPath: string | null = null;
      try {
        encryptedPath = await this.storage.encryptLegacyFileName(legacyPath, track.id, key);
        if (encryptedPath === legacyPath) continue;
        track.filePath = encryptedPath;
        await this.tracks.save(track);
        await this.storage.delete(legacyPath);
      } catch (error) {
        if (encryptedPath && encryptedPath !== legacyPath) {
          await this.storage.delete(encryptedPath);
          track.filePath = legacyPath;
        }
        this.logger.warn(
          `Could not encrypt the cache filename for track ${track.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  @Interval(1_000)
  async processNext(): Promise<void> {
    if (this.running) return;
    const request = this.queue.dequeue();
    if (!request) return;
    this.running = true;

    try {
      const values = new Map(
        (await this.config.find()).map((row) => [row.key, row.value]),
      );
      const key = decodeKey(values.get("TRENDING_CACHE_ENCRYPTION_KEY"));
      if (!key) {
        this.logger.warn("Track capture skipped because the encryption key is not configured");
        return;
      }

      const timeoutSeconds = positiveInteger(
        values.get("TRENDING_CACHE_CAPTURE_TIMEOUT_SECONDS"),
        600,
      );
      const retentionHours = positiveInteger(
        values.get("TRENDING_CACHE_RETENTION_HOURS"),
        24,
      );
      const maximumBytes = positiveInteger(
        values.get("TRENDING_CACHE_MAX_SIZE_MEGABYTES"),
        1_024,
      ) * 1_024 * 1_024;
      const song = await this.capture.capture(request.streamUrl, timeoutSeconds * 1_000);
      const normalizedArtist = normalize(song.artist);
      const normalizedTitle = normalize(song.title ?? "");
      const createdAt = new Date();
      const existing = await this.tracks
        .createQueryBuilder("track")
        .where("track.normalizedArtist = :normalizedArtist", { normalizedArtist })
        .andWhere("track.normalizedTitle = :normalizedTitle", { normalizedTitle })
        .andWhere("track.expiresAt > :createdAt", { createdAt })
        .orderBy("track.createdAt", "DESC")
        .getOne();
      if (existing && await this.storage.exists(existing.filePath)) {
        await this.enforceCacheLimit(maximumBytes);
        return;
      }

      const trackId = randomUUID();
      const stored = await this.storage.save(song.data, key, trackId);

      await this.tracks.save({
        id: trackId,
        playObservationId: request.observationId,
        artist: song.artist,
        title: song.title,
        normalizedArtist,
        normalizedTitle,
        filePath: stored.filePath,
        contentType: song.contentType,
        plaintextLength: String(stored.plaintextLength),
        bitrateKbps: song.bitrateKbps,
        durationMs: song.durationMs,
        keyFingerprint: stored.keyFingerprint,
        createdAt,
        expiresAt: new Date(createdAt.getTime() + retentionHours * 60 * 60 * 1_000),
      });
      await this.enforceCacheLimit(maximumBytes);
    } catch (error) {
      this.logger.error(
        `Capture failed for observation ${request.observationId} (${safeStreamUrl(request.streamUrl)}): ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.queue.complete(request.observationId);
      this.running = false;
    }
  }

  private async enforceCacheLimit(maximumBytes: number): Promise<void> {
    const tracks = await this.tracks.find({ order: { createdAt: "ASC" } });
    const sizes = await Promise.all(tracks.map((track) => this.storage.size(track.filePath)));
    let total = sizes.reduce((sum, size) => sum + size, 0);
    const now = new Date();
    const newestTrackByKey = new Map<string, string>();
    for (let index = 0; index < tracks.length; index++) {
      const track = tracks[index]!;
      if (track.expiresAt <= now || (sizes[index] ?? 0) === 0) continue;
      newestTrackByKey.set(trackKey(track.normalizedArtist, track.normalizedTitle), track.id);
    }

    for (let index = 0; index < tracks.length; index++) {
      const track = tracks[index]!;
      const size = sizes[index] ?? 0;
      const isDuplicate = newestTrackByKey.get(
        trackKey(track.normalizedArtist, track.normalizedTitle),
      ) !== track.id;
      if (track.expiresAt > now && size > 0 && !isDuplicate) continue;
      await this.storage.delete(track.filePath);
      await this.tracks.remove(track);
      total -= size;
      sizes[index] = 0;
    }

    for (let index = 0; index < tracks.length && total > maximumBytes; index++) {
      const track = tracks[index]!;
      const size = sizes[index] ?? 0;
      if (size === 0) continue;
      await this.storage.delete(track.filePath);
      await this.tracks.remove(track);
      total -= size;
    }
  }
}

function decodeKey(value: string | undefined): Buffer | null {
  if (!value) return null;
  const key = Buffer.from(value, "base64");
  return key.byteLength === 32 ? key : null;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalize(value: string): string {
  return value.trim().toLocaleUpperCase("en-US");
}

function safeStreamUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.username) url.username = "[REDACTED]";
    if (url.password) url.password = "[REDACTED]";
    for (const key of url.searchParams.keys()) {
      if (/^(?:access_token|api_key|authorization|key|password|signature|token)$/iu.test(key)) {
        url.searchParams.set(key, "[REDACTED]");
      }
    }
    return url.toString();
  } catch {
    return "[INVALID_STREAM_URL]";
  }
}

function trackKey(artist: string, title: string): string {
  return `${artist}\u0000${title}`;
}