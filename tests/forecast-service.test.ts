/**
 * @fileoverview Defines the forecast service.test Vitest specification, documenting expected success, failure, edge-case, and regression behavior without modifying immutable catalogue data.
 */
import { describe, expect, test, vi } from "vitest";
import { createForecastService } from "@/lib/forecast-service";
import { FORECAST_MODEL, type ForecastBundle } from "@/lib/forecast-bundle";
import type { ForecastBundleStore } from "@/lib/forecast-cache";
import { FORECAST_METHODS, MAGNITUDE_THRESHOLDS, RECENT_THRESHOLDS, SIGNAL_COUNTS, type ForecastMatrix, type RecentEarthquake, type RecentThreshold } from "@/lib/types";
import type { CatalogResult } from "@/lib/catalog-service";
import type { calculateForecastMatrix } from "@/lib/forecast";

const currentDate = new Date("2026-07-14T10:30:00.000Z");

/**
 * Returns the fixed UTC instant shared by service tests so cache-hour decisions never depend on the machine clock.
 *
 * The same Date instance is treated as immutable by the service and keeps every assertion deterministic.
 */
function currentNow(): Date { return currentDate; }

/**
 * Resolves the deterministic catalogue fixture through the asynchronous service dependency contract.
 *
 * Naming the dependency allows tests to wrap it in a spy without duplicating inline promise callbacks.
 */
async function getFixtureCatalog(): Promise<CatalogResult> { return catalog(); }

/**
 * Builds a complete structurally valid forecast matrix for orchestration tests without invoking the numerical engine.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function matrix(): ForecastMatrix {
  return Object.fromEntries(FORECAST_METHODS.map((method) => [method, Object.fromEntries(MAGNITUDE_THRESHOLDS.map((threshold) => [threshold, Object.fromEntries(SIGNAL_COUNTS.map((count) => [count, []]))]))])) as unknown as ForecastMatrix;
}

/**
 * Builds empty recent-earthquake arrays for every supported magnitude threshold.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function recent(): Record<RecentThreshold, RecentEarthquake[]> {
  return Object.fromEntries(RECENT_THRESHOLDS.map((threshold) => [threshold, []])) as unknown as Record<RecentThreshold, RecentEarthquake[]>;
}

/**
 * Builds a deterministic catalogue result and metadata set for forecast-service orchestration tests.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function catalog(): CatalogResult {
  return {
    events: [{ id: 1, eventId: "one", occurredAt: "2026-07-14 09:00:00", latitude: 39, longitude: 35, magnitude: 4, sourceCount: 1, magnitudeSpread: null, isPrimary: true }],
    recentEarthquakes: recent(),
    metadata: { checkedHour: "2026-07-14T10", dataUpdatedAtUtc: currentDate.toISOString(), providerStatus: "current", providerMessage: "current" },
    source: "bundle",
  };
}

/**
 * Performs the stale bundle operation for the forecast service.test Vitest specification, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function staleBundle(): ForecastBundle {
  return {
    model: FORECAST_MODEL,
    hour: "2026-07-14T09",
    generatedAtUtc: "2026-07-14T09:00:00.000Z",
    forecasts: matrix(),
    recentEarthquakes: recent(),
    catalogMetadata: {
      dataUpdatedAtUtc: "2026-07-14T09:00:00.000Z",
      newestEventAtUtc: "2026-07-14T08:00:00.000Z",
      oldestEventAtUtc: "1900-01-01T00:00:00.000Z",
      eventCount: 1,
      providerStatus: "current",
      providerMessage: "current",
    },
  };
}

/**
 * Performs the in memory store operation for the forecast service.test Vitest specification, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function inMemoryStore(stale: ForecastBundle | null = null): ForecastBundleStore & { current: ForecastBundle | null } {
  const store = {
    current: null as ForecastBundle | null,
    read: vi.fn(async (hour: string) => store.current?.hour === hour ? store.current : null),
    findLatest: vi.fn(async () => stale),
    runExclusive: vi.fn(async (_hour: string, task: () => Promise<ForecastBundle>) => task()),
    write: vi.fn(async (bundle: ForecastBundle) => { store.current = bundle; }),
  };
  return store;
}

describe("forecast service", () => {
  test("builds the complete matrix once and then serves memory", async () => {
    const store = inMemoryStore();
    const getCatalog = vi.fn(getFixtureCatalog);
    const calculate = vi.fn(() => matrix()) as unknown as typeof calculateForecastMatrix;
    const service = createForecastService({ catalog: { getCatalog }, store, calculateMatrix: calculate, now: currentNow });
    const first = await service.getForecast();
    const second = await service.getForecast();
    expect(first.metadata.cache).toBe("memory");
    expect(second.metadata.cache).toBe("memory");
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(getCatalog).toHaveBeenCalledTimes(1);
  });

  test("serves stale data while a deferred refresh runs", async () => {
    const store = inMemoryStore(staleBundle());
    const deferred: (() => Promise<void>)[] = [];
    const service = createForecastService({
      catalog: { getCatalog: getFixtureCatalog },
      store,
      calculateMatrix: vi.fn(() => matrix()) as unknown as typeof calculateForecastMatrix,
      /**
       * Performs the now operation for the forecast service.test Vitest specification, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
       *
       * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
       */
      now: currentNow,
      /**
       * Performs the defer operation for the forecast service.test Vitest specification, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
       *
       * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
       */
      defer: (task) => { deferred.push(task); },
    });
    const stale = await service.getForecast();
    expect(stale.metadata.forecastStatus).toBe("refreshing");
    expect(stale.metadata.forecastHourUtc).toBe("2026-07-14T09");
    await deferred[0]();
    const refreshed = await service.getForecast();
    expect(refreshed.metadata.forecastStatus).toBe("ready");
    expect(refreshed.metadata.forecastHourUtc).toBe("2026-07-14T10");
  });

  test("returns a current stored bundle without recalculation", async () => {
    const store = inMemoryStore();
    store.current = { ...staleBundle(), hour: "2026-07-14T10" };
    const calculate = vi.fn(() => matrix()) as unknown as typeof calculateForecastMatrix;
    const response = await createForecastService({ store, calculateMatrix: calculate, now: currentNow }).getForecast();
    expect(response.metadata.cache).toBe("tmp");
    expect(calculate).not.toHaveBeenCalled();
  });
});
