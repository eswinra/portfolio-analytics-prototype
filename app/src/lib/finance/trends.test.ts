import { describe, expect, it } from 'vitest';

import {
  bestWorstDay,
  dailyReadThroughSeries,
  maxDrawdown,
  monthToDateChange,
  observationChange,
  proxyTrend,
  rollingCorrelation,
  rollingVolatility,
  smaDeviation,
  type DailyPoint,
} from './trends';

const mk = (pairs: [string, number | null][]): DailyPoint[] =>
  pairs.map(([date, close]) => ({ date, close }));

describe('observationChange', () => {
  const series = mk([
    ['2026-06-24', 100],
    ['2026-06-25', 102],
    ['2026-06-26', 101],
    ['2026-06-29', 103],
    ['2026-06-30', 105],
  ]);
  it('computes change over n present observations', () => {
    expect(observationChange(series, 1)).toBeCloseTo(105 / 103 - 1, 12);
    expect(observationChange(series, 4)).toBeCloseTo(105 / 100 - 1, 12);
  });
  it('returns null when history is insufficient', () => {
    expect(observationChange(series, 5)).toBeNull();
  });
  it('skips missing closes instead of treating them as zero', () => {
    const withGap = mk([
      ['2026-06-26', 100],
      ['2026-06-29', null],
      ['2026-06-30', 110],
    ]);
    expect(observationChange(withGap, 1)).toBeCloseTo(0.1, 12);
  });
});

describe('monthToDateChange', () => {
  it('measures from the first present close of the latest month', () => {
    const s = mk([
      ['2026-05-29', 90],
      ['2026-06-01', 100],
      ['2026-06-30', 106],
    ]);
    expect(monthToDateChange(s)).toBeCloseTo(0.06, 12);
  });
  it('needs at least two observations inside the month', () => {
    const s = mk([
      ['2026-06-30', 100],
      ['2026-07-01', 101],
    ]);
    expect(monthToDateChange(s)).toBeNull(); // July has a single observation
  });
});

describe('rollingVolatility', () => {
  it('is zero for a constant-return series and null when short', () => {
    const flat = mk(
      Array.from({ length: 25 }, (_, i) => [
        `2026-06-${String(i + 1).padStart(2, '0')}`,
        100 * Math.pow(1.01, i),
      ]),
    );
    expect(rollingVolatility(flat, 20)!).toBeCloseTo(0, 10);
    expect(rollingVolatility(flat.slice(0, 10), 20)).toBeNull();
  });
});

describe('proxyTrend', () => {
  it('reports honest insufficiency per window', () => {
    const short = mk([
      ['2026-06-29', 100],
      ['2026-06-30', 101],
    ]);
    const t = proxyTrend(short);
    expect(t.d1).toBeCloseTo(0.01, 12);
    expect(t.d5).toBeNull();
    expect(t.vol20).toBeNull();
    expect(t.observations).toBe(2);
  });
});

describe('dailyReadThroughSeries', () => {
  it('weights returns and lets coverage vary with missing days', () => {
    const eq = {
      weight: 0.3,
      points: mk([
        ['2026-06-29', 100],
        ['2026-06-30', 101],
      ]),
    };
    const bond = {
      weight: 0.1,
      points: mk([
        ['2026-06-29', 100],
        ['2026-06-30', null],
      ]),
    };
    const days = dailyReadThroughSeries([eq, bond]);
    expect(days).toHaveLength(1);
    expect(days[0]!.impact).toBeCloseTo(0.3 * 0.01, 12); // bond excluded, not imputed
    expect(days[0]!.coverage).toBeCloseTo(0.3, 12);
  });
});

describe('risk lenses (min-history gated)', () => {
  const mk = (closes: (number | null)[], startDay = 1): { date: string; close: number | null }[] =>
    closes.map((c, i) => ({
      date: `2026-06-${String(startDay + i).padStart(2, '0')}`,
      close: c,
    }));

  it('maxDrawdown finds the deepest peak-to-trough and gates on history', () => {
    const closes = [
      100, 105, 110, 99, 102, 108, 95, 97, 100, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112,
      113,
    ];
    const dd = maxDrawdown(mk(closes))!;
    expect(dd.maxDrawdown).toBeCloseTo(95 / 110 - 1, 10);
    expect(dd.peakDate).toBe('2026-06-03');
    expect(dd.troughDate).toBe('2026-06-07');
    expect(maxDrawdown(mk(closes.slice(0, 10)))).toBeNull();
  });

  it('bestWorstDay picks the extreme single-day returns', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    closes[10] = 95; // big down day then rebound
    const bw = bestWorstDay(mk(closes))!;
    expect(bw.worst.date).toBe('2026-06-11');
    expect(bw.worst.ret).toBeLessThan(0);
    expect(bw.best.ret).toBeGreaterThan(0);
    expect(bestWorstDay(mk(closes.slice(0, 5)))).toBeNull();
  });

  it('smaDeviation compares last close to its 20-observation average', () => {
    const flat = Array.from({ length: 20 }, () => 100);
    expect(smaDeviation(mk(flat))).toBeCloseTo(0, 10);
    const rising = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(smaDeviation(mk(rising))!).toBeGreaterThan(0);
    expect(smaDeviation(mk(flat.slice(0, 10)))).toBeNull();
  });

  it('rollingCorrelation matches dates, gates on window, and detects sign', () => {
    const n = 25;
    const a = Array.from({ length: n }, (_, i) => 100 * (1 + 0.01 * Math.sin(i)));
    const inverse = a.map((v) => 200 - v);
    const ra = rollingCorrelation(mk(a), mk(a), 20);
    expect(ra).toBeCloseTo(1, 6);
    const rb = rollingCorrelation(mk(a), mk(inverse), 20);
    expect(rb).toBeLessThan(-0.9);
    expect(rollingCorrelation(mk(a.slice(0, 10)), mk(a.slice(0, 10)), 20)).toBeNull();
  });

  it('lenses skip missing closes rather than imputing', () => {
    const withGap: (number | null)[] = Array.from({ length: 22 }, (_, i) => 100 + i);
    withGap[5] = null;
    const dd = maxDrawdown(mk(withGap));
    expect(dd).not.toBeNull(); // 21 present obs still clear the gate
  });
});
