import type { ContractRecord } from '../contract/schema';

/**
 * Reconciliation pairs (schema 1.3). Two recon_value rows — one per source — share
 * (entity, metric, category, as_of); the variance is ALWAYS computed here, never imported,
 * and the threshold comes from tolerance_definition records: tolerance-as-data, no settings
 * store. The custodian remains the official book of record throughout.
 */

export interface ReconSide {
  source: string;
  value: number | null;
  enteredBy: string;
  reviewStatus: string;
}

export type ReconStatus = 'within' | 'outside' | 'incomplete' | 'no_tolerance';

export interface ReconPair {
  metricId: string;
  categoryId: string;
  asOf: string;
  unit: string;
  sides: ReconSide[];
  /** |side A − side B|, computed; null while incomplete */
  variance: number | null;
  toleranceAbs: number | null;
  status: ReconStatus;
  /** days from as_of to the dataset reference date */
  ageDays: number | null;
}

function num(v: number | string | null): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function buildReconPairs(
  records: readonly ContractRecord[],
  refDate: string | null,
): ReconPair[] {
  const tolerances = new Map<string, number>();
  for (const r of records) {
    if (r.record_type === 'tolerance_definition') {
      const v = num(r.value);
      if (v !== null && v >= 0) tolerances.set(r.metric_id, v);
    }
  }

  const byKey = new Map<string, ContractRecord[]>();
  for (const r of records) {
    if (r.record_type !== 'recon_value') continue;
    const k = `${r.metric_id}|${r.category_id}|${r.as_of_date}`;
    const arr = byKey.get(k) ?? [];
    arr.push(r);
    byKey.set(k, arr);
  }

  const pairs: ReconPair[] = [];
  for (const rows of byKey.values()) {
    const first = rows[0]!;
    const sides: ReconSide[] = rows
      .map((r) => ({
        source: r.source_name,
        value: num(r.value),
        enteredBy: r.entered_by,
        reviewStatus: r.review_status || 'n/a',
      }))
      .sort((a, b) => a.source.localeCompare(b.source));
    const toleranceAbs = tolerances.get(first.metric_id) ?? null;
    const complete = sides.length === 2 && sides.every((s) => s.value !== null);
    const variance = complete ? Math.abs(sides[0]!.value! - sides[1]!.value!) : null;
    const status: ReconStatus = !complete
      ? 'incomplete'
      : toleranceAbs === null
        ? 'no_tolerance'
        : variance! <= toleranceAbs
          ? 'within'
          : 'outside';
    const age =
      refDate !== null
        ? Math.round((Date.parse(refDate) - Date.parse(first.as_of_date)) / 86400000)
        : null;
    pairs.push({
      metricId: first.metric_id,
      categoryId: first.category_id,
      asOf: first.as_of_date,
      unit: first.unit,
      sides,
      variance,
      toleranceAbs,
      status,
      ageDays: age !== null && age >= 0 ? age : null,
    });
  }
  // breaks first, then incomplete, then the rest; stable by metric/category
  const order: Record<ReconStatus, number> = {
    outside: 0,
    incomplete: 1,
    no_tolerance: 2,
    within: 3,
  };
  return pairs.sort(
    (a, b) =>
      order[a.status] - order[b.status] ||
      a.metricId.localeCompare(b.metricId) ||
      a.categoryId.localeCompare(b.categoryId),
  );
}
