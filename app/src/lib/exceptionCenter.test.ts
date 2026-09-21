import { describe, expect, it } from 'vitest';

import { CONFIG } from '../config';
import { CIO_LATEST, CIO_VINTAGES, priorVintage, type CioVintage } from '../fixtures/cioMonthly';

import { cioChanges } from './cioNarrative';
import { centerLink, centerSummary, exceptionCenter, type CenterKind } from './exceptionCenter';
import { freshnessFor } from './freshness';
import { resolveFigure } from './provenance';

const byThrough = (d: string): CioVintage => {
  const v = CIO_VINTAGES.find((x) => x.dataThrough === d);
  if (!v) throw new Error(`no report through ${d}`);
  return v;
};

// the panels the CIO Monthly view renders, by sub-tab (TAB_OF in CioMonthlyView.tsx)
const PANELS: Record<string, string> = {
  'cio-kpis': 'summary',
  'cio-read': 'summary',
  'cio-changed': 'summary',
  'cio-freshness': 'summary',
  'cio-perf': 'performance',
  'cio-comps': 'positioning',
  'cio-hist': 'positioning',
  'cio-market': 'markets',
};

describe('changes to explain', () => {
  it('are exactly what "What changed" lists, for both funds, so the two cannot disagree', () => {
    for (const v of CIO_VINTAGES) {
      const prior = priorVintage(v);
      const c = exceptionCenter(v);
      for (const fund of ['pension', 'opeb'] as const) {
        const expected = prior
          ? cioChanges(v.ENT[fund], prior.ENT[fund], {
              through: v.dataThrough,
              priorThrough: prior.dataThrough,
            })
              .filter((x) => !x.reset)
              .map((x) => x.label)
          : [];
        const got = c.items.filter((i) => i.kind === 'explain' && i.fund === fund);
        expect(
          got.map((i) => i.title),
          `${v.dataThrough} ${fund}`,
        ).toEqual(expected);
      }
    }
  });

  it('the earliest report has nothing to explain, and says there is no prior', () => {
    const c = exceptionCenter(CIO_VINTAGES[0]!);
    expect(c.prior).toBeNull();
    expect(c.counts.explain).toBe(0);
    expect(centerSummary(c)).toMatch(/no prior report to compare/);
  });

  it('a new fiscal year is context, not a change to explain', () => {
    const july = CIO_VINTAGES.find((v) => v.dataThrough.slice(5, 7) === '07')!;
    expect(exceptionCenter(july).items.some((i) => i.id.endsWith(':fy-reset'))).toBe(false);
  });
});

describe('policy', () => {
  it('nothing in the published series comes within the site threshold of a bound', () => {
    // a fact about the data, and why the section's empty state names the closest margin
    for (const v of CIO_VINTAGES) {
      const c = exceptionCenter(v);
      expect(c.counts.outside + c.counts.near, v.dataThrough).toBe(0);
      expect(c.closest!.dist).toBeGreaterThan(CONFIG.nearBoundPp);
    }
  });

  it('near a bound: names the bound and how long it has held', () => {
    const c = exceptionCenter(CIO_LATEST, { nearPp: 8 });
    const near = c.items.filter((i) => i.kind === 'near');
    expect(near.length).toBeGreaterThan(0);
    const growth = near.find((i) => i.id === 'near:pension:growth')!;
    expect(growth.title).toMatch(/^Growth is \d+\.\d pp from its (lower|upper) IPS bound$/);
    expect(growth.running!.count).toBeGreaterThanOrEqual(1);
    expect(growth.where).toEqual({
      tab: 'positioning',
      panel: 'cio-comps',
      fig: 'pension.growth.bound',
    });
    // the run counts back through the series while the condition held, and no further
    const i = CIO_VINTAGES.indexOf(CIO_LATEST);
    const first = CIO_VINTAGES.findIndex((x) => x.reportLabel === growth.running!.since);
    expect(i - first + 1).toBe(growth.running!.count);
    if (first > 0) {
      const before = exceptionCenter(CIO_VINTAGES[first - 1]!, { nearPp: 8 });
      expect(before.items.some((x) => x.id === 'near:pension:growth')).toBe(false);
    }
  });

  it('outside a range is its own kind and comes first', () => {
    const comps = CIO_LATEST.ENT.pension.comps.map((c) =>
      c.k === 'growth' ? { ...c, pct: 60 } : c,
    );
    const moved: CioVintage = {
      ...CIO_LATEST,
      ENT: { ...CIO_LATEST.ENT, pension: { ...CIO_LATEST.ENT.pension, comps } },
    };
    const c = exceptionCenter(moved);
    expect(c.items[0]!.kind).toBe('outside');
    expect(c.items[0]!.title).toBe('Growth is outside its IPS range');
    expect(c.items[0]!.detail).toMatch(/4\.0 pp past the upper bound/);
    // a report outside the published series has no run to count
    expect(c.items[0]!.running).toBeUndefined();
  });
});

describe('data conditions', () => {
  it('a month missing from the series is named, with how far back the changes reach', () => {
    const c = exceptionCenter(byThrough('2025-12-31'));
    const gap = c.items.find((i) => i.id === 'data:report:gap')!;
    expect(gap.title).toBe('The prior report is 2 months earlier');
    expect(gap.detail).toContain('no report with data through November 30, 2025');
    expect(gap.detail).toContain('spans 2 months');
  });

  it('an unreadable market table is listed only for the reports that have one', () => {
    for (const v of CIO_VINTAGES) {
      const has = exceptionCenter(v).items.some((i) => i.id === 'data:report:market');
      expect(has, v.dataThrough).toBe(v.MKT === null);
    }
  });

  it('counts how many reports running a condition has held', () => {
    // the first six reports' market tables were unreadable in a row
    const run = exceptionCenter(byThrough('2025-07-31')).items.find(
      (i) => i.id === 'data:report:market',
    )!.running!;
    expect(run).toEqual({ count: 6, since: CIO_VINTAGES[0]!.reportLabel });
    // after a readable one, the count starts again
    expect(
      exceptionCenter(byThrough('2025-09-30')).items.find((i) => i.id === 'data:report:market')!
        .running!.count,
    ).toBe(1);
  });

  it('a GDP chart the report did not redraw is listed exactly when the freshness matrix says so', () => {
    for (const v of CIO_VINTAGES) {
      const stale = freshnessFor(v).rows.find((r) => r.key === 'gdp')?.cls === 'stale';
      const has = exceptionCenter(v).items.some((i) => i.id === 'data:report:gdp');
      expect(has, v.dataThrough).toBe(stale);
    }
  });

  it('a period the report left blank is missing, and says it is never shown as zero', () => {
    const first = exceptionCenter(CIO_VINTAGES[0]!);
    const p = first.items.find((i) => i.id === 'data:pension:periods')!;
    expect(p.title).toBe('Total-fund return not printed for YTD');
    expect(p.detail).toMatch(/never as zero/);
  });

  it('standing caveats, true of every report, are never listed', () => {
    for (const v of CIO_VINTAGES) {
      for (const i of exceptionCenter(v).items) {
        expect(i.title, `${v.dataThrough} ${i.id}`).not.toMatch(
          /private|real estate|ODCE|a month ahead/i,
        );
      }
    }
  });
});

describe('every item', () => {
  it('points at a panel the CIO view renders, on the right sub-tab, and a figure that resolves', () => {
    for (const v of CIO_VINTAGES) {
      for (const i of exceptionCenter(v, { nearPp: 8 }).items) {
        expect(PANELS[i.where.panel], `${v.dataThrough} ${i.id} panel`).toBe(i.where.tab);
        if (i.where.fig) {
          const r = resolveFigure(i.where.fig, { vintage: v, base: 'reported_public' });
          expect(r.ok, `${v.dataThrough} ${i.id} → ${i.where.fig}`).toBe(true);
        }
      }
    }
  });

  it('is in order: outside, near, data, then changes to explain', () => {
    const order: CenterKind[] = ['outside', 'near', 'data', 'explain'];
    for (const v of CIO_VINTAGES) {
      const kinds = exceptionCenter(v, { nearPp: 8 }).items.map((i) => order.indexOf(i.kind));
      expect(kinds, v.dataThrough).toEqual([...kinds].sort((a, b) => a - b));
    }
  });

  it('has an id unique within its report', () => {
    for (const v of CIO_VINTAGES) {
      const ids = exceptionCenter(v, { nearPp: 8 }).items.map((i) => i.id);
      expect(new Set(ids).size, v.dataThrough).toBe(ids.length);
    }
  });
});

describe('links and the one-line summary', () => {
  it('opens the fund, report, panel and figure the item is about', () => {
    const c = exceptionCenter(byThrough('2025-12-31'));
    const opeb = c.items.find((i) => i.kind === 'explain' && i.fund === 'opeb')!;
    const href = centerLink(opeb, { report: '2025-12-31', entity: 'PENSION' });
    const q = new URLSearchParams(href.split('?')[1]);
    expect(href.startsWith('/cio?')).toBe(true);
    expect(q.get('tab')).toBe('summary');
    expect(q.get('p')).toBe('cio-changed');
    expect(q.get('e')).toBe('OPEB');
    expect(q.get('v')).toBe('2025-12-31');
    expect(q.get('fig')).toBe(opeb.where.fig);
    // the latest report is the default and stays out of the address; a report-wide item keeps
    // the fund on screen
    const gap = c.items.find((i) => i.id === 'data:report:gap')!;
    const latest = new URLSearchParams(
      centerLink(gap, { report: CIO_LATEST.dataThrough, entity: 'OPEB' }).split('?')[1],
    );
    expect(latest.get('v')).toBeNull();
    expect(latest.get('e')).toBe('OPEB');
  });

  it('reads as a sentence with every count', () => {
    const s = centerSummary(exceptionCenter(CIO_LATEST));
    expect(s).toMatch(
      /^No policy exceptions · (no|\d+) data conditions? · \d+ changes? to explain$/,
    );
  });
});
