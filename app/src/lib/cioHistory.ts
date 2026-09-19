import {
  PERIOD_INDEX,
  type CioEntity,
  type CioVintage,
  type CompositeKey,
} from '../fixtures/cioMonthly';

/**
 * The published CIO reports as one monthly history, for the Explore sub-tab: each category's
 * one-month return, benchmark, weight, target and market value, month by month, as each report
 * first printed them. Pure functions, no React.
 *
 * - Months run from the first report's data-through month to the last one's. A month with no
 *   report is kept as a gap (every figure null); it is never filled or interpolated.
 * - Figures are as first reported: a later report's restatement of an earlier month is not
 *   applied, because the reports print only their own month's one-month return.
 * - Percent figures are in percent as printed (0.1 means 0.1%); money in $ millions.
 */

export type SeriesKey = 'total' | CompositeKey;
export const CATEGORY_KEYS: readonly CompositeKey[] = ['growth', 'credit', 'ra', 'rrm'];
export const SERIES_KEYS: readonly SeriesKey[] = ['total', ...CATEGORY_KEYS];

export interface SeriesMonth {
  r: number | null;
  b: number | null;
  /** month-end weight, % of the fund (categories only) */
  weight: number | null;
  /** policy target printed in the report, % (categories only) */
  target: number | null;
  /** market value, $ millions */
  mv: number | null;
}

export interface CioHistory {
  /** consecutive month ends, first report to last, gaps included */
  months: string[];
  /** the report for each month, or null where there was none */
  reports: (CioVintage | null)[];
  series: Record<SeriesKey, SeriesMonth[]>;
  labels: Record<SeriesKey, string>;
}

const EMPTY: SeriesMonth = { r: null, b: null, weight: null, target: null, mv: null };

/** The month end after `iso` (YYYY-MM-DD, itself a month end). */
export function nextMonthEnd(iso: string): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7)); // 1–12; the next month is m + 1
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

/** One fund's history across the given reports (any order; one report per month). */
export function cioHistory(
  vintages: readonly CioVintage[],
  entityOf: (v: CioVintage) => CioEntity,
): CioHistory {
  const byMonth = new Map<string, CioVintage>();
  for (const v of vintages) {
    if (byMonth.has(v.dataThrough)) {
      throw new Error(`Two reports carry data through ${v.dataThrough}`);
    }
    byMonth.set(v.dataThrough, v);
  }
  const sorted = [...byMonth.keys()].sort();
  const months: string[] = [];
  if (sorted.length) {
    for (let m = sorted[0]!; m <= sorted[sorted.length - 1]!; m = nextMonthEnd(m)) months.push(m);
  }
  const reports = months.map((m) => byMonth.get(m) ?? null);
  const i1 = PERIOD_INDEX.oneMonth;
  const series = Object.fromEntries(
    SERIES_KEYS.map((k) => [
      k,
      reports.map((v): SeriesMonth => {
        if (!v) return EMPTY;
        const e = entityOf(v);
        if (k === 'total') {
          return {
            r: e.total.r[i1] ?? null,
            b: e.total.b[i1] ?? null,
            weight: null,
            target: null,
            mv: e.mv,
          };
        }
        const c = e.comps.find((x) => x.k === k);
        return c
          ? { r: c.r[i1] ?? null, b: c.b[i1] ?? null, weight: c.pct, target: c.tgt, mv: c.mv }
          : EMPTY;
      }),
    ]),
  ) as Record<SeriesKey, SeriesMonth[]>;
  const latest = [...reports].reverse().find((v): v is CioVintage => v !== null);
  const e = latest ? entityOf(latest) : null;
  const labels = Object.fromEntries(
    SERIES_KEYS.map((k) => [
      k,
      k === 'total' ? 'Total Fund' : (e?.comps.find((c) => c.k === k)?.short ?? k),
    ]),
  ) as Record<SeriesKey, string>;
  return { months, reports, series, labels };
}

export interface Correlation {
  /** Pearson correlation over the months both series have, or null (too few months, or a
   *  series that does not vary) */
  r: number | null;
  /** months used: both series present */
  n: number;
  /** approximate 95% range (Fisher z), null with r */
  lo: number | null;
  hi: number | null;
}

/** Fewest months a correlation is shown on; below this the cell says so. */
export const MIN_CORRELATION_MONTHS = 12;

/**
 * Correlation of two monthly series over the months where both have a value — a missing month
 * is dropped, never counted as zero. The range assumes independent months: returns smoothed by
 * appraisals are not, so the true range is wider than the one given.
 */
export function correlation(
  a: readonly (number | null)[],
  b: readonly (number | null)[],
  minMonths = MIN_CORRELATION_MONTHS,
): Correlation {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i];
    const y = b[i];
    if (x === null || x === undefined || y === null || y === undefined) continue;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    xs.push(x);
    ys.push(y);
  }
  const n = xs.length;
  const none: Correlation = { r: null, n, lo: null, hi: null };
  if (n < Math.max(minMonths, 4)) return none;
  const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const mx = mean(xs);
  const my = mean(ys);
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    cov += (xs[i]! - mx) * (ys[i]! - my);
    vx += (xs[i]! - mx) ** 2;
    vy += (ys[i]! - my) ** 2;
  }
  if (vx === 0 || vy === 0) return none;
  const r = Math.max(-1, Math.min(1, cov / Math.sqrt(vx * vy)));
  if (Math.abs(r) === 1) return { r, n, lo: r, hi: r };
  const z = Math.atanh(r);
  const se = 1 / Math.sqrt(n - 3);
  return { r, n, lo: Math.tanh(z - 1.96 * se), hi: Math.tanh(z + 1.96 * se) };
}

/** A correlation whose range includes zero cannot be told apart from no relation. */
export const rangeIncludesZero = (c: Correlation): boolean =>
  c.lo !== null && c.hi !== null && c.lo <= 0 && c.hi >= 0;

export interface Band {
  /** % of the fund */
  min: number;
  max: number;
}

export interface RebalanceLine {
  key: CompositeKey | 'other';
  label: string;
  /** $ millions, as reported */
  mv: number;
  /** % of the lines' total */
  weight: number;
  /** target printed in the report, % (null for the other line) */
  target: number | null;
  /** proposed target, % (0 for the other line: it holds no policy weight) */
  proposed: number;
  /** $ millions to reach the proposed target: positive buys, negative sells */
  change: number;
  /** the policy range, % (null when not known, and for the other line) */
  band: Band | null;
  /** the proposed target lies outside the policy range */
  outsideBand: boolean;
}

export type RebalanceResult =
  | {
      ok: true;
      lines: RebalanceLine[];
      /** $ millions: the lines' market values added up — the base the amounts are computed on */
      base: number;
      buys: number;
      sells: number;
    }
  | { ok: false; problems: string[] };

/** Proposed targets must add to 100% within this (entered to one decimal). */
export const TARGET_SUM_TOLERANCE = 0.05;

/**
 * The dollars that would move each category from its reported weight to a proposed target:
 * proposed % × the lines' total − the category's market value. The other line (cash, overlays)
 * holds no policy weight, so it is a source of funds. The base is the lines' total, so buys
 * equal sells exactly. Arithmetic on the report's month-end values — not a trade plan.
 */
export function rebalance(
  e: CioEntity,
  proposed: Readonly<Record<CompositeKey, number>>,
  bands: Partial<Record<CompositeKey, Band>>,
): RebalanceResult {
  const problems: string[] = [];
  for (const k of CATEGORY_KEYS) {
    const p = proposed[k];
    const label = e.comps.find((c) => c.k === k)?.short ?? k;
    if (!Number.isFinite(p)) problems.push(`Enter a target for ${label}.`);
    else if (p < 0 || p > 100) problems.push(`${label}: a target is between 0% and 100%.`);
  }
  if (!problems.length) {
    const sum = CATEGORY_KEYS.reduce((s, k) => s + proposed[k], 0);
    if (Math.abs(sum - 100) > TARGET_SUM_TOLERANCE) {
      problems.push(`The targets add to ${sum.toFixed(1)}%; they must add to 100%.`);
    }
  }
  const comps = CATEGORY_KEYS.map((k) => e.comps.find((c) => c.k === k));
  if (comps.some((c) => !c)) problems.push('This report does not carry all four categories.');
  if (problems.length) return { ok: false, problems };

  const other = e.other && e.other.mv !== 0 ? e.other : null;
  const base = comps.reduce((s, c) => s + c!.mv, 0) + (other?.mv ?? 0);
  if (!(base > 0)) return { ok: false, problems: ['The report has no market values.'] };
  const lines: RebalanceLine[] = comps.map((c) => {
    const k = c!.k;
    const band = bands[k] ?? null;
    const p = proposed[k];
    return {
      key: k,
      label: c!.short,
      mv: c!.mv,
      weight: (c!.mv / base) * 100,
      target: c!.tgt,
      proposed: p,
      change: (p / 100) * base - c!.mv,
      band,
      outsideBand: band !== null && (p < band.min || p > band.max),
    };
  });
  if (other) {
    lines.push({
      key: 'other',
      label: other.n,
      mv: other.mv,
      weight: (other.mv / base) * 100,
      target: null,
      proposed: 0,
      change: -other.mv,
      band: null,
      outsideBand: false,
    });
  }
  const buys = lines.reduce((s, l) => s + Math.max(0, l.change), 0);
  const sells = lines.reduce((s, l) => s + Math.max(0, -l.change), 0);
  return { ok: true, lines, base, buys, sells };
}

/** `growth:48,credit:13,ra:15,rrm:24` ⇄ targets; anything unreadable is left out. */
export function parseTargets(s: string): Partial<Record<CompositeKey, string>> {
  const out: Partial<Record<CompositeKey, string>> = {};
  for (const part of s.split(',')) {
    const [k, v] = part.split(':');
    if (k && v !== undefined && (CATEGORY_KEYS as readonly string[]).includes(k)) {
      out[k as CompositeKey] = v.slice(0, 8);
    }
  }
  return out;
}

export function formatTargets(t: Readonly<Record<CompositeKey, string>>): string {
  return CATEGORY_KEYS.map((k) => `${k}:${t[k]}`).join(',');
}
