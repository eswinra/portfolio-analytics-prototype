import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { BINS, ENT, MACRO, MKT, OPS, PERIODS, STATUS, type CioEntity } from './cioMonthly';
import { DECK_BLOCK_BEGIN, DECK_BLOCK_END, deckDataBlock } from './deckData';

/** The CIO Monthly figures are quoted literals. As with published.test.ts, the checks are the
 *  identities the report itself prints (composites sum to the fund, weights to 100%, flows to
 *  the net, 120 months in the histogram) plus the guarantee that the slide deck's embedded data
 *  block is exactly what the fixture generates. */

const within = (actual: number, exact: number, tol: number) =>
  expect(Math.abs(actual - exact), `${actual} vs ${exact}`).toBeLessThanOrEqual(tol + 1e-9);

/** Does `v` fall in the printed histogram bin label ('≤ -6', '-6 to -5', …, '≥ 6')? */
function inBin(label: string, v: number): boolean {
  const le = /^≤ (-?\d+(?:\.\d+)?)$/.exec(label);
  if (le) return v <= Number(le[1]);
  const ge = /^≥ (-?\d+(?:\.\d+)?)$/.exec(label);
  if (ge) return v >= Number(ge[1]);
  const range = /^(-?\d+(?:\.\d+)?) to (-?\d+(?:\.\d+)?)$/.exec(label);
  if (!range) throw new Error(`unparseable bin label "${label}"`);
  return v >= Number(range[1]) && v < Number(range[2]);
}

const ENTITIES: [string, CioEntity][] = [
  ['Pension Fund', ENT.pension],
  ['OPEB Master Trust', ENT.opeb],
];

describe.each(ENTITIES)('%s — CIO Monthly figures agree with each other', (_name, e) => {
  const otherMv = e.other?.mv ?? 0;
  const otherPct = e.other?.pct ?? 0;
  const otherFlow = e.other?.flow ?? 0;

  it('composite market values sum to the fund total ($ millions, rounding of ±1)', () => {
    within(e.comps.reduce((s, c) => s + c.mv, 0) + otherMv, e.mv, 1);
    within(e.mv / 1000, e.aum, 0.05);
  });

  it('weights sum to 100%', () => {
    within(e.comps.reduce((s, c) => s + c.pct, 0) + otherPct, 100, 0.1);
  });

  it('May flows net to the printed total', () => {
    expect(e.comps.reduce((s, c) => s + c.flow, 0) + otherFlow).toBe(e.netflow);
  });

  it('every return series has one value per period and the hurdle is complete', () => {
    expect(e.total.r).toHaveLength(PERIODS.length);
    expect(e.total.b).toHaveLength(PERIODS.length);
    expect(e.total.h).toHaveLength(PERIODS.length);
    for (const c of e.comps) {
      expect(c.r).toHaveLength(PERIODS.length);
      expect(c.b).toHaveLength(PERIODS.length);
    }
  });

  it('the return histogram holds 120 months and places the latest month in its bin', () => {
    expect(e.hist.c).toHaveLength(BINS.length);
    expect(e.hist.c.reduce((s, n) => s + n, 0)).toBe(120);
    expect(inBin(BINS[e.hist.latestBin]!, e.hist.latest)).toBe(true);
    expect(e.hist.min).toBeLessThanOrEqual(e.hist.mean);
    expect(e.hist.mean).toBeLessThanOrEqual(e.hist.max);
    expect(e.hist.latest).toBeGreaterThanOrEqual(e.hist.min);
    expect(e.hist.latest).toBeLessThanOrEqual(e.hist.max);
  });

  it('geography: DM + EM = 100%, market counts add up, top lists are five per group in order', () => {
    expect(e.geo.dm + e.geo.em).toBe(100);
    expect(e.geo.dmN + e.geo.emN).toBe(e.geo.total);
    for (const group of ['dm', 'em'] as const) {
      const rows = e.geo.top.filter((t) => t[2] === group);
      expect(rows).toHaveLength(5);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i]![1]).toBeLessThanOrEqual(rows[i - 1]![1]);
      }
    }
  });
});

describe('market table, macro strip, and items for attention', () => {
  it('every index row carries one value per period', () => {
    for (const g of MKT) for (const row of g.rows) expect(row.v).toHaveLength(PERIODS.length);
  });
  it('every macro line names its report page', () => {
    for (const m of MACRO) expect(m.s).toMatch(/\(p\. \d+/);
  });
  it('every item has a known status and a report page', () => {
    for (const o of OPS) {
      expect(Object.keys(STATUS)).toContain(o.st);
      expect(o.p).toBeGreaterThan(0);
    }
  });
});

describe('slide deck at /deck/ reads the same data', () => {
  const html = readFileSync(new URL('../../public/deck/index.html', import.meta.url), 'utf8');
  const lines = html.split(html.includes('\r\n') ? '\r\n' : '\n');

  it('carries exactly the block generated from the fixture (run `npm run sync:deck` if not)', () => {
    const begin = lines.indexOf(DECK_BLOCK_BEGIN);
    const end = lines.indexOf(DECK_BLOCK_END);
    expect(begin).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(begin);
    expect(lines.slice(begin + 1, end).join('\n')).toBe(deckDataBlock());
  });

  it('links back to the dashboard tab', () => {
    expect(html).toContain('href="../#/cio"');
  });
});
