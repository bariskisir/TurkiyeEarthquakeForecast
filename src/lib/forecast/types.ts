/**
 * @fileoverview Implements the types stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
// ---------------------------------------------------------------------------
// Internal types for the modular forecast engine.
// Public types (CatalogEarthquake, ForecastPoint, etc.) remain in @/lib/types.
// ---------------------------------------------------------------------------

/**
 * A single earthquake prepared for the forecast pipeline.
 * Contains parsed fields and derived properties used by subsequent stages.
 */
export interface PreparedEvent {
  /** Unix timestamp (seconds UTC) of occurrence */
  timestamp: number;
  /** Epicentre latitude in decimal degrees */
  latitude: number;
  /** Epicentre longitude in decimal degrees */
  longitude: number;
  /** Magnitude (moment magnitude, ML, or instrumentally reported) */
  magnitude: number;
  /** Observation quality weight ∈ [0.1, 1.0]; see catalog-prep.ts */
  quality: number;
  /** Whether the event is flagged as an independent background event after declustering */
  isBackground: boolean;
}

/**
 * Per-cell statistics accumulated in a single pass over the event catalogue.
 * These feed into the intensity field, indicators, and ultimately the forecast.
 */
export interface CellAccumulator {
  // --- centroid (quality + magnitude + recency weighted) ---
  latitudeWeighted: number;
  longitudeWeighted: number;
  centroidWeight: number;

  // --- magnitude statistics ---
  magnitudeSum: number;
  magnitudeCount: number;

  // --- quality-weighted event counting ---
  qualityWeightedCount: number;
  simpleCount: number;

  // --- recency (last event in cell) ---
  lastEventTimestamp: number;
  lastEventMagnitude: number;

  // --- energy accumulation (Joules) ---
  sqrtEnergySum: number;

  // --- rate change: event counts in the recent vs. full time window ---
  recentWindowEventCount: number;
  fullWindowEventCount: number;

}

export interface LargeEventRecurrenceEstimate {
  probability30Years: number | null;
  meanIntervalYears: number | null;
  aperiodicity: number | null;
  yearsSinceLastEvent: number | null;
  eventCount: number;
  confidence: number;
  score: number;
}

/**
 * The fully built per-cell field — the central data structure passed between
 * the field-builder and the scoring / selection stages.
 */
export interface BaseCellField {
  // grid position
  gridRow: number;
  gridCol: number;

  // intensity components (events per day at completeness magnitude Mc)
  backgroundRatePerDay: number;
  triggeredRatePerDay: number;
  totalRatePerDay: number;

  // centricity (weighted)
  latitude: number;
  longitude: number;

  // catalogue-global G-R parameters
  globalMc: number;
  globalBValue: number;

  // optional spatially varying b-value
  localBValue: number | null;
  bValueAnomaly: number | null; // (b_global - b_local) / b_global when positive

  // catalogue span
  catalogueSpanDays: number;

  // maximal magnitude observed in the cell + neighbourhood
  maximumMagnitude: number;

  // quality statistics
  qualityWeightedCount: number;
  meanQuality: number;

  // recency
  lastEventTimestamp: number;
  lastEventMagnitude: number | null;
  daysSinceLastEvent: number | null;

  // --- seismicity indicators ---

  /** Energy release rate: sqrt(Σ E_i) per year (J^(1/2) / yr) */
  energyRatePerYear: number;

  /** Coefficient of variation of inter-event times (> 1 = clustered, = 1 = Poisson, < 1 = quasiperiodic) */
  coefficientOfVariation: number | null;

  /** Gutenberg-Richter-normalised natural-time cycle progress ∈ [0, 1) */
  naturalTimeProgress: number | null;

  /** Rate-change z-value: positive → recent seismicity exceeds long-term mean */
  rateChangeZValue: number | null;

  /** Magnitude deficit: E[M_max | GR] - observed M_max */
  magnitudeDeficit: number | null;

  largeEventRecurrence: Record<6 | 7, LargeEventRecurrenceEstimate>;

}

export interface ThresholdCellField extends BaseCellField {
  threshold: 5 | 6 | 7;
  annualRateAtThreshold: number;
  backgroundAnnualRateAtThreshold: number;
  triggeredAnnualRateAtThreshold: number;
  clusteringRatio: number;
  rawCompositeScore: number;
  displayScore: number;
}

export type CellField = ThresholdCellField;
