import {
  Table,
  TableForeignKey,
  TableIndex,
  type MigrationInterface,
  type QueryRunner,
} from "typeorm";

export class CreateLibrarySchema1757376001000 implements MigrationInterface {
  name = "CreateLibrarySchema1757376001000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "stations",
        columns: [
          { name: "id", type: "uuid", isGenerated: true, generationStrategy: "uuid", isPrimary: true },
          { name: "directory_id", type: "bigint" },
          { name: "name", type: "text" },
          { name: "genre", type: "text" },
          { name: "stream_url", type: "text" },
          { name: "is_probe_enabled", type: "boolean", default: true },
          { name: "last_probed_at", type: "timestamptz", isNullable: true },
          { name: "last_metadata_at", type: "timestamptz", isNullable: true },
          { name: "current_raw_metadata", type: "text", isNullable: true },
          { name: "current_artist", type: "text", isNullable: true },
          { name: "current_title", type: "text", isNullable: true },
          { name: "current_confidence", type: "decimal", precision: 4, scale: 3, default: 0 },
          { name: "consecutive_probe_failures", type: "integer", default: 0 },
        ],
        indices: [
          new TableIndex({ name: "UQ_stations_directory_id", columnNames: ["directory_id"], isUnique: true }),
          new TableIndex({ name: "IX_stations_probe_selection", columnNames: ["is_probe_enabled", "last_probed_at"] }),
          new TableIndex({ name: "IX_stations_last_metadata_at", columnNames: ["last_metadata_at"] }),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "play_observations",
        columns: [
          { name: "id", type: "uuid", isGenerated: true, generationStrategy: "uuid", isPrimary: true },
          { name: "station_id", type: "uuid" },
          { name: "raw_metadata", type: "text" },
          { name: "artist", type: "text", isNullable: true },
          { name: "title", type: "text", isNullable: true },
          { name: "confidence", type: "decimal", precision: 4, scale: 3 },
          { name: "observed_at", type: "timestamptz" },
        ],
        foreignKeys: [
          new TableForeignKey({
            name: "FK_play_observations_station",
            columnNames: ["station_id"],
            referencedTableName: "stations",
            referencedColumnNames: ["id"],
            onDelete: "CASCADE",
          }),
        ],
        indices: [
          new TableIndex({ name: "IX_play_observations_artist_observed_at", columnNames: ["artist", "observed_at"] }),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "artist_subscriptions",
        columns: [
          { name: "id", type: "uuid", isGenerated: true, generationStrategy: "uuid", isPrimary: true },
          { name: "user_id", type: "uuid" },
          { name: "artist_name", type: "varchar", length: "200" },
          { name: "normalized_artist_name", type: "varchar", length: "200" },
          { name: "capture_enabled", type: "boolean" },
          { name: "created_at", type: "timestamptz" },
        ],
        foreignKeys: [
          new TableForeignKey({
            name: "FK_artist_subscriptions_user",
            columnNames: ["user_id"],
            referencedTableName: "users",
            referencedColumnNames: ["id"],
            onDelete: "CASCADE",
          }),
        ],
        indices: [
          new TableIndex({
            name: "UQ_artist_subscriptions_user_artist",
            columnNames: ["user_id", "normalized_artist_name"],
            isUnique: true,
          }),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "user_alerts",
        columns: [
          { name: "id", type: "uuid", isGenerated: true, generationStrategy: "uuid", isPrimary: true },
          { name: "user_id", type: "uuid" },
          { name: "artist_subscription_id", type: "uuid" },
          { name: "play_observation_id", type: "uuid" },
          { name: "created_at", type: "timestamptz" },
        ],
        foreignKeys: [
          new TableForeignKey({ name: "FK_user_alerts_user", columnNames: ["user_id"], referencedTableName: "users", referencedColumnNames: ["id"], onDelete: "CASCADE" }),
          new TableForeignKey({ name: "FK_user_alerts_subscription", columnNames: ["artist_subscription_id"], referencedTableName: "artist_subscriptions", referencedColumnNames: ["id"], onDelete: "CASCADE" }),
          new TableForeignKey({ name: "FK_user_alerts_observation", columnNames: ["play_observation_id"], referencedTableName: "play_observations", referencedColumnNames: ["id"], onDelete: "CASCADE" }),
        ],
        indices: [
          new TableIndex({ name: "UQ_user_alerts_subscription_observation", columnNames: ["artist_subscription_id", "play_observation_id"], isUnique: true }),
          new TableIndex({ name: "IX_user_alerts_user_id", columnNames: ["user_id"] }),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "cached_tracks",
        columns: [
          { name: "id", type: "uuid", isGenerated: true, generationStrategy: "uuid", isPrimary: true },
          { name: "play_observation_id", type: "uuid" },
          { name: "artist", type: "text" },
          { name: "title", type: "text", isNullable: true },
          { name: "normalized_artist", type: "text" },
          { name: "normalized_title", type: "text" },
          { name: "file_path", type: "text" },
          { name: "content_type", type: "text", default: "'audio/mpeg'" },
          { name: "plaintext_length", type: "bigint" },
          { name: "bitrate_kbps", type: "integer", isNullable: true },
          { name: "duration_ms", type: "integer", isNullable: true },
          { name: "key_fingerprint", type: "varchar", length: "64" },
          { name: "created_at", type: "timestamptz" },
          { name: "expires_at", type: "timestamptz" },
        ],
        foreignKeys: [
          new TableForeignKey({ name: "FK_cached_tracks_observation", columnNames: ["play_observation_id"], referencedTableName: "play_observations", referencedColumnNames: ["id"], onDelete: "CASCADE" }),
        ],
        indices: [
          new TableIndex({ name: "UQ_cached_tracks_observation", columnNames: ["play_observation_id"], isUnique: true }),
          new TableIndex({ name: "IX_cached_tracks_expires_at", columnNames: ["expires_at"] }),
          new TableIndex({ name: "IX_cached_tracks_lookup", columnNames: ["normalized_artist", "normalized_title", "expires_at"] }),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "user_playback_activities",
        columns: [
          { name: "user_id", type: "uuid", isPrimary: true },
          { name: "playback_description", type: "varchar", length: "300" },
          { name: "is_live_station", type: "boolean" },
          { name: "started_at", type: "timestamptz" },
          { name: "last_heartbeat_at", type: "timestamptz" },
        ],
        foreignKeys: [
          new TableForeignKey({ name: "FK_user_playback_activities_user", columnNames: ["user_id"], referencedTableName: "users", referencedColumnNames: ["id"], onDelete: "CASCADE" }),
        ],
        indices: [
          new TableIndex({ name: "IX_user_playback_activities_heartbeat", columnNames: ["last_heartbeat_at"] }),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "global_config",
        columns: [
          { name: "key", type: "varchar", length: "128", isPrimary: true },
          { name: "value", type: "varchar", length: "2048" },
          { name: "updated_at", type: "timestamptz" },
          { name: "updated_by_user_id", type: "uuid", isNullable: true },
        ],
        foreignKeys: [
          new TableForeignKey({ name: "FK_global_config_updated_by", columnNames: ["updated_by_user_id"], referencedTableName: "users", referencedColumnNames: ["id"], onDelete: "SET NULL" }),
        ],
      }),
      true,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("global_config", true);
    await queryRunner.dropTable("user_playback_activities", true);
    await queryRunner.dropTable("cached_tracks", true);
    await queryRunner.dropTable("user_alerts", true);
    await queryRunner.dropTable("artist_subscriptions", true);
    await queryRunner.dropTable("play_observations", true);
    await queryRunner.dropTable("stations", true);
  }
}