/**
 * @fileoverview Defines the forecast primitives.test Vitest specification, documenting expected success, failure, edge-case, and regression behavior without modifying immutable catalogue data.
 */
import { describe, expect, test } from "vitest";
import { magnitudeToEnergyJoules, magnitudeToSqrtEnergy } from "@/lib/forecast/energy";
import { cellIndex, columnToLongitude, haversineDistanceKm, indexToRowCol, latitudeToRow, longitudeToColumn, pointInRegion, rowToLatitude } from "@/lib/forecast/geometry";
import { clamp, linearRegression, logSumExp, meanAndStandardDeviation, normalCDF } from "@/lib/forecast/numeric";
import { bptConditionalOccurrenceProbability, poissonMedianWaitingYears, poissonOccurrenceProbability } from "@/lib/forecast/recurrence";
import { scoreToSignalLevel } from "@/lib/forecast/scoring";
import { parseCatalogUtc, calculationDateKey, calculationDateOptions, secondsToIso, secondsUntilNextTurkiyeDay, turkiyeDay } from "@/lib/time";

describe("forecast numeric primitives", () => {
  test("handles bounded arithmetic and stable aggregation", () => {
    expect(clamp(12, 0, 10)).toBe(10);
    expect(logSumExp(new Float64Array([1_000, 1_000]), 2)).toBeCloseTo(1_000 + Math.LN2, 10);
    expect(meanAndStandardDeviation(new Float64Array([1, 2, 3]), 3)).toEqual({ mean: 2, standardDeviation: 1 });
    expect(normalCDF(0)).toBeCloseTo(0.5, 6);
    expect(linearRegression(new Float64Array([1, 2, 3]), new Float64Array([3, 5, 7]), 3)).toEqual({ slope: 2, intercept: 1, rSquared: 1 });
  });

  test("round-trips grid cells and computes regional distances", () => {
    const row = latitudeToRow(40.75);
    const column = longitudeToColumn(29.25);
    expect(indexToRowCol(cellIndex(row, column))).toEqual([row, column]);
    expect(rowToLatitude(row)).toBe(40.75);
    expect(columnToLongitude(column)).toBe(29.25);
    expect(pointInRegion(34, 24)).toBe(true);
    expect(pointInRegion(43, 46)).toBe(false);
    expect(haversineDistanceKm(41.0082, 28.9784, 39.9334, 32.8597)).toBeCloseTo(351, -1);
  });

  test("preserves energy and recurrence model invariants", () => {
    expect(magnitudeToEnergyJoules(6) / magnitudeToEnergyJoules(5)).toBeCloseTo(10 ** 1.5, 8);
    expect(magnitudeToSqrtEnergy(6) ** 2).toBeCloseTo(magnitudeToEnergyJoules(6), -3);
    expect(poissonOccurrenceProbability(0.01, 100)).toBeCloseTo(1 - Math.exp(-1), 12);
    expect(poissonMedianWaitingYears(2)).toBeCloseTo(Math.LN2 / 2, 12);
    expect(bptConditionalOccurrenceProbability(20, 30, 80, 0.6)).toBeGreaterThan(0);
    expect(bptConditionalOccurrenceProbability(20, 30, 80, 0.6)).toBeLessThan(1);
    expect(scoreToSignalLevel(92)).toBe("very high");
    expect(scoreToSignalLevel(64.9)).toBe("elevated");
  });

  test("normalizes catalog timestamps and Türkiye day boundaries", () => {
    const timestamp = parseCatalogUtc("2026-07-14 09:30:00");
    expect(secondsToIso(timestamp)).toBe("2026-07-14T09:30:00.000Z");
    expect(turkiyeDay(new Date("2026-07-14T20:59:59.000Z"))).toBe("2026-07-14");
    expect(turkiyeDay(new Date("2026-07-14T21:00:00.000Z"))).toBe("2026-07-15");
    expect(secondsUntilNextTurkiyeDay(new Date("2026-07-14T20:30:00.000Z"))).toBe(1_800);
  });

  test("merges identical-result pre-1900 ranges into single options covering every year", () => {
    const today = "2026-08-08";
    expect(calculationDateKey("0-1", today)).toBe("0000-01-01");
    expect(calculationDateKey("2-17", today)).toBe("0002-01-01");
    expect(calculationDateKey("7-17", today)).toBeNull();
    expect(calculationDateKey("243-330", today)).toBe("0243-01-01");
    expect(calculationDateKey("243-244", today)).toBeNull();
    expect(calculationDateKey("327-330", today)).toBeNull();
    expect(calculationDateKey("500-521", today)).toBe("0500-01-01");
    expect(calculationDateKey("500-501", today)).toBeNull();
    expect(calculationDateKey("511-521", today)).toBeNull();
    expect(calculationDateKey("1897-1899", today)).toBe("1897-01-01");
    expect(calculationDateKey("1900-1899", today)).toBeNull();
    const options = calculationDateOptions(today);
    expect(options).toContain("0-1");
    expect(options).toContain("2-17");
    expect(options).toContain("243-330");
    expect(options).toContain("1897-1899");
    expect(options).not.toContain("7-17");
    expect(options).not.toContain("243-244");
    expect(options).not.toContain("327-330");
    const covered = new Set<number>();
    for (const option of options) {
      const match = option.match(/^(\d{1,4})(?:-(\d{1,4}))?$/);
      if (!match) continue;
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : start;
      if (start < 1900) for (let year = start; year <= end; year++) covered.add(year);
    }
    for (let year = 0; year <= 1899; year++) expect(covered.has(year)).toBe(true);
  });
});
