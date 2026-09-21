import { describe, expect, it } from 'vitest';

import { CIO_LATEST, CIO_MACRO, CIO_VINTAGES } from '../fixtures/cioMonthly';
import { MACRO_PRINTED } from '../fixtures/cioMonthly.data';

import { gdpFor } from './cioGdp';
import {
  freshnessFor,
  freshnessSpan,
  monthsApart,
  offAnchor,
  offAnchorNote,
  offsetLabel,
} from './freshness';

describe('months between two month-end dates', () => {
  it('counts calendar months, not days', () => {
    expect(monthsApart('2026-06-30', '2026-07-31')).toBe(1);
    expect(monthsApart('2026-06-30', '2026-06-30')).toBe(0);
    expect(monthsApart('2026-06-30', '2025-07-31')).toBe(-11);
    expect(monthsApart('2025-12-31', '2026-01-31')).toBe(1);
  });

  it('reads the offset the way the panel states it', () => {
    expect(offsetLabel(0)).toBe('same month as the fund figures');
    expect(offsetLabel(1)).toBe('1 month ahead of the fund figures');
    expect(offsetLabel(-4)).toBe('4 months behind the fund figures');
    expect(offsetLabel(null)).toBe('no single date');
  });
});

describe('when each figure on the CIO Monthly tab was true', () => {
  it('anchors on the month the fund figures cover', () => {
    const f = freshnessFor(CIO_LATEST);
    expect(f.anchor).toBe(CIO_LATEST.dataThrough);
    const fund = f.rows.find((r) => r.key === 'fund')!;
    expect(fund.asOf).toBe(CIO_LATEST.dataThrough);
    expect(fund.months).toBe(0);
    expect(fund.direction).toBe('anchor');
  });

  it('every dated row’s offset is the distance from the anchor', () => {
    for (const v of CIO_VINTAGES) {
      const f = freshnessFor(v);
      for (const r of f.rows) {
        if (r.asOf === null) {
          expect(r.months, `${v.reportDate} ${r.key}`).toBeNull();
          expect(r.direction).toBe('undated');
          expect(r.asOfNote, `${r.key} must say how it is dated`).toBeTruthy();
        } else {
          expect(r.months, `${v.reportDate} ${r.key}`).toBe(monthsApart(f.anchor, r.asOf));
          expect(r.direction).toBe(r.months === 0 ? 'anchor' : r.months! > 0 ? 'ahead' : 'behind');
        }
      }
    }
  });

  it('the market table is a month AHEAD of the fund figures, and says why', () => {
    // the trap this panel exists for: index moves here are not the month the fund performance
    // covers, and nothing else on the tab makes that visible
    for (const v of CIO_VINTAGES) {
      if (!v.marketAsOf) continue;
      const mkt = freshnessFor(v).rows.find((r) => r.key === 'market')!;
      expect(mkt.direction, `${v.reportDate}`).toBe('ahead');
      expect(mkt.months).toBe(1);
      expect(mkt.why).toMatch(/not the month the fund performance covers/);
    }
  });

  it('the Treasury curve sits at the fund’s month end, not the macro page’s date', () => {
    const f = freshnessFor(CIO_LATEST);
    const curve = f.rows.find((r) => r.key === 'curve')!;
    const macro = f.rows.find((r) => r.key === 'macro')!;
    expect(curve.asOf).toBe(MACRO_PRINTED.curveDate);
    expect(curve.months).toBe(0);
    // two as-of dates on one page of the report, which the panel shows as two rows
    expect(macro.months).toBe(1);
    expect(curve.asOf).not.toBe(macro.asOf);
  });

  it('a GDP chart the report did not redraw is marked stale and says how far behind', () => {
    // staleness here is relative to the report's OWN macro page, not to the fund anchor: a chart
    // can be behind its own page and still land on the fund's month, so the two are kept apart
    const behind = CIO_VINTAGES.filter((v) => gdpFor(v.reportDate)?.stale);
    expect(behind.length).toBeGreaterThan(0);
    for (const v of behind) {
      const gdp = freshnessFor(v).rows.find((r) => r.key === 'gdp')!;
      expect(gdp.cls, `${v.reportDate}`).toBe('stale');
      expect(gdp.why).toMatch(/older than the rest of its own macro page/);
      // dates in prose read the way every other date on the panel does, never ISO
      expect(gdp.why, `${v.reportDate}`).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    }
    // the late-2025 run is behind the fund anchor as well as behind its own page
    const dec = freshnessFor(CIO_VINTAGES.find((v) => v.reportDate === '2025-12-10')!);
    expect(dec.rows.find((r) => r.key === 'gdp')!.direction).toBe('behind');
    // and one that is current is not marked stale
    const current = freshnessFor(CIO_LATEST).rows.find((r) => r.key === 'gdp')!;
    expect(current.cls).toBe('reported_public');
    expect(current.why).toBeUndefined();
  });

  it('the curve date is each report’s own observation, never the latest report’s', () => {
    // the bug this catches: using MACRO_PRINTED (the latest transcription) for every vintage put
    // a June 2026 curve on the April 2025 report
    for (const v of CIO_VINTAGES) {
      const curve = freshnessFor(v).rows.find((r) => r.key === 'curve');
      if (!curve?.asOf) continue;
      expect(curve.asOf.slice(0, 7) <= v.reportDate.slice(0, 7), `${v.reportDate}`).toBe(true);
      expect(curve.asOf, `${v.reportDate}`).toBe(CIO_MACRO[v.reportDate]!.curve.y10.date);
    }
  });

  it('figures with a lag but no single date say how they are dated instead', () => {
    const f = freshnessFor(CIO_LATEST);
    for (const key of ['odce', 'private']) {
      const r = f.rows.find((x) => x.key === key)!;
      expect(r.asOf, key).toBeNull();
      expect(r.asOfNote, key).toBeTruthy();
      expect(r.cls, key).toBe('stale');
      expect(r.why, key).toBeTruthy();
    }
  });

  it('nothing on the tab claims to be more current than the report that carried it', () => {
    for (const v of CIO_VINTAGES) {
      const f = freshnessFor(v);
      // the report date is a month for one vintage whose cover names no day
      const reportMonth = v.reportDate.slice(0, 7);
      for (const r of f.rows) {
        if (!r.asOf) continue;
        expect(r.asOf.slice(0, 7) <= reportMonth, `${v.reportDate} ${r.key} = ${r.asOf}`).toBe(
          true,
        );
      }
    }
  });

  it('the spread is the range the FIGURES cover, not including the publication date', () => {
    const f = freshnessFor(CIO_LATEST);
    const span = freshnessSpan(f)!;
    expect(span.from <= f.anchor).toBe(true);
    expect(span.to >= f.anchor).toBe(true);
    // the latest report spans the fund month and the month after it
    expect(span.months).toBe(1);
    // nothing is reported as of the day the report was presented, so it must not extend the range
    expect(span.to).not.toBe(CIO_LATEST.reportDate);
    expect(span.to).toBe(CIO_LATEST.marketAsOf);
  });

  it('the headline counts the figures that carry another date, excluding the report itself', () => {
    const { off, total } = offAnchor(CIO_LATEST);
    const rows = freshnessFor(CIO_LATEST).rows.filter((r) => r.key !== 'report');
    expect(total).toBe(rows.length);
    expect(off).toBe(rows.filter((r) => r.direction !== 'anchor').length);
    expect(off).toBeGreaterThan(0);
    expect(offAnchorNote(CIO_LATEST)).toContain(`${off} of ${total}`);
  });

  it('every row names a source, a cadence and where it appears', () => {
    for (const v of CIO_VINTAGES) {
      for (const r of freshnessFor(v).rows) {
        expect(r.source, `${v.reportDate} ${r.key}`).toBeTruthy();
        expect(r.where, `${v.reportDate} ${r.key}`).toBeTruthy();
        expect(['daily', 'monthly', 'quarterly', 'annual', 'as published']).toContain(r.cadence);
      }
    }
  });

  it('row keys are unique, so the table can be keyed by them', () => {
    for (const v of CIO_VINTAGES) {
      const keys = freshnessFor(v).rows.map((r) => r.key);
      expect(new Set(keys).size, v.reportDate).toBe(keys.length);
    }
  });
});
