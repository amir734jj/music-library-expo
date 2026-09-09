import type { GlobalConfigModel, UpdateGlobalConfigRequest } from "@music-library/core";
import { BadRequestException, Injectable, type OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomBytes } from "node:crypto";
import { isInteger, isString } from "lodash-es";
import { Repository } from "typeorm";

import { GlobalConfigRow } from "#entities";

const DEFAULT_DIRECTORY_URL =
  "https://github.com/amir734jj/shoutcast-directory-crawler/releases/download/latest/shoutcast-directory.json";

export const CONFIG_KEYS = {
  directoryArtifactUrl: "DIRECTORY_ARTIFACT_URL",
  probingEnabled: "PROBING_ENABLED",
  probeConcurrency: "PROBE_CONCURRENCY",
  probeTimeoutSeconds: "PROBE_TIMEOUT_SECONDS",
  probeBatchSize: "PROBE_BATCH_SIZE",
  trendingCacheEncryptionKey: "TRENDING_CACHE_ENCRYPTION_KEY",
  trendingCacheCaptureTimeoutSeconds: "TRENDING_CACHE_CAPTURE_TIMEOUT_SECONDS",
  trendingMinimumDurationSeconds: "TRENDING_MINIMUM_DURATION_SECONDS",
  trendingCacheRetentionHours: "TRENDING_CACHE_RETENTION_HOURS",
  trendingCacheMaxSizeMegabytes: "TRENDING_CACHE_MAX_SIZE_MEGABYTES",
} as const;

const SUPPORTED_KEYS = new Set<string>(Object.values(CONFIG_KEYS));

@Injectable()
export class GlobalConfigService implements OnModuleInit {
  constructor(
    @InjectRepository(GlobalConfigRow)
    private readonly rows: Repository<GlobalConfigRow>,
  ) {}

  onModuleInit(): Promise<void> {
    return this.ensureCacheKey();
  }

  async get(): Promise<GlobalConfigModel> {
    const values = new Map((await this.rows.find()).map((row) => [row.key, row.value]));
    return {
      directoryArtifactUrl: values.get(CONFIG_KEYS.directoryArtifactUrl) ?? DEFAULT_DIRECTORY_URL,
      probingEnabled: booleanValue(values, CONFIG_KEYS.probingEnabled, true),
      probeConcurrency: integerValue(values, CONFIG_KEYS.probeConcurrency, 5, 1, 100),
      probeTimeoutSeconds: integerValue(values, CONFIG_KEYS.probeTimeoutSeconds, 12, 2, 60),
      probeBatchSize: integerValue(values, CONFIG_KEYS.probeBatchSize, 100, 1, 1_000),
      trendingCacheEncryptionKey:
        values.get(CONFIG_KEYS.trendingCacheEncryptionKey) ?? "",
      trendingCacheCaptureTimeoutSeconds: integerValue(
        values,
        CONFIG_KEYS.trendingCacheCaptureTimeoutSeconds,
        600,
        60,
        1_800,
      ),
      trendingMinimumDurationSeconds: integerValue(
        values,
        CONFIG_KEYS.trendingMinimumDurationSeconds,
        60,
        15,
        600,
      ),
      trendingCacheRetentionHours: integerValue(
        values,
        CONFIG_KEYS.trendingCacheRetentionHours,
        24,
        1,
        168,
      ),
      trendingCacheMaxSizeMegabytes: integerValue(
        values,
        CONFIG_KEYS.trendingCacheMaxSizeMegabytes,
        1_024,
        32,
        4_096,
      ),
    };
  }

  async ensureCacheKey(): Promise<void> {
    const current = await this.rows.findOneBy({ key: CONFIG_KEYS.trendingCacheEncryptionKey });
    if (decodeKey(current?.value)) return;
    await this.rows.save({
      key: CONFIG_KEYS.trendingCacheEncryptionKey,
      value: randomBytes(32).toString("base64"),
      updatedAt: new Date(),
      updatedByUserId: null,
    });
  }

  async save(request: UpdateGlobalConfigRequest, userId: string): Promise<void> {
    const now = new Date();
    for (const [rawKey, rawValue] of Object.entries(request.values)) {
      const key = rawKey.trim().toUpperCase();
      if (!SUPPORTED_KEYS.has(key)) continue;
      if (!isString(rawValue)) {
        throw new BadRequestException(`Configuration value for ${key} must be a string`);
      }
      await this.rows.save({
        key,
        value: rawValue.trim(),
        updatedAt: now,
        updatedByUserId: userId,
      });
    }
  }
}

export function decodeKey(value?: string): Buffer | null {
  if (!value) return null;
  const key = Buffer.from(value, "base64");
  return key.byteLength === 32 ? key : null;
}

function booleanValue(values: Map<string, string>, key: string, fallback: boolean): boolean {
  const value = values.get(key)?.toLowerCase();
  return value === "true" ? true : value === "false" ? false : fallback;
}

function integerValue(
  values: Map<string, string>,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const value = Number.parseInt(values.get(key) ?? "", 10);
  return isInteger(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
}