/**
 * @fileoverview Defines the forecast cache.test Vitest specification, documenting expected success, failure, edge-case, and regression behavior without modifying immutable catalogue data.
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createForecastBundleStore } from "@/lib/forecast-cache";
import { FORECAST_CACHE_PREFIX, FORECAST_FILE_PREFIX, FORECAST_MODEL, type ForecastBundle } from "@/lib/forecast-bundle";
import { FORECAST_METHODS, MAGNITUDE_THRESHOLDS, RECENT_THRESHOLDS, SIGNAL_COUNTS, type ForecastMatrix, type RecentEarthquake, type RecentThreshold } from "@/lib/types";

const directories: string[] = [];

/**
 * Performs the empty matrix operation for the forecast cache.test Vitest specification, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function emptyMatrix(): ForecastMatrix {
  return Object.fromEntries(FORECAST_METHODS.map((method) => [method, Object.fromEntries(MAGNITUDE_THRESHOLDS.map((threshold) => [threshold, Object.fromEntries(SIGNAL_COUNTS.map((count) => [count, []]))]))])) as unknown as ForecastMatrix;
}

/**
 * Builds a versioned deterministic forecast bundle fixture for cache validation, locking, fallback, and pruning assertions.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
function bundle(dayTrt: string): ForecastBundle {
  return {
    model: FORECAST_MODEL,
    dayTrt,
    generatedAtUtc: `${dayTrt}T00:00:00.000Z`,
    forecasts: emptyMatrix(),
    recentEarthquakes: Object.fromEntries(RECENT_THRESHOLDS.map((threshold) => [threshold, []])) as unknown as Record<RecentThreshold, RecentEarthquake[]>,
    catalogMetadata: {
      dataUpdatedAtUtc: `${dayTrt}T00:00:00.000Z`,
      newestEventAtUtc: "2026-07-14T09:00:00.000Z",
      oldestEventAtUtc: "1900-01-01T00:00:00.000Z",
      eventCount: 1,
      providerStatus: "current",
      providerMessage: "current",
    },
  };
}

/**
 * Creates an isolated temporary cache directory and registers deterministic cleanup after the current test.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
async function directory(): Promise<string> {
  const value = await fs.mkdtemp(path.join(os.tmpdir(), "forecast-store-test-"));
  directories.push(value);
  return value;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((value) => fs.rm(value, { recursive: true, force: true })));
});

describe("forecast bundle store", () => {
  test("round-trips valid bundles and selects the latest stale day", async () => {
    const temporaryDirectory = await directory();
    const store = createForecastBundleStore({ temporaryDirectory });
    await store.write(bundle("2026-07-13"));
    await store.write(bundle("2026-07-14"));
    expect((await store.read("2026-07-14"))?.dayTrt).toBe("2026-07-14");
    expect((await store.findLatest("2026-07-15"))?.dayTrt).toBe("2026-07-14");
  });

  test("coalesces work through the local lock", async () => {
    const temporaryDirectory = await directory();
    const store = createForecastBundleStore({ temporaryDirectory, pollMilliseconds: 2, waitMilliseconds: 1_000 });
    const task = vi.fn(async () => {
      const value = bundle("2026-07-14");
      await new Promise((resolve) => setTimeout(resolve, 20));
      await store.write(value);
      return value;
    });
    const [left, right] = await Promise.all([store.runExclusive("2026-07-14", task), store.runExclusive("2026-07-14", task)]);
    expect(left.dayTrt).toBe(right.dayTrt);
    expect(task).toHaveBeenCalledTimes(1);
  });

  test("rejects malformed cached JSON", async () => {
    const temporaryDirectory = await directory();
    const store = createForecastBundleStore({ temporaryDirectory });
    await fs.writeFile(path.join(temporaryDirectory, `${FORECAST_FILE_PREFIX}-2026-07-14-malformed.json`), "{}");
    expect(await store.read("2026-07-14")).toBeNull();
  });

  test("writes immutable daily B2 candidates under a versioned prefix", async () => {
    const temporaryDirectory = await directory();
    const writeFile = vi.fn(async (_filePath: string, _key: string, _body: string) => true);
    const store = createForecastBundleStore({ temporaryDirectory, writeFile });
    await store.write(bundle("2026-07-14"));
    const [localPath, key] = writeFile.mock.calls[0];
    expect(path.basename(localPath)).toMatch(new RegExp(`^${FORECAST_FILE_PREFIX}-2026-07-14-[0-9a-f-]+\\.json$`));
    expect(key).toBe(`${FORECAST_CACHE_PREFIX}/${path.basename(localPath)}`);
    expect(FORECAST_CACHE_PREFIX).toBe("forecasts/daily-v3.9");
  });

  test("selects the candidate with greater catalogue coverage regardless of write order", async () => {
    const temporaryDirectory = await directory();
    const store = createForecastBundleStore({ temporaryDirectory });
    const complete = bundle("2026-07-14");
    complete.catalogMetadata.eventCount = 2;
    await store.write(complete);
    await store.write(bundle("2026-07-14"));
    expect((await store.read("2026-07-14"))?.catalogMetadata.eventCount).toBe(2);
  });
});
