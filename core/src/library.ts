export interface StationSummary {
  id: string;
  name: string;
  genre: string;
  streamUrl: string;
  isProbeEnabled: boolean;
  lastProbedAt: string | null;
}

export interface NowPlayingSummary {
  stationId: string;
  stationName: string;
  artist: string | null;
  title: string | null;
  rawMetadata: string;
  observedAt: string;
  confidence: number;
  streamUrl: string | null;
}

export interface TrendingSummary {
  artist: string;
  title: string | null;
  genres: string[];
  observationCount: number;
  stationCount: number;
  lastObservedAt: string;
  lastStationId: string;
  lastStationName: string;
  lastStationStreamUrl: string | null;
  bitrateKbps: number | null;
  durationMs: number | null;
  cachedTrackId: string | null;
  cachedUntil: string | null;
}

export interface StationCachedTrackSummary {
  cachedTrackId: string;
  artist: string;
  title: string | null;
  observedAt: string;
  cachedUntil: string;
}

export interface LiveStreamTicket {
  path: string;
}