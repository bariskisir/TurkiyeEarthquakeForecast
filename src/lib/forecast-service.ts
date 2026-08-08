/**
 * @fileoverview Defines the forecast service application service module and makes its contracts, integration responsibilities, side effects, and fallback behavior explicit to maintainers.
 */
import { getCatalog, type CatalogResult } from "./catalog";
import { calculateForecastMatrix } from "./forecast";
import { createForecastBundleStore, type ForecastBundleStore } from "./forecast-cache";
import { FORECAST_MODEL, type ForecastBundle } from "./forecast-bundle";
import { calculationCutoffSeconds, calculationDateKey, calculationDateOptions, parseCatalogUtc, secondsToIso, turkiyeDay } from "./time";
import { FORECAST_METHODS, MAGNITUDE_THRESHOLDS, RECENT_THRESHOLDS, SIGNAL_COUNTS, type ForecastResponse, type RecentEarthquake, type RecentThreshold } from "./types";

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
  async function buildBundle(dayKey: string, cutoffSeconds: number | null): Promise<ForecastBundle> {
    const started = Date.now();
    const snapshot = await catalog.getCatalog();
    if (snapshot.metadata.providerStatus === "degraded") throw new Error(snapshot.metadata.providerMessage);
    const referenceDate = now();
    const events = cutoffSeconds === null
      ? snapshot.events
      : snapshot.events.filter((event) => parseCatalogUtc(event.occurredAt) < cutoffSeconds);
    const referenceTimestamp = cutoffSeconds === null
      ? Math.floor(referenceDate.getTime() / 1_000)
      : events.length > 0 ? parseCatalogUtc(events[0].occurredAt) : cutoffSeconds;
    const forecasts = calculateMatrix(events, {
      referenceTimestamp,
      methods: FORECAST_METHODS,
      thresholds: MAGNITUDE_THRESHOLDS,
      counts: SIGNAL_COUNTS,
    });
    const recentEarthquakes = cutoffSeconds === null
      ? snapshot.recentEarthquakes
      : Object.fromEntries(RECENT_THRESHOLDS.map((threshold: RecentThreshold) => [threshold, snapshot.recentEarthquakes[threshold].filter((event: RecentEarthquake) => Date.parse(event.occurredAtUtc) < cutoffSeconds * 1_000)])) as Record<RecentThreshold, RecentEarthquake[]>;
    const newest = events[0] ?? snapshot.events[0];
    const oldest = events.at(-1) ?? newest;
    const bundle: ForecastBundle = {
      model: FORECAST_MODEL,
      dayTrt: dayKey,
      cutoffSeconds: cutoffSeconds ?? null,
      generatedAtUtc: referenceDate.toISOString(),
      forecasts,
      recentEarthquakes,
      catalogMetadata: {
        dataUpdatedAtUtc: snapshot.metadata.dataUpdatedAtUtc,
        newestEventAtUtc: secondsToIso(parseCatalogUtc(newest.occurredAt)),
        oldestEventAtUtc: secondsToIso(parseCatalogUtc(oldest.occurredAt)),
        eventCount: events.length,
        providerStatus: snapshot.metadata.providerStatus,
        providerMessage: snapshot.metadata.providerMessage,
      },
    };
    const stored = await store.write(bundle);
    dependencies.log?.({ event: "forecast_generated", dayTrt: dayKey, eventCount: stored.catalogMetadata.eventCount, durationMs: Date.now() - started });
    return stored;
  }

  /**
   * Calculates bundle for the forecast service application service module, including the validation and edge cases encoded by its typed contract.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  function calculateBundle(dayKey: string, remember: boolean, latest: boolean): Promise<ForecastBundle> {
    if (calculation?.dayTrt === dayKey) return calculation.promise;
    const cutoffSeconds = latest ? null : calculationCutoffSeconds(dayKey);
    const promise = store.runExclusive(dayKey, () => buildBundle(dayKey, cutoffSeconds)).then((bundle) => {
      if (remember || memoryBundle === null || bundle.dayTrt > memoryBundle.dayTrt) memoryBundle = bundle;
      return bundle;
    }).finally(() => {
      if (calculation?.dayTrt === dayKey) calculation = null;
    });
    calculation = { dayTrt: dayKey, promise };
    return promise;
  }

  /**
   * Defers the daily calculation and the full snapshot fill for the forecast service application service module.
   *
   * The first request of a day warms every selector option (milestone years, 2000..current-year range, current-year months,
   * and the daily snapshot) so switching the dropdown never blocks. Every bundle is idempotently cached in tmp and B2, so
   * later days only compute the genuinely new daily snapshot while confirming the existing historical ones.
   */
  function deferRefresh(dayTrt: string): void {
    defer(async () => {
      await calculateBundle(dayTrt, true, true).then(() => undefined).catch(() => undefined);
      const year = Number(dayTrt.slice(0, 4));
      const month = Number(dayTrt.slice(5, 7));
      const yearKeys = calculationDateOptions(dayTrt)
        .map((option) => calculationDateKey(option, dayTrt))
        .filter((key): key is string => key !== null);
      const monthKeys = Array.from({ length: month }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}-01`);
      for (const key of new Set([...yearKeys, ...monthKeys])) {
        await calculateBundle(key, false, false).then(() => undefined).catch(() => undefined);
      }
    });
  }

  /**
   * Performs the get bundle operation for the forecast service application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  async function getBundle(dayKey: string, latest: boolean): Promise<{ bundle: ForecastBundle; cache: ForecastResponse["metadata"]["cache"]; refreshing: boolean }> {
    const expectedCutoff = latest ? null : calculationCutoffSeconds(dayKey);
    const matches = (candidate: ForecastBundle | null): candidate is ForecastBundle => candidate !== null && (candidate.cutoffSeconds ?? null) === expectedCutoff;
    if (matches(memoryBundle) && memoryBundle.dayTrt === dayKey) return { bundle: memoryBundle, cache: "memory", refreshing: false };
    const stored = await store.read(dayKey);
    if (stored) {
      memoryBundle = stored.bundle;
      return { bundle: stored.bundle, cache: stored.cache, refreshing: false };
    }
    if (latest) {
      const stale = matches(memoryBundle) && memoryBundle.dayTrt < dayKey ? memoryBundle : (await store.findLatest(dayKey))?.bundle ?? null;
      if (matches(stale)) {
        deferRefresh(dayKey);
        return { bundle: stale, cache: "tmp", refreshing: true };
      }
      const bundle = await calculateBundle(dayKey, true, true);
      deferRefresh(dayKey);
      return { bundle, cache: "memory", refreshing: false };
    }
    return { bundle: await calculateBundle(dayKey, false, false), cache: "memory", refreshing: false };
  }

  /**
   * Performs the get forecast operation for the forecast service application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  async function getForecast(date?: string): Promise<ForecastResponse> {
    const today = turkiyeDay(now());
    const option = date && date.length ? date : today;
    const dayKey = calculationDateKey(option, today);
    if (!dayKey) throw new Error(`Unsupported calculation date: ${option}`);
    const latest = dayKey === today;
    const { bundle, cache, refreshing } = await getBundle(dayKey, latest);
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
