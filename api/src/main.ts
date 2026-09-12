import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";

import type { Environment } from "#config";
import { AppModule } from "#modules";
import { BetterStackLogger } from "#services";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<Environment, true>);
  const logger = app.get(BetterStackLogger);
  app.useLogger(logger);
  app.flushLogs();

  process.on("uncaughtExceptionMonitor", (error) => {
    logger.fatal(error.message, error.stack, "uncaughtException");
  });
  process.on("unhandledRejection", (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error(error.message, error.stack, "unhandledRejection");
  });

  app.enableShutdownHooks();
  app.enableCors({
    allowedHeaders: ["Authorization", "Content-Type"],
    methods: ["DELETE", "GET", "HEAD", "OPTIONS", "POST", "PUT"],
    origin: true,
  });
  app.setGlobalPrefix("api");

  await app.listen(config.get("port", { infer: true }), "0.0.0.0");
}

void bootstrap().catch((error: unknown) => {
  console.error("API bootstrap failed", error);
  process.exitCode = 1;
});