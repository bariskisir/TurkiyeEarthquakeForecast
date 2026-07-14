/**
 * @fileoverview Implements the diagnostics stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
// ---------------------------------------------------------------------------
// Forecast evaluation and diagnostics.
//
// These functions are for offline/prospective evaluation; they are not
// called during the production forecast route.  They implement standard
// CSEP-style and information-theoretic metrics.
//
// References:
//   - CSEP N-test, S-test: Schorlemmer et al. (2007, 2010, 2018)
//   - Poisson scoring / Diebold-Mariano: Brehmer et al. (2026)
//   - Brier Score / BSS: Brier (1950), exceedance_probabilities_2026
//   - Information Gain: Nandan et al. (2019), EarthquakeNPP
// ---------------------------------------------------------------------------

/**
 * Poisson log-likelihood for a forecast of expected counts.
 *
 *   LL = Σ_i [ y_i * log(λ_i) - λ_i - log(y_i!) ]
 *
 * where y_i is the observed count in cell i and λ_i is the expected count.
 * The log(y_i!) term is omitted because it is constant across models (so
 * it cancels when computing information gain).
 */
export function poissonLogLikelihood(
  observedCounts: Float64Array,
  expectedCounts: Float64Array,
  cellCount: number,
): number {
  let logLikelihood = 0;
  for (let index = 0; index < cellCount; index++) {
    const observed = observedCounts[index];
    const expected = expectedCounts[index];
    if (expected <= 0) {
      if (observed > 0) return -Infinity; // impossible observation
      continue;
    }
    logLikelihood += observed * Math.log(expected) - expected;
  }
  return logLikelihood;
}

/**
 * Information gain per event: the difference in mean log-likelihood
 * between a target model and a reference model.
 *
 *   IGPE = (LL_target - LL_reference) / N_total_observed
 *
 * Positive IGPE means the target model is better.
 */
export function informationGainPerEvent(
  targetLL: number,
  referenceLL: number,
  totalObservedEvents: number,
): number {
  if (totalObservedEvents <= 0) return 0;
  return (targetLL - referenceLL) / totalObservedEvents;
}

/**
 * Brier Score: mean squared error between probabilistic forecast f_i
 * and binary outcome o_i ∈ {0, 1}.
 *
 *   BS = (1/N) Σ (f_i - o_i)²
 *
 * Brier Skill Score: BSS = 1 - BS_model / BS_reference
 */
export function brierScore(
  forecastProbabilities: Float64Array,
  binaryOutcomes: Float64Array,
  count: number,
): number {
  if (count <= 0) return 0;
  let sumOfSquares = 0;
  for (let index = 0; index < count; index++) {
    const difference = forecastProbabilities[index] - binaryOutcomes[index];
    sumOfSquares += difference * difference;
  }
  return sumOfSquares / count;
}

/**
 * Performs the brier skill score operation for the diagnostics stage of the forecast engine, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function brierSkillScore(
  modelBrierScore: number,
  referenceBrierScore: number,
): number {
  if (referenceBrierScore <= 0) return 0;
  return 1 - modelBrierScore / referenceBrierScore;
}
