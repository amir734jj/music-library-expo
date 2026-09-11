import type { StationCachedTrackSummary } from '@music-library/core';
import { invoke } from '@tauri-apps/api/core';

import { api } from '@/services/api';
import { desktopLogger } from '@/services/desktop-logger';

export interface StationRipSubscription {
  stationId: string;
  stationName: string;
  status?: 'error' | 'saved' | 'syncing' | 'waiting';
  statusMessage?: string;
}

type Listener = (subscriptions: StationRipSubscription[]) => void;

const POLL_INTERVAL_MS = 15_000;

function trackFileName(track: StationCachedTrackSummary): string {
  return `${[track.artist, track.title].filter(Boolean).join(' - ') || 'radio-track'}.mp3`;
}

class DesktopRipper {
  readonly supported = typeof window !== 'undefined'
    && ('__TAURI_INTERNALS__' in window
      || window.location.protocol === 'tauri:'
      || window.location.hostname === 'tauri.localhost');
  private subscriptions: StationRipSubscription[] = [];
  private listeners = new Set<Listener>();
  private offline = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private syncing = false;

  async initialize(): Promise<void> {
    if (!this.supported) return;
    this.subscriptions = (await invoke<StationRipSubscription[]>('list_station_subscriptions'))
      .map((subscription: StationRipSubscription) => ({ ...subscription, status: 'waiting' }));
    await desktopLogger.info(`Ripping initialized with ${this.subscriptions.length} station subscription(s)`);
    this.emit();
    await this.synchronize();
    this.pollTimer ??= setInterval(() => void this.synchronize(), POLL_INTERVAL_MS);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener([...this.subscriptions]);
    return () => this.listeners.delete(listener);
  }

  setOfflineMode(offline: boolean): void {
    this.offline = offline;
    if (!offline) void this.synchronize();
  }

  async toggle(stationId: string, stationName: string): Promise<void> {
    const existing = this.subscriptions.some((subscription) => subscription.stationId === stationId);
    if (existing) {
      this.subscriptions = this.subscriptions.filter((subscription) => subscription.stationId !== stationId);
    } else {
      const subscription: StationRipSubscription = {
        stationId,
        stationName,
        status: 'syncing',
        statusMessage: 'Requesting the next complete song...',
      };
      this.subscriptions = [...this.subscriptions, subscription]
        .sort((left, right) => left.stationName.localeCompare(right.stationName));
    }
    await invoke('save_station_subscriptions', {
      subscriptions: this.subscriptions.map(({ stationId: id, stationName: name }) => ({
        stationId: id,
        stationName: name,
      })),
    });
    await desktopLogger.info(`${existing ? 'Stopped' : 'Started'} ripping station ${stationId} (${stationName})`);
    this.emit();
    if (!existing) await this.synchronize();
  }

  private emit(): void {
    for (const listener of this.listeners) listener([...this.subscriptions]);
  }

  private async synchronize(): Promise<void> {
    if (this.offline || this.syncing || this.subscriptions.length === 0) return;
    this.syncing = true;
    let downloaded = false;
    try {
      for (const subscription of this.subscriptions) {
        try {
          this.updateStatus(subscription.stationId, 'syncing', 'Requesting the next complete song...');
          await api.requestCapture(subscription.stationId);
          const tracks = await api.stationCachedTracks(subscription.stationId);
          let stationDownloads = 0;
          for (const track of tracks) {
            const saved = await invoke<boolean>('save_cached_track', {
              cachedTrackId: track.cachedTrackId,
              downloadUrl: api.cachedTrackUrl(track.cachedTrackId),
              fileName: trackFileName(track),
              stationName: subscription.stationName,
            });
            if (saved) stationDownloads += 1;
            downloaded = saved || downloaded;
          }
          const statusMessage = stationDownloads > 0
            ? `Saved ${stationDownloads} new ${stationDownloads === 1 ? 'song' : 'songs'}.`
            : tracks.length > 0
              ? 'Watching for new songs. Existing captures are already saved.'
              : 'Waiting for the next complete song...';
          this.updateStatus(subscription.stationId, stationDownloads > 0 ? 'saved' : 'waiting', statusMessage);
          await desktopLogger.info(`Ripping station ${subscription.stationId}: ${statusMessage}`);
        } catch (syncError) {
          const message = syncError instanceof Error ? syncError.message : String(syncError);
          this.updateStatus(subscription.stationId, 'error', message);
          await desktopLogger.error(`Ripping station ${subscription.stationId} failed: ${message}`);
        }
      }
    } finally {
      this.syncing = false;
      if (downloaded) this.emit();
    }
  }

  private updateStatus(
    stationId: string,
    status: StationRipSubscription['status'],
    statusMessage: string,
  ): void {
    this.subscriptions = this.subscriptions.map((subscription) => subscription.stationId === stationId
      ? { ...subscription, status, statusMessage }
      : subscription);
    this.emit();
  }
}

export const desktopRipper = new DesktopRipper();
