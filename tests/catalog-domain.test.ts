/**
 * @fileoverview Defines the catalog domain.test Vitest specification, documenting expected success, failure, edge-case, and regression behavior without modifying immutable catalogue data.
 */
import { describe, expect, test } from "vitest";
import {
  changedRawEvents,
  createCatalogAccumulator,
  eventKey,
  finalizeCatalog,
  mergeRawEvents,
  normalizeEvent,
  type RawCatalogEarthquake,
} from "@/lib/catalog-domain";

/**
 * Builds a minimal deterministic raw earthquake record for the surrounding test scenario.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function raw(overrides: Partial<RawCatalogEarthquake> = {}): RawCatalogEarthquake {
  return {
    id: 1,
    event_id: "event-1",
    occurred_at: "2026-06-11 10:00:00",
    latitude: 39,
    longitude: 35,
    magnitude: 4.2,
    depth_km: 8,
    quality: "reviewed",
    source: "afad",
    sources: [{ magnitude: 4.1 }, { magnitude: 4.4 }],
    is_primary: true,
    display_location: "Ankara",
    ...overrides,
  };
}

describe("catalog domain", () => {
  test("normalizes provider records and rejects invalid boundaries", () => {
    expect(normalizeEvent(raw())).toMatchObject({ eventId: "event-1", magnitudeSpread: 0.3000000000000007, sourceCount: 2, isPrimary: true });
    expect(normalizeEvent(raw({ occurred_at: "invalid" }))).toBeNull();
    expect(normalizeEvent(raw({ latitude: Number.NaN }))).toBeNull();
  });

  test("uses stable identifier priority", () => {
    const event = normalizeEvent(raw({ event_id: "provider", sismik_id: "seismic", id: 7 }))!;
    expect(eventKey(event)).toBe("event:provider");
    expect(eventKey({ ...event, eventId: undefined })).toBe("sismik:seismic");
    expect(eventKey({ ...event, eventId: undefined, seismicId: null })).toBe("id:7");
  });

  test("keeps the latest revision and updates recent projections", () => {
    const accumulator = createCatalogAccumulator();
    mergeRawEvents(accumulator, [raw()], false);
    const revision = raw({ magnitude: 5.1, display_location: "Revised Ankara" });
    expect(changedRawEvents(accumulator, [raw(), revision])).toEqual([revision]);
    mergeRawEvents(accumulator, [revision], true);
    const result = finalizeCatalog(accumulator);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].magnitude).toBe(5.1);
    expect(result.recentEarthquakes[5][0]).toMatchObject({ magnitude: 5.1, location: "Revised Ankara" });
    expect(result.hasUpdates).toBe(true);
  });
});
