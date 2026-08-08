/**
 * @fileoverview Defines the forecast service.test Vitest specification, documenting expected success, failure, edge-case, and regression behavior without modifying immutable catalogue data.
 */
import { describe, expect, test, vi } from "vitest";
import { createForecastService } from "@/lib/forecast-service";
import { FORECAST_MODEL, type ForecastBundle } from "@/lib/forecast-bundle";
import type { ForecastBundleStore } from "@/lib/forecast-cache";
import { FORECAST_METHODS, MAGNITUDE_THRESHOLDS, RECENT_THRESHOLDS, SIGNAL_COUNTS, type CatalogEarthquake, type ForecastMatrix, type RecentEarthquake, type RecentThreshold } from "@/lib/types";
import type { CatalogResult } from "@/lib/catalog-service";
import type { calculateForecastMatrix } from "@/lib/forecast";

const currentDate = new Date("2026-07-14T10:30:00.000Z");

/**
 * Returns the fixed UTC instant shared by service tests so cache-day decisions never depend on the machine clock.
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
    metadata: { checkedDayTrt: "2026-07-14", dataUpdatedAtUtc: currentDate.toISOString(), providerStatus: "current", providerMessage: "current" },
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
    dayTrt: "2026-07-13",
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
    read: vi.fn(async (dayTrt: string) => store.current?.dayTrt === dayTrt ? { bundle: store.current, cache: "tmp" as const } : null),
    findLatest: vi.fn(async () => stale ? { bundle: stale, cache: "tmp" as const } : null),
    runExclusive: vi.fn(async (_dayTrt: string, task: () => Promise<ForecastBundle>) => task()),
    write: vi.fn(async (bundle: ForecastBundle) => { store.current = bundle; return bundle; }),
  };
  return store;
}

describe("forecast service", () => {
  test("builds the complete matrix once and then serves memory", async () => {
    const store = inMemoryStore();
    const getCatalog = vi.fn(getFixtureCatalog);
    const calculate = vi.fn(() => matrix()) as unknown as typeof calculateForecastMatrix;
    const deferred: (() => Promise<void>)[] = [];
    const service = createForecastService({
      catalog: { getCatalog },
      store,
      calculateMatrix: calculate,
      now: currentNow,
      defer: (task) => { deferred.push(task); },
    });
    const first = await service.getForecast();
    const second = await service.getForecast();
    expect(first.metadata.cache).toBe("memory");
    expect(second.metadata.cache).toBe("memory");
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(getCatalog).toHaveBeenCalledTimes(1);
    expect(deferred).toHaveLength(1);
  });

  test("serves stale data while a deferred refresh runs", async () => {
    const store = inMemoryStore(staleBundle());
    const deferred: (() => Promise<void>)[] = [];
    const calculate = vi.fn(() => matrix()) as unknown as typeof calculateForecastMatrix;
    const service = createForecastService({
      catalog: { getCatalog: getFixtureCatalog },
      store,
      calculateMatrix: calculate,
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
    expect(stale.metadata.forecastDayTrt).toBe("2026-07-13");
    await deferred[0]();
    const refreshed = await service.getForecast();
    expect(refreshed.metadata.forecastStatus).toBe("ready");
    expect(refreshed.metadata.forecastDayTrt).toBe("2026-07-14");
    const snapshot = await service.getForecast("2026-07");
    expect(snapshot.metadata.forecastDayTrt).toBe("2026-07-01");
    expect(snapshot.metadata.cache).toBe("tmp");
    expect(snapshot.metadata.forecastStatus).toBe("ready");
    const milestone = await service.getForecast("500");
    expect(milestone.metadata.forecastDayTrt).toBe("0500-01-01");
    expect(milestone.metadata.cache).toBe("memory");
  });

  test("does not serve a historical snapshot as the current day", async () => {
    const snapshot: ForecastBundle = { ...staleBundle(), dayTrt: "2026-07-01", cutoffSeconds: Math.floor(Date.parse("2026-07-01T00:00:00.000Z") / 1_000) };
    const store = inMemoryStore(snapshot);
    store.current = snapshot;
    const calculate = vi.fn(() => matrix()) as unknown as typeof calculateForecastMatrix;
    const deferred: (() => Promise<void>)[] = [];
    const response = await createForecastService({
      catalog: { getCatalog: getFixtureCatalog },
      store,
      calculateMatrix: calculate,
      now: currentNow,
      defer: (task) => { deferred.push(task); },
    }).getForecast();
    expect(response.metadata.forecastDayTrt).toBe("2026-07-14");
    expect(response.metadata.forecastStatus).toBe("ready");
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(deferred).toHaveLength(1);
  });

  test("recomputes a snapshot whose key collides with a stored daily bundle", async () => {
    const store = inMemoryStore();
    store.current = staleBundle();
    const calculate = vi.fn(() => matrix()) as unknown as typeof calculateForecastMatrix;
    const response = await createForecastService({
      catalog: { getCatalog: getFixtureCatalog },
      store,
      calculateMatrix: calculate,
      now: currentNow,
    }).getForecast("2026-07");
    expect(response.metadata.forecastDayTrt).toBe("2026-07-01");
    expect(response.metadata.cache).toBe("memory");
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(store.current?.cutoffSeconds).toBe(Math.floor(Date.parse("2026-07-01T00:00:00.000Z") / 1_000));
  });

  test("returns a current stored bundle without recalculation", async () => {
    const store = inMemoryStore();
    store.current = { ...staleBundle(), dayTrt: "2026-07-14" };
    const calculate = vi.fn(() => matrix()) as unknown as typeof calculateForecastMatrix;
    const response = await createForecastService({ store, calculateMatrix: calculate, now: currentNow }).getForecast();
    expect(response.metadata.cache).toBe("tmp");
    expect(calculate).not.toHaveBeenCalled();
  });

  test("returns a historical year snapshot using only pre-year events and the last included event reference", async () => {
    const store = inMemoryStore();
    const catalogWithHistory = async (): Promise<CatalogResult> => ({
      ...catalog(),
      events: [
        { id: 3, eventId: "three", occurredAt: "2026-07-14 08:00:00", latitude: 39, longitude: 35, magnitude: 4, sourceCount: 1, magnitudeSpread: null, isPrimary: true },
        { id: 2, eventId: "two", occurredAt: "2000-05-01 12:00:00", latitude: 39, longitude: 35, magnitude: 4, sourceCount: 1, magnitudeSpread: null, isPrimary: true },
        { id: 1, eventId: "one", occurredAt: "1999-11-20 03:00:00", latitude: 39, longitude: 35, magnitude: 4, sourceCount: 1, magnitudeSpread: null, isPrimary: true },
      ],
    });
    const calculate = vi.fn(() => matrix()) as unknown as typeof calculateForecastMatrix;
    const service = createForecastService({ catalog: { getCatalog: catalogWithHistory }, store, calculateMatrix: calculate, now: currentNow });
    const response = await service.getForecast("2000");
    expect(response.metadata.forecastDayTrt).toBe("2000-01-01");
    expect(response.metadata.forecastStatus).toBe("ready");
    expect(response.metadata.eventCount).toBe(1);
    expect(calculate).toHaveBeenCalledTimes(1);
    const [events, options] = vi.mocked(calculate).mock.calls[0] as [CatalogEarthquake[], { referenceTimestamp: number }];
    expect(events.map((event) => event.eventId)).toEqual(["one"]);
    expect(options.referenceTimestamp).toBe(Date.parse("1999-11-20T03:00:00.000Z") / 1_000);
  });

  test("returns a quake-window year snapshot cutting at the correct pre-1900 boundary", async () => {
    const store = inMemoryStore();
    const catalogWithHistory = async (): Promise<CatalogResult> => ({
      ...catalog(),
      events: [
        { id: 3, eventId: "modern", occurredAt: "2000-05-01 12:00:00", latitude: 39, longitude: 35, magnitude: 4, sourceCount: 1, magnitudeSpread: null, isPrimary: true },
        { id: 2, eventId: "before", occurredAt: "0017-06-01 12:00:00", latitude: 39, longitude: 35, magnitude: 4, sourceCount: 1, magnitudeSpread: null, isPrimary: true },
        { id: 1, eventId: "after", occurredAt: "0018-02-01 12:00:00", latitude: 39, longitude: 35, magnitude: 4, sourceCount: 1, magnitudeSpread: null, isPrimary: true },
      ],
    });
    const calculate = vi.fn(() => matrix()) as unknown as typeof calculateForecastMatrix;
    const service = createForecastService({ catalog: { getCatalog: catalogWithHistory }, store, calculateMatrix: calculate, now: currentNow });
    const response = await service.getForecast("18");
    expect(response.metadata.forecastDayTrt).toBe("0018-01-01");
    expect(response.metadata.eventCount).toBe(1);
    const [events, options] = vi.mocked(calculate).mock.calls[0] as [CatalogEarthquake[], { referenceTimestamp: number }];
    expect(events.map((event) => event.eventId)).toEqual(["before"]);
    expect(options.referenceTimestamp).toBe(Date.parse("0017-06-01T12:00:00.000Z") / 1_000);
  });

  test("filters recent earthquakes and metadata for a historical year snapshot", async () => {
    const store = inMemoryStore();
    const recentEarthquakes = {
      5: [
        { id: "two", occurredAtUtc: "2026-07-14T08:00:00.000Z", longitude: 35, latitude: 39, magnitude: 5.4, depthKm: null, location: "Late", source: "sismik" },
        { id: "one", occurredAtUtc: "1998-06-01T12:00:00.000Z", longitude: 35, latitude: 39, magnitude: 5.2, depthKm: null, location: "Early", source: "sismik" },
      ],
      6: [],
      7: [],
      8: [],
    };
    const catalogWithHistory = async (): Promise<CatalogResult> => ({
      events: [
        { id: 2, eventId: "two", occurredAt: "2026-07-14 08:00:00", latitude: 39, longitude: 35, magnitude: 5.4, sourceCount: 1, magnitudeSpread: null, isPrimary: true },
        { id: 1, eventId: "one", occurredAt: "1998-06-01 12:00:00", latitude: 39, longitude: 35, magnitude: 5.2, sourceCount: 1, magnitudeSpread: null, isPrimary: true },
      ],
      recentEarthquakes: recentEarthquakes as Record<RecentThreshold, RecentEarthquake[]>,
      metadata: catalog().metadata,
      source: "bundle",
    });
    const calculate = vi.fn(() => matrix()) as unknown as typeof calculateForecastMatrix;
    const service = createForecastService({ catalog: { getCatalog: catalogWithHistory }, store, calculateMatrix: calculate, now: currentNow });
    const response = await service.getForecast("2000");
    expect(response.recentEarthquakes[5].map((event) => event.id)).toEqual(["one"]);
    expect(response.metadata.newestEventAtUtc).toBe("1998-06-01T12:00:00.000Z");
    expect(response.metadata.eventCount).toBe(1);
  });

  test.each([
    ["earliest milestone year", "500", "0500-01-01"],
    ["mid milestone year", "1950", "1950-01-01"],
    ["late milestone year", "1999", "1999-01-01"],
  ])("normalizes %s to its padded bundle key", async (_label, date, key) => {
    const store = inMemoryStore();
    const calculate = vi.fn(() => matrix()) as unknown as typeof calculateForecastMatrix;
    const service = createForecastService({ catalog: { getCatalog: getFixtureCatalog }, store, calculateMatrix: calculate, now: currentNow });
    const response = await service.getForecast(date);
    expect(response.metadata.forecastDayTrt).toBe(key);
    expect(response.metadata.forecastStatus).toBe("ready");
    expect(response.metadata.eventCount).toBe(0);
  });

  test("returns a current-year month snapshot cutting at the first day of the month", async () => {
    const store = inMemoryStore();
    const catalogWithHistory = async (): Promise<CatalogResult> => ({
      ...catalog(),
      events: [
        { id: 2, eventId: "two", occurredAt: "2026-07-14 08:00:00", latitude: 39, longitude: 35, magnitude: 4, sourceCount: 1, magnitudeSpread: null, isPrimary: true },
        { id: 1, eventId: "one", occurredAt: "2026-06-30 23:00:00", latitude: 39, longitude: 35, magnitude: 4, sourceCount: 1, magnitudeSpread: null, isPrimary: true },
      ],
    });
    const calculate = vi.fn(() => matrix()) as unknown as typeof calculateForecastMatrix;
    const service = createForecastService({ catalog: { getCatalog: catalogWithHistory }, store, calculateMatrix: calculate, now: currentNow });
    const response = await service.getForecast("2026-07");
    expect(response.metadata.forecastDayTrt).toBe("2026-07-01");
    expect(response.metadata.forecastStatus).toBe("ready");
    expect(response.metadata.eventCount).toBe(1);
    const [events, options] = vi.mocked(calculate).mock.calls[0] as [CatalogEarthquake[], { referenceTimestamp: number }];
    expect(events.map((event) => event.eventId)).toEqual(["one"]);
    expect(options.referenceTimestamp).toBe(Date.parse("2026-06-30T23:00:00.000Z") / 1_000);
  });

  test("treats the current calendar date as the latest snapshot", async () => {
    const store = inMemoryStore();
    const calculate = vi.fn(() => matrix()) as unknown as typeof calculateForecastMatrix;
    const service = createForecastService({ catalog: { getCatalog: getFixtureCatalog }, store, calculateMatrix: calculate, now: currentNow });
    const response = await service.getForecast("2026-07-14");
    expect(response.metadata.forecastDayTrt).toBe("2026-07-14");
    expect(response.metadata.forecastStatus).toBe("ready");
    const [events, options] = vi.mocked(calculate).mock.calls[0] as [CatalogEarthquake[], { referenceTimestamp: number }];
    expect(events).toHaveLength(1);
    expect(options.referenceTimestamp).toBe(Math.floor(currentDate.getTime() / 1_000));
  });

  test.each([
    ["between-window year", "245"],
    ["between-window year gap", "503"],
    ["historical gap year", "1858"],
    ["future year", "2027"],
    ["range-interior year", "10"],
    ["invented range", "7-18"],
    ["malformed value", "20x7"],
    ["past-year month", "2025-07"],
    ["zero month", "2026-00"],
    ["thirteenth month", "2026-13"],
    ["future month", "2026-08"],
    ["past date", "2026-07-13"],
    ["malformed date", "2026-13-99"],
    ["future date", "2026-07-15"],
  ])("rejects an unsupported %s", async (_label, date) => {
    const service = createForecastService({ store: inMemoryStore(), now: currentNow });
    await expect(service.getForecast(date)).rejects.toThrow("Unsupported calculation date");
  });
});
