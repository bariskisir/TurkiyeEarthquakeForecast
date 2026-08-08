/**
 * @fileoverview Defines the forecast route.test Vitest specification, documenting expected success, failure, edge-case, and regression behavior without modifying immutable catalogue data.
 */
import { describe, expect, test, vi } from "vitest";
import { createForecastHandler } from "@/app/api/forecast/route";
import { FORECAST_METHODS, MAGNITUDE_THRESHOLDS, RECENT_THRESHOLDS, SIGNAL_COUNTS, type ForecastMatrix, type ForecastResponse, type RecentEarthquake, type RecentThreshold } from "@/lib/types";

/**
 * Builds a minimal fetch-compatible response object with caller-controlled status and JSON payload.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function response(status: "ready" | "refreshing" = "ready"): ForecastResponse {
  const forecasts = Object.fromEntries(FORECAST_METHODS.map((method) => [method, Object.fromEntries(MAGNITUDE_THRESHOLDS.map((threshold) => [threshold, Object.fromEntries(SIGNAL_COUNTS.map((count) => [count, []]))]))])) as unknown as ForecastMatrix;
  const recentEarthquakes = Object.fromEntries(RECENT_THRESHOLDS.map((threshold) => [threshold, []])) as unknown as Record<RecentThreshold, RecentEarthquake[]>;
  return {
    forecasts,
    recentEarthquakes,
    metadata: {
      generatedAtUtc: "2026-07-14T10:00:00.000Z",
      dataUpdatedAtUtc: "2026-07-14T10:00:00.000Z",
      newestEventAtUtc: "2026-07-14T09:00:00.000Z",
      oldestEventAtUtc: "1900-01-01T00:00:00.000Z",
      eventCount: 1,
      providerStatus: "current",
      providerMessage: "current",
      cache: "memory",
      forecastDayTrt: "2026-07-14",
      forecastStatus: status,
    },
  };
}

/**
 * Creates the canonical cacheable request accepted by the public forecast route in integration tests.
 *
 * Individual security cases derive modified requests explicitly so rejected headers and query parameters remain visible in each assertion.
 */
function request(init?: RequestInit): Request {
  return new Request("https://example.test/api/forecast", init);
}

describe("forecast route", () => {
  test("returns the success contract and CDN headers", async () => {
    const GET = createForecastHandler({ getForecast: vi.fn(async () => response()) }, () => new Date("2026-07-14T10:30:00Z"));
    const result = await GET(request());
    expect(result.status).toBe(200);
    expect(result.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(result.headers.get("CDN-Cache-Control")).toBe("max-age=37800, stale-while-revalidate=300");
    expect(await result.json()).toEqual(response());
  });

  test("disables CDN freshness while a new day is refreshing", async () => {
    const GET = createForecastHandler({ getForecast: vi.fn(async () => response("refreshing")) });
    const result = await GET(request());
    expect(result.headers.get("Vercel-CDN-Cache-Control")).toBe("max-age=0, stale-while-revalidate=300");
  });

  test("returns a stable coded error without leaking internal details", async () => {
    const GET = createForecastHandler({ getForecast: vi.fn(async () => { throw new Error("secret provider failure"); }) });
    const result = await GET(request());
    expect(result.status).toBe(500);
    expect(await result.json()).toEqual({ error: "Forecast generation failed.", code: "FORECAST_UNAVAILABLE" });
  });

  test.each([
    ["year 2000", "2000"],
    ["earliest milestone year", "500"],
    ["milestone year 1950", "1950"],
    ["late milestone year", "1999"],
    ["pre-1900 continuous year", "1954"],
    ["quake-window range", "495-499"],
    ["earthquake range", "1764-1766"],
    ["ancient range", "2-17"],
    ["ancient range start", "2"],
    ["current-year month", "2026-07"],
  ])("accepts a historical %s with a long-lived CDN lifetime", async (_label, date) => {
    const getForecast = vi.fn(async () => response());
    const GET = createForecastHandler({ getForecast }, () => new Date("2026-07-14T10:30:00Z"));
    const result = await GET(new Request(`https://example.test/api/forecast?date=${date}`));
    expect(result.status).toBe(200);
    expect(result.headers.get("CDN-Cache-Control")).toBe("max-age=2592000, stale-while-revalidate=300");
    expect(result.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(getForecast).toHaveBeenCalledWith(date);
  });

  test("accepts the current calendar day selection like the default request", async () => {
    const getForecast = vi.fn(async () => response());
    const GET = createForecastHandler({ getForecast }, () => new Date("2026-07-14T10:30:00Z"));
    const result = await GET(new Request("https://example.test/api/forecast?date=2026-07-14"));
    expect(result.status).toBe(200);
    expect(result.headers.get("CDN-Cache-Control")).toBe("max-age=37800, stale-while-revalidate=300");
    expect(getForecast).toHaveBeenCalledWith("2026-07-14");
  });

  test.each([
    ["between-window year", "?date=245"],
    ["between-window year gap", "?date=503"],
    ["historical gap year", "?date=1858"],
    ["future year", "?date=2027"],
    ["range-interior year", "?date=10"],
    ["invented range", "?date=7-18"],
    ["malformed year", "?date=20x7"],
    ["past-year month", "?date=2025-07"],
    ["thirteenth month", "?date=2026-13"],
    ["future month", "?date=2026-08"],
    ["past date", "?date=2026-07-13"],
    ["pre-minimum date", "?date=0499-12-31"],
    ["malformed date", "?date=2026-13-99"],
    ["future date", "?date=2026-07-15"],
  ])("rejects an out-of-range %s", async (_label, query) => {
    const getForecast = vi.fn(async () => response());
    const GET = createForecastHandler({ getForecast }, () => new Date("2026-07-14T10:30:00Z"));
    const result = await GET(new Request(`https://example.test/api/forecast${query}`));
    expect(result.status).toBe(400);
    expect(await result.json()).toEqual({ error: "Unsupported calculation date.", code: "INVALID_REQUEST" });
    expect(getForecast).not.toHaveBeenCalled();
  });

  test.each([
    ["query parameters", new Request("https://example.test/api/forecast?cache-bust=1")],
    ["multiple query parameters", new Request("https://example.test/api/forecast?date=2000&extra=1")],
    ["empty date parameter", new Request("https://example.test/api/forecast?date=")],
    ["authorization headers", request({ headers: { Authorization: "Bearer arbitrary" } })],
    ["range headers", request({ headers: { Range: "bytes=0-10" } })],
  ])("rejects %s before reading the forecast", async (_label, modifiedRequest) => {
    const getForecast = vi.fn(async () => response());
    const GET = createForecastHandler({ getForecast });
    const result = await GET(modifiedRequest);
    expect(result.status).toBe(400);
    expect(result.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(await result.json()).toEqual({ error: "Unsupported request modifiers.", code: "INVALID_REQUEST" });
    expect(getForecast).not.toHaveBeenCalled();
  });
});
