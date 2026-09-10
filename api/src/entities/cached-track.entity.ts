import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "cached_tracks" })
@Index("UQ_cached_tracks_observation", ["playObservationId"], { unique: true })
@Index("IX_cached_tracks_expires_at", ["expiresAt"])
@Index("IX_cached_tracks_lookup", ["normalizedArtist", "normalizedTitle", "expiresAt"])
export class CachedTrack {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "play_observation_id", type: "uuid" }) playObservationId!: string;
  @Column({ type: "text" }) artist!: string;
  @Column({ type: "text", nullable: true }) title!: string | null;
  @Column({ name: "normalized_artist", type: "text" }) normalizedArtist!: string;
  @Column({ name: "normalized_title", type: "text" }) normalizedTitle!: string;
  @Column({ name: "file_path", type: "text" }) filePath!: string;
  @Column({ name: "content_type", type: "text", default: "audio/mpeg" }) contentType!: string;
  @Column({ name: "plaintext_length", type: "bigint" }) plaintextLength!: string;
  @Column({ name: "bitrate_kbps", type: "integer", nullable: true }) bitrateKbps!: number | null;
  @Column({ name: "duration_ms", type: "integer", nullable: true }) durationMs!: number | null;
  @Column({ name: "key_fingerprint", type: "varchar", length: 64 }) keyFingerprint!: string;
  @Column({ name: "created_at", type: "timestamptz" }) createdAt!: Date;
  @Column({ name: "expires_at", type: "timestamptz" }) expiresAt!: Date;
}