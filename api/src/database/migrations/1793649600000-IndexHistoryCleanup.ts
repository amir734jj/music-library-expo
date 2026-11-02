import { TableIndex, type MigrationInterface, type QueryRunner } from "typeorm";

export class IndexHistoryCleanup1793649600000 implements MigrationInterface {
  name = "IndexHistoryCleanup1793649600000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex("play_observations", new TableIndex({
      name: "IX_play_observations_cleanup",
      columnNames: ["observed_at", "id"],
    }));
    await queryRunner.createIndex("user_alerts", new TableIndex({
      name: "IX_user_alerts_cleanup",
      columnNames: ["created_at", "id"],
    }));
    await queryRunner.createIndex("user_alerts", new TableIndex({
      name: "IX_user_alerts_observation",
      columnNames: ["play_observation_id"],
    }));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex("user_alerts", "IX_user_alerts_observation");
    await queryRunner.dropIndex("user_alerts", "IX_user_alerts_cleanup");
    await queryRunner.dropIndex("play_observations", "IX_play_observations_cleanup");
  }
}
