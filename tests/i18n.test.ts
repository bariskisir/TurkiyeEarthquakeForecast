/**
 * @fileoverview Defines the i18n.test Vitest specification, documenting expected success, failure, edge-case, and regression behavior without modifying immutable catalogue data.
 */
import { describe, expect, test } from "vitest";
import { copy, methodologyCopy } from "@/lib/i18n";

describe("locale parity", () => {
  test("keeps interface and methodology keys aligned", () => {
    expect(Object.keys(copy.tr).sort()).toEqual(Object.keys(copy.en).sort());
    expect(Object.keys(methodologyCopy.tr).sort()).toEqual(Object.keys(methodologyCopy.en).sort());
  });
});
