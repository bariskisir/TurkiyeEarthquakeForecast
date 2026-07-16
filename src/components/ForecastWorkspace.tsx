/**
 * @fileoverview Defines the forecast workspace dashboard UI module, separating typed rendering and browser interaction from unrelated server and model concerns.
 */
"use client";

import dynamic from "next/dynamic";
import { formatDateTime } from "@/lib/format";
import { copy, localeSettings, type Locale } from "@/lib/i18n";
import type { ForecastPoint, ForecastResponse, RecentEarthquake, Theme } from "@/lib/types";

/**
 * Loads the browser-only Leaflet implementation after hydration so server rendering never evaluates DOM-dependent map code.
 *
 * Keeping the loader named makes the dynamic boundary explicit and independently replaceable in UI tests.
 */
function loadForecastMap() { return import("./ForecastMap"); }

/**
 * Renders a layout-stable placeholder while the Leaflet chunk is loading without announcing an empty status message.
 *
 * The placeholder preserves the map card height and background, preventing surrounding health content from shifting.
 */
function MapLoading() { return <div className="map-loading" />; }

const ForecastMap = dynamic(loadForecastMap, { ssr: false, loading: MapLoading });

interface ForecastWorkspaceProps {
  data: ForecastResponse | null;
  forecasts: ForecastPoint[];
  loading: boolean;
  locale: Locale;
  methodUsesMagnitude: boolean;
  onOpenMethodology: () => void;
  selectedLocations: RecentEarthquake[];
  theme: Theme;
}

/**
 * Renders the forecast workspace React component as part of the forecast workspace dashboard UI module, using typed inputs and localized accessible output.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export default function ForecastWorkspace({ data, forecasts, loading, locale, methodUsesMagnitude, onOpenMethodology, selectedLocations, theme }: ForecastWorkspaceProps) {
  const t = copy[locale];
  const numberLocale = localeSettings[locale].numberLocale;
  const providerStatus = data?.metadata.providerStatus;
  const localizedStatus = providerStatus ? t[providerStatus] : t.checking;
  const healthMessage = providerStatus === "updated" ? t.statusUpdated : providerStatus === "current" ? t.statusCurrent : providerStatus === "degraded" ? t.statusDegraded : t.healthFallback;
  return (
    <div className="workspace-layout">
      <div className="map-card">
        {loading && !data ? <div className="map-loading" role="status">{t.preparingMap}</div> : <ForecastMap forecasts={forecasts} locale={locale} theme={theme} selectedLocations={selectedLocations} showMagnitude={methodUsesMagnitude} />}
      </div>
      <aside>
        <div className="summary-card">
          <p className="eyebrow">{t.dataHealth}</p>
          <div className="health-row"><span>{t.dataProvider}</span><strong>{localizedStatus}</strong></div>
          <div className="health-row"><span>{t.catalogEvents}</span><strong>{data?.metadata.eventCount.toLocaleString(numberLocale) ?? "—"}</strong></div>
          <div className="health-row"><span>{t.newestObservation}</span><strong>{formatDateTime(data?.metadata.newestEventAtUtc, locale, true)}</strong></div>
          <div className="health-row"><span>{t.generated}</span><strong>{formatDateTime(data?.metadata.generatedAtUtc, locale, true)}</strong></div>
          <div className="health-row"><span>{t.calculationFrequency}</span><strong>{t.dailyCalculation}</strong></div>
          <p className="health-note">{healthMessage}</p>
        </div>
        <div className="summary-card methodology">
          <p className="eyebrow">{t.howToRead}</p>
          <p>{t.methodology}</p>
          <p><strong>{t.probabilityWarning}</strong> {t.exactForecast}</p>
          <button type="button" className="methodology-button" onClick={onOpenMethodology}>{t.seeHowItWorks}</button>
        </div>
      </aside>
    </div>
  );
}
