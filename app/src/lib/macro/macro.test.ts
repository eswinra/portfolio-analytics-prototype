import { describe, expect, it } from 'vitest';

import { MACRO_SNAPSHOT } from '../../fixtures/macroSnapshot.data';
import { MACRO_META } from '../../fixtures/macroSnapshot.meta';
import { OPEB, PENSION } from '../../fixtures/published';
import { PANELS, reading, transmission, treasuryCurves } from './board';
import { computeFactors, FACTOR_KEYS, FACTORS, type FactorModel } from './factors';
import { buildLens, dominantFactor, policyStructure, SENSITIVITIES } from './lens';
import { directionRead, levelRead, magnitude, placement, quadrantOf } from './regime';
import {
  carriedAt,
  isStale,
  monthIndex,
  monthKey,
  transformedAt,
  valueAt,
  zParams,
} from './series';
import type { MacroSeriesRaw, MacroSnapshot } from './types';

function series(
  id: string,
  start: string,
  values: (number | null)[],
  extra: Partial<MacroSeriesRaw> = {},
): MacroSeriesRaw {
  return {
    id,
    group: 'inflation',
    short: id,
    title: id,
    provider: 'Test provider',
    units: 'Index',
    unitsShort: 'Index',
    frequency: 'M',
    seasonal: 'SA',
    lastUpdated: '2026-09-01',
    monthly: { start, values },
    ...extra,
  };
}

describe('series arithmetic', () => {
  it('round-trips month indices', () => {
    expect(monthKey(monthIndex('2026-08'))).toBe('2026-08');
    expect(monthKey(monthIndex('1995-01-15'))).toBe('1995-01');
  });

  it('computes calendar-matched year-over-year changes and leaves a missing base missing', () => {
    const vals: (number | null)[] = Array.from({ length: 25 }, (_, k) => 100 + k);
    vals[1] = null; // Feb 2024 missing
    const s = series('X', '2024-01', vals);
    // Jan 2025 (index 12) = 112 vs Jan 2024 = 100
    expect(transformedAt(s, monthIndex('2025-01'), 'yoy')).toBeCloseTo(12, 10);
    // Feb 2025's base is missing: no substitute month is used
    expect(transformedAt(s, monthIndex('2025-02'), 'yoy')).toBeNull();
    // before the series starts
    expect(transformedAt(s, monthIndex('2023-12'), 'level')).toBeNull();
  });

  it('annualises a three-month change and differences a monthly change', () => {
    const s = series('X', '2024-01', [100, 101, 102, 104]);
    expect(transformedAt(s, monthIndex('2024-04'), 'ann3m')).toBeCloseTo(
      (Math.pow(1.04, 4) - 1) * 100,
      10,
    );
    expect(transformedAt(s, monthIndex('2024-04'), 'chg1m')).toBe(2);
    expect(transformedAt(s, monthIndex('2024-04'), 'bps')).toBe(10400);
  });

  it('needs 36 observations for a z-score window and reports the sample it used', () => {
    const short = series(
      'S',
      '2020-01',
      Array.from({ length: 35 }, (_, k) => k),
    );
    expect(zParams(short, 'level', 0, monthIndex('2030-01'))).toBeNull();
    const vals = Array.from({ length: 40 }, (_, k) => (k % 2 === 0 ? 1 : 3));
    const s = series('S', '2020-01', vals);
    const p = zParams(s, 'level', monthIndex('1995-01'), monthIndex('2030-01'))!;
    expect(p.n).toBe(40);
    expect(p.mu).toBe(2);
    expect(p.sd).toBeCloseTo(Math.sqrt(40 / 39), 10);
    expect(monthKey(p.from)).toBe('2020-01');
  });

  it('carries a monthly value forward for at most three months', () => {
    const s = series('C', '2024-01', [5, null, null, null, null]);
    expect(carriedAt(s, monthIndex('2024-04'), 'level')).toEqual({
      value: 5,
      month: monthIndex('2024-01'),
    });
    expect(carriedAt(s, monthIndex('2024-05'), 'level')).toBeNull();
  });

  it('flags staleness against the retrieval date by frequency', () => {
    expect(isStale('D', '2026-09-09', '2026-09-16')).toBe(false);
    expect(isStale('D', '2026-09-08', '2026-09-16')).toBe(true);
    expect(isStale('W', '2026-08-26', '2026-09-16')).toBe(false);
    expect(isStale('W', '2026-08-25', '2026-09-16')).toBe(true);
    // July ends Jul 31; 60 days later is Sep 29
    expect(isStale('M', '2026-07-01', '2026-09-29')).toBe(false);
    expect(isStale('M', '2026-07-01', '2026-09-30')).toBe(true);
  });
});

describe('regime read', () => {
  it('places growth and inflation in quadrants', () => {
    expect(quadrantOf(1, 1)).toBe('overheating');
    expect(quadrantOf(1, -1)).toBe('goldilocks');
    expect(quadrantOf(-1, 1)).toBe('stagflation');
    expect(quadrantOf(-1, -1)).toBe('contraction');
    expect(magnitude(0.3)).toBe('close to');
    expect(magnitude(-1.4)).toBe('well');
  });

  it('names a quadrant only when both readings are clear of the near-norm band', () => {
    expect(placement(-0.05, 0.67)).toBe('On the border between Overheating and Stagflation');
    expect(placement(1.2, 0.1)).toBe('On the border between Overheating and Goldilocks');
    expect(placement(0.2, -0.3)).toMatch(/no quadrant/);
    expect(placement(-0.8, 0.9)).toBe('In the Stagflation quadrant');
  });

  it('applies the direction rules on the latest common month', () => {
    // core PCE index rising 0.2% a month, 0.4% from month 21; unemployment 4.0, then 4.3 for the last three months
    const months = 30;
    const pce = series(
      'PCEPILFE',
      '2024-01',
      Array.from({ length: months }, (_, k) => 100 * Math.pow(1.002 + (k > 20 ? 0.002 : 0), k)),
    );
    const u = series(
      'UNRATE',
      '2024-01',
      Array.from({ length: months }, (_, k) => (k >= months - 3 ? 4.3 : 4.0)),
    );
    const p = series(
      'PAYEMS',
      '2024-01',
      Array.from({ length: months }, (_, k) => 150000 + k * 100),
    );
    const snap: MacroSnapshot = {
      retrieved: '2026-07-10',
      provider: 'test',
      termsCheckedOn: '2026-07-10',
      series: { PCEPILFE: pce, UNRATE: u, PAYEMS: p },
      excluded: [],
    };
    const r = directionRead(snap, monthIndex('2026-06'))!;
    expect(monthKey(r.month)).toBe('2026-06');
    expect(r.laborDelta).toBeCloseTo(0.3, 10);
    expect(r.labor).toBe('softening');
    expect(r.payrolls).toBe(100);
    expect(r.inflation).toBe('rising');
    expect(r.label).toBe('Inflation pressure · softening labor');
    // the same data retrieved long after the last month is stale: no read
    expect(directionRead({ ...snap, retrieved: '2026-12-01' }, monthIndex('2026-11'))).toBeNull();
  });
});

describe('factors, lens and board on the committed snapshot', () => {
  const model: FactorModel = computeFactors(MACRO_SNAPSHOT);

  it('uses only allowlisted series and never a series excluded on its terms', () => {
    const ids = Object.keys(MACRO_SNAPSHOT.series);
    for (const x of MACRO_SNAPSHOT.excluded) expect(ids).not.toContain(x.id);
    for (const f of FACTORS) for (const [id] of f.components) expect(ids).toContain(id);
    for (const p of PANELS) for (const d of [p.headline, ...p.rows]) expect(ids).toContain(d.id);
    for (const id of ['DGS3MO', 'DGS2', 'DGS5', 'DGS10', 'DGS30']) expect(ids).toContain(id);
  });

  it('keeps monthly arrays on the calendar: the latest published value sits at its own month', () => {
    for (const s of Object.values(MACRO_SNAPSHOT.series)) {
      if (!s.latest) continue;
      const [date, value] = s.latest;
      expect(valueAt(s, monthIndex(date)), `${s.id} at ${date}`).toBe(value);
    }
  });

  it('matches the header metadata generated beside it', () => {
    expect(MACRO_META.retrieved).toBe(MACRO_SNAPSHOT.retrieved);
    expect(MACRO_META.seriesCount).toBe(Object.keys(MACRO_SNAPSHOT.series).length);
    expect(MACRO_META.monthlyThrough).toBe(monthKey(model.end));
  });

  it('carries no credential material', () => {
    const text = JSON.stringify(MACRO_SNAPSHOT);
    expect(text).not.toMatch(/api_key/i);
    expect(text).not.toMatch(/\b[a-z0-9]{32}\b/);
  });

  it('ends the factor history at the last complete month before retrieval', () => {
    expect(monthKey(model.end)).toBe(monthKey(monthIndex(MACRO_SNAPSHOT.retrieved) - 1));
    for (const k of FACTOR_KEYS) {
      expect(model.factors[k].hist).toHaveLength(60);
      expect(model.factors[k].z).toBe(model.factors[k].hist[59]);
    }
  });

  it('computes each factor as the mean of its signed component z-scores', () => {
    for (const k of FACTOR_KEYS) {
      const f = model.factors[k];
      const zs = f.parts.map((p) => p.z).filter((z): z is number => z !== null);
      if (zs.length === f.parts.length) {
        expect(f.z).toBeCloseTo(zs.reduce((a, b) => a + b, 0) / zs.length, 10);
      }
    }
  });

  it('has a stated sensitivity for every IPS Table 1 class in both funds', () => {
    for (const e of [PENSION, OPEB]) {
      const cats = policyStructure(e.pol);
      expect(cats.reduce((s, c) => s + c.target, 0)).toBe(100);
      for (const c of cats) {
        expect(c.classes.reduce((s, a) => s + a.target, 0)).toBe(c.target);
      }
      expect(() => buildLens(model, e.pol)).not.toThrow();
    }
    for (const row of Object.values(SENSITIVITIES)) expect(row.sens).toHaveLength(7);
  });

  it('reconciles asset, category and fund exposures', () => {
    const rows = buildLens(model, PENSION.pol);
    const assets = rows.filter((r) => r.kind === 'asset');
    for (const a of assets) {
      const sum = a.contribs.reduce((s, c) => s + (c.contrib ?? 0), 0);
      expect(a.exposure).toBeCloseTo(sum, 2);
    }
    const cats = rows.filter((r) => r.kind === 'category');
    for (const c of cats) {
      const kids = assets.filter((a) => a.parent === c.name);
      const w = kids.reduce((s, a) => s + a.weight, 0);
      expect(c.exposure).toBeCloseTo(kids.reduce((s, a) => s + a.weight * a.exposure!, 0) / w, 2);
    }
    const fund = rows[0]!;
    expect(fund.kind).toBe('fund');
    expect(fund.exposure).toBeCloseTo(
      cats.reduce((s, c) => s + c.weight * c.exposure!, 0) / 100,
      2,
    );
    // the fund's contributions add up to its exposure (within rounding)
    expect(fund.contribs.reduce((s, c) => s + (c.contrib ?? 0), 0)).toBeCloseTo(fund.exposure!, 1);
    expect(dominantFactor(fund)).not.toBeNull();
  });

  it('gives every board item its own observation date and a classification', () => {
    for (const p of PANELS) {
      for (const d of [p.headline, ...p.rows]) {
        const r = reading(MACRO_SNAPSHOT, d);
        expect(r, d.id).not.toBeNull();
        expect(r!.date).toMatch(/\d{4}/);
        expect(['reported_public', 'calculated']).toContain(r!.classification);
        if (d.transform === 'yoy' || d.transform === 'chg1m') {
          expect(r!.classification).toBe('calculated');
        }
      }
    }
  });

  it('draws Treasury curves only on dates every maturity shares', () => {
    const curves = treasuryCurves(MACRO_SNAPSHOT);
    expect(curves.length).toBeGreaterThan(0);
    for (const c of curves) {
      expect(c.points.map((p) => p.maturity)).toEqual(['3m', '2y', '5y', '10y', '30y']);
      for (const id of ['DGS3MO', 'DGS2', 'DGS5', 'DGS10', 'DGS30']) {
        const on = MACRO_SNAPSHOT.series[id]!.recent!.find(([d]) => d === c.date);
        expect(on?.[1], `${id} on ${c.date}`).not.toBeNull();
      }
    }
  });

  it('reads the level quadrant and four transmission channels', () => {
    const lr = levelRead(model);
    expect(lr).not.toBeNull();
    expect(lr!.trail.length).toBeLessThanOrEqual(12);
    expect(transmission(MACRO_SNAPSHOT)).toHaveLength(4);
  });
});
