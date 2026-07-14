/**
 * @fileoverview Implements the model context stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
import type { CatalogEarthquake } from "@/lib/types";
import { SECONDS_PER_DAY, SECONDS_PER_YEAR } from "@/lib/time";
import { CALIBRATION_WINDOW_YEARS, INDICATOR_WINDOW_YEARS } from "./config";
import { prepareEvents } from "./catalog-prep";
import { estimateCompletenessMagnitude } from "./completeness";
import { declusterGardnerKnopoff } from "./declustering";
import { estimateGlobalBValue } from "./gutenberg-richter";
import { buildLargeEventRecurrenceField } from "./large-event-recurrence";
import type { LargeEventRecurrenceEstimate, PreparedEvent } from "./types";

export interface ForecastModelContext {
  rawPrepared: PreparedEvent[];
  eventsAboveMc: PreparedEvent[];
  backgroundEvents: PreparedEvent[];
  indicatorEvents: PreparedEvent[];
  largeEventRecurrence: Record<6 | 7, LargeEventRecurrenceEstimate[]>;
  completenessMagnitude: number;
  globalBValue: number;
  catalogueSpanDays: number;
  indicatorSpanDays: number;
  indicatorStartTimestamp: number;
}

/**
 * Prepares forecast model context for the model context stage of the forecast engine, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function prepareForecastModelContext(catalogueEvents: readonly CatalogEarthquake[], currentTimestamp: number): ForecastModelContext {
  const rawPrepared = prepareEvents(catalogueEvents, currentTimestamp);
  const largeEventRecurrence = buildLargeEventRecurrenceField(rawPrepared, currentTimestamp);
  const calibrationStartTimestamp = currentTimestamp - CALIBRATION_WINDOW_YEARS * SECONDS_PER_YEAR;
  let calibrationPrepared = rawPrepared.filter((event) => event.timestamp >= calibrationStartTimestamp);
  const usesRollingCalibration = calibrationPrepared.length >= 200;
  if (!usesRollingCalibration) calibrationPrepared = rawPrepared;
  const magnitudes = new Float64Array(calibrationPrepared.length);
  for (let index = 0; index < calibrationPrepared.length; index++) magnitudes[index] = calibrationPrepared[index].magnitude;
  const completenessMagnitude = estimateCompletenessMagnitude(magnitudes, magnitudes.length);
  const globalBValue = estimateGlobalBValue(magnitudes, magnitudes.length, completenessMagnitude);
  const eventsAboveMc = calibrationPrepared
    .filter((event) => event.magnitude >= completenessMagnitude - 1e-9)
    .sort((left, right) => left.timestamp - right.timestamp);
  declusterGardnerKnopoff(eventsAboveMc);
  const backgroundEvents = eventsAboveMc.filter((event) => event.isBackground);
  const indicatorStartTimestamp = currentTimestamp - INDICATOR_WINDOW_YEARS * SECONDS_PER_YEAR;
  const indicatorEvents = eventsAboveMc.filter((event) => event.timestamp >= indicatorStartTimestamp);
  const earliestTimestamp = eventsAboveMc[0]?.timestamp ?? currentTimestamp;
  const catalogueSpanDays = Math.max(1, (currentTimestamp - (usesRollingCalibration ? Math.max(calibrationStartTimestamp, earliestTimestamp) : earliestTimestamp)) / SECONDS_PER_DAY);
  const indicatorEarliestTimestamp = indicatorEvents[0]?.timestamp ?? currentTimestamp;
  const indicatorSpanDays = Math.max(1, (currentTimestamp - Math.max(indicatorStartTimestamp, indicatorEarliestTimestamp)) / SECONDS_PER_DAY);
  return {
    rawPrepared,
    eventsAboveMc,
    backgroundEvents,
    indicatorEvents,
    largeEventRecurrence,
    completenessMagnitude,
    globalBValue,
    catalogueSpanDays,
    indicatorSpanDays,
    indicatorStartTimestamp,
  };
}
