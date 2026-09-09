import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ServeStaticModule } from "@nestjs/serve-static";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";
import { join } from "node:path";

import { validateEnvironment, type Environment } from "#config";
import { createDatabaseOptions } from "#database";
import { AdminModule } from "./admin.module.js";
import { AuthModule } from "./auth.module.js";
import { EntitiesModule } from "./entities.module.js";
import { HealthModule } from "./health.module.js";
import { LibraryModule } from "./library.module.js";
import { PlaybackActivityModule } from "./playback-activity.module.js";
import { ProbingModule } from "./probing.module.js";
import { UsersModule } from "./users.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), "public"),
      exclude: ["/api/{*path}"],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) =>
        createDatabaseOptions(config),
    }),
    ScheduleModule.forRoot(),
    AdminModule,
    HealthModule,
    LibraryModule,
    PlaybackActivityModule,
    AuthModule,
    EntitiesModule,
    ProbingModule,
    UsersModule,
  ],
})
export class AppModule {}