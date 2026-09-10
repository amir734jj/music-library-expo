import { Injectable } from "@nestjs/common";
import { parseBuffer } from "music-metadata";

import { normalizeStreamMetadata } from "./stream-metadata-probe.service.js";

export interface CapturedSong {
  artist: string;
  bitrateKbps: number | null;
  contentType: string;
  durationMs: number;
  title: string | null;
  data: Uint8Array;
}

interface StreamRipperInstance {
  on(
    event: "song",
    handler: (event: {
      songInfo: {
        metadata: { artist?: string; title?: string; raw: string };
        data: Uint8Array;
      };
    }) => unknown,
  ): this;
  on(event: "failed", handler: (event: { error: Error }) => unknown): this;
  start(): Promise<void>;
  stop(): void;
}

interface StreamRipperModule {
  StreamRipper: new (options: {
    url: string;
    maxBufferSize: number;
    requestInit: { headers: Record<string, string> };
  }) => StreamRipperInstance;
}

const packageName = "@amir734jj/stream-ripper";
let modulePromise: Promise<StreamRipperModule> | undefined;

@Injectable()
export class StreamTrackCaptureService {
  async capture(url: string, timeoutMs: number): Promise<CapturedSong> {
    modulePromise ??= import(packageName) as Promise<StreamRipperModule>;
    const { StreamRipper } = await modulePromise;
    const ripper = new StreamRipper({
      url,
      maxBufferSize: 100 * 1_000_000,
      requestInit: { headers: { "user-agent": "MusicLibrary/1.0" } },
    });

    return new Promise<CapturedSong>((resolve, reject) => {
      let settled = false;
      const finish = (action: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        ripper.stop();
        action();
      };
      const timeout = setTimeout(
        () => finish(() => reject(new Error("Track capture timed out"))),
        timeoutMs,
      );

      let analyzing = false;
      ripper.on("song", ({ songInfo }) => {
        const metadata = normalizeStreamMetadata(
          songInfo.metadata.raw,
          songInfo.metadata.artist,
          songInfo.metadata.title,
        );
        const artist = metadata.artist;
        if (!artist || songInfo.data.byteLength === 0 || analyzing) return;
        analyzing = true;
        void analyzeAudio(songInfo.data).then((audio) => finish(() => resolve({
          artist,
          bitrateKbps: audio.bitrateKbps,
          contentType: audio.contentType,
          durationMs: audio.durationMs,
          title: metadata.title,
          data: songInfo.data,
        }))).catch((error: unknown) => finish(() => reject(
          error instanceof Error ? error : new Error(String(error)),
        )));
      });
      ripper.on("failed", ({ error }) => finish(() => reject(error)));
      void ripper.start().catch((error: unknown) =>
        finish(() => reject(error instanceof Error ? error : new Error(String(error)))),
      );
    });
  }
}

async function analyzeAudio(data: Uint8Array): Promise<{
  bitrateKbps: number | null;
  contentType: string;
  durationMs: number;
}> {
  const { format } = await parseBuffer(data, undefined, { duration: true, skipCovers: true });
  const durationMs = Math.round((format.duration ?? 0) * 1_000);
  if (durationMs <= 0) throw new Error("Captured track has no valid duration");
  const container = format.container?.toLowerCase() ?? "";
  let contentType = "audio/mpeg";
  if (container.includes("flac")) {
    contentType = "audio/flac";
  } else if (container.includes("ogg")) {
    contentType = "audio/ogg";
  } else if (container.includes("adts") || container.includes("aac")) {
    contentType = "audio/aac";
  }
  return {
    bitrateKbps: format.bitrate ? Math.round(format.bitrate / 1_000) : null,
    contentType,
    durationMs,
  };
}