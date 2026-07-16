/**
 * @fileoverview Defines the catalog service application service module and makes its contracts, integration responsibilities, side effects, and fallback behavior explicit to maintainers.
 */
import { changedRawEvents, finalizeCatalog, mergeRawEvents, type CatalogAccumulator, type CatalogData, type RawCatalogEarthquake } from "./catalog-domain";
import { parseCatalogUtc, turkiyeDay } from "./time";
import type { CatalogEarthquake, RecentEarthquake, RecentThreshold } from "./types";

export interface CacheMetadata {
  checkedDayTrt: string;
  dataUpdatedAtUtc: string;
  providerStatus: "updated" | "current" | "degraded";
  providerMessage: string;
}

export interface CatalogResult {
  events: CatalogEarthquake[];
  recentEarthquakes: Record<RecentThreshold, RecentEarthquake[]>;
  metadata: CacheMetadata;
  source: "memory" | "tmp" | "bundle";
}

export interface LoadedCatalog {
  accumulator: CatalogAccumulator;
  data: CatalogData;
  metadata: CacheMetadata | null;
}

export interface CatalogServiceDependencies {
  loadCatalog: () => Promise<LoadedCatalog>;
  fetchLatestEvents: (startTimestamp: number) => Promise<RawCatalogEarthquake[]>;
  persistDailySnapshot: (events: RawCatalogEarthquake[], metadata: CacheMetadata) => Promise<void>;
  now?: () => Date;
}

export interface DailyCatalogSnapshot {
  metadata: CacheMetadata;
  events: RawCatalogEarthquake[];
}

const overlapSeconds = 48 * 60 * 60;

/**
 * Validates cache metadata for the catalog service application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function validCacheMetadata(value: unknown): value is CacheMetadata {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const metadata = value as Record<string, unknown>;
  return typeof metadata.checkedDayTrt === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(metadata.checkedDayTrt)
    && typeof metadata.dataUpdatedAtUtc === "string"
    && ["updated", "current", "degraded"].includes(String(metadata.providerStatus))
    && typeof metadata.providerMessage === "string";
}

/**
 * Validates the atomic daily catalogue object that binds refresh metadata to the exact provider records made durable by that refresh.
 *
 * Keeping metadata and events in one runtime-validated object prevents another serverless instance from observing a completed-day marker without its corresponding update shard.
 */
export function validDailyCatalogSnapshot(value: unknown): value is DailyCatalogSnapshot {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const snapshot = value as Record<string, unknown>;
  return validCacheMetadata(snapshot.metadata) && Array.isArray(snapshot.events);
}

/**
 * Creates catalog service for the catalog service application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function createCatalogService(dependencies: CatalogServiceDependencies) {
  const now = dependencies.now ?? (() => new Date());
  let memoryCatalog: CatalogResult | null = null;
  let refreshPromise: Promise<CatalogResult> | null = null;

  /**
   * Performs the refresh catalog operation for the catalog service application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  async function refreshCatalog(): Promise<CatalogResult> {
    const loaded = await dependencies.loadCatalog();
    const previousMetadata = validCacheMetadata(loaded.metadata) ? loaded.metadata : null;
    const currentDate = now();
    const dayTrt = turkiyeDay(currentDate);
    if (previousMetadata?.checkedDayTrt === dayTrt) {
      return { events: loaded.data.events, recentEarthquakes: loaded.data.recentEarthquakes, metadata: previousMetadata, source: loaded.data.hasUpdates ? "tmp" : "bundle" };
    }
    const newest = parseCatalogUtc(loaded.data.events[0].occurredAt);
    try {
      const incoming = await dependencies.fetchLatestEvents(newest - overlapSeconds);
      const changed = changedRawEvents(loaded.accumulator, incoming);
      if (changed.length) mergeRawEvents(loaded.accumulator, changed, true);
      const merged = changed.length ? finalizeCatalog(loaded.accumulator) : loaded.data;
      const added = merged.events.length - loaded.data.events.length;
      const metadata: CacheMetadata = {
        checkedDayTrt: dayTrt,
        dataUpdatedAtUtc: currentDate.toISOString(),
        providerStatus: changed.length ? "updated" : "current",
        providerMessage: changed.length
          ? `Stored ${added.toLocaleString("en-US")} new and ${(changed.length - added).toLocaleString("en-US")} revised Sismik Harita events.`
          : "Sismik Harita was checked; no new or revised events were found.",
      };
      await dependencies.persistDailySnapshot(changed, metadata);
      return { events: merged.events, recentEarthquakes: merged.recentEarthquakes, metadata, source: merged.hasUpdates ? "tmp" : "bundle" };
    } catch (error) {
      const metadata: CacheMetadata = {
        checkedDayTrt: previousMetadata?.checkedDayTrt ?? "1970-01-01",
        dataUpdatedAtUtc: previousMetadata?.dataUpdatedAtUtc ?? currentDate.toISOString(),
        providerStatus: "degraded",
        providerMessage: `Sismik Harita update failed; serving the latest available catalog. ${error instanceof Error ? error.message : "Unknown error"}`,
      };
      return { events: loaded.data.events, recentEarthquakes: loaded.data.recentEarthquakes, metadata, source: loaded.data.hasUpdates ? "tmp" : "bundle" };
    }
  }

  /**
   * Performs the get catalog operation for the catalog service application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  async function getCatalog(options?: { allowStale?: boolean }): Promise<CatalogResult> {
    if (options?.allowStale && memoryCatalog) return { ...memoryCatalog, source: "memory" };
    if (memoryCatalog && memoryCatalog.metadata.providerStatus !== "degraded" && memoryCatalog.metadata.checkedDayTrt === turkiyeDay(now())) return { ...memoryCatalog, source: "memory" };
    if (!refreshPromise) refreshPromise = refreshCatalog().finally(() => { refreshPromise = null; });
    memoryCatalog = await refreshPromise;
    return memoryCatalog;
  }

  return { getCatalog };
}
