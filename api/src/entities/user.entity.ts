import { UserRole, type UserRoleType } from "@music-library/core";
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 320, unique: true })
  email!: string;

  @Column({ name: "password_hash", type: "text", select: false })
  passwordHash!: string;

  @Column({ name: "display_name", type: "varchar", length: 120, nullable: true })
  displayName!: string | null;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "varchar", length: 32, default: UserRole.User })
  role!: UserRoleType;

  @Column({ name: "last_login_at", type: "timestamptz", nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}