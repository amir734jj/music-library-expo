import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { LibraryController } from "#controllers";
import {
  ArtistSubscription,
  CachedTrack,
  GlobalConfigRow,
  PlayObservation,
  Station,
  UserAlert,
} from "#entities";
import {
  EncryptedTrackStorageService,
  LibraryService,
  LiveStreamTicketService,
} from "#services";
import { AuthModule } from "./auth.module.js";
import { CaptureModule } from "./capture.module.js";

@Module({
  imports: [
    AuthModule,
    CaptureModule,
    TypeOrmModule.forFeature([
      ArtistSubscription,
      CachedTrack,
      GlobalConfigRow,
      PlayObservation,
      Station,
      UserAlert,
    ]),
  ],
  controllers: [LibraryController],
  providers: [
    EncryptedTrackStorageService,
    LibraryService,
    LiveStreamTicketService,
  ],
})
export class LibraryModule {}