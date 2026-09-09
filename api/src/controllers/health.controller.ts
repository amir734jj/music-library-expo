import type { ClientLoggingConfiguration, HealthStatus } from "@music-library/core";
import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";

import type { Environment } from "#config";

@Controller()
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  @Get("health")
  async getHealth(): Promise<HealthStatus> {
    try {
      await this.dataSource.query("SELECT 1");
      return { status: "ok", database: "up" };
    } catch {
      throw new ServiceUnavailableException({
        status: "unavailable",
        database: "down",
      });
    }
  }

  @Get("client-logging")
  getClientLogging(): ClientLoggingConfiguration {
    return {
      endpoint: this.config.get("clientLoggingEndpoint", { infer: true }),
      sourceToken: this.config.get("clientLoggingSourceToken", { infer: true }),
    };
  }
}