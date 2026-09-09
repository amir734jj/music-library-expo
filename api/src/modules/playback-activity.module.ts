import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { PlaybackActivityController } from "#controllers";
import { UserPlaybackActivity } from "#entities";
import { PlaybackActivityService } from "#services";

import { AuthModule } from "./auth.module.js";

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([UserPlaybackActivity])],
  controllers: [PlaybackActivityController],
  providers: [PlaybackActivityService],
})
export class PlaybackActivityModule {}