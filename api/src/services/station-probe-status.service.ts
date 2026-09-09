import { Injectable } from "@nestjs/common";

export interface StationProbeRuntimeSnapshot {
  activeProbes: ReadonlyMap<string, Date>;
  lastBatchStartedAt: Date | null;
  lastBatchCompletedAt: Date | null;
}

@Injectable()
export class StationProbeStatusService {
  private readonly activeProbes = new Map<string, Date>();
  private lastBatchStartedAt: Date | null = null;
  private lastBatchCompletedAt: Date | null = null;

  startBatch(): void {
    this.lastBatchStartedAt = new Date();
  }

  completeBatch(): void {
    this.lastBatchCompletedAt = new Date();
  }

  startProbe(stationId: string): void {
    this.activeProbes.set(stationId, new Date());
  }

  completeProbe(stationId: string): void {
    this.activeProbes.delete(stationId);
  }

  snapshot(): StationProbeRuntimeSnapshot {
    return {
      activeProbes: new Map(this.activeProbes),
      lastBatchStartedAt: this.lastBatchStartedAt,
      lastBatchCompletedAt: this.lastBatchCompletedAt,
    };
  }
}