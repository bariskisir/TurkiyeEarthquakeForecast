/**
 * @fileoverview Implements the config stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
import type { MagnitudeThreshold } from "@/lib/types";
import { SECONDS_PER_DAY, DAYS_PER_YEAR } from "@/lib/time";

// ---------------------------------------------------------------------------
// Grid definition — 0.5° cells covering Türkiye and neighbouring regions
// ---------------------------------------------------------------------------
export const LATITUDE_MINIMUM = 34;
export const LATITUDE_MAXIMUM = 43;
export const LONGITUDE_MINIMUM = 24;
export const LONGITUDE_MAXIMUM = 46;
export const CELL_DEGREES = 0.5;

export const LATITUDE_CELL_COUNT = Math.ceil((LATITUDE_MAXIMUM - LATITUDE_MINIMUM) / CELL_DEGREES);
export const LONGITUDE_CELL_COUNT = Math.ceil((LONGITUDE_MAXIMUM - LONGITUDE_MINIMUM) / CELL_DEGREES);
export const TOTAL_CELL_COUNT = LATITUDE_CELL_COUNT * LONGITUDE_CELL_COUNT;

// ---------------------------------------------------------------------------
// Physical / geodetic constants
// ---------------------------------------------------------------------------
export const KILOMETRES_PER_DEGREE = 111.195;
export const DEGREES_TO_RADIANS = Math.PI / 180;
export const LOG10_OF_E = Math.LOG10E;

// ---------------------------------------------------------------------------
// ETAS kernel parameters
//
// These are literature defaults that can be tuned per region or per threshold.
// Sources: Ogata (1988, 1998), Zhang et al. (2020),
//          Nandan et al. (2019/2021), Muralidharan & Das (2025).
// ---------------------------------------------------------------------------

// Utsu productivity: expected number of directly triggered offspring
// k(M) = ETAS_PRODUCTIVITY_K * exp(ETAS_ALPHA * (M - Mc))
export const ETAS_PRODUCTIVITY_K = 0.15;

// Productivity magnitude sensitivity: how strongly larger events trigger more aftershocks
export const ETAS_ALPHA = 1.5;

// ---------------------------------------------------------------------------
// Dual productivity (short- vs long-term memory crossover)
// from Zhang et al. (2020) — forecasting_strong_aftershocks_italy_2020
//   α_short for recent events, α_long for older events
// ---------------------------------------------------------------------------
export const ETAS_ALPHA_SHORT_TERM = 2.0;
export const ETAS_ALPHA_LONG_TERM = 1.4;
export const DUAL_ALPHA_ENABLED = false;
// Crossover event count h parameter; recent-zone window ≈ h * 10^(-b * Mc)
export const DUAL_ALPHA_CROSSOVER_H = 2e5;

// Omori-Utsu temporal decay: g(Δt) = (p-1)/c * (1 + Δt/c)^(-p)
// Normalised PDF — integrates to 1 over (0, ∞)
export const OMORI_C_DAYS = 0.05; // onset delay (days)
export const OMORI_P = 1.1; // decay exponent (must be > 1 for convergence)

// Exponential taper that softens the Omori singularity at t → 0
// g_tapered(t) = g_omori(t) * exp(-t / ETAS_TAU_DAYS)
// Finite long-memory cut-off
export const ETAS_TAU_DAYS = 100; // exponential cut-off (days); set > 0 to enable
export const ETAS_TRIGGER_LOOKBACK_DAYS = 730;

// Spatial kernel — power-law, radially symmetric
// f(r, M) = (q-1)/(π * d(M)^2) * (1 + r^2/d(M)^2)^(-q)
// Characteristic aftershock-zone radius: d(M) = D0 * exp(γ * (M - Mc))
export const SPATIAL_Q = 1.5; // power-law spatial decay exponent
export const SPATIAL_D0_KM = 1.2; // baseline aftershock zone radius at M = Mc
export const SPATIAL_GAMMA = 0.5; // magnitude-dependent zone growth

// ---------------------------------------------------------------------------
// Background seismicity estimation
// ---------------------------------------------------------------------------

// Gaussian kernel smoothing bandwidth (km) for background μ(x, y)
// Fixed Helmstetter-Kagan style; can be replaced by adaptive-bandwidth
export const BACKGROUND_BANDWIDTH_KM = 25;
export const BACKGROUND_H_SQUARED = BACKGROUND_BANDWIDTH_KM * BACKGROUND_BANDWIDTH_KM;
// Normalisation constant for 2-D Gaussian: 1 / (2π * h^2)
export const BACKGROUND_GAUSSIAN_NORM = 1 / (2 * Math.PI * BACKGROUND_H_SQUARED);

// Centroid decay time constant — weights newer events higher
export const CENTROID_DECAY_YEARS = 15;
export const CENTROID_DECAY_SECONDS = CENTROID_DECAY_YEARS * DAYS_PER_YEAR * SECONDS_PER_DAY;

// ---------------------------------------------------------------------------
// Gutenberg-Richter analysis
// ---------------------------------------------------------------------------
export const MAGNITUDE_BIN_WIDTH = 0.1;
export const MAGNITUDE_BIN_COUNT = 100;
export const COMPLETENESS_MC_MIN = 2.0;
export const COMPLETENESS_MC_MAX = 3.2;
export const BVALUE_MINIMUM = 0.6;
export const BVALUE_MAXIMUM = 1.4;
export const MINIMUM_EVENTS_FOR_BVALUE = 100;
export const COMPLETENESS_GOODNESS_OF_FIT = 0.95;
export const CALIBRATION_WINDOW_YEARS = 10;
export const INDICATOR_WINDOW_YEARS = 5;

// ---------------------------------------------------------------------------
// Declustering — Gardner-Knopoff (1974) space-time windows
// ---------------------------------------------------------------------------
/**
 * Performs the gardner knopoff distance km operation for the config stage of the forecast engine, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function gardnerKnopoffDistanceKm(magnitude: number): number {
  return 10 ** (0.1238 * magnitude + 0.983);
}

/**
 * Performs the gardner knopoff time days operation for the config stage of the forecast engine, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function gardnerKnopoffTimeDays(magnitude: number): number {
  if (magnitude >= 6.5) {
    return 10 ** (0.032 * magnitude + 2.7389);
  }
  return 10 ** (0.5409 * magnitude - 0.547);
}

// ---------------------------------------------------------------------------
// Seismicity indicator parameters
// ---------------------------------------------------------------------------

// Time window for "recent" events in rate-change z-value computation (days)
export const RATE_CHANGE_RECENT_WINDOW_DAYS = 365;

// Minimum number of inter-event gaps required for a meaningful CV estimate
export const MINIMUM_GAPS_FOR_CV = 3;

// Natural-time cycle progress: magnitude thresholds for small and target events
// progress(n) = 1 - exp(-n / N_GR) where N_GR = 10^(b * (M_TARGET - M_SMALL))
export const NOWCAST_M_SMALL = 3.0; // small-event counting threshold
export const NOWCAST_M_TARGET = 5.0; // target-event threshold

// ---------------------------------------------------------------------------
// Seismic energy formula: log10(E) = 1.5 * M + 4.8  (Kanamori, Hanks & Kanamori 1979)
// E in Joules. sqrt-energy for indicator: √E = 10^(0.75 * M + 2.4)
// ---------------------------------------------------------------------------
export const ENERGY_EXPONENT_M = 1.5;
export const ENERGY_CONSTANT = 4.8;
export const SQRT_ENERGY_EXPONENT_M = 0.75;
export const SQRT_ENERGY_CONSTANT = 2.4;

// ---------------------------------------------------------------------------
// Scoring composite weights
//
// Threshold-dependent: M5+ emphasises clustering/aftershock signals,
// M6+ is balanced, M7+ emphasises long-term tectonic loading (b-value
// anomaly, energy accumulation, natural-time cycle progress).
// ---------------------------------------------------------------------------

export interface ScoringWeights {
  bValueAnomaly: number;
  naturalTime: number;
  energyRate: number;
  coefficientOfVariation: number;
  largeEventRecurrence: number;
}

export const SCORING_WEIGHTS: Record<MagnitudeThreshold, ScoringWeights> = {
  5: { bValueAnomaly: 0.03, naturalTime: 0.05, energyRate: 0.04, coefficientOfVariation: 0.12, largeEventRecurrence: 0 },
  6: { bValueAnomaly: 0.07, naturalTime: 0.09, energyRate: 0.06, coefficientOfVariation: 0.06, largeEventRecurrence: 0.5 },
  7: { bValueAnomaly: 0.14, naturalTime: 0.14, energyRate: 0.10, coefficientOfVariation: 0.02, largeEventRecurrence: 1 },
};

export const LARGE_EVENT_RECURRENCE_HORIZON_YEARS = 30;
export const LARGE_EVENT_RECURRENCE_CONFIG = {
  6: { startYear: 0, radiusKm: 75, minimumSequenceGapYears: 2 },
  7: { startYear: 0, radiusKm: 110, minimumSequenceGapYears: 3 },
} as const;
export const LARGE_EVENT_RECURRENCE_MINIMUM_EVENTS = 3;
export const LARGE_EVENT_RECURRENCE_APERIODICITY_PRIOR = 0.6;
export const LARGE_EVENT_RECURRENCE_APERIODICITY_PRIOR_SIZE = 3;

// Display score range
export const SCORE_MINIMUM = 40;
export const SCORE_MAXIMUM = 99;

// Spatial de-duplication: minimum cell-distance between selected candidates
export const MIN_CANDIDATE_SEPARATION_CELLS = 1.8;

// ---------------------------------------------------------------------------
// Threshold-specific parameters
// ---------------------------------------------------------------------------

export const INFLUENCE_RADIUS_KM: Record<MagnitudeThreshold, number> = {
  5: 75,
  6: 120,
  7: 180,
};

// Number of nearest-neighbours for adaptive bandwidth (Helmstetter-Kagan)
// 0 disables adaptive bandwidth and falls back to the fixed Gaussian.
export const ADAPTIVE_BANDWIDTH_NEIGHBOURS = 0;

// Default number of forecast regions to return
export const DEFAULT_FORECAST_COUNT = 50;
export const DISPLAY_SCORE_REFERENCE_COUNT = 50;
