/**
 * @fileoverview Implements the completeness stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
// ---------------------------------------------------------------------------
// Magnitude of completeness (Mc) estimation.
//
// Primary method: Maximum Curvature (MAXC) with a conservative half-bin
// correction, as used in Wiemer & Wyss (2000).
//
// Alternative: Godano & Petrillo (2023) Δa-based method (see exceedance
// probabilities article), available as a secondary estimator.
// ---------------------------------------------------------------------------
import { clamp } from "./numeric";
import {
  MAGNITUDE_BIN_WIDTH,
  MAGNITUDE_BIN_COUNT,
  COMPLETENESS_MC_MIN,
  COMPLETENESS_MC_MAX,
  COMPLETENESS_GOODNESS_OF_FIT,
} from "./config";

/**
 * Estimate the magnitude of completeness Mc using the maximum-curvature
 * method (MAXC).
 *
 * Algorithm:
 *   1. Bin all magnitudes into MAGNITUDE_BIN_COUNT bins.
 *   2. Find the bin with the highest count (the mode of the non-cumulative FMD).
 *   3. Mc = modeBin * Δm + correction, clamped to a safe range.
 *
 * The +0.2 correction accounts for the half-bin offset and is conservative,
 * ensuring we don't treat incompletely sampled bins as complete.
 */
export function estimateMcByMaximumCurvature(
  magnitudes: Float64Array,
  magnitudeCount: number,
): number {
  const binCounts = new Float64Array(MAGNITUDE_BIN_COUNT);

  for (let index = 0; index < magnitudeCount; index++) {
    const binIndex = Math.floor(magnitudes[index] / MAGNITUDE_BIN_WIDTH);
    if (binIndex >= 0 && binIndex < MAGNITUDE_BIN_COUNT) {
      binCounts[binIndex]++;
    }
  }

  let modeBinIndex = 0;
  let modeBinValue = -1;
  for (let binIndex = 0; binIndex < MAGNITUDE_BIN_COUNT; binIndex++) {
    if (binCounts[binIndex] > modeBinValue) {
      modeBinValue = binCounts[binIndex];
      modeBinIndex = binIndex;
    }
  }

  const completenessMagnitude = modeBinIndex * MAGNITUDE_BIN_WIDTH + 0.2;
  return clamp(completenessMagnitude, COMPLETENESS_MC_MIN, COMPLETENESS_MC_MAX);
}

/**
 * Estimates mc by goodness of fit for the completeness stage of the forecast engine, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function estimateMcByGoodnessOfFit(
  magnitudes: Float64Array,
  magnitudeCount: number,
): number | null {
  const binCounts = new Float64Array(MAGNITUDE_BIN_COUNT + 1);
  const cumulativeCounts = new Float64Array(MAGNITUDE_BIN_COUNT + 1);

  for (let index = 0; index < magnitudeCount; index++) {
    const binIndex = Math.round(magnitudes[index] / MAGNITUDE_BIN_WIDTH);
    if (binIndex >= 0 && binIndex < MAGNITUDE_BIN_COUNT) binCounts[binIndex]++;
  }
  for (let binIndex = MAGNITUDE_BIN_COUNT - 1; binIndex >= 0; binIndex--) {
    cumulativeCounts[binIndex] = cumulativeCounts[binIndex + 1] + binCounts[binIndex];
  }

  const minimumBin = Math.round(COMPLETENESS_MC_MIN / MAGNITUDE_BIN_WIDTH);
  const maximumBin = Math.round(COMPLETENESS_MC_MAX / MAGNITUDE_BIN_WIDTH);
  for (let trialBin = minimumBin; trialBin <= maximumBin; trialBin++) {
    const trialMagnitude = trialBin * MAGNITUDE_BIN_WIDTH;
    let magnitudeSum = 0;
    let eventCount = 0;
    for (let index = 0; index < magnitudeCount; index++) {
      if (magnitudes[index] >= trialMagnitude - 1e-9) {
        magnitudeSum += magnitudes[index];
        eventCount++;
      }
    }
    if (eventCount < 200) continue;

    const meanMagnitude = magnitudeSum / eventCount;
    const bValue = Math.LOG10E /
      Math.max(0.05, meanMagnitude - (trialMagnitude - MAGNITUDE_BIN_WIDTH / 2));
    let absoluteError = 0;
    let observedTotal = 0;
    for (let binIndex = trialBin; binIndex < MAGNITUDE_BIN_COUNT; binIndex++) {
      const observed = cumulativeCounts[binIndex];
      if (observed <= 0) break;
      const predicted = eventCount *
        10 ** (-bValue * (binIndex * MAGNITUDE_BIN_WIDTH - trialMagnitude));
      absoluteError += Math.abs(observed - predicted);
      observedTotal += observed;
    }
    if (observedTotal > 0 && 1 - absoluteError / observedTotal >= COMPLETENESS_GOODNESS_OF_FIT) {
      return trialMagnitude;
    }
  }

  return null;
}

/**
 * Estimates completeness magnitude for the completeness stage of the forecast engine, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function estimateCompletenessMagnitude(
  magnitudes: Float64Array,
  magnitudeCount: number,
): number {
  const maximumCurvature = estimateMcByMaximumCurvature(magnitudes, magnitudeCount);
  const goodnessOfFit = estimateMcByGoodnessOfFit(magnitudes, magnitudeCount);
  return goodnessOfFit === null ? maximumCurvature : Math.max(maximumCurvature, goodnessOfFit);
}

/**
 * Estimate Mc via the Godano & Petrillo (2023) Δa method.
 *
 * For each trial magnitude threshold m_th, fit the G-R line above m_th and
 * compute the change in a-value.  Mc is the first m_th where Δa(m_th)
 * exceeds min(Δa) + 0.3.
 *
 * Returns null if there are not enough events to fit the G-R relation.
 */
export function estimateMcByDeltaA(
  magnitudes: Float64Array,
  magnitudeCount: number,
): number | null {
  const uniqueSortedMagnitudes = Array.from(new Set(
    Array.from(magnitudes.slice(0, magnitudeCount)),
  )).sort((a, b) => a - b);

  if (uniqueSortedMagnitudes.length < 8) return null;

  const LOG10E = Math.LOG10E;
  const deltaAValues: number[] = [];
  let previousAValue: number | null = null;

  for (const magnitudeThreshold of uniqueSortedMagnitudes) {
    let sum = 0;
    let count = 0;
    for (let index = 0; index < magnitudeCount; index++) {
      if (magnitudes[index] >= magnitudeThreshold - 1e-9) {
        sum += magnitudes[index];
        count++;
      }
    }
    if (count < 30) {
      deltaAValues.push(Number.NaN);
      previousAValue = null;
      continue;
    }
    const meanMagnitude = sum / count;
    const bValue = clamp(
      LOG10E / Math.max(0.05, meanMagnitude - (magnitudeThreshold - MAGNITUDE_BIN_WIDTH / 2)),
      0.6,
      1.4,
    );
    const aValue = Math.log10(count) + bValue * magnitudeThreshold;

    if (previousAValue !== null) {
      deltaAValues.push(Math.abs(aValue - previousAValue));
    } else {
      deltaAValues.push(Number.NaN);
    }
    previousAValue = aValue;
  }

  const validDeltas = deltaAValues.filter((d) => Number.isFinite(d));
  if (validDeltas.length === 0) return null;
  const minimumDeltaA = Math.min(...validDeltas);
  const thresholdDeltaA = minimumDeltaA + 0.3;

  for (let index = 0; index < uniqueSortedMagnitudes.length; index++) {
    if (Number.isFinite(deltaAValues[index]) && deltaAValues[index] > thresholdDeltaA) {
      return clamp(uniqueSortedMagnitudes[index], COMPLETENESS_MC_MIN, COMPLETENESS_MC_MAX);
    }
  }

  return null;
}
