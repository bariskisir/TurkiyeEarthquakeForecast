/**
 * @fileoverview Implements the large event recurrence stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
import { SECONDS_PER_YEAR } from "@/lib/time";
import {
  LARGE_EVENT_RECURRENCE_APERIODICITY_PRIOR,
  LARGE_EVENT_RECURRENCE_APERIODICITY_PRIOR_SIZE,
  LARGE_EVENT_RECURRENCE_CONFIG,
  LARGE_EVENT_RECURRENCE_HORIZON_YEARS,
  LARGE_EVENT_RECURRENCE_MINIMUM_EVENTS,
  TOTAL_CELL_COUNT,
} from "./config";
import { declusterGardnerKnopoff } from "./declustering";
import { haversineDistanceKm, indexToRowCol, rowToLatitude, columnToLongitude } from "./geometry";
import { clamp } from "./numeric";
import { bptConditionalOccurrenceProbability } from "./recurrence";
import type { LargeEventRecurrenceEstimate, PreparedEvent } from "./types";

/**
 * Performs the empty large event recurrence estimate operation for the large event recurrence stage of the forecast engine, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function emptyLargeEventRecurrenceEstimate(): LargeEventRecurrenceEstimate {
  return {
    probability30Years: null,
    meanIntervalYears: null,
    aperiodicity: null,
    yearsSinceLastEvent: null,
    eventCount: 0,
    confidence: 0,
    score: 0,
  };
}

/**
 * Performs the start timestamp operation for the large event recurrence stage of the forecast engine, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function startTimestamp(year: number): number {
  const date = new Date(0);
  date.setUTCFullYear(year, 0, 1);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime() / 1_000;
}

/**
 * Collapses sequences for the large event recurrence stage of the forecast engine, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function collapseSequences(events: PreparedEvent[], minimumGapYears: number): PreparedEvent[] {
  const collapsed: PreparedEvent[] = [];
  for (const event of events) {
    const previous = collapsed.at(-1);
    if (!previous || (event.timestamp - previous.timestamp) / SECONDS_PER_YEAR >= minimumGapYears) {
      collapsed.push(event);
    } else if (event.magnitude > previous.magnitude) {
      collapsed[collapsed.length - 1] = event;
    }
  }
  return collapsed;
}

/**
 * Estimates recurrence for the large event recurrence stage of the forecast engine, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function estimateRecurrence(events: PreparedEvent[], currentTimestamp: number): LargeEventRecurrenceEstimate {
  if (events.length < LARGE_EVENT_RECURRENCE_MINIMUM_EVENTS) return emptyLargeEventRecurrenceEstimate();
  const intervals: number[] = [];
  for (let index = 1; index < events.length; index++) {
    intervals.push((events[index].timestamp - events[index - 1].timestamp) / SECONDS_PER_YEAR);
  }
  if (intervals.length < 2) return emptyLargeEventRecurrenceEstimate();
  const meanIntervalYears = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  if (!(meanIntervalYears > 0)) return emptyLargeEventRecurrenceEstimate();
  const variance = intervals.reduce((sum, value) => sum + (value - meanIntervalYears) ** 2, 0) / (intervals.length - 1);
  const sampleAperiodicity = Math.sqrt(Math.max(0, variance)) / meanIntervalYears;
  const aperiodicity = clamp(
    (sampleAperiodicity * intervals.length + LARGE_EVENT_RECURRENCE_APERIODICITY_PRIOR * LARGE_EVENT_RECURRENCE_APERIODICITY_PRIOR_SIZE) /
      (intervals.length + LARGE_EVENT_RECURRENCE_APERIODICITY_PRIOR_SIZE),
    0.35,
    1,
  );
  const yearsSinceLastEvent = Math.max(0, (currentTimestamp - events.at(-1)!.timestamp) / SECONDS_PER_YEAR);
  const meanQuality = events.reduce((sum, event) => sum + event.quality, 0) / events.length;
  const confidence = clamp(intervals.length / 6, 0, 1) * (0.5 + 0.5 * meanQuality);
  const bptProbability = bptConditionalOccurrenceProbability(
    yearsSinceLastEvent,
    LARGE_EVENT_RECURRENCE_HORIZON_YEARS,
    meanIntervalYears,
    aperiodicity,
  );
  const poissonProbability = 1 - Math.exp(-LARGE_EVENT_RECURRENCE_HORIZON_YEARS / meanIntervalYears);
  const probability30Years = clamp(confidence * bptProbability + (1 - confidence) * poissonProbability, 0, 1);
  return {
    probability30Years,
    meanIntervalYears,
    aperiodicity,
    yearsSinceLastEvent,
    eventCount: events.length,
    confidence,
    score: probability30Years * (0.5 + 0.5 * confidence),
  };
}

/**
 * Builds large event recurrence field for the large event recurrence stage of the forecast engine, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function buildLargeEventRecurrenceField(
  preparedEvents: PreparedEvent[],
  currentTimestamp: number,
): Record<6 | 7, LargeEventRecurrenceEstimate[]> {
  const largeEvents = preparedEvents
    .filter((event) => event.magnitude >= 6)
    .map((event) => ({ ...event, isBackground: true }))
    .sort((left, right) => left.timestamp - right.timestamp);
  declusterGardnerKnopoff(largeEvents);
  const independentEvents = largeEvents.filter((event) => event.isBackground);
  const result = {
    6: Array.from({ length: TOTAL_CELL_COUNT }, emptyLargeEventRecurrenceEstimate),
    7: Array.from({ length: TOTAL_CELL_COUNT }, emptyLargeEventRecurrenceEstimate),
  } satisfies Record<6 | 7, LargeEventRecurrenceEstimate[]>;

  for (const threshold of [6, 7] as const) {
    const config = LARGE_EVENT_RECURRENCE_CONFIG[threshold];
    const candidates = independentEvents.filter(
      (event) => event.magnitude >= threshold && event.timestamp >= startTimestamp(config.startYear),
    );
    for (let index = 0; index < TOTAL_CELL_COUNT; index++) {
      const [row, column] = indexToRowCol(index);
      const latitude = rowToLatitude(row);
      const longitude = columnToLongitude(column);
      const localEvents = collapseSequences(
        candidates.filter(
          (event) => haversineDistanceKm(latitude, longitude, event.latitude, event.longitude) <= config.radiusKm,
        ),
        config.minimumSequenceGapYears,
      );
      result[threshold][index] = estimateRecurrence(localEvents, currentTimestamp);
    }
  }
  return result;
}
