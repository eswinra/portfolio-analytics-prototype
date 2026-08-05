import { describe, expect, it } from 'vitest';

import {
  chainLink,
  excessReturn,
  growthIndex,
  periodsComparable,
  scaleAnnualRate,
  trailingReturn,
  type MonthPoint,
} from './returns';

describe('chainLink', () => {
  it('compounds correctly', () => {
    expect(chainLink([0.01, 0.02])).toBeCloseTo(1.01 * 1.02 - 1, 12);
  });
  it('is not the average of returns (counter-example guard)', () => {
    const r = chainLink([0.1, -0.1]);
    expect(r).toBeCloseTo(-0.01, 12);
    expect(r).not.toBeCloseTo(0, 3); // averaging would give 0
  });
  it('handles negatives and single periods', () => {
    expect(chainLink([-0.05])).toBeCloseTo(-0.05, 12);
  });
  it('returns null on empty input', () => {
    expect(chainLink([])).toBeNull();
  });
  it('propagates missing months as null (no silent skip)', () => {
    expect(chainLink([0.01, null, 0.02])).toBeNull();
  });
});

describe('growthIndex', () => {
  const pts: MonthPoint[] = [
    { monthEnd: '2026-01-31', value: 0.01 },
    { monthEnd: '2026-02-28', value: -0.02 },
  ];
  it('builds a base-1 index', () => {
    const g = growthIndex(pts);
    expect(g[0]?.index).toBeCloseTo(1.01, 12);
    expect(g[1]?.index).toBeCloseTo(1.01 * 0.98, 12);
  });
  it('breaks permanently at a gap', () => {
    const g = growthIndex([
      pts[0]!,
      { monthEnd: '2026-02-28', value: null },
      { monthEnd: '2026-03-31', value: 0.03 },
    ]);
    expect(g[1]?.index).toBeNull();
    expect(g[2]?.index).toBeNull();
  });
});

describe('trailingReturn', () => {
  const series: MonthPoint[] = Array.from({ length: 12 }, (_, i) => ({
    monthEnd: `2026-${String(i + 1).padStart(2, '0')}-28`,
    value: 0.01,
  }));
  it('computes a trailing window', () => {
    expect(trailingReturn(series, 3)).toBeCloseTo(Math.pow(1.01, 3) - 1, 12);
  });
  it('rejects windows longer than the series', () => {
    expect(trailingReturn(series, 13)).toBeNull();
  });
  it('rejects gaps inside the window but not outside it', () => {
    const withEarlyGap = [{ monthEnd: '2025-12-31', value: null }, ...series];
    expect(trailingReturn(withEarlyGap, 3)).not.toBeNull();
    const withLateGap = [...series.slice(0, 11), { monthEnd: '2026-12-28', value: null }];
    expect(trailingReturn(withLateGap, 3)).toBeNull();
  });
});

describe('excessReturn and hurdle scaling', () => {
  it('subtracts benchmark from portfolio', () => {
    expect(excessReturn(0.05, 0.03)).toBeCloseTo(0.02, 12);
  });
  it('null-propagates', () => {
    expect(excessReturn(null, 0.03)).toBeNull();
    expect(excessReturn(0.05, null)).toBeNull();
  });
  it('scales an annual hurdle geometrically', () => {
    expect(scaleAnnualRate(0.0675, 12)).toBeCloseTo(0.0675, 12);
    expect(scaleAnnualRate(0.0675, 3)).toBeCloseTo(Math.pow(1.0675, 0.25) - 1, 12);
  });
});

describe('period alignment', () => {
  const a = { period_start: '2026-04-01', period_end: '2026-06-30', period_type: 'QTD' };
  it('accepts identical periods', () => {
    expect(periodsComparable(a, { ...a })).toBe(true);
  });
  it('rejects any mismatch (start, end, or type)', () => {
    expect(periodsComparable(a, { ...a, period_end: '2026-05-31' })).toBe(false);
    expect(periodsComparable(a, { ...a, period_start: '2026-03-01' })).toBe(false);
    expect(periodsComparable(a, { ...a, period_type: 'Q' })).toBe(false);
  });
});
