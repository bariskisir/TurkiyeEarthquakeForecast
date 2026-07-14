/**
 * @fileoverview Defines the catalog deterministic fixture module, documenting expected success, failure, edge-case, and regression behavior without modifying immutable catalogue data.
 */
import type { CatalogEarthquake } from "@/lib/types";

export const REFERENCE_TIMESTAMP = Date.UTC(2026, 5, 11, 12) / 1_000;

const clusters = [
  [38.35, 27.25],
  [40.72, 29.91],
  [37.18, 37.12],
  [39.14, 35.48],
  [38.42, 43.18],
  [36.64, 30.42],
] as const;

/**
 * Builds one deterministic normalized earthquake record with reproducible identity, quality, coordinates, and time.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function event(index: number, timestamp: number, latitude: number, longitude: number, magnitude: number, quality: string): CatalogEarthquake {
  return {
    id: index,
    eventId: `fixture-${index}`,
    occurredAt: new Date(timestamp * 1_000).toISOString(),
    latitude,
    longitude,
    magnitude,
    depthKm: 4 + index % 38,
    quality,
    source: index % 2 ? "afad" : "koeri",
    sourceCount: 1 + index % 3,
    magnitudeSpread: index % 5 ? (index % 4) / 10 : null,
    isPrimary: index % 17 !== 0,
  };
}

/**
 * Creates forecast catalog for the catalog deterministic fixture module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function createForecastCatalog(): CatalogEarthquake[] {
  const events: CatalogEarthquake[] = [];
  const qualities = ["reviewed", "automatic", "turhec_extended", "ilksel"];
  for (let index = 0; index < 960; index++) {
    const cluster = clusters[index % clusters.length];
    const ageDays = (index * 13 + (index % 11) * 29) % 3_640;
    const latitude = cluster[0] + ((index * 17) % 21 - 10) * 0.018;
    const longitude = cluster[1] + ((index * 23) % 21 - 10) * 0.021;
    const magnitude = 2.1 + ((index * 19) % 44) / 10;
    events.push(event(index + 1, REFERENCE_TIMESTAMP - ageDays * 86_400 - (index % 24) * 3_600, latitude, longitude, magnitude, qualities[index % qualities.length]));
  }
  let id = events.length + 1;
  for (let clusterIndex = 0; clusterIndex < clusters.length; clusterIndex++) {
    const cluster = clusters[clusterIndex];
    for (const year of [1912, 1948, 1976, 1999, 2023]) {
      const timestamp = Date.UTC(year, clusterIndex % 12, 3 + clusterIndex) / 1_000;
      const magnitude = 6.1 + ((year + clusterIndex) % 11) / 10;
      events.push(event(id++, timestamp, cluster[0], cluster[1], magnitude, "reviewed"));
    }
  }
  return events.sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
}
