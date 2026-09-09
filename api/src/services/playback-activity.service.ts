import type {
  UpdatePlaybackActivityRequest,
  UserPlaybackActivitySummary,
} from "@music-library/core";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { User, UserPlaybackActivity } from "#entities";

const ACTIVITY_LIFETIME_MS = 90_000;

@Injectable()
export class PlaybackActivityService {
  constructor(
    @InjectRepository(UserPlaybackActivity)
    private readonly activities: Repository<UserPlaybackActivity>,
  ) {}

  async list(): Promise<UserPlaybackActivitySummary[]> {
    const rows = await this.activities
      .createQueryBuilder("activity")
      .innerJoin(User, "user", "user.id = activity.userId")
      .select("activity.userId", "userId")
      .addSelect("COALESCE(user.displayName, user.email, 'Listener')", "userDisplayName")
      .addSelect("activity.playbackDescription", "playbackDescription")
      .addSelect("activity.isLiveStation", "isLiveStation")
      .addSelect("activity.startedAt", "startedAt")
      .where("activity.lastHeartbeatAt >= :cutoff", {
        cutoff: new Date(Date.now() - ACTIVITY_LIFETIME_MS),
      })
      .orderBy("activity.startedAt", "DESC")
      .limit(100)
      .getRawMany<{
        userId: string;
        userDisplayName: string;
        playbackDescription: string;
        isLiveStation: boolean;
        startedAt: Date | string;
      }>();

    return rows.map((row) => ({
      ...row,
      isLiveStation: Boolean(row.isLiveStation),
      startedAt: new Date(row.startedAt).toISOString(),
    }));
  }

  async heartbeat(userId: string, request: UpdatePlaybackActivityRequest): Promise<void> {
    const now = new Date();
    const existing = await this.activities.findOneBy({ userId });
    if (!existing) {
      await this.activities.save({
        userId,
        playbackDescription: request.playbackDescription,
        isLiveStation: request.isLiveStation,
        startedAt: now,
        lastHeartbeatAt: now,
      });
      return;
    }

    const playbackChanged =
      existing.playbackDescription !== request.playbackDescription ||
      existing.isLiveStation !== request.isLiveStation;
    existing.playbackDescription = request.playbackDescription;
    existing.isLiveStation = request.isLiveStation;
    existing.lastHeartbeatAt = now;
    if (playbackChanged) existing.startedAt = now;
    await this.activities.save(existing);
  }

  async clear(userId: string): Promise<void> {
    await this.activities.delete({ userId });
  }
}