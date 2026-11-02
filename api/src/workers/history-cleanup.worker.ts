import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { DataSource, In } from "typeorm";

import { CachedTrack, PlayObservation, UserAlert } from "../entities/index.js";
import { EncryptedTrackStorageService } from "../services/encrypted-track-storage.service.js";

const RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;
const BATCH_SIZE = 1_000;
const MAX_BATCHES = 20;
const HISTORY_POLICIES = [
  { entity: UserAlert, timestamp: "createdAt", maximumRows: 100_000 },
  { entity: PlayObservation, timestamp: "observedAt", maximumRows: 1_000_000 },
] as const;

@Injectable()
export class HistoryCleanupWorker {
  private readonly logger = new Logger(HistoryCleanupWorker.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly storage: EncryptedTrackStorageService,
  ) {}

  @Interval(60_000)
  async cleanup(): Promise<void> {
    if (this.running || !this.dataSource.isInitialized) return;
    this.running = true;
    const cutoff = new Date(Date.now() - RETENTION_MS);

    try {
      for (const { entity, timestamp, maximumRows } of HISTORY_POLICIES) {
        let removed = 0;
        for (let batch = 0; batch < MAX_BATCHES; batch++) {
          const count = await this.dataSource.transaction(async (manager) => {
            const repository = manager.getRepository<PlayObservation | UserAlert>(entity);
            const history = repository.createQueryBuilder("history");
            // Keep the boundary in the same statement and retain timestamp precision.
            const boundary = history.subQuery()
              .select([`boundary.${timestamp}`, "boundary.id"])
              .from<PlayObservation | UserAlert>(entity, "boundary")
              .orderBy(`boundary.${timestamp}`, "DESC")
              .addOrderBy("boundary.id", "DESC")
              .offset(maximumRows - 1)
              .limit(1);
            const rows = await history
              .select("history.id")
              .where(`history.${timestamp} < :cutoff`, { cutoff })
              .orWhere(`(history.${timestamp}, history.id) < ${boundary.getQuery()}`)
              .orderBy(`history.${timestamp}`, "ASC")
              .addOrderBy("history.id", "ASC")
              .limit(BATCH_SIZE)
              .setLock("pessimistic_write", undefined, ["history"])
              .setOnLocked("skip_locked")
              .getMany();
            if (!rows.length) return 0;
            const ids = rows.map((row) => row.id);
            if (entity === PlayObservation) {
              const tracks = await manager.getRepository(CachedTrack)
                .createQueryBuilder("track")
                .select(["track.id", "track.filePath"])
                .where({ playObservationId: In(ids) })
                .setLock("pessimistic_write")
                .getMany();
              for (const track of tracks) await this.storage.delete(track.filePath);
            }
            await repository.delete({ id: In(ids) });
            return rows.length;
          });
          removed += count;
          if (count < BATCH_SIZE) break;
        }
        if (removed) this.logger.log(`History cleanup removed ${removed} rows from ${entity.name}`);
      }
    } catch (error) {
      this.logger.error(
        `History cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
