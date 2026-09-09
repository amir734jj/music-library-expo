import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
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
      const song = await this.capture.capture(request.streamUrl, timeoutSeconds * 1_000);
      const stored = await this.storage.save(song.data, key);
      const createdAt = new Date();

      await this.tracks.save({
        playObservationId: request.observationId,
        artist: song.artist,
        title: song.title,
        normalizedArtist: normalize(song.artist),
        normalizedTitle: normalize(song.title ?? ""),
        filePath: stored.filePath,
        contentType: "audio/mpeg",
        plaintextLength: String(stored.plaintextLength),
        bitrateKbps: null,
        durationMs: null,
        keyFingerprint: stored.keyFingerprint,
        createdAt,
        expiresAt: new Date(createdAt.getTime() + retentionHours * 60 * 60 * 1_000),
      });
    } catch (error) {
      this.logger.error(
        `Capture failed for observation ${request.observationId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.queue.complete(request.observationId);
      this.running = false;
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
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalize(value: string): string {
  return value.trim().toLocaleUpperCase("en-US");
}