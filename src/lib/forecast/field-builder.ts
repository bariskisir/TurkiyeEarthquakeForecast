/**
 * @fileoverview Implements the field builder stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
import type { CatalogEarthquake, MagnitudeThreshold } from "@/lib/types";
import { DAYS_PER_YEAR, SECONDS_PER_DAY } from "@/lib/time";
import {
  TOTAL_CELL_COUNT,
  LONGITUDE_CELL_COUNT,
  RATE_CHANGE_RECENT_WINDOW_DAYS,
  SCORING_WEIGHTS,
} from "./config";
import { columnToLongitude, precomputeCellAreas, rowToLatitude } from "./geometry";
import type { BaseCellField, ThresholdCellField } from "./types";
import { computeLocalBValues, expectedMaximumMagnitude, gutenbergRichterScaleFactor } from "./gutenberg-richter";
import { buildBackgroundIntensity } from "./background-intensity";
import { buildTriggeredIntensity } from "./triggered-intensity";
import { computeCoefficientOfVariation, computeRateChangeZValue, computeMagnitudeDeficit, computeMeanQuality } from "./seismicity-indicators";
import { computeGRNormalisation, computeNaturalTimeProgress } from "./nowcasting";
import { computeRawCompositeScore } from "./scoring";
import { emptyLargeEventRecurrenceEstimate } from "./large-event-recurrence";
import { prepareForecastModelContext } from "./model-context";
import { accumulateCells, buildHistoricalMaximumMagnitude, buildNeighbourhoodStatistics } from "./cell-statistics";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates empty cell field for the field builder stage of the forecast engine, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function createEmptyCellField(cellIndex: number): BaseCellField {
  return {
    gridRow: Math.floor(cellIndex / LONGITUDE_CELL_COUNT),
    gridCol: cellIndex % LONGITUDE_CELL_COUNT,
    backgroundRatePerDay: 0,
    triggeredRatePerDay: 0,
    totalRatePerDay: 0,
    latitude: 0,
    longitude: 0,
    globalMc: 0,
    globalBValue: 0,
    localBValue: null,
    bValueAnomaly: null,
    catalogueSpanDays: 0,
    maximumMagnitude: 0,
    qualityWeightedCount: 0,
    meanQuality: 0,
    lastEventTimestamp: 0,
    lastEventMagnitude: null,
    daysSinceLastEvent: null,
    energyRatePerYear: 0,
    coefficientOfVariation: null,
    naturalTimeProgress: null,
    rateChangeZValue: null,
    magnitudeDeficit: null,
    largeEventRecurrence: {
      6: emptyLargeEventRecurrenceEstimate(),
      7: emptyLargeEventRecurrenceEstimate(),
    },
  };
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

/**
 * Builds field for the field builder stage of the forecast engine, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function buildField(
  catalogueEvents: readonly CatalogEarthquake[],
  currentTimestamp: number,
): BaseCellField[] {
  precomputeCellAreas();

  const context = prepareForecastModelContext(catalogueEvents, currentTimestamp);
  const {
    backgroundEvents,
    catalogueSpanDays,
    completenessMagnitude,
    eventsAboveMc,
    globalBValue,
    indicatorEvents,
    indicatorSpanDays,
    indicatorStartTimestamp,
    largeEventRecurrence,
    rawPrepared,
  } = context;
  const accumulators = accumulateCells(eventsAboveMc, completenessMagnitude, currentTimestamp, indicatorStartTimestamp);

  // =====================================================================
  // STAGE 4: Background intensity μ(x, y) (Pass 2)
  // =====================================================================

  const backgroundIntensity = buildBackgroundIntensity(backgroundEvents, catalogueSpanDays);

  // =====================================================================
  // STAGE 5: Triggered intensity λ_trig(x, y) (Pass 3)
  // =====================================================================

  const triggeredIntensity = buildTriggeredIntensity(
    eventsAboveMc,
    completenessMagnitude,
    globalBValue,
    currentTimestamp,
  );

  const neighbourhood = buildNeighbourhoodStatistics(accumulators, indicatorEvents);
  const historicalMaxMagnitude = buildHistoricalMaximumMagnitude(rawPrepared);

  // =====================================================================
  // STAGE 7: Local b-values for every cell that has enough neighbourhood data
  // =====================================================================

  const localBValues = computeLocalBValues(
    neighbourhood.magnitudeSum,
    neighbourhood.magnitudeCount,
    completenessMagnitude,
  );

  // =====================================================================
  // STAGE 8: Assemble CellField array (Pass 5)
  // =====================================================================

  const indicatorSpanYears = indicatorSpanDays / DAYS_PER_YEAR;
  const grNormalisation = computeGRNormalisation(globalBValue);

  const cells: BaseCellField[] = [];

  for (let idx = 0; idx < TOTAL_CELL_COUNT; idx++) {
    const cell = createEmptyCellField(idx);
    const acc = accumulators[idx];

    // Intensity components
    cell.backgroundRatePerDay = backgroundIntensity[idx];
    cell.triggeredRatePerDay = triggeredIntensity[idx];
    cell.totalRatePerDay = cell.backgroundRatePerDay + cell.triggeredRatePerDay;

    // Skip empty cells
    if (cell.totalRatePerDay <= 0 && neighbourhood.simpleCount[idx] <= 0) {
      continue;
    }
    if (neighbourhood.simpleCount[idx] <= 0) continue;

    // Centroid (neighbourhood-weighted)
    if (neighbourhood.centroidWeight[idx] > 0) {
      cell.latitude = neighbourhood.latitudeWeighted[idx] / neighbourhood.centroidWeight[idx];
      cell.longitude = neighbourhood.longitudeWeighted[idx] / neighbourhood.centroidWeight[idx];
    } else {
      cell.latitude = rowToLatitude(cell.gridRow);
      cell.longitude = columnToLongitude(cell.gridCol);
    }

    // G-R
    cell.globalMc = completenessMagnitude;
    cell.globalBValue = globalBValue;

    // Local b-value
    if (Number.isFinite(localBValues[idx])) {
      cell.localBValue = localBValues[idx];
      const anomaly = globalBValue - localBValues[idx];
      cell.bValueAnomaly = anomaly > 0 ? anomaly : null;
    }

    cell.catalogueSpanDays = catalogueSpanDays;

    // Magnitude
    cell.maximumMagnitude = historicalMaxMagnitude[idx];

    // Quality
    cell.qualityWeightedCount = neighbourhood.qualityWeightedCount[idx];
    cell.meanQuality = computeMeanQuality(
      neighbourhood.qualitySum[idx],
      neighbourhood.qualityCount[idx],
    );

    // Recency
    cell.lastEventTimestamp = neighbourhood.lastTimestamp[idx];
    if (neighbourhood.lastTimestamp[idx] > 0) {
      cell.lastEventMagnitude = neighbourhood.lastMagnitude[idx];
      cell.daysSinceLastEvent =
        (currentTimestamp - neighbourhood.lastTimestamp[idx]) / SECONDS_PER_DAY;
    }

    // --- Indicators ---

    // Energy rate
    if (indicatorSpanYears > 0 && neighbourhood.sqrtEnergySum[idx] > 0) {
      cell.energyRatePerYear = neighbourhood.sqrtEnergySum[idx] / indicatorSpanYears;
    }

    // Coefficient of variation
    cell.coefficientOfVariation = computeCoefficientOfVariation(
      neighbourhood.interEventGapSum[idx],
      neighbourhood.interEventGapSumOfSquares[idx],
      neighbourhood.interEventGapCount[idx],
    );

    // Natural-time potential
    if (neighbourhood.hadTargetEvent[idx]) {
      cell.naturalTimeProgress = computeNaturalTimeProgress(
        neighbourhood.naturalTimeSmallCount[idx],
        grNormalisation,
        neighbourhood.hadTargetEvent[idx] === 1,
      );
    }

    // Rate change z-value
    cell.rateChangeZValue = computeRateChangeZValue(
      neighbourhood.recentEventCount[idx],
      neighbourhood.fullEventCount[idx],
      RATE_CHANGE_RECENT_WINDOW_DAYS,
      indicatorSpanDays,
    );

    // Magnitude deficit
    const expectedMaxMag = expectedMaximumMagnitude(
      neighbourhood.simpleCount[idx],
      globalBValue,
      completenessMagnitude,
    );
    cell.magnitudeDeficit = computeMagnitudeDeficit(
      expectedMaxMag,
      historicalMaxMagnitude[idx],
      completenessMagnitude,
    );
    cell.largeEventRecurrence = {
      6: largeEventRecurrence[6][idx],
      7: largeEventRecurrence[7][idx],
    };

    cells.push(cell);
  }

  return cells;
}

// ---------------------------------------------------------------------------
// Apply a magnitude threshold to each cell field.
//
// This is separated from buildField so the same cached field can be reused
// for multiple thresholds (M5+, M6+, M7+) in one API call.
// ---------------------------------------------------------------------------

/**
 * Applies threshold for the field builder stage of the forecast engine, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function applyThreshold(
  cells: readonly BaseCellField[],
  threshold: MagnitudeThreshold,
): ThresholdCellField[] {
  return cells.map((cell) => {
    const effectiveScale = gutenbergRichterScaleFactor(
      cell.localBValue ?? cell.globalBValue,
      threshold,
      cell.globalMc,
    );

    const totalRatePerDay = cell.totalRatePerDay * effectiveScale;
    const bgPerDay = cell.backgroundRatePerDay * effectiveScale;
    const trigPerDay = cell.triggeredRatePerDay * effectiveScale;

    const thresholdCell: ThresholdCellField = {
      ...cell,
      threshold,
      annualRateAtThreshold: totalRatePerDay * DAYS_PER_YEAR,
      backgroundAnnualRateAtThreshold: bgPerDay * DAYS_PER_YEAR,
      triggeredAnnualRateAtThreshold: trigPerDay * DAYS_PER_YEAR,
      clusteringRatio: cell.totalRatePerDay > 0
      ? cell.triggeredRatePerDay / cell.totalRatePerDay
      : 0,
      rawCompositeScore: 0,
      displayScore: 0,
    };
    return {
      ...thresholdCell,
      rawCompositeScore: computeRawCompositeScore(thresholdCell, SCORING_WEIGHTS[threshold], threshold),
    };
  });
}
