/**
 * @fileoverview Implements the selection stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
import type { ThresholdCellField } from "./types";
import { MIN_CANDIDATE_SEPARATION_CELLS } from "./config";

/**
 * Selects candidates spatially for the selection stage of the forecast engine, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function selectCandidatesSpatially(
  candidates: readonly ThresholdCellField[],
  maxCount: number,
  primaryScoreFn: (cell: ThresholdCellField) => number = (cell) => cell.rawCompositeScore,
  minSeparationCells: number = MIN_CANDIDATE_SEPARATION_CELLS,
): ThresholdCellField[] {
  const sorted = [...candidates].sort((left, right) => {
    const scoreDifference = primaryScoreFn(right) - primaryScoreFn(left);
    return Number.isNaN(scoreDifference) || scoreDifference === 0
      ? left.gridRow - right.gridRow || left.gridCol - right.gridCol
      : scoreDifference;
  });
  const selected: ThresholdCellField[] = [];

  for (const candidate of sorted) {
    if (!Number.isFinite(primaryScoreFn(candidate))) continue;
    const tooClose = selected.some(
      (existing) =>
        Math.hypot(existing.gridRow - candidate.gridRow, existing.gridCol - candidate.gridCol) <
        minSeparationCells,
    );
    if (tooClose) continue;
    selected.push(candidate);
    if (selected.length >= maxCount) break;
  }

  return selected;
}
