import { CONFIG } from '../config';
import {
  CIO_LATEST,
  CIO_VINTAGES,
  longDate,
  PERIODS,
  priorVintage,
  type CioVintage,
} from '../fixtures/cioMonthly';
import { cioChanges, type ChangeItem } from './cioNarrative';
import { monthsBetween } from './compare';
import { freshnessFor } from './freshness';
import { figId, ipsRange, type FundKey } from './provenance';

/** The Exception Center: what in one CIO Monthly Report needs attention before its figures are
 *  presented, computed from the report's own printed figures.
 *
 *  Three kinds, in the order an analyst would clear them:
 *
 *  1. Policy — a composite outside its IPS range, or within `CONFIG.nearBoundPp` of a bound.
 *  2. Data — what is unusual about this report's data: a month missing from the series before it,
 *     a table that could not be read, a chart the report did not redraw, a figure it did not print.
 *  3. To explain — every change since the prior report past the thresholds the "What changed"
 *     panel already applies (`cioChanges`), so the two can never disagree.
 *
 *  What is true of every report is deliberately NOT listed: real estate and private markets lag
 *  the month end, the market table is a month ahead, ODCE is undated. Those are standing caveats,
 *  stated once in the freshness matrix. An exception list that repeated them every month would
 *  bury the items that are actually new. */

export type CenterKind = 'outside' | 'near' | 'data' | 'explain';

export interface CenterItem {
  /** stable across renders and reports: kind, fund and what it is about */
  id: string;
  kind: CenterKind;
  /** null for a condition of the report as a whole */
  fund: FundKey | null;
  title: string;
  detail: string;
  /** for a change: its size, drawn with a sign and a glyph */
  change?: { delta: number; unit: string };
  /** for a condition: how many reports running it has held, ending with this one. Published
   *  reports only; a template file or an imported dataset is not part of the series. */
  running?: { count: number; since: string } | undefined;
  /** where to look: the CIO Monthly sub-tab, the panel, and the figure whose record explains it */
  where: { tab: string; panel: string; fig?: string };
}

export interface ExceptionCenter {
  vintage: CioVintage;
  prior: CioVintage | null;
  items: CenterItem[];
  counts: Record<CenterKind, number>;
  /** the nearest any composite comes to an IPS bound, so an empty policy section still says by
   *  how much */
  closest: { fund: FundKey; name: string; dist: number; bound: 'lower' | 'upper' } | null;
}

export interface CenterOptions {
  /** "near a bound" distance in percentage points; the site's setting unless a test says otherwise */
  nearPp?: number;
}

const FUNDS: FundKey[] = ['pension', 'opeb'];
const KIND_ORDER: Record<CenterKind, number> = { outside: 0, near: 1, data: 2, explain: 3 };

const pct = (v: number) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`;

/** ISO month end for a month index (year × 12 + month − 1). */
function monthEnd(index: number): string {
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** How many published reports running, ending with `v`, a condition has held. */
function runLength(v: CioVintage, holds: (x: CioVintage) => boolean): CenterItem['running'] {
  const i = CIO_VINTAGES.indexOf(v);
  if (i < 0 || !holds(v)) return undefined;
  let first = i;
  while (first > 0 && holds(CIO_VINTAGES[first - 1]!)) first--;
  return { count: i - first + 1, since: CIO_VINTAGES[first]!.reportLabel };
}

/** A composite's distance to the nearer IPS bound, or null when the IPS names no range for it. */
function boundDistance(v: CioVintage, fund: FundKey, k: string) {
  const c = v.ENT[fund].comps.find((x) => x.k === k);
  const ips = c ? ipsRange(fund, c.n) : null;
  if (!c || !ips) return null;
  const lower = c.pct - ips.lo;
  const upper = ips.hi - c.pct;
  return {
    c,
    ips,
    dist: Math.min(lower, upper),
    bound: lower <= upper ? ('lower' as const) : ('upper' as const),
  };
}

function policyItems(v: CioVintage, nearPp: number): CenterItem[] {
  const out: CenterItem[] = [];
  for (const fund of FUNDS) {
    for (const comp of v.ENT[fund].comps) {
      const b = boundDistance(v, fund, comp.k);
      if (!b || b.dist > nearPp) continue;
      const outside = b.dist < 0;
      const { c, ips } = b;
      out.push({
        id: `${outside ? 'outside' : 'near'}:${fund}:${c.k}`,
        kind: outside ? 'outside' : 'near',
        fund,
        title: outside
          ? `${c.n} is outside its IPS range`
          : `${c.n} is ${b.dist.toFixed(1)} pp from its ${b.bound} IPS bound`,
        detail: `Weight ${pct(c.pct)} against a range of ${ips.lo}–${ips.hi}% around a ${ips.tgt}% target${outside ? `, ${Math.abs(b.dist).toFixed(1)} pp past the ${b.bound} bound` : ''}`,
        running: runLength(v, (x) => {
          const d = boundDistance(x, fund, c.k);
          return d !== null && (outside ? d.dist < 0 : d.dist <= nearPp);
        }),
        where: { tab: 'positioning', panel: 'cio-comps', fig: figId.comp(fund, c.k, 'bound') },
      });
    }
  }
  return out;
}

function closestBound(v: CioVintage): ExceptionCenter['closest'] {
  let best: ExceptionCenter['closest'] = null;
  for (const fund of FUNDS) {
    for (const comp of v.ENT[fund].comps) {
      const b = boundDistance(v, fund, comp.k);
      if (b && (best === null || b.dist < best.dist)) {
        best = { fund, name: b.c.n, dist: b.dist, bound: b.bound };
      }
    }
  }
  return best;
}

function dataItems(v: CioVintage, prior: CioVintage | null): CenterItem[] {
  const out: CenterItem[] = [];

  // a month missing from the series: every change on the page then spans more than a month
  if (prior) {
    const gap = monthsBetween(prior.dataThrough, v.dataThrough);
    if (gap > 1) {
      const start =
        Number(prior.dataThrough.slice(0, 4)) * 12 + Number(prior.dataThrough.slice(5, 7));
      const missing = Array.from({ length: gap - 1 }, (_, j) => longDate(monthEnd(start + j)));
      out.push({
        id: 'data:report:gap',
        kind: 'data',
        fund: null,
        title: `The prior report is ${gap} months earlier`,
        detail: `The series on this site has no report with data through ${missing.join(' or ')}, so every change on this report is against the ${prior.reportLabel} report (data through ${longDate(prior.dataThrough)}) and spans ${gap} months.`,
        where: { tab: 'summary', panel: 'cio-changed' },
      });
    }
  }

  if (v.origin !== 'file' && v.MKT === null) {
    out.push({
      id: 'data:report:market',
      kind: 'data',
      fund: null,
      title: 'The market index table could not be read',
      detail:
        "The report's market index table is not machine-readable, so this site carries no index returns for this report. The report itself still prints them.",
      running: runLength(v, (x) => x.MKT === null),
      where: { tab: 'markets', panel: 'cio-market' },
    });
  }

  const gdp = freshnessFor(v).rows.find((r) => r.key === 'gdp');
  if (gdp && gdp.cls === 'stale') {
    out.push({
      id: 'data:report:gdp',
      kind: 'data',
      fund: null,
      title: 'The GDP chart was not redrawn for this report',
      detail: gdp.why ?? 'The report carries an older GDP chart than the rest of its macro page.',
      running: runLength(
        v,
        (x) => freshnessFor(x).rows.find((r) => r.key === 'gdp')?.cls === 'stale',
      ),
      where: { tab: 'summary', panel: 'cio-freshness' },
    });
  }

  for (const fund of FUNDS) {
    const e = v.ENT[fund];
    if (e.cash === null) {
      out.push({
        id: `data:${fund}:cash`,
        kind: 'data',
        fund,
        title: 'Cash and equivalents not supplied',
        detail: 'The input carries no cash figure, so the summary shows none rather than a zero.',
        where: { tab: 'summary', panel: 'cio-kpis', fig: figId.cash(fund) },
      });
    }
    if (e.hist === null) {
      out.push({
        id: `data:${fund}:hist`,
        kind: 'data',
        fund,
        title: 'The return distribution was not supplied',
        detail:
          'Without the 120-month distribution the monthly return cannot be placed among past months.',
        where: { tab: 'positioning', panel: 'cio-hist' },
      });
    }
    // a total-fund period the report did not print; composites never print ten years, which is
    // the report's design rather than something missing from this report
    const unprinted = PERIODS.filter((_, i) => e.total.r[i] === null || e.total.r[i] === undefined);
    if (unprinted.length > 0) {
      out.push({
        id: `data:${fund}:periods`,
        kind: 'data',
        fund,
        title: `Total-fund return not printed for ${unprinted.join(', ')}`,
        detail:
          'The report leaves the period blank, so the site shows it as missing — never as zero — and calculates nothing from it.',
        where: {
          tab: 'performance',
          panel: 'cio-perf',
          fig: figId.r(fund, PERIODS.indexOf(unprinted[0]!)),
        },
      });
    }
  }
  return out;
}

/** The figure whose record explains a change on the "What changed" list. */
function changeFigure(fund: FundKey, c: ChangeItem): string | undefined {
  if (c.id === 'mv') return figId.dmv(fund);
  if (c.id === 'month') return figId.r(fund, 0);
  const [kind, rest] = c.id.split('-') as [string, string | undefined];
  if (rest === undefined) return undefined;
  if (kind === 'ret') return figId.dr(fund, Number(rest));
  if (kind === 'flip') return figId.x(fund, Number(rest));
  if (kind === 'tgt') return figId.comp(fund, rest, 'tgt');
  if (kind === 'w') return figId.comp(fund, rest, 'dw');
  return undefined;
}

function explainItems(v: CioVintage, prior: CioVintage | null): CenterItem[] {
  if (!prior) return [];
  const out: CenterItem[] = [];
  for (const fund of FUNDS) {
    const changes = cioChanges(v.ENT[fund], prior.ENT[fund], {
      through: v.dataThrough,
      priorThrough: prior.dataThrough,
    });
    for (const c of changes) {
      // a new fiscal year is context the summary shows, not a change to explain
      if (c.reset) continue;
      const fig = changeFigure(fund, c);
      out.push({
        id: `explain:${fund}:${c.id}`,
        kind: 'explain',
        fund,
        title: c.label,
        detail: c.detail,
        change: { delta: c.delta, unit: c.unit },
        where: { tab: 'summary', panel: 'cio-changed', ...(fig ? { fig } : {}) },
      });
    }
  }
  return out;
}

/** Everything in one report that needs attention, in the order to clear it. */
export function exceptionCenter(v: CioVintage, opts: CenterOptions = {}): ExceptionCenter {
  const nearPp = opts.nearPp ?? CONFIG.nearBoundPp;
  const prior = priorVintage(v);
  const items = [...policyItems(v, nearPp), ...dataItems(v, prior), ...explainItems(v, prior)];
  // stable within a kind: policy by fund, data report-wide first, changes as "What changed" ranks
  items.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  const counts: Record<CenterKind, number> = { outside: 0, near: 0, data: 0, explain: 0 };
  for (const it of items) counts[it.kind]++;
  return { vintage: v, prior, items, counts, closest: closestBound(v) };
}

/** The CIO Monthly address that shows an item: the sub-tab, the panel, the fund, the report, and
 *  the figure's provenance record open over it. */
export function centerLink(
  item: CenterItem,
  ctx: { report: string | null; entity: 'PENSION' | 'OPEB' },
): string {
  const q = new URLSearchParams();
  q.set('tab', item.where.tab);
  q.set('p', item.where.panel);
  const entity = item.fund === 'opeb' ? 'OPEB' : item.fund === 'pension' ? 'PENSION' : ctx.entity;
  if (entity === 'OPEB') q.set('e', 'OPEB');
  if (ctx.report && ctx.report !== CIO_LATEST.dataThrough) q.set('v', ctx.report);
  if (item.where.fig) q.set('fig', item.where.fig);
  return `/cio?${q.toString()}`;
}

/** "No policy exceptions · 1 data condition · 13 changes to explain" */
export function centerSummary(c: ExceptionCenter): string {
  const policy = c.counts.outside + c.counts.near;
  const parts = [
    policy === 0
      ? 'no policy exceptions'
      : [
          c.counts.outside ? `${c.counts.outside} outside an IPS range` : '',
          c.counts.near ? `${c.counts.near} near an IPS bound` : '',
        ]
          .filter(Boolean)
          .join(', '),
    `${c.counts.data === 0 ? 'no' : c.counts.data} data condition${c.counts.data === 1 ? '' : 's'}`,
    c.prior === null
      ? 'no prior report to compare'
      : `${c.counts.explain === 0 ? 'no' : c.counts.explain} change${c.counts.explain === 1 ? '' : 's'} to explain`,
  ];
  const s = parts.join(' · ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
