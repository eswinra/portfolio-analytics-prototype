import type { CioComposite, CioEntity, CompositeKey } from '../../fixtures/cioMonthly';
import { CIO_PERIOD_TOKENS, type ContractRecord } from '../contract/schema';

/**
 * The CIO Monthly feed (schema 1.4): `cio_monthly` contract rows assembled into the same shape
 * the CIO Monthly tab renders for a public report, so an imported workstation dataset can stand
 * beside the extracted vintages. Values arrive as decimals (0.001 = 0.1%) and $ millions and are
 * rounded to the report's printed precision on the way out. Nothing is imputed: a period or
 * block the file does not carry stays null / absent and the tab says so.
 */

export interface CioFeed {
  entityId: string;
  asOf: string;
  entity: CioEntity;
  /** what the file carried */
  has: { hist: boolean; flows: boolean; cash: boolean };
  /** distinct classifications on the feed rows (reported_public for a re-expressed report) */
  classifications: string[];
  sourceName: string;
  pageTable: string;
  rowCount: number;
}

const COMPOSITES: [CompositeKey, string, string, string][] = [
  ['growth', 'GROWTH', 'Growth', 'Growth'],
  ['credit', 'CREDIT', 'Credit', 'Credit'],
  ['ra', 'RAIH', 'Real Assets & Inflation Hedges', 'Real Assets & IH'],
  ['rrm', 'RRM', 'Risk Reduction & Mitigation', 'Risk Reduction & Mit.'],
];
const STAT_KEYS = ['MEAN', 'SAA', 'SD', 'MIN', 'MAX', 'LATEST'] as const;
const EDGES = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

export function buildCioFeed(records: readonly ContractRecord[]): CioFeed | null {
  const rows = records.filter((r) => r.record_type === 'cio_monthly');
  if (rows.length === 0) return null;
  // one entity per file (V17) and one as-of per feed: the newest as_of wins if a file carries two
  const asOf = rows.map((r) => r.as_of_date).sort()[rows.length - 1]!;
  const cur = rows.filter((r) => r.as_of_date === asOf);
  const entityId = cur[0]!.entity_id;
  const num = (metric: string, category: string, period = ''): number | null => {
    const r = cur.find(
      (x) =>
        x.metric_id === metric &&
        x.category_id === category &&
        (period === '' || x.period_type === period),
    );
    return r && typeof r.value === 'number' ? r.value : null;
  };
  const series = (metric: string, category: string): (number | null)[] =>
    CIO_PERIOD_TOKENS.map((p) => {
      const v = num(metric, category, p);
      return v === null ? null : r1(v * 100);
    });

  const mv = num('market_value', 'TOTAL') ?? 0;
  const comps: CioComposite[] = COMPOSITES.map(([k, cat, n, short]) => ({
    k,
    n,
    short,
    mv: Math.round(num('market_value', cat) ?? 0),
    pct: r1((num('weight', cat) ?? 0) * 100),
    tgt: r1((num('target_weight', cat) ?? 0) * 100),
    flow: Math.round(num('flow', cat) ?? 0),
    r: series('return', cat),
    b: series('benchmark_return', cat),
  }));
  const otherMv = num('market_value', 'OTHER');
  const other =
    otherMv === null
      ? null
      : {
          n: 'Overlays & Hedges + Other Asset',
          mv: Math.round(otherMv),
          pct: r1((num('weight', 'OTHER') ?? 0) * 100),
          flow: Math.round(num('flow', 'OTHER') ?? 0),
        };
  const flowsPresent = cur.some((r) => r.metric_id === 'flow');
  const netflow = flowsPresent ? comps.reduce((s, c) => s + c.flow, 0) + (other?.flow ?? 0) : 0;

  const counts = Array.from({ length: 14 }, (_, i) => {
    const v = num('hist_count', `BIN_${String(i).padStart(2, '0')}`);
    return v === null ? 0 : Math.round(v);
  });
  const histPresent = cur.some((r) => r.metric_id === 'hist_count');
  const stat = (k: (typeof STAT_KEYS)[number]) => {
    const v = num('hist_stat', k);
    return v === null ? 0 : r2(v * 100);
  };
  const latest = num('hist_stat', 'LATEST');
  const latestPct = latest === null ? (series('return', 'TOTAL')[0] ?? 0) : r1(latest * 100);
  const latestBin =
    latestPct <= -6
      ? 0
      : latestPct >= 6
        ? 13
        : EDGES.findIndex(
            (e, i) => i < EDGES.length - 1 && latestPct >= e && latestPct < EDGES[i + 1]!,
          ) + 1;

  const cash = num('cash', 'TOTAL');
  const entity: CioEntity = {
    name: `${entityId} (workstation dataset)`,
    short: entityId,
    aum: r1(mv / 1000),
    mv: Math.round(mv),
    cash: Math.round(cash ?? 0),
    god: null,
    pages: cur[0]!.page_table || 'feed rows',
    total: {
      r: series('return', 'TOTAL'),
      b: series('benchmark_return', 'TOTAL'),
      h: series('hurdle_return', 'TOTAL'),
    },
    comps,
    other,
    netflow,
    overlays: null,
    hist: {
      c: counts,
      mean: stat('MEAN'),
      saa: stat('SAA'),
      sd: stat('SD'),
      min: stat('MIN'),
      max: stat('MAX'),
      latest: latestPct,
      latestBin,
    },
    // geography is not part of the feed; the tab hides the panel when top is empty
    geo: { dm: 0, em: 0, dmN: 0, emN: 0, total: 0, page: 0, top: [] },
  };
  return {
    entityId,
    asOf,
    entity,
    has: { hist: histPresent, flows: flowsPresent, cash: cash !== null },
    classifications: [...new Set(cur.map((r) => r.classification))].sort(),
    sourceName: cur[0]!.source_name,
    pageTable: cur[0]!.page_table,
    rowCount: cur.length,
  };
}
