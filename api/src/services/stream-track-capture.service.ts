import { Injectable } from "@nestjs/common";

export interface CapturedSong {
  artist: string;
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

      ripper.on("song", ({ songInfo }) => {
        const artist = songInfo.metadata.artist?.trim();
        if (!artist || songInfo.data.byteLength === 0) return;
        finish(() =>
          resolve({
            artist,
            title: songInfo.metadata.title?.trim() || null,
            data: songInfo.data,
          }),
        );
      });
      ripper.on("failed", ({ error }) => finish(() => reject(error)));
      void ripper.start().catch((error: unknown) =>
        finish(() => reject(error instanceof Error ? error : new Error(String(error)))),
      );
    });
  }
}