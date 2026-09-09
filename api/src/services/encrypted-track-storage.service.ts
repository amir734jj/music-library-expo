import type { Environment } from "#config";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { access, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

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

  async save(data: Uint8Array, key: Buffer): Promise<StoredTrackFile> {
    if (key.byteLength !== 32) throw new Error("Track cache key must contain 32 bytes");
    await mkdir(this.directory, { recursive: true });

    const id = randomUUID();
    const destination = join(this.directory, `${id}.track`);
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