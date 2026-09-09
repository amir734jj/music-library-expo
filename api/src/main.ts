import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";

import type { Environment } from "#config";
import { AppModule } from "#modules";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Environment, true>);

  app.enableShutdownHooks();
  app.enableCors({
    allowedHeaders: ["Authorization", "Content-Type"],
    methods: ["DELETE", "GET", "HEAD", "OPTIONS", "POST", "PUT"],
    origin: true,
  });
  app.setGlobalPrefix("api");

  await app.listen(config.get("port", { infer: true }), "0.0.0.0");
}

void bootstrap();