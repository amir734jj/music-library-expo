import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import {
  ArtistSubscription,
  GlobalConfigRow,
  PlayObservation,
  Station,
  UserAlert,
} from "#entities";
import { StationProbeStatusService, StreamMetadataProbeService } from "#services";
import { StationProbeWorker } from "#workers";
import { CaptureModule } from "./capture.module.js";

@Module({
  imports: [
    CaptureModule,
    TypeOrmModule.forFeature([
      ArtistSubscription,
      GlobalConfigRow,
      PlayObservation,
      Station,
      UserAlert,
    ]),
  ],
  providers: [StationProbeWorker, StationProbeStatusService, StreamMetadataProbeService],
  exports: [StationProbeStatusService, StreamMetadataProbeService],
})
export class ProbingModule {}