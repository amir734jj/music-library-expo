import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DataSource, In, Repository, SelectQueryBuilder } from "typeorm";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Environment } from "../config/environment.js";
import * as entities from "../entities/index.js";
import { EncryptedTrackStorageService } from "../services/encrypted-track-storage.service.js";
import { HistoryCleanupWorker } from "./history-cleanup.worker.js";

class TestDataSource extends DataSource {
  async prepareMetadata(): Promise<void> {
    await this.buildMetadatas();
  }
}

async function setup() {
  const dataSource = new TestDataSource({ type: "postgres", entities: Object.values(entities) });
  await dataSource.prepareMetadata();
  Object.defineProperty(dataSource, "isInitialized", { value: true, configurable: true });
  const manager = dataSource.createEntityManager();
  const select = vi.spyOn(SelectQueryBuilder.prototype, "getMany").mockResolvedValue([]);
  const remove = vi.spyOn(Repository.prototype, "delete").mockResolvedValue({ raw: [], affected: 0 });
  const transaction = vi.spyOn(dataSource, "transaction").mockImplementation(async (...args) => {
    const work = args[args.length - 1];
    if (typeof work !== "function") throw new Error("Missing transaction callback");
    return work(manager);
  });
  const storage = new EncryptedTrackStorageService(
    new ConfigService<Environment, true>({ trendingCacheDirectory: "unused" }),
  );
  const deleteFile = vi.spyOn(storage, "delete").mockResolvedValue(undefined);
  const logError = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
  vi.spyOn(Logger.prototype, "log").mockImplementation(() => {});
  return {
    worker: new HistoryCleanupWorker(dataSource, storage),
    dataSource,
    select,
    remove,
    transaction,
    deleteFile,
    logError,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("HistoryCleanupWorker", () => {
  it("uses a seven-day cutoff, exact row-cap boundaries, and bounded deletes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
    const { worker, select } = await setup();
    await worker.cleanup();
    const cutoff = new Date("2026-10-26T12:00:00Z");
    const [alertsSql, alertsParameters] = select.mock.contexts[0]!.getQueryAndParameters();
    const [observationsSql, observationsParameters] = select.mock.contexts[1]!.getQueryAndParameters();
    expect(alertsSql).toContain('FROM "user_alerts" "history"');
    expect(alertsSql).toContain('("history"."created_at", "history"."id") < (SELECT');
    expect(alertsSql).toContain('ORDER BY "boundary"."created_at" DESC, "boundary"."id" DESC');
    expect(alertsSql).toContain("LIMIT 1 OFFSET 99999");
    expect(alertsSql).toMatch(/LIMIT 1000 FOR UPDATE OF "?history"? SKIP LOCKED/u);
    expect(alertsParameters).toEqual([cutoff]);
    expect(observationsSql).toContain('FROM "play_observations" "history"');
    expect(observationsSql).toContain('("history"."observed_at", "history"."id") < (SELECT');
    expect(observationsSql).toContain("LIMIT 1 OFFSET 999999");
    expect(observationsParameters).toEqual([cutoff]);
  });

  it("deletes audio files before cascading observation deletion", async () => {
    const { worker, select, remove, deleteFile } = await setup();
    select
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "observation-id" }])
      .mockResolvedValueOnce([{ id: "track-id", filePath: "encrypted.track" }]);
    await worker.cleanup();
    expect(deleteFile).toHaveBeenCalledWith("encrypted.track");
    expect(remove).toHaveBeenCalledWith({ id: In(["observation-id"]) });
    expect(remove.mock.contexts[0]!.target).toBe(entities.PlayObservation);
    expect(deleteFile.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]!);
    expect(select.mock.contexts[2]!.getQuery()).toContain("FOR UPDATE");
  });

  it("keeps database records on file deletion failure and retries next run", async () => {
    const { worker, select, remove, deleteFile, logError } = await setup();
    select
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "observation-id" }])
      .mockResolvedValueOnce([{ id: "track-id", filePath: "encrypted.track" }]);
    deleteFile.mockRejectedValueOnce(new Error("Permission denied"));
    await worker.cleanup();
    expect(select).toHaveBeenCalledTimes(3);
    expect(remove).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(expect.stringContaining("Permission denied"));
    await worker.cleanup();
    expect(select).toHaveBeenCalledTimes(5);
  });

  it("limits a backlog to twenty batches per table per run", async () => {
    const { worker, select, transaction } = await setup();
    const batch = Array.from({ length: 1_000 }, (_, index) => ({ id: String(index) }));
    for (let index = 0; index < 20; index++) {
      select.mockResolvedValueOnce(batch);
    }
    await worker.cleanup();
    expect(transaction).toHaveBeenCalledTimes(21);
  });

  it("skips cleanup while the database is disconnected", async () => {
    const { worker, dataSource, transaction } = await setup();
    Object.defineProperty(dataSource, "isInitialized", { value: false });
    await worker.cleanup();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("does not overlap cleanup runs", async () => {
    const { worker, transaction } = await setup();
    let unblock: () => void = () => {};
    const blocked = new Promise<void>((resolve) => { unblock = resolve; });
    transaction.mockImplementationOnce(async () => {
      await blocked;
      return 0;
    });
    const first = worker.cleanup();
    await worker.cleanup();
    expect(transaction).toHaveBeenCalledTimes(1);
    unblock();
    await first;
    expect(transaction).toHaveBeenCalledTimes(2);
  });
});
