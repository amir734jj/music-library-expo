import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { CachedTrack, GlobalConfigRow } from "#entities";
import {
  EncryptedTrackStorageService,
  StreamTrackCaptureService,
  TrackCaptureQueue,
} from "#services";
import { TrackCaptureWorker } from "#workers";

@Module({
  imports: [TypeOrmModule.forFeature([CachedTrack, GlobalConfigRow])],
  providers: [
    EncryptedTrackStorageService,
    StreamTrackCaptureService,
    TrackCaptureQueue,
    TrackCaptureWorker,
  ],
  exports: [TrackCaptureQueue],
})
export class CaptureModule {}