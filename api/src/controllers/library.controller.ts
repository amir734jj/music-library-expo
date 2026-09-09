import type {
  ArtistSubscriptionSummary,
  CreateSubscriptionRequest,
  LiveStreamTicket,
  NowPlayingSummary,
  StationCachedTrackSummary,
  StationSummary,
  TrendingSummary,
  UserAlertSummary,
} from "@music-library/core";
import {
  BadGatewayException,
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Head,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import { GlobalConfigRow, User } from "#entities";
import { JwtAuthGuard } from "#guards";
import {
  EncryptedTrackStorageService,
  LibraryService,
  LiveStreamTicketService,
} from "#services";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

@Controller()
export class LibraryController {
  constructor(
    private readonly library: LibraryService,
    private readonly tickets: LiveStreamTicketService,
    private readonly storage: EncryptedTrackStorageService,
    @InjectRepository(GlobalConfigRow)
    private readonly config: Repository<GlobalConfigRow>,
  ) {}

  @Get("stations")
  listStations(@Query("query") query?: string): Promise<StationSummary[]> {
    return this.library.listStations(query);
  }

  @Get("now-playing")
  listNowPlaying(@Query("query") query?: string): Promise<NowPlayingSummary[]> {
    return this.library.listNowPlaying(query);
  }

  @Get("now-playing/:stationId")
  async getNowPlaying(
    @Param("stationId", ParseUUIDPipe) stationId: string,
  ): Promise<NowPlayingSummary> {
    const nowPlaying = await this.library.getNowPlaying(stationId);
    if (!nowPlaying) throw new NotFoundException();
    return nowPlaying;
  }

  @Post("now-playing/:stationId/stream-ticket")
  async createStreamTicket(
    @Param("stationId", ParseUUIDPipe) stationId: string,
  ): Promise<LiveStreamTicket> {
    const station = await this.library.getStation(stationId);
    if (!station) throw new NotFoundException();
    validateStreamUrl(station.streamUrl);
    return { path: `/api/live-stream/${this.tickets.issue(station.id)}` };
  }

  @Get("live-stream/:ticket")
  proxyLiveStreamGet(
    @Param("ticket") ticket: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    return this.proxyLiveStream(ticket, request, response, false);
  }

  @Head("live-stream/:ticket")
  proxyLiveStreamHead(
    @Param("ticket") ticket: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    return this.proxyLiveStream(ticket, request, response, true);
  }

  @Get("trending")
  listTrending(@Query("query") query?: string): Promise<TrendingSummary[]> {
    return this.library.listTrending(query);
  }

  @Get("stations/:stationId/cached-tracks")
  listStationCachedTracks(
    @Param("stationId", ParseUUIDPipe) stationId: string,
  ): Promise<StationCachedTrackSummary[]> {
    return this.library.listStationCachedTracks(stationId);
  }

  @Post("stations/:stationId/capture")
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async enableStationCapture(
    @Param("stationId", ParseUUIDPipe) stationId: string,
  ): Promise<void> {
    if (!(await this.library.enableCapture(stationId))) throw new NotFoundException();
  }

  @Get("trending/:cachedTrackId/download")
  async downloadTrendingTrack(
    @Param("cachedTrackId", ParseUUIDPipe) cachedTrackId: string,
    @Res() response: Response,
  ): Promise<void> {
    const track = await this.library.getCachedTrack(cachedTrackId);
    if (!track || track.expiresAt <= new Date()) throw new NotFoundException();
    const keyRow = await this.config.findOneBy({ key: "TRENDING_CACHE_ENCRYPTION_KEY" });
    const key = decodeKey(keyRow?.value);
    if (!key || fingerprint(key) !== track.keyFingerprint) throw new NotFoundException();
    try {
      const content = await this.storage.read(track.filePath, key);
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Content-Type", track.contentType);
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="${downloadFilename(track.artist, track.title)}"`,
      );
      response.send(content);
    } catch {
      throw new NotFoundException();
    }
  }

  @Get("subscriptions")
  @UseGuards(JwtAuthGuard)
  listSubscriptions(
    @Req() request: Request & { user: User },
  ): Promise<ArtistSubscriptionSummary[]> {
    return this.library.listSubscriptions(request.user.id);
  }

  @Post("subscriptions")
  @UseGuards(JwtAuthGuard)
  async createSubscription(
    @Body() requestBody: CreateSubscriptionRequest,
    @Req() request: Request & { user: User },
    @Res({ passthrough: true }) response: Response,
  ): Promise<ArtistSubscriptionSummary> {
    const artistName = requestBody.artistName?.trim();
    if (!artistName || artistName.length < 2 || artistName.length > 200) {
      throw new BadRequestException("Artist name must be between 2 and 200 characters");
    }
    const normalizedArtistName = artistName.toLocaleUpperCase("en-US");
    if (await this.library.subscriptionExists(request.user.id, normalizedArtistName)) {
      throw new ConflictException();
    }
    const subscription = await this.library.createSubscription(request.user.id, {
      artistName,
      captureEnabled: requestBody.captureEnabled === true,
    });
    response.status(201);
    response.location(`/api/subscriptions/${subscription.id}`);
    return subscription;
  }

  @Delete("subscriptions/:id")
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async deleteSubscription(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() request: Request & { user: User },
  ): Promise<void> {
    if (!(await this.library.deleteSubscription(request.user.id, id))) {
      throw new NotFoundException();
    }
  }

  @Get("alerts")
  @UseGuards(JwtAuthGuard)
  listAlerts(
    @Req() request: Request & { user: User },
  ): Promise<UserAlertSummary[]> {
    return this.library.listAlerts(request.user.id);
  }

  private async proxyLiveStream(
    ticket: string,
    request: Request,
    response: Response,
    headOnly: boolean,
  ): Promise<void> {
    const stationId = this.tickets.resolve(ticket);
    if (!stationId) throw new NotFoundException();
    const station = await this.library.getStation(stationId);
    if (!station) throw new NotFoundException();
    validateStreamUrl(station.streamUrl);

    try {
      const abortController = new AbortController();
      request.once("close", () => abortController.abort());
      const upstream = await fetch(station.streamUrl, {
        headers: { "icy-metadata": "0", "user-agent": "MusicLibrary/1.0" },
        signal: abortController.signal,
      });
      if (!upstream.ok || !upstream.body) throw new BadGatewayException();
      response.status(200);
      response.setHeader("Content-Type", upstream.headers.get("content-type") ?? "audio/mpeg");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Accel-Buffering", "no");
      if (headOnly) {
        await upstream.body.cancel();
        response.end();
        return;
      }
      await new Promise<void>((resolve, reject) => {
        Readable.fromWeb(upstream.body as never)
          .once("error", reject)
          .pipe(response)
          .once("finish", resolve)
          .once("error", reject);
      });
    } catch (error) {
      if (request.destroyed) return;
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException();
    }
  }
}

function validateStreamUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BadRequestException("The station does not have a valid stream URL");
  }
  return url;
}

function decodeKey(value?: string): Buffer | null {
  if (!value) return null;
  const key = Buffer.from(value, "base64");
  return key.byteLength === 32 ? key : null;
}

function fingerprint(key: Buffer): string {
  return createHash("sha256").update(key).digest("hex");
}

function downloadFilename(artist: string, title: string | null): string {
  const value = `${artist}${title ? ` - ${title}` : ""}`
    .replace(/[^a-z0-9 ._-]/giu, "_")
    .trim()
    .slice(0, 180);
  return `${value || "track"}.mp3`;
}