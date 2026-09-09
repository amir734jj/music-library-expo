import "reflect-metadata";

import { DataSource } from "typeorm";

import {
  ArtistSubscription,
  CachedTrack,
  GlobalConfigRow,
  PlayObservation,
  Station,
  User,
  UserAlert,
  UserPlaybackActivity,
} from "../entities/index.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for TypeORM migrations");
}

export default new DataSource({
  type: "postgres",
  url: databaseUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false,
  entities: [
    ArtistSubscription,
    CachedTrack,
    GlobalConfigRow,
    PlayObservation,
    Station,
    User,
    UserAlert,
    UserPlaybackActivity,
  ],
  migrations: [new URL("./migrations/*{.ts,.js}", import.meta.url).pathname],
  synchronize: false,
});