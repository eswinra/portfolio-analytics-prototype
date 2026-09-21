import { describe, expect, it } from 'vitest';

import { CIO_LATEST, CIO_VINTAGES, PERIODS, type CioVintage } from '../fixtures/cioMonthly';

import {
  allLines,
  compareReports,
  defaultPartner,
  JUDGED_PERIODS,
  MATERIAL,
  monthsBetween,
  windowOverlap,
} from './compare';

const byThrough = (d: string): CioVintage => {
  const v = CIO_VINTAGES.find((x) => x.dataThrough === d);
  if (!v) throw new Error(`no report through ${d}`);
  return v;
};

describe('the arithmetic under the comparison', () => {
  it('counts months between month ends by calendar month', () => {
    expect(monthsBetween('2025-06-30', '2026-06-30')).toBe(12);
    expect(monthsBetween('2025-12-31', '2026-01-31')).toBe(1);
  });

  it('measures how many months two trailing windows share', () => {
    expect(windowOverlap(36, 12)).toBe(24);
    expect(windowOverlap(12, 12)).toBe(0);
    expect(windowOverlap(1, 12)).toBe(0);
    expect(windowOverlap(120, 12)).toBe(108);
    expect(windowOverlap(36, -12)).toBe(24);
  });
});

describe('two reports side by side', () => {
  const yearAgo = byThrough('2025-06-30');

  it('always runs earlier then later, whichever report was picked first', () => {
    const one = compareReports(CIO_LATEST, yearAgo, 'pension');
    const two = compareReports(yearAgo, CIO_LATEST, 'pension');
    expect(one.earlier).toBe(yearAgo);
    expect(one.later).toBe(CIO_LATEST);
    // the same answer either way: the sign of a change never depends on the order of two dropdowns
    expect(allLines(one).map((l) => l.change)).toEqual(allLines(two).map((l) => l.change));
    expect(one.gapMonths).toBe(12);
  });

  it('a change is later minus earlier, and missing on either side means no change at all', () => {
    for (const v of CIO_VINTAGES) {
      if (v === CIO_LATEST) continue;
      for (const entity of ['pension', 'opeb'] as const) {
        for (const l of allLines(compareReports(v, CIO_LATEST, entity))) {
          if (l.earlier === null || l.later === null || !l.comparable) {
            expect(l.change, `${v.dataThrough} ${entity} ${l.key}`).toBeNull();
          } else {
            expect(l.change).toBeCloseTo(l.later - l.earlier, 9);
          }
        }
      }
    }
  });

  it('market value carries the reminder that it is not a return', () => {
    const mv = compareReports(yearAgo, CIO_LATEST, 'pension').fund.find((l) => l.key === 'mv')!;
    expect(mv.note).toMatch(/not a return/);
    expect(mv.change).toBeCloseTo(CIO_LATEST.ENT.pension.aum - yearAgo.ENT.pension.aum, 9);
  });

  it('trailing windows that overlap say by how much', () => {
    const c = compareReports(yearAgo, CIO_LATEST, 'pension');
    const note = (p: string) => c.returns.find((l) => l.label === p)!.note;
    // a year apart: 1 M, 3 M and 1 Y are disjoint; the longer windows share most of their months
    expect(note('1 M')).toBeUndefined();
    expect(note('3 M')).toBeUndefined();
    expect(note('1 Y')).toBeUndefined();
    expect(note('3 Y')).toBe('The two windows share 24 of 36 months');
    expect(note('5 Y')).toBe('The two windows share 48 of 60 months');
    expect(note('10 Y')).toBe('The two windows share 108 of 120 months');
    expect(c.fund.find((l) => l.key === 'god')!.note).toBe('The two windows share 48 of 60 months');
  });

  it('FYTD and YTD across a reset are not compared, and say why', () => {
    // June 2025 is FY2025 and June 2026 is FY2026: different fiscal and calendar years
    const c = compareReports(yearAgo, CIO_LATEST, 'pension');
    expect(c.fyReset).toBe(true);
    for (const p of ['FYTD', 'YTD']) {
      const r = c.returns.find((l) => l.label === p)!;
      expect(r.comparable, p).toBe(false);
      expect(r.change, p).toBeNull();
      expect(r.material, p).toBe(false);
      expect(r.note, p).toMatch(/not compared/);
      const x = c.excess.find((l) => l.label === p)!;
      expect(x.comparable, p).toBe(false);
      expect(x.change, p).toBeNull();
    }
    expect(c.returns.find((l) => l.label === 'FYTD')!.note).toContain('FY2025 and FY2026');
  });

  it('within one fiscal year FYTD is compared, and the note says the later figure contains the earlier', () => {
    const c = compareReports(byThrough('2025-10-31'), byThrough('2026-04-30'), 'pension');
    expect(c.fyReset).toBe(false);
    const fytd = c.returns.find((l) => l.label === 'FYTD')!;
    expect(fytd.comparable).toBe(true);
    expect(fytd.note).toMatch(/includes the earlier months/);
    // across January, YTD is a different calendar year
    expect(c.yearReset).toBe(true);
    expect(c.returns.find((l) => l.label === 'YTD')!.comparable).toBe(false);
  });

  it('one row per reported period, for returns and for excess', () => {
    const c = compareReports(yearAgo, CIO_LATEST, 'opeb');
    expect(c.returns.map((l) => l.label)).toEqual(PERIODS);
    expect(c.excess.map((l) => l.label)).toEqual(PERIODS);
  });

  it('marks as material exactly what "What changed" would, and no more', () => {
    for (const v of CIO_VINTAGES) {
      if (v === CIO_LATEST) continue;
      const c = compareReports(v, CIO_LATEST, 'pension');
      for (const l of c.returns) {
        // only the decision periods are judged; the rest show a change but are never marked
        const judged = JUDGED_PERIODS.has(l.label);
        if (l.change === null || !judged) expect(l.material, l.key).toBe(false);
        else expect(l.material, l.key).toBe(Math.abs(l.change) >= MATERIAL.returnPp - 1e-9);
      }
      // cash and geography have no established threshold, so they are never judged
      for (const l of [...c.fund.filter((x) => x.key !== 'mv'), ...c.geography]) {
        expect(l.material, `${v.dataThrough} ${l.key}`).toBe(false);
      }
    }
  });

  it('an excess that changes sign is material, and says which way', () => {
    let seen = 0;
    for (const v of CIO_VINTAGES) {
      if (v === CIO_LATEST) continue;
      for (const l of compareReports(v, CIO_LATEST, 'pension').excess) {
        const flipped =
          l.comparable && l.earlier !== null && l.later !== null && l.earlier * l.later < 0;
        expect(l.material, `${v.dataThrough} ${l.key}`).toBe(flipped);
        if (flipped) {
          seen++;
          expect(l.note).toMatch(/^Turned (positive|negative)/);
        }
      }
    }
    // the check means nothing unless the series contains at least one flip
    expect(seen).toBeGreaterThan(0);
  });

  it('composites are matched on their key, and a moved policy target is called out', () => {
    const c = compareReports(yearAgo, CIO_LATEST, 'pension');
    const keys = c.allocation.map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const l of c.allocation) {
      const k = l.key.slice(2);
      const a = yearAgo.ENT.pension.comps.find((x) => x.k === k);
      const b = CIO_LATEST.ENT.pension.comps.find((x) => x.k === k);
      if (a && b) {
        expect(l.earlier).toBe(a.pct);
        expect(l.later).toBe(b.pct);
        if (Math.abs(b.tgt - a.tgt) >= MATERIAL.targetPp) {
          expect(l.material).toBe(true);
          expect(l.note).toMatch(/not comparable across policies/);
        }
      }
    }
  });
});

describe('the marker has to mean something', () => {
  it('a year apart, it does not mark nearly every return row', () => {
    const c = compareReports(
      CIO_VINTAGES.find((x) => x.dataThrough === '2025-06-30')!,
      CIO_LATEST,
      'pension',
    );
    const marked = c.returns.filter((l) => l.material).length;
    // at most the two decision periods, never the whole column
    expect(marked).toBeLessThanOrEqual(JUDGED_PERIODS.size);
  });
});

describe('the default comparison', () => {
  it('is the same month a year earlier when there is one', () => {
    expect(defaultPartner(CIO_LATEST)!.dataThrough).toBe('2025-06-30');
  });

  it('falls back to the report before when there is no year-earlier report', () => {
    const first = CIO_VINTAGES[0]!;
    const second = CIO_VINTAGES[1]!;
    // the second report has no year-earlier partner; the first is the one before it
    expect(defaultPartner(second)!.dataThrough).toBe(first.dataThrough);
  });

  it('never pairs a report with itself', () => {
    for (const v of CIO_VINTAGES) {
      const p = defaultPartner(v);
      expect(p, v.dataThrough).not.toBeNull();
      expect(p!.dataThrough).not.toBe(v.dataThrough);
    }
  });
});
