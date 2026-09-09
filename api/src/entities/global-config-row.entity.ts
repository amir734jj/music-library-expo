import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "global_config" })
export class GlobalConfigRow {
  @PrimaryColumn({ type: "varchar", length: 128 }) key!: string;
  @Column({ type: "varchar", length: 2048 }) value!: string;
  @Column({ name: "updated_at", type: "timestamptz" }) updatedAt!: Date;
  @Column({ name: "updated_by_user_id", type: "uuid", nullable: true }) updatedByUserId!: string | null;
}