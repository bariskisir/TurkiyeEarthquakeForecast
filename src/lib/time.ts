/**
 * @fileoverview Defines the time application service module and makes its contracts, integration responsibilities, side effects, and fallback behavior explicit to maintainers.
 */
export const SECONDS_PER_DAY = 86_400;
export const DAYS_PER_YEAR = 365.2425;
export const SECONDS_PER_YEAR = DAYS_PER_YEAR * SECONDS_PER_DAY;
export const MILLISECONDS_PER_DAY = SECONDS_PER_DAY * 1_000;
export const TURKIYE_UTC_OFFSET_HOURS = 3;

/**
 * Parses catalog utc for the time application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function parseCatalogUtc(value: string): number {
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(iso) ? iso : `${iso}Z`;
  return Math.floor(new Date(normalized).getTime() / 1000);
}

/**
 * Returns the calendar day in Türkiye's fixed UTC+3 time zone for daily cache partitioning.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function turkiyeDay(date = new Date()): string {
  return new Date(date.getTime() + TURKIYE_UTC_OFFSET_HOURS * 60 * 60 * 1_000).toISOString().slice(0, 10);
}

/**
 * Returns the whole seconds remaining until the next midnight in Türkiye (UTC+3).
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function secondsUntilNextTurkiyeDay(from = new Date()): number {
  const shifted = new Date(from.getTime() + TURKIYE_UTC_OFFSET_HOURS * 60 * 60 * 1_000);
  const nextMidnightUtc = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + 1) - TURKIYE_UTC_OFFSET_HOURS * 60 * 60 * 1_000;
  return Math.max(1, Math.floor((nextMidnightUtc - from.getTime()) / 1_000));
}

/**
 * Performs the seconds to iso operation for the time application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function secondsToIso(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000).toISOString();
}
