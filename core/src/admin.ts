import type { StationSummary } from "./library.js";
import type { UserRole } from "./users.js";

export interface GlobalConfigModel {
  directoryArtifactUrl: string;
  probingEnabled: boolean;
  probeConcurrency: number;
  probeTimeoutSeconds: number;
  probeBatchSize: number;
  trendingCacheEncryptionKey: string;
  trendingCacheCaptureTimeoutSeconds: number;
  trendingMinimumDurationSeconds: number;
  trendingCacheRetentionHours: number;
  trendingCacheMaxSizeMegabytes: number;
}

export interface UpdateGlobalConfigRequest {
  values: Readonly<Record<string, string>>;
}

export interface UpdateStationProbeRequest {
  isProbeEnabled: boolean;
}

export interface UpdateUserRequest {
  displayName: string | null;
  isActive: boolean;
  role: UserRole | null;
}

export interface DirectoryImportSummary {
  created: number;
  updated: number;
  rejected: number;
}

export interface TrendingCacheStatusSummary {
  sizeBytes: number;
  songCount: number;
}

export interface StationProbeStatusSummary extends StationSummary {
  isProbing: boolean;
  probeStartedAt: string | null;
  lastMetadataAt: string | null;
  consecutiveProbeFailures: number;
}

export interface ProbeStatusSummary {
  probingEnabled: boolean;
  lastBatchStartedAt: string | null;
  lastBatchCompletedAt: string | null;
  activeProbeCount: number;
  enabledStationCount: number;
  matchingStationCount: number;
  page: number;
  pageSize: number;
  stations: StationProbeStatusSummary[];
}