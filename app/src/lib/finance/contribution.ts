/** Contribution reconciliation. Decimal fractions throughout. */

export interface ContributionRow {
  categoryId: string;
  contribution: number;
}

export interface Reconciliation {
  arithmeticTotal: number;
  chainLinked: number;
  residual: number;
  tolerance: number;
  status: 'PASS' | 'FAIL';
}

export const CONTRIBUTION_TOLERANCE = 0.001; // 10 bps, per docs/workbook-methodology.md

/**
 * Reconcile category contributions against the chain-linked period return.
 * The compounding residual is expected and disclosed; it must stay within tolerance.
 */
export function reconcileContribution(
  rows: readonly ContributionRow[],
  chainLinked: number,
  tolerance: number = CONTRIBUTION_TOLERANCE,
): Reconciliation {
  const arithmeticTotal = rows.reduce((a, r) => a + r.contribution, 0);
  const residual = chainLinked - arithmeticTotal;
  return {
    arithmeticTotal,
    chainLinked,
    residual,
    tolerance,
    status: Math.abs(residual) <= tolerance ? 'PASS' : 'FAIL',
  };
}

/**
 * Weighted contribution for one period: beginning weight × return.
 * Guards against invalid weights (must be finite, in [0,1]).
 */
export function weightedContribution(beginningWeight: number, periodReturn: number): number {
  if (!Number.isFinite(beginningWeight) || beginningWeight < 0 || beginningWeight > 1) {
    throw new RangeError(`invalid beginning weight ${beginningWeight}`);
  }
  return beginningWeight * periodReturn;
}
