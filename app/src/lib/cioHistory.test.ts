import { describe, expect, it } from 'vitest';

import { CIO_LATEST, CIO_VINTAGES, cioFor, type CioEntity } from '../fixtures/cioMonthly';
import {
  CATEGORY_KEYS,
  cioHistory,
  correlation,
  formatTargets,
  nextMonthEnd,
  parseTargets,
  rangeIncludesZero,
  rebalance,
} from './cioHistory';

const pension = cioHistory(CIO_VINTAGES, (v) => cioFor('PENSION', v));

describe('the published reports as a monthly history', () => {
  it('runs month by month and keeps a month without a report as a gap', () => {
    expect(pension.months[0]).toBe(CIO_VINTAGES[0]!.dataThrough);
    expect(pension.months.at(-1)).toBe(CIO_LATEST.dataThrough);
    for (let i = 1; i < pension.months.length; i++) {
      expect(pension.months[i]).toBe(nextMonthEnd(pension.months[i - 1]!));
    }
    const gaps = pension.months.filter((_, i) => pension.reports[i] === null);
    // no report carries November 2025: it stays empty, never filled
    expect(gaps).toEqual(['2025-11-30']);
    const nov = pension.months.indexOf('2025-11-30');
    for (const k of ['total', ...CATEGORY_KEYS] as const) {
      expect(pension.series[k][nov]).toEqual({
        r: null,
        b: null,
        weight: null,
        target: null,
        mv: null,
      });
    }
    expect(pension.reports.filter(Boolean)).toHaveLength(CIO_VINTAGES.length);
  });

  it('carries each report’s own one-month figures, as printed', () => {
    const i = pension.months.indexOf(CIO_LATEST.dataThrough);
    const e = cioFor('PENSION', CIO_LATEST);
    expect(pension.series.total[i]).toMatchObject({ r: e.total.r[0], b: e.total.b[0], mv: e.mv });
    const g = e.comps.find((c) => c.k === 'growth')!;
    expect(pension.series.growth[i]).toEqual({
      r: g.r[0],
      b: g.b[0],
      weight: g.pct,
      target: g.tgt,
      mv: g.mv,
    });
    expect(pension.labels.growth).toBe(g.short);
  });

  it('refuses two reports for one month', () => {
    expect(() => cioHistory([CIO_LATEST, CIO_LATEST], (v) => cioFor('PENSION', v))).toThrow(
      /Two reports/,
    );
  });

  it('finds month ends across year ends and leap years', () => {
    expect(nextMonthEnd('2025-12-31')).toBe('2026-01-31');
    expect(nextMonthEnd('2024-01-31')).toBe('2024-02-29');
    expect(nextMonthEnd('2026-01-31')).toBe('2026-02-28');
    expect(nextMonthEnd('2026-04-30')).toBe('2026-05-31');
  });
});

describe('correlation', () => {
  const up = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  it('is 1 or −1 for series that move together or against each other', () => {
    expect(
      correlation(
        up,
        up.map((x) => 2 * x + 1),
      ).r,
    ).toBeCloseTo(1, 12);
    expect(
      correlation(
        up,
        up.map((x) => -x),
      ).r,
    ).toBeCloseTo(-1, 12);
  });

  it('matches a hand-worked value, with its Fisher range', () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const b = [2, 1, 4, 3, 6, 5, 8, 7, 10, 9, 12, 11];
    const c = correlation(a, b);
    // Σab = 644, n·mean² = 507: Σ(dx·dy) = 137, Σdx² = Σdy² = 650 − 507 = 143 → r = 137/143
    expect(c.r).toBeCloseTo(137 / 143, 12);
    expect(c.n).toBe(12);
    const z = Math.atanh(137 / 143);
    expect(c.lo).toBeCloseTo(Math.tanh(z - 1.96 / 3), 12);
    expect(c.hi).toBeCloseTo(Math.tanh(z + 1.96 / 3), 12);
  });

  it('drops a month either series lacks, never counting it as zero', () => {
    const a = [...up, null, 50];
    const b = [...up, 80, null];
    const c = correlation(a, b);
    expect(c.n).toBe(12);
    expect(c.r).toBeCloseTo(1, 12);
  });

  it('shows nothing below the minimum months or for a series that does not move', () => {
    expect(correlation(up.slice(0, 11), up.slice(0, 11))).toEqual({
      r: null,
      n: 11,
      lo: null,
      hi: null,
    });
    expect(
      correlation(
        up,
        up.map(() => 1),
      ).r,
    ).toBeNull();
  });

  it('says when the range includes zero', () => {
    const weak = correlation(
      [1, -1, 2, -2, 1, 0, 3, -1, 0, 2, -2, 1],
      [0, 1, -1, 2, 1, -1, 0, 2, -2, 1, 0, -1],
    );
    expect(weak.r).not.toBeNull();
    expect(rangeIncludesZero(weak)).toBe(true);
    const strong = correlation(up, [2, 1, 4, 3, 6, 5, 8, 7, 10, 9, 12, 11]);
    expect(rangeIncludesZero(strong)).toBe(false);
  });

  it('gives every pair of the pension categories a figure from the published reports', () => {
    for (const a of CATEGORY_KEYS) {
      for (const b of CATEGORY_KEYS) {
        const c = correlation(
          pension.series[a].map((m) => m.r),
          pension.series[b].map((m) => m.r),
        );
        expect(c.n).toBe(CIO_VINTAGES.length);
        expect(c.r).not.toBeNull();
      }
    }
  });
});

describe('rebalancing to proposed targets', () => {
  const e = cioFor('PENSION', CIO_LATEST);
  const printed = Object.fromEntries(
    CATEGORY_KEYS.map((k) => [k, e.comps.find((c) => c.k === k)!.tgt]),
  ) as Record<(typeof CATEGORY_KEYS)[number], number>;
  const bands = {
    growth: { min: 40, max: 56 },
    credit: { min: 9, max: 17 },
    ra: { min: 11, max: 19 },
    rrm: { min: 16, max: 32 },
  };

  it('moves every line to its target, buys equal to sells, on the lines’ own total', () => {
    const res = rebalance(e, printed, bands);
    if (!res.ok) throw new Error(res.problems.join(' '));
    const base = e.comps.reduce((s, c) => s + c.mv, 0) + (e.other?.mv ?? 0);
    expect(res.base).toBeCloseTo(base, 9);
    for (const l of res.lines) {
      expect(l.mv + l.change).toBeCloseTo((l.proposed / 100) * base, 9);
    }
    expect(res.buys).toBeCloseTo(res.sells, 9);
    expect(res.lines.reduce((s, l) => s + l.change, 0)).toBeCloseTo(0, 9);
    expect(res.lines.some((l) => l.outsideBand)).toBe(false);
    // the other line holds no policy weight: it is a source of funds
    const other = res.lines.find((l) => l.key === 'other');
    if (e.other && e.other.mv !== 0) expect(other?.change).toBeCloseTo(-e.other.mv, 9);
  });

  it('computes a move by hand for a simple fund', () => {
    const toy: CioEntity = {
      ...e,
      comps: e.comps.map((c) => ({ ...c, mv: 250 })),
      other: null,
    };
    const res = rebalance(toy, { growth: 40, credit: 20, ra: 20, rrm: 20 }, {});
    if (!res.ok) throw new Error(res.problems.join(' '));
    expect(res.base).toBe(1000);
    expect(res.lines.map((l) => l.change)).toEqual([150, -50, -50, -50]);
    expect([res.buys, res.sells]).toEqual([150, 150]);
  });

  it('flags a target outside the policy range', () => {
    const res = rebalance(e, { growth: 58, credit: 12, ra: 12, rrm: 18 }, bands);
    if (!res.ok) throw new Error(res.problems.join(' '));
    expect(res.lines.filter((l) => l.outsideBand).map((l) => l.key)).toEqual(['growth']);
  });

  it('shows no amounts until the targets are whole and add to 100%', () => {
    const r1 = rebalance(e, { growth: 48, credit: 13, ra: 15, rrm: 23 }, bands);
    expect(r1).toEqual({
      ok: false,
      problems: ['The targets add to 99.0%; they must add to 100%.'],
    });
    const r2 = rebalance(e, { growth: Number.NaN, credit: 13, ra: 15, rrm: 24 }, bands);
    expect(r2.ok).toBe(false);
    const r3 = rebalance(e, { growth: 101, credit: -1, ra: 0, rrm: 0 }, bands);
    expect(r3.ok ? [] : r3.problems).toHaveLength(2);
  });
});

describe('targets in the address', () => {
  it('round-trips and ignores what it cannot read', () => {
    const t = { growth: '50', credit: '12.5', ra: '14', rrm: '23.5' };
    expect(parseTargets(formatTargets(t))).toEqual(t);
    expect(parseTargets('growth:50,bogus:3,credit,ra:14')).toEqual({ growth: '50', ra: '14' });
  });
});
