import { Injectable } from "@nestjs/common";

export interface TrackCaptureRequest {
  observationId: string;
  streamUrl: string;
}

const MAX_QUEUE_LENGTH = 100;

@Injectable()
export class TrackCaptureQueue {
  private readonly pending: TrackCaptureRequest[] = [];
  private readonly knownObservations = new Set<string>();

  enqueue(request: TrackCaptureRequest): boolean {
    if (
      this.knownObservations.has(request.observationId) ||
      this.pending.length >= MAX_QUEUE_LENGTH
    ) {
      return false;
    }
    this.knownObservations.add(request.observationId);
    this.pending.push(request);
    return true;
  }

  dequeue(): TrackCaptureRequest | undefined {
    return this.pending.shift();
  }

  complete(observationId: string): void {
    this.knownObservations.delete(observationId);
  }
}