import type { MacroSeriesRaw } from './types';

/**
 * Series arithmetic over the FRED snapshot. Monthly values are the monthly averages FRED returns
 * for daily and weekly series and the native value for monthly series. Changes are calendar-
 * matched: a missing base month yields null, never an interpolated or carried value. Z-scores
 * measure a reading against the series' own history over a stated window; they describe, they do
 * not forecast.
 */

export type Transform = 'level' | 'yoy' | 'ann3m' | 'chg1m' | 'bps' | 'thousands' | 'millions';

/** 'YYYY-MM' or 'YYYY-MM-DD' → months since year 0. */
export const monthIndex = (ym: string): number =>
  Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;

/** months since year 0 → 'YYYY-MM'. */
export const monthKey = (i: number): string =>
  `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (i: number): string => `${MONTHS[i % 12]} ${Math.floor(i / 12)}`;
export function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}, ${y}`;
}

/** The z-score window starts here unless the series itself starts later. */
export const Z_FROM = monthIndex('1995-01');

export function valueAt(s: MacroSeriesRaw, i: number): number | null {
  const k = i - monthIndex(s.monthly.start);
  if (k < 0 || k >= s.monthly.values.length) return null;
  const v = s.monthly.values[k];
  return v === null || v === undefined || !Number.isFinite(v) ? null : v;
}

/** Transformed monthly value. `yoy` and `ann3m` require a positive base; a missing base is null. */
export function transformedAt(s: MacroSeriesRaw, i: number, t: Transform): number | null {
  const v = valueAt(s, i);
  if (v === null) return null;
  switch (t) {
    case 'level':
      return v;
    case 'yoy': {
      const b = valueAt(s, i - 12);
      return b !== null && b > 0 ? (v / b - 1) * 100 : null;
    }
    case 'ann3m': {
      const b = valueAt(s, i - 3);
      return b !== null && b > 0 ? (Math.pow(v / b, 4) - 1) * 100 : null;
    }
    case 'chg1m': {
      const b = valueAt(s, i - 1);
      return b !== null ? v - b : null;
    }
    case 'bps':
      return v * 100;
    case 'thousands':
      return v / 1000;
    case 'millions':
      return v / 1000;
  }
}

/** Latest month index at or before `end` with a transformed value. */
export function lastMonthWithValue(s: MacroSeriesRaw, t: Transform, end: number): number | null {
  const start = monthIndex(s.monthly.start);
  for (let i = end; i >= start; i--) if (transformedAt(s, i, t) !== null) return i;
  return null;
}

export interface ZParams {
  mu: number;
  sd: number;
  n: number;
  /** first month of the window actually used (later than Z_FROM when the series starts later) */
  from: number;
  to: number;
}

/** Mean and standard deviation of the transformed series over [from, to]. Needs 36 months. */
export function zParams(s: MacroSeriesRaw, t: Transform, from: number, to: number): ZParams | null {
  const xs: number[] = [];
  let first: number | null = null;
  for (let i = from; i <= to; i++) {
    const v = transformedAt(s, i, t);
    if (v === null) continue;
    if (first === null) first = i;
    xs.push(v);
  }
  if (xs.length < 36 || first === null) return null;
  const mu = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (xs.length - 1));
  if (!(sd > 0)) return null;
  return { mu, sd, n: xs.length, from: first, to };
}

/** Transformed value at month i, carrying the last observation forward for at most `maxCarry`
 *  months — monthly releases lag by one or two months; anything older is treated as missing. */
export function carriedAt(
  s: MacroSeriesRaw,
  i: number,
  t: Transform,
  maxCarry = 3,
): { value: number; month: number } | null {
  for (let k = 0; k <= maxCarry; k++) {
    const v = transformedAt(s, i - k, t);
    if (v !== null) return { value: v, month: i - k };
  }
  return null;
}

/** Native (daily or weekly) observations with values, oldest first. */
export function nativePoints(s: MacroSeriesRaw): { date: string; value: number }[] {
  return (s.recent ?? [])
    .filter((p): p is [string, number] => p[1] !== null && Number.isFinite(p[1]))
    .map(([date, value]) => ({ date, value }));
}

const days = (a: string, b: string) =>
  (Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000;

/** Latest native observation and the last one at least `lookbackDays` before it. */
export function nativeLatestAndPrior(
  s: MacroSeriesRaw,
  lookbackDays = 30,
): {
  latest: { date: string; value: number };
  prior: { date: string; value: number } | null;
} | null {
  const pts = nativePoints(s);
  const latest = pts[pts.length - 1];
  if (!latest) return null;
  const prior = [...pts].reverse().find((p) => days(latest.date, p.date) >= lookbackDays) ?? null;
  return { latest, prior };
}

/**
 * Age heuristic against the snapshot's retrieval date (not today's clock): daily series are
 * delayed after 7 days, weekly after 21, monthly 60 days after the observation month ends.
 * A release calendar would be more precise; this flags a feed that has stopped.
 */
export function isStale(frequency: string, lastObservation: string, retrieved: string): boolean {
  if (frequency === 'M') {
    const i = monthIndex(lastObservation);
    const monthEnd = new Date(Date.UTC(Math.floor((i + 1) / 12), (i + 1) % 12, 0));
    return days(retrieved, monthEnd.toISOString().slice(0, 10)) > 60;
  }
  return days(retrieved, lastObservation) > (frequency === 'W' ? 21 : 7);
}
