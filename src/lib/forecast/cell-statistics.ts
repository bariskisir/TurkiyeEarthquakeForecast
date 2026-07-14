/**
 * @fileoverview Implements the cell statistics stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
import { SECONDS_PER_DAY, SECONDS_PER_YEAR } from "@/lib/time";
import {
  CENTROID_DECAY_SECONDS,
  LATITUDE_CELL_COUNT,
  LONGITUDE_CELL_COUNT,
  NOWCAST_M_SMALL,
  NOWCAST_M_TARGET,
  RATE_CHANGE_RECENT_WINDOW_DAYS,
  TOTAL_CELL_COUNT,
} from "./config";
import { magnitudeToSqrtEnergy } from "./energy";
import { cellInGrid, cellIndex, latitudeToRow, longitudeToColumn } from "./geometry";
import type { CellAccumulator, PreparedEvent } from "./types";

export interface NeighbourhoodStatistics {
  qualityWeightedCount: Float64Array;
  simpleCount: Float64Array;
  qualitySum: Float64Array;
  qualityCount: Float64Array;
  lastTimestamp: Float64Array;
  lastMagnitude: Float64Array;
  latitudeWeighted: Float64Array;
  longitudeWeighted: Float64Array;
  centroidWeight: Float64Array;
  magnitudeSum: Float64Array;
  magnitudeCount: Float64Array;
  recentEventCount: Float64Array;
  fullEventCount: Float64Array;
  sqrtEnergySum: Float64Array;
  interEventGapSum: Float64Array;
  interEventGapSumOfSquares: Float64Array;
  interEventGapCount: Float64Array;
  previousEventTimestamp: Float64Array;
  naturalTimeSmallCount: Float64Array;
  hadTargetEvent: Uint8Array;
}

/**
 * Performs the empty accumulator operation for the cell statistics stage of the forecast engine, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function emptyAccumulator(): CellAccumulator {
  return {
    latitudeWeighted: 0,
    longitudeWeighted: 0,
    centroidWeight: 0,
    magnitudeSum: 0,
    magnitudeCount: 0,
    qualityWeightedCount: 0,
    simpleCount: 0,
    lastEventTimestamp: 0,
    lastEventMagnitude: 0,
    sqrtEnergySum: 0,
    recentWindowEventCount: 0,
    fullWindowEventCount: 0,
  };
}

/**
 * Performs the accumulate cells operation for the cell statistics stage of the forecast engine, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function accumulateCells(
  events: readonly PreparedEvent[],
  completenessMagnitude: number,
  currentTimestamp: number,
  indicatorStartTimestamp: number,
): CellAccumulator[] {
  const accumulators = Array.from({ length: TOTAL_CELL_COUNT }, emptyAccumulator);
  const recentWindowStartTimestamp = currentTimestamp - RATE_CHANGE_RECENT_WINDOW_DAYS * SECONDS_PER_DAY;
  for (const event of events) {
    const row = latitudeToRow(event.latitude);
    const column = longitudeToColumn(event.longitude);
    if (!cellInGrid(row, column)) continue;
    const accumulator = accumulators[cellIndex(row, column)];
    const ageYears = (currentTimestamp - event.timestamp) / SECONDS_PER_YEAR;
    const centroidWeight = event.quality * 10 ** (0.3 * (event.magnitude - completenessMagnitude)) * Math.exp(-ageYears / (CENTROID_DECAY_SECONDS / SECONDS_PER_YEAR));
    accumulator.latitudeWeighted += event.latitude * centroidWeight;
    accumulator.longitudeWeighted += event.longitude * centroidWeight;
    accumulator.centroidWeight += centroidWeight;
    accumulator.magnitudeSum += event.magnitude;
    accumulator.magnitudeCount++;
    accumulator.qualityWeightedCount += event.quality;
    accumulator.simpleCount++;
    if (event.timestamp > accumulator.lastEventTimestamp) {
      accumulator.lastEventTimestamp = event.timestamp;
      accumulator.lastEventMagnitude = event.magnitude;
    }
    if (event.timestamp >= indicatorStartTimestamp) {
      accumulator.sqrtEnergySum += magnitudeToSqrtEnergy(event.magnitude);
      accumulator.fullWindowEventCount++;
      if (event.timestamp >= recentWindowStartTimestamp) accumulator.recentWindowEventCount++;
    }
  }
  return accumulators;
}

/**
 * Performs the empty neighbourhood operation for the cell statistics stage of the forecast engine, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function emptyNeighbourhood(): NeighbourhoodStatistics {
  return {
    qualityWeightedCount: new Float64Array(TOTAL_CELL_COUNT),
    simpleCount: new Float64Array(TOTAL_CELL_COUNT),
    qualitySum: new Float64Array(TOTAL_CELL_COUNT),
    qualityCount: new Float64Array(TOTAL_CELL_COUNT),
    lastTimestamp: new Float64Array(TOTAL_CELL_COUNT),
    lastMagnitude: new Float64Array(TOTAL_CELL_COUNT),
    latitudeWeighted: new Float64Array(TOTAL_CELL_COUNT),
    longitudeWeighted: new Float64Array(TOTAL_CELL_COUNT),
    centroidWeight: new Float64Array(TOTAL_CELL_COUNT),
    magnitudeSum: new Float64Array(TOTAL_CELL_COUNT),
    magnitudeCount: new Float64Array(TOTAL_CELL_COUNT),
    recentEventCount: new Float64Array(TOTAL_CELL_COUNT),
    fullEventCount: new Float64Array(TOTAL_CELL_COUNT),
    sqrtEnergySum: new Float64Array(TOTAL_CELL_COUNT),
    interEventGapSum: new Float64Array(TOTAL_CELL_COUNT),
    interEventGapSumOfSquares: new Float64Array(TOTAL_CELL_COUNT),
    interEventGapCount: new Float64Array(TOTAL_CELL_COUNT),
    previousEventTimestamp: new Float64Array(TOTAL_CELL_COUNT),
    naturalTimeSmallCount: new Float64Array(TOTAL_CELL_COUNT),
    hadTargetEvent: new Uint8Array(TOTAL_CELL_COUNT),
  };
}

/**
 * Builds neighbourhood statistics for the cell statistics stage of the forecast engine, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function buildNeighbourhoodStatistics(accumulators: readonly CellAccumulator[], indicatorEvents: readonly PreparedEvent[]): NeighbourhoodStatistics {
  const neighbourhood = emptyNeighbourhood();
  for (let row = 0; row < LATITUDE_CELL_COUNT; row++) {
    for (let column = 0; column < LONGITUDE_CELL_COUNT; column++) {
      const targetIndex = cellIndex(row, column);
      for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
        for (let columnOffset = -1; columnOffset <= 1; columnOffset++) {
          const neighbourRow = row + rowOffset;
          const neighbourColumn = column + columnOffset;
          if (!cellInGrid(neighbourRow, neighbourColumn)) continue;
          const accumulator = accumulators[cellIndex(neighbourRow, neighbourColumn)];
          neighbourhood.qualityWeightedCount[targetIndex] += accumulator.qualityWeightedCount;
          neighbourhood.simpleCount[targetIndex] += accumulator.simpleCount;
          neighbourhood.qualitySum[targetIndex] += accumulator.qualityWeightedCount;
          neighbourhood.qualityCount[targetIndex] += accumulator.simpleCount;
          neighbourhood.latitudeWeighted[targetIndex] += accumulator.latitudeWeighted;
          neighbourhood.longitudeWeighted[targetIndex] += accumulator.longitudeWeighted;
          neighbourhood.centroidWeight[targetIndex] += accumulator.centroidWeight;
          neighbourhood.magnitudeSum[targetIndex] += accumulator.magnitudeSum;
          neighbourhood.magnitudeCount[targetIndex] += accumulator.magnitudeCount;
          neighbourhood.sqrtEnergySum[targetIndex] += accumulator.sqrtEnergySum;
          neighbourhood.recentEventCount[targetIndex] += accumulator.recentWindowEventCount;
          neighbourhood.fullEventCount[targetIndex] += accumulator.fullWindowEventCount;
          if (accumulator.lastEventTimestamp > neighbourhood.lastTimestamp[targetIndex]) {
            neighbourhood.lastTimestamp[targetIndex] = accumulator.lastEventTimestamp;
            neighbourhood.lastMagnitude[targetIndex] = accumulator.lastEventMagnitude;
          }
        }
      }
    }
  }
  for (const event of indicatorEvents) {
    const eventRow = latitudeToRow(event.latitude);
    const eventColumn = longitudeToColumn(event.longitude);
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset++) {
        const row = eventRow + rowOffset;
        const column = eventColumn + columnOffset;
        if (!cellInGrid(row, column)) continue;
        const index = cellIndex(row, column);
        const previousTimestamp = neighbourhood.previousEventTimestamp[index];
        if (previousTimestamp > 0 && event.timestamp > previousTimestamp) {
          const gapDays = (event.timestamp - previousTimestamp) / SECONDS_PER_DAY;
          neighbourhood.interEventGapSum[index] += gapDays;
          neighbourhood.interEventGapSumOfSquares[index] += gapDays * gapDays;
          neighbourhood.interEventGapCount[index]++;
        }
        neighbourhood.previousEventTimestamp[index] = event.timestamp;
        if (event.magnitude >= NOWCAST_M_TARGET) {
          neighbourhood.naturalTimeSmallCount[index] = 0;
          neighbourhood.hadTargetEvent[index] = 1;
        } else if (event.magnitude >= NOWCAST_M_SMALL && neighbourhood.hadTargetEvent[index]) {
          neighbourhood.naturalTimeSmallCount[index]++;
        }
      }
    }
  }
  return neighbourhood;
}

/**
 * Builds historical maximum magnitude for the cell statistics stage of the forecast engine, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function buildHistoricalMaximumMagnitude(events: readonly PreparedEvent[]): Float64Array {
  const maximumMagnitudes = new Float64Array(TOTAL_CELL_COUNT);
  for (const event of events) {
    const eventRow = latitudeToRow(event.latitude);
    const eventColumn = longitudeToColumn(event.longitude);
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset++) {
        const row = eventRow + rowOffset;
        const column = eventColumn + columnOffset;
        if (!cellInGrid(row, column)) continue;
        const index = cellIndex(row, column);
        if (event.magnitude > maximumMagnitudes[index]) maximumMagnitudes[index] = event.magnitude;
      }
    }
  }
  return maximumMagnitudes;
}
