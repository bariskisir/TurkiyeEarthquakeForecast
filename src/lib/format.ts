/**
 * @fileoverview Defines the format application service module and makes its contracts, integration responsibilities, side effects, and fallback behavior explicit to maintainers.
 */
import { copy, localeSettings, type Locale } from "./i18n";
import { DAYS_PER_YEAR } from "./time";

const DAYS_PER_MONTH = 30.4369;

/**
 * Formats date time for the format application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function formatDateTime(value: string | undefined, locale: Locale, withSeconds = false): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(localeSettings[locale].dateLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
    hour12: false,
  }).format(new Date(value));
}

/**
 * Formats duration for the format application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function formatDuration(days: number, locale: Locale): string {
  if (days >= 730) return `${(days / DAYS_PER_YEAR).toFixed(1)} ${copy[locale].years}`;
  if (days >= 60) return `${(days / DAYS_PER_MONTH).toFixed(1)} ${copy[locale].months}`;
  return `${days.toFixed(1)} ${copy[locale].days}`;
}
