import { isInteger, isString } from "lodash-es";

export interface Environment {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl: string;
  databaseSsl: boolean;
  jwtSecret: string;
  trendingCacheDirectory: string;
  clientLoggingEndpoint: string;
  clientLoggingSourceToken: string;
}

export function validateEnvironment(input: Record<string, unknown>): Environment {
  const nodeEnv = input.NODE_ENV ?? "development";
  if (nodeEnv !== "development" && nodeEnv !== "test" && nodeEnv !== "production") {
    throw new Error("NODE_ENV must be development, test, or production");
  }

  const port = Number(input.PORT ?? 3000);
  if (!isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  const databaseUrl = input.DATABASE_URL;
  if (!isString(databaseUrl) || !databaseUrl.startsWith("postgresql://")) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL");
  }

  const databaseSsl = input.DATABASE_SSL ?? "false";
  if (databaseSsl !== "true" && databaseSsl !== "false") {
    throw new Error("DATABASE_SSL must be true or false");
  }

  const jwtSecret = input.JWT_SECRET;
  if (!isString(jwtSecret) || jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
  }

  const trendingCacheDirectory = input.TRENDING_CACHE_DIRECTORY ?? "data/trending-cache";
  if (!isString(trendingCacheDirectory) || !trendingCacheDirectory.trim()) {
    throw new Error("TRENDING_CACHE_DIRECTORY must be a non-empty path");
  }

  return {
    nodeEnv,
    port,
    databaseUrl,
    databaseSsl: databaseSsl === "true",
    jwtSecret,
    trendingCacheDirectory,
    clientLoggingEndpoint:
      isString(input.CLIENT_LOGGING_ENDPOINT) ? input.CLIENT_LOGGING_ENDPOINT : "",
    clientLoggingSourceToken:
      isString(input.CLIENT_LOGGING_SOURCE_TOKEN)
        ? input.CLIENT_LOGGING_SOURCE_TOKEN
        : "",
  };
}