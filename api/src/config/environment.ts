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
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  const databaseUrl = input.DATABASE_URL;
  if (typeof databaseUrl !== "string" || !databaseUrl.startsWith("postgresql://")) {
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL");
  }

  const databaseSsl = input.DATABASE_SSL ?? "false";
  if (databaseSsl !== "true" && databaseSsl !== "false") {
    throw new Error("DATABASE_SSL must be true or false");
  }

  const jwtSecret = input.JWT_SECRET;
  if (typeof jwtSecret !== "string" || jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
  }

  const trendingCacheDirectory = input.TRENDING_CACHE_DIRECTORY ?? "data/trending-cache";
  if (typeof trendingCacheDirectory !== "string" || !trendingCacheDirectory.trim()) {
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
      typeof input.CLIENT_LOGGING_ENDPOINT === "string" ? input.CLIENT_LOGGING_ENDPOINT : "",
    clientLoggingSourceToken:
      typeof input.CLIENT_LOGGING_SOURCE_TOKEN === "string"
        ? input.CLIENT_LOGGING_SOURCE_TOKEN
        : "",
  };
}