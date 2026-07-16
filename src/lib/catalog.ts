/**
 * @fileoverview Defines the catalog application service module and makes its contracts, integration responsibilities, side effects, and fallback behavior explicit to maintainers.
 */
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { hydrateCacheDirectory, writeCachedFile } from "./b2-cache";
import { createCatalogAccumulator, finalizeCatalog, mergeRawEvents, type RawCatalogEarthquake } from "./catalog-domain";
import { createCatalogService, validDailyCatalogSnapshot, type CacheMetadata, type CatalogResult, type DailyCatalogSnapshot, type LoadedCatalog } from "./catalog-service";
import { createSismikHaritaClient } from "./sismik-client";

const bundleDirectory = path.join(process.cwd(), "data");
const temporaryUpdateDirectory = path.join(os.tmpdir(), "turkiye-earthquake-updates");
const temporaryDailyDirectory = path.join(os.tmpdir(), "turkiye-earthquake-daily-v2");
const updatePrefix = "catalog/updates";
const dailyPrefix = "catalog/daily-v2";

/**
 * Reads json for the catalog application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
async function readJson(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
  } catch {
    return null;
  }
}

/**
 * Performs the json files operation for the catalog application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
async function jsonFiles(directory: string): Promise<string[]> {
  try {
    return (await fs.readdir(directory)).filter((name) => name.endsWith(".json")).sort().map((name) => path.join(directory, name));
  } catch {
    return [];
  }
}

/**
 * Loads catalog for the catalog application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
async function loadCatalog(): Promise<LoadedCatalog> {
  await Promise.all([
    hydrateCacheDirectory(temporaryUpdateDirectory, updatePrefix).catch(() => undefined),
    hydrateCacheDirectory(temporaryDailyDirectory, dailyPrefix).catch(() => undefined),
  ]);
  const bundleFiles = await jsonFiles(bundleDirectory);
  if (!bundleFiles.length) throw new Error("No bundled Sismik Harita JSON files were found.");
  const updateFiles = await jsonFiles(temporaryUpdateDirectory);
  const dailyFiles = await jsonFiles(temporaryDailyDirectory);
  const updatePaths = new Set(updateFiles);
  const accumulator = createCatalogAccumulator();
  for (const file of [...bundleFiles, ...updateFiles]) {
    const shard = await readJson(file);
    if (Array.isArray(shard)) mergeRawEvents(accumulator, shard, updatePaths.has(file));
  }
  const snapshots: DailyCatalogSnapshot[] = [];
  for (const file of dailyFiles) {
    const snapshot = await readJson(file);
    if (validDailyCatalogSnapshot(snapshot)) snapshots.push(snapshot);
  }
  snapshots.sort((left, right) => Date.parse(left.metadata.dataUpdatedAtUtc) - Date.parse(right.metadata.dataUpdatedAtUtc));
  for (const snapshot of snapshots) mergeRawEvents(accumulator, snapshot.events, true);
  const data = finalizeCatalog(accumulator);
  if (!data.events.length) throw new Error("The bundled Sismik Harita catalog did not contain valid events.");
  return { accumulator, data, metadata: snapshots.at(-1)?.metadata ?? null };
}

/**
 * Persists one immutable daily catalogue snapshot whose metadata and changed provider events become visible as a single object.
 *
 * Legacy `catalog/updates` objects remain readable, while the versioned prefix lets deployments migrate without deleting or rewriting an existing bucket.
 */
async function persistDailySnapshot(events: RawCatalogEarthquake[], metadata: CacheMetadata): Promise<void> {
  const name = `sismik-daily-v2-${metadata.checkedDayTrt}-${randomUUID()}.json`;
  const localPath = path.join(temporaryDailyDirectory, name);
  const storedRemotely = await writeCachedFile(localPath, `${dailyPrefix}/${name}`, JSON.stringify({ metadata, events } satisfies DailyCatalogSnapshot));
  if (process.env.VERCEL && !storedRemotely) {
    await fs.unlink(localPath).catch(() => undefined);
    throw new Error("The atomic catalogue snapshot could not be persisted to B2.");
  }
}

const provider = createSismikHaritaClient({ apiKey: process.env.SISMIC_HARITA_API_KEY });
const service = createCatalogService({ loadCatalog, fetchLatestEvents: provider.fetchLatestEvents, persistDailySnapshot });

export type { CacheMetadata, CatalogResult } from "./catalog-service";

/**
 * Performs the get catalog operation for the catalog application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export async function getCatalog(options?: { allowStale?: boolean }): Promise<CatalogResult> {
  return service.getCatalog(options);
}
