/**
 * @fileoverview Defines the time application service module and makes its contracts, integration responsibilities, side effects, and fallback behavior explicit to maintainers.
 */
export const SECONDS_PER_DAY = 86_400;
export const DAYS_PER_YEAR = 365.2425;
export const SECONDS_PER_YEAR = DAYS_PER_YEAR * SECONDS_PER_DAY;
export const MILLISECONDS_PER_DAY = SECONDS_PER_DAY * 1_000;

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
 * Performs the utc hour operation for the time application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function utcHour(date = new Date()): string {
  return date.toISOString().slice(0, 13);
}

/**
 * Performs the seconds until next utc hour operation for the time application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function secondsUntilNextUtcHour(from = new Date()): number {
  const nextHour = new Date(from);
  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);
  return Math.max(1, Math.floor((nextHour.getTime() - from.getTime()) / 1000));
}

/**
 * Performs the seconds to iso operation for the time application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function secondsToIso(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000).toISOString();
}
