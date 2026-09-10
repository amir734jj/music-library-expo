import type { DirectoryImportSummary } from "@music-library/core";
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { isArray } from "lodash-es";
import { Repository } from "typeorm";

import { Station } from "#entities";

import { GlobalConfigService } from "./global-config.service.js";
import { isExcludedStationGenre } from "./station-genre-policy.js";

interface DirectoryStation {
  id?: number;
  ID?: number;
  name?: string;
  Name?: string;
  url?: string | null;
  StreamUrl?: string | null;
}

const UPSERT_BATCH_SIZE = 1_000;

@Injectable()
export class StationDirectoryImportService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StationDirectoryImportService.name);

  constructor(
    private readonly config: GlobalConfigService,
    @InjectRepository(Station) private readonly stations: Repository<Station>,
  ) {}

  onApplicationBootstrap(): void {
    void this.seedEmptyCatalog();
  }

  private async seedEmptyCatalog(): Promise<void> {
    await this.removeExcludedStations();
    if ((await this.stations.count()) > 0) return;
    try {
      const summary = await this.import();
      this.logger.log(
        `Initial station import complete: ${summary.created} created, ${summary.updated} updated, ${summary.rejected} rejected`,
      );
    } catch (error) {
      this.logger.error(
        `Initial station import failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async import(): Promise<DirectoryImportSummary> {
    const { directoryArtifactUrl } = await this.config.get();
    const url = new URL(directoryArtifactUrl);
    if (url.protocol !== "https:") {
      throw new Error("DIRECTORY_ARTIFACT_URL must be an absolute HTTPS URL");
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Directory download failed with ${response.status}`);
    const catalog = (await response.json()) as Record<string, DirectoryStation[]>;
    const existingDirectoryIds = new Set(
      (await this.stations.find({ select: { directoryId: true } }))
        .map((station) => station.directoryId),
    );
    const rows = new Map<
      string,
      Pick<Station, "directoryId" | "genre" | "name" | "streamUrl">
    >();
    let rejected = 0;

    for (const [genre, entries] of Object.entries(catalog)) {
      if (!isArray(entries)) continue;
      if (isExcludedStationGenre(genre)) {
        rejected += entries.length;
        continue;
      }
      for (const entry of entries) {
        const directoryId = String(entry.id ?? entry.ID ?? 0);
        const name = (entry.name ?? entry.Name)?.trim();
        const streamUrl = supportedUrl(entry.url ?? entry.StreamUrl);
        if (directoryId === "0" || !name || !streamUrl) {
          rejected++;
          continue;
        }
        rows.set(directoryId, { directoryId, genre, name, streamUrl });
      }
    }
    const stationRows = [...rows.values()];
    const created = stationRows.filter(
      (station) => !existingDirectoryIds.has(station.directoryId),
    ).length;
    const updated = stationRows.length - created;
    for (let index = 0; index < stationRows.length; index += UPSERT_BATCH_SIZE) {
      await this.stations.upsert(stationRows.slice(index, index + UPSERT_BATCH_SIZE), {
        conflictPaths: ["directoryId"],
        skipUpdateIfNoValuesChanged: true,
      });
    }
    return { created, updated, rejected };
  }

  private async removeExcludedStations(): Promise<void> {
    await this.stations
      .createQueryBuilder()
      .delete()
      .where("LOWER(genre) = :publicRadio", { publicRadio: "public radio" })
      .orWhere("LOWER(genre) LIKE :talk", { talk: "%talk%" })
      .orWhere("LOWER(genre) LIKE :document", { document: "%document%" })
      .execute();
  }
}

function supportedUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}