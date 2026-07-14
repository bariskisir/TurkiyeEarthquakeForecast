/**
 * @fileoverview Implements the catalog prep stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
// ---------------------------------------------------------------------------
// Event preparation: filter, clip to region, assign observation quality.
// ---------------------------------------------------------------------------
import type { CatalogEarthquake } from "@/lib/types";
import { parseCatalogUtc } from "@/lib/time";
import { clamp } from "./numeric";
import { pointInRegion } from "./geometry";
import type { PreparedEvent } from "./types";

/**
 * Assign an observation-quality weight ∈ [0.1, 1.0] to every event.
 *
 * The weight combines the human-reviewed label, the number of contributing
 * agencies (source count), and the inter-source magnitude spread.  Events
 * that are flagged as reviewed by a focal-mechanism group are considered
 * highest quality.  Historical-catalogue entries (pre-1900) receive a lower
 * baseline because their completeness is uncertain.
 *
 * Quality labels are Turkish-language keywords from the Sismik Harita API.
 */
export function computeObservationQuality(event: CatalogEarthquake): number {
  const label = event.quality?.toLocaleLowerCase("tr-TR") ?? "";

  let baseWeight: number;
  if (label === "reviewed" || label === "focal_mechanism") {
    baseWeight = 1.0;
  } else if (label === "turhec_extended") {
    baseWeight = 0.9;
  } else if (label === "i̇lksel" || label === "ilksel") {
    baseWeight = 0.74;
  } else if (label === "automatic") {
    baseWeight = 0.62;
  } else if (label === "historical_catalogue") {
    baseWeight = 0.48;
  } else {
    baseWeight = 0.82;
  }

  // More contributing agencies → slightly higher confidence
  const sourceFactor = clamp(0.94 + 0.03 * Math.min(event.sourceCount, 3), 0.94, 1.03);
  baseWeight *= sourceFactor;

  // Larger inter-source spread → lower confidence
  if (event.magnitudeSpread !== null) {
    const spreadPenalty = clamp(1.04 - event.magnitudeSpread * 0.22, 0.68, 1.04);
    baseWeight *= spreadPenalty;
  }

  // Implausible depth → penalise
  if (typeof event.depthKm === "number" && (event.depthKm < 0 || event.depthKm > 700)) {
    baseWeight *= 0.5;
  }

  // Non-primary-event records (the same event reported by another source) → penalise
  if (!event.isPrimary) {
    baseWeight *= 0.5;
  }

  return clamp(baseWeight, 0.1, 1.0);
}

/**
 * Convert the raw catalogue into an array of PreparedEvent objects.
 *
 * Steps:
 *   1. Parse the UTC timestamp (discard events with unparseable dates or future timestamps).
 *   2. Discard events outside the rectangular study region.
 *   3. Assign observation quality.
 *
 * Returns the prepared events (NOT time-sorted yet).
 */
export function prepareEvents(
  catalogueEvents: readonly CatalogEarthquake[],
  currentTimestamp: number,
): PreparedEvent[] {
  const prepared: PreparedEvent[] = [];

  for (const event of catalogueEvents) {
    const timestamp = parseCatalogUtc(event.occurredAt);
    const { latitude, longitude, magnitude } = event;

    // Reject events with invalid time, future date, non-finite coordinates, or non-finite magnitude
    if (
      !Number.isFinite(timestamp) ||
      timestamp > currentTimestamp ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(magnitude)
    ) {
      continue;
    }

    // Reject events outside the study region
    if (!pointInRegion(latitude, longitude)) {
      continue;
    }

    const quality = computeObservationQuality(event);

    prepared.push({
      timestamp,
      latitude,
      longitude,
      magnitude,
      quality,
      isBackground: true, // will be set false by declustering for aftershocks
    });
  }

  return prepared;
}
