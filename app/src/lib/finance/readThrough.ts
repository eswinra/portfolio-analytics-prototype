/**
 * Daily policy-weighted proxy read-through — the honest EOD estimate.
 *
 * Sums (policy ½-step weight × proxy daily return) over the classes that have a priced
 * liquid proxy. This is a PROXY ESTIMATE of the market read-through to the fund, never a
 * portfolio return: coverage is expressed in policy-weight terms and unpriced or unmapped
 * classes are excluded and listed, not imputed as zero.
 */

export interface ProxyReturn {
  proxyId: string;
  classId: string;
  classLabel: string;
  weight: number; // policy ½-step weight (decimal)
  dailyReturn: number | null; // null = unpriced today
}

export interface ReadThrough {
  /** Σ weight × return over priced classes — fund-level impact of covered classes */
  fundLevelImpact: number | null;
  /** Σ(w×r) / Σw over priced classes — return of the covered basket */
  coveredBasketReturn: number | null;
  /** Σ weight of priced classes (decimal of total policy weight) */
  coverage: number;
  /** classes with a mapped proxy but no price today */
  unpriced: { classLabel: string; weight: number }[];
  priced: { classLabel: string; weight: number; dailyReturn: number; impact: number }[];
}

export function policyReadThrough(rows: readonly ProxyReturn[]): ReadThrough {
  for (const r of rows) {
    if (!Number.isFinite(r.weight) || r.weight < 0 || r.weight > 1) {
      throw new RangeError(`invalid policy weight ${r.weight} for ${r.classId}`);
    }
  }
  const priced = rows
    .filter((r) => r.dailyReturn !== null && Number.isFinite(r.dailyReturn))
    .map((r) => ({
      classLabel: r.classLabel,
      weight: r.weight,
      dailyReturn: r.dailyReturn as number,
      impact: r.weight * (r.dailyReturn as number),
    }));
  const unpriced = rows
    .filter((r) => r.dailyReturn === null || !Number.isFinite(r.dailyReturn))
    .map((r) => ({ classLabel: r.classLabel, weight: r.weight }));
  const coverage = priced.reduce((a, r) => a + r.weight, 0);
  if (priced.length === 0) {
    return { fundLevelImpact: null, coveredBasketReturn: null, coverage: 0, unpriced, priced };
  }
  const fundLevelImpact = priced.reduce((a, r) => a + r.impact, 0);
  return {
    fundLevelImpact,
    coveredBasketReturn: fundLevelImpact / coverage,
    coverage,
    unpriced,
    priced,
  };
}
