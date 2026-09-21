import { CONFIG } from '../config';
import {
  CIO_VINTAGES,
  longDate,
  PERIODS,
  priorVintage,
  type CioComposite,
  type CioEntity,
  type CioVintage,
} from '../fixtures/cioMonthly';
import { publishedFor } from '../fixtures/published';
import { SOURCES, type SourceRecord } from '../fixtures/sources';
import { fiscalYearOf } from './cioNarrative';
import { cioSource } from './cioSource';
import { PERIOD_MONTHS, windowOverlap, monthsBetween } from './compare';
// the six classifications every displayed figure carries (the row schema's own list has four)
import type { Classification } from '../components/pageMeta';

/** Where a figure came from — the record the provenance drawer shows for any figure a reader
 *  selects on the CIO Monthly tab.
 *
 *  Every figure has an address: `<fund>.<metric>[.<period>][@<data-through date>]`, for example
 *  `pension.r.FYTD` (the Pension Fund's fiscal-year-to-date return in the report on screen) or
 *  `opeb.growth.w@2025-06-30` (the OPEB Master Trust's Growth weight in the report with data
 *  through June 30, 2025). The address goes in the page URL, so a link can open one figure's
 *  record directly.
 *
 *  A figure is either printed in a report, read from the Investment Policy Statement, or
 *  calculated from other figures. A calculated figure lists what it was calculated from by
 *  address, so each input opens its own record, all the way back to a page of a public
 *  document. The drawer shows only what this module returns; the calculations the tables show
 *  (drift, excess, the proxy attribution) are made here too, so the two cannot disagree. */

export type FundKey = 'pension' | 'opeb';

export type When =
  /** a value at one month end */
  | { kind: 'point'; date: string }
  /** a return over a period ending at the month end */
  | { kind: 'window'; from: string; to: string; basis: string }
  /** a change between two reports' month ends */
  | { kind: 'between'; from: string; to: string }
  /** a policy figure, in force since a date */
  | { kind: 'policy'; since: string };

export interface FigureRef {
  id: string;
  label: string;
  display: string;
}

export interface Provenance {
  id: string;
  /** the fund, as the report names it */
  fund: string;
  /** what the figure is, in words */
  label: string;
  /** the figure as the page shows it */
  display: string;
  value: number | null;
  cls: Classification;
  when: When;
  /** which report (or file, or dataset) the figure belongs to */
  report: string;
  sources: SourceRecord[];
  /** for a calculated figure: the formula in words, and with the figures put in */
  formula?: string;
  worked?: string;
  /** what a calculated figure was calculated from; each is itself a figure address */
  inputs: FigureRef[];
  /** how the figure was read and what checked it */
  read: string[];
  /** what the reader needs to interpret it */
  notes: string[];
}

export type Resolution = { ok: true; fig: Provenance } | { ok: false; id: string; reason: string };

export interface ProvenanceContext {
  /** the report on screen: a figure address without a date belongs to it */
  vintage: CioVintage;
  /** how the report on screen's own figures are classified — reported_public for a published
   *  report, the rows' own classification for an imported dataset, calculated for a template
   *  file. A figure from another published report is always reported_public. */
  base: Classification;
}

/* ---- addresses ------------------------------------------------------------------------ */

export const periodKey = (p: string): string => p.replace(/\s+/g, '');
const periodAt = (i: number): string => periodKey(PERIODS[i] ?? '');

export type CompositeFigure = 'mv' | 'w' | 'tgt' | 'drift' | 'dw' | 'ips' | 'bound';

/** Address builders, so the page and the tests spell every address the same way. */
export const figId = {
  aum: (f: FundKey) => `${f}.aum`,
  mv: (f: FundKey) => `${f}.mv`,
  cash: (f: FundKey) => `${f}.cash`,
  dmv: (f: FundKey) => `${f}.dmv`,
  /** total-fund return, benchmark, hurdle, excess, margin over hurdle, change against the prior */
  r: (f: FundKey, i: number) => `${f}.r.${periodAt(i)}`,
  b: (f: FundKey, i: number) => `${f}.b.${periodAt(i)}`,
  h: (f: FundKey, i: number) => `${f}.h.${periodAt(i)}`,
  x: (f: FundKey, i: number) => `${f}.x.${periodAt(i)}`,
  xh: (f: FundKey, i: number) => `${f}.xh.${periodAt(i)}`,
  dr: (f: FundKey, i: number) => `${f}.dr.${periodAt(i)}`,
  comp: (f: FundKey, k: string, what: CompositeFigure) => `${f}.${k}.${what}`,
  compR: (f: FundKey, k: string, i: number) => `${f}.${k}.r.${periodAt(i)}`,
  compB: (f: FundKey, k: string, i: number) => `${f}.${k}.b.${periodAt(i)}`,
  /** the proxy: one composite's contribution, their sum, and what is left */
  contrib: (f: FundKey, k: string, i: number) => `${f}.${k}.attr.${periodAt(i)}`,
  explained: (f: FundKey, i: number) => `${f}.attr.${periodAt(i)}`,
  residual: (f: FundKey, i: number) => `${f}.resid.${periodAt(i)}`,
  other: (f: FundKey, what: 'mv' | 'w') => `${f}.other.${what}`,
  ipsTarget: (f: FundKey, k: string) => `${f}.ips.${k}.tgt`,
  ipsBand: (f: FundKey, k: string) => `${f}.ips.${k}.band`,
  /** the same figure in another report */
  at: (id: string, v: CioVintage | null | undefined) => (v ? `${id}@${v.dataThrough}` : id),
};

/* ---- when a figure was true ----------------------------------------------------------- */

/** The dates a reported period covers, ending at the report's month end. FYTD starts July 1 and
 *  YTD January 1, so both are just a count of months; the trailing periods are fixed lengths. */
export function periodWindow(
  period: string,
  dataThrough: string,
): { from: string; to: string; basis: string } | null {
  const y = Number(dataThrough.slice(0, 4));
  const m = Number(dataThrough.slice(5, 7));
  const fixed = PERIOD_MONTHS[period];
  let months: number;
  if (period === 'FYTD') months = m >= 7 ? m - 6 : m + 6;
  else if (period === 'YTD') months = m;
  else if (fixed !== null && fixed !== undefined) months = fixed;
  else return null;
  const start = y * 12 + (m - 1) - (months - 1);
  const from = `${Math.floor(start / 12)}-${String((start % 12) + 1).padStart(2, '0')}-01`;
  const basis =
    fixed !== null && fixed !== undefined && fixed >= 36
      ? `annualized over ${fixed / 12} years`
      : period === '1 Y'
        ? 'twelve months — over one year, annualized and cumulative are the same'
        : `cumulative over ${months} month${months === 1 ? '' : 's'}`;
  return { from, to: dataThrough, basis };
}

export function whenText(w: When): string {
  switch (w.kind) {
    case 'point':
      return `At the month end, ${longDate(w.date)}`;
    case 'window':
      return `${longDate(w.from)} – ${longDate(w.to)}, ${w.basis}`;
    case 'between':
      return `Between the month ends of two reports: ${longDate(w.from)} and ${longDate(w.to)}`;
    case 'policy':
      return `The policy in force since ${w.since}`;
  }
}

/* ---- formatting (as the page shows each figure) --------------------------------------- */

const MINUS = '−';
export const show = {
  pct: (v: number | null) => (v === null ? '—' : `${v < 0 ? MINUS : ''}${Math.abs(v).toFixed(1)}%`),
  pp: (v: number | null, dp = 1) =>
    v === null ? '—' : `${v > 0 ? '+' : v < 0 ? MINUS : ''}${Math.abs(v).toFixed(dp)} pp`,
  bn: (v: number | null) => (v === null ? '—' : `$${v.toFixed(1)}B`),
  mm: (v: number | null) =>
    v === null ? '—' : `${v < 0 ? MINUS : ''}$${Math.abs(v).toLocaleString('en-US')}M`,
  mmSigned: (v: number | null) =>
    v === null
      ? '—'
      : `${v > 0 ? '+' : v < 0 ? MINUS : ''}$${Math.abs(v).toLocaleString('en-US')}M`,
};

/** "a − b": a negative second term is bracketed and a positive one loses its "+", so the sign
 *  cannot be misread. */
const minus = (a: string, b: string) =>
  `${a} − ${b.startsWith(MINUS) ? `(${b})` : b.startsWith('+') ? b.slice(1) : b}`;

/** "+0.12 − 0.05 + 0.03 pp": a sum of signed terms, each sign written once. */
function sumText(values: (number | null)[], dp: number): string {
  return values
    .map((x, j) => {
      if (x === null) return j === 0 ? '—' : '+ —';
      const mag = Math.abs(x).toFixed(dp);
      if (j === 0) return `${x < 0 ? MINUS : ''}${mag}`;
      return `${x < 0 ? MINUS : '+'} ${mag}`;
    })
    .join(' ')
    .concat(' pp');
}

const PERIOD_WORDS: Record<string, string> = {
  '1 M': 'one month',
  '3 M': 'three months',
  FYTD: 'fiscal year to date',
  YTD: 'calendar year to date',
  '1 Y': 'one year',
  '3 Y': 'three years',
  '5 Y': 'five years',
  '10 Y': 'ten years',
};

/** The same periods as adjectives: "the one-month return". */
const PERIOD_ADJ: Record<string, string> = {
  '1 M': 'one-month',
  '3 M': 'three-month',
  FYTD: 'fiscal-year-to-date',
  YTD: 'calendar-year-to-date',
  '1 Y': 'one-year',
  '3 Y': 'three-year',
  '5 Y': 'five-year',
  '10 Y': 'ten-year',
};

/* ---- the proxy attribution, shared with the table ------------------------------------- */

export interface ProxyAttribution {
  period: string;
  rows: { k: string; label: string; contrib: number | null }[];
  /** the sum of the contributions; null when any composite has no figure for the period,
   *  because a sum over the composites that happen to print one would be read as the whole */
  explained: number | null;
  total: number | null;
  residual: number | null;
}

const has = (v: number | null | undefined): v is number =>
  v !== null && v !== undefined && Number.isFinite(v);

export function contribution(c: CioComposite, i: number): number | null {
  const r = c.r[i];
  const b = c.b[i];
  return has(r) && has(b) ? (r - b) * (c.pct / 100) : null;
}

/** (composite return − its benchmark) × month-end weight, for each composite, for one period. */
export function proxyAttribution(e: CioEntity, i: number): ProxyAttribution {
  const rows = e.comps.map((c) => ({ k: c.k, label: c.short, contrib: contribution(c, i) }));
  const explained = rows.every((r) => r.contrib !== null)
    ? rows.reduce((s, r) => s + r.contrib!, 0)
    : null;
  const r = e.total.r[i];
  const b = e.total.b[i];
  const total = has(r) && has(b) ? r - b : null;
  return {
    period: PERIODS[i] ?? '',
    rows,
    explained,
    total,
    residual: total !== null && explained !== null ? total - explained : null,
  };
}

/* ---- the policy ------------------------------------------------------------------------ */

const norm = (s: string) =>
  s
    .replace(/^OPEB /, '')
    .replace('&', 'and')
    .toLowerCase();

/** The composite's IPS target and band from IPS Table 1, and the range they make. */
export function ipsRange(
  fund: FundKey,
  compositeName: string,
): { tgt: number; band: number; lo: number; hi: number } | null {
  const majors = publishedFor(fund === 'opeb' ? 'OPEB' : 'PENSION').majors;
  const m = majors.find((row) => norm(row[0]) === norm(compositeName));
  return m ? { tgt: m[1], band: m[2], lo: m[1] - m[2], hi: m[1] + m[2] } : null;
}

/* ---- how a report's figures were read -------------------------------------------------- */

type VintageKind = 'published' | 'file' | 'feed';
const kindOf = (v: CioVintage): VintageKind =>
  v.origin === 'file' ? 'file' : v.url === null && v.pages.flows === 0 ? 'feed' : 'published';

const CHECK = {
  aum: 'The report prints this total twice, in billions here and in millions on the performance table, and the two agree to within $0.06 billion.',
  total:
    "The composites' market values add up to this total. A gap over $2 million is accepted only when it is under 0.3% of the fund, and is then shown as its own line.",
  comp: "This composite's market value and the others' add up to the fund's printed total.",
  weights: 'The weights on the table add up to 100% to within 0.25 point.',
  monthly:
    "The summary page prints this month's return as well, and the two agree to within 0.05 point.",
};
const NO_TIE =
  'Nothing else in the report ties this figure to another, so it rests on its position on the page alone.';

const NOTE = {
  net: 'Net of fees, as printed.',
  rounding:
    'Worked from figures printed to one decimal, so it can differ from an unrounded calculation by up to 0.1 point.',
  mvChange: 'Includes contributions and benefit payments — a change in value, not a return.',
  hurdle: 'The actuarial hurdle applies to the total fund only.',
  lag: 'Where this composite holds real estate or private equity, the report carries them at the best available cash-flow-adjusted value, which can lag the month end.',
  proxy:
    "A proxy estimate, not the report's attribution and not a Brinson decomposition: it uses the month-end weight rather than the weight at the start of the period, and leaves the allocation effect, overlays, cash and compounding to the residual.",
  tgt: 'The 2024 strategic asset allocation target, as the report prints it. The IPS range beside it comes from the Investment Policy Statement.',
  bound: `Negative means outside the range; within ${CONFIG.nearBoundPp.toFixed(1)} pp of a bound is marked "near bound". The IPS sets no mechanical trade trigger, so this is a factual comparison, not a compliance finding.`,
};

/* ---- resolution ------------------------------------------------------------------------ */

interface Scope {
  v: CioVintage;
  fund: FundKey;
  e: CioEntity;
  base: Classification;
  ctx: ProvenanceContext;
  /** the address without its fund, and the date suffix to put back on inputs */
  at: string;
}

function reportLabel(v: CioVintage): string {
  const k = kindOf(v);
  if (k === 'file') return `Template file ${v.file}, not published`;
  if (k === 'feed') return `${v.reportLabel}, data through ${longDate(v.dataThrough)}`;
  return `${v.reportLabel} report, data through ${longDate(v.dataThrough)}`;
}

function pageSource(v: CioVintage, fund: FundKey, which: 'summary' | 'table'): SourceRecord {
  const k = kindOf(v);
  if (k === 'feed') return cioSource(v, 'cio_monthly rows', null);
  const n = v.pages[fund][which === 'summary' ? 0 : 1];
  return cioSource(v, `p. ${n}`, n);
}

function printed(
  s: Scope,
  o: {
    id: string;
    label: string;
    value: number | null;
    display: string;
    when: When;
    page: 'summary' | 'table';
    where: string;
    checks?: string[];
    notes?: string[];
  },
): Provenance {
  const k = kindOf(s.v);
  const src = pageSource(s.v, s.fund, o.page);
  const read =
    k === 'file'
      ? [
          'As entered in the CIO template file, and checked when the file was opened in this browser. Not published.',
        ]
      : k === 'feed'
        ? [
            'As imported from the workstation dataset and validated against schema 1.4 when it was read. Not a published report.',
          ]
        : [
            `Printed on ${src.pageTable} of the ${s.v.reportLabel} report: ${o.where}.`,
            ...(o.checks && o.checks.length ? o.checks : [NO_TIE]),
            'Read from the public PDF by the position of each word on the page, not the order of its text (tools/extract_cio_report.py). A report that fails any check is left out of the series with the reason; nothing is corrected by hand.',
          ];
  const absent =
    k === 'published'
      ? 'The report does not print this figure.'
      : 'The input did not supply this figure.';
  return {
    id: o.id,
    fund: s.e.name,
    label: o.label,
    display: o.display,
    value: o.value,
    cls: o.value === null ? 'missing' : s.base,
    when: o.when,
    report: reportLabel(s.v),
    sources: [src],
    inputs: [],
    read,
    notes: [...(o.value === null ? [absent] : []), ...(o.notes ?? [])],
  };
}

function calculated(
  s: Scope,
  o: {
    id: string;
    label: string;
    value: number | null;
    display: string;
    when: When;
    formula: string;
    worked: string;
    inputs: string[];
    cls?: Classification;
    notes?: string[];
    /** the figure cannot be calculated even with every input present (e.g. across a reset) */
    notCalculated?: string;
  },
): Provenance {
  const resolved = o.inputs.map((id) => resolveFigure(id, s.ctx));
  const inputs: FigureRef[] = [];
  const sources: SourceRecord[] = [];
  let anyMissing = false;
  for (const r of resolved) {
    if (!r.ok) {
      anyMissing = true;
      continue;
    }
    inputs.push({ id: r.fig.id, label: r.fig.label, display: r.fig.display });
    if (r.fig.value === null && r.fig.cls === 'missing') anyMissing = true;
    for (const src of r.fig.sources) if (!sources.some((x) => x.id === src.id)) sources.push(src);
  }
  const missing = anyMissing || o.value === null || o.notCalculated !== undefined;
  return {
    id: o.id,
    fund: s.e.name,
    label: o.label,
    display: missing ? (o.notCalculated ? 'not calculated' : '—') : o.display,
    value: missing ? null : o.value,
    cls: missing ? 'missing' : (o.cls ?? 'calculated'),
    when: o.when,
    report: reportLabel(s.v),
    sources,
    formula: o.formula,
    worked: missing ? '' : o.worked,
    inputs,
    read: ['Calculated in this browser from the figures listed below, each as printed.'],
    notes: [
      ...(o.notCalculated
        ? [o.notCalculated]
        : missing
          ? ['Not calculated: at least one of the figures it needs is not printed.']
          : []),
      ...(o.notes ?? []),
    ],
  };
}

/** Resolve a figure address to its record, or say plainly why it cannot be. */
export function resolveFigure(id: string, ctx: ProvenanceContext): Resolution {
  const fail = (reason: string): Resolution => ({ ok: false, id, reason });
  const parts = id.split('@');
  if (parts.length > 2) return fail('The address names more than one report.');
  const [body = '', date] = parts;
  const v = date === undefined ? ctx.vintage : CIO_VINTAGES.find((x) => x.dataThrough === date);
  if (!v) return fail(`No published report on this site has data through ${date}.`);
  const [fund, ...path] = body.split('.');
  if (fund !== 'pension' && fund !== 'opeb') {
    return fail('The address does not name the Pension Fund or the OPEB Master Trust.');
  }
  const s: Scope = {
    v,
    fund,
    e: v.ENT[fund],
    base: v === ctx.vintage ? ctx.base : 'reported_public',
    ctx,
    at: date === undefined ? '' : `@${date}`,
  };
  const fig = resolvePath(s, id, path);
  return fig ? { ok: true, fig } : fail('This report has no figure at that address.');
}

function periodIndex(key: string | undefined): number {
  return key === undefined ? -1 : PERIODS.findIndex((p) => periodKey(p) === key);
}

function resolvePath(s: Scope, id: string, path: string[]): Provenance | null {
  const { v, e, fund } = s;
  const here = (x: string) => `${x}${s.at}`;
  const point: When = { kind: 'point', date: v.dataThrough };
  const [head, a, b, extra] = path;
  if (head === undefined) return null;

  // fund-level figures with no period
  if (a === undefined) {
    if (head === 'aum') {
      return printed(s, {
        id,
        label: 'Total fund market value',
        value: e.aum,
        display: show.bn(e.aum),
        when: point,
        page: 'summary',
        where: 'the performance summary, in $ billions',
        checks: [CHECK.aum],
      });
    }
    if (head === 'mv') {
      return printed(s, {
        id,
        label: 'Total fund market value, $ millions',
        value: e.mv,
        display: show.mm(e.mv),
        when: point,
        page: 'table',
        where: 'the total row of the performance table, market value column',
        checks: [CHECK.total],
      });
    }
    if (head === 'cash') {
      return printed(s, {
        id,
        label: 'Cash and equivalents',
        value: e.cash,
        display: show.mm(e.cash),
        when: point,
        page: 'summary',
        where: 'the performance summary',
      });
    }
    if (head === 'dmv') {
      const prior = priorVintage(v);
      if (!prior) return null;
      const pe = prior.ENT[fund];
      return calculated(s, {
        id,
        label: `Change in total fund market value against the ${prior.reportLabel} report`,
        value: e.mv - pe.mv,
        display: show.mmSigned(e.mv - pe.mv),
        when: { kind: 'between', from: prior.dataThrough, to: v.dataThrough },
        formula: "This report's total − the prior report's total",
        worked: `${minus(show.mm(e.mv), show.mm(pe.mv))} = ${show.mmSigned(e.mv - pe.mv)}`,
        inputs: [here(figId.mv(fund)), figId.at(figId.mv(fund), prior)],
        notes: [NOTE.mvChange],
      });
    }
    return null;
  }

  // total-fund figures by period
  if (['r', 'b', 'h', 'x', 'xh', 'dr', 'attr', 'resid'].includes(head) && b === undefined) {
    const i = periodIndex(a);
    if (i < 0) return null;
    const p = PERIODS[i]!;
    const words = PERIOD_WORDS[p] ?? p;
    const win = periodWindow(p, v.dataThrough);
    const when: When = win ? { kind: 'window', ...win } : point;
    const r = e.total.r[i] ?? null;
    const bm = e.total.b[i] ?? null;
    const h = e.total.h[i] ?? null;
    const column = `under ${p}`;
    if (head === 'r') {
      return printed(s, {
        id,
        label: `Net return, ${words}`,
        value: r,
        display: show.pct(r),
        when,
        page: 'table',
        where: `the total fund row, ${column}`,
        ...(i === 0 ? { checks: [CHECK.monthly] } : {}),
        notes: [NOTE.net],
      });
    }
    if (head === 'b') {
      return printed(s, {
        id,
        label: `Policy benchmark return, ${words}`,
        value: bm,
        display: show.pct(bm),
        when,
        page: 'table',
        where: `the policy benchmark row, ${column}`,
      });
    }
    if (head === 'h') {
      return printed(s, {
        id,
        label: `Actuarial hurdle, ${words}`,
        value: h,
        display: show.pct(h),
        when,
        page: 'table',
        where: `the actuarial hurdle row, ${column}`,
        notes: [NOTE.hurdle],
      });
    }
    if (head === 'x' || head === 'xh') {
      const other = head === 'x' ? bm : h;
      const val = r !== null && other !== null ? r - other : null;
      return calculated(s, {
        id,
        label:
          head === 'x'
            ? `Excess over the policy benchmark, ${words}`
            : `Margin over the actuarial hurdle, ${words}`,
        value: val,
        display: show.pp(val),
        when,
        formula: head === 'x' ? 'Net return − policy benchmark' : 'Net return − actuarial hurdle',
        worked: `${minus(show.pct(r), show.pct(other))} = ${show.pp(val)}`,
        inputs: [here(figId.r(fund, i)), here(head === 'x' ? figId.b(fund, i) : figId.h(fund, i))],
        notes: [NOTE.rounding],
      });
    }
    if (head === 'dr') {
      const prior = priorVintage(v);
      if (!prior) return null;
      const pr = prior.ENT[fund].total.r[i] ?? null;
      const gap = monthsBetween(prior.dataThrough, v.dataThrough);
      const reset =
        p === 'FYTD'
          ? fiscalYearOf(prior.dataThrough) !== fiscalYearOf(v.dataThrough)
          : p === 'YTD'
            ? prior.dataThrough.slice(0, 4) !== v.dataThrough.slice(0, 4)
            : false;
      const len = PERIOD_MONTHS[p];
      const shared = len ? windowOverlap(len, gap) : 0;
      const val = r !== null && pr !== null ? r - pr : null;
      return calculated(s, {
        id,
        label: `Change in the ${PERIOD_ADJ[p] ?? p} return against the ${prior.reportLabel} report`,
        value: val,
        display: show.pp(val),
        when: { kind: 'between', from: prior.dataThrough, to: v.dataThrough },
        formula: "This report's return − the prior report's return for the same period",
        worked: `${minus(show.pct(r), show.pct(pr))} = ${show.pp(val)}`,
        inputs: [here(figId.r(fund, i)), figId.at(figId.r(fund, i), prior)],
        ...(reset
          ? {
              notCalculated:
                p === 'FYTD'
                  ? `Not calculated: the fiscal year restarted on July 1, so the two figures cover different fiscal years (FY${fiscalYearOf(prior.dataThrough)} and FY${fiscalYearOf(v.dataThrough)}).`
                  : 'Not calculated: the calendar year restarted on January 1, so the two figures cover different years.',
            }
          : {}),
        notes: [
          ...(shared > 0 && !reset
            ? [
                `The two windows share ${shared} of ${len} months, so this is how the trailing figure moved, not ${gap} month${gap === 1 ? '' : 's'} of new performance.`,
              ]
            : []),
          ...(p === 'FYTD' || p === 'YTD'
            ? reset
              ? []
              : ['Within one year, the later figure includes the earlier months.']
            : []),
          NOTE.rounding,
        ],
      });
    }
    if (head === 'attr' || head === 'resid') {
      const pa = proxyAttribution(e, i);
      if (head === 'attr') {
        return calculated(s, {
          id,
          label: `Excess explained by the proxy, ${words}`,
          value: pa.explained,
          display: show.pp(pa.explained, 2),
          when,
          formula: "The sum of the composites' contributions",
          worked: `${sumText(
            pa.rows.map((row) => row.contrib),
            2,
          )} = ${show.pp(pa.explained, 2)}`,
          inputs: e.comps.map((c) => here(figId.contrib(fund, c.k, i))),
          cls: 'proxy_estimate',
          notes: [NOTE.proxy],
        });
      }
      return calculated(s, {
        id,
        label: `Residual the proxy does not explain, ${words}`,
        value: pa.residual,
        display: show.pp(pa.residual, 2),
        when,
        formula: 'Total-fund excess − the excess explained by the proxy',
        worked: `${minus(show.pp(pa.total, 2), show.pp(pa.explained, 2))} = ${show.pp(pa.residual, 2)}`,
        inputs: [here(figId.x(fund, i)), here(figId.explained(fund, i))],
        cls: 'proxy_estimate',
        notes: [
          'Carries everything the proxy cannot see: the allocation effect, overlays, cash, compounding, and the difference between month-end and beginning-of-period weights.',
        ],
      });
    }
  }

  // the policy: IPS target and band for a composite
  if (head === 'ips' && a !== undefined && (b === 'tgt' || b === 'band') && extra === undefined) {
    const c = e.comps.find((x) => x.k === a);
    const ips = c ? ipsRange(fund, c.n) : null;
    if (!c || !ips) return null;
    const src = fund === 'opeb' ? SOURCES.IPS_OPEB_T1 : SOURCES.IPS_T1;
    const val = b === 'tgt' ? ips.tgt : ips.band;
    return {
      id,
      fund: e.name,
      label:
        b === 'tgt' ? `${c.n}: IPS policy target` : `${c.n}: IPS allowable range around target`,
      display: b === 'tgt' ? `${val}%` : `±${val} pp`,
      value: val,
      cls: 'reported_public',
      when: { kind: 'policy', since: 'June 12, 2024, when the IPS was last restated' },
      report: src.doc,
      sources: [src],
      inputs: [],
      read: [
        `Quoted from ${src.pageTable}. The same policy applies to every report on this site, all of which postdate the restatement.`,
      ],
      notes: [],
    };
  }

  // composite figures
  const c = e.comps.find((x) => x.k === head);
  if (c) return resolveComposite(s, id, c, a, b, extra, here, point);

  // the line the report totals but does not assign to a composite
  if (head === 'other' && (a === 'mv' || a === 'w') && b === undefined && e.other) {
    const o = e.other;
    const val = a === 'mv' ? o.mv : o.pct;
    const display = a === 'mv' ? show.mm(o.mv) : show.pct(o.pct);
    const label = `${o.n}: ${a === 'mv' ? 'market value' : 'weight'}`;
    const derived = /not itemized/i.test(o.n);
    const combined = o.n.includes(' + ');
    if (derived || combined) {
      return {
        id,
        fund: e.name,
        label,
        display,
        value: val,
        cls: 'calculated',
        when: point,
        report: reportLabel(v),
        sources: [pageSource(v, fund, 'table')],
        formula: derived
          ? "The report's total less the composites it lists"
          : 'The sum of the lines the report totals but does not assign to a composite',
        worked: '',
        inputs: [],
        read: [
          derived
            ? 'Calculated when the report was read, because the listed composites fall short of the printed total by more than rounding. The gap is shown rather than spread over the composites.'
            : 'Added up when the report was read from the separate lines on the performance table.',
        ],
        notes: [],
      };
    }
    return printed(s, {
      id,
      label,
      value: val,
      display,
      when: point,
      page: 'table',
      where: `the ${o.n} row of the performance table`,
      checks: [a === 'mv' ? CHECK.comp : CHECK.weights],
    });
  }

  return null;
}

function resolveComposite(
  s: Scope,
  id: string,
  c: CioComposite,
  a: string | undefined,
  b: string | undefined,
  extra: string | undefined,
  here: (x: string) => string,
  point: When,
): Provenance | null {
  const { v, fund } = s;
  if (extra !== undefined) return null;
  const row = `the ${c.n} row of the performance table`;

  if (b === undefined) {
    if (a === 'mv') {
      return printed(s, {
        id,
        label: `${c.n}: market value`,
        value: c.mv,
        display: show.mm(c.mv),
        when: point,
        page: 'table',
        where: `${row}, market value column`,
        checks: [CHECK.comp],
        notes: [NOTE.lag],
      });
    }
    if (a === 'w') {
      return printed(s, {
        id,
        label: `${c.n}: weight`,
        value: c.pct,
        display: show.pct(c.pct),
        when: point,
        page: 'table',
        where: `${row}, % of total column`,
        checks: [CHECK.weights],
        notes: [NOTE.lag],
      });
    }
    if (a === 'tgt') {
      return printed(s, {
        id,
        label: `${c.n}: policy target`,
        value: c.tgt,
        display: show.pct(c.tgt),
        when: point,
        page: 'table',
        where: `${row}, target column`,
        notes: [NOTE.tgt],
      });
    }
    if (a === 'drift') {
      const val = c.pct - c.tgt;
      return calculated(s, {
        id,
        label: `${c.n}: drift from target`,
        value: val,
        display: show.pp(val),
        when: point,
        formula: 'Weight − policy target',
        worked: `${minus(show.pct(c.pct), show.pct(c.tgt))} = ${show.pp(val)}`,
        inputs: [here(figId.comp(fund, c.k, 'w')), here(figId.comp(fund, c.k, 'tgt'))],
      });
    }
    if (a === 'dw') {
      const prior = priorVintage(v);
      if (!prior) return null;
      const pc = prior.ENT[fund].comps.find((x) => x.k === c.k);
      const val = pc ? c.pct - pc.pct : null;
      const moved = pc && Math.abs(c.tgt - pc.tgt) >= 0.05;
      return calculated(s, {
        id,
        label: `${c.n}: change in weight against the ${prior.reportLabel} report`,
        value: val,
        display: show.pp(val),
        when: { kind: 'between', from: prior.dataThrough, to: v.dataThrough },
        formula: "This report's weight − the prior report's weight",
        worked: pc ? `${minus(show.pct(c.pct), show.pct(pc.pct))} = ${show.pp(val)}` : '',
        inputs: [here(figId.comp(fund, c.k, 'w')), figId.at(figId.comp(fund, c.k, 'w'), prior)],
        notes: [
          ...(moved
            ? [
                `The policy target moved from ${pc.tgt.toFixed(1)}% to ${c.tgt.toFixed(1)}% between the two reports, so the two weights are measured against different policies.`,
              ]
            : []),
          'A change in weight comes from relative returns and from rebalancing; this figure does not separate the two.',
        ],
      });
    }
    if (a === 'ips' || a === 'bound') {
      const ips = ipsRange(fund, c.n);
      if (!ips) return null;
      if (a === 'ips') {
        return calculated(s, {
          id,
          label: `${c.n}: IPS range`,
          value: ips.lo,
          display: `${ips.lo}–${ips.hi}%`,
          when: { kind: 'policy', since: 'June 12, 2024, when the IPS was last restated' },
          formula: 'IPS policy target ± its allowable range',
          worked: `${ips.tgt}% ± ${ips.band} = ${ips.lo}–${ips.hi}%`,
          inputs: [here(figId.ipsTarget(fund, c.k)), here(figId.ipsBand(fund, c.k))],
        });
      }
      const dist = Math.min(c.pct - ips.lo, ips.hi - c.pct);
      const nearer = c.pct - ips.lo <= ips.hi - c.pct ? 'lower' : 'upper';
      return calculated(s, {
        id,
        label: `${c.n}: distance to the nearer IPS bound`,
        value: dist,
        display: `${dist.toFixed(1)} pp`,
        when: point,
        formula: 'The smaller of (weight − lower bound) and (upper bound − weight)',
        worked: `min(${c.pct.toFixed(1)} − ${ips.lo}, ${ips.hi} − ${c.pct.toFixed(1)}) = ${dist.toFixed(1)} pp, to the ${nearer} bound`,
        inputs: [here(figId.comp(fund, c.k, 'w')), here(figId.comp(fund, c.k, 'ips'))],
        notes: [NOTE.bound],
      });
    }
    return null;
  }

  // by period: composite return, benchmark, proxy contribution
  const i = periodIndex(b);
  if (i < 0) return null;
  const p = PERIODS[i]!;
  const words = PERIOD_WORDS[p] ?? p;
  const win = periodWindow(p, v.dataThrough);
  const when: When = win ? { kind: 'window', ...win } : point;
  const r = c.r[i] ?? null;
  const bm = c.b[i] ?? null;
  if (a === 'r') {
    return printed(s, {
      id,
      label: `${c.n}: net return, ${words}`,
      value: r,
      display: show.pct(r),
      when,
      page: 'table',
      where: `${row}, under ${p}`,
      notes: [
        NOTE.net,
        ...(p === '10 Y' ? ['The report prints no ten-year figure for composites.'] : []),
      ],
    });
  }
  if (a === 'b') {
    return printed(s, {
      id,
      label: `${c.n}: policy benchmark return, ${words}`,
      value: bm,
      display: show.pct(bm),
      when,
      page: 'table',
      where: `the ${c.n} benchmark row, under ${p}`,
    });
  }
  if (a === 'attr') {
    const val = contribution(c, i);
    return calculated(s, {
      id,
      label: `${c.n}: contribution to excess, ${words}`,
      value: val,
      display: show.pp(val, 2),
      when,
      formula: '(Composite return − its policy benchmark) × month-end weight',
      worked: `(${minus(show.pct(r), show.pct(bm))}) × ${show.pct(c.pct)} = ${show.pp(val, 2)}`,
      inputs: [
        here(figId.compR(fund, c.k, i)),
        here(figId.compB(fund, c.k, i)),
        here(figId.comp(fund, c.k, 'w')),
      ],
      cls: 'proxy_estimate',
      notes: [NOTE.proxy],
    });
  }
  return null;
}

/** Every address the CIO Monthly tab can put on screen for one fund in one report — for tests,
 *  and so a new figure on the page is a new address here first. */
export function figureIds(v: CioVintage, fund: FundKey): string[] {
  const e = v.ENT[fund];
  const hasPrior = priorVintage(v) !== null;
  const ids = [figId.aum(fund), figId.mv(fund), figId.cash(fund)];
  if (hasPrior) ids.push(figId.dmv(fund));
  PERIODS.forEach((_, i) => {
    ids.push(figId.r(fund, i), figId.b(fund, i), figId.h(fund, i), figId.x(fund, i));
    ids.push(figId.xh(fund, i), figId.explained(fund, i), figId.residual(fund, i));
    if (hasPrior) ids.push(figId.dr(fund, i));
  });
  for (const c of e.comps) {
    const whats: CompositeFigure[] = ['mv', 'w', 'tgt', 'drift', 'ips', 'bound'];
    if (hasPrior) whats.push('dw');
    for (const w of whats) ids.push(figId.comp(fund, c.k, w));
    ids.push(figId.ipsTarget(fund, c.k), figId.ipsBand(fund, c.k));
    PERIODS.forEach((_, i) => {
      ids.push(figId.compR(fund, c.k, i), figId.compB(fund, c.k, i));
      ids.push(figId.contrib(fund, c.k, i));
    });
  }
  if (e.other) ids.push(figId.other(fund, 'mv'), figId.other(fund, 'w'));
  return ids;
}
