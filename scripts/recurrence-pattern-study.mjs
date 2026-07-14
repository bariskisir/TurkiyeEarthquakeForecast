/**
 * @fileoverview Runs the recurrence pattern study retrospective study while reusing production numerical primitives so offline evidence cannot silently drift from deployed behavior.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { normalizeEvent, parseRawCatalogEarthquake } from "../src/lib/catalog-domain.ts";
import { computeObservationQuality } from "../src/lib/forecast/catalog-prep.ts";
import { LARGE_EVENT_RECURRENCE_CONFIG, LARGE_EVENT_RECURRENCE_HORIZON_YEARS as HORIZON_YEARS, TOTAL_CELL_COUNT as CELL_COUNT, gardnerKnopoffDistanceKm, gardnerKnopoffTimeDays } from "../src/lib/forecast/config.ts";
import { columnToLongitude, haversineDistanceKm, indexToRowCol, rowToLatitude } from "../src/lib/forecast/geometry.ts";
import { bptConditionalOccurrenceProbability } from "../src/lib/forecast/recurrence.ts";

const CONFIG = {
  6: { ...LARGE_EVENT_RECURRENCE_CONFIG[6], gapYears: LARGE_EVENT_RECURRENCE_CONFIG[6].minimumSequenceGapYears, cutoffs: [1940, 1950, 1960, 1970, 1980, 1990] },
  7: { ...LARGE_EVENT_RECURRENCE_CONFIG[7], gapYears: LARGE_EVENT_RECURRENCE_CONFIG[7].minimumSequenceGapYears, cutoffs: [1800, 1850, 1900, 1930, 1950, 1970, 1990] },
};

/**
 * Performs the decimal year operation for the recurrence pattern study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function decimalYear(value) {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7)) || 1;
  const day = Number(value.slice(8, 10)) || 1;
  return year + (month - 1 + (day - 1) / 30.44) / 12;
}

/**
 * Performs the distance km operation for the recurrence pattern study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function distanceKm(left, right) {
  return haversineDistanceKm(left.latitude, left.longitude, right.latitude, right.longitude);
}

/**
 * Performs the observation quality operation for the recurrence pattern study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function observationQuality(event) {
  const raw = parseRawCatalogEarthquake(event);
  const normalized = raw && normalizeEvent(raw);
  return normalized ? computeObservationQuality(normalized) : 0.1;
}

/**
 * Loads events for the recurrence pattern study retrospective study, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function loadEvents() {
  const events = [];
  const seen = new Set();
  for (const file of readdirSync("data").filter((name) => name.endsWith(".json")).sort()) {
    const shard = JSON.parse(readFileSync(path.join("data", file), "utf8"));
    for (const event of shard) {
      if (!(event.magnitude >= 6 && event.latitude >= 34 && event.latitude < 43 && event.longitude >= 24 && event.longitude < 46)) continue;
      const key = event.event_id || event.sismik_id || `${event.occurred_at}|${event.latitude}|${event.longitude}|${event.magnitude}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push({
        year: decimalYear(event.occurred_at),
        latitude: event.latitude,
        longitude: event.longitude,
        magnitude: event.magnitude,
        quality: observationQuality(event),
      });
    }
  }
  return events.sort((left, right) => left.year - right.year);
}

/**
 * Performs the decluster operation for the recurrence pattern study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function decluster(events) {
  const independent = [];
  for (const event of events) {
    let aftershock = false;
    for (let index = independent.length - 1; index >= 0; index--) {
      const parent = independent[index];
      const elapsedDays = (event.year - parent.year) * 365.2425;
      const windowDays = gardnerKnopoffTimeDays(parent.magnitude);
      if (elapsedDays > windowDays) break;
      const windowKm = gardnerKnopoffDistanceKm(parent.magnitude);
      if (parent.magnitude >= event.magnitude && distanceKm(parent, event) <= windowKm) {
        aftershock = true;
        break;
      }
    }
    if (!aftershock) independent.push(event);
  }
  return independent;
}

/**
 * Performs the conditional probability operation for the recurrence pattern study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function conditionalProbability(elapsed, mean, aperiodicity) {
  return bptConditionalOccurrenceProbability(elapsed, HORIZON_YEARS, mean, aperiodicity);
}

/**
 * Collapses sequences for the recurrence pattern study retrospective study, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function collapseSequences(events, gapYears) {
  const result = [];
  for (const event of events) {
    const previous = result.at(-1);
    if (!previous || event.year - previous.year >= gapYears) result.push(event);
    else if (event.magnitude > previous.magnitude) result[result.length - 1] = event;
  }
  return result;
}

/**
 * Performs the recurrence score operation for the recurrence pattern study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function recurrenceScore(events, currentYear, gapYears) {
  const sequence = collapseSequences(events, gapYears);
  if (sequence.length < 3) return 0;
  const intervals = sequence.slice(1).map((event, index) => event.year - sequence[index].year);
  const mean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  const variance = intervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (intervals.length - 1);
  const sampleAperiodicity = Math.sqrt(Math.max(0, variance)) / mean;
  const aperiodicity = Math.max(0.35, Math.min(1, (sampleAperiodicity * intervals.length + 1.8) / (intervals.length + 3)));
  const quality = sequence.reduce((sum, event) => sum + event.quality, 0) / sequence.length;
  const confidence = Math.min(1, intervals.length / 6) * (0.5 + 0.5 * quality);
  const bpt = conditionalProbability(currentYear - sequence.at(-1).year, mean, aperiodicity);
  const poisson = 1 - Math.exp(-HORIZON_YEARS / mean);
  const probability = confidence * bpt + (1 - confidence) * poisson;
  return probability * (0.5 + 0.5 * confidence);
}

/**
 * Performs the grid cell operation for the recurrence pattern study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function gridCell(index) {
  const [row, column] = indexToRowCol(index);
  return { index, latitude: rowToLatitude(row), longitude: columnToLongitude(column) };
}

/**
 * Performs the auc operation for the recurrence pattern study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function auc(cells, positives) {
  let wins = 0;
  let pairs = 0;
  for (const positive of cells) {
    if (!positives.has(positive.index)) continue;
    for (const negative of cells) {
      if (positives.has(negative.index)) continue;
      wins += positive.score > negative.score ? 1 : positive.score === negative.score ? 0.5 : 0;
      pairs++;
    }
  }
  return pairs ? wins / pairs : null;
}

const events = decluster(loadEvents());

for (const threshold of [6, 7]) {
  const config = CONFIG[threshold];
  const rows = [];
  for (const cutoff of config.cutoffs) {
    const training = events.filter((event) => event.magnitude >= threshold && event.year >= config.startYear && event.year <= cutoff);
    const future = events.filter((event) => event.magnitude >= threshold && event.year > cutoff && event.year <= cutoff + HORIZON_YEARS);
    const cells = Array.from({ length: CELL_COUNT }, (_, index) => gridCell(index)).map((cell) => ({
      ...cell,
      score: recurrenceScore(training.filter((event) => distanceKm(cell, event) <= config.radiusKm), cutoff, config.gapYears),
    }));
    const positives = new Set();
    for (const event of future) {
      for (const cell of cells) {
        if (distanceKm(cell, event) <= config.radiusKm / 2) positives.add(cell.index);
      }
    }
    const top = [...cells].sort((left, right) => right.score - left.score).slice(0, 30);
    rows.push({
      cutoff,
      trainingEvents: training.length,
      next30YearEvents: future.length,
      estimatedCells: cells.filter((cell) => cell.score > 0).length,
      auc: auc(cells, positives),
      top30Hits: future.filter((event) => top.some((cell) => distanceKm(cell, event) <= config.radiusKm)).length,
    });
  }
  console.log(`M${threshold}+ recurrence study`);
  console.table(rows.map((row) => ({ ...row, auc: row.auc === null ? null : Number(row.auc.toFixed(3)) })));
  const evaluated = rows.filter((row) => row.auc !== null);
  console.log({
    meanAuc: Number((evaluated.reduce((sum, row) => sum + row.auc, 0) / evaluated.length).toFixed(3)),
    top30Hits: evaluated.reduce((sum, row) => sum + row.top30Hits, 0),
    futureEvents: evaluated.reduce((sum, row) => sum + row.next30YearEvents, 0),
  });
}

