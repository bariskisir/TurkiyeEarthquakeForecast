/**
 * @fileoverview Defines the forecast service application service module and makes its contracts, integration responsibilities, side effects, and fallback behavior explicit to maintainers.
 */
import { getCatalog, type CatalogResult } from "./catalog";
import { calculateForecastMatrix } from "./forecast";
import { createForecastBundleStore, type ForecastBundleStore } from "./forecast-cache";
import { FORECAST_MODEL, type ForecastBundle } from "./forecast-bundle";
import { parseCatalogUtc, secondsToIso, turkiyeDay } from "./time";
import { FORECAST_METHODS, MAGNITUDE_THRESHOLDS, SIGNAL_COUNTS, type ForecastResponse } from "./types";

export interface ForecastServiceDependencies {
  catalog?: { getCatalog: () => Promise<CatalogResult> };
  store?: ForecastBundleStore;
  calculateMatrix?: typeof calculateForecastMatrix;
  now?: () => Date;
  defer?: (task: () => Promise<void>) => void;
  log?: (entry: Record<string, unknown>) => void;
}

/**
 * Creates forecast service for the forecast service application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function createForecastService(dependencies: ForecastServiceDependencies = {}) {
  const catalog = dependencies.catalog ?? { getCatalog };
  const store = dependencies.store ?? createForecastBundleStore();
  const calculateMatrix = dependencies.calculateMatrix ?? calculateForecastMatrix;
  const now = dependencies.now ?? (() => new Date());
  const defer = dependencies.defer ?? ((task: () => Promise<void>) => { void task(); });
  let memoryBundle: ForecastBundle | null = null;
  let calculation: { dayTrt: string; promise: Promise<ForecastBundle> } | null = null;

  /**
   * Builds bundle for the forecast service application service module, including the validation and edge cases encoded by its typed contract.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  async function buildBundle(dayTrt: string): Promise<ForecastBundle> {
    const started = Date.now();
    const snapshot = await catalog.getCatalog();
    if (snapshot.metadata.providerStatus === "degraded") throw new Error(snapshot.metadata.providerMessage);
    const referenceDate = now();
    const referenceTimestamp = Math.floor(referenceDate.getTime() / 1_000);
    const forecasts = calculateMatrix(snapshot.events, {
      referenceTimestamp,
      methods: FORECAST_METHODS,
      thresholds: MAGNITUDE_THRESHOLDS,
      counts: SIGNAL_COUNTS,
    });
    const newest = snapshot.events[0];
    const oldest = snapshot.events.at(-1) ?? newest;
    const bundle: ForecastBundle = {
      model: FORECAST_MODEL,
      dayTrt,
      generatedAtUtc: referenceDate.toISOString(),
      forecasts,
      recentEarthquakes: snapshot.recentEarthquakes,
      catalogMetadata: {
        dataUpdatedAtUtc: snapshot.metadata.dataUpdatedAtUtc,
        newestEventAtUtc: secondsToIso(parseCatalogUtc(newest.occurredAt)),
        oldestEventAtUtc: secondsToIso(parseCatalogUtc(oldest.occurredAt)),
        eventCount: snapshot.events.length,
        providerStatus: snapshot.metadata.providerStatus,
        providerMessage: snapshot.metadata.providerMessage,
      },
    };
    const stored = await store.write(bundle);
    dependencies.log?.({ event: "forecast_generated", dayTrt, eventCount: stored.catalogMetadata.eventCount, durationMs: Date.now() - started });
    return stored;
  }

  /**
   * Calculates bundle for the forecast service application service module, including the validation and edge cases encoded by its typed contract.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  function calculateBundle(dayTrt: string): Promise<ForecastBundle> {
    if (calculation?.dayTrt === dayTrt) return calculation.promise;
    const promise = store.runExclusive(dayTrt, () => buildBundle(dayTrt)).then((bundle) => {
      memoryBundle = bundle;
      return bundle;
    }).finally(() => {
      if (calculation?.dayTrt === dayTrt) calculation = null;
    });
    calculation = { dayTrt, promise };
    return promise;
  }

  /**
   * Performs the get bundle operation for the forecast service application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  async function getBundle(): Promise<{ bundle: ForecastBundle; cache: ForecastResponse["metadata"]["cache"]; refreshing: boolean }> {
    const dayTrt = turkiyeDay(now());
    if (memoryBundle?.dayTrt === dayTrt) return { bundle: memoryBundle, cache: "memory", refreshing: false };
    const stored = await store.read(dayTrt);
    if (stored) {
      memoryBundle = stored;
      return { bundle: stored, cache: "tmp", refreshing: false };
    }
    const stale = memoryBundle && memoryBundle.dayTrt < dayTrt ? memoryBundle : await store.findLatest(dayTrt);
    if (stale) {
      defer(async () => { await calculateBundle(dayTrt).then(() => undefined).catch(() => undefined); });
      return { bundle: stale, cache: "tmp", refreshing: true };
    }
    return { bundle: await calculateBundle(dayTrt), cache: "memory", refreshing: false };
  }

  /**
   * Performs the get forecast operation for the forecast service application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  async function getForecast(): Promise<ForecastResponse> {
    const { bundle, cache, refreshing } = await getBundle();
    return {
      forecasts: bundle.forecasts,
      recentEarthquakes: bundle.recentEarthquakes,
      metadata: {
        generatedAtUtc: bundle.generatedAtUtc,
        ...bundle.catalogMetadata,
        cache,
        forecastDayTrt: bundle.dayTrt,
        forecastStatus: refreshing ? "refreshing" : "ready",
      },
    };
  }

  return { getForecast };
}
