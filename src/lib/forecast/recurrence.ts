/**
 * @fileoverview Implements the recurrence stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
// ---------------------------------------------------------------------------
// Recurrence-time models used for waiting-time and occurrence-probability
// calculations.
//
// Currently supported:
//   1. Exponential (Poisson) — standard for ETAS output
//   2. Brownian Passage Time (BPT) — for characteristic-earthquake regimes
//
// The exponential model is the default because the combined background +
// triggered intensity is approximately Poisson on yearly timescales (the
// triggered component being modelled explicitly already captures clustering).
// ---------------------------------------------------------------------------
import { clamp, normalCDF } from "./numeric";

// ---------------------------------------------------------------------------
// Exponential (Poisson) recurrence
// ---------------------------------------------------------------------------

/**
 * Occurrence probability from a Poisson process over a horizon of H days
 * at a daily rate λ.
 *
 *   P(≥ 1 event in H days) = 1 - exp(-λ * H)
 */
export function poissonOccurrenceProbability(dailyRate: number, horizonDays: number): number {
  return 1 - Math.exp(-dailyRate * horizonDays);
}

/**
 * Median waiting time from an exponential distribution:
 *
 *   t_median = ln(2) / λ_annual   [years]
 */
export function poissonMedianWaitingYears(annualRate: number): number {
  if (annualRate <= 0) return 9999;
  return Math.LN2 / annualRate;
}

/**
 * Quantile waiting time from an exponential distribution:
 *
 *   t_q = -ln(1 - q) / λ_annual   [years]
 */
export function poissonQuantileWaitingYears(annualRate: number, quantile: number): number {
  if (annualRate <= 0) return 9999;
  return -Math.log(1 - quantile) / annualRate;
}

// ---------------------------------------------------------------------------
// Brownian Passage Time (BPT) recurrence
//
// The BPT distribution describes the recurrence of characteristic earthquakes
// under stochastic tectonic loading with random perturbations:
//
//   f(t) = sqrt(μ / (2π * α² * t³)) * exp(-(t - μ)² / (2 * μ * α² * t))
//
// where:
//   μ  = mean recurrence time (years)
//   α  = coefficient of variation (aperiodicity)
//
// When α << 1 the distribution is sharply peaked (quasiperiodic); when α → 1
// it approaches a power law.
// ---------------------------------------------------------------------------

/**
 * Evaluate the BPT probability density at time t (years).
 */
export function bptProbabilityDensity(
  timeYears: number,
  meanRecurrenceYears: number,
  aperiodicityCV: number,
): number {
  if (timeYears <= 0 || meanRecurrenceYears <= 0 || aperiodicityCV <= 0) return 0;
  const alpha2 = aperiodicityCV * aperiodicityCV;
  const exponentNumerator = -((timeYears - meanRecurrenceYears) ** 2);
  const exponentDenominator = 2 * meanRecurrenceYears * alpha2 * timeYears;
  return (
    Math.sqrt(meanRecurrenceYears / (2 * Math.PI * alpha2 * timeYears ** 3)) *
    Math.exp(exponentNumerator / exponentDenominator)
  );
}

/**
 * BPT cumulative distribution function (CDF):
 *
 *   F(t) = Φ(u₁) + exp(2/α²) · Φ(−u₂)
 *   u₁ = (√(t/μ) − √(μ/t)) / α
 *   u₂ = (√(t/μ) + √(μ/t)) / α
 *
 * where Φ is the standard normal CDF.
 *
 * This is the correct form for the BPT (inverse-Gaussian) distribution.
 */
export function bptCumulativeDistribution(
  timeYears: number,
  meanRecurrenceYears: number,
  aperiodicityCV: number,
): number {
  if (timeYears <= 0 || meanRecurrenceYears <= 0 || aperiodicityCV <= 0) return 0;
  const ratio = timeYears / meanRecurrenceYears;
  const sqrtRatio = Math.sqrt(ratio);
  const firstArgument = (sqrtRatio - 1 / sqrtRatio) / aperiodicityCV;
  const secondArgument = -(sqrtRatio + 1 / sqrtRatio) / aperiodicityCV;
  return clamp(
    normalCDF(firstArgument) + Math.exp(2 / (aperiodicityCV * aperiodicityCV)) * normalCDF(secondArgument),
    0,
    1,
  );
}

/**
 * Performs the bpt conditional occurrence probability operation for the recurrence stage of the forecast engine, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function bptConditionalOccurrenceProbability(
  elapsedYears: number,
  horizonYears: number,
  meanRecurrenceYears: number,
  aperiodicityCV: number,
): number {
  if (elapsedYears < 0 || horizonYears <= 0 || meanRecurrenceYears <= 0 || aperiodicityCV <= 0) return 0;
  const before = bptCumulativeDistribution(elapsedYears, meanRecurrenceYears, aperiodicityCV);
  const after = bptCumulativeDistribution(elapsedYears + horizonYears, meanRecurrenceYears, aperiodicityCV);
  const survival = 1 - before;
  if (survival <= 1e-7) {
    return 1 - Math.exp(-horizonYears / (2 * meanRecurrenceYears * aperiodicityCV * aperiodicityCV));
  }
  return clamp((after - before) / survival, 0, 1);
}
