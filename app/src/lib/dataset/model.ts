import { CATEGORY_ORDER, type ContractRecord } from '../contract/schema';
import { allocationStatus, type AllocationStatus } from '../finance/allocation';
import { reconcileContribution, type Reconciliation } from '../finance/contribution';
import { dataState, type DataState } from '../finance/staleness';
import { growthIndex, type MonthPoint } from '../finance/returns';

/** Typed dataset model derived from contract records — the only shape views consume. */

export interface PeriodTriple {
  label: string;
  periodStart: string;
  periodEnd: string;
  portfolio: number | null;
  benchmark: number | null;
  hurdle: number | null;
  excess: number | null;
}

export interface ContributionEntry {
  categoryId: string;
  value: number;
}

export interface MarketPoint {
  date: string;
  close: number | null;
}

export interface ProxyStrip {
  proxyId: string;
  category: string;
  lastReturn: number | null;
  state: DataState;
  lastDate: string | null;
}

export interface PublicReference {
  recordId: string;
  metric: string;
  entity: string;
  value: number | null;
  unit: string;
  asOf: string;
  pageTable: string;
  provider: string;
}

export interface CheckEntry {
  id: string;
  status: string;
  note: string;
}

export interface DatasetMeta {
  entityId: string;
  asOf: string;
  schemaVersion: string;
  sourceType: string;
  recordCount: number;
  classificationCounts: Record<string, number>;
}

export interface Dataset {
  meta: DatasetMeta;
  monthlyPortfolio: Map<string, MonthPoint[]>; // categoryId (+TOTAL) -> sorted series
  monthlyBenchmark: Map<string, MonthPoint[]>;
  growthPortfolio: { monthEnd: string; index: number | null }[];
  growthBenchmark: { monthEnd: string; index: number | null }[];
  periods: PeriodTriple[];
  contributions: ContributionEntry[];
  reconciliation: Reconciliation | null;
  allocation: AllocationStatus[];
  totalEmvMm: number | null;
  market: Map<string, MarketPoint[]>;
  proxyStrip: ProxyStrip[];
  publicReferences: PublicReference[];
  checks: CheckEntry[];
}

const PERIOD_LABELS: Record<string, string> = {
  '1M': '1 month',
  QTD: 'Quarter to date',
  FYTD: 'Fiscal YTD (= 1Y)',
};

function num(v: number | string | null): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function buildDataset(records: ContractRecord[], sourceType: string): Dataset {
  const returnsAsOf = records
    .filter((r) => r.record_type === 'monthly_return')
    .map((r) => r.as_of_date)
    .sort();
  const asOf = returnsAsOf[returnsAsOf.length - 1] ?? '';
  const entityId =
    records.find((r) => r.record_type !== 'public_reference' && r.record_type !== 'market_close')
      ?.entity_id ?? 'unknown';
  const schemaVersion = records[0]?.schema_version ?? '?';

  const classificationCounts: Record<string, number> = {};
  for (const r of records) {
    classificationCounts[r.classification] = (classificationCounts[r.classification] ?? 0) + 1;
  }

  // monthly series
  const monthlyPortfolio = new Map<string, MonthPoint[]>();
  const monthlyBenchmark = new Map<string, MonthPoint[]>();
  for (const r of records) {
    const target =
      r.record_type === 'monthly_return'
        ? monthlyPortfolio
        : r.record_type === 'monthly_benchmark_return'
          ? monthlyBenchmark
          : null;
    if (!target || !r.period_end) continue;
    const arr = target.get(r.category_id) ?? [];
    arr.push({ monthEnd: r.period_end, value: num(r.value) });
    target.set(r.category_id, arr);
  }
  for (const m of [monthlyPortfolio, monthlyBenchmark]) {
    for (const arr of m.values()) arr.sort((a, b) => a.monthEnd.localeCompare(b.monthEnd));
  }

  const growthPortfolio = growthIndex(monthlyPortfolio.get('TOTAL') ?? []);
  const growthBenchmark = growthIndex(monthlyBenchmark.get('TOTAL') ?? []);

  // period aggregates
  const periodRecs = records.filter((r) => r.record_type === 'period_return');
  const byType = new Map<
    string,
    { port?: number | null; bench?: number | null; hurdle?: number | null; ps: string; pe: string }
  >();
  for (const r of periodRecs) {
    const entry = byType.get(r.period_type) ?? { ps: r.period_start, pe: r.period_end };
    if (r.metric_id === 'net_return') entry.port = num(r.value);
    if (r.metric_id === 'bench_return') entry.bench = num(r.value);
    if (r.metric_id === 'hurdle_return') entry.hurdle = num(r.value);
    byType.set(r.period_type, entry);
  }
  const periods: PeriodTriple[] = ['1M', 'QTD', 'FYTD']
    .filter((t) => byType.has(t))
    .map((t) => {
      const e = byType.get(t)!;
      const port = e.port ?? null;
      const bench = e.bench ?? null;
      return {
        label: PERIOD_LABELS[t] ?? t,
        periodStart: e.ps,
        periodEnd: e.pe,
        portfolio: port,
        benchmark: bench,
        hurdle: e.hurdle ?? null,
        excess: port !== null && bench !== null ? port - bench : null,
      };
    });

  // contribution + reconciliation
  const contribRecs = records.filter((r) => r.record_type === 'contribution_qtd');
  const contributions: ContributionEntry[] = contribRecs
    .filter((r) => r.metric_id === 'contribution' && typeof r.value === 'number')
    .map((r) => ({ categoryId: r.category_id, value: r.value as number }))
    .sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.categoryId as (typeof CATEGORY_ORDER)[number]) -
        CATEGORY_ORDER.indexOf(b.categoryId as (typeof CATEGORY_ORDER)[number]),
    );
  const chain = num(contribRecs.find((r) => r.metric_id === 'return_chain_linked')?.value ?? null);
  const reconciliation =
    chain !== null && contributions.length > 0
      ? reconcileContribution(
          contributions.map((c) => ({ categoryId: c.categoryId, contribution: c.value })),
          chain,
        )
      : null;

  // allocation
  const allocRecs = records.filter((r) => r.record_type === 'allocation');
  const byCat = new Map<
    string,
    { emv?: number | null; actual?: number | null; target?: number | null; ou?: number | null }
  >();
  for (const r of allocRecs) {
    const e = byCat.get(r.category_id) ?? {};
    if (r.metric_id === 'emv') e.emv = num(r.value);
    if (r.metric_id === 'weight_actual') e.actual = num(r.value);
    if (r.metric_id === 'weight_target') e.target = num(r.value);
    if (r.metric_id === 'over_under_pct') e.ou = num(r.value);
    byCat.set(r.category_id, e);
  }
  const totalEmvMm = [...byCat.values()].reduce<number | null>(
    (a, e) => (a === null || e.emv == null ? (e.emv == null ? a : (a ?? 0) + e.emv) : a + e.emv),
    0,
  );
  const allocation = allocationStatus(
    [...byCat.entries()]
      .sort(
        (a, b) =>
          CATEGORY_ORDER.indexOf(a[0] as (typeof CATEGORY_ORDER)[number]) -
          CATEGORY_ORDER.indexOf(b[0] as (typeof CATEGORY_ORDER)[number]),
      )
      .map(([categoryId, e]) => ({
        categoryId,
        emvMm: e.emv ?? null,
        actualWeight: e.actual ?? null,
        targetWeight: e.target ?? null,
        overUnderPct: e.ou ?? null,
      })),
    totalEmvMm,
  );

  // market strip
  const market = new Map<string, MarketPoint[]>();
  const proxyCategory = new Map<string, string>();
  for (const r of records) {
    if (r.record_type !== 'market_close') continue;
    const arr = market.get(r.category_id) ?? [];
    arr.push({ date: r.as_of_date, close: num(r.value) });
    market.set(r.category_id, arr);
    if (r.note) proxyCategory.set(r.category_id, r.note);
  }
  const allDates = [...market.values()].flat().map((p) => p.date);
  const lastMarketDate = allDates.sort()[allDates.length - 1] ?? asOf;
  const proxyStrip: ProxyStrip[] = [...market.entries()].map(([proxyId, points]) => {
    points.sort((a, b) => a.date.localeCompare(b.date));
    const present = points.filter((p) => p.close !== null);
    const last = present[present.length - 1];
    const prev = present[present.length - 2];
    const lastPoint = points[points.length - 1];
    const missingAtEnd = lastPoint !== undefined && lastPoint.close === null;
    const state = dataState(missingAtEnd, last?.date ?? asOf, lastMarketDate, 'Daily');
    return {
      proxyId,
      category: proxyCategory.get(proxyId) ?? '',
      lastReturn: last && prev && prev.close ? last.close! / prev.close - 1 : null,
      state,
      lastDate: last?.date ?? null,
    };
  });

  // public references & checks
  const publicReferences: PublicReference[] = records
    .filter((r) => r.record_type === 'public_reference')
    .map((r) => ({
      recordId: r.record_id,
      metric: r.metric_id,
      entity: r.entity_id,
      value: num(r.value),
      unit: r.unit,
      asOf: r.as_of_date,
      pageTable: r.page_table,
      provider: r.provider,
    }));
  const checks: CheckEntry[] = records
    .filter((r) => r.record_type === 'check_result')
    .map((r) => ({ id: r.metric_id, status: String(r.value), note: r.page_table }));

  return {
    meta: {
      entityId,
      asOf,
      schemaVersion,
      sourceType,
      recordCount: records.length,
      classificationCounts,
    },
    monthlyPortfolio,
    monthlyBenchmark,
    growthPortfolio,
    growthBenchmark,
    periods,
    contributions,
    reconciliation,
    allocation,
    totalEmvMm,
    market,
    proxyStrip,
    publicReferences,
    checks,
  };
}
