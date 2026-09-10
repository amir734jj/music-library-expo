import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { CachedTrack, GlobalConfigRow } from "#entities";
import {
  EncryptedTrackStorageService,
  StationCaptureLeaseService,
  StreamTrackCaptureService,
  TrackCaptureQueue,
} from "#services";
import { TrackCaptureWorker } from "#workers";

@Module({
  imports: [TypeOrmModule.forFeature([CachedTrack, GlobalConfigRow])],
  providers: [
    EncryptedTrackStorageService,
    StationCaptureLeaseService,
    StreamTrackCaptureService,
    TrackCaptureQueue,
    TrackCaptureWorker,
  ],
  exports: [StationCaptureLeaseService, TrackCaptureQueue],
})
export class CaptureModule {}