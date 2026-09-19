import type { CioComposite, CioEntity, CompositeKey } from '../../fixtures/cioMonthly';
import type { Classification } from '../../components/pageMeta';
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
type StatKey = 'MEAN' | 'SAA' | 'SD' | 'MIN' | 'MAX' | 'LATEST';
const EDGES = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];

/** The report's histogram bin (0 … 13) for a monthly return in percent: ≤ -6, -6 to -5, …, ≥ 6. */
export function histBinOf(pct: number): number {
  if (pct <= -6) return 0;
  if (pct >= 6) return 13;
  return EDGES.findIndex((e, i) => i < EDGES.length - 1 && pct >= e && pct < EDGES[i + 1]!) + 1;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const roundOrNull = (v: number | null) => (v === null ? null : Math.round(v));
const r2 = (v: number) => Math.round(v * 100) / 100;

/** The label an imported feed carries on the page and the slides: its classifications as the
 *  rows state them. Mixed rows take the most conservative class and name the others, so an
 *  import is never promoted to reported_public by the page it is shown on. */
const CAUTION: Classification[] = ['synthetic', 'proxy_estimate', 'calculated', 'reported_public'];
export function feedClassification(classes: readonly string[]): {
  primary: Classification;
  also: Classification[];
} {
  const known = CAUTION.filter((c) => classes.includes(c));
  // a class the page does not know is treated as the most cautious one
  const primary = classes.some((c) => !CAUTION.includes(c as Classification))
    ? 'synthetic'
    : (known[0] ?? 'synthetic');
  return { primary, also: known.filter((c) => c !== primary) };
}

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
    flow: roundOrNull(num('flow', cat)),
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
          flow: roundOrNull(num('flow', 'OTHER')),
        };
  // net rebalancing only when every line's flow was supplied: a sum over gaps is not a net
  const flowLines = [...comps.map((c) => c.flow), ...(other ? [other.flow] : [])];
  const flowsPresent = flowLines.every((f) => f !== null);
  const netflow = flowsPresent ? flowLines.reduce<number>((s, f) => s + f!, 0) : null;

  const counts = Array.from({ length: 14 }, (_, i) => {
    const v = num('hist_count', `BIN_${String(i).padStart(2, '0')}`);
    return v === null ? 0 : Math.round(v);
  });
  // the distribution is shown only when its 14 bins and six statistics all arrived
  const STAT_KEYS: StatKey[] = ['MEAN', 'SAA', 'SD', 'MIN', 'MAX', 'LATEST'];
  const histPresent =
    counts.every((_, i) => num('hist_count', `BIN_${String(i).padStart(2, '0')}`) !== null) &&
    STAT_KEYS.every((k) => num('hist_stat', k) !== null);
  const stat = (k: StatKey) => r2(num('hist_stat', k)! * 100);

  const cash = num('cash', 'TOTAL');
  const entity: CioEntity = {
    name: `${entityId} (workstation dataset)`,
    short: entityId,
    aum: r1(mv / 1000),
    mv: Math.round(mv),
    cash: roundOrNull(cash),
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
    hist: histPresent
      ? {
          c: counts,
          mean: stat('MEAN'),
          saa: stat('SAA'),
          sd: stat('SD'),
          min: stat('MIN'),
          max: stat('MAX'),
          latest: r1(num('hist_stat', 'LATEST')! * 100),
          latestBin: histBinOf(r1(num('hist_stat', 'LATEST')! * 100)),
        }
      : null,
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
