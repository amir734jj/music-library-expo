import { Injectable } from "@nestjs/common";

export interface TrackCaptureRequest {
  observationId: string;
  priority: boolean;
  streamUrl: string;
}

const MAX_QUEUE_LENGTH = 100;

@Injectable()
export class TrackCaptureQueue {
  private readonly pending: TrackCaptureRequest[] = [];
  private readonly knownObservations = new Set<string>();

  enqueue(request: TrackCaptureRequest): boolean {
    if (
      this.knownObservations.has(request.observationId)
    ) {
      return false;
    }
    if (this.pending.length >= MAX_QUEUE_LENGTH) {
      if (!request.priority) return false;
      const displacedIndex = this.pending.findLastIndex((pending) => !pending.priority);
      if (displacedIndex < 0) return false;
      const [displaced] = this.pending.splice(displacedIndex, 1);
      if (!displaced) return false;
      this.knownObservations.delete(displaced.observationId);
    }
    this.knownObservations.add(request.observationId);
    const firstOrdinaryIndex = this.pending.findIndex((pending) => !pending.priority);
    if (request.priority && firstOrdinaryIndex >= 0) this.pending.splice(firstOrdinaryIndex, 0, request);
    else this.pending.push(request);
    return true;
  }

  dequeue(): TrackCaptureRequest | undefined {
    return this.pending.shift();
  }

  complete(observationId: string): void {
    this.knownObservations.delete(observationId);
  }
}