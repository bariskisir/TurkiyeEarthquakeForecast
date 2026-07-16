/**
 * @fileoverview Defines the catalog service.test Vitest specification, documenting expected success, failure, edge-case, and regression behavior without modifying immutable catalogue data.
 */
import { describe, expect, test, vi } from "vitest";
import { createCatalogAccumulator, finalizeCatalog, mergeRawEvents, type RawCatalogEarthquake } from "@/lib/catalog-domain";
import { createCatalogService, validDailyCatalogSnapshot, type CacheMetadata, type CatalogServiceDependencies } from "@/lib/catalog-service";

const now = new Date("2026-07-14T10:30:00.000Z");

/**
 * Builds a minimal deterministic raw earthquake record for the surrounding test scenario.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function raw(id: number, magnitude = 4): RawCatalogEarthquake {
  return { id, event_id: `event-${id}`, occurred_at: `2026-07-${String(10 + id).padStart(2, "0")} 10:00:00`, latitude: 39, longitude: 35, magnitude, source: "afad", sources: [{ magnitude }] };
}

/**
 * Performs the dependencies operation for the catalog service.test Vitest specification, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function dependencies(incoming: RawCatalogEarthquake[] = [], metadata: CacheMetadata | null = null): CatalogServiceDependencies {
  const accumulator = createCatalogAccumulator();
  mergeRawEvents(accumulator, [raw(1)], false);
  return {
    loadCatalog: vi.fn(async () => ({ accumulator, data: finalizeCatalog(accumulator), metadata })),
    fetchLatestEvents: vi.fn(async () => incoming),
    persistDailySnapshot: vi.fn(async () => undefined),
    /**
     * Performs the now operation for the catalog service.test Vitest specification, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
     *
     * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
     */
    now: () => now,
  };
}

describe("catalog service", () => {
  test("reuses metadata already checked on the current Türkiye day", async () => {
    const metadata: CacheMetadata = { checkedDayTrt: "2026-07-14", dataUpdatedAtUtc: now.toISOString(), providerStatus: "current", providerMessage: "current" };
    const deps = dependencies([], metadata);
    const result = await createCatalogService(deps).getCatalog();
    expect(result.metadata).toEqual(metadata);
    expect(deps.fetchLatestEvents).not.toHaveBeenCalled();
  });

  test("merges new and revised events without loading the full catalog again", async () => {
    const deps = dependencies([raw(1, 5.2), raw(2, 4.8)]);
    const service = createCatalogService(deps);
    const result = await service.getCatalog();
    expect(result.events.map((event) => event.magnitude)).toEqual([4.8, 5.2]);
    expect(result.metadata.providerStatus).toBe("updated");
    expect(deps.loadCatalog).toHaveBeenCalledTimes(1);
    expect(deps.persistDailySnapshot).toHaveBeenCalledWith(
      [raw(1, 5.2), raw(2, 4.8)],
      expect.objectContaining({ checkedDayTrt: "2026-07-14", providerStatus: "updated" }),
    );
    await service.getCatalog();
    expect(deps.loadCatalog).toHaveBeenCalledTimes(1);
  });

  test("serves the loaded catalog when the provider fails", async () => {
    const deps = dependencies();
    deps.fetchLatestEvents = vi.fn(async () => { throw new Error("offline"); });
    const result = await createCatalogService(deps).getCatalog();
    expect(result.events).toHaveLength(1);
    expect(result.metadata.providerStatus).toBe("degraded");
    expect(result.metadata.providerMessage).toContain("offline");
  });

  test("retries after atomic persistence fails instead of marking the day complete", async () => {
    const deps = dependencies([raw(2)]);
    deps.persistDailySnapshot = vi.fn(async () => { throw new Error("B2 unavailable"); });
    const service = createCatalogService(deps);
    const first = await service.getCatalog();
    const second = await service.getCatalog();
    expect(first.metadata.providerStatus).toBe("degraded");
    expect(second.metadata.providerStatus).toBe("degraded");
    expect(deps.fetchLatestEvents).toHaveBeenCalledTimes(2);
    expect(deps.persistDailySnapshot).toHaveBeenCalledTimes(2);
  });

  test("validates atomic daily snapshots containing metadata and provider events", () => {
    const metadata: CacheMetadata = { checkedDayTrt: "2026-07-14", dataUpdatedAtUtc: now.toISOString(), providerStatus: "updated", providerMessage: "updated" };
    expect(validDailyCatalogSnapshot({ metadata, events: [raw(2)] })).toBe(true);
    expect(validDailyCatalogSnapshot({ metadata, events: null })).toBe(false);
  });
});
