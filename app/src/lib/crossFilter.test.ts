import { describe, expect, it } from 'vitest';

import { CIO_VINTAGES, PERIOD_INDEX, PERIODS } from '../fixtures/cioMonthly';

import { CATEGORY_KEYS, SERIES_KEYS } from './cioHistory';
import { ATTR_PERIODS, bandsFor, furthestFromTarget, parseSeriesKey } from './crossFilter';
import { ipsRange } from './provenance';

describe('the category in the address', () => {
  it('is the Total Fund or a composite, and anything else is the Total Fund', () => {
    for (const k of SERIES_KEYS) expect(parseSeriesKey(k)).toBe(k);
    for (const bad of ['', 'GROWTH', 'equity', 'total ', '__proto__']) {
      expect(parseSeriesKey(bad), bad).toBe('total');
    }
  });
});

describe('the policy range', () => {
  it('is the same whichever source a panel reads it from', () => {
    // the weight history reads the policy pack; the Composites table, the provenance drawer and
    // the Exception Center read the published IPS table. One screen shows both, so they must agree.
    for (const [entity, fund] of [
      ['PENSION', 'pension'],
      ['OPEB', 'opeb'],
    ] as const) {
      const bands = bandsFor(entity);
      for (const c of CIO_VINTAGES.at(-1)!.ENT[fund].comps) {
        const ips = ipsRange(fund, c.n);
        const band = bands[c.k];
        expect(ips, `${fund} ${c.k}`).not.toBeNull();
        expect(band, `${fund} ${c.k}`).toBeDefined();
        expect(band!.min, `${fund} ${c.k} lower`).toBeCloseTo(ips!.lo, 9);
        expect(band!.max, `${fund} ${c.k} upper`).toBeCloseTo(ips!.hi, 9);
      }
    }
  });

  it('covers every composite', () => {
    for (const entity of ['PENSION', 'OPEB'] as const) {
      expect(Object.keys(bandsFor(entity)).sort()).toEqual([...CATEGORY_KEYS].sort());
    }
  });
});

describe('what Positioning shows before a choice', () => {
  it('is the composite furthest from its target, in every report', () => {
    for (const v of CIO_VINTAGES) {
      for (const fund of ['pension', 'opeb'] as const) {
        const comps = v.ENT[fund].comps;
        const widest = Math.max(...comps.map((c) => Math.abs(c.pct - c.tgt)));
        const k = furthestFromTarget(v.ENT[fund]);
        const chosen = comps.find((c) => c.k === k)!;
        expect(Math.abs(chosen.pct - chosen.tgt), `${v.dataThrough} ${fund}`).toBe(widest);
      }
    }
  });

  it('breaks a tie by the report’s own order', () => {
    const e = CIO_VINTAGES.at(-1)!.ENT.pension;
    const tied = { ...e, comps: e.comps.map((c) => ({ ...c, pct: c.tgt + 1 })) };
    expect(furthestFromTarget(tied)).toBe(e.comps[0]!.k);
  });
});

describe('the periods a reader can choose for the attribution', () => {
  it('are every period but FYTD, which the attribution always shows', () => {
    expect(ATTR_PERIODS).not.toContain(PERIOD_INDEX.fytd);
    expect(ATTR_PERIODS).toHaveLength(PERIODS.length - 1);
  });
});
