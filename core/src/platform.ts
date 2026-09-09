export type PlaybackState = "stopped" | "paused" | "playing" | "buffering";

export interface PlaybackProgress {
  positionSeconds: number;
  durationSeconds: number;
  canSeek: boolean;
}

export type AudioSource =
  | { kind: "remote"; uri: string; isLive: boolean }
  | { kind: "local"; uri: string; contentType?: string }
  | { kind: "blob"; blob: Blob };

export type PlaybackEvent =
  | { type: "stateChanged"; state: PlaybackState }
  | { type: "progressChanged"; progress: PlaybackProgress }
  | { type: "completed" }
  | { type: "error"; code: string; message: string };

export interface TrackPlayer {
  play(source: AudioSource, signal?: AbortSignal): Promise<void>;
  playToCompletion(source: AudioSource, signal?: AbortSignal): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  seek(positionSeconds: number): Promise<void>;
  getState(): PlaybackState;
  getProgress(): PlaybackProgress;
  subscribe(listener: (event: PlaybackEvent) => void): () => void;
}

export interface SaveTrackInput {
  data: Blob | ArrayBuffer;
  filename: string;
  contentType?: string;
  stationName?: string;
}

export interface OfflineTrack {
  key: string;
  name: string;
  size: number;
  savedAt: string;
  stationName?: string;
  contentType?: string;
}

export interface TrackStorage {
  save(input: SaveTrackInput): Promise<OfflineTrack>;
  list(): Promise<OfflineTrack[]>;
  resolve(key: string): Promise<AudioSource>;
  delete(key: string): Promise<void>;
  getDisplayLocation(): Promise<string | null>;
  chooseDirectory?(): Promise<void>;
}

export interface StoredAuthentication {
  accessToken: string;
  expiresAt: string;
  userId: string;
}

export interface AuthenticationStorage {
  load(): Promise<StoredAuthentication | null>;
  save(value: StoredAuthentication): Promise<void>;
  clear(): Promise<void>;
}