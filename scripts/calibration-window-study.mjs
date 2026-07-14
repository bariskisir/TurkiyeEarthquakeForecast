/**
 * @fileoverview Runs the calibration window study retrospective study while reusing production numerical primitives so offline evidence cannot silently drift from deployed behavior.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { normalizeEvent, parseRawCatalogEarthquake } from "../src/lib/catalog-domain.ts";
import { computeObservationQuality } from "../src/lib/forecast/catalog-prep.ts";
import { estimateCompletenessMagnitude } from "../src/lib/forecast/completeness.ts";
import { CELL_DEGREES as CELL_SIZE, KILOMETRES_PER_DEGREE as KM_PER_DEGREE, LATITUDE_CELL_COUNT as ROWS, LATITUDE_MAXIMUM as LAT_MAX, LATITUDE_MINIMUM as LAT_MIN, LONGITUDE_CELL_COUNT as COLS, LONGITUDE_MAXIMUM as LON_MAX, LONGITUDE_MINIMUM as LON_MIN, MAGNITUDE_BIN_WIDTH as BIN_WIDTH, TOTAL_CELL_COUNT as CELLS, gardnerKnopoffDistanceKm, gardnerKnopoffTimeDays } from "../src/lib/forecast/config.ts";
import { magnitudeToSqrtEnergy } from "../src/lib/forecast/energy.ts";
import { cellIndex, flatDistanceKm, latitudeToRow, longitudeToColumn } from "../src/lib/forecast/geometry.ts";
import { estimateGlobalBValue } from "../src/lib/forecast/gutenberg-richter.ts";
import { parseCatalogUtc } from "../src/lib/time.ts";
const WINDOWS = [3, 5, 7, 10, 15, 20, 25, 30, 40, "expanding"];
const ORIGINS = Array.from({ length: 14 }, (_, index) => 2012 + index);
const TARGETS = [4, 5, 6];
const WEIGHTS = {
  5: { b: 0.03, natural: 0.05, energy: 0.04, cv: 0.12 },
  6: { b: 0.07, natural: 0.09, energy: 0.06, cv: 0.06 },
};

/**
 * Performs the timestamp operation for the calibration window study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function timestamp(value) {
  return parseCatalogUtc(value);
}

/**
 * Performs the cell of operation for the calibration window study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function cellOf(latitude, longitude) {
  return cellIndex(latitudeToRow(latitude), longitudeToColumn(longitude));
}

/**
 * Performs the quality of operation for the calibration window study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function qualityOf(event) {
  const raw = parseRawCatalogEarthquake(event);
  const normalized = raw && normalizeEvent(raw);
  return normalized ? computeObservationQuality(normalized) : 0.1;
}

/**
 * Loads events for the calibration window study retrospective study, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function loadEvents() {
  const files = readdirSync("data").filter((name) => name.endsWith(".json")).sort();
  const events = [];
  const seen = new Set();
  for (const file of files) {
    const shard = JSON.parse(readFileSync(path.join("data", file), "utf8"));
    for (const raw of shard) {
      const year = Number(String(raw.occurred_at ?? "").slice(0, 4));
      if (year < 1970 || year > 2026) continue;
      if (!(raw.latitude >= LAT_MIN && raw.latitude < LAT_MAX && raw.longitude >= LON_MIN && raw.longitude < LON_MAX)) continue;
      const key = raw.event_id || raw.sismik_id || `${raw.occurred_at}|${raw.latitude}|${raw.longitude}|${raw.magnitude}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push({
        t: timestamp(raw.occurred_at),
        latitude: raw.latitude,
        longitude: raw.longitude,
        magnitude: raw.magnitude,
        quality: qualityOf(raw),
        cell: cellOf(raw.latitude, raw.longitude),
        background: true,
      });
    }
  }
  events.sort((left, right) => left.t - right.t);
  return events;
}

/**
 * Performs the distance km operation for the calibration window study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function distanceKm(left, right) {
  return flatDistanceKm(right.latitude - left.latitude, right.longitude - left.longitude, Math.cos(left.latitude * Math.PI / 180));
}

/**
 * Performs the window days operation for the calibration window study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function windowDays(magnitude) {
  return gardnerKnopoffTimeDays(magnitude);
}

/**
 * Performs the window distance operation for the calibration window study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function windowDistance(magnitude) {
  return gardnerKnopoffDistanceKm(magnitude);
}

/**
 * Performs the decluster operation for the calibration window study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function decluster(events) {
  const active = [];
  for (const event of events) {
    let write = 0;
    for (let index = 0; index < active.length; index++) {
      const parent = active[index];
      if (parent.t + windowDays(parent.magnitude) * 86_400 < event.t) continue;
      active[write++] = parent;
      if (event.background && parent.magnitude >= event.magnitude && distanceKm(parent, event) <= windowDistance(parent.magnitude)) event.background = false;
    }
    active.length = write;
    if (event.background) active.push(event);
  }
}

/**
 * Estimates magnitude model for the calibration window study retrospective study, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function estimateMagnitudeModel(events) {
  const magnitudes = Float64Array.from(events.map((event) => event.magnitude));
  const mc = estimateCompletenessMagnitude(magnitudes, magnitudes.length);
  const b = estimateGlobalBValue(magnitudes, magnitudes.length, mc);
  const count = events.reduce((total, event) => total + Number(event.magnitude >= mc - 1e-9), 0);
  return { mc, b, count };
}

/**
 * Builds kernel for the calibration window study retrospective study, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function buildKernel() {
  const kernel = Array.from({ length: CELLS }, () => new Float64Array(CELLS));
  for (let target = 0; target < CELLS; target++) {
    const targetRow = Math.floor(target / COLS);
    const targetCol = target % COLS;
    const targetLat = LAT_MIN + (targetRow + 0.5) * CELL_SIZE;
    for (let source = 0; source < CELLS; source++) {
      const sourceRow = Math.floor(source / COLS);
      const sourceCol = source % COLS;
      const dy = (targetRow - sourceRow) * CELL_SIZE * KM_PER_DEGREE;
      const dx = (targetCol - sourceCol) * CELL_SIZE * KM_PER_DEGREE * Math.cos(targetLat * Math.PI / 180);
      kernel[target][source] = Math.exp(-(dx * dx + dy * dy) / (2 * 25 ** 2));
    }
  }
  return kernel;
}

/**
 * Performs the add neighbourhood operation for the calibration window study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function addNeighbourhood(base, output) {
  for (let cell = 0; cell < CELLS; cell++) {
    const row = Math.floor(cell / COLS);
    const col = cell % COLS;
    let sum = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const neighbourRow = row + dr;
        const neighbourCol = col + dc;
        if (neighbourRow < 0 || neighbourRow >= ROWS || neighbourCol < 0 || neighbourCol >= COLS) continue;
        sum += base[neighbourRow * COLS + neighbourCol];
      }
    }
    output[cell] = sum;
  }
}

/**
 * Builds features for the calibration window study retrospective study, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function buildFeatures(events, start, cutoff, model, kernel) {
  const selected = events.filter((event) => event.t >= start && event.t < cutoff && event.magnitude >= model.mc - 1e-9);
  const baseCount = new Float64Array(CELLS);
  const baseMagnitudeSum = new Float64Array(CELLS);
  const baseEnergy = new Float64Array(CELLS);
  const baseRecent = new Float64Array(CELLS);
  const backgroundCount = new Float64Array(CELLS);
  const latestYear = cutoff - 365.25 * 86_400;
  for (const event of selected) {
    baseCount[event.cell]++;
    baseMagnitudeSum[event.cell] += event.magnitude;
    baseEnergy[event.cell] += magnitudeToSqrtEnergy(event.magnitude);
    if (event.t >= latestYear) baseRecent[event.cell]++;
    if (event.background) backgroundCount[event.cell] += event.quality;
  }
  const count = new Float64Array(CELLS);
  const magnitudeSum = new Float64Array(CELLS);
  const energy = new Float64Array(CELLS);
  const recent = new Float64Array(CELLS);
  addNeighbourhood(baseCount, count);
  addNeighbourhood(baseMagnitudeSum, magnitudeSum);
  addNeighbourhood(baseEnergy, energy);
  addNeighbourhood(baseRecent, recent);
  const previous = new Float64Array(CELLS);
  const gapSum = new Float64Array(CELLS);
  const gapSquared = new Float64Array(CELLS);
  const gapCount = new Float64Array(CELLS);
  const naturalCount = new Float64Array(CELLS);
  const hadTarget = new Uint8Array(CELLS);
  for (const event of selected) {
    const eventRow = Math.floor(event.cell / COLS);
    const eventCol = event.cell % COLS;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const row = eventRow + dr;
        const col = eventCol + dc;
        if (row < 0 || row >= ROWS || col < 0 || col >= COLS) continue;
        const cell = row * COLS + col;
        if (previous[cell] > 0) {
          const gap = (event.t - previous[cell]) / 86_400;
          gapSum[cell] += gap;
          gapSquared[cell] += gap * gap;
          gapCount[cell]++;
        }
        previous[cell] = event.t;
        if (event.magnitude >= 5) {
          naturalCount[cell] = 0;
          hadTarget[cell] = 1;
        } else if (event.magnitude >= 3 && hadTarget[cell]) naturalCount[cell]++;
      }
    }
  }
  const spatial = new Float64Array(CELLS);
  for (let target = 0; target < CELLS; target++) {
    let sum = 0;
    for (let source = 0; source < CELLS; source++) sum += backgroundCount[source] * kernel[target][source];
    spatial[target] = sum;
  }
  const years = (cutoff - start) / (365.25 * 86_400);
  const features = { b: new Float64Array(CELLS), natural: new Float64Array(CELLS), energy: new Float64Array(CELLS), cv: new Float64Array(CELLS), rate: new Float64Array(CELLS) };
  const localB = new Float64Array(CELLS);
  localB.fill(model.b);
  for (let cell = 0; cell < CELLS; cell++) {
    if (count[cell] >= 100) localB[cell] = Math.min(1.4, Math.max(0.6, Math.LOG10E / Math.max(0.05, magnitudeSum[cell] / count[cell] - (model.mc - BIN_WIDTH / 2))));
    features.b[cell] = Math.max(0, model.b - localB[cell]) / model.b;
    features.energy[cell] = Math.tanh((energy[cell] / years) / 1e9);
    if (gapCount[cell] >= 3) {
      const mean = gapSum[cell] / gapCount[cell];
      const variance = (gapSquared[cell] - gapSum[cell] ** 2 / gapCount[cell]) / (gapCount[cell] - 1);
      if (mean > 0 && variance >= 0) features.cv[cell] = Math.max(0, Math.min(1, (Math.sqrt(variance) / mean - 1) / 2));
    }
    if (hadTarget[cell]) features.natural[cell] = 1 - Math.exp(-naturalCount[cell] / Math.max(1, 10 ** (model.b * 2)));
    const longRate = count[cell] / Math.max(1, years * 365.25);
    if (longRate > 0) features.rate[cell] = Math.tanh(((recent[cell] / 365.25 - longRate) / Math.sqrt(longRate / 365.25)) / 3);
  }
  return { spatial, localB, features, selectedCount: selected.length };
}

/**
 * Performs the probabilities operation for the calibration window study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function probabilities(field, model, threshold, composite = false) {
  const values = new Float64Array(CELLS);
  let sum = 0;
  const weights = WEIGHTS[threshold] ?? WEIGHTS[5];
  for (let cell = 0; cell < CELLS; cell++) {
    const gr = 10 ** (-field.localB[cell] * (threshold - model.mc));
    let value = Math.max(1e-15, field.spatial[cell] * gr);
    if (composite) {
      const adjustment = weights.b * Math.min(0.5, field.features.b[cell])
        + weights.natural * Math.max(-0.5, Math.min(0.5, field.features.natural[cell] - 0.5))
        + weights.energy * field.features.energy[cell]
        + weights.cv * field.features.cv[cell];
      value *= Math.exp(adjustment);
    }
    values[cell] = value;
    sum += value;
  }
  for (let cell = 0; cell < CELLS; cell++) values[cell] = 0.999999 * values[cell] / sum + 0.000001 / CELLS;
  return values;
}

/**
 * Performs the hybrid probabilities operation for the calibration window study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function hybridProbabilities(backgroundField, backgroundModel, indicatorField, threshold) {
  const values = new Float64Array(CELLS);
  let sum = 0;
  const weights = WEIGHTS[threshold] ?? WEIGHTS[5];
  for (let cell = 0; cell < CELLS; cell++) {
    const gr = 10 ** (-backgroundField.localB[cell] * (threshold - backgroundModel.mc));
    const adjustment = weights.b * Math.min(0.5, indicatorField.features.b[cell])
      + weights.natural * Math.max(-0.5, Math.min(0.5, indicatorField.features.natural[cell] - 0.5))
      + weights.energy * indicatorField.features.energy[cell]
      + weights.cv * indicatorField.features.cv[cell];
    const value = Math.max(1e-15, backgroundField.spatial[cell] * gr) * Math.exp(adjustment);
    values[cell] = value;
    sum += value;
  }
  for (let cell = 0; cell < CELLS; cell++) values[cell] = 0.999999 * values[cell] / sum + 0.000001 / CELLS;
  return values;
}

/**
 * Performs the auc operation for the calibration window study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function auc(scores, outcomes) {
  const values = Array.from({ length: CELLS }, (_, cell) => ({ score: scores[cell], outcome: outcomes[cell] })).sort((left, right) => left.score - right.score);
  let positiveCount = 0;
  let rankSum = 0;
  for (let start = 0; start < values.length;) {
    let end = start + 1;
    while (end < values.length && values[end].score === values[start].score) end++;
    const rank = (start + 1 + end) / 2;
    for (let index = start; index < end; index++) if (values[index].outcome) { positiveCount++; rankSum += rank; }
    start = end;
  }
  const negativeCount = CELLS - positiveCount;
  return positiveCount && negativeCount ? (rankSum - positiveCount * (positiveCount + 1) / 2) / (positiveCount * negativeCount) : null;
}

/**
 * Performs the sample auc operation for the calibration window study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function sampleAuc(scores, outcomes) {
  const order = Array.from({ length: scores.length }, (_, index) => index).sort((left, right) => scores[left] - scores[right]);
  let positiveCount = 0;
  let rankSum = 0;
  for (let start = 0; start < order.length;) {
    let end = start + 1;
    while (end < order.length && scores[order[end]] === scores[order[start]]) end++;
    const rank = (start + 1 + end) / 2;
    for (let index = start; index < end; index++) if (outcomes[order[index]]) { positiveCount++; rankSum += rank; }
    start = end;
  }
  const negativeCount = scores.length - positiveCount;
  return positiveCount && negativeCount ? (rankSum - positiveCount * (positiveCount + 1) / 2) / (positiveCount * negativeCount) : null;
}

/**
 * Performs the rate change study operation for the calibration window study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function rateChangeStudy(events) {
  const baselines = [3, 5, 7, 10, 15, 20];
  const recentWindows = [30, 90, 180, 365];
  const samples = { development: {}, holdout: {} };
  for (const phase of Object.keys(samples)) {
    for (const baseline of baselines) for (const recent of recentWindows) samples[phase][`${baseline}y/${recent}d`] = { scores: [], m4: [], m5: [] };
  }
  for (let year = 2012; year <= 2025; year++) {
    for (const month of [0, 3, 6, 9]) {
      const cutoff = Date.UTC(year, month, 1) / 1_000;
      const end = cutoff + 90 * 86_400;
      if (end > Date.UTC(2026, 0, 1) / 1_000) continue;
      const phase = year <= 2018 ? "development" : "holdout";
      const future = events.filter((event) => event.t >= cutoff && event.t < end);
      const outcomes4 = new Uint8Array(CELLS);
      const outcomes5 = new Uint8Array(CELLS);
      for (const event of future) {
        if (event.magnitude >= 4) outcomes4[event.cell] = 1;
        if (event.magnitude >= 5) outcomes5[event.cell] = 1;
      }
      for (const baseline of baselines) {
        const start = cutoff - baseline * 365.25 * 86_400;
        const training = events.filter((event) => event.t >= start && event.t < cutoff);
        const model = estimateMagnitudeModel(training);
        const selected = training.filter((event) => event.magnitude >= model.mc - 1e-9);
        const baseFull = new Float64Array(CELLS);
        for (const event of selected) baseFull[event.cell]++;
        const full = new Float64Array(CELLS);
        addNeighbourhood(baseFull, full);
        for (const recentDays of recentWindows) {
          const baseRecent = new Float64Array(CELLS);
          const recentStart = cutoff - recentDays * 86_400;
          for (const event of selected) if (event.t >= recentStart) baseRecent[event.cell]++;
          const recent = new Float64Array(CELLS);
          addNeighbourhood(baseRecent, recent);
          const sample = samples[phase][`${baseline}y/${recentDays}d`];
          for (let cell = 0; cell < CELLS; cell++) {
            const longRate = full[cell] / (baseline * 365.25);
            const recentRate = recent[cell] / recentDays;
            const score = longRate > 0 ? (recentRate - longRate) / Math.sqrt(longRate / recentDays) : 0;
            sample.scores.push(score);
            sample.m4.push(outcomes4[cell]);
            sample.m5.push(outcomes5[cell]);
          }
        }
      }
    }
  }
  const result = {};
  for (const phase of Object.keys(samples)) {
    result[phase] = Object.fromEntries(Object.entries(samples[phase]).map(([key, sample]) => [key, { aucM4: sampleAuc(sample.scores, sample.m4), aucM5: sampleAuc(sample.scores, sample.m5) }]));
  }
  return result;
}

/**
 * Performs the etas tail fractions operation for the calibration window study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function etasTailFractions() {
  const cutoffs = [30, 90, 180, 365, 730, 1_000];
  const sums = new Float64Array(cutoffs.length + 1);
  const steps = 200_000;
  const maxU = Math.log1p(5_000);
  for (let index = 0; index < steps; index++) {
    const u = (index + 0.5) * maxU / steps;
    const t = Math.expm1(u);
    const dt = Math.exp(u) * maxU / steps;
    const density = 2 * (1 + t / 0.05) ** -1.1 * Math.exp(-t / 100);
    const mass = density * dt;
    sums[0] += mass;
    for (let cutoffIndex = 0; cutoffIndex < cutoffs.length; cutoffIndex++) if (t > cutoffs[cutoffIndex]) sums[cutoffIndex + 1] += mass;
  }
  return Object.fromEntries(cutoffs.map((cutoff, index) => [cutoff, sums[index + 1] / sums[0]]));
}

/**
 * Performs the evaluate operation for the calibration window study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function evaluate(probability, targets) {
  let information = 0;
  for (const event of targets) information += Math.log(probability[event.cell] * CELLS);
  const sortedCells = Array.from({ length: CELLS }, (_, cell) => cell).sort((left, right) => probability[right] - probability[left]);
  const top = new Set(sortedCells.slice(0, Math.ceil(CELLS * 0.2)));
  const hitCount = targets.filter((event) => top.has(event.cell)).length;
  return { eventCount: targets.length, information, meanInformation: targets.length ? information / targets.length : null, hitRate20: targets.length ? hitCount / targets.length : null };
}

/**
 * Performs the mean operation for the calibration window study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function mean(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

/**
 * Performs the aggregate operation for the calibration window study retrospective study, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function aggregate(rows, phase) {
  const selected = rows.filter((row) => phase === "all" || (phase === "development" ? row.origin <= 2018 : row.origin >= 2019));
  const result = {};
  for (const window of WINDOWS) {
    const subset = selected.filter((row) => row.window === window);
    result[window] = {
      mc: mean(subset.map((row) => row.mc)),
      b: mean(subset.map((row) => row.b)),
      selectedEvents: mean(subset.map((row) => row.selectedEvents)),
      spatialIgM4: mean(subset.map((row) => row.spatial[4].meanInformation)),
      spatialIgM5: mean(subset.map((row) => row.spatial[5].meanInformation)),
      spatialIgM6: mean(subset.map((row) => row.spatial[6].meanInformation)),
      hitRate20M5: mean(subset.map((row) => row.spatial[5].hitRate20)),
      compositeIgM5: mean(subset.map((row) => row.composite[5].meanInformation)),
      compositeDeltaM5: mean(subset.map((row) => row.composite[5].meanInformation - row.spatial[5].meanInformation)),
      aucB: mean(subset.map((row) => row.auc.b)),
      aucNatural: mean(subset.map((row) => row.auc.natural)),
      aucEnergy: mean(subset.map((row) => row.auc.energy)),
      aucCv: mean(subset.map((row) => row.auc.cv)),
      aucRate: mean(subset.map((row) => row.auc.rate)),
    };
  }
  return result;
}

const started = Date.now();
const events = loadEvents();
decluster(events.filter((event) => event.magnitude >= 2));
const kernel = buildKernel();
const rows = [];
const hybridRows = [];
for (const origin of ORIGINS) {
  const cutoff = Date.UTC(origin, 0, 1) / 1_000;
  const end = Date.UTC(origin + 1, 0, 1) / 1_000;
  const future = events.filter((event) => event.t >= cutoff && event.t < end);
  const originFields = new Map();
  for (const window of WINDOWS) {
    const startYear = window === "expanding" ? 1990 : origin - window;
    const start = Date.UTC(startYear, 0, 1) / 1_000;
    const training = events.filter((event) => event.t >= start && event.t < cutoff);
    const model = estimateMagnitudeModel(training);
    const field = buildFeatures(events, start, cutoff, model, kernel);
    originFields.set(window, { field, model });
    const spatial = {};
    const composite = {};
    for (const threshold of TARGETS) {
      const targets = future.filter((event) => event.magnitude >= threshold);
      spatial[threshold] = evaluate(probabilities(field, model, threshold), targets);
      composite[threshold] = evaluate(probabilities(field, model, threshold, true), targets);
    }
    const outcomes = new Uint8Array(CELLS);
    for (const event of future) if (event.magnitude >= 5) outcomes[event.cell] = 1;
    rows.push({
      origin,
      window,
      mc: model.mc,
      b: model.b,
      selectedEvents: field.selectedCount,
      spatial,
      composite,
      auc: Object.fromEntries(Object.entries(field.features).map(([name, values]) => [name, auc(values, outcomes)])),
    });
  }
  const targets = future.filter((event) => event.magnitude >= 5);
  for (const backgroundWindow of [7, 10, 20]) {
    for (const indicatorWindow of [3, 5, 7, 10]) {
      const background = originFields.get(backgroundWindow);
      const indicators = originFields.get(indicatorWindow);
      hybridRows.push({
        origin,
        key: `${backgroundWindow}y-background/${indicatorWindow}y-indicators`,
        result: evaluate(hybridProbabilities(background.field, background.model, indicators.field, 5), targets),
      });
    }
  }
  process.stderr.write(`completed ${origin}\n`);
}

const currentCutoff = events.at(-1).t + 1;
const current = {};
for (const window of WINDOWS) {
  const start = window === "expanding" ? Date.UTC(1990, 0, 1) / 1_000 : currentCutoff - window * 365.25 * 86_400;
  const training = events.filter((event) => event.t >= start && event.t < currentCutoff);
  const model = estimateMagnitudeModel(training);
  current[window] = { mc: model.mc, b: model.b, eventsAboveMc: model.count };
}
const rateChange = rateChangeStudy(events);
const hybrid = {};
for (const phase of ["development", "holdout", "all"]) {
  const selected = hybridRows.filter((row) => phase === "all" || (phase === "development" ? row.origin <= 2018 : row.origin >= 2019));
  hybrid[phase] = Object.fromEntries([...new Set(selected.map((row) => row.key))].map((key) => [key, mean(selected.filter((row) => row.key === key).map((row) => row.result.meanInformation))]));
}
const holdoutAnnualM5 = ORIGINS.filter((origin) => origin >= 2019).map((origin) => {
  const annual = rows.filter((row) => row.origin === origin && [3, 5, 7, 20].includes(row.window));
  const scores = Object.fromEntries(annual.map((row) => [row.window, row.spatial[5].meanInformation]));
  return {
    origin,
    eventCount: annual[0].spatial[5].eventCount,
    windows: scores,
    sevenMinusTwenty: scores[7] - scores[20],
  };
});

const result = {
  methodology: {
    origins: `${ORIGINS[0]}-${ORIGINS.at(-1)}`,
    development: "2012-2018",
    holdout: "2019-2025",
    windows: WINDOWS,
    targetHorizon: "one year",
    spatialMetric: "mean information gain in nats/event over a uniform 0.5-degree grid",
    indicatorMetric: "cell ROC AUC for at least one M5+ event in the following year",
  },
  catalog: {
    eventsFrom1970Through2026: events.length,
    backgroundFractionAboveM2: events.filter((event) => event.magnitude >= 2 && event.background).length / events.filter((event) => event.magnitude >= 2).length,
  },
  development: aggregate(rows, "development"),
  holdout: aggregate(rows, "holdout"),
  all: aggregate(rows, "all"),
  current: {
    latestBundledEventUtc: new Date(currentCutoff * 1_000).toISOString(),
    windows: current,
  },
  rateChange,
  hybrid,
  etasTailFractionBeyondDays: etasTailFractions(),
  holdoutAnnualM5,
  elapsedSeconds: (Date.now() - started) / 1_000,
};

console.log(JSON.stringify(result, null, 2));
