/**
 * @fileoverview Defines the catalog application service module and makes its contracts, integration responsibilities, side effects, and fallback behavior explicit to maintainers.
 */
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureCachedFile, hydrateCacheDirectory, writeCachedFile } from "./b2-cache";
import { createCatalogAccumulator, finalizeCatalog, mergeRawEvents, type RawCatalogEarthquake } from "./catalog-domain";
import { createCatalogService, type CacheMetadata, type CatalogResult, type LoadedCatalog } from "./catalog-service";
import { createSismikHaritaClient } from "./sismik-client";

const bundleDirectory = path.join(process.cwd(), "data");
const temporaryUpdateDirectory = path.join(os.tmpdir(), "turkiye-earthquake-updates");
const temporaryMetadataPath = path.join(os.tmpdir(), "turkiye-earthquake-meta.json");
const updatePrefix = "catalog/updates";
const metadataKey = "catalog/meta.json";

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
  await hydrateCacheDirectory(temporaryUpdateDirectory, updatePrefix).catch(() => undefined);
  const bundleFiles = await jsonFiles(bundleDirectory);
  if (!bundleFiles.length) throw new Error("No bundled Sismik Harita JSON files were found.");
  const updateFiles = await jsonFiles(temporaryUpdateDirectory);
  const updatePaths = new Set(updateFiles);
  const accumulator = createCatalogAccumulator();
  for (const file of [...bundleFiles, ...updateFiles]) {
    const shard = await readJson(file);
    if (Array.isArray(shard)) mergeRawEvents(accumulator, shard, updatePaths.has(file));
  }
  const data = finalizeCatalog(accumulator);
  if (!data.events.length) throw new Error("The bundled Sismik Harita catalog did not contain valid events.");
  return { accumulator, data };
}

/**
 * Reads metadata for the catalog application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
async function readMetadata(): Promise<CacheMetadata | null> {
  await ensureCachedFile(temporaryMetadataPath, metadataKey);
  return await readJson(temporaryMetadataPath) as CacheMetadata | null;
}

/**
 * Performs the append update operation for the catalog application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
async function appendUpdate(events: RawCatalogEarthquake[], dayTrt: string): Promise<void> {
  const name = `sismik-daily-${dayTrt}-${randomUUID()}.json`;
  await writeCachedFile(path.join(temporaryUpdateDirectory, name), `${updatePrefix}/${name}`, JSON.stringify(events));
}

/**
 * Writes metadata for the catalog application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
async function writeMetadata(metadata: CacheMetadata): Promise<void> {
  const body = JSON.stringify(metadata);
  await writeCachedFile(temporaryMetadataPath, metadataKey, body).catch(async () => {
    await fs.writeFile(temporaryMetadataPath, body);
    return false;
  });
}

const provider = createSismikHaritaClient({ apiKey: process.env.SISMIC_HARITA_API_KEY });
const service = createCatalogService({ loadCatalog, readMetadata, fetchLatestEvents: provider.fetchLatestEvents, appendUpdate, writeMetadata });

export type { CacheMetadata, CatalogResult } from "./catalog-service";

/**
 * Performs the get catalog operation for the catalog application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export async function getCatalog(options?: { allowStale?: boolean }): Promise<CatalogResult> {
  return service.getCatalog(options);
}
