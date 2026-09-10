import type { Environment } from "#config";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { access, copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

export interface StoredTrackFile {
  filePath: string;
  plaintextLength: number;
  keyFingerprint: string;
}

@Injectable()
export class EncryptedTrackStorageService {
  private readonly directory: string;

  constructor(config: ConfigService<Environment, true>) {
    this.directory = config.get("trendingCacheDirectory", { infer: true });
  }

  async save(data: Uint8Array, key: Buffer, fileIdentifier: string): Promise<StoredTrackFile> {
    if (key.byteLength !== 32) throw new Error("Track cache key must contain 32 bytes");
    await mkdir(this.directory, { recursive: true });

    const destination = join(this.directory, createEncryptedTrackFileName(fileIdentifier, key));
    const temporary = `${destination}.tmp`;
    const initializationVector = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, initializationVector);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authenticationTag = cipher.getAuthTag();

    try {
      await writeFile(
        temporary,
        Buffer.concat([initializationVector, authenticationTag, encrypted]),
        { flag: "wx" },
      );
      await rename(temporary, destination);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }

    return {
      filePath: destination,
      plaintextLength: data.byteLength,
      keyFingerprint: createHash("sha256").update(key).digest("hex"),
    };
  }

  async read(filePath: string, key: Buffer): Promise<Buffer> {
    if (key.byteLength !== 32) throw new Error("Track cache key must contain 32 bytes");
    const payload = await readFile(filePath);
    if (payload.byteLength < 29) throw new Error("Encrypted track payload is invalid");

    const initializationVector = payload.subarray(0, 12);
    const authenticationTag = payload.subarray(12, 28);
    const encrypted = payload.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, initializationVector);
    decipher.setAuthTag(authenticationTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  async encryptLegacyFileName(
    filePath: string,
    fileIdentifier: string,
    key: Buffer,
  ): Promise<string> {
    if (/^enc-[A-Za-z0-9_-]+\.track$/u.test(basename(filePath))) return filePath;
    const destination = join(this.directory, createEncryptedTrackFileName(fileIdentifier, key));
    await copyFile(filePath, destination);
    return destination;
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(filePath: string): Promise<void> {
    await rm(filePath, { force: true });
  }

  async size(filePath: string): Promise<number> {
    try {
      return (await stat(filePath)).size;
    } catch {
      return 0;
    }
  }
}

export function createEncryptedTrackFileName(identifier: string, key: Buffer): string {
  if (key.byteLength !== 32) throw new Error("Track cache key must contain 32 bytes");
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, initializationVector);
  const encrypted = Buffer.concat([
    cipher.update(identifier, "utf8"),
    cipher.final(),
  ]);
  const encodedName = Buffer.concat([
    initializationVector,
    cipher.getAuthTag(),
    encrypted,
  ]).toString("base64url");
  return `enc-${encodedName}.track`;
}