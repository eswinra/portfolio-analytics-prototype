import { describe, expect, it } from 'vitest';

import { CIO_GDP } from '../fixtures/cioGdp.data';
import { CIO_LATEST, CIO_VINTAGES, macroAsOf } from '../fixtures/cioMonthly';

import { gdpCaption, gdpFor, gdpScale, monthsBetween, quarterLabel, quarterLong } from './cioGdp';

describe('quarterly real GDP growth, rebuilt from FRED’s archive', () => {
  it('covers every report (run tools/fetch_cio_gdp.py if not)', () => {
    for (const v of CIO_VINTAGES) {
      expect(gdpFor(v.reportDate), `${v.reportDate}: no GDP chart`).not.toBeNull();
    }
  });

  it('the FRED values are the figures the page prints', () => {
    // the whole point of rebuilding rather than typing: if a revision moved a figure, or the
    // wrong vintage were recorded, these would stop agreeing
    for (const [reportDate, g] of Object.entries(CIO_GDP)) {
      expect(g.quarters.length, `${reportDate} bar count`).toBe(g.printed.length);
      g.quarters.forEach((q, i) => {
        expect(
          Math.abs(q.v - g.printed[i]!),
          `${reportDate} ${q.q}: FRED ${q.v} vs printed ${g.printed[i]}`,
        ).toBeLessThan(0.051);
      });
    }
  });

  it('every chart is a run of consecutive quarters ending no later than its vintage', () => {
    for (const [reportDate, g] of Object.entries(CIO_GDP)) {
      expect(g.quarters.length).toBeGreaterThanOrEqual(12);
      for (let i = 1; i < g.quarters.length; i++) {
        const prev = g.quarters[i - 1]!.q;
        const [y, q] = [Number(prev.slice(0, 4)), Number(prev.slice(5))];
        const next = q === 4 ? `${y + 1}Q1` : `${y}Q${q + 1}`;
        expect(g.quarters[i]!.q, `${reportDate} after ${prev}`).toBe(next);
      }
      // a quarter cannot be on the chart before it was published
      const last = g.quarters.at(-1)!.q;
      const endsOn = `${last.slice(0, 4)}-${String(Number(last.slice(5)) * 3).padStart(2, '0')}`;
      expect(endsOn <= g.asOf.slice(0, 7), `${reportDate}: ${last} ends after ${g.asOf}`).toBe(
        true,
      );
    }
  });

  it('the vintage is at or before the date the rest of the macro page follows', () => {
    for (const [reportDate, g] of Object.entries(CIO_GDP)) {
      expect(g.reportAsOf).toBe(macroAsOf(reportDate));
      expect(g.asOf <= g.reportAsOf, `${reportDate}`).toBe(true);
      expect(g.stale).toBe(g.asOf !== g.reportAsOf);
    }
  });

  it('the reports that carry an older vintage are named, not smoothed over', () => {
    // late 2025 is the case that makes the identified vintage necessary: four consecutive reports
    // print the chart exactly as FRED stood on July 31, 2025
    const held = Object.entries(CIO_GDP).filter(([, g]) => g.asOf === '2025-07-31');
    expect(held.map(([d]) => d)).toEqual([
      '2025-08-13',
      '2025-09-10',
      '2025-10-08',
      '2025-11-12',
      '2025-12-10',
    ]);
    expect(held.filter(([, g]) => g.stale)).toHaveLength(4);
    expect(Object.values(CIO_GDP).filter((g) => g.stale).length).toBeGreaterThan(0);
  });

  it('the latest report’s chart is current and ends at the quarter the fund figures cover', () => {
    const g = gdpFor(CIO_LATEST.reportDate)!;
    expect(g.stale).toBe(false);
    const through = CIO_LATEST.dataThrough; // 2026-06-30
    const q = `${through.slice(0, 4)}Q${Math.ceil(Number(through.slice(5, 7)) / 3)}`;
    expect(g.quarters.at(-1)!.q).toBe(q);
  });
});

describe('how the GDP chart is labelled', () => {
  it('quarter labels read the way the axis and the caption need them', () => {
    expect(quarterLabel('2026Q2')).toBe('Q2 26');
    expect(quarterLong('2026Q2')).toBe('Q2 2026');
  });

  it('months between two dates', () => {
    expect(monthsBetween('2025-07-31', '2025-11-30')).toBe(4);
    expect(monthsBetween('2025-07-31', '2025-07-31')).toBe(0);
    expect(monthsBetween('2025-12-31', '2026-02-28')).toBe(2);
  });

  it('a current chart says its vintage and nothing more', () => {
    const cap = gdpCaption(gdpFor(CIO_LATEST.reportDate)!);
    expect(cap.stale).toBeNull();
    expect(cap.asOf).toBe('as FRED showed it on July 31, 2026');
    expect(cap.range).toMatch(/^Real GDP, quarterly, annualised — Q\d \d{4} to Q2 2026$/);
    expect(cap.latest.q).toBe('2026Q2');
  });

  it('a chart that was behind says how far behind, and that it is reproduced as printed', () => {
    const cap = gdpCaption(gdpFor('2025-12-10')!);
    expect(cap.stale).toContain('July 31, 2025');
    expect(cap.stale).toContain('4 months older');
    expect(cap.stale).toContain('reproduced as printed');
  });

  it('the scale always includes zero, so a negative quarter reads as one', () => {
    const s = gdpScale([
      { q: '2025Q1', v: -0.6 },
      { q: '2025Q2', v: 3.8 },
    ]);
    expect(s.min).toBe(-0.6);
    expect(s.max).toBe(3.8);
    expect(s.zero).toBeCloseTo((3.8 / 4.4) * 100, 6);

    // all-positive data still puts the baseline at the bottom
    const p = gdpScale([
      { q: '2025Q1', v: 1 },
      { q: '2025Q2', v: 3 },
    ]);
    expect(p.min).toBe(0);
    expect(p.zero).toBe(100);
  });
});
