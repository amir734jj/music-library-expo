import type { StationCachedTrackSummary } from '@music-library/core';
import { invoke } from '@tauri-apps/api/core';

import { api } from '@/services/api';

export interface StationRipSubscription {
  stationId: string;
  stationName: string;
}

type Listener = (subscriptions: StationRipSubscription[]) => void;

const POLL_INTERVAL_MS = 15_000;

function trackFileName(track: StationCachedTrackSummary): string {
  return `${[track.artist, track.title].filter(Boolean).join(' - ') || 'radio-track'}.mp3`;
}

class DesktopRipper {
  readonly supported = typeof window !== 'undefined'
    && ('__TAURI_INTERNALS__' in window || window.location.hostname === 'tauri.localhost');
  private subscriptions: StationRipSubscription[] = [];
  private listeners = new Set<Listener>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private syncing = false;

  async initialize(): Promise<void> {
    if (!this.supported) return;
    this.subscriptions = await invoke<StationRipSubscription[]>('list_station_subscriptions');
    this.emit();
    await this.synchronize();
    this.pollTimer ??= setInterval(() => void this.synchronize(), POLL_INTERVAL_MS);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener([...this.subscriptions]);
    return () => this.listeners.delete(listener);
  }

  async toggle(stationId: string, stationName: string): Promise<void> {
    const existing = this.subscriptions.some((subscription) => subscription.stationId === stationId);
    if (existing) {
      this.subscriptions = this.subscriptions.filter((subscription) => subscription.stationId !== stationId);
    } else {
      await api.requestCapture(stationId);
      this.subscriptions = [...this.subscriptions, { stationId, stationName }]
        .sort((left, right) => left.stationName.localeCompare(right.stationName));
    }
    await invoke('save_station_subscriptions', { subscriptions: this.subscriptions });
    this.emit();
    if (!existing) await this.synchronize();
  }

  private emit(): void {
    for (const listener of this.listeners) listener([...this.subscriptions]);
  }

  private async synchronize(): Promise<void> {
    if (this.syncing || this.subscriptions.length === 0) return;
    this.syncing = true;
    try {
      for (const subscription of this.subscriptions) {
        try {
          await api.requestCapture(subscription.stationId).catch(() => undefined);
          const tracks = await api.stationCachedTracks(subscription.stationId);
          for (const track of tracks) {
            await invoke<boolean>('save_cached_track', {
              cachedTrackId: track.cachedTrackId,
              downloadUrl: api.cachedTrackUrl(track.cachedTrackId),
              fileName: trackFileName(track),
              stationName: subscription.stationName,
            });
          }
        } catch {
          // A later poll retries stations whose API or stream is temporarily unavailable.
        }
      }
    } finally {
      this.syncing = false;
    }
  }
}

export const desktopRipper = new DesktopRipper();
