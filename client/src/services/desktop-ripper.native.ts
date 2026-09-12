export enum StationRipStatus {
  Error = 'error',
  Saved = 'saved',
  Syncing = 'syncing',
  Waiting = 'waiting',
}

export interface StationRipSubscription {
  stationId: string;
  stationName: string;
  status?: StationRipStatus;
  statusMessage?: string;
}

type Listener = (subscriptions: StationRipSubscription[]) => void;

class DesktopRipper {
  readonly supported = false;

  initialize(): Promise<void> {
    return Promise.resolve();
  }

  subscribe(listener: Listener): () => void {
    listener([]);
    return () => undefined;
  }

  setOfflineMode(_offline: boolean): void {}

  toggle(_stationId: string, _stationName: string): Promise<void> {
    return Promise.resolve();
  }
}

export const desktopRipper = new DesktopRipper();