import {
  Table,
  TableCheck,
  TableUnique,
  type MigrationInterface,
  type QueryRunner,
} from "typeorm";

export class CreateUsers1757376000000 implements MigrationInterface {
  name = "CreateUsers1757376000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "users",
        columns: [
          {
            name: "id",
            type: "uuid",
            isGenerated: true,
            generationStrategy: "uuid",
            isPrimary: true,
          },
          { name: "email", type: "varchar", length: "320" },
          { name: "password_hash", type: "text" },
          { name: "display_name", type: "varchar", length: "120", isNullable: true },
          { name: "is_active", type: "boolean", default: true },
          { name: "role", type: "varchar", length: "32", default: "'User'" },
          { name: "last_login_at", type: "timestamptz", isNullable: true },
          { name: "created_at", type: "timestamptz", default: "now()" },
          { name: "updated_at", type: "timestamptz", default: "now()" },
        ],
        uniques: [
          new TableUnique({ name: "UQ_users_email", columnNames: ["email"] }),
        ],
        checks: [
          new TableCheck({
            name: "CHK_users_role",
            expression: `"role" IN ('User', 'Admin')`,
          }),
        ],
      }),
      true,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("users", true);
  }
}