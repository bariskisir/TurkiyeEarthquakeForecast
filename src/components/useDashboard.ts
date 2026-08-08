/**
 * @fileoverview Defines the use dashboard dashboard UI module, separating typed rendering and browser interaction from unrelated server and model concerns.
 */
"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { readStoredValue, writeStoredValue } from "@/lib/browser-storage";
import { validForecastResponse } from "@/lib/forecast-bundle";
import { resolveLocale, type Locale } from "@/lib/i18n";
import { calculationDateOptions, secondsUntilNextTurkiyeDay, turkiyeDay } from "@/lib/time";
import { forecastMethodUsesMagnitude, MAGNITUDE_THRESHOLDS, type ForecastResponse, type Theme } from "@/lib/types";
import { dashboardSelectionReducer, initialDashboardSelection } from "./dashboard-state";

const disclaimerStorageKey = "disclaimer-dismissed";
export const FORECAST_REFRESH_POLL_MILLISECONDS = 15_000;

/**
 * Provides the dashboard preferences React hook, isolating its state, effects, memoization, cleanup, and stable callbacks from presentation code.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function useDashboardPreferences() {
  const [locale, setLocale] = useState<Locale>("en");
  const [theme, setTheme] = useState<Theme>("dark");
  const [showDisclaimer, setShowDisclaimer] = useState<boolean | null>(null);

  useEffect(() => {
    const detectedLocale = resolveLocale(readStoredValue("locale"), navigator.language);
    const detectedTheme: Theme = readStoredValue("theme") === "light" ? "light" : "dark";
    setLocale(detectedLocale);
    setTheme(detectedTheme);
    setShowDisclaimer(readStoredValue(disclaimerStorageKey) !== "1");
    document.documentElement.lang = detectedLocale;
    document.documentElement.setAttribute("data-theme", detectedTheme);
    document.documentElement.setAttribute("data-bs-theme", detectedTheme);
  }, []);

  /**
   * Performs the change locale operation for the use dashboard dashboard UI module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  const changeLocale = useCallback((value: Locale) => {
    setLocale(value);
    document.documentElement.lang = value;
    writeStoredValue("locale", value);
  }, []);

  /**
   * Performs the change theme operation for the use dashboard dashboard UI module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  const changeTheme = useCallback((value: Theme) => {
    setTheme(value);
    document.documentElement.setAttribute("data-theme", value);
    document.documentElement.setAttribute("data-bs-theme", value);
    writeStoredValue("theme", value);
  }, []);

  /**
   * Performs the dismiss disclaimer operation for the use dashboard dashboard UI module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  const dismissDisclaimer = useCallback(() => {
    setShowDisclaimer(false);
    writeStoredValue(disclaimerStorageKey, "1");
  }, []);

  return { locale, theme, showDisclaimer, changeLocale, changeTheme, dismissDisclaimer };
}

/**
 * Provides the forecast data React hook, isolating its state, effects, memoization, cleanup, and stable callbacks from presentation code.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function useForecastData() {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"FORECAST_UNAVAILABLE" | null>(null);
  const [currentDayTrt, setCurrentDayTrt] = useState(() => turkiyeDay());
  const [calculationDate, setCalculationDate] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const effectiveCalculationDate = calculationDate ?? currentDayTrt;
  const loadingDate = calculationDate ?? null;

  /**
   * Loads load for the use dashboard dashboard UI module, including the validation and edge cases encoded by its typed contract.
   *
   * A null date requests the default forecast without a query parameter so the browser clock can never cause a rejected "today";
   * the server replies with its authoritative day, which replaces the client-computed one once the response is ready.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  const load = useCallback(async (date: string | null) => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setError(null);
    try {
      const query = date ? `?date=${encodeURIComponent(date)}` : "";
      const response = await fetch(`/api/forecast${query}`, { cache: "no-store", signal: request.signal });
      const body = await response.json() as unknown;
      if (!response.ok || !validForecastResponse(body)) throw new Error("FORECAST_UNAVAILABLE");
      setData(body);
      if (date === null && body.metadata.forecastStatus === "ready") {
        setCurrentDayTrt(body.metadata.forecastDayTrt);
      }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError("FORECAST_UNAVAILABLE");
    } finally {
      if (controller.current === request) {
        controller.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load(loadingDate);
    return () => controller.current?.abort();
  }, [loadingDate, load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextDayTrt = turkiyeDay();
      setCurrentDayTrt(nextDayTrt);
      setCalculationDate((current) => current === currentDayTrt ? null : current);
    }, secondsUntilNextTurkiyeDay() * 1_000 + 100);
    return () => window.clearTimeout(timer);
  }, [currentDayTrt]);

  const latest = effectiveCalculationDate === currentDayTrt;
  const refreshing = Boolean(data && latest && (data.metadata.forecastStatus === "refreshing" || data.metadata.forecastDayTrt !== currentDayTrt));

  useEffect(() => {
    if (!refreshing) return;
    void load(loadingDate);
    const timer = window.setInterval(() => { void load(loadingDate); }, FORECAST_REFRESH_POLL_MILLISECONDS);
    return () => window.clearInterval(timer);
  }, [loadingDate, load, refreshing]);

  /**
   * Changes the selected calculation date, mapping the "today" option back to the default so it is always requested without a date query.
   *
   * The only day-format option is "today"; a stale server-rendered value (for example a previous calendar day) therefore also maps to the
   * default instead of sending a date the API would reject.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  const changeCalculationDate = useCallback((value: string) => {
    setCalculationDate(/^\d{4}-\d{2}-\d{2}$/.test(value) ? null : value);
  }, []);

  const calculationDates = useMemo(() => {
    const year = Number(currentDayTrt.slice(0, 4));
    const month = Number(currentDayTrt.slice(5, 7));
    const years = calculationDateOptions(currentDayTrt);
    const months = Array.from({ length: month }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
    return [...years, ...months, currentDayTrt];
  }, [currentDayTrt]);

  return {
    data,
    loading,
    error,
    refreshing,
    reload: load,
    calculationDate: effectiveCalculationDate,
    calculationDates,
    changeCalculationDate,
  };
}

/**
 * Provides the dashboard selection React hook, isolating its state, effects, memoization, cleanup, and stable callbacks from presentation code.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function useDashboardSelection(data: ForecastResponse | null) {
  const [selection, dispatch] = useReducer(dashboardSelectionReducer, initialDashboardSelection);
  const methodUsesMagnitude = forecastMethodUsesMagnitude(selection.forecastMethod);
  const methodThreshold = methodUsesMagnitude ? selection.threshold : MAGNITUDE_THRESHOLDS[0];
  const selectedForecasts = useMemo(() => data?.forecasts[selection.forecastMethod]?.[methodThreshold]?.[selection.signalCount] ?? [], [data, methodThreshold, selection.forecastMethod, selection.signalCount]);
  const recentEarthquakes = useMemo(() => (data?.recentEarthquakes[selection.recentThreshold] ?? []).slice(0, selection.recentCount), [data, selection.recentCount, selection.recentThreshold]);
  const selectedLocations = useMemo(() => recentEarthquakes.filter((event) => selection.selectedRecentIds.has(event.id)), [recentEarthquakes, selection.selectedRecentIds]);
  const allRecentSelected = recentEarthquakes.length > 0 && recentEarthquakes.every((event) => selection.selectedRecentIds.has(event.id));
  return { selection, dispatch, methodUsesMagnitude, selectedForecasts, recentEarthquakes, selectedLocations, allRecentSelected };
}
