import { describe, expect, it } from 'vitest';

import {
  dailyReadThroughSeries,
  monthToDateChange,
  observationChange,
  proxyTrend,
  rollingVolatility,
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
