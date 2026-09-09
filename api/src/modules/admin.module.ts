import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AdminController } from "#controllers";
import { CachedTrack, GlobalConfigRow, Station, User } from "#entities";
import {
  AdminService,
  EncryptedTrackStorageService,
  GlobalConfigService,
  StationDirectoryImportService,
} from "#services";

import { AuthModule } from "./auth.module.js";
import { ProbingModule } from "./probing.module.js";

@Module({
  imports: [
    AuthModule,
    ProbingModule,
    TypeOrmModule.forFeature([CachedTrack, GlobalConfigRow, Station, User]),
  ],
  controllers: [AdminController],
  providers: [
    AdminService,
    EncryptedTrackStorageService,
    GlobalConfigService,
    StationDirectoryImportService,
  ],
})
export class AdminModule {}