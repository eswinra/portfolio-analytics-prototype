import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CURVE_KEYS, yoy } from '../lib/cioMacro';
import {
  BINS,
  CIO_LATEST,
  CIO_MACRO,
  CIO_VINTAGE,
  CIO_VINTAGES,
  histRange,
  longDate,
  MACRO,
  MACRO_PRINTED,
  macroAsOf,
  OPS,
  PERIODS,
  STATUS,
  type CioEntity,
  type CioVintage,
} from './cioMonthly';
import { NET_POSITION } from './cioMonthly.data';
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
    expect(
      CIO_VINTAGE.editorialFor,
      `a new report was added: type its written parts into app/src/fixtures/cioMonthly.data.ts and set EDITORIAL_FOR to '${CIO_LATEST.reportDate}'`,
    ).toBe(CIO_LATEST.reportDate);
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

  it('monthly flows net to the printed total (every published report prints its flows)', () => {
    expect(e.netflow).not.toBeNull();
    for (const c of e.comps) expect(c.flow).not.toBeNull();
    within(e.comps.reduce((s, c) => s + c.flow!, 0) + otherFlow, e.netflow!, 1);
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
    const h = e.hist!;
    expect(h).not.toBeNull();
    expect(h.c).toHaveLength(BINS.length);
    expect(h.c.reduce((s, n) => s + n, 0)).toBe(120);
    expect(inBin(BINS[h.latestBin]!, h.latest)).toBe(true);
    within(h.latest, e.total.r[0]!, 0.051);
    expect(h.min).toBeLessThanOrEqual(h.mean);
    expect(h.mean).toBeLessThanOrEqual(h.max);
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
  it('every macro line names its source: FRED or a report page', () => {
    for (const m of MACRO) expect(m.s).toMatch(/\(FRED · |\(p\. \d+/);
  });
  it('every item has a known status and a report page', () => {
    for (const o of OPS) {
      expect(Object.keys(STATUS)).toContain(o.st);
      expect(o.p).toBeGreaterThan(0);
    }
  });
});

describe('macro strip: FRED as known on each report’s date', () => {
  it('covers every report, read as of the month end before it (run tools/fetch_cio_macro.py if not)', () => {
    for (const v of CIO_VINTAGES) {
      const m = CIO_MACRO[v.reportDate];
      expect(m, `${v.reportDate}: no FRED figures`).toBeDefined();
      expect(m!.asOf).toBe(macroAsOf(v.reportDate));
      // nothing observed after the date it was read as of; index levels exactly a year apart
      for (const o of [m!.pce, m!.corePce, m!.unemployment, m!.participation]) {
        expect(o.date <= m!.asOf, `${v.reportDate} ${o.date}`).toBe(true);
      }
      for (const x of [m!.pce, m!.corePce]) {
        expect(x.yearAgo.date).toBe(`${Number(x.date.slice(0, 4)) - 1}${x.date.slice(4)}`);
      }
      within(m!.fed.high - m!.fed.low, 0.25, 0);
      if (m!.fed.since) expect(m!.fed.since <= m!.asOf).toBe(true);
    }
  });

  it('reproduces what the latest report printed (a typing slip or another measure fails here)', () => {
    const m = CIO_MACRO[CIO_LATEST.reportDate]!;
    const one = (x: number) => Math.round(x * 10) / 10;
    // FRED as of the report's date against MACRO_PRINTED in cioMonthly.data.ts (pp. 4, 6)
    const says = (what: string) =>
      `MACRO_PRINTED.${what} in cioMonthly.data.ts differs from FRED: check the figure as printed in the report`;
    expect(m.pce.date.slice(0, 7), says('pceMonth')).toBe(MACRO_PRINTED.pceMonth);
    expect(one(yoy(m.pce)), says('pce')).toBe(MACRO_PRINTED.pce);
    expect(one(yoy(m.corePce)), says('corePce')).toBe(MACRO_PRINTED.corePce);
    expect([m.fed.low, m.fed.high], says('fedLow / fedHigh')).toEqual([
      MACRO_PRINTED.fedLow,
      MACRO_PRINTED.fedHigh,
    ]);
    expect(m.unemployment.date.slice(0, 7), says('laborMonth')).toBe(MACRO_PRINTED.laborMonth);
    expect(m.participation.date.slice(0, 7), says('laborMonth')).toBe(MACRO_PRINTED.laborMonth);
    expect(m.unemployment.v, says('unemployment')).toBe(MACRO_PRINTED.unemployment);
    expect(m.participation.v, says('participation')).toBe(MACRO_PRINTED.participation);
    // the yield chart ends at the month the fund figures cover, not at the report's as-of date
    for (const o of Object.values(m.curve)) expect(o.date).toBe(MACRO_PRINTED.curveDate);
    expect(
      CURVE_KEYS.map((k) => one(m.curve[k].v)),
      says('yield curve'),
    ).toEqual(MACRO_PRINTED.curve);
    expect(MACRO_PRINTED.curveDate).toBe(CIO_LATEST.dataThrough);
  });

  it('the latest strip is FRED’s four lines with the report’s commentary, then its typed lines', () => {
    expect(MACRO.map((m) => m.l)).toEqual([
      'PCE inflation, June 2026',
      'Federal funds target range',
      'Unemployment and participation, June 2026',
      'Treasury yields, Jun 30, 2026',
      'U.S. Dollar Index, YTD to 7/31',
      'Themes to watch',
    ]);
    expect(MACRO[0]!.v).toBe('3.7% y/y');
    expect(MACRO[1]!.s).toMatch(/^In effect since Dec 11, 2025 \(FRED · Federal Reserve\)\. Fifth/);
  });
});

describe('change in fiduciary net position (transcribed from p. 21)', () => {
  // the page is an image in the PDF, so its figures are typed in; these are the checks the page
  // prints beside them, and they fail the build rather than a slide
  it('the months add to the fiscal-year total printed beside them', () => {
    const fy = NET_POSITION.trend[0]!;
    const sum = NET_POSITION.months.reduce((t, m) => t + m.v, 0);
    expect(Math.abs(sum / 1000 - fy.bn), `${sum} mm vs ${fy.bn} bn`).toBeLessThanOrEqual(0.05);
  });

  it('their signs give the months that added and took away', () => {
    const fy = NET_POSITION.trend[0]!;
    expect(NET_POSITION.months.filter((m) => m.v > 0)).toHaveLength(fy.up);
    expect(NET_POSITION.months.filter((m) => m.v < 0)).toHaveLength(fy.down);
  });

  it('covers the fiscal year the report ends in, month by month', () => {
    expect(NET_POSITION.months).toHaveLength(12);
    expect(NET_POSITION.months[0]!.m.slice(5)).toBe('07');
    expect(NET_POSITION.months.at(-1)!.m).toBe(CIO_LATEST.dataThrough.slice(0, 7));
    for (let i = 1; i < NET_POSITION.months.length; i++) {
      const prev = NET_POSITION.months[i - 1]!.m;
      const y = Number(prev.slice(0, 4));
      const mo = Number(prev.slice(5));
      const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
      expect(NET_POSITION.months[i]!.m).toBe(next);
    }
  });

  it('every fiscal year on the trend accounts for twelve months', () => {
    for (const t of NET_POSITION.trend) expect(t.up + t.down).toBe(12);
    expect(NET_POSITION.page).toBeGreaterThan(0);
  });

  // The report prints this page outside its Total Fund and OPEB sections and gives it no entity
  // heading. Which plan it belongs to was settled by scale, against the market values the reports
  // themselves print, so that reasoning is re-run here rather than left in a comment.
  const fyEnd = (through: string, k: 'pension' | 'opeb'): number => {
    const v = CIO_VINTAGES.find((x) => x.dataThrough === through);
    if (!v) throw new Error(`no vintage through ${through}`);
    const e = v.ENT[k];
    if (!e) throw new Error(`no ${k} in the vintage through ${through}`);
    return e.mv;
  };

  it('the investment-book comparison is the market values the reports print', () => {
    const moved = fyEnd('2026-06-30', 'pension') - fyEnd('2025-06-30', 'pension');
    expect(NET_POSITION.investmentBookFy.mm).toBeCloseTo(moved, 0);
    expect(NET_POSITION.investmentBookFy.label).toBe(NET_POSITION.trend[0]!.fy);
  });

  it('the year is the pension plan’s, not the OPEB trust’s', () => {
    const sum = NET_POSITION.months.reduce((t, m) => t + m.v, 0);
    const opeb = fyEnd('2026-06-30', 'opeb') - fyEnd('2025-06-30', 'opeb');
    // the whole OPEB trust moved a fraction of this; the pension plan moved about this much
    expect(Math.abs(sum)).toBeGreaterThan(Math.abs(opeb) * 3);
    expect(Math.abs(sum - NET_POSITION.investmentBookFy.mm)).toBeLessThan(
      Math.abs(NET_POSITION.investmentBookFy.mm) * 0.2,
    );
    expect(NET_POSITION.scope).toMatch(/pension/i);
  });

  it('the two books are kept apart, not treated as one figure', () => {
    const sum = NET_POSITION.months.reduce((t, m) => t + m.v, 0);
    // they are different measures of the same year; a fixture that made them equal would be wrong
    expect(sum).not.toBe(NET_POSITION.investmentBookFy.mm);
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

  it('its script parses (the deploy job runs these tests, not the browser tests)', () => {
    // slide prose sits in single-quoted strings, so an unescaped apostrophe breaks every slide
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
    expect(scripts.length).toBeGreaterThan(0);
    for (const code of scripts) expect(() => new Function(code)).not.toThrow();
  });

  it('no month or report date is hardcoded in the deck prose', () => {
    // the generated block carries the vintage labels — including the previous report's, for the
    // value bridge on slide 2; everything outside the block must take them from it
    const begin = lines.indexOf(DECK_BLOCK_BEGIN);
    const end = lines.indexOf(DECK_BLOCK_END);
    const prose = lines
      .filter((l, i) => (i <= begin || i >= end) && !l.startsWith('  const '))
      .join('\n');
    expect(prose).not.toMatch(/As of May 31, 2026|July 8, 2026|June 2016 – May 2026/);
  });

  it('the slide numbers the dashboard links to are the deck’s own order', () => {
    // the deck opens with a cover and a contents slide, so a panel's "Slide n" link must follow
    // the file, not a remembered number (views/CioMonthlyView.tsx, SLIDE)
    const ids = [...html.matchAll(/<section class="slide[^>]*data-id="([^"]+)"/g)].map(
      (m) => m[1]!,
    );
    expect(ids.slice(0, 3)).toEqual(['cover', 'contents', 'exec']);
    const view = readFileSync(new URL('../views/CioMonthlyView.tsx', import.meta.url), 'utf8');
    const map = /const SLIDE = \{([\s\S]*?)\} as const;/.exec(view)?.[1] ?? '';
    for (const m of map.matchAll(/(\w+):\s*(\d+)/g)) {
      const key = m[1]!;
      expect(`${key} is slide ${ids.indexOf(key) + 1}`).toBe(`${key} is slide ${m[2]!}`);
    }
  });

  it('links back to the dashboard tab', () => {
    expect(html).toContain('href="../#/cio?tab=summary"');
  });
});
