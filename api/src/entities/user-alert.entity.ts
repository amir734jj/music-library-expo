import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "user_alerts" })
@Index("UQ_user_alerts_subscription_observation", ["artistSubscriptionId", "playObservationId"], { unique: true })
@Index("IX_user_alerts_user_id", ["userId"])
export class UserAlert {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "user_id", type: "uuid" }) userId!: string;
  @Column({ name: "artist_subscription_id", type: "uuid" }) artistSubscriptionId!: string;
  @Column({ name: "play_observation_id", type: "uuid" }) playObservationId!: string;
  @Column({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
}