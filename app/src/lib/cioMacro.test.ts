import { describe, expect, it } from 'vitest';

import { macroAsOf, macroLines, macroMonth, yoy, type CioMacroVintage } from './cioMacro';

/** Synthetic values: an index that rose 3.7% over the year, core 3.3%. */
const M: CioMacroVintage = {
  asOf: '2026-07-31',
  pce: { date: '2026-06-01', v: 103.7, yearAgo: { date: '2025-06-01', v: 100 } },
  corePce: { date: '2026-06-01', v: 206.6, yearAgo: { date: '2025-06-01', v: 200 } },
  unemployment: { date: '2026-06-01', v: 4.2 },
  participation: { date: '2026-06-01', v: 61.5 },
  fed: { low: 3.5, high: 3.75, since: '2025-12-11' },
  // the yield curve is read at the fund's month end, not at the date the rest is read as of
  curve: {
    m3: { date: '2026-06-30', v: 3.87 },
    y2: { date: '2026-06-30', v: 4.14 },
    y5: { date: '2026-06-30', v: 4.19 },
    y10: { date: '2026-06-30', v: 4.44 },
    y30: { date: '2026-06-30', v: 4.91 },
  },
};

describe('macro strip from FRED', () => {
  it('reads each report as of the month end before its month', () => {
    expect(macroAsOf('2026-08-12')).toBe('2026-07-31');
    expect(macroAsOf('2026-03-11')).toBe('2026-02-28');
    expect(macroAsOf('2028-03-08')).toBe('2028-02-29');
    // January reports read as of December 31 of the year before
    expect(macroAsOf('2027-01-13')).toBe('2026-12-31');
    // covers that name only the month
    expect(macroAsOf('2025-07')).toBe('2025-06-30');
  });

  it('computes year-over-year inflation from index levels a year apart', () => {
    expect(yoy(M.pce)).toBeCloseTo(3.7, 10);
    expect(yoy(M.corePce)).toBeCloseTo(3.3, 10);
    expect(yoy({ date: '2026-06-01', v: 98, yearAgo: { date: '2025-06-01', v: 100 } })).toBeCloseTo(
      -2,
      10,
    );
  });

  it('names months without shifting across time zones', () => {
    expect(macroMonth('2026-06-01')).toBe('June 2026');
    expect(macroMonth('2025-01-01')).toBe('January 2025');
  });

  it('builds the four lines with their FRED source', () => {
    expect(macroLines(M)).toEqual([
      { l: 'PCE inflation, June 2026', v: '3.7% y/y', s: 'Core 3.3% (FRED · BEA)' },
      {
        l: 'Federal funds target range',
        v: '3.50–3.75%',
        s: 'In effect since Dec 11, 2025 (FRED · Federal Reserve)',
      },
      {
        l: 'Unemployment and participation, June 2026',
        v: '4.2% · 61.5%',
        s: 'Unemployment rate · labor force participation rate (FRED · BLS)',
      },
      {
        l: 'Treasury yields, Jun 30, 2026',
        v: '3.9 · 4.1 · 4.2 · 4.4 · 4.9%',
        s: '3M · 2Y · 5Y · 10Y · 30Y constant maturity (FRED · Federal Reserve)',
      },
    ]);
  });

  it('appends the report’s commentary after the source, when given', () => {
    const [pce, fed, labor] = macroLines(M, { pce: 'Easing (p. 4)', fed: 'Fifth pause (p. 4)' });
    expect(pce!.s).toBe('Core 3.3% (FRED · BEA). Easing (p. 4)');
    expect(fed!.s).toBe(
      'In effect since Dec 11, 2025 (FRED · Federal Reserve). Fifth pause (p. 4)',
    );
    expect(labor!.s).not.toContain('(p.');
  });

  it('says so when the range predates the window read, and names both labor months if they differ', () => {
    const lines = macroLines({
      ...M,
      fed: { low: 0, high: 0.25, since: null },
      participation: { date: '2026-05-01', v: 61.6 },
    });
    expect(lines[1]!.s).toBe('In effect six years or more (FRED · Federal Reserve)');
    expect(lines[2]!.l).toBe('Unemployment and participation, June 2026 / May 2026');
  });
});
