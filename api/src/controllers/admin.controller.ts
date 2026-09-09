import type {
  DirectoryImportSummary,
  GlobalConfigModel,
  ProbeStatusSummary,
  StationSummary,
  TrendingCacheStatusSummary,
  UpdateGlobalConfigRequest,
  UpdateStationProbeRequest,
  UpdateUserRequest,
  UserResponse,
} from "@music-library/core";
import { UserRole } from "@music-library/core";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";

import { Roles } from "#decorators";
import { User } from "#entities";
import { JwtAuthGuard, RolesGuard } from "#guards";
import { AdminService, StationDirectoryImportService } from "#services";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly directoryImport: StationDirectoryImportService,
  ) {}

  @Get("users")
  listUsers(): Promise<UserResponse[]> {
    return this.admin.listUsers();
  }

  @Put("users/:id")
  @HttpCode(204)
  updateUser(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateUserRequest,
    @Req() request: Request & { user: User },
  ): Promise<void> {
    if (body.role !== null && body.role !== UserRole.Admin && body.role !== UserRole.User) {
      throw new BadRequestException("Role must be Admin or User");
    }
    return this.admin.updateUser(request.user.id, id, body);
  }

  @Delete("users/:id")
  @HttpCode(204)
  deleteUser(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: Request & { user: User },
  ): Promise<void> {
    return this.admin.deleteUser(request.user.id, id);
  }

  @Get("config")
  getConfig(): Promise<GlobalConfigModel> {
    return this.admin.getConfig();
  }

  @Put("config")
  @HttpCode(204)
  async updateConfig(
    @Body() body: UpdateGlobalConfigRequest,
    @Req() request: Request & { user: User },
  ): Promise<void> {
    try {
      await this.admin.updateConfig(body, request.user.id);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Cache key")) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Get("cache/status")
  cacheStatus(): Promise<TrendingCacheStatusSummary> {
    return this.admin.cacheStatus();
  }

  @Delete("cache")
  @HttpCode(204)
  clearCache(): Promise<void> {
    return this.admin.clearCache();
  }

  @Post("stations/import")
  importStations(): Promise<DirectoryImportSummary> {
    return this.directoryImport.import();
  }

  @Get("stations")
  listStations(): Promise<StationSummary[]> {
    return this.admin.listStations();
  }

  @Put("stations/:id/probe")
  @HttpCode(204)
  updateStationProbe(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateStationProbeRequest,
  ): Promise<void> {
    return this.admin.updateStationProbe(id, body.isProbeEnabled === true);
  }

  @Put("stations/probe")
  updateAllStationProbes(@Body() body: UpdateStationProbeRequest): Promise<number> {
    return this.admin.updateAllStationProbes(body.isProbeEnabled === true);
  }

  @Get("probes/status")
  getProbeStatus(
    @Query("query") query?: string,
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "100",
  ): Promise<ProbeStatusSummary> {
    return this.admin.getProbeStatus(
      query,
      Number.parseInt(page, 10) || 1,
      Number.parseInt(pageSize, 10) || 100,
    );
  }
}