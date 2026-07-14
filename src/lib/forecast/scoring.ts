/**
 * @fileoverview Implements the scoring stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
// ---------------------------------------------------------------------------
// Candidate scoring: composite hazard score and display normalisation.
//
// The composite score H_cell blends the ETAS annual rate (log₁₀) with
// multiple catalogue-derived indicators, each weighted separately:
//
//   H_cell = log₁₀(λ_annual)          # base: log-annual rate at threshold
//          + w_b  * f_b(Δb)           # b-value anomaly (lower b → stress)
//          + w_nt * f_nt(progress, 0.5) # natural-time cycle progress
//          + w_en * f_en(R_E)         # energy release rate
//          + w_cv * f_cv(CV, 1)       # clustering (CV > 1)
//
// where each f_*(·) is a well-behaved, bounded function (clamped or
// tanh) that keeps the composite score stable and monotonic in the
// direction of increased hazard.
//
// After computing raw H_cell for every candidate, values are normalised
// to [SCORE_MINIMUM, SCORE_MAXIMUM] to produce the displayScore.
//
// The displayScore is a relative ranking within the current catalogue,
// NOT an occurrence probability.
// ---------------------------------------------------------------------------
import { clamp } from "./numeric";
import {
  SCORE_MINIMUM,
  SCORE_MAXIMUM,
  SCORING_WEIGHTS,
  type ScoringWeights,
} from "./config";
import type { ThresholdCellField } from "./types";
import type { MagnitudeThreshold } from "@/lib/types";

/**
 * Clamping sigmoid: maps x ∈ ℝ to [-1, 1] smoothly via tanh.
 *
 * Used for energy-rate modifiers because tanh is bounded
 * and differentiable, preventing a single extreme outlier from dominating.
 */
function boundedModifier(value: number): number {
  return Math.tanh(value);
}

/**
 * Compute the raw composite hazard score for one cell.
 *
 * All indicator functions return values in approximately [-1, 1] so the
 * total adjustment is bounded and interpretable.
 */
export function computeRawCompositeScore(
  cell: ThresholdCellField,
  weights: ScoringWeights,
  threshold: MagnitudeThreshold,
): number {
  const logAnnualRate = Math.log10(Math.max(1e-12, cell.annualRateAtThreshold));

  // Base score is the log-annual rate
  let rawScore = logAnnualRate;

  // --- magnitude feasibility ---
  // Cells whose observed Mmax is far below the threshold are penalised.
  // This is what makes M5+, M6+, M7+ show genuinely different regions.
  const magnitudeGap = Math.max(0, threshold - cell.maximumMagnitude);
  const sigmaFeasibility = 0.8;
  const feasibility = Math.exp(-(magnitudeGap * magnitudeGap) / (2 * sigmaFeasibility * sigmaFeasibility));
  rawScore += Math.log(Math.max(feasibility, 1e-6));

  // --- b-value anomaly: low b → higher stress → higher hazard ---
  // Anomaly is defined as (b_global - b_local) clamped to non-negative.
  // We normalise by b_global so the modifier is scale-free.
  if (cell.bValueAnomaly !== null && cell.globalBValue > 0) {
    const relativeAnomaly = cell.bValueAnomaly / cell.globalBValue;
    rawScore += weights.bValueAnomaly * clamp(relativeAnomaly, 0, 0.5);
  }

  // --- natural-time cycle progress above 0.5 is notable ---
  if (cell.naturalTimeProgress !== null) {
    const shift = cell.naturalTimeProgress - 0.5;
    rawScore += weights.naturalTime * clamp(shift, -0.5, 0.5);
  }

  // --- energy release rate: anomalously high energy → elevated hazard ---
  // We use tanh to bound the effect; the scale is determined by the weight alone.
  if (Number.isFinite(cell.energyRatePerYear)) {
    rawScore += weights.energyRate * boundedModifier(cell.energyRatePerYear / 1e9);
  }

  // --- coefficient of variation: CV > 1 (clustering) modestly increases hazard ---
  if (cell.coefficientOfVariation !== null) {
    const cvDeviation = (cell.coefficientOfVariation - 1) / 2;
    rawScore += weights.coefficientOfVariation * clamp(cvDeviation, 0, 1);
  }

  if (threshold === 6 || threshold === 7) {
    rawScore += weights.largeEventRecurrence * cell.largeEventRecurrence[threshold].score;
  }

  return rawScore;
}

/**
 * Normalise raw composite scores to the display range [SCORE_MINIMUM, SCORE_MAXIMUM].
 *
 * Cells with a rawScore of -Infinity (zero rate) or NaN receive SCORE_MINIMUM.
 */
export function normaliseDisplayScores(cells: readonly ThresholdCellField[]): ThresholdCellField[] {
  let minimumScore = Infinity;
  let maximumScore = -Infinity;

  for (const cell of cells) {
    if (!Number.isFinite(cell.rawCompositeScore)) continue;
    if (cell.rawCompositeScore < minimumScore) minimumScore = cell.rawCompositeScore;
    if (cell.rawCompositeScore > maximumScore) maximumScore = cell.rawCompositeScore;
  }

  const hasRange = Number.isFinite(minimumScore) && Number.isFinite(maximumScore) && maximumScore > minimumScore;

  return cells.map((cell) => {
    if (!Number.isFinite(cell.rawCompositeScore) || !hasRange) return { ...cell, displayScore: SCORE_MINIMUM };
    const relativePosition =
      (cell.rawCompositeScore - minimumScore) / (maximumScore - minimumScore);
    const displayScore = Math.round(clamp(SCORE_MINIMUM + (SCORE_MAXIMUM - SCORE_MINIMUM + 1) * relativePosition, SCORE_MINIMUM, SCORE_MAXIMUM) * 10) / 10;
    return { ...cell, displayScore };
  });
}

/**
 * Map a display score to a qualitative signal level.
 */
export type SignalLevel = "elevated" | "notable" | "high" | "very high";

/**
 * Performs the score to signal level operation for the scoring stage of the forecast engine, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function scoreToSignalLevel(score: number): SignalLevel {
  if (score >= 92) return "very high";
  if (score >= 80) return "high";
  if (score >= 65) return "notable";
  return "elevated";
}
