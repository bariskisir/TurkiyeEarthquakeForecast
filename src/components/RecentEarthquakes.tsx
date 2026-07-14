/**
 * @fileoverview Defines the recent earthquakes dashboard UI module, separating typed rendering and browser interaction from unrelated server and model concerns.
 */
"use client";

import type { Dispatch } from "react";
import { formatDateTime } from "@/lib/format";
import { copy, localeSettings, type Locale } from "@/lib/i18n";
import { RECENT_COUNTS, RECENT_THRESHOLDS, type RecentEarthquake } from "@/lib/types";
import type { DashboardSelectionAction, DashboardSelectionState } from "./dashboard-state";

interface RecentEarthquakesProps {
  allSelected: boolean;
  dispatch: Dispatch<DashboardSelectionAction>;
  earthquakes: RecentEarthquake[];
  locale: Locale;
  selection: DashboardSelectionState;
}

/**
 * Renders the recent earthquakes React component as part of the recent earthquakes dashboard UI module, using typed inputs and localized accessible output.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export default function RecentEarthquakes({ allSelected, dispatch, earthquakes, locale, selection }: RecentEarthquakesProps) {
  const t = copy[locale];
  const numberLocale = localeSettings[locale].numberLocale;
  const ids = earthquakes.map((event) => event.id);
  return (
    <section className="recent-card">
      <div className="recent-heading">
        <div>
          <div className="recent-title-row">
            <p className="eyebrow">{t.recentEarthquakes}</p>
            <button type="button" className={`recent-map-toggle ${allSelected ? "active" : ""}`} role="switch" aria-checked={allSelected} aria-label={allSelected ? t.removeAllFromMap : t.showAllOnMap} onClick={() => dispatch({ type: "toggleAllRecent", ids })}>
              <span>{t.mapLabel}</span><i aria-hidden="true" />
            </button>
          </div>
          <h2>{t.recentEarthquakesSubtitle.replace("{threshold}", String(selection.recentThreshold)).replace("{count}", String(selection.recentCount))}</h2>
        </div>
        <div className="recent-controls" aria-label={t.recentControls}>
          <div className="recent-thresholds" aria-label={t.minimumMagnitude}>
            {RECENT_THRESHOLDS.map((value) => <button type="button" key={value} className={selection.recentThreshold === value ? "active" : ""} onClick={() => dispatch({ type: "recentThreshold", value })}>M{value}+</button>)}
          </div>
          <div className="recent-counts" aria-label={t.resultCount}>
            {RECENT_COUNTS.map((value) => <button type="button" key={value} className={selection.recentCount === value ? "active" : ""} onClick={() => dispatch({ type: "recentCount", value })}>{value}</button>)}
          </div>
        </div>
      </div>
      {earthquakes.length === 0 ? <p className="recent-empty">{t.noRecentEarthquakes}</p> : (
        <ol className="recent-grid">
          {earthquakes.map((event) => {
            const selected = selection.selectedRecentIds.has(event.id);
            return (
              <li key={event.id} className={selected ? "is-selected" : ""}>
                <button type="button" className={`recent-toggle ${selected ? "active" : ""}`} role="switch" aria-checked={selected} onClick={() => dispatch({ type: "toggleRecent", id: event.id })} aria-label={selected ? t.removeFromMap : t.showOnMap} />
                <div><strong>M{event.magnitude.toFixed(1)}</strong><time dateTime={event.occurredAtUtc}>{formatDateTime(event.occurredAtUtc, locale)}</time></div>
                <span title={event.location}>{event.location}</span>
                <small>{event.depthKm === null ? "—" : `${event.depthKm.toFixed(1)} km`} · {event.source.toLocaleUpperCase(numberLocale)}</small>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
