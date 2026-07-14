/**
 * @fileoverview Implements the energy stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
// ---------------------------------------------------------------------------
// Seismic energy computations.
//
// Standard magnitude–energy relation (Hanks & Kanamori 1979, Kanamori 1977):
//
//   log₁₀(E) = 1.5 * M + 4.8    (E in Joules)
//
// POSEIDON (Kriuk 2026): physics-optimised validation confirms this as the
// standard relation most consistent with observed radiated energy.
//
// The "root energy" indicator used in ML catalog-based papers:
//
//   dE^(1/2) = (1/T) * Σ √E_i   [√Joules / unit_time]
//
// where √E_i = 10^(0.75 * M_i + 2.4).
// ---------------------------------------------------------------------------
import { ENERGY_EXPONENT_M, ENERGY_CONSTANT, SQRT_ENERGY_EXPONENT_M, SQRT_ENERGY_CONSTANT } from "./config";

/**
 * Convert magnitude to radiated seismic energy (Joules).
 *
 *   E = 10^(1.5 * M + 4.8)
 */
export function magnitudeToEnergyJoules(magnitude: number): number {
  return 10 ** (ENERGY_EXPONENT_M * magnitude + ENERGY_CONSTANT);
}

/**
 * Compute the square-root energy for one event:
 *
 *   √E = 10^(0.75 * M + 2.4)
 *
 * This is proportional to √(seismic moment) and therefore to √(slip area),
 * making it a useful linear proxy for tectonic loading in regression models.
 */
export function magnitudeToSqrtEnergy(magnitude: number): number {
  return 10 ** (SQRT_ENERGY_EXPONENT_M * magnitude + SQRT_ENERGY_CONSTANT);
}

/**
 * Compute the root-energy release rate for a region:
 *
 *   dE^(1/2) = Σ √E_i / T
 *
 * where T is the time span in years.
 */
export function sqrtEnergyRate(
  totalSqrtEnergy: number,
  timeSpanYears: number,
): number {
  if (timeSpanYears <= 0) return 0;
  return totalSqrtEnergy / timeSpanYears;
}
