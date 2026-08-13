/** Allocation vs effective-dated policy targets with explicit min/max bands. */

export interface AllocationRow {
  categoryId: string;
  emvMm: number | null;
  actualWeight: number | null;
  targetWeight: number | null;
  /** recomputed upstream as actual − target; never trusted from an import */
  overUnderPct: number | null;
}

export interface PolicyBandLimits {
  min: number;
  max: number;
}

export interface AllocationStatus extends AllocationRow {
  overUnderMm: number | null;
  rangeStatus: 'within' | 'out' | 'n/a';
  /** distance to the nearer policy boundary (decimal); negative when outside the band */
  boundaryDistance: number | null;
  /** within the band but within NEAR_BOUND_THRESHOLD of a boundary — early warning, not a breach */
  nearBound: boolean;
  bandMin: number | null;
  bandMax: number | null;
}

/** Early-warning distance: 1.0 pp inside a policy bound. Constant until thresholds are
 *  data-driven (tolerance_definition, planned with the Reconciliation work). */
export const NEAR_BOUND_THRESHOLD = 0.01;

/**
 * Bands are explicit min/max (IPS bands can be asymmetric — Pension Cash is 1% with +2/−1,
 * i.e. 0–3%). `totalEmvMm` must be the FULL total: callers pass null when any sleeve is
 * missing so dollar gaps are suppressed rather than computed from a partial total.
 */
export function allocationStatus(
  rows: readonly AllocationRow[],
  totalEmvMm: number | null,
  limits: Record<string, PolicyBandLimits>,
): AllocationStatus[] {
  return rows.map((r) => {
    const band = limits[r.categoryId];
    let rangeStatus: AllocationStatus['rangeStatus'] = 'n/a';
    let boundaryDistance: number | null = null;
    if (band && r.actualWeight !== null) {
      const within = r.actualWeight >= band.min && r.actualWeight <= band.max;
      rangeStatus = within ? 'within' : 'out';
      boundaryDistance = Math.min(r.actualWeight - band.min, band.max - r.actualWeight);
    }
    const overUnderMm =
      r.overUnderPct !== null && totalEmvMm !== null ? r.overUnderPct * totalEmvMm : null;
    return {
      ...r,
      overUnderMm,
      rangeStatus,
      boundaryDistance,
      nearBound:
        rangeStatus === 'within' &&
        boundaryDistance !== null &&
        boundaryDistance <= NEAR_BOUND_THRESHOLD,
      bandMin: band ? band.min : null,
      bandMax: band ? band.max : null,
    };
  });
}

/** Weights must sum to 1 within tolerance (import rule V13 re-checked at display). */
export function weightsSumOk(rows: readonly AllocationRow[], tol = 1e-4): boolean {
  const s = rows.reduce((a, r) => a + (r.actualWeight ?? 0), 0);
  return Math.abs(s - 1) <= tol;
}
