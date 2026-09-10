import type { ConfigService } from "@nestjs/config";
import type { TypeOrmModuleOptions } from "@nestjs/typeorm";

import type { Environment } from "#config";
import { databaseMigrations } from "./migrations/index.js";

export function createDatabaseOptions(
  config: ConfigService<Environment, true>,
): TypeOrmModuleOptions {
  return {
    type: "postgres",
    url: config.get("databaseUrl", { infer: true }),
    ssl: config.get("databaseSsl", { infer: true })
      ? { rejectUnauthorized: true }
      : false,
    autoLoadEntities: true,
    migrations: databaseMigrations,
    migrationsRun: config.get("nodeEnv", { infer: true }) === "production",
    synchronize: false,
    retryAttempts: 10,
    retryDelay: 3_000,
  };
}