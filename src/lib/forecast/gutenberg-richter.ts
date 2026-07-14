/**
 * @fileoverview Implements the gutenberg richter stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
// ---------------------------------------------------------------------------
// Gutenberg-Richter analysis: b-value estimation and magnitude scaling.
//
// b-value: slope of log10(N >= M) = a - b * M.
// Estimated via the Aki-Utsu (1965) maximum-likelihood estimator:
//
//   b = log10(e) / (mean(M | M >= Mc) - (Mc - Δm/2))
//
// The a-value is obtained as:
//
//   a = log10(N_Mc) + b * Mc
//
// where N_Mc is the number of events with M >= Mc.
//
// Spatial b-value mapping is computed for local neighbourhoods using the
// same Aki-Utsu method on events above the global Mc, pooled from the
// 3×3 cell neighbourhood for stability.
// ---------------------------------------------------------------------------
import { clamp } from "./numeric";
import { LOG10_OF_E } from "./config";
import type { PreparedEvent } from "./types";
import {
  MAGNITUDE_BIN_WIDTH,
  BVALUE_MINIMUM,
  BVALUE_MAXIMUM,
  MINIMUM_EVENTS_FOR_BVALUE,
  LATITUDE_CELL_COUNT,
  LONGITUDE_CELL_COUNT,
  TOTAL_CELL_COUNT,
} from "./config";

/**
 * Estimate the global Gutenberg-Richter b-value using the Aki-Utsu (1965)
 * maximum-likelihood method.
 *
 * Uses all events (`magnitudes`) that are at least as large as `completenessMagnitude`.
 */
export function estimateGlobalBValue(
  magnitudes: Float64Array,
  magnitudeCount: number,
  completenessMagnitude: number,
): number {
  let sumAboveMc = 0;
  let countAboveMc = 0;

  for (let index = 0; index < magnitudeCount; index++) {
    if (magnitudes[index] >= completenessMagnitude - 1e-9) {
      sumAboveMc += magnitudes[index];
      countAboveMc++;
    }
  }

  if (countAboveMc < MINIMUM_EVENTS_FOR_BVALUE) return 0.9;

  const meanMagnitude = sumAboveMc / countAboveMc;
  // The Aki-Utsu correction subtracts half the bin width from Mc
  const shiftedCompleteness = completenessMagnitude - MAGNITUDE_BIN_WIDTH / 2;
  const denominator = Math.max(0.05, meanMagnitude - shiftedCompleteness);
  const bValue = LOG10_OF_E / denominator;

  return clamp(bValue, BVALUE_MINIMUM, BVALUE_MAXIMUM);
}

/**
 * Compute the G-R a-value:
 *
 *   a = log10(N_above) + b * completenessMagnitude
 */
export function computeAValue(
  eventCountAboveMc: number,
  bValue: number,
  completenessMagnitude: number,
): number {
  return Math.log10(Math.max(1, eventCountAboveMc)) + bValue * completenessMagnitude;
}

/**
 * Expected maximum magnitude from the G-R law for a given catalogue:
 *
 *   M_max_expected = a / b
 *
 * (The magnitude at which log10(N) = 0 — one event expected above this threshold.)
 */
export function expectedMaximumMagnitude(
  eventCountAboveMc: number,
  bValue: number,
  completenessMagnitude: number,
): number {
  const aValue = computeAValue(eventCountAboveMc, bValue, completenessMagnitude);
  if (bValue <= 0) return completenessMagnitude;
  return aValue / bValue;
}

/**
 * Gutenberg-Richter scaling factor from completeness magnitude Mc to
 * target threshold M_threshold:
 *
 *   scale_factor = 10^(-b * (M_threshold - Mc))
 *
 * This converts an event rate at Mc to an event rate at the threshold.
 */
export function gutenbergRichterScaleFactor(
  bValue: number,
  targetThreshold: number,
  completenessMagnitude: number,
): number {
  return 10 ** (-bValue * (targetThreshold - completenessMagnitude));
}

/**
 * Maximum magnitude observable at a cell given the global b-value and
 * the number of events above Mc in the cell's neighbourhood.
 *
 * Upper bound is clipped at 8.5 (strictly below the largest known events).
 */
export function computeUpperMagnitudeBound(
  eventCountAboveMc: number,
  bValue: number,
  completenessMagnitude: number,
): number {
  const expectedMax = expectedMaximumMagnitude(eventCountAboveMc, bValue, completenessMagnitude);
  return clamp(expectedMax, completenessMagnitude + 0.3, 8.5);
}

/**
 * Compute spatially varying b-values for every cell that has sufficient
 * data in its neighbourhood.
 *
 * For each cell, pool all events within a 1-cell-radius neighbourhood
 * (3×3 block) and estimate the b-value via the Aki-Utsu MLE.
 *
 * Returns a Float64Array of length TOTAL_CELL_COUNT where elements with
 * insufficient data are set to NaN.
 */
export function computeLocalBValues(
  neighbourhoodMagnitudeSums: Float64Array,
  neighbourhoodMagnitudeCounts: Float64Array,
  completenessMagnitude: number,
): Float64Array {
  const localBValues = new Float64Array(TOTAL_CELL_COUNT);

  for (let cellIndex = 0; cellIndex < TOTAL_CELL_COUNT; cellIndex++) {
    const count = neighbourhoodMagnitudeCounts[cellIndex];
    if (count < MINIMUM_EVENTS_FOR_BVALUE) {
      localBValues[cellIndex] = Number.NaN;
      continue;
    }
    const mean = neighbourhoodMagnitudeSums[cellIndex] / count;
    const denominator = Math.max(0.05, mean - (completenessMagnitude - MAGNITUDE_BIN_WIDTH / 2));
    const bValue = LOG10_OF_E / denominator;
    localBValues[cellIndex] = clamp(bValue, BVALUE_MINIMUM, BVALUE_MAXIMUM);
  }

  return localBValues;
}

// Re-export for downstream convenience
export {
  LATITUDE_CELL_COUNT,
  LONGITUDE_CELL_COUNT,
  TOTAL_CELL_COUNT,
};
