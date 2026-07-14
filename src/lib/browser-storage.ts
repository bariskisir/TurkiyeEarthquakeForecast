/**
 * Reads stored value for the browser storage application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function readStoredValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Writes stored value for the browser storage application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function writeStoredValue(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads stored json for the browser storage application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function readStoredJson<T>(key: string, valid: (value: unknown) => value is T): T | null {
  const stored = readStoredValue(key);
  if (!stored) return null;
  try {
    const value = JSON.parse(stored) as unknown;
    return valid(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Writes stored json for the browser storage application service module, including the validation and edge cases encoded by its typed contract.
 *
 * Keeping this behavior in a named unit makes its inputs, outputs, side effects, and fallback semantics independently reviewable and testable.
 */
export function writeStoredJson(key: string, value: unknown): boolean {
  return writeStoredValue(key, JSON.stringify(value));
}
