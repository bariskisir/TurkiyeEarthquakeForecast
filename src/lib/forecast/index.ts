/**
 * @fileoverview Implements the index stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
import {
  FORECAST_METHODS,
  MAGNITUDE_THRESHOLDS,
  SIGNAL_COUNTS,
  type CatalogEarthquake,
  type ForecastMethod,
  type ForecastPoint,
  type MagnitudeThreshold,
  type SignalCount,
} from "@/lib/types";
import { roundTo } from "./numeric";
import { DEFAULT_FORECAST_COUNT, DISPLAY_SCORE_REFERENCE_COUNT, INFLUENCE_RADIUS_KM } from "./config";
import type { BaseCellField, ThresholdCellField } from "./types";
import { applyThreshold, buildField } from "./field-builder";
import { selectCandidatesSpatially } from "./selection";
import { normaliseDisplayScores, scoreToSignalLevel } from "./scoring";

export { brierScore, brierSkillScore, informationGainPerEvent, poissonLogLikelihood } from "./diagnostics";

/**
 * Builds forecast point for the index stage of the forecast engine, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function buildForecastPoint(cell: ThresholdCellField, rank: number, threshold: MagnitudeThreshold): ForecastPoint {
  const recurrence = threshold === 6 || threshold === 7 ? cell.largeEventRecurrence[threshold] : null;
  return {
    rank,
    latitude: roundTo(cell.latitude, 4),
    longitude: roundTo(cell.longitude, 4),
    radiusKm: INFLUENCE_RADIUS_KM[threshold],
    threshold,
    relativeScore: cell.displayScore,
    signalLevel: scoreToSignalLevel(cell.displayScore),
    indicators: {
      backgroundRateAnnual: roundTo(cell.backgroundAnnualRateAtThreshold, 4),
      triggeredRateAnnual: roundTo(cell.triggeredAnnualRateAtThreshold, 4),
      totalRateAnnual: roundTo(cell.annualRateAtThreshold, 4),
      clusteringRatio: roundTo(cell.clusteringRatio, 3),
      bValue: roundTo(cell.localBValue ?? cell.globalBValue, 2),
      completenessMagnitude: roundTo(cell.globalMc, 2),
      nearbyEventCount: roundTo(cell.qualityWeightedCount, 2),
      lastEventMagnitude: cell.lastEventMagnitude,
      daysSinceLastEvent: cell.daysSinceLastEvent === null ? null : roundTo(cell.daysSinceLastEvent, 1),
      observationQuality: roundTo(cell.meanQuality, 2),
      localBValue: cell.localBValue !== null ? roundTo(cell.localBValue, 3) : null,
      bValueAnomaly: cell.bValueAnomaly !== null ? roundTo(cell.bValueAnomaly, 4) : null,
      energyRatePerYear: roundTo(cell.energyRatePerYear, 2),
      coefficientOfVariation: cell.coefficientOfVariation !== null ? roundTo(cell.coefficientOfVariation, 3) : null,
      naturalTimeProgress: cell.naturalTimeProgress !== null ? roundTo(cell.naturalTimeProgress, 4) : null,
      rateChangeZValue: cell.rateChangeZValue !== null ? roundTo(cell.rateChangeZValue, 3) : null,
      magnitudeDeficit: cell.magnitudeDeficit !== null ? roundTo(cell.magnitudeDeficit, 3) : null,
      recurrenceProbability30Years: recurrence?.probability30Years !== null && recurrence?.probability30Years !== undefined ? roundTo(recurrence.probability30Years, 4) : null,
      meanRecurrenceYears: recurrence?.meanIntervalYears !== null && recurrence?.meanIntervalYears !== undefined ? roundTo(recurrence.meanIntervalYears, 1) : null,
      recurrenceAperiodicity: recurrence?.aperiodicity !== null && recurrence?.aperiodicity !== undefined ? roundTo(recurrence.aperiodicity, 3) : null,
      yearsSinceLastLargeEvent: recurrence?.yearsSinceLastEvent !== null && recurrence?.yearsSinceLastEvent !== undefined ? roundTo(recurrence.yearsSinceLastEvent, 1) : null,
      historicalLargeEventCount: recurrence?.eventCount ?? 0,
      recurrenceConfidence: recurrence ? roundTo(recurrence.confidence, 3) : 0,
      rawCompositeScore: roundTo(cell.rawCompositeScore, 4),
    },
  };
}

/**
 * Performs the score for method operation for the index stage of the forecast engine, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function scoreForMethod(cell: ThresholdCellField, method: ForecastMethod, threshold: MagnitudeThreshold): number {
  if (method === "combined") return cell.rawCompositeScore;
  if (method === "poisson") return Math.log10(Math.max(1e-12, cell.backgroundAnnualRateAtThreshold));
  if (method === "etas") return Math.log10(Math.max(1e-12, cell.annualRateAtThreshold));
  if (method === "triggered") return Math.log10(Math.max(1e-12, cell.triggeredAnnualRateAtThreshold));
  if (method === "bValue") return cell.bValueAnomaly === null || cell.globalBValue <= 0 ? Number.NEGATIVE_INFINITY : cell.bValueAnomaly / cell.globalBValue;
  if (method === "naturalTime") return cell.naturalTimeProgress ?? Number.NEGATIVE_INFINITY;
  if (method === "energy") return Math.log10(Math.max(1, cell.energyRatePerYear));
  if (method === "clustering") return cell.coefficientOfVariation ?? Number.NEGATIVE_INFINITY;
  return threshold === 6 || threshold === 7
    ? cell.largeEventRecurrence[threshold].eventCount >= 3
      ? cell.largeEventRecurrence[threshold].score
      : Number.NEGATIVE_INFINITY
    : Number.NEGATIVE_INFINITY;
}

/**
 * Applies method score for the index stage of the forecast engine, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function applyMethodScore(cells: readonly ThresholdCellField[], method: ForecastMethod, threshold: MagnitudeThreshold): ThresholdCellField[] {
  if (method === "combined") return [...cells];
  return cells.map((cell) => ({ ...cell, rawCompositeScore: scoreForMethod(cell, method, threshold) }));
}

/**
 * Performs the rank field operation for the index stage of the forecast engine, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function rankField(baseCells: readonly BaseCellField[], threshold: MagnitudeThreshold, method: ForecastMethod, count: number): ThresholdCellField[] {
  const thresholdCells = applyThreshold(baseCells, threshold);
  const scoredCells = applyMethodScore(thresholdCells, method, threshold);
  const selected = selectCandidatesSpatially(scoredCells, Math.max(count, DISPLAY_SCORE_REFERENCE_COUNT), (cell) => cell.rawCompositeScore);
  return normaliseDisplayScores(selected);
}

/**
 * Calculates forecasts for the index stage of the forecast engine, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function calculateForecasts(
  events: CatalogEarthquake[],
  threshold: MagnitudeThreshold,
  nowTimestamp: number = Math.floor(Date.now() / 1_000),
  count: number = DEFAULT_FORECAST_COUNT,
  method: ForecastMethod = "combined",
): ForecastPoint[] {
  return rankField(buildField(events, nowTimestamp), threshold, method, count)
    .slice(0, count)
    .map((cell, index) => buildForecastPoint(cell, index + 1, threshold));
}

/**
 * Calculates forecasts by count for the index stage of the forecast engine, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function calculateForecastsByCount(
  events: CatalogEarthquake[],
  threshold: MagnitudeThreshold,
  counts: readonly number[],
  nowTimestamp: number = Math.floor(Date.now() / 1_000),
  method: ForecastMethod = "combined",
): Record<number, ForecastPoint[]> {
  const ranked = rankField(buildField(events, nowTimestamp), threshold, method, Math.max(...counts));
  return Object.fromEntries(counts.map((count) => [count, ranked.slice(0, count).map((cell, index) => buildForecastPoint(cell, index + 1, threshold))]));
}

/**
 * Calculates forecast matrix for the index stage of the forecast engine, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function calculateForecastMatrix<
  const Method extends ForecastMethod = ForecastMethod,
  const Threshold extends MagnitudeThreshold = MagnitudeThreshold,
  const Count extends number = SignalCount,
>(
  events: CatalogEarthquake[],
  options: {
    referenceTimestamp?: number;
    methods?: readonly Method[];
    thresholds?: readonly Threshold[];
    counts?: readonly Count[];
  } = {},
): Record<Method, Record<Threshold, Record<Count, ForecastPoint[]>>> {
  const referenceTimestamp = options.referenceTimestamp ?? Math.floor(Date.now() / 1_000);
  const methods = options.methods ?? FORECAST_METHODS as unknown as readonly Method[];
  const thresholds = options.thresholds ?? MAGNITUDE_THRESHOLDS as unknown as readonly Threshold[];
  const counts = options.counts ?? SIGNAL_COUNTS as unknown as readonly Count[];
  const maximumCount = Math.max(DISPLAY_SCORE_REFERENCE_COUNT, ...counts);
  const baseCells = buildField(events, referenceTimestamp);
  return Object.fromEntries(methods.map((method) => [method, Object.fromEntries(thresholds.map((threshold) => {
    const ranked = rankField(baseCells, threshold, method, maximumCount);
    return [threshold, Object.fromEntries(counts.map((count) => [count, ranked.slice(0, count).map((cell, index) => buildForecastPoint(cell, index + 1, threshold))]))];
  }))])) as Record<Method, Record<Threshold, Record<Count, ForecastPoint[]>>>;
}
