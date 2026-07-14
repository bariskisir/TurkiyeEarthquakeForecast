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
      forecastHourUtc: "2026-07-14T10",
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
    expect(result.headers.get("CDN-Cache-Control")).toBe("max-age=1800, stale-while-revalidate=300");
    expect(await result.json()).toEqual(response());
  });

  test("disables CDN freshness while a new hour is refreshing", async () => {
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
    ["query parameters", new Request("https://example.test/api/forecast?cache-bust=1")],
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
