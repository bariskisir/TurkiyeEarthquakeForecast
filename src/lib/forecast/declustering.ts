/**
 * @fileoverview Implements the declustering stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
// ---------------------------------------------------------------------------
// Declustering: Gardner-Knopoff (1974) space-time windows.
//
// The algorithm flags aftershocks of larger predecessor events so that the
// background model μ(x, y) is built from independent
// (mainshock) events only.
//
// Procedure (chronological sweep):
//   1. Iterate through time-sorted events.
//   2. Maintain a rolling list of "active parents" — larger events whose
//      time + distance windows have not yet expired.
//   3. For each event, check all still-active parents.  If the event
//      falls within any parent's space-time window AND the parent is larger,
//      mark the event as an aftershock (isBackground = false).
//   4. Events that survive become background events and potential parents.
//
// Note: Gardner-Knopoff is a deterministic heuristic.  For rigorous
// declustering, consider the EM-based stochastic method (Zhuang, Ogata &
// Vere-Jones 2002), but that requires model-fitting at the same time.
// ---------------------------------------------------------------------------
import { SECONDS_PER_DAY } from "@/lib/time";
import type { PreparedEvent } from "./types";
import { gardnerKnopoffDistanceKm, gardnerKnopoffTimeDays } from "./config";
import { KILOMETRES_PER_DEGREE, DEGREES_TO_RADIANS } from "./config";

/**
 * Apply Gardner-Knopoff declustering to a time-sorted array of events.
 * Modifies event.isBackground in place.
 */
export function declusterGardnerKnopoff(events: PreparedEvent[]): void {
  // Rolling list of indices into `events` whose windows are still active.
  const activeParentIndices: number[] = [];

  for (let currentIndex = 0; currentIndex < events.length; currentIndex++) {
    const currentEvent = events[currentIndex];

    // Clean expired parents from the active list
    let writePosition = 0;
    for (let p = 0; p < activeParentIndices.length; p++) {
      const parentIndex = activeParentIndices[p];
      const parent = events[parentIndex];
      const windowDurationSeconds = gardnerKnopoffTimeDays(parent.magnitude) * SECONDS_PER_DAY;

      // If the parent's time window has already passed the current event → expired
      if (parent.timestamp + windowDurationSeconds < currentEvent.timestamp) {
        continue; // skip (drop) this parent
      }

      // Keep this parent in the active list
      activeParentIndices[writePosition] = parentIndex;
      writePosition++;

      // Check if the current event is an aftershock of this parent
      if (currentEvent.isBackground && parent.magnitude >= currentEvent.magnitude) {
        const dyKm = (currentEvent.latitude - parent.latitude) * KILOMETRES_PER_DEGREE;
        const dxKm =
          (currentEvent.longitude - parent.longitude) *
          KILOMETRES_PER_DEGREE *
          Math.cos(parent.latitude * DEGREES_TO_RADIANS);
        const distanceKm = Math.hypot(dxKm, dyKm);

        if (distanceKm <= gardnerKnopoffDistanceKm(parent.magnitude)) {
          currentEvent.isBackground = false;
        }
      }
    }
    activeParentIndices.length = writePosition;

    // Current event is now done; add it as a potential parent for subsequent events
    // Only background events can be parents (an aftershock is unlikely to trigger
    // large aftershocks of its own that would be flagged by simple windows)
    if (currentEvent.isBackground) {
      activeParentIndices.push(currentIndex);
    }
  }
}
