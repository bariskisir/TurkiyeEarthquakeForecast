/**
 * @fileoverview Defines the time application service module and makes its contracts, integration responsibilities, side effects, and fallback behavior explicit to maintainers.
 */
export const SECONDS_PER_DAY = 86_400;
export const DAYS_PER_YEAR = 365.2425;
export const SECONDS_PER_YEAR = DAYS_PER_YEAR * SECONDS_PER_DAY;
export const MILLISECONDS_PER_DAY = SECONDS_PER_DAY * 1_000;
export const TURKIYE_UTC_OFFSET_HOURS = 3;
/** First year of the continuous every-year snapshot range offered in the calculation-date selector. */
export const CALCULATION_YEAR_RANGE_START = 1900;
/**
 * Snapshot year ranges below the continuous 1900..current-year range, offered by the calculation-date selector.
 *
 * Consecutive candidate years whose post-calculation analysis output (forecasts, recent earthquakes, and
 * catalogue metadata) is byte-identical share one bundled file named after the range start year, so they are merged into a
 * single "start-end" range served from the range-start bundle. Regenerate these ranges locally whenever FORECAST_MODEL bumps.
 */
export const CALCULATION_YEAR_RANGES = ["7-17", "18-19", "232-241", "242", "243-244", "327-330", "331-337", "338-339", "454-458", "459-460", "461", "462-464", "465-466", "468-478", "479-480", "489-494", "495-499", "500-501", "511-521", "522-523", "540-542", "543", "544-546", "547-550", "551-552", "668-678", "679", "680", "730-732", "733-740", "741-742", "805-815", "816-817", "837-847", "848-849", "985-986", "987-989", "990-995", "996-997", "1000-1010", "1011", "1012", "1036-1046", "1047-1058", "1059-1060", "1104", "1105-1111", "1112-1114", "1115-1116", "1126-1132", "1133-1136", "1137", "1138-1139", "1169-1179", "1180-1181", "1217-1220", "1221-1227", "1228-1229", "1244-1254", "1255-1256", "1258-1268", "1269-1270", "1309-1319", "1320-1321", "1333-1343", "1344", "1345-1350", "1351-1354", "1355-1356", "1409-1419", "1420-1421", "1447-1457", "1458-1459", "1471-1481", "1482-1483", "1493-1503", "1504-1505", "1506-1509", "1510-1513", "1514-1515", "1546-1556", "1557-1558", "1656-1660", "1661-1666", "1667-1668", "1669-1670", "1685", "1686-1688", "1689-1693", "1694-1695", "1696", "1697-1698", "1700", "1709-1714", "1715", "1716-1718", "1719", "1720-1721", "1727-1735", "1736-1737", "1738-1739", "1756-1759", "1760-1763", "1764-1766", "1767", "1768", "1774-1779", "1780-1781", "1782-1783", "1784", "1785-1789", "1790-1791", "1800", "1830-1834", "1835", "1836-1840", "1841", "1842", "1845-1850", "1851", "1852", "1853-1855", "1856-1857", "1864-1866", "1867-1868", "1869", "1870-1871", "1872-1873", "1874", "1875", "1876-1877", "1878", "1879-1881", "1882-1884", "1885-1886", "1887-1888", "1889-1891", "1892-1893", "1894", "1895-1896", "1897-1899"];

const yearPattern = /^\d{1,4}$/;
const rangePattern = /^\d{1,4}-\d{1,4}$/;
const monthPattern = /^\d{4}-\d{2}$/;
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const yearRanges = new Set<string>(CALCULATION_YEAR_RANGES);
/** Padded start years of every pre-1900 range; each is a valid standalone year option served from its own bundle. */
const rangeStartYears = new Set(CALCULATION_YEAR_RANGES.map((range) => String(Number(range.split("-")[0])).padStart(4, "0")));

/**
 * Returns the sorted snapshot year options offered by the calculation-date selector for the given calendar day.
 *
 * Pre-1900 years are exposed as merged ranges (for example "7-17" when their analyses are identical) and the continuous
 * 1900..current-year range lists every year individually. Years below 100 are never zero-padded in the labels.
 */
export function calculationDateOptions(today: string): string[] {
  const currentYear = Number(today.slice(0, 4));
  return [
    ...CALCULATION_YEAR_RANGES,
    ...Array.from({ length: currentYear - CALCULATION_YEAR_RANGE_START + 1 }, (_, index) => String(CALCULATION_YEAR_RANGE_START + index)),
  ];
}

/**
 * Normalizes a user-facing calculation-date option to the daily bundle key that stores the matching forecast snapshot.
 *
 * Only options the selector offers are accepted: the pre-1900 range labels and their start years, the continuous
 * 1900..current-year range, the current year's elapsed months, and the current calendar day. Anything else is rejected so
 * the engine never computes unrequested snapshots. Years below 100 are padded to four digits in the returned key.
 */
export function calculationDateKey(value: string, today: string): string | null {
  if (monthPattern.test(value)) {
    const [year, month] = value.split("-").map(Number);
    const currentYear = Number(today.slice(0, 4));
    return year === currentYear && month >= 1 && month <= Number(today.slice(5, 7)) ? `${value}-01` : null;
  }
  if (rangePattern.test(value)) {
    return yearRanges.has(value) ? `${String(Number(value.split("-")[0])).padStart(4, "0")}-01-01` : null;
  }
  if (yearPattern.test(value)) {
    const year = Number(value);
    const currentYear = Number(today.slice(0, 4));
    const normalized = String(year).padStart(4, "0");
    if (year >= CALCULATION_YEAR_RANGE_START && year <= currentYear) return `${normalized}-01-01`;
    return rangeStartYears.has(normalized) ? `${normalized}-01-01` : null;
  }
  if (dayPattern.test(value)) {
    return value === today ? value : null;
  }
  return null;
}

/**
 * Returns the exclusive UTC cutoff timestamp (seconds) for a historical bundle key, or null for the latest-day key.
 *
 * Year and month boundaries (day 1) cut at their start; the latest calendar day cuts at the end of its day so all known events stay included.
 */
export function calculationCutoffSeconds(key: string): number | null {
  const [year, month, day] = key.split("-").map(Number);
  const start = year >= 100 ? Date.UTC(year, month - 1, day) / 1_000 : Date.parse(`${key}T00:00:00.000Z`) / 1_000;
  return day === 1 ? start : start + SECONDS_PER_DAY;
}

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
