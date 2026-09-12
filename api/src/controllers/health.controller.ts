import type { HealthStatus } from "@music-library/core";
import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { DataSource } from "typeorm";

@Controller()
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

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

}