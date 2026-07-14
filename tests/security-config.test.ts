/**
 * @fileoverview Verifies repository-wide browser security headers and the bandwidth-conscious dashboard refresh interval.
 */
import { describe, expect, test } from "vitest";
import nextConfig from "../next.config";
import { FORECAST_REFRESH_POLL_MILLISECONDS } from "@/components/useDashboard";

describe("security and refresh configuration", () => {
  test("applies the browser security policy to every route", async () => {
    const routes = await nextConfig.headers?.();
    expect(routes).toHaveLength(1);
    const headers = Object.fromEntries((routes?.[0].headers ?? []).map(({ key, value }) => [key, value]));
    expect(routes?.[0].source).toBe("/(.*)");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["Content-Security-Policy"]).toContain("https://*.basemaps.cartocdn.com");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("geolocation=()");
  });

  test("polls an in-progress forecast no more than once every fifteen seconds", () => {
    expect(FORECAST_REFRESH_POLL_MILLISECONDS).toBe(15_000);
  });
});
