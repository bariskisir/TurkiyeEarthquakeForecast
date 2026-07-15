/**
 * @fileoverview Defines the forecast HTTP boundary and makes its contracts, integration responsibilities, side effects, and fallback behavior explicit to maintainers.
 */
import { after, NextResponse } from "next/server";
import { createForecastService } from "@/lib/forecast-service";
import { secondsUntilNextTurkiyeDay } from "@/lib/time";
import type { ForecastErrorResponse, ForecastResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const privateNoStoreHeaders = { "Cache-Control": "private, no-store, max-age=0" };

/**
 * Rejects request modifiers that bypass shared CDN caching even though the public forecast representation does not vary by them.
 *
 * Keeping this check ahead of catalogue and forecast access ensures cache-busting requests remain constant-cost and cannot trigger B2 reads or model generation.
 */
function unsupportedRequest(request: Request): boolean {
  return new URL(request.url).search.length > 0
    || request.headers.has("authorization")
    || request.headers.has("range");
}

const service = createForecastService({
  /**
   * Performs the defer operation for the forecast HTTP boundary, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  defer: (task) => after(task),
  /**
   * Performs the log operation for the forecast HTTP boundary, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
   *
   * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
   */
  log: (entry) => console.info(JSON.stringify(entry)),
});

/**
 * Creates forecast handler for the forecast HTTP boundary, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function createForecastHandler(reader: { getForecast: () => Promise<ForecastResponse> }, now: () => Date = () => new Date()) {
  /**
   * Executes one forecast request, derives a Türkiye-midnight-aligned CDN lifetime, and converts internal failures into the stable public error contract.
   *
   * The nested handler closes over injected service and clock dependencies so route behavior remains deterministic in integration tests.
   */
  async function forecastHandler(request: Request) {
    if (unsupportedRequest(request)) {
      return NextResponse.json(
        { error: "Unsupported request modifiers.", code: "INVALID_REQUEST" },
        { status: 400, headers: privateNoStoreHeaders },
      );
    }
    try {
      const response = await reader.getForecast();
      const ttl = response.metadata.forecastStatus === "refreshing" ? 0 : secondsUntilNextTurkiyeDay(now());
      return NextResponse.json(response, {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "CDN-Cache-Control": `max-age=${ttl}, stale-while-revalidate=300`,
          "Vercel-CDN-Cache-Control": `max-age=${ttl}, stale-while-revalidate=300`,
        },
      });
    } catch {
      const response: ForecastErrorResponse = { error: "Forecast generation failed.", code: "FORECAST_UNAVAILABLE" };
      return NextResponse.json(response, { status: 500, headers: privateNoStoreHeaders });
    }
  }
  return forecastHandler;
}

export const GET = createForecastHandler(service);
