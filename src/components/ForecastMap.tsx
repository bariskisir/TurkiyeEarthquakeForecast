/**
 * @fileoverview Defines the forecast map dashboard UI module, separating typed rendering and browser interaction from unrelated server and model concerns.
 */
"use client";

import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap, ZoomControl } from "react-leaflet";
import { useEffect, useRef } from "react";
import { readStoredJson, writeStoredJson } from "@/lib/browser-storage";
import type { ForecastPoint, RecentEarthquake, Theme } from "@/lib/types";
import { copy, localeSettings, type Locale } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";

const TURKIYE_BOUNDS: [[number, number], [number, number]] = [[34, 24], [43, 46]];
const MAP_VIEW_KEY = "map-view";
interface MapView { lat: number; lng: number; zoom: number }

/**
 * Validates map view for the forecast map dashboard UI module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function validMapView(value: unknown): value is MapView {
  if (!value || typeof value !== "object") return false;
  const view = value as Partial<MapView>;
  return Number.isFinite(view.lat) && Number.isFinite(view.lng) && Number.isFinite(view.zoom);
}

/**
 * Renders the persistent view React component as part of the forecast map dashboard UI module, using typed inputs and localized accessible output.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function PersistentView() {
  const map = useMap();
  useEffect(() => {
    const saved = readStoredJson(MAP_VIEW_KEY, validMapView);
    if (saved) map.setView([saved.lat, saved.lng], saved.zoom, { animate: false });
    else {
      map.fitBounds(TURKIYE_BOUNDS, { padding: [24, 24], animate: false });
      map.setZoom(map.getZoom() + 0.5, { animate: false });
      const center = map.getCenter();
      map.setView([center.lat, center.lng - (TURKIYE_BOUNDS[1][1] - TURKIYE_BOUNDS[0][1]) * 0.1], map.getZoom(), { animate: false });
    }
    /**
     * Captures the current Leaflet center and zoom and persists them through the exception-safe browser storage boundary.
     *
     * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
     */
    const save = () => {
      const center = map.getCenter();
      writeStoredJson(MAP_VIEW_KEY, { lat: center.lat, lng: center.lng, zoom: map.getZoom() });
    };
    map.on("moveend", save);
    return () => { map.off("moveend", save); };
  }, [map]);
  return null;
}

/**
 * Performs the color operation for the forecast map dashboard UI module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function color(score: number): string {
  if (score >= 92) return "#ff4d6d";
  if (score >= 80) return "#ff8c42";
  if (score >= 65) return "#ffd166";
  return "#4cc9a7";
}

/**
 * Renders the forecast marker React component as part of the forecast map dashboard UI module, using typed inputs and localized accessible output.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function ForecastMarker({ item, locale, showMagnitude }: { item: ForecastPoint; locale: Locale; showMagnitude: boolean }) {
  const t = copy[locale];
  const markerColor = color(item.relativeScore);
  return (
    <CircleMarker
      center={[item.latitude, item.longitude]}
      radius={Math.max(6, 15 - item.rank * 0.055)}
      pathOptions={{ color: markerColor, fillColor: markerColor, fillOpacity: 0.68, weight: 1.5 }}
    >
      <Tooltip permanent direction="center" className="forecast-year-label" opacity={1}>{item.relativeScore.toFixed(0)}</Tooltip>
      <Popup minWidth={260}>
        <div className="popup">
          <div className="popup-rank">{t.forecastRegion} #{item.rank}</div>
          <strong>{showMagnitude && `M${item.threshold}+ `}{t.regionalSignal}</strong>
          <div className="popup-score">{item.relativeScore.toFixed(1)} <span>{t.relativeScore}</span></div>
          <dl>
            <div><dt>{t.annualRate}</dt><dd>{item.indicators.totalRateAnnual.toFixed(4)} / {t.yearUnit}</dd></div>
            <div><dt>{t.clustering}</dt><dd>{(item.indicators.clusteringRatio * 100).toFixed(2)}%</dd></div>
            <div><dt>{t.bValue}</dt><dd>{item.indicators.bValue.toFixed(2)}</dd></div>
            {item.indicators.recurrenceProbability30Years !== null && <div><dt>{t.recurrence30Year}</dt><dd>{(item.indicators.recurrenceProbability30Years * 100).toFixed(1)}%</dd></div>}
          </dl>
          <dl>
            <div><dt>{t.center}</dt><dd>{item.latitude.toFixed(2)}, {item.longitude.toFixed(2)}</dd></div>
            <div><dt>{t.radius}</dt><dd>~{item.radiusKm} km</dd></div>
            <div><dt>{t.triggeredRate}</dt><dd>{item.indicators.triggeredRateAnnual.toFixed(4)}</dd></div>
            <div><dt>{t.backgroundRate}</dt><dd>{item.indicators.backgroundRateAnnual.toFixed(4)}</dd></div>
            <div><dt>{t.completeness}</dt><dd>{item.indicators.completenessMagnitude.toFixed(2)}</dd></div>
            <div><dt>{t.nearby}</dt><dd>{item.indicators.nearbyEventCount.toFixed(2)}</dd></div>
            {item.indicators.meanRecurrenceYears !== null && <div><dt>{t.meanRecurrence}</dt><dd>~{item.indicators.meanRecurrenceYears.toFixed(1)} {t.yearUnit}</dd></div>}
            {item.indicators.yearsSinceLastLargeEvent !== null && <div><dt>{t.yearsSinceLargeEvent}</dt><dd>{item.indicators.yearsSinceLastLargeEvent.toFixed(1)} {t.yearUnit}</dd></div>}
            {item.indicators.historicalLargeEventCount > 0 && <div><dt>{t.historicalLargeEvents}</dt><dd>{item.indicators.historicalLargeEventCount}</dd></div>}
            {item.indicators.recurrenceProbability30Years !== null && <div><dt>{t.recurrenceConfidence}</dt><dd>{(item.indicators.recurrenceConfidence * 100).toFixed(0)}%</dd></div>}
          </dl>
          {item.indicators.recurrenceProbability30Years !== null && <p>{t.recurrenceEstimateDisclaimer}</p>}
          <p>{t.scoreDisclaimer}</p>
        </div>
      </Popup>
    </CircleMarker>
  );
}

/**
 * Performs the earthquake color operation for the forecast map dashboard UI module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function earthquakeColor(magnitude: number): string {
  if (magnitude >= 7) return "#ff4d6d";
  if (magnitude >= 6) return "#ff8c42";
  if (magnitude >= 5) return "#ffd166";
  if (magnitude >= 4) return "#4cc9a7";
  return "#4a9eff";
}

/**
 * Renders the recent marker React component as part of the forecast map dashboard UI module, using typed inputs and localized accessible output.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function RecentMarker({ event, locale }: { event: RecentEarthquake; locale: Locale }) {
  const t = copy[locale];
  const markerColor = earthquakeColor(event.magnitude);
  const year = new Date(event.occurredAtUtc).getFullYear();
  return (
    <CircleMarker
      center={[event.latitude, event.longitude]}
      radius={Math.max(11, Math.min(17, 10 + event.magnitude))}
      pathOptions={{ color: markerColor, fillColor: markerColor, fillOpacity: 0.76, weight: 2 }}
    >
      <Tooltip permanent direction="center" className="recent-marker-label" opacity={1}>{year}</Tooltip>
      <Popup minWidth={260}>
        <div className="popup recent-popup">
          <div className="popup-rank">{year} {t.earthquake}</div>
          <strong>{event.location}</strong>
          <div className="popup-score" style={{ color: markerColor }}>M{event.magnitude.toFixed(1)} <span>{t.magnitude}</span></div>
          <dl>
            <div><dt>{t.occurredAt}</dt><dd>{formatDateTime(event.occurredAtUtc, locale)}</dd></div>
            <div><dt>{t.depth}</dt><dd>{event.depthKm === null ? "—" : `${event.depthKm.toFixed(1)} km`}</dd></div>
            <div><dt>{t.eventSource}</dt><dd>{event.source.toLocaleUpperCase(localeSettings[locale].numberLocale)}</dd></div>
            <div><dt>{t.coordinates}</dt><dd>{event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}</dd></div>
          </dl>
        </div>
      </Popup>
    </CircleMarker>
  );
}

/**
 * Renders the selected earthquake view React component as part of the forecast map dashboard UI module, using typed inputs and localized accessible output.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function SelectedEarthquakeView({ events }: { events: RecentEarthquake[] }) {
  const map = useMap();
  const previousIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const added = events.filter((event) => !previousIds.current.has(event.id));
    previousIds.current = new Set(events.map((event) => event.id));
    if (added.length === 1) {
      map.flyTo([added[0].latitude, added[0].longitude], Math.max(map.getZoom(), 8), { duration: 0.8 });
    } else if (added.length > 1) {
      map.fitBounds(events.map((event) => [event.latitude, event.longitude] as [number, number]), { padding: [40, 40], maxZoom: 8 });
    }
  }, [events, map]);
  return null;
}

/**
 * Renders the forecast map React component as part of the forecast map dashboard UI module, using typed inputs and localized accessible output.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export default function ForecastMap({ forecasts, locale, theme, selectedLocations = [], showMagnitude = true }: { forecasts: ForecastPoint[]; locale: Locale; theme: Theme; selectedLocations?: RecentEarthquake[]; showMagnitude?: boolean }) {
  const t = copy[locale];
  return (
    <div className="map-shell" role="region" aria-label={t.mapRegion}>
      {/* SVG limits pointer targeting to painted marker paths; a translated canvas can capture input outside its visible map area. */}
      <MapContainer key="svg-renderer" bounds={TURKIYE_BOUNDS} boundsOptions={{ padding: [24, 24] }} minZoom={4} maxZoom={11} zoomSnap={0.5} zoomDelta={0.5} zoomControl={false} className="map">
        <PersistentView />
        <ZoomControl position="bottomright" />
        <SelectedEarthquakeView events={selectedLocations} />
        {theme === "dark" ? (
          <TileLayer
            key="dark-map"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
        ) : (
          <TileLayer
            key="light-map"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
        )}
        {forecasts.map((item) => <ForecastMarker key={`${item.threshold}-${item.rank}`} item={item} locale={locale} showMagnitude={showMagnitude} />)}
        {selectedLocations.map((event) => <RecentMarker key={event.id} event={event} locale={locale} />)}
      </MapContainer>
    </div>
  );
}
