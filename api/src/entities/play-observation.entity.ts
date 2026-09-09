import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

import { Station } from "./station.entity.js";

@Entity({ name: "play_observations" })
@Index("IX_play_observations_artist_observed_at", ["artist", "observedAt"])
export class PlayObservation {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "station_id", type: "uuid" }) stationId!: string;
  @ManyToOne(() => Station, (station) => station.observations, { onDelete: "CASCADE" })
  @JoinColumn({ name: "station_id" })
  station!: Station;
  @Column({ name: "raw_metadata", type: "text" }) rawMetadata!: string;
  @Column({ type: "text", nullable: true }) artist!: string | null;
  @Column({ type: "text", nullable: true }) title!: string | null;
  @Column({ type: "decimal", precision: 4, scale: 3 }) confidence!: number;
  @Column({ name: "observed_at", type: "timestamptz" }) observedAt!: Date;
}