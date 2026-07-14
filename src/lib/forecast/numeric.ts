/**
 * @fileoverview Implements the numeric stage of the forecast engine with deterministic catalogue-only calculations shared by every forecast method and magnitude threshold.
 */
// ---------------------------------------------------------------------------
// Pure numeric helpers used throughout the forecast pipeline.
// ---------------------------------------------------------------------------

/**
 * Clamp a value to the inclusive [minimum, maximum] range.
 */
export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/**
 * Sum an array of numbers.  Returns 0 for an empty array.
 */
export function sumArray(values: Float64Array, length: number): number {
  let total = 0;
  for (let index = 0; index < length; index++) {
    total += values[index];
  }
  return total;
}

/**
 * Arithmetic mean of the first `length` elements.
 */
export function meanArray(values: Float64Array, length: number): number {
  if (length === 0) return 0;
  return sumArray(values, length) / length;
}

/**
 * Sample standard deviation (divides by length - 1).
 */
export function standardDeviation(values: Float64Array, length: number, mean?: number): number {
  if (length < 2) return 0;
  const average = mean ?? meanArray(values, length);
  let sumOfSquaredDeviations = 0;
  for (let index = 0; index < length; index++) {
    const deviation = values[index] - average;
    sumOfSquaredDeviations += deviation * deviation;
  }
  return Math.sqrt(sumOfSquaredDeviations / (length - 1));
}

/**
 * Compute both mean and standard deviation in a single pass.
 */
export function meanAndStandardDeviation(
  values: Float64Array,
  length: number,
): { mean: number; standardDeviation: number } {
  if (length === 0) return { mean: 0, standardDeviation: 0 };
  let sum = 0;
  let sumOfSquares = 0;
  for (let index = 0; index < length; index++) {
    const value = values[index];
    sum += value;
    sumOfSquares += value * value;
  }
  const mean = sum / length;
  if (length < 2) return { mean, standardDeviation: 0 };
  const variance = (sumOfSquares - (sum * sum) / length) / (length - 1);
  return { mean, standardDeviation: Math.sqrt(Math.max(0, variance)) };
}

/**
 * Numerically stable summation of exponential values (log-sum-exp trick).
 * Returns log(Σ exp(values_i)).
 */
export function logSumExp(values: Float64Array, length: number): number {
  if (length === 0) return -Infinity;
  let maximum = -Infinity;
  for (let index = 0; index < length; index++) {
    if (values[index] > maximum) maximum = values[index];
  }
  if (!Number.isFinite(maximum)) return maximum;
  let sum = 0;
  for (let index = 0; index < length; index++) {
    sum += Math.exp(values[index] - maximum);
  }
  return maximum + Math.log(sum);
}

/**
 * Standard normal (Gaussian) cumulative distribution function.
 * Uses the Abramowitz & Stegun approximation (error < 7.5e-8).
 */
export function normalCDF(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const absoluteZ = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * absoluteZ);
  const polynomial = 0.254829592 * t + (-0.284496736) * t * t + 1.421413741 * t ** 3 + (-1.453152027) * t ** 4 + 1.061405429 * t ** 5;
  const erf = 1 - polynomial * Math.exp(-absoluteZ * absoluteZ);
  return 0.5 * (1 + sign * erf);
}

/**
 * Inverse of the standard normal CDF using the Beasley-Springer-Moro approximation.
 * For p ∈ (0, 1).
 */
export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  let u = p - 0.5;
  if (Math.abs(u) < 0.42) {
    const r = u * u;
    return u * ((-25.44106049637 * r + 41.39119773534) * r + -18.61500062529) * r /
      ((((2.50662823884 * r + -53.85502266596) * r + 322.9852970254) * r + -729.5293341541) * r + 317.4678078174);
  }
  const r = u < 0 ? p : 1 - p;
  const s = Math.log(-Math.log(r));
  const t = 2.515517 + s * (0.802853 + s * 0.010328);
  const d = 1 + s * (1.432788 + s * (0.189269 + s * 0.001308));
  return u < 0 ? d / t - t / d : t / d - d / t;
}

/**
 * Linear regression: y = slope * x + intercept.
 * Returns { slope, intercept, rSquared }.
 */
export function linearRegression(
  xValues: Float64Array,
  yValues: Float64Array,
  count: number,
): { slope: number; intercept: number; rSquared: number } {
  if (count < 2) return { slope: 0, intercept: 0, rSquared: 0 };
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;
  for (let index = 0; index < count; index++) {
    const x = xValues[index];
    const y = yValues[index];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
    sumYY += y * y;
  }
  const denominator = count * sumXX - sumX * sumX;
  if (denominator === 0) return { slope: 0, intercept: sumY / count, rSquared: 0 };
  const slope = (count * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / count;
  const numeratorRSquared = count * sumXY - sumX * sumY;
  const denominatorRSquared = (count * sumXX - sumX * sumX) * (count * sumYY - sumY * sumY);
  const rSquared = denominatorRSquared > 0
    ? (numeratorRSquared * numeratorRSquared) / denominatorRSquared
    : 0;
  return { slope, intercept, rSquared };
}

/**
 * Round to a given number of decimal places.
 */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
