import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import {
  ArtistSubscription,
  CachedTrack,
  GlobalConfigRow,
  PlayObservation,
  Station,
  UserAlert,
  UserPlaybackActivity,
} from "#entities";

const entities = [
  ArtistSubscription,
  CachedTrack,
  GlobalConfigRow,
  PlayObservation,
  Station,
  UserAlert,
  UserPlaybackActivity,
];

@Module({
  imports: [TypeOrmModule.forFeature(entities)],
  exports: [TypeOrmModule],
})
export class EntitiesModule {}