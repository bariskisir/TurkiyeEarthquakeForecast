/**
 * @fileoverview Defines the dashboard dashboard UI module, separating typed rendering and browser interaction from unrelated server and model concerns.
 */
"use client";

import { useCallback, useState } from "react";
import { copy } from "@/lib/i18n";
import DashboardControls from "./DashboardControls";
import ForecastWorkspace from "./ForecastWorkspace";
import MethodologyModal from "./MethodologyModal";
import PrivacyModal from "./PrivacyModal";
import RecentEarthquakes from "./RecentEarthquakes";
import { useDashboardPreferences, useDashboardSelection, useForecastData } from "./useDashboard";

/**
 * Renders the dashboard React component as part of the dashboard dashboard UI module, using typed inputs and localized accessible output.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export default function Dashboard() {
  const { locale, theme, showDisclaimer, changeLocale, changeTheme, dismissDisclaimer } = useDashboardPreferences();
  const { data, loading, error, refreshing } = useForecastData();
  const { selection, dispatch, methodUsesMagnitude, selectedForecasts, recentEarthquakes, selectedLocations, allRecentSelected } = useDashboardSelection(data);
  const [showMethodology, setShowMethodology] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  /**
   * Performs the open methodology operation for the dashboard dashboard UI module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  const openMethodology = useCallback(() => setShowMethodology(true), []);
  /**
   * Performs the close methodology operation for the dashboard dashboard UI module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  const closeMethodology = useCallback(() => setShowMethodology(false), []);
  /**
   * Opens the privacy disclosure from the footer while preserving a stable callback for focus restoration.
   */
  const openPrivacy = useCallback(() => setShowPrivacy(true), []);
  /**
   * Closes the privacy disclosure and returns focus to its footer trigger.
   */
  const closePrivacy = useCallback(() => setShowPrivacy(false), []);
  const t = copy[locale];
  return (
    <main>
      {showDisclaimer && (
        <section className="disclaimer">
          <span className="disclaimer-icon" aria-hidden="true">!</span>
          <p><strong>{t.disclaimerTitle}</strong> {t.disclaimer}</p>
          <button type="button" className="disclaimer-close" onClick={dismissDisclaimer} aria-label={t.dismissDisclaimer} title={t.dismissDisclaimer} />
        </section>
      )}
      {refreshing && <div className="refresh-notice top-refresh-notice" role="status"><span className="refresh-spinner" />{t.forecastRefreshing}</div>}
      <header className="hero">
        <div className="brand-mark" aria-hidden="true"><span /></div>
        <div>
          <p className="eyebrow">{t.monitor}</p>
          <h1><span>{t.title} <em>{t.titleAccent}</em></span><small className="hero-version">v{process.env.NEXT_PUBLIC_APP_VERSION}</small></h1>
          <p className="subtitle">{t.subtitle}</p>
        </div>
      </header>
      <DashboardControls data={data} dispatch={dispatch} locale={locale} methodUsesMagnitude={methodUsesMagnitude} onLocaleChange={changeLocale} onThemeChange={changeTheme} selection={selection} theme={theme} />
      {error && <div className="error" role="alert"><strong>{t.loadError}</strong> {t.serviceUnavailable}</div>}
      <section className="workspace">
        <ForecastWorkspace data={data} forecasts={selectedForecasts} loading={loading} locale={locale} methodUsesMagnitude={methodUsesMagnitude} onOpenMethodology={openMethodology} selectedLocations={selectedLocations} theme={theme} />
        <RecentEarthquakes allSelected={allRecentSelected} dispatch={dispatch} earthquakes={recentEarthquakes} locale={locale} selection={selection} />
      </section>
      <footer><span>{t.footerResearch}</span><nav aria-label={t.footerLinks}><button type="button" className="footer-link" onClick={openPrivacy}>{t.privacyPolicy}</button><a className="footer-link" href="https://github.com/bariskisir/TurkiyeEarthquakePrediction" target="_blank" rel="noreferrer">{t.source}</a></nav></footer>
      {showMethodology && <MethodologyModal locale={locale} onClose={closeMethodology} />}
      {showPrivacy && <PrivacyModal locale={locale} onClose={closePrivacy} />}
    </main>
  );
}
