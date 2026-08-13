/**
 * Trend mathematics over daily close series. The history lives IN the dataset — the file is
 * the record; the app only computes lenses over it. Missing closes are skipped (present-value
 * series), and every window returns null rather than guessing when history is insufficient.
 */

export interface DailyPoint {
  date: string;
  close: number | null;
}

export interface ProxyTrend {
  lastDate: string | null;
  /** last close vs previous present close */
  d1: number | null;
  /** last close vs 5 present observations back (one trading week) */
  d5: number | null;
  /** last close vs first present close of the latest calendar month (needs ≥2 obs in month) */
  mtd: number | null;
  /** standard deviation of the last 20 daily returns (not annualized) */
  vol20: number | null;
  observations: number;
}

function presentSeries(points: readonly DailyPoint[]): { date: string; close: number }[] {
  return points
    .filter(
      (p): p is { date: string; close: number } => p.close !== null && Number.isFinite(p.close),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Change over the last `n` present observations: last / close[len-1-n] − 1. */
export function observationChange(points: readonly DailyPoint[], n: number): number | null {
  const s = presentSeries(points);
  if (n <= 0 || s.length < n + 1) return null;
  const last = s[s.length - 1]!;
  const base = s[s.length - 1 - n]!;
  return last.close / base.close - 1;
}

/** Month-to-date: last close vs the first present close of the latest month (≥2 obs needed). */
export function monthToDateChange(points: readonly DailyPoint[]): number | null {
  const s = presentSeries(points);
  if (s.length < 2) return null;
  const last = s[s.length - 1]!;
  const month = last.date.slice(0, 7);
  const inMonth = s.filter((p) => p.date.slice(0, 7) === month);
  if (inMonth.length < 2) return null;
  return last.close / inMonth[0]!.close - 1;
}

/** Std deviation of the last `window` daily simple returns; null when history is short. */
export function rollingVolatility(points: readonly DailyPoint[], window = 20): number | null {
  const s = presentSeries(points);
  if (s.length < window + 1) return null;
  const rets: number[] = [];
  for (let i = s.length - window; i < s.length; i++) {
    rets.push(s[i]!.close / s[i - 1]!.close - 1);
  }
  const mean = rets.reduce((a, r) => a + r, 0) / rets.length;
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance);
}

export function proxyTrend(points: readonly DailyPoint[]): ProxyTrend {
  const s = presentSeries(points);
  return {
    lastDate: s[s.length - 1]?.date ?? null,
    d1: observationChange(points, 1),
    d5: observationChange(points, 5),
    mtd: monthToDateChange(points),
    vol20: rollingVolatility(points, 20),
    observations: s.length,
  };
}

/** Minimum present observations before a risk lens will display (honest-history gate). */
export const LENS_MIN_OBS = 20;

export interface DrawdownResult {
  /** most negative peak-to-trough decline (≤ 0) */
  maxDrawdown: number;
  peakDate: string;
  troughDate: string;
}

/** Maximum drawdown from a running peak over present closes; null under the history gate. */
export function maxDrawdown(
  points: readonly DailyPoint[],
  minObs = LENS_MIN_OBS,
): DrawdownResult | null {
  const s = presentSeries(points);
  if (s.length < minObs) return null;
  let peak = s[0]!;
  let best: DrawdownResult = { maxDrawdown: 0, peakDate: peak.date, troughDate: peak.date };
  for (const p of s) {
    if (p.close > peak.close) peak = p;
    const dd = p.close / peak.close - 1;
    if (dd < best.maxDrawdown) {
      best = { maxDrawdown: dd, peakDate: peak.date, troughDate: p.date };
    }
  }
  return best;
}

export interface DayReturn {
  date: string;
  ret: number;
}

/** Best and worst single-day returns between consecutive present closes. */
export function bestWorstDay(
  points: readonly DailyPoint[],
  minObs = LENS_MIN_OBS,
): { best: DayReturn; worst: DayReturn } | null {
  const s = presentSeries(points);
  if (s.length < minObs) return null;
  let best: DayReturn | null = null;
  let worst: DayReturn | null = null;
  for (let i = 1; i < s.length; i++) {
    const r = s[i]!.close / s[i - 1]!.close - 1;
    if (best === null || r > best.ret) best = { date: s[i]!.date, ret: r };
    if (worst === null || r < worst.ret) worst = { date: s[i]!.date, ret: r };
  }
  return best && worst ? { best, worst } : null;
}

/** Last close vs its `window`-observation simple moving average; null under the gate. */
export function smaDeviation(points: readonly DailyPoint[], window = LENS_MIN_OBS): number | null {
  const s = presentSeries(points);
  if (s.length < window) return null;
  const tail = s.slice(-window);
  const sma = tail.reduce((a, p) => a + p.close, 0) / tail.length;
  return sma > 0 ? s[s.length - 1]!.close / sma - 1 : null;
}

/**
 * Pearson correlation of the last `window` DATE-MATCHED daily returns of two series.
 * Days where either proxy lacks a return are dropped (never imputed); null when fewer
 * than `window` matched days exist or either series is degenerate.
 */
export function rollingCorrelation(
  a: readonly DailyPoint[],
  b: readonly DailyPoint[],
  window = LENS_MIN_OBS,
): number | null {
  const dayReturns = (points: readonly DailyPoint[]): Map<string, number> => {
    const s = presentSeries(points);
    const m = new Map<string, number>();
    for (let i = 1; i < s.length; i++) m.set(s[i]!.date, s[i]!.close / s[i - 1]!.close - 1);
    return m;
  };
  const ra = dayReturns(a);
  const rb = dayReturns(b);
  const dates = [...ra.keys()].filter((d) => rb.has(d)).sort();
  if (dates.length < window) return null;
  const tail = dates.slice(-window);
  const xs = tail.map((d) => ra.get(d)!);
  const ys = tail.map((d) => rb.get(d)!);
  const mean = (v: number[]) => v.reduce((s2, x) => s2 + x, 0) / v.length;
  const mx = mean(xs);
  const my = mean(ys);
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < tail.length; i++) {
    cov += (xs[i]! - mx) * (ys[i]! - my);
    vx += (xs[i]! - mx) ** 2;
    vy += (ys[i]! - my) ** 2;
  }
  if (vx === 0 || vy === 0) return null;
  return cov / Math.sqrt(vx * vy);
}

export interface ReadThroughDay {
  date: string;
  /** Σ policy weight × proxy daily return, over proxies priced on this and the prior day */
  impact: number;
  /** Σ policy weight of the contributing proxies */
  coverage: number;
}

export interface WeightedProxySeries {
  weight: number;
  points: readonly DailyPoint[];
}

/**
 * Daily policy-weighted read-through series. Coverage varies by day: proxies without a return
 * on a given day are excluded from that day (never imputed as zero) and the day's coverage
 * says so.
 */
export function dailyReadThroughSeries(proxies: readonly WeightedProxySeries[]): ReadThroughDay[] {
  const byDate = new Map<string, { impact: number; coverage: number }>();
  for (const { weight, points } of proxies) {
    const s = presentSeries(points);
    for (let i = 1; i < s.length; i++) {
      const r = s[i]!.close / s[i - 1]!.close - 1;
      const e = byDate.get(s[i]!.date) ?? { impact: 0, coverage: 0 };
      e.impact += weight * r;
      e.coverage += weight;
      byDate.set(s[i]!.date, e);
    }
  }
  return [...byDate.entries()]
    .map(([date, e]) => ({ date, impact: e.impact, coverage: e.coverage }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
