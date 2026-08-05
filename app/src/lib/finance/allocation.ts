/** Allocation vs effective-dated policy targets. */

export interface AllocationRow {
  categoryId: string;
  emvMm: number | null;
  actualWeight: number | null;
  targetWeight: number | null;
  overUnderPct: number | null;
}

export interface AllocationStatus extends AllocationRow {
  overUnderMm: number | null;
  rangeStatus: 'within' | 'out' | 'n/a';
}

/** Demo range half-widths per category (mirrors the workbook Policy_Targets ranges). */
export const RANGE_HALF_WIDTH: Record<string, number> = {
  GROWTH: 0.05,
  CREDIT: 0.03,
  RAIH: 0.03,
  RRM: 0.04,
};

export function allocationStatus(
  rows: readonly AllocationRow[],
  totalEmvMm: number | null,
): AllocationStatus[] {
  return rows.map((r) => {
    const half = RANGE_HALF_WIDTH[r.categoryId];
    let rangeStatus: AllocationStatus['rangeStatus'] = 'n/a';
    if (half !== undefined && r.overUnderPct !== null) {
      rangeStatus = Math.abs(r.overUnderPct) <= half ? 'within' : 'out';
    }
    const overUnderMm =
      r.overUnderPct !== null && totalEmvMm !== null ? r.overUnderPct * totalEmvMm : null;
    return { ...r, overUnderMm, rangeStatus };
  });
}

/** Weights must sum to 1 within tolerance (import rule V13 re-checked at display). */
export function weightsSumOk(rows: readonly AllocationRow[], tol = 1e-4): boolean {
  const s = rows.reduce((a, r) => a + (r.actualWeight ?? 0), 0);
  return Math.abs(s - 1) <= tol;
}
