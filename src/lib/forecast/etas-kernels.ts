/**
 * @fileoverview Implements the etas kernels stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
// ---------------------------------------------------------------------------
// ETAS kernel functions: productivity, temporal decay, and spatial spread.
//
// These are the three separable factors in the ETAS triggering term:
//
//   λ_trig(t, x | H_t) = Σ_i k(M_i) * g(t - t_i) * f(||x - x_i||, M_i)
//
// All functions are pure, taking pre-computed delta-values so they can be
// called millions of times without memory allocations.
// ---------------------------------------------------------------------------
import { clamp } from "./numeric";
import {
  ETAS_PRODUCTIVITY_K,
  ETAS_ALPHA,
  OMORI_C_DAYS,
  OMORI_P,
  ETAS_TAU_DAYS,
  SPATIAL_Q,
  SPATIAL_D0_KM,
  SPATIAL_GAMMA,
  DUAL_ALPHA_ENABLED,
  ETAS_ALPHA_SHORT_TERM,
  ETAS_ALPHA_LONG_TERM,
  DUAL_ALPHA_CROSSOVER_H,
} from "./config";

// ---------------------------------------------------------------------------
// 1. Utsu productivity law: k(M) = K * exp(α * (M - Mc))
//
// This gives the expected number of directly-triggered offspring from an
// event of magnitude M, relative to the completeness threshold.
// ---------------------------------------------------------------------------

/**
 * Standard productivity for an event with magnitude `magnitude` and a given
 * alpha parameter, relative to the completeness magnitude `mc`.
 */
export function utsuProductivity(
  magnitude: number,
  completenessMagnitude: number,
  alpha: number = ETAS_ALPHA,
): number {
  const deltaMagnitude = magnitude - completenessMagnitude;
  return ETAS_PRODUCTIVITY_K * Math.exp(alpha * deltaMagnitude);
}

/**
 * Dual-productivity version: uses α_short for recent events, α_long for
 * older events.  The crossover is defined in config (DUAL_ALPHA_CROSSOVER_H).
 *
 * The `eventIndex` parameter should increase monotonically with time (most
 * recent events have the highest indices).  The `referenceIndex` is the
 * index of the parent event.  Events whose index exceeds (referenceIndex +
 * crossoverCount) are considered "long-term".
 *
 * Reference: Zhang et al. (2020) forecasting_strong_aftershocks_italy_2020;
 * crossover event count = h * 10^(-b * Mc).
 */
export function utsuProductivityDual(
  magnitude: number,
  completenessMagnitude: number,
  eventIndex: number,
  parentIndex: number,
  bValue: number,
): number {
  const crossoverCount = Math.round(
    DUAL_ALPHA_CROSSOVER_H * 10 ** (-bValue * completenessMagnitude),
  );
  const isRecent = eventIndex - parentIndex <= crossoverCount;
  const alpha = isRecent ? ETAS_ALPHA_SHORT_TERM : ETAS_ALPHA_LONG_TERM;
  return utsuProductivity(magnitude, completenessMagnitude, alpha);
}

// ---------------------------------------------------------------------------
// 2. Omori-Utsu temporal decay: g(Δt)
//
//   g(Δt) = (p - 1) / c * (1 + Δt / c)^(-p) * exp(-Δt / τ)   [days⁻¹]
//
// The leading factor ensures ∫₀^∞ g(s) ds = 1 (when τ = ∞), so k(M) is the
// expected total number of directly triggered offspring.
//
// With exponential taper (τ < ∞), the integral is < 1, so some offspring
// mass is "lost" to the taper.  The taper prevents the infinite explosion
// when p ≤ 1 and also accounts for the finite source-region relaxation
// through a finite long-memory cut-off.
// ---------------------------------------------------------------------------

/**
 * Evaluate the Omori-Utsu PDF at Δt days after the parent event.
 * Returns events per day.
 */
export function omoriUtsuPDF(deltaDays: number): number {
  const safeDelta = Math.max(0, deltaDays);
  let value = ((OMORI_P - 1) / OMORI_C_DAYS) * (1 + safeDelta / OMORI_C_DAYS) ** -OMORI_P;

  // Apply exponential taper (ETAS_TAU_DAYS > 0 enables the cut-off)
  if (ETAS_TAU_DAYS > 0 && ETAS_TAU_DAYS < Infinity) {
    value *= Math.exp(-safeDelta / ETAS_TAU_DAYS);
  }

  return value;
}

// ---------------------------------------------------------------------------
// 3. Spatial kernel: f(r, M)  [km⁻²]
//
//   f(r, M) = (q - 1) / (π * d(M)²) * (1 + r² / d(M)²)^(-q)
//
//   d(M) = D₀ * exp(γ * (M - Mc))   — characteristic aftershock-zone radius
//
// This is a 2-D power-law density (normalised to integrate to 1 over ℝ²
// when q > 1, which is always true with the literature values).
//
// For efficiency we take squared distance r² and precomputed d² as arguments
// so the caller can cache dScale² = (D₀ * exp(γ*(M-Mc)))².
// ---------------------------------------------------------------------------

/**
 * Precompute the squared characteristic radius d(M)² for a given magnitude
 * excess above Mc.
 */
export function characteristicRadiusSquared(deltaMAboveMc: number): number {
  const dScale = clamp(SPATIAL_D0_KM * Math.exp(SPATIAL_GAMMA * deltaMAboveMc), 1, 400);
  return dScale * dScale;
}

/**
 * Evaluate the spatial kernel density given the squared distance r² and the
 * characteristic squared radius dSquared.
 *
 * Returns probability density per km².
 */
export function spatialKernelPDF(distanceSquared: number, characteristicRadiusSquared: number): number {
  const ratio = 1 + distanceSquared / characteristicRadiusSquared;
  return ((SPATIAL_Q - 1) / (Math.PI * characteristicRadiusSquared)) * ratio ** -SPATIAL_Q;
}

/**
 * Approximate the fraction of a cell's area that falls within the spatial
 * kernel of one parent event.  Used for converting the per-km² kernel to a
 * per-cell rate.
 *
 * We approximate by multiplying the cell area by the kernel density at the
 * cell centre, clamping to [0, 1] to avoid overcounting when the kernel is
 * very sharp (small dScale).
 */
export function spatialFractionInCell(
  cellAreaKm2: number,
  distanceSquared: number,
  characteristicRadiusSquared: number,
): number {
  const density = spatialKernelPDF(distanceSquared, characteristicRadiusSquared);
  return Math.min(1, cellAreaKm2 * density);
}
