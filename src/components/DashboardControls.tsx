/**
 * @fileoverview Defines the dashboard controls dashboard UI module, separating typed rendering and browser interaction from unrelated server and model concerns.
 */
"use client";

import { Fragment, type Dispatch } from "react";
import { formatDateTime } from "@/lib/format";
import { copy, LOCALES, localeSettings, type Locale } from "@/lib/i18n";
import { FORECAST_METHODS, MAGNITUDE_THRESHOLDS, SIGNAL_COUNTS, type ForecastMethod, type ForecastResponse, type Theme } from "@/lib/types";
import type { DashboardSelectionAction, DashboardSelectionState } from "./dashboard-state";

const methodKeys = {
  combined: "combinedMethod",
  poisson: "poissonMethod",
  etas: "etasMethod",
  triggered: "triggeredMethod",
  bValue: "bValueMethod",
  naturalTime: "naturalTimeMethod",
  energy: "energyMethod",
  clustering: "clusteringMethod",
  recurrence: "recurrenceMethod",
} as const;

interface DashboardControlsProps {
  data: ForecastResponse | null;
  dispatch: Dispatch<DashboardSelectionAction>;
  locale: Locale;
  methodUsesMagnitude: boolean;
  onLocaleChange: (locale: Locale) => void;
  onThemeChange: (theme: Theme) => void;
  selection: DashboardSelectionState;
  theme: Theme;
}

/**
 * Renders the dashboard controls React component as part of the dashboard controls dashboard UI module, using typed inputs and localized accessible output.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export default function DashboardControls({ data, dispatch, locale, methodUsesMagnitude, onLocaleChange, onThemeChange, selection, theme }: DashboardControlsProps) {
  const t = copy[locale];
  const localeSetting = localeSettings[locale];
  return (
    <section className="toolbar" aria-label={t.forecastControls}>
      <div className="magnitude-block">
        <span className="control-label">{t.minimumMagnitude}</span>
        <div className={`segments ${methodUsesMagnitude ? "" : "disabled"}`}>
          {MAGNITUDE_THRESHOLDS.map((value) => (
            <button type="button" key={value} disabled={!methodUsesMagnitude} className={methodUsesMagnitude && selection.threshold === value ? "active" : ""} onClick={() => dispatch({ type: "threshold", value })}>M{value}+</button>
          ))}
        </div>
      </div>
      <div className="method-block">
        <label className="control-label" htmlFor="forecast-method">{t.forecastMethod}</label>
        <select id="forecast-method" className="method-select" value={selection.forecastMethod} onChange={(event) => dispatch({ type: "method", value: event.target.value as ForecastMethod })}>
          {FORECAST_METHODS.map((method) => <option key={method} value={method} disabled={method === "recurrence" && selection.threshold === 5}>{t[methodKeys[method]]}</option>)}
        </select>
      </div>
      <div className="signal-block">
        <span className="control-label">{t.signalCount}</span>
        <div className="segments">
          {SIGNAL_COUNTS.map((value) => <button type="button" key={value} className={selection.signalCount === value ? "active" : ""} onClick={() => dispatch({ type: "signalCount", value })}>{value}</button>)}
        </div>
      </div>
      <div className="status-block">
        <span className={`status-dot ${data?.metadata.providerStatus === "degraded" ? "degraded" : ""}`} />
        <div><span className="control-label">{t.catalogUpdate}</span><strong>{formatDateTime(data?.metadata.dataUpdatedAtUtc, locale, true)}</strong></div>
      </div>
      <div className="quick-toggles">
        <button className="toggle-button language-toggle" type="button" onClick={() => onLocaleChange(localeSetting.alternateLocale)} aria-label={`${t.language}: ${t[localeSetting.languageKey]}`} title={t.language}>
          {LOCALES.map((option, index) => <Fragment key={option}>{index > 0 && <i />}<span className={locale === option ? "active" : ""}>{localeSettings[option].shortLabel}</span></Fragment>)}
        </button>
        <button className="toggle-button theme-toggle" type="button" onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")} aria-label={`${t.theme}: ${theme === "dark" ? t.dark : t.light}`} title={t.theme}>
          <span aria-hidden="true">☀</span><i className={theme} /><span aria-hidden="true">☾</span>
        </button>
      </div>
    </section>
  );
}
