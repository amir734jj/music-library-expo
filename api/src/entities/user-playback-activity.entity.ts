import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity({ name: "user_playback_activities" })
@Index("IX_user_playback_activities_heartbeat", ["lastHeartbeatAt"])
export class UserPlaybackActivity {
  @PrimaryColumn({ name: "user_id", type: "uuid" }) userId!: string;
  @Column({ name: "playback_description", type: "varchar", length: 300 }) playbackDescription!: string;
  @Column({ name: "is_live_station" }) isLiveStation!: boolean;
  @Column({ name: "started_at", type: "timestamptz" }) startedAt!: Date;
  @Column({ name: "last_heartbeat_at", type: "timestamptz" }) lastHeartbeatAt!: Date;
}