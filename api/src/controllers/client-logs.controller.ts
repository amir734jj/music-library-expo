import type { ClientLogRequest } from "@music-library/core";
import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";

import { BetterStackLogger } from "#services";

const WINDOW_MS = 60_000;
const MAX_REPORTS_PER_WINDOW = 30;

@Controller("client-logs")
export class ClientLogsController {
  private readonly windows = new Map<string, { count: number; startedAt: number }>();

  constructor(private readonly logger: BetterStackLogger) {}

  @Post()
  @HttpCode(202)
  report(@Body() body: unknown, @Req() request: Request): void {
    this.checkRateLimit(request.ip || "unknown");
    if (!isClientLogRequest(body)) {
      throw new BadRequestException("Invalid client log event");
    }
    this.logger.reportClient(body);
  }

  private checkRateLimit(address: string): void {
    const now = Date.now();
    if (this.windows.size >= 1_000 && !this.windows.has(address)) {
      for (const [key, window] of this.windows) {
        if (now - window.startedAt >= WINDOW_MS) this.windows.delete(key);
      }
      if (this.windows.size >= 1_000) {
        const oldest = this.windows.keys().next().value as string | undefined;
        if (oldest) this.windows.delete(oldest);
      }
    }
    const current = this.windows.get(address);
    if (!current || now - current.startedAt >= WINDOW_MS) {
      this.windows.set(address, { count: 1, startedAt: now });
      return;
    }
    current.count += 1;
    if (current.count > MAX_REPORTS_PER_WINDOW) {
      throw new HttpException("Too many client log events", HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}

function isClientLogRequest(value: unknown): value is ClientLogRequest {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return (event.level === "error" || event.level === "info" || event.level === "warn")
    && isBoundedString(event.message, 1, 8_000)
    && isBoundedString(event.platform, 1, 40)
    && isBoundedString(event.timestamp, 1, 80)
    && !Number.isNaN(Date.parse(event.timestamp))
    && isOptionalBoundedString(event.context, 200)
    && isOptionalBoundedString(event.stack, 16_000)
    && isOptionalBoundedString(event.version, 80);
}

function isBoundedString(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === "string" && value.length >= minimum && value.length <= maximum;
}

function isOptionalBoundedString(value: unknown, maximum: number): boolean {
  return value === undefined || (typeof value === "string" && value.length <= maximum);
}