/**
 * @fileoverview Implements the geometry stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
// ---------------------------------------------------------------------------
// Geospatial helpers: grid projection, region containment, distance.
// ---------------------------------------------------------------------------
import {
  LATITUDE_MINIMUM,
  LATITUDE_MAXIMUM,
  LONGITUDE_MINIMUM,
  LONGITUDE_MAXIMUM,
  CELL_DEGREES,
  LATITUDE_CELL_COUNT,
  LONGITUDE_CELL_COUNT,
  TOTAL_CELL_COUNT,
  KILOMETRES_PER_DEGREE,
  DEGREES_TO_RADIANS,
} from "./config";

/**
 * Return the 0-based grid row for a given latitude.
 * Rows grow south → north.
 */
export function latitudeToRow(latitude: number): number {
  return Math.floor((latitude - LATITUDE_MINIMUM) / CELL_DEGREES);
}

/**
 * Return the 0-based grid column for a given longitude.
 * Columns grow west → east.
 */
export function longitudeToColumn(longitude: number): number {
  return Math.floor((longitude - LONGITUDE_MINIMUM) / CELL_DEGREES);
}

/**
 * The centre latitude of a grid row.
 */
export function rowToLatitude(row: number): number {
  return LATITUDE_MINIMUM + (row + 0.5) * CELL_DEGREES;
}

/**
 * The centre longitude of a grid column.
 */
export function columnToLongitude(column: number): number {
  return LONGITUDE_MINIMUM + (column + 0.5) * CELL_DEGREES;
}

/**
 * 1-D index into the cell array (row-major, cols vary fastest).
 */
export function cellIndex(row: number, column: number): number {
  return row * LONGITUDE_CELL_COUNT + column;
}

/**
 * Reverse: given a 1-D index, return [row, col].
 */
export function indexToRowCol(index: number): [number, number] {
  const row = Math.floor(index / LONGITUDE_CELL_COUNT);
  const col = index % LONGITUDE_CELL_COUNT;
  return [row, col];
}

/**
 * Check whether a point lies inside the valid grid region.
 */
export function pointInRegion(latitude: number, longitude: number): boolean {
  return (
    latitude >= LATITUDE_MINIMUM &&
    latitude < LATITUDE_MAXIMUM &&
    longitude >= LONGITUDE_MINIMUM &&
    longitude < LONGITUDE_MAXIMUM
  );
}

/**
 * Check whether a grid cell (row, col) is valid.
 */
export function cellInGrid(row: number, column: number): boolean {
  return (
    row >= 0 &&
    row < LATITUDE_CELL_COUNT &&
    column >= 0 &&
    column < LONGITUDE_CELL_COUNT
  );
}

/**
 * Haversine great-circle distance between two lat/lon points (in km).
 */
export function haversineDistanceKm(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const deltaLatitude = (latitude2 - latitude1) * DEGREES_TO_RADIANS;
  const deltaLongitude = (longitude2 - longitude1) * DEGREES_TO_RADIANS;
  const sineDeltaLatitude = Math.sin(deltaLatitude / 2);
  const sineDeltaLongitude = Math.sin(deltaLongitude / 2);
  const a =
    sineDeltaLatitude * sineDeltaLatitude +
    Math.cos(latitude1 * DEGREES_TO_RADIANS) *
      Math.cos(latitude2 * DEGREES_TO_RADIANS) *
      sineDeltaLongitude *
      sineDeltaLongitude;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return KILOMETRES_PER_DEGREE * (c / DEGREES_TO_RADIANS);
}

/**
 * Fast approximate distance using a flat-Earth formula, accurate for
 * regional-scale distances (< 500 km).  Avoids trig calls.
 *
 *   dx_km = Δlon_deg * cos(lat_rad) * KM_PER_DEG
 *   dy_km = Δlat_deg * KM_PER_DEG
 *
 * @param cosineLatitude Precomputed cos(latitude_center * DEG_TO_RAD) for the reference latitude.
 */
export function flatDistanceKm(
  deltaLatitude: number,
  deltaLongitude: number,
  cosineLatitude: number,
): number {
  const deltaXKm = deltaLongitude * KILOMETRES_PER_DEGREE * cosineLatitude;
  const deltaYKm = deltaLatitude * KILOMETRES_PER_DEGREE;
  return Math.hypot(deltaXKm, deltaYKm);
}

/**
 * Area of a grid cell (km²) at the given centre latitude.
 * Accounts for the convergence of meridians via cos(lat).
 */
export function cellAreaKm2(row: number): number {
  const centreLatitude = rowToLatitude(row);
  const cosineLatitude = Math.cos(centreLatitude * DEGREES_TO_RADIANS);
  return CELL_DEGREES * KILOMETRES_PER_DEGREE * CELL_DEGREES * KILOMETRES_PER_DEGREE * cosineLatitude;
}

/**
 * Precomputed cell areas for every row.
 */
let cachedCellAreas: Float64Array | null = null;

/**
 * Performs the precompute cell areas operation for the geometry stage of the forecast engine, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function precomputeCellAreas(): Float64Array {
  if (cachedCellAreas) return cachedCellAreas;
  cachedCellAreas = new Float64Array(LATITUDE_CELL_COUNT);
  for (let row = 0; row < LATITUDE_CELL_COUNT; row++) {
    cachedCellAreas[row] = cellAreaKm2(row);
  }
  return cachedCellAreas;
}
