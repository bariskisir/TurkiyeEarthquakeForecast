/**
 * @fileoverview Implements the seismicity indicators stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
// ---------------------------------------------------------------------------
// Seismicity indicators — catalogue-based statistical features per cell.
//
// These indicators originate from the classical ML earthquake-prediction
// literature (Asencio-Cortés et al. 2016, Wang et al. 2026, Kavianpour
// et al. 2021), the nowcasting/natural-time framework (Rundle et al. 2021,
// 2025), and the statistical evaluation papers in the articles/ corpus.
//
// All are computable from a purely catalogue-based field with no waveform
// or GNSS data.
// ---------------------------------------------------------------------------
import { clamp } from "./numeric";
import { SECONDS_PER_DAY, DAYS_PER_YEAR } from "@/lib/time";
import {
  TOTAL_CELL_COUNT,
  RATE_CHANGE_RECENT_WINDOW_DAYS,
  MINIMUM_GAPS_FOR_CV,
  NOWCAST_M_SMALL,
  NOWCAST_M_TARGET,
} from "./config";
import type { CellAccumulator } from "./types";

/**
 * Coefficient of variation for inter-event times:
 *
 *   CV = σ_Δt / μ_Δt
 *
 * Interpretation:
 *   CV < 1  → quasiperiodic (characteristic earthquake behaviour)
 *   CV = 1  → Poisson (random, memoryless)
 *   CV > 1  → clustered (aftershock sequences)
 *
 * This is a classic discriminator between different tectonic regimes
 * (Kagan & Jackson 1991, Corral 2004).
 *
 * Returns null if fewer than MINIMUM_GAPS_FOR_CV gaps are available.
 */
export function computeCoefficientOfVariation(
  interEventGapSum: number,
  interEventGapSumOfSquares: number,
  gapCount: number,
): number | null {
  if (gapCount < MINIMUM_GAPS_FOR_CV) return null;
  const meanGap = interEventGapSum / gapCount;
  if (meanGap <= 0) return null;
  const variance =
    (interEventGapSumOfSquares - (interEventGapSum * interEventGapSum) / gapCount) / (gapCount - 1);
  if (variance < 0) return null;
  return Math.sqrt(variance) / meanGap;
}

/**
 * Rate-change z-value (Habermann's β statistic).
 *
 *   z = (r_recent - r_long) / sqrt(r_long / T_recent)
 *
 * where:
 *   r_recent = N_recent / T_recent   (events/day in the recent window)
 *   r_long = N_total / T_total       (long-term rate)
 *
 * Positive z indicates accelerating seismicity; negative indicates quiescence.
 *
 * The denominator assumes Poisson variance for the recent-window rate,
 * giving a standardised statistic ~ N(0,1) under the null.
 */
export function computeRateChangeZValue(
  recentEventCount: number,
  fullEventCount: number,
  recentWindowDays: number,
  fullSpanDays: number,
): number | null {
  if (fullSpanDays <= 0 || recentWindowDays <= 0 || fullEventCount <= 0) return null;
  const longTermRate = fullEventCount / fullSpanDays;
  const recentRate = recentEventCount / recentWindowDays;
  const denominator = Math.sqrt(longTermRate / recentWindowDays);
  if (denominator <= 0) return 0;
  return (recentRate - longTermRate) / denominator;
}

/**
 * Magnitude deficit (Bath's concept): the difference between the expected
 * maximum magnitude from Gutenberg-Richter and the observed maximum.
 *
 *   ΔM = M_expected - M_observed
 *
 * where M_expected = a / b.
 *
 * A large positive deficit may indicate an "overdue" cell, though scale
 * effects and completeness issues must be considered.
 */
export function computeMagnitudeDeficit(
  expectedMaximumMagnitude: number,
  observedMaximumMagnitude: number,
  completenessMagnitude: number,
): number | null {
  if (!Number.isFinite(expectedMaximumMagnitude)) return null;
  if (observedMaximumMagnitude < completenessMagnitude) return null;
  return clamp(expectedMaximumMagnitude - observedMaximumMagnitude, -1, 5);
}

/**
 * Quality-weighted mean quality for a neighbourhood.
 */
export function computeMeanQuality(
  qualitySum: number,
  qualityCount: number,
): number {
  if (qualityCount <= 0) return 0;
  return qualitySum / qualityCount;
}
