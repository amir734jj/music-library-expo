import { Injectable } from "@nestjs/common";

export interface StreamMetadata {
  artist: string | null;
  title: string | null;
  raw: string;
}

interface StreamRipperInstance {
  on(
    event: "metadata",
    handler: (event: { metadata: { artist?: string; title?: string; raw: string } }) => unknown,
  ): this;
  on(
    event: "failed",
    handler: (event: { error: Error; message: string }) => unknown,
  ): this;
  start(): Promise<void>;
  stop(): void;
}

interface StreamRipperModule {
  StreamRipper: new (options: {
    url: string;
    metadataOnly: boolean;
    maxBufferSize: number;
    requestInit: { headers: Record<string, string> };
  }) => StreamRipperInstance;
}

const packageName = "@amir734jj/stream-ripper";
let modulePromise: Promise<StreamRipperModule> | undefined;

@Injectable()
export class StreamMetadataProbeService {
  async probe(url: string, timeoutMs: number): Promise<StreamMetadata> {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error("Station stream URL must use HTTP or HTTPS");
    }

    modulePromise ??= import(packageName) as Promise<StreamRipperModule>;
    const { StreamRipper } = await modulePromise;
    const ripper = new StreamRipper({
      url,
      metadataOnly: true,
      maxBufferSize: 1_000_000,
      requestInit: { headers: { "user-agent": "MusicLibrary/1.0" } },
    });

    return new Promise<StreamMetadata>((resolve, reject) => {
      let settled = false;
      const finish = (action: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        ripper.stop();
        action();
      };
      const timeout = setTimeout(
        () => finish(() => reject(new Error("Station metadata probe timed out"))),
        timeoutMs,
      );

      ripper.on("metadata", ({ metadata }) => {
        finish(() =>
          resolve({
            artist: metadata.artist?.trim() || null,
            title: metadata.title?.trim() || null,
            raw: metadata.raw.trim(),
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