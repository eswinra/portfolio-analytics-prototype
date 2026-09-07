import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  BINS,
  CIO_LATEST,
  CIO_VINTAGE,
  CIO_VINTAGES,
  histRange,
  longDate,
  MACRO,
  OPS,
  PERIODS,
  STATUS,
  type CioEntity,
  type CioVintage,
} from './cioMonthly';
import { DECK_BLOCK_BEGIN, DECK_BLOCK_END, deckDataBlock } from './deckData';

/** The CIO Monthly figures are quoted literals extracted from the public PDFs. As with
 *  published.test.ts, the checks are the identities the report itself prints (composites sum
 *  to the fund, weights to 100%, flows to the net, one count per histogram bin summing to the
 *  month count) — for EVERY vintage — plus the guarantee that the slide deck's embedded data
 *  block is exactly what the latest vintage generates. */

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

const CASES: [string, CioVintage, string, CioEntity][] = CIO_VINTAGES.flatMap((v) => [
  [`${v.dataThrough} Pension Fund`, v, 'pension', v.ENT.pension] as [
    string,
    CioVintage,
    string,
    CioEntity,
  ],
  [`${v.dataThrough} OPEB Master Trust`, v, 'opeb', v.ENT.opeb] as [
    string,
    CioVintage,
    string,
    CioEntity,
  ],
]);

describe('vintage series', () => {
  it('is ordered by data-through date with no duplicates and ends on the latest', () => {
    for (let i = 1; i < CIO_VINTAGES.length; i++) {
      expect(CIO_VINTAGES[i]!.dataThrough > CIO_VINTAGES[i - 1]!.dataThrough).toBe(true);
    }
    expect(CIO_LATEST).toBe(CIO_VINTAGES[CIO_VINTAGES.length - 1]);
    expect(CIO_VINTAGES.length).toBeGreaterThanOrEqual(2);
  });
  it('names a public URL and the pages read for every vintage', () => {
    for (const v of CIO_VINTAGES) {
      expect(v.url, v.file).toMatch(/^https:\/\/www\.lacera\.gov\/.+\.pdf$/);
      expect(v.pages.pension).toHaveLength(4);
      expect(v.pages.opeb).toHaveLength(4);
      expect(v.reportDate.slice(0, 7) >= v.dataThrough.slice(0, 7)).toBe(true);
    }
  });
  it('editorial content belongs to the latest report', () => {
    expect(CIO_VINTAGE.editorialFor).toBe(CIO_LATEST.reportDate);
  });
  it('formats the labels the shell and the deck print', () => {
    expect(longDate('2026-06-30')).toBe('June 30, 2026');
    expect(longDate('2025-07')).toBe('July 2025');
    expect(histRange('2026-06-30')).toBe('July 2016 – June 2026');
    expect(histRange('2026-05-31')).toBe('June 2016 – May 2026');
  });
});

describe.each(CASES)('%s — figures agree with each other', (_name, _v, _entity, e) => {
  const otherMv = e.other?.mv ?? 0;
  const otherPct = e.other?.pct ?? 0;
  const otherFlow = e.other?.flow ?? 0;

  it('composite market values sum to the fund total ($ millions, rounding of ±2)', () => {
    within(e.comps.reduce((s, c) => s + c.mv, 0) + otherMv, e.mv, 2);
    within(e.mv / 1000, e.aum, 0.06);
  });

  it('weights sum to 100%', () => {
    within(e.comps.reduce((s, c) => s + c.pct, 0) + otherPct, 100, 0.25);
  });

  it('monthly flows net to the printed total', () => {
    within(e.comps.reduce((s, c) => s + c.flow, 0) + otherFlow, e.netflow, 1);
  });

  it('every return series has one slot per period', () => {
    expect(e.total.r).toHaveLength(PERIODS.length);
    expect(e.total.b).toHaveLength(PERIODS.length);
    expect(e.total.h).toHaveLength(PERIODS.length);
    for (const c of e.comps) {
      expect(c.r).toHaveLength(PERIODS.length);
      expect(c.b).toHaveLength(PERIODS.length);
    }
    expect(e.total.r[0]).not.toBeNull();
    expect(e.total.r[2]).not.toBeNull();
    expect(e.total.r[4]).not.toBeNull();
  });

  it('the return histogram sums to 120 months and places the latest month in its bin', () => {
    expect(e.hist.c).toHaveLength(BINS.length);
    expect(e.hist.c.reduce((s, n) => s + n, 0)).toBe(120);
    expect(inBin(BINS[e.hist.latestBin]!, e.hist.latest)).toBe(true);
    within(e.hist.latest, e.total.r[0]!, 0.051);
    expect(e.hist.min).toBeLessThanOrEqual(e.hist.mean);
    expect(e.hist.mean).toBeLessThanOrEqual(e.hist.max);
  });

  it('geography: DM + EM = 100%, market counts add up, five countries per group in order', () => {
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
  it('every index row of every readable market table carries one slot per period', () => {
    for (const v of CIO_VINTAGES) {
      if (!v.MKT) continue;
      for (const g of v.MKT) for (const row of g.rows) expect(row.v).toHaveLength(PERIODS.length);
    }
    expect(CIO_LATEST.MKT, 'latest vintage must carry the market table').not.toBeNull();
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

  it('carries exactly the block generated from the latest vintage (run `npm run sync:deck` if not)', () => {
    const begin = lines.indexOf(DECK_BLOCK_BEGIN);
    const end = lines.indexOf(DECK_BLOCK_END);
    expect(begin).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(begin);
    expect(lines.slice(begin + 1, end).join('\n')).toBe(deckDataBlock());
  });

  it('no month or report date is hardcoded in the deck prose', () => {
    const prose = lines.filter((l) => !l.startsWith('  const ')).join('\n');
    expect(prose).not.toMatch(/As of May 31, 2026|July 8, 2026|June 2016 – May 2026/);
  });

  it('links back to the dashboard tab', () => {
    expect(html).toContain('href="../#/cio"');
  });
});
