/**
 * @fileoverview Defines the dashboard state dashboard UI module, separating typed rendering and browser interaction from unrelated server and model concerns.
 */
import type { ForecastMethod, MagnitudeThreshold, RecentCount, RecentThreshold, SignalCount } from "@/lib/types";

export interface DashboardSelectionState {
  threshold: MagnitudeThreshold;
  forecastMethod: ForecastMethod;
  signalCount: SignalCount;
  recentThreshold: RecentThreshold;
  recentCount: RecentCount;
  selectedRecentIds: Set<string>;
}

export type DashboardSelectionAction =
  | { type: "threshold"; value: MagnitudeThreshold }
  | { type: "method"; value: ForecastMethod }
  | { type: "signalCount"; value: SignalCount }
  | { type: "recentThreshold"; value: RecentThreshold }
  | { type: "recentCount"; value: RecentCount }
  | { type: "toggleRecent"; id: string }
  | { type: "toggleAllRecent"; ids: string[] };

export const initialDashboardSelection: DashboardSelectionState = {
  threshold: 7,
  forecastMethod: "combined",
  signalCount: 50,
  recentThreshold: 3,
  recentCount: 10,
  selectedRecentIds: new Set(),
};

/**
 * Performs the dashboard selection reducer operation for the dashboard state dashboard UI module, centralizing the calculation, state transition, side effects, and fallback semantics used by callers.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function dashboardSelectionReducer(state: DashboardSelectionState, action: DashboardSelectionAction): DashboardSelectionState {
  if (action.type === "threshold") return { ...state, threshold: action.value, forecastMethod: action.value === 5 && state.forecastMethod === "recurrence" ? "combined" : state.forecastMethod };
  if (action.type === "method") return { ...state, forecastMethod: action.value === "recurrence" && state.threshold === 5 ? "combined" : action.value };
  if (action.type === "signalCount") return { ...state, signalCount: action.value };
  if (action.type === "recentThreshold") return { ...state, recentThreshold: action.value };
  if (action.type === "recentCount") return { ...state, recentCount: action.value };
  const selectedRecentIds = new Set(state.selectedRecentIds);
  if (action.type === "toggleRecent") {
    if (selectedRecentIds.has(action.id)) selectedRecentIds.delete(action.id);
    else selectedRecentIds.add(action.id);
  } else {
    const allSelected = action.ids.length > 0 && action.ids.every((id) => selectedRecentIds.has(id));
    for (const id of action.ids) {
      if (allSelected) selectedRecentIds.delete(id);
      else selectedRecentIds.add(id);
    }
  }
  return { ...state, selectedRecentIds };
}
