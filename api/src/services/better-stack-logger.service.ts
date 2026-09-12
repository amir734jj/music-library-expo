import type { ClientLogRequest } from "@music-library/core";
import { ConsoleLogger, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Environment } from "#config";

interface BetterStackEvent {
  context?: string;
  dt: string;
  level: string;
  message: string;
  platform?: string;
  service: "api" | "client";
  stack?: string;
  version?: string;
}

@Injectable()
export class BetterStackLogger extends ConsoleLogger {
  private readonly endpoint: string;
  private readonly sourceToken: string;

  constructor(config: ConfigService<Environment, true>) {
    super();
    this.endpoint = normalizeEndpoint(config.get("clientLoggingEndpoint", { infer: true }));
    this.sourceToken = config.get("clientLoggingSourceToken", { infer: true });
  }

  override log(message: unknown, context?: string): void {
    super.log(message, context);
    this.sendNestEvent("info", message, undefined, context);
  }

  override warn(message: unknown, context?: string): void {
    super.warn(message, context);
    this.sendNestEvent("warn", message, undefined, context);
  }

  override error(message: unknown, stack?: string, context?: string): void {
    super.error(message, stack, context);
    this.sendNestEvent("error", message, stack, context);
  }

  override fatal(message: unknown, stack?: string, context?: string): void {
    super.fatal(message, stack, context);
    this.sendNestEvent("fatal", message, stack, context);
  }

  reportClient(event: ClientLogRequest): void {
    const payload: BetterStackEvent = {
      dt: event.timestamp,
      level: event.level,
      message: clean(event.message) ?? "Unknown client log message",
      service: "client",
    };
    const context = clean(event.context);
    const platform = clean(event.platform);
    const stack = clean(event.stack);
    const version = clean(event.version);
    if (context) payload.context = context;
    if (platform) payload.platform = platform;
    if (stack) payload.stack = stack;
    if (version) payload.version = version;
    void this.send(payload);
  }

  private sendNestEvent(
    level: string,
    message: unknown,
    stack?: string,
    context?: string,
  ): void {
    const payload: BetterStackEvent = {
      dt: new Date().toISOString(),
      level,
      message: clean(messageText(message)) ?? "Unknown log message",
      service: "api",
    };
    const cleanContext = clean(context);
    const cleanStack = clean(stack);
    if (cleanContext) payload.context = cleanContext;
    if (cleanStack) payload.stack = cleanStack;
    void this.send(payload);
  }

  private async send(event: BetterStackEvent): Promise<void> {
    if (!this.endpoint || !this.sourceToken) return;
    try {
      await fetch(this.endpoint, {
        body: JSON.stringify(event),
        headers: {
          Authorization: `Bearer ${this.sourceToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: AbortSignal.timeout(3_000),
      });
    } catch {
      // Local Nest logging must continue even when telemetry is unavailable.
    }
  }
}

function normalizeEndpoint(value: string): string {
  const trimmed = value.trim().replace(/\/+$/u, "");
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
}

function messageText(message: unknown): string {
  if (message instanceof Error) return `${message.name}: ${message.message}`;
  if (typeof message === "string") return message;
  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
}

function clean(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value)
    .slice(0, 16_000)
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/giu, "Bearer [REDACTED]")
    .replace(/\b(?:eyJ[A-Za-z0-9_-]+\.){2}[A-Za-z0-9_-]+\b/gu, "[REDACTED_JWT]")
    .replace(/([?&](?:access_token|api_key|password|token)=)[^&\s]+/giu, "$1[REDACTED]")
    .replace(/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s]+@/giu, "$1[REDACTED]@");
}