/**
 * @fileoverview Implements the background intensity stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
// ---------------------------------------------------------------------------
// Background seismicity intensity: μ(x, y)
//
// The background rate at each cell centre is obtained by Gaussian kernel
// smoothing over all independent (declustered) events, weighted by
// observation quality.
//
//   μ(x_cell, y_cell) = (A_cell / (2π h²)) * Σ_j w_j * exp(-r_j² / (2 h²)) / T_calibration
//
// where:
//   A_cell    — cell area (km²)
//   h         — Gaussian bandwidth (km); BACKGROUND_BANDWIDTH_KM = 25 km
//   w_j       — observation quality of event j
//   r_j       — distance from cell centre to event j (km)
//   T_calibration — rolling complete-catalogue span (days)
//
// The result is events per cell per day at the completeness magnitude Mc.
//
// Performance: O(cells × background_events).  We use a coarse bounding-box
// filter (skip events more than ~3.5° away) to reduce the effective
// constant factor.
// ---------------------------------------------------------------------------
import type { PreparedEvent } from "./types";
import { flatDistanceKm } from "./geometry";
import { BACKGROUND_GAUSSIAN_NORM } from "./config";
import {
  LATITUDE_CELL_COUNT,
  LONGITUDE_CELL_COUNT,
  TOTAL_CELL_COUNT,
  BACKGROUND_H_SQUARED,
  CELL_DEGREES,
  LATITUDE_MINIMUM,
  LONGITUDE_MINIMUM,
  DEGREES_TO_RADIANS,
} from "./config";
import { precomputeCellAreas } from "./geometry";

/**
 * Build the background rate per cell per day over all declustered events.
 *
 * Output: a Float64Array of length TOTAL_CELL_COUNT with μ(cell) in events/day.
 */
export function buildBackgroundIntensity(
  backgroundEvents: PreparedEvent[],
  catalogueSpanDays: number,
): Float64Array {
  const cellAreas = precomputeCellAreas();
  const backgroundNorm = BACKGROUND_GAUSSIAN_NORM;
  const hSquared = BACKGROUND_H_SQUARED;
  const denominator = 2 * hSquared;

  const intensity = new Float64Array(TOTAL_CELL_COUNT);

  // Precompute cos(lat) for every row so the inner loop is fast
  const cosineLatitudes = new Float64Array(LATITUDE_CELL_COUNT);
  for (let row = 0; row < LATITUDE_CELL_COUNT; row++) {
    cosineLatitudes[row] = Math.cos(
      (LATITUDE_MINIMUM + (row + 0.5) * CELL_DEGREES) * DEGREES_TO_RADIANS,
    );
  }

  for (let row = 0; row < LATITUDE_CELL_COUNT; row++) {
    const centreLatitude = LATITUDE_MINIMUM + (row + 0.5) * CELL_DEGREES;
    const cellArea = cellAreas[row];
    const cosineLat = cosineLatitudes[row];

    for (let col = 0; col < LONGITUDE_CELL_COUNT; col++) {
      const centreLongitude = LONGITUDE_MINIMUM + (col + 0.5) * CELL_DEGREES;
      let kernelSum = 0;

      for (const event of backgroundEvents) {
        const deltaLat = centreLatitude - event.latitude;
        if (deltaLat > 3.5 || deltaLat < -3.5) continue;

        const deltaLon = centreLongitude - event.longitude;
        if (deltaLon > 4.5 || deltaLon < -4.5) continue;

        const distanceSquared = flatDistanceKm(deltaLat, deltaLon, cosineLat) ** 2;
        const weight = event.quality * Math.exp(-distanceSquared / denominator);
        kernelSum += weight;
      }

      const cellIndex = row * LONGITUDE_CELL_COUNT + col;
      // background rate = cell area * normalised kernel density / catalogue span
      intensity[cellIndex] = (cellArea * kernelSum * backgroundNorm) / catalogueSpanDays;
    }
  }

  return intensity;
}
