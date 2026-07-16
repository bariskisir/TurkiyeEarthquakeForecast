/**
 * @fileoverview Defines the types application service module and makes its contracts, integration responsibilities, side effects, and fallback behavior explicit to maintainers.
 */
export const MAGNITUDE_THRESHOLDS = [5, 6, 7] as const;
export type MagnitudeThreshold = (typeof MAGNITUDE_THRESHOLDS)[number];

export const FORECAST_METHODS = ["combined", "poisson", "etas", "triggered", "bValue", "naturalTime", "energy", "clustering", "recurrence"] as const;
export type ForecastMethod = (typeof FORECAST_METHODS)[number];

export const MAGNITUDE_INDEPENDENT_FORECAST_METHODS: readonly ForecastMethod[] = ["bValue", "naturalTime", "energy", "clustering"];

/**
 * Performs the forecast method uses magnitude operation for the types application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function forecastMethodUsesMagnitude(method: ForecastMethod): boolean {
  return !MAGNITUDE_INDEPENDENT_FORECAST_METHODS.some((candidate) => candidate === method);
}

export const RECENT_THRESHOLDS = [5, 6, 7, 8] as const;
export type RecentThreshold = (typeof RECENT_THRESHOLDS)[number];

export const SIGNAL_COUNTS = [0, 50] as const;
export type SignalCount = (typeof SIGNAL_COUNTS)[number];

export const RECENT_COUNTS = [10, 50, 100, 150] as const;
export type RecentCount = (typeof RECENT_COUNTS)[number];

export type Theme = "dark" | "light";

export interface CatalogEarthquake {
  id?: number;
  eventId?: string;
  seismicId?: string | null;
  occurredAt: string;
  longitude: number;
  latitude: number;
  magnitude: number;
  depthKm?: number | null;
  quality?: string | null;
  source?: string | null;
  sourceCount: number;
  magnitudeSpread: number | null;
  isPrimary: boolean;
}

export interface RecentEarthquake {
  id: string;
  occurredAtUtc: string;
  longitude: number;
  latitude: number;
  magnitude: number;
  depthKm: number | null;
  location: string;
  source: string;
}

export interface ForecastPoint {
  rank: number;
  latitude: number;
  longitude: number;
  radiusKm: number;
  threshold: MagnitudeThreshold;
  relativeScore: number;
  signalLevel: "elevated" | "notable" | "high" | "very high";
  indicators: {
    backgroundRateAnnual: number;
    triggeredRateAnnual: number;
    totalRateAnnual: number;
    clusteringRatio: number;
    bValue: number;
    completenessMagnitude: number;
    nearbyEventCount: number;
    lastEventMagnitude: number | null;
    daysSinceLastEvent: number | null;
    observationQuality: number;
    /** Spatially-varying Gutenberg-Richter b-value in the local neighbourhood (null if insufficient data) */
    localBValue: number | null;
    /** (globalBValue − localBValue) when positive — low b signals stress accumulation */
    bValueAnomaly: number | null;
    /** Root-energy release rate (J^(1/2) / year), proportional to √(seismic moment rate) */
    energyRatePerYear: number;
    /** Coefficient of variation of inter-event times (> 1 clustered, = 1 Poisson, < 1 quasiperiodic) */
    coefficientOfVariation: number | null;
    /** Gutenberg-Richter-normalised natural-time cycle progress, ∈ [0, 1) */
    naturalTimeProgress: number | null;
    /** Rate-change z-value (Habermann\'s β); positive = accelerating seismicity */
    rateChangeZValue: number | null;
    /** Difference between Gutenberg-Richter expected M_max and observed M_max */
    magnitudeDeficit: number | null;
    recurrenceProbability30Years: number | null;
    meanRecurrenceYears: number | null;
    recurrenceAperiodicity: number | null;
    yearsSinceLastLargeEvent: number | null;
    historicalLargeEventCount: number;
    recurrenceConfidence: number;
    /** Raw method score before min-max normalisation to [40, 99] */
    rawCompositeScore: number;
  };
}

export type ForecastMatrix = Record<ForecastMethod, Record<MagnitudeThreshold, Record<SignalCount, ForecastPoint[]>>>;

export interface ForecastResponse {
  forecasts: ForecastMatrix;
  recentEarthquakes: Record<RecentThreshold, RecentEarthquake[]>;
  metadata: {
    generatedAtUtc: string;
    dataUpdatedAtUtc: string;
    newestEventAtUtc: string;
    oldestEventAtUtc: string;
    eventCount: number;
    providerStatus: "updated" | "current" | "degraded";
    providerMessage: string;
    cache: "memory" | "tmp" | "bundle";
    forecastDayTrt: string;
    forecastStatus: "ready" | "refreshing";
  };
}

export interface ForecastErrorResponse {
  error: string;
  code: "FORECAST_UNAVAILABLE";
}
