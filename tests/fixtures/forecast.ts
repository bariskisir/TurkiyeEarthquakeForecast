/**
 * @fileoverview Defines the forecast deterministic fixture module, documenting expected success, failure, edge-case, and regression behavior without modifying immutable catalogue data.
 */
import { FORECAST_METHODS, MAGNITUDE_THRESHOLDS, RECENT_THRESHOLDS, SIGNAL_COUNTS, type ForecastMatrix, type ForecastResponse, type RecentEarthquake } from "@/lib/types";

/**
 * Performs the empty forecast matrix operation for the forecast deterministic fixture module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function emptyForecastMatrix(): ForecastMatrix {
  return Object.fromEntries(FORECAST_METHODS.map((method) => [method, Object.fromEntries(MAGNITUDE_THRESHOLDS.map((threshold) => [threshold, Object.fromEntries(SIGNAL_COUNTS.map((count) => [count, []]))]))])) as unknown as ForecastMatrix;
}

/**
 * Creates forecast response for the forecast deterministic fixture module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function createForecastResponse(overrides: Partial<ForecastResponse["metadata"]> = {}): ForecastResponse {
  const event: RecentEarthquake = {
    id: "recent-1",
    occurredAtUtc: "2026-07-14T09:10:00.000Z",
    longitude: 29.1,
    latitude: 40.8,
    magnitude: 5.2,
    depthKm: 8.4,
    location: "Marmara Sea",
    source: "afad",
  };
  return {
    forecasts: emptyForecastMatrix(),
    recentEarthquakes: Object.fromEntries(RECENT_THRESHOLDS.map((threshold) => [threshold, event.magnitude >= threshold ? [event] : []])) as ForecastResponse["recentEarthquakes"],
    metadata: {
      generatedAtUtc: "2026-07-14T09:15:00.000Z",
      dataUpdatedAtUtc: "2026-07-14T09:10:00.000Z",
      newestEventAtUtc: event.occurredAtUtc,
      oldestEventAtUtc: "1900-01-01T00:00:00.000Z",
      eventCount: 1,
      providerStatus: "current",
      providerMessage: "current",
      cache: "memory",
      forecastDayTrt: new Date(Date.now() + 3 * 60 * 60 * 1_000).toISOString().slice(0, 10),
      forecastStatus: "ready",
      ...overrides,
    },
  };
}
