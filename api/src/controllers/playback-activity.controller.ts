import type {
  UpdatePlaybackActivityRequest,
  UserPlaybackActivitySummary,
} from "@music-library/core";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";

import { User } from "#entities";
import { JwtAuthGuard } from "#guards";
import { PlaybackActivityService } from "#services";

@Controller("playback-activity")
export class PlaybackActivityController {
  constructor(private readonly activity: PlaybackActivityService) {}

  @Get()
  list(): Promise<UserPlaybackActivitySummary[]> {
    return this.activity.list();
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async heartbeat(
    @Body() body: UpdatePlaybackActivityRequest,
    @Req() request: Request & { user: User },
  ): Promise<void> {
    const playbackDescription = body.playbackDescription?.trim();
    if (!playbackDescription || playbackDescription.length > 300) {
      throw new BadRequestException(
        "Playback description is required and must not exceed 300 characters",
      );
    }
    await this.activity.heartbeat(request.user.id, {
      playbackDescription,
      isLiveStation: body.isLiveStation === true,
    });
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  clear(@Req() request: Request & { user: User }): Promise<void> {
    return this.activity.clear(request.user.id);
  }
}