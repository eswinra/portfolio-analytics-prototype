import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CIO_LATEST, CIO_VINTAGES, type CioVintage } from '../fixtures/cioMonthly';

import { readCioPackage } from './cioPackage';
import {
  chainedFromPrior,
  reconcile,
  ROUNDING_PER_FIGURE,
  tieOut,
  withinReport,
} from './reconcile';

const SAMPLE = readFileSync(
  new URL('../../../data/sample/cio_template_example_aug2026.csv', import.meta.url),
  'utf-8',
);

function fileFrom(csv: string): CioVintage {
  const r = readCioPackage(csv, 'example.csv');
  if (!r.ok) throw new Error(r.errors.join('\n'));
  return r.pkg.vintage;
}

/** the example with one figure replaced */
function edit(match: RegExp, value: string): string {
  let hit = 0;
  const out = SAMPLE.split('\n')
    .map((line) => {
      if (!match.test(line)) return line;
      hit++;
      const cells = line.split(',');
      cells[5] = value;
      return cells.join(',');
    })
    .join('\n');
  if (hit !== 1) throw new Error(`${hit} rows matched ${match}`);
  return out;
}

describe('the published reports reconcile with themselves', () => {
  it('every same-period pair is equal and every chain holds within rounding', () => {
    let within = 0;
    let chained = 0;
    for (const v of CIO_VINTAGES) {
      const r = reconcile(v);
      expect(r.within.failed, `${v.dataThrough} within`).toEqual([]);
      expect(r.chained.failed, `${v.dataThrough} chained`).toEqual([]);
      within += r.within.checked;
      chained += r.chained.checked;
    }
    // July, January and June reports carry the same-period pairs; most reports can be chained
    expect(within).toBe(80);
    expect(chained).toBeGreaterThan(500);
  });

  it('a published report is not tied out against itself', () => {
    expect(tieOut(CIO_LATEST).published).toBeNull();
  });
});

describe('the public example file', () => {
  const file = fileFrom(SAMPLE);

  it('ties out to the published report, figure for figure', () => {
    const t = tieOut(file);
    expect(t.published?.dataThrough).toBe('2026-06-30');
    // per fund: value in $B and $M, cash (3); return, benchmark and hurdle for 8 periods (24);
    // per composite value, weight, target and 8 returns and benchmarks (4 × 19); DM and EM (2);
    // 14 histogram bins — 119, for two funds
    expect(t.compared).toBe(238);
    expect(t.differences).toEqual([]);
  });

  it('chains from the May report within rounding', () => {
    const c = chainedFromPrior(file);
    expect(c.prior?.dataThrough).toBe('2026-05-31');
    expect(c.checked).toBeGreaterThan(30);
    expect(c.failed).toEqual([]);
  });
});

describe('a keying error is caught', () => {
  // Growth's FYTD return is 17.5%; typed as 15.7%
  const file = fileFrom(edit(/^performance,pension,GROWTH,return,FYTD,/, '15.7'));
  const r = reconcile(file);

  it('by the chain from the prior report', () => {
    const f = r.chained.failed.find((c) => c.id === 'chain:pension:growth:return:FYTD')!;
    expect(f).toBeDefined();
    expect(f.actual).toBe(15.7);
    expect(Math.abs(f.diff)).toBeGreaterThan(1.5);
    expect(f.inputs).toMatch(/July 8, 2026 report/);
  });

  it('by the same period printed twice (in June, FYTD is the year)', () => {
    expect(r.within.failed.map((c) => c.id)).toEqual(['within:pension:growth:return:FYTD']);
  });

  it('by the published report', () => {
    expect(r.tieOut.differences).toEqual([
      expect.objectContaining({ id: 'pension:growth:r:FYTD', file: 15.7, published: 17.5 }),
    ]);
  });
});

describe('the tolerance is the rounding and nothing more', () => {
  it('a chain off by exactly the rounding of its three figures passes, and past it fails', () => {
    const prior = CIO_VINTAGES.find((v) => v.dataThrough === '2026-05-31')!;
    const base = fileFrom(SAMPLE);
    const at = (fytd: number) => {
      const pension = { ...base.ENT.pension, total: { ...base.ENT.pension.total } };
      pension.total.r = [...pension.total.r];
      pension.total.r[2] = fytd;
      return chainedFromPrior({ ...base, ENT: { ...base.ENT, pension } }).failed.some(
        (c) => c.id === 'chain:pension:total:return:FYTD',
      );
    };
    const was = prior.ENT.pension.total.r[2]!;
    const m1 = base.ENT.pension.total.r[0]!;
    const expected = ((1 + was / 100) * (1 + m1 / 100) - 1) * 100;
    const tol = 3 * ROUNDING_PER_FIGURE;
    expect(at(expected + tol - 0.001)).toBe(false);
    expect(at(expected + tol + 0.001)).toBe(true);
  });
});

describe('what cannot be checked says why', () => {
  it('a month not yet published has nothing to tie out to', () => {
    const later = fileFrom(
      SAMPLE.replace('report,,data_through,,,,2026-06-30', 'report,,data_through,,,,2026-07-31')
        .replace('report,,report_date,,,,2026-08-12', 'report,,report_date,,,,2026-09-09')
        .replace('report,,market_as_of,,,,2026-07-31', 'report,,market_as_of,,,,2026-08-31'),
    );
    const t = tieOut(later);
    expect(t.published).toBeNull();
    expect(t.note).toMatch(/nothing to tie out to/);
    // it still chains, from the June report
    expect(chainedFromPrior(later).prior?.dataThrough).toBe('2026-06-30');
  });

  it('a report after a missing month cannot be chained, and names the gap', () => {
    const dec = CIO_VINTAGES.find((v) => v.dataThrough === '2025-12-31')!;
    const c = chainedFromPrior(dec);
    expect(c.prior).toBeNull();
    expect(c.checked).toBe(0);
    expect(c.note).toMatch(/October 31, 2025/);
  });

  it('a new fiscal year is not chained across', () => {
    const july = CIO_VINTAGES.find((v) => v.dataThrough.slice(5, 7) === '07')!;
    const c = chainedFromPrior(july);
    expect(c.note).toMatch(/FYTD restarted in July/);
    expect(c.failed).toEqual([]);
    expect(withinReport(july).checked).toBeGreaterThan(0);
  });
});
