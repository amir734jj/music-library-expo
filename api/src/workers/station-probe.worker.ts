import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { isInteger } from "lodash-es";
import { DataSource, Repository } from "typeorm";

import {
  ArtistSubscription,
  GlobalConfigRow,
  PlayObservation,
  Station,
  UserAlert,
} from "#entities";
import {
  StationProbeStatusService,
  StreamMetadataProbeService,
  TrackCaptureQueue,
} from "#services";

const PROBE_INTERVAL_MS = 5_000;

@Injectable()
export class StationProbeWorker {
  private readonly logger = new Logger(StationProbeWorker.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly probeService: StreamMetadataProbeService,
    private readonly captureQueue: TrackCaptureQueue,
    private readonly status: StationProbeStatusService,
    @InjectRepository(Station) private readonly stations: Repository<Station>,
    @InjectRepository(GlobalConfigRow) private readonly config: Repository<GlobalConfigRow>,
  ) {}

  @Interval(PROBE_INTERVAL_MS)
  async runBatch(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.status.startBatch();
    try {
      const settings = await this.loadSettings();
      if (!settings.enabled) return;

      const stations = await this.stations
        .createQueryBuilder("station")
        .where("station.isProbeEnabled = true")
        .orderBy("station.lastProbedAt", "ASC", "NULLS FIRST")
        .limit(settings.batchSize)
        .getMany();

      for (let index = 0; index < stations.length; index += settings.concurrency) {
        await Promise.all(
          stations
            .slice(index, index + settings.concurrency)
            .map((station) => this.probeStation(station, settings.timeoutMs)),
        );
      }
    } finally {
      this.status.completeBatch();
      this.running = false;
    }
  }

  private async probeStation(station: Station, timeoutMs: number): Promise<void> {
    const probedAt = new Date();
    this.status.startProbe(station.id);
    try {
      const metadata = await this.probeService.probe(station.streamUrl, timeoutMs);
      const captureRequest = await this.dataSource.transaction(async (manager) => {
        const stations = manager.getRepository(Station);
        const current = await stations.findOneByOrFail({ id: station.id });
        current.lastProbedAt = probedAt;
        current.consecutiveProbeFailures = 0;

        if (!metadata.raw || metadata.raw === current.currentRawMetadata) {
          await stations.save(current);
          return null;
        }

        current.currentRawMetadata = metadata.raw;
        current.currentArtist = metadata.artist;
        current.currentTitle = metadata.title;
        current.currentConfidence = metadata.artist && metadata.title ? 1 : 0.5;
        current.lastMetadataAt = probedAt;
        await stations.save(current);

        const observation = await manager.getRepository(PlayObservation).save({
          stationId: current.id,
          rawMetadata: metadata.raw,
          artist: metadata.artist,
          title: metadata.title,
          confidence: current.currentConfidence,
          observedAt: probedAt,
        });

        if (metadata.artist) {
          const subscriptions = await manager.getRepository(ArtistSubscription).findBy({
            normalizedArtistName: normalizeArtist(metadata.artist),
          });
          if (subscriptions.length) {
            await manager
              .getRepository(UserAlert)
              .createQueryBuilder()
              .insert()
              .values(
                subscriptions.map((subscription) => ({
                  userId: subscription.userId,
                  artistSubscriptionId: subscription.id,
                  playObservationId: observation.id,
                  createdAt: probedAt,
                })),
              )
              .orIgnore()
              .execute();
          }
          return subscriptions.some((subscription) => subscription.captureEnabled)
            ? { observationId: observation.id, streamUrl: current.streamUrl }
            : null;
        }
        return null;
      });
      if (captureRequest) this.captureQueue.enqueue(captureRequest);
    } catch (error) {
      await this.stations.increment({ id: station.id }, "consecutiveProbeFailures", 1);
      await this.stations.update({ id: station.id }, { lastProbedAt: probedAt });
      this.logger.warn(
        `Probe failed for station ${station.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.status.completeProbe(station.id);
    }
  }

  private async loadSettings(): Promise<{
    enabled: boolean;
    concurrency: number;
    timeoutMs: number;
    batchSize: number;
  }> {
    const rows = await this.config.findBy([
      { key: "PROBING_ENABLED" },
      { key: "PROBE_CONCURRENCY" },
      { key: "PROBE_TIMEOUT_SECONDS" },
      { key: "PROBE_BATCH_SIZE" },
    ]);
    const values = new Map(rows.map((row) => [row.key, row.value]));
    return {
      enabled: values.get("PROBING_ENABLED") !== "false",
      concurrency: boundedInteger(values.get("PROBE_CONCURRENCY"), 5, 1, 50),
      timeoutMs: boundedInteger(values.get("PROBE_TIMEOUT_SECONDS"), 12, 1, 120) * 1_000,
      batchSize: boundedInteger(values.get("PROBE_BATCH_SIZE"), 100, 1, 1_000),
    };
  }
}

function normalizeArtist(value: string): string {
  return value.trim().toLocaleUpperCase("en-US");
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}