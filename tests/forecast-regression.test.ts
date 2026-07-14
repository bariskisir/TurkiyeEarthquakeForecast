/**
 * @fileoverview Defines the forecast regression.test Vitest specification, documenting expected success, failure, edge-case, and regression behavior without modifying immutable catalogue data.
 */
import { describe, expect, test } from "vitest";
import { calculateForecasts } from "@/lib/forecast";
import type { ForecastMethod, MagnitudeThreshold } from "@/lib/types";
import { createForecastCatalog, REFERENCE_TIMESTAMP } from "./fixtures/catalog";

const cases: [ForecastMethod, MagnitudeThreshold][] = [
  ["combined", 5], ["combined", 6], ["combined", 7],
  ["poisson", 5], ["poisson", 6], ["poisson", 7],
  ["etas", 5], ["etas", 6], ["etas", 7],
  ["triggered", 5], ["triggered", 6], ["triggered", 7],
  ["bValue", 5], ["naturalTime", 5], ["energy", 5], ["clustering", 5],
  ["recurrence", 6], ["recurrence", 7],
];

describe("forecast regression", () => {
  test("keeps the supported method and threshold matrix stable", () => {
    const catalog = createForecastCatalog();
    const result = Object.fromEntries(cases.map(([method, threshold]) => [
      `${method}-m${threshold}`,
      calculateForecasts(catalog, threshold, REFERENCE_TIMESTAMP, 8, method).map((point) => ({
        rank: point.rank,
        latitude: point.latitude,
        longitude: point.longitude,
        relativeScore: point.relativeScore,
        level: point.signalLevel,
        background: point.indicators.backgroundRateAnnual,
        triggered: point.indicators.triggeredRateAnnual,
        bValue: point.indicators.bValue,
        recurrence: point.indicators.recurrenceProbability30Years,
        raw: point.indicators.rawCompositeScore,
      })),
    ]));
    expect(result).toMatchSnapshot();
  });
});
