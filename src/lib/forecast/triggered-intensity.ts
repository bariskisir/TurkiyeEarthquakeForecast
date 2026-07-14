/**
 * @fileoverview Implements the triggered intensity stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
// ---------------------------------------------------------------------------
// Triggered intensity: λ_trig(x, y, now)
//
// For each cell, the triggered rate is the sum over all qualifying past
// events of:
//
//   k(M_i) · g(now - t_i) · f(||cell_centre - event_i||, M_i) · A_cell
//
// This follows the standard ETAS decomposition.  We use the full spatio-
// temporal triggering kernel with:
//   - Utsu productivity (k)
//   - Omori-Utsu temporal decay with optional exponential taper (g)
//   - Power-law spatial kernel scaled by magnitude (f)
//
// Optionally, the dual-productivity scheme (α_short / α_long crossover)
// is used when DUAL_ALPHA_ENABLED is true.
//
// Like the background module, this uses bounding-box culling for performance.
// ---------------------------------------------------------------------------
import type { PreparedEvent } from "./types";
import { SECONDS_PER_DAY } from "@/lib/time";
import {
  LATITUDE_CELL_COUNT,
  LONGITUDE_CELL_COUNT,
  TOTAL_CELL_COUNT,
  CELL_DEGREES,
  LATITUDE_MINIMUM,
  LONGITUDE_MINIMUM,
  DEGREES_TO_RADIANS,
  DUAL_ALPHA_ENABLED,
  ETAS_TRIGGER_LOOKBACK_DAYS,
} from "./config";
import { flatDistanceKm } from "./geometry";
import { precomputeCellAreas } from "./geometry";
import {
  utsuProductivity,
  utsuProductivityDual,
  omoriUtsuPDF,
  spatialKernelPDF,
  characteristicRadiusSquared,
} from "./etas-kernels";

/**
 * Compute the aggregate triggered rate for every cell, given the full list
 * of all events above Mc and the current reference time.
 *
 * Returns a Float64Array of length TOTAL_CELL_COUNT with λ_trig(cell)
 * in events per day at the completeness magnitude.
 */
export function buildTriggeredIntensity(
  allEventsAboveMc: PreparedEvent[],
  completenessMagnitude: number,
  globalBValue: number,
  currentTimestamp: number,
): Float64Array {
  const cellAreas = precomputeCellAreas();
  const triggered = new Float64Array(TOTAL_CELL_COUNT);

  // Precompute cos(lat) for fast flat-Earth distance calculations
  const cosineLatitudes = new Float64Array(LATITUDE_CELL_COUNT);
  for (let row = 0; row < LATITUDE_CELL_COUNT; row++) {
    cosineLatitudes[row] = Math.cos(
      (LATITUDE_MINIMUM + (row + 0.5) * CELL_DEGREES) * DEGREES_TO_RADIANS,
    );
  }

  // Precompute characteristic radii and delta-days for every event so
  // the inner cell loop is as cheap as possible.
  const eventCount = allEventsAboveMc.length;
  const cachedCharacteristicRadiusSquared = new Float64Array(eventCount);
  const cachedDeltaDays = new Float64Array(eventCount);

  for (let eventIndex = 0; eventIndex < eventCount; eventIndex++) {
    const event = allEventsAboveMc[eventIndex];
    const deltaMAboveMc = event.magnitude - completenessMagnitude;
    cachedCharacteristicRadiusSquared[eventIndex] = characteristicRadiusSquared(deltaMAboveMc);
    cachedDeltaDays[eventIndex] = Math.max(
      0,
      (currentTimestamp - event.timestamp) / SECONDS_PER_DAY,
    );
  }

  const cellWeights = new Float64Array(TOTAL_CELL_COUNT);
  const touchedCells: number[] = [];

  for (let eventIndex = 0; eventIndex < eventCount; eventIndex++) {
    const event = allEventsAboveMc[eventIndex];
    if (cachedDeltaDays[eventIndex] > ETAS_TRIGGER_LOOKBACK_DAYS) continue;
    let productivity: number;
    if (DUAL_ALPHA_ENABLED) {
      productivity = utsuProductivityDual(
        event.magnitude,
        completenessMagnitude,
        eventCount - 1,
        eventIndex,
        globalBValue,
      );
    } else {
      productivity = utsuProductivity(event.magnitude, completenessMagnitude);
    }
    const eventRate = productivity * omoriUtsuPDF(cachedDeltaDays[eventIndex]) * event.quality;
    if (eventRate <= 0) continue;

    const characteristicSquared = cachedCharacteristicRadiusSquared[eventIndex];
    let spatialWeightTotal = 0;
    touchedCells.length = 0;

    for (let row = 0; row < LATITUDE_CELL_COUNT; row++) {
      const centreLatitude = LATITUDE_MINIMUM + (row + 0.5) * CELL_DEGREES;
      const deltaLat = centreLatitude - event.latitude;
      if (deltaLat > 3.5 || deltaLat < -3.5) continue;
      const cellArea = cellAreas[row];
      const cosineLat = cosineLatitudes[row];

      for (let col = 0; col < LONGITUDE_CELL_COUNT; col++) {
        const centreLongitude = LONGITUDE_MINIMUM + (col + 0.5) * CELL_DEGREES;
        const deltaLon = centreLongitude - event.longitude;
        if (deltaLon > 4.5 || deltaLon < -4.5) continue;
        const distanceSquared = flatDistanceKm(deltaLat, deltaLon, cosineLat) ** 2;
        const weight = Math.min(
          1,
          cellArea * spatialKernelPDF(distanceSquared, characteristicSquared),
        );
        const cellIndex = row * LONGITUDE_CELL_COUNT + col;
        cellWeights[cellIndex] = weight;
        touchedCells.push(cellIndex);
        spatialWeightTotal += weight;
      }
    }

    if (spatialWeightTotal <= 0) continue;
    for (const cellIndex of touchedCells) {
      triggered[cellIndex] += eventRate * cellWeights[cellIndex] / spatialWeightTotal;
    }
  }

  return triggered;
}
