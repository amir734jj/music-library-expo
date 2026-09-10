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
const streamTitlePattern = /(?:^|;)\s*StreamTitle='((?:\\.|[^'])*)'/iu;

export function normalizeStreamMetadata(
  rawMetadata: string,
  artist?: string,
  title?: string,
): StreamMetadata {
  let raw = rawMetadata.trim();
  const streamTitle = streamTitlePattern.exec(raw);
  const capturedTitle = streamTitle?.[1];
  if (capturedTitle !== undefined) {
    raw = capturedTitle.replace(/\\'/gu, "'").replace(/\\\\/gu, "\\").trim();
  }

  const normalizedArtist = artist?.trim() || null;
  const normalizedTitle = title?.trim() || null;
  if (containsIcyField(normalizedArtist)
    || containsIcyField(normalizedTitle)
    || !containsLetterOrDigit(normalizedArtist, normalizedTitle)) {
    return { artist: null, raw, title: null };
  }
  return { artist: normalizedArtist, raw, title: normalizedTitle };
}

function containsIcyField(value: string | null): boolean {
  return value !== null && /Stream(?:Title|Url|Artwork)=/iu.test(value);
}

function containsLetterOrDigit(...values: (string | null)[]): boolean {
  return values.some((value) => value !== null && /[\p{L}\p{N}]/u.test(value));
}

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
          resolve(normalizeStreamMetadata(metadata.raw, metadata.artist, metadata.title)),
        );
      });
      ripper.on("failed", ({ error }) => finish(() => reject(error)));
      void ripper.start().catch((error: unknown) =>
        finish(() => reject(error instanceof Error ? error : new Error(String(error)))),
      );
    });
  }
}