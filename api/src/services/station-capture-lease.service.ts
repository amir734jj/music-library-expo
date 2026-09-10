import { Injectable } from "@nestjs/common";

const CAPTURE_LEASE_MS = 30_000;

@Injectable()
export class StationCaptureLeaseService {
  private readonly expiresAtByStation = new Map<string, number>();

  enable(stationId: string): void {
    this.expiresAtByStation.set(stationId, Date.now() + CAPTURE_LEASE_MS);
  }

  isEnabled(stationId: string): boolean {
    const expiresAt = this.expiresAtByStation.get(stationId);
    if (!expiresAt) return false;
    if (expiresAt > Date.now()) return true;
    this.expiresAtByStation.delete(stationId);
    return false;
  }
}
