/**
 * @fileoverview Defines the catalog domain application service module and makes its contracts, integration responsibilities, side effects, and fallback behavior explicit to maintainers.
 */
import { RECENT_COUNTS, RECENT_THRESHOLDS, type CatalogEarthquake, type RecentEarthquake, type RecentThreshold } from "./types";
import { parseCatalogUtc, secondsToIso } from "./time";

export interface RawSource {
  magnitude?: number | null;
}

export interface RawCatalogEarthquake {
  id?: number;
  event_id?: string;
  occurred_at?: string;
  longitude?: number;
  latitude?: number;
  magnitude?: number;
  depth_km?: number | null;
  quality?: string | null;
  source?: string | null;
  sources?: RawSource[] | null;
  is_primary?: boolean;
  sismik_id?: string | null;
  location?: string | null;
  geo_location?: string | null;
  display_location?: string | null;
}

export interface CatalogData {
  events: CatalogEarthquake[];
  recentEarthquakes: Record<RecentThreshold, RecentEarthquake[]>;
  hasUpdates: boolean;
}

export interface CatalogAccumulator {
  events: Map<string, CatalogEarthquake>;
  recentByThreshold: Record<RecentThreshold, Map<string, RecentEarthquake>>;
  hasUpdates: boolean;
}

const maximumRecentCount = Math.max(...RECENT_COUNTS);

/**
 * Narrows an unknown runtime value to a non-array object record before validators inspect its properties.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/**
 * Accepts null or string values from untrusted provider JSON and rejects every incompatible runtime type.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function nullableString(value: unknown): string | null | undefined {
  return value === null ? null : typeof value === "string" ? value : undefined;
}

/**
 * Accepts null or finite-number candidates from untrusted provider JSON and rejects incompatible runtime types.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function nullableNumber(value: unknown): number | null | undefined {
  return value === null ? null : typeof value === "number" ? value : undefined;
}

/**
 * Parses raw catalog earthquake for the catalog domain application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function parseRawCatalogEarthquake(value: unknown): RawCatalogEarthquake | null {
  const raw = record(value);
  if (!raw) return null;
  const sources = Array.isArray(raw.sources)
    ? raw.sources.map((value) => record(value)).filter((value): value is Record<string, unknown> => value !== null).map((value) => ({ magnitude: nullableNumber(value.magnitude) }))
    : raw.sources === null ? null : undefined;
  return {
    id: typeof raw.id === "number" ? raw.id : undefined,
    event_id: typeof raw.event_id === "string" ? raw.event_id : undefined,
    occurred_at: typeof raw.occurred_at === "string" ? raw.occurred_at : undefined,
    longitude: typeof raw.longitude === "number" ? raw.longitude : undefined,
    latitude: typeof raw.latitude === "number" ? raw.latitude : undefined,
    magnitude: typeof raw.magnitude === "number" ? raw.magnitude : undefined,
    depth_km: nullableNumber(raw.depth_km),
    quality: nullableString(raw.quality),
    source: nullableString(raw.source),
    sources,
    is_primary: typeof raw.is_primary === "boolean" ? raw.is_primary : undefined,
    sismik_id: nullableString(raw.sismik_id),
    location: nullableString(raw.location),
    geo_location: nullableString(raw.geo_location),
    display_location: nullableString(raw.display_location),
  };
}

/**
 * Performs the event key operation for the catalog domain application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function eventKey(event: CatalogEarthquake): string {
  if (event.eventId) return `event:${event.eventId}`;
  if (event.seismicId) return `sismik:${event.seismicId}`;
  if (Number.isFinite(event.id)) return `id:${event.id}`;
  return `${event.occurredAt}|${event.latitude.toFixed(4)}|${event.longitude.toFixed(4)}|${event.magnitude.toFixed(2)}`;
}

/**
 * Performs the event signature operation for the catalog domain application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function eventSignature(event: CatalogEarthquake): string {
  return `${event.occurredAt}|${event.latitude}|${event.longitude}|${event.magnitude}|${event.depthKm}|${event.quality}|${event.source}|${event.sourceCount}|${event.magnitudeSpread}|${event.isPrimary}`;
}

/**
 * Normalizes event for the catalog domain application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function normalizeEvent(raw: RawCatalogEarthquake): CatalogEarthquake | null {
  if (!raw.occurred_at || !Number.isFinite(parseCatalogUtc(raw.occurred_at)) || !Number.isFinite(raw.latitude) || !Number.isFinite(raw.longitude) || !Number.isFinite(raw.magnitude)) return null;
  const magnitudes = (raw.sources ?? []).map((source) => source.magnitude).filter((value): value is number => Number.isFinite(value));
  return {
    id: raw.id,
    eventId: raw.event_id,
    seismicId: raw.sismik_id,
    occurredAt: raw.occurred_at,
    longitude: raw.longitude as number,
    latitude: raw.latitude as number,
    magnitude: raw.magnitude as number,
    depthKm: raw.depth_km,
    quality: raw.quality,
    source: raw.source,
    sourceCount: Math.max(1, raw.sources?.length ?? 0),
    magnitudeSpread: magnitudes.length > 1 ? Math.max(...magnitudes) - Math.min(...magnitudes) : null,
    isPrimary: raw.is_primary !== false,
  };
}

/**
 * Performs the recent earthquake operation for the catalog domain application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function recentEarthquake(raw: RawCatalogEarthquake, event: CatalogEarthquake, key: string): RecentEarthquake | null {
  if (event.magnitude < 3) return null;
  return {
    id: key,
    occurredAtUtc: secondsToIso(parseCatalogUtc(event.occurredAt)),
    longitude: event.longitude,
    latitude: event.latitude,
    magnitude: event.magnitude,
    depthKm: event.depthKm ?? null,
    location: raw.display_location || raw.geo_location || raw.location || "—",
    source: event.source || "—",
  };
}

/**
 * Trims recent for the catalog domain application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function trimRecent(events: Map<string, RecentEarthquake>): void {
  if (events.size <= maximumRecentCount * 2) return;
  const latest = [...events.entries()].sort(([, left], [, right]) => Date.parse(right.occurredAtUtc) - Date.parse(left.occurredAtUtc)).slice(0, maximumRecentCount + 200);
  events.clear();
  for (const [key, event] of latest) events.set(key, event);
}

/**
 * Creates catalog accumulator for the catalog domain application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function createCatalogAccumulator(): CatalogAccumulator {
  return {
    events: new Map(),
    recentByThreshold: Object.fromEntries(RECENT_THRESHOLDS.map((threshold) => [threshold, new Map<string, RecentEarthquake>()])) as Record<RecentThreshold, Map<string, RecentEarthquake>>,
    hasUpdates: false,
  };
}

/**
 * Merges raw events for the catalog domain application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function mergeRawEvents(accumulator: CatalogAccumulator, values: readonly unknown[], isUpdate: boolean): void {
  for (const value of values) {
    const raw = parseRawCatalogEarthquake(value);
    if (!raw) continue;
    const event = normalizeEvent(raw);
    if (!event) continue;
    if (isUpdate) accumulator.hasUpdates = true;
    const key = eventKey(event);
    const recent = recentEarthquake(raw, event, key);
    for (const threshold of RECENT_THRESHOLDS) {
      if (recent && event.magnitude >= threshold) accumulator.recentByThreshold[threshold].set(key, recent);
      else accumulator.recentByThreshold[threshold].delete(key);
    }
    accumulator.events.set(key, event);
  }
  for (const threshold of RECENT_THRESHOLDS) trimRecent(accumulator.recentByThreshold[threshold]);
}

/**
 * Performs the changed raw events operation for the catalog domain application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function changedRawEvents(accumulator: CatalogAccumulator, values: readonly unknown[]): RawCatalogEarthquake[] {
  const changed: RawCatalogEarthquake[] = [];
  for (const value of values) {
    const raw = parseRawCatalogEarthquake(value);
    if (!raw) continue;
    const event = normalizeEvent(raw);
    if (!event) continue;
    const existing = accumulator.events.get(eventKey(event));
    if (!existing || eventSignature(existing) !== eventSignature(event)) changed.push(raw);
  }
  return changed;
}

/**
 * Performs the finalize catalog operation for the catalog domain application service module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function finalizeCatalog(accumulator: CatalogAccumulator): CatalogData {
  const events = [...accumulator.events.values()].sort((left, right) => parseCatalogUtc(right.occurredAt) - parseCatalogUtc(left.occurredAt));
  const recentEarthquakes = Object.fromEntries(RECENT_THRESHOLDS.map((threshold) => [threshold, [...accumulator.recentByThreshold[threshold].values()].sort((left, right) => Date.parse(right.occurredAtUtc) - Date.parse(left.occurredAtUtc)).slice(0, maximumRecentCount)])) as Record<RecentThreshold, RecentEarthquake[]>;
  return { events, recentEarthquakes, hasUpdates: accumulator.hasUpdates };
}
