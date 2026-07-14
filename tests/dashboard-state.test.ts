/**
 * @fileoverview Defines the dashboard state.test Vitest specification, documenting expected success, failure, edge-case, and regression behavior without modifying immutable catalogue data.
 */
import { describe, expect, test } from "vitest";
import { dashboardSelectionReducer, initialDashboardSelection } from "@/components/dashboard-state";

describe("dashboard selection reducer", () => {
  test("keeps recurrence unavailable for M5 without mutating prior state", () => {
    const recurrence = dashboardSelectionReducer(initialDashboardSelection, { type: "method", value: "recurrence" });
    const next = dashboardSelectionReducer(recurrence, { type: "threshold", value: 5 });
    expect(next.forecastMethod).toBe("combined");
    expect(next.threshold).toBe(5);
    expect(recurrence.forecastMethod).toBe("recurrence");
    expect(initialDashboardSelection.threshold).toBe(7);
  });

  test("toggles individual and visible recent earthquakes immutably", () => {
    const first = dashboardSelectionReducer(initialDashboardSelection, { type: "toggleRecent", id: "a" });
    const all = dashboardSelectionReducer(first, { type: "toggleAllRecent", ids: ["a", "b"] });
    const cleared = dashboardSelectionReducer(all, { type: "toggleAllRecent", ids: ["a", "b"] });
    expect(first.selectedRecentIds).toEqual(new Set(["a"]));
    expect(all.selectedRecentIds).toEqual(new Set(["a", "b"]));
    expect(cleared.selectedRecentIds.size).toBe(0);
    expect(initialDashboardSelection.selectedRecentIds.size).toBe(0);
  });
});
