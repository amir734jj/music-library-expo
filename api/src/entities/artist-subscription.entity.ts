import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "artist_subscriptions" })
@Index("UQ_artist_subscriptions_user_artist", ["userId", "normalizedArtistName"], { unique: true })
export class ArtistSubscription {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "user_id", type: "uuid" }) userId!: string;
  @Column({ name: "artist_name", type: "varchar", length: 200 }) artistName!: string;
  @Column({ name: "normalized_artist_name", type: "varchar", length: 200 }) normalizedArtistName!: string;
  @Column({ name: "capture_enabled" }) captureEnabled!: boolean;
  @Column({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
}