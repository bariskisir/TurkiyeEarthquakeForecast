/**
 * @fileoverview Implements the nowcasting stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
import { NOWCAST_M_SMALL, NOWCAST_M_TARGET } from "./config";

/**
 * Computes grnormalisation for the nowcasting stage of the forecast engine, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function computeGRNormalisation(
  bValue: number,
  targetThreshold: number = NOWCAST_M_TARGET,
  smallThreshold: number = NOWCAST_M_SMALL,
): number {
  return 10 ** (bValue * (targetThreshold - smallThreshold));
}

/**
 * Computes natural time progress for the nowcasting stage of the forecast engine, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function computeNaturalTimeProgress(
  smallEventCountSinceTarget: number,
  grNormalisation: number,
  hasHadTargetEvent: boolean,
): number | null {
  if (!hasHadTargetEvent) return null;
  return 1 - Math.exp(-smallEventCountSinceTarget / Math.max(1, grNormalisation));
}
