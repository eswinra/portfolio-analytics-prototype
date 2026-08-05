/** Pure return mathematics. All returns are decimal fractions (0.0417 = 4.17%). */

export interface MonthPoint {
  /** ISO month-end date */
  monthEnd: string;
  /** monthly return, or null when missing */
  value: number | null;
}

/** Chain-link a list of period returns: Π(1+r) − 1. Returns null if any input is missing. */
export function chainLink(returns: readonly (number | null)[]): number | null {
  if (returns.length === 0) return null;
  let g = 1;
  for (const r of returns) {
    if (r === null || !Number.isFinite(r)) return null;
    g *= 1 + r;
  }
  return g - 1;
}

/** Cumulative growth index (base 1.0) for charting; breaks (null) propagate. */
export function growthIndex(
  points: readonly MonthPoint[],
): { monthEnd: string; index: number | null }[] {
  let g: number | null = 1;
  return points.map((p) => {
    if (g === null || p.value === null) {
      g = null;
      return { monthEnd: p.monthEnd, index: null };
    }
    g = g * (1 + p.value);
    return { monthEnd: p.monthEnd, index: g };
  });
}

/**
 * Period return over the trailing `n` months of a sorted monthly series.
 * Returns null when the series is shorter than n or contains gaps in the window.
 */
export function trailingReturn(points: readonly MonthPoint[], n: number): number | null {
  if (n <= 0 || points.length < n) return null;
  const window = points.slice(points.length - n);
  return chainLink(window.map((p) => p.value));
}

/** Excess return: portfolio minus benchmark; null if either side missing. */
export function excessReturn(portfolio: number | null, benchmark: number | null): number | null {
  if (portfolio === null || benchmark === null) return null;
  return portfolio - benchmark;
}

/** Geometric scaling of an annual rate to a shorter period (months of 12). */
export function scaleAnnualRate(annual: number, months: number): number {
  return Math.pow(1 + annual, months / 12) - 1;
}

/**
 * Periods must match exactly for portfolio-vs-benchmark comparison.
 * Returns true only when start, end, and period type all align.
 */
export function periodsComparable(
  a: { period_start: string; period_end: string; period_type: string },
  b: { period_start: string; period_end: string; period_type: string },
): boolean {
  return (
    a.period_start === b.period_start &&
    a.period_end === b.period_end &&
    a.period_type === b.period_type
  );
}
