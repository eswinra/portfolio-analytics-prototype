import type { ContractRecord } from '../contract/schema';

/**
 * Private-markets monitoring (schema 1.3). Files carry only the primitives — commitment,
 * called, distributed, NAV — and every ratio is COMPUTED here: unfunded = commitment − called,
 * DPI = distributed / called, TVPI = (distributed + NAV) / called. Ratios are null (never 0)
 * when called capital is zero. Valuation lag travels with the NAV row and is always shown.
 */

export interface PmSleeve {
  sleeveId: string;
  commitmentMm: number | null;
  calledMm: number | null;
  distributedMm: number | null;
  navMm: number | null;
  /** computed: commitment − called (null when either primitive is missing) */
  unfundedMm: number | null;
  /** computed: distributed / called */
  dpi: number | null;
  /** computed: (distributed + NAV) / called */
  tvpi: number | null;
  valuationStatus: string;
  lagNote: string;
}

function num(v: number | string | null): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function buildPmSleeves(records: readonly ContractRecord[]): PmSleeve[] {
  const bySleeve = new Map<
    string,
    Partial<Record<string, number | null>> & { vs?: string; note?: string }
  >();
  for (const r of records) {
    if (r.record_type !== 'pm_commitment' && r.record_type !== 'pm_capital_account') continue;
    const e = bySleeve.get(r.category_id) ?? {};
    e[r.metric_id] = num(r.value);
    if (r.metric_id === 'nav') {
      e.vs = r.valuation_status;
      e.note = r.note;
    }
    bySleeve.set(r.category_id, e);
  }
  return [...bySleeve.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([sleeveId, e]) => {
      const commitment = e['commitment_total'] ?? null;
      const called = e['called_itd'] ?? null;
      const distributed = e['distributed_itd'] ?? null;
      const nav = e['nav'] ?? null;
      const unfunded = commitment !== null && called !== null ? commitment - called : null;
      const dpi =
        called !== null && called > 0 && distributed !== null ? distributed / called : null;
      const tvpi =
        called !== null && called > 0 && distributed !== null && nav !== null
          ? (distributed + nav) / called
          : null;
      return {
        sleeveId,
        commitmentMm: commitment,
        calledMm: called,
        distributedMm: distributed,
        navMm: nav,
        unfundedMm: unfunded,
        dpi,
        tvpi,
        valuationStatus: e.vs ?? 'n/a',
        lagNote: e.note ?? '',
      };
    });
}
