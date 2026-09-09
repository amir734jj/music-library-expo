import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";

import { PlayObservation } from "./play-observation.entity.js";

@Entity({ name: "stations" })
@Index("UQ_stations_directory_id", ["directoryId"], { unique: true })
@Index("IX_stations_probe_selection", ["isProbeEnabled", "lastProbedAt"])
@Index("IX_stations_last_metadata_at", ["lastMetadataAt"])
export class Station {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "directory_id", type: "bigint" }) directoryId!: string;
  @Column({ type: "text" }) name!: string;
  @Column({ type: "text" }) genre!: string;
  @Column({ name: "stream_url", type: "text" }) streamUrl!: string;
  @Column({ name: "is_probe_enabled", default: true }) isProbeEnabled!: boolean;
  @Column({ name: "last_probed_at", type: "timestamptz", nullable: true }) lastProbedAt!: Date | null;
  @Column({ name: "last_metadata_at", type: "timestamptz", nullable: true }) lastMetadataAt!: Date | null;
  @Column({ name: "current_raw_metadata", type: "text", nullable: true }) currentRawMetadata!: string | null;
  @Column({ name: "current_artist", type: "text", nullable: true }) currentArtist!: string | null;
  @Column({ name: "current_title", type: "text", nullable: true }) currentTitle!: string | null;
  @Column({ name: "current_confidence", type: "decimal", precision: 4, scale: 3, default: 0 }) currentConfidence!: number;
  @Column({ name: "consecutive_probe_failures", default: 0 }) consecutiveProbeFailures!: number;
  @OneToMany(() => PlayObservation, (observation) => observation.station) observations!: PlayObservation[];
}