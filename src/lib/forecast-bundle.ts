/**
 * @fileoverview Defines the forecast bundle application service module and makes its contracts, integration responsibilities, side effects, and fallback behavior explicit to maintainers.
 */
import {
  FORECAST_METHODS,
  MAGNITUDE_THRESHOLDS,
  RECENT_THRESHOLDS,
  SIGNAL_COUNTS,
  type ForecastMatrix,
  type ForecastMethod,
  type ForecastPoint,
  type MagnitudeThreshold,
  type RecentEarthquake,
  type RecentThreshold,
  type ForecastResponse,
} from "./types";

export const FORECAST_MODEL = "multi-method-relative-v3.8";
export const FORECAST_CACHE_PREFIX = "forecasts/v3.8";
export const FORECAST_FILE_PREFIX = "turkiye-earthquake-forecasts-v3.8";

export interface ForecastBundle {
  model: string;
  hour: string;
  generatedAtUtc: string;
  forecasts: ForecastMatrix;
  recentEarthquakes: Record<RecentThreshold, RecentEarthquake[]>;
  catalogMetadata: {
    dataUpdatedAtUtc: string;
    newestEventAtUtc: string;
    oldestEventAtUtc: string;
    eventCount: number;
    providerStatus: "updated" | "current" | "degraded";
    providerMessage: string;
  };
}

/**
 * Narrows an unknown runtime value to a non-array object record before validators inspect its properties.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/**
 * Narrows an unknown runtime value to a finite number so cached NaN and infinity values cannot enter the forecast model.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Accepts either null or a finite diagnostic number for model fields that can legitimately be unavailable.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function nullableFinite(value: unknown): boolean {
  return value === null || finite(value);
}

/**
 * Validates forecast point for the forecast bundle application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function validForecastPoint(value: unknown, threshold: MagnitudeThreshold): value is ForecastPoint {
  const point = record(value);
  const indicators = record(point?.indicators);
  if (!point || !indicators) return false;
  const finiteIndicators = ["backgroundRateAnnual", "triggeredRateAnnual", "totalRateAnnual", "clusteringRatio", "bValue", "completenessMagnitude", "nearbyEventCount", "observationQuality", "energyRatePerYear", "historicalLargeEventCount", "recurrenceConfidence", "rawCompositeScore"];
  const nullableIndicators = ["lastEventMagnitude", "daysSinceLastEvent", "localBValue", "bValueAnomaly", "coefficientOfVariation", "naturalTimeProgress", "rateChangeZValue", "magnitudeDeficit", "recurrenceProbability30Years", "meanRecurrenceYears", "recurrenceAperiodicity", "yearsSinceLastLargeEvent"];
  return finite(point.rank)
    && finite(point.latitude)
    && finite(point.longitude)
    && finite(point.radiusKm)
    && point.threshold === threshold
    && finite(point.relativeScore)
    && ["elevated", "notable", "high", "very high"].includes(String(point.signalLevel))
    && finiteIndicators.every((key) => finite(indicators[key]))
    && nullableIndicators.every((key) => nullableFinite(indicators[key]));
}

/**
 * Validates recent earthquake for the forecast bundle application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function validRecentEarthquake(value: unknown): value is RecentEarthquake {
  const event = record(value);
  return Boolean(event
    && typeof event.id === "string"
    && typeof event.occurredAtUtc === "string"
    && finite(event.longitude)
    && finite(event.latitude)
    && finite(event.magnitude)
    && nullableFinite(event.depthKm)
    && typeof event.location === "string"
    && typeof event.source === "string");
}

/**
 * Validates forecast bundle for the forecast bundle application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function validForecastBundle(value: unknown, expectedHour?: string): value is ForecastBundle {
  const bundle = record(value);
  const metadata = record(bundle?.catalogMetadata);
  const forecasts = record(bundle?.forecasts);
  const recent = record(bundle?.recentEarthquakes);
  if (!bundle || !metadata || !forecasts || !recent) return false;
  if (bundle.model !== FORECAST_MODEL || typeof bundle.hour !== "string" || expectedHour && bundle.hour !== expectedHour || typeof bundle.generatedAtUtc !== "string") return false;
  if (typeof metadata.dataUpdatedAtUtc !== "string"
    || typeof metadata.newestEventAtUtc !== "string"
    || typeof metadata.oldestEventAtUtc !== "string"
    || !finite(metadata.eventCount)
    || !["updated", "current", "degraded"].includes(String(metadata.providerStatus))
    || typeof metadata.providerMessage !== "string") return false;
  const validMatrix = FORECAST_METHODS.every((method: ForecastMethod) => {
    const byThreshold = record(forecasts[method]);
    return byThreshold && MAGNITUDE_THRESHOLDS.every((threshold: MagnitudeThreshold) => {
      const byCount = record(byThreshold[threshold]);
      return byCount && SIGNAL_COUNTS.every((count) => Array.isArray(byCount[count]) && (byCount[count] as unknown[]).every((point) => validForecastPoint(point, threshold)));
    });
  });
  return Boolean(validMatrix && RECENT_THRESHOLDS.every((threshold: RecentThreshold) => Array.isArray(recent[threshold]) && (recent[threshold] as unknown[]).every(validRecentEarthquake)));
}

/**
 * Validates forecast response for the forecast bundle application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function validForecastResponse(value: unknown): value is ForecastResponse {
  const response = record(value);
  const metadata = record(response?.metadata);
  if (!response || !metadata) return false;
  if (!["memory", "tmp", "bundle"].includes(String(metadata.cache)) || !["ready", "refreshing"].includes(String(metadata.forecastStatus))) return false;
  return validForecastBundle({
    model: FORECAST_MODEL,
    hour: metadata.forecastHourUtc,
    generatedAtUtc: metadata.generatedAtUtc,
    forecasts: response.forecasts,
    recentEarthquakes: response.recentEarthquakes,
    catalogMetadata: {
      dataUpdatedAtUtc: metadata.dataUpdatedAtUtc,
      newestEventAtUtc: metadata.newestEventAtUtc,
      oldestEventAtUtc: metadata.oldestEventAtUtc,
      eventCount: metadata.eventCount,
      providerStatus: metadata.providerStatus,
      providerMessage: metadata.providerMessage,
    },
  });
}
