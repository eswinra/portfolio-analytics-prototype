import { CATEGORY_ORDER, type ContractRecord } from '../contract/schema';
import {
  CATEGORY_TO_POLICY,
  policyFor,
  proxyMapFor,
  type PolicyBand,
  type PolicyEntity,
} from '../../fixtures/policyPack';
import {
  allocationStatus,
  type AllocationStatus,
  type PolicyBandLimits,
} from '../finance/allocation';
import { reconcileContribution, type Reconciliation } from '../finance/contribution';
import { dataState, type DataState } from '../finance/staleness';
import { growthIndex, periodsComparable, type MonthPoint } from '../finance/returns';
import { policyReadThrough, type ReadThrough } from '../finance/readThrough';

/** Typed dataset model derived from contract records — the only shape views consume. */

export interface PeriodTriple {
  label: string;
  periodStart: string;
  periodEnd: string;
  portfolio: number | null;
  benchmark: number | null;
  hurdle: number | null;
  excess: number | null;
  /** true when the benchmark span did not match the portfolio span (excess suppressed) */
  spanMismatch: boolean;
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

export interface JoinedMonth {
  monthEnd: string;
  portfolioReturn: number | null;
  benchmarkReturn: number | null;
  portfolioIndex: number | null;
  benchmarkIndex: number | null;
}

export interface ExceptionItem {
  id: string;
  severity: 'warn' | 'fail';
  description: string;
  impact: string;
  nextAction: string;
}

export interface DatasetMeta {
  entityId: string;
  asOf: string;
  schemaVersion: string;
  sourceType: string;
  recordCount: number;
  classificationCounts: Record<string, number>;
  /** which IPS policy pack scopes this dataset's bands and read-through weights */
  policyEntity: PolicyEntity;
}

export interface Dataset {
  meta: DatasetMeta;
  monthlyPortfolio: Map<string, MonthPoint[]>;
  monthlyBenchmark: Map<string, MonthPoint[]>;
  /** TOTAL series joined by month-end date (never by array position) */
  joinedMonths: JoinedMonth[];
  periods: PeriodTriple[];
  contributions: ContributionEntry[];
  reconciliation: Reconciliation | null;
  allocation: AllocationStatus[];
  /** null when any sleeve EMV is missing — dollar gaps are suppressed, not partial */
  totalEmvMm: number | null;
  emvIncomplete: boolean;
  market: Map<string, MarketPoint[]>;
  proxyStrip: ProxyStrip[];
  marketDate: string | null;
  readThrough: ReadThrough;
  exceptions: ExceptionItem[];
  publicReferences: PublicReference[];
  checks: CheckEntry[];
  /** schema 1.1: number of policy_target records carried by the dataset */
  policyRecordCount: number;
  /** where the allocation bands came from: dataset policy records, or the bundled pack */
  policySource: 'dataset' | 'bundled';
}

const PERIOD_LABELS: Record<string, string> = {
  '1M': '1 month',
  QTD: 'Quarter to date',
  FYTD: 'Fiscal YTD (= 1Y)',
};

function num(v: number | string | null): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Category-level band limits from the selected entity's IPS policy pack (reported_public). */
export function categoryLimits(policyEntity: PolicyEntity): Record<string, PolicyBandLimits> {
  const byId = new Map<string, PolicyBand>(
    policyFor(policyEntity).bands.map((band) => [band.classId, band]),
  );
  const limits: Record<string, PolicyBandLimits> = {};
  for (const [categoryId, policyId] of Object.entries(CATEGORY_TO_POLICY)) {
    const band = byId.get(policyId);
    if (band && !(band.min === 0 && band.max === 0)) {
      limits[categoryId] = { min: band.min, max: band.max };
    }
  }
  return limits;
}

export function buildDataset(
  records: ContractRecord[],
  sourceType: string,
  policyEntity: PolicyEntity = 'PENSION',
): Dataset {
  // ---- entity scoping: the parser rejects multi-entity files (V17); defensively scope anyway
  const portfolioEntities = [
    ...new Set(records.filter((r) => r.record_type !== 'public_reference').map((r) => r.entity_id)),
  ];
  const entityId = portfolioEntities[0] ?? 'unknown';
  const scoped = records.filter(
    (r) => r.record_type === 'public_reference' || r.entity_id === entityId,
  );

  const returnsAsOf = scoped
    .filter((r) => r.record_type === 'monthly_return')
    .map((r) => r.as_of_date)
    .sort();
  const asOf = returnsAsOf[returnsAsOf.length - 1] ?? '';
  const schemaVersion = scoped[0]?.schema_version ?? '?';

  const classificationCounts: Record<string, number> = {};
  for (const r of scoped) {
    classificationCounts[r.classification] = (classificationCounts[r.classification] ?? 0) + 1;
  }

  // ---- monthly series
  const monthlyPortfolio = new Map<string, MonthPoint[]>();
  const monthlyBenchmark = new Map<string, MonthPoint[]>();
  for (const r of scoped) {
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

  // ---- TOTAL series joined strictly by month-end date
  const portTotal = monthlyPortfolio.get('TOTAL') ?? [];
  const benchTotal = monthlyBenchmark.get('TOTAL') ?? [];
  const portIdx = new Map(growthIndex(portTotal).map((p) => [p.monthEnd, p.index]));
  const benchIdx = new Map(growthIndex(benchTotal).map((p) => [p.monthEnd, p.index]));
  const benchRet = new Map(benchTotal.map((p) => [p.monthEnd, p.value]));
  const allMonths = [
    ...new Set([...portTotal.map((p) => p.monthEnd), ...benchTotal.map((p) => p.monthEnd)]),
  ].sort();
  const joinedMonths: JoinedMonth[] = allMonths.map((monthEnd) => ({
    monthEnd,
    portfolioReturn: portTotal.find((p) => p.monthEnd === monthEnd)?.value ?? null,
    benchmarkReturn: benchRet.get(monthEnd) ?? null,
    portfolioIndex: portIdx.get(monthEnd) ?? null,
    benchmarkIndex: benchIdx.get(monthEnd) ?? null,
  }));

  // ---- period aggregates: excess only when the full span matches
  interface PeriodLeg {
    value: number | null;
    ps: string;
    pe: string;
  }
  const legs = new Map<string, Map<string, PeriodLeg>>(); // period_type -> metric -> leg
  for (const r of scoped) {
    if (r.record_type !== 'period_return') continue;
    const byMetric = legs.get(r.period_type) ?? new Map<string, PeriodLeg>();
    byMetric.set(r.metric_id, { value: num(r.value), ps: r.period_start, pe: r.period_end });
    legs.set(r.period_type, byMetric);
  }
  const periods: PeriodTriple[] = ['1M', 'QTD', 'FYTD']
    .filter((t) => legs.has(t))
    .map((t) => {
      const byMetric = legs.get(t)!;
      const port = byMetric.get('net_return');
      const bench = byMetric.get('bench_return');
      const hurdle = byMetric.get('hurdle_return');
      const spanMismatch =
        port !== undefined &&
        bench !== undefined &&
        !periodsComparable(
          { period_start: port.ps, period_end: port.pe, period_type: t },
          { period_start: bench.ps, period_end: bench.pe, period_type: t },
        );
      const portV = port?.value ?? null;
      const benchV = spanMismatch ? null : (bench?.value ?? null);
      return {
        label: PERIOD_LABELS[t] ?? t,
        periodStart: port?.ps ?? bench?.ps ?? '',
        periodEnd: port?.pe ?? bench?.pe ?? '',
        portfolio: portV,
        benchmark: benchV,
        hurdle: hurdle?.value ?? null,
        excess: portV !== null && benchV !== null ? portV - benchV : null,
        spanMismatch,
      };
    });

  // ---- contribution + reconciliation
  const contribRecs = scoped.filter((r) => r.record_type === 'contribution_qtd');
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

  // ---- allocation: derived fields recomputed from primitives; partial totals suppressed
  const allocRecs = scoped.filter((r) => r.record_type === 'allocation');
  const byCat = new Map<
    string,
    { emv?: number | null; actual?: number | null; target?: number | null }
  >();
  for (const r of allocRecs) {
    const e = byCat.get(r.category_id) ?? {};
    if (r.metric_id === 'emv') e.emv = num(r.value);
    if (r.metric_id === 'weight_actual') e.actual = num(r.value);
    if (r.metric_id === 'weight_target') e.target = num(r.value);
    // over_under_pct in the file is deliberately ignored: recomputed below
    byCat.set(r.category_id, e);
  }
  // schema 1.1: category-level bands carried in the dataset override the bundled pack
  const policyRecs = scoped.filter((r) => r.record_type === 'policy_target');
  const datasetLimits: Record<string, PolicyBandLimits> = {};
  {
    const mins = new Map<string, number>();
    const maxs = new Map<string, number>();
    for (const r of policyRecs) {
      if (typeof r.value !== 'number') continue;
      if (r.metric_id === 'policy_min') mins.set(r.category_id, r.value);
      if (r.metric_id === 'policy_max') maxs.set(r.category_id, r.value);
    }
    for (const [cat, min] of mins) {
      const max = maxs.get(cat);
      if (max !== undefined && max >= min) datasetLimits[cat] = { min, max };
    }
  }
  const policySource: 'dataset' | 'bundled' =
    Object.keys(datasetLimits).length > 0 ? 'dataset' : 'bundled';

  const emvValues = [...byCat.values()].map((e) => e.emv ?? null);
  const emvIncomplete = byCat.size > 0 && emvValues.some((v) => v === null);
  const totalEmvMm =
    byCat.size > 0 && !emvIncomplete
      ? emvValues.reduce<number>((a, v) => a + (v as number), 0)
      : null;
  const allocation = allocationStatus(
    [...byCat.entries()]
      .sort(
        (a, b) =>
          CATEGORY_ORDER.indexOf(a[0] as (typeof CATEGORY_ORDER)[number]) -
          CATEGORY_ORDER.indexOf(b[0] as (typeof CATEGORY_ORDER)[number]),
      )
      .map(([categoryId, e]) => {
        const actual = e.actual ?? null;
        const target = e.target ?? null;
        return {
          categoryId,
          emvMm: e.emv ?? null,
          actualWeight: actual,
          targetWeight: target,
          overUnderPct: actual !== null && target !== null ? actual - target : null,
        };
      }),
    totalEmvMm,
    policySource === 'dataset' ? datasetLimits : categoryLimits(policyEntity),
  );

  // ---- market strip + read-through
  const market = new Map<string, MarketPoint[]>();
  const proxyCategory = new Map<string, string>();
  for (const r of scoped) {
    if (r.record_type !== 'market_close') continue;
    const arr = market.get(r.category_id) ?? [];
    arr.push({ date: r.as_of_date, close: num(r.value) });
    market.set(r.category_id, arr);
    if (r.note) proxyCategory.set(r.category_id, r.note);
  }
  const allDates = [...market.values()].flat().map((p) => p.date);
  const marketDate = allDates.sort()[allDates.length - 1] ?? null;
  const proxyStrip: ProxyStrip[] = [...market.entries()].map(([proxyId, points]) => {
    points.sort((a, b) => a.date.localeCompare(b.date));
    const present = points.filter((p) => p.close !== null);
    const last = present[present.length - 1];
    const prev = present[present.length - 2];
    const lastPoint = points[points.length - 1];
    const missingAtEnd = lastPoint !== undefined && lastPoint.close === null;
    const ageState = dataState(false, last?.date ?? asOf, marketDate ?? asOf, 'Daily');
    const state: DataState = ageState === 'stale' ? 'stale' : missingAtEnd ? 'missing' : 'current';
    return {
      proxyId,
      category: proxyCategory.get(proxyId) ?? '',
      lastReturn: last && prev && prev.close ? last.close! / prev.close - 1 : null,
      state,
      lastDate: last?.date ?? null,
    };
  });
  const readThrough = policyReadThrough(
    proxyMapFor(policyEntity).map((m) => {
      const strip = proxyStrip.find((p) => p.proxyId === m.proxyId);
      return {
        proxyId: m.proxyId,
        classId: m.classId,
        classLabel: m.classLabel,
        weight: m.halfStepWeight,
        dailyReturn: strip && strip.state === 'current' ? strip.lastReturn : null,
      };
    }),
  );

  // ---- public references & checks
  const publicReferences: PublicReference[] = scoped
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
  const checks: CheckEntry[] = scoped
    .filter((r) => r.record_type === 'check_result')
    .map((r) => ({ id: r.metric_id, status: String(r.value), note: r.page_table }));

  // ---- exceptions requiring review (derived, staff-analytics labeling)
  const exceptions: ExceptionItem[] = [];
  for (const c of checks) {
    if (c.status === 'WARN' || c.status === 'FAIL') {
      exceptions.push({
        id: c.id,
        severity: c.status === 'FAIL' ? 'fail' : 'warn',
        description: c.note || `Workbook control ${c.id} is ${c.status}`,
        impact: 'Control state travels with the dataset; investigate at the source workbook.',
        nextAction: 'Review the control on the Data quality view.',
      });
    }
  }
  for (const p of proxyStrip) {
    if (p.state !== 'current') {
      exceptions.push({
        id: `MKT-${p.proxyId}`,
        severity: 'warn',
        description: `${p.proxyId} is ${p.state} (last value ${p.lastDate ?? 'n/a'})`,
        impact:
          p.state === 'stale'
            ? 'Excluded from the daily read-through; coverage reduced.'
            : 'Latest close absent; excluded from the daily read-through.',
        nextAction: 'Refresh the market export or confirm the source series.',
      });
    }
  }
  for (const a of allocation) {
    if (a.rangeStatus === 'out') {
      exceptions.push({
        id: `ALLOC-${a.categoryId}`,
        severity: 'fail',
        description: `${a.categoryId} actual weight is outside the IPS policy range`,
        impact: 'Factual report of an out-of-range position; not a trade instruction.',
        nextAction: 'Escalate per rebalancing procedures (IPS §F).',
      });
    }
  }
  for (const p of periods) {
    if (p.spanMismatch) {
      exceptions.push({
        id: `SPAN-${p.label}`,
        severity: 'fail',
        description: `Benchmark period span does not match the portfolio span for ${p.label}`,
        impact: 'Excess return suppressed for this period.',
        nextAction: 'Correct the period records in the source file.',
      });
    }
  }
  if (emvIncomplete) {
    exceptions.push({
      id: 'EMV-PARTIAL',
      severity: 'fail',
      description: 'One or more sleeve market values are missing',
      impact: 'Total EMV and dollar policy gaps are suppressed (no partial totals).',
      nextAction: 'Supply the missing allocation records.',
    });
  }

  return {
    meta: {
      entityId,
      asOf,
      schemaVersion,
      sourceType,
      recordCount: scoped.length,
      classificationCounts,
      policyEntity,
    },
    monthlyPortfolio,
    monthlyBenchmark,
    joinedMonths,
    periods,
    contributions,
    reconciliation,
    allocation,
    totalEmvMm,
    emvIncomplete,
    market,
    proxyStrip,
    marketDate,
    readThrough,
    exceptions,
    publicReferences,
    checks,
    policyRecordCount: policyRecs.length,
    policySource,
  };
}
