import { describe, expect, it } from 'vitest';

import { CIO_LATEST, CIO_VINTAGES, PERIODS, priorVintage } from '../fixtures/cioMonthly';
import { SOURCES } from '../fixtures/sources';

import { allLines, compareReports } from './compare';
import {
  compareFigId,
  figId,
  figureIds,
  ipsRange,
  periodWindow,
  proxyAttribution,
  resolveFigure,
  whenText,
  type Provenance,
  type ProvenanceContext,
} from './provenance';

const ctx: ProvenanceContext = { vintage: CIO_LATEST, base: 'reported_public' };
const get = (id: string, c: ProvenanceContext = ctx): Provenance => {
  const r = resolveFigure(id, c);
  if (!r.ok) throw new Error(`${id}: ${r.reason}`);
  return r.fig;
};
const FYTD = PERIODS.indexOf('FYTD');
const ONE_M = PERIODS.indexOf('1 M');
const TEN_Y = PERIODS.indexOf('10 Y');

describe('when a figure was true', () => {
  it('each period is the months it covers, ending at the month end', () => {
    const at = (p: string, d: string) => periodWindow(p, d)!.from;
    expect(at('1 M', '2026-06-30')).toBe('2026-06-01');
    expect(at('3 M', '2026-06-30')).toBe('2026-04-01');
    expect(at('FYTD', '2026-06-30')).toBe('2025-07-01');
    expect(at('YTD', '2026-06-30')).toBe('2026-01-01');
    expect(at('1 Y', '2026-06-30')).toBe('2025-07-01');
    expect(at('3 Y', '2026-06-30')).toBe('2023-07-01');
    expect(at('10 Y', '2026-06-30')).toBe('2016-07-01');
  });

  it('FYTD in July is one month, and a three-month window crosses the new year', () => {
    expect(periodWindow('FYTD', '2025-07-31')).toMatchObject({
      from: '2025-07-01',
      basis: 'cumulative over 1 month',
    });
    expect(periodWindow('3 M', '2026-01-31')!.from).toBe('2025-11-01');
    expect(periodWindow('YTD', '2026-01-31')!.from).toBe('2026-01-01');
  });

  it('says whether a return is cumulative or annualized', () => {
    expect(periodWindow('3 M', '2026-06-30')!.basis).toBe('cumulative over 3 months');
    expect(periodWindow('1 Y', '2026-06-30')!.basis).toMatch(
      /annualized and cumulative are the same/,
    );
    // a June FYTD is twelve months too, but it is a cumulative figure, not a one-year return
    expect(periodWindow('FYTD', '2026-06-30')!.basis).toBe('cumulative over 12 months');
    expect(periodWindow('5 Y', '2026-06-30')!.basis).toBe('annualized over 5 years');
    expect(periodWindow('2 Y', '2026-06-30')).toBeNull();
  });

  it('reads as dates, never as ISO strings', () => {
    const w = get(figId.r('pension', FYTD)).when;
    expect(whenText(w)).not.toMatch(/\d{4}-\d{2}/);
    expect(whenText({ kind: 'point', date: '2026-06-30' })).toBe('At the month end, June 30, 2026');
  });
});

describe('a printed figure', () => {
  const e = CIO_LATEST.ENT.pension;

  it('is the figure the report prints, on the page it is printed on', () => {
    const f = get(figId.r('pension', FYTD));
    expect(f.value).toBe(e.total.r[FYTD]);
    expect(f.cls).toBe('reported_public');
    expect(f.sources).toHaveLength(1);
    const table = CIO_LATEST.pages.pension[1];
    expect(f.sources[0]!.pageTable).toBe(`p. ${table}`);
    expect(f.sources[0]!.url).toBe(`${CIO_LATEST.url}#page=${table}`);
    expect(f.read[0]).toContain(`p. ${table}`);
  });

  it('the market value in billions cites the summary page, in millions the table', () => {
    const [summary, table] = CIO_LATEST.pages.opeb;
    expect(get(figId.aum('opeb')).sources[0]!.pageTable).toBe(`p. ${summary}`);
    expect(get(figId.mv('opeb')).sources[0]!.pageTable).toBe(`p. ${table}`);
  });

  it('names the check that tied it to another printed figure, or says nothing did', () => {
    expect(get(figId.aum('pension')).read.join(' ')).toMatch(/agree to within \$0\.06 billion/);
    expect(get(figId.r('pension', ONE_M)).read.join(' ')).toMatch(/within 0\.05 point/);
    expect(get(figId.comp('pension', 'growth', 'w')).read.join(' ')).toMatch(/add up to 100%/);
    // a three-year benchmark is tied to nothing else, and the record says so rather than implying
    // a check that was never made
    expect(get(figId.b('pension', PERIODS.indexOf('3 Y'))).read.join(' ')).toMatch(
      /Nothing else in the report ties this figure/,
    );
  });

  it('a figure the report does not print is missing, never zero', () => {
    const f = get(figId.compR('pension', 'growth', TEN_Y));
    expect(e.comps.find((c) => c.k === 'growth')!.r[TEN_Y]).toBeNull();
    expect(f.value).toBeNull();
    expect(f.cls).toBe('missing');
    expect(f.display).toBe('—');
    expect(f.notes.join(' ')).toMatch(/does not print/);
  });

  it('from the prior report, it cites the prior report', () => {
    const prior = priorVintage(CIO_LATEST)!;
    const f = get(figId.at(figId.r('pension', ONE_M), prior));
    expect(f.value).toBe(prior.ENT.pension.total.r[ONE_M]);
    expect(f.cls).toBe('reported_public');
    expect(f.report).toContain(prior.reportLabel);
    expect(f.sources[0]!.url).toContain(prior.url!);
  });
});

describe('a calculated figure', () => {
  const e = CIO_LATEST.ENT.pension;

  it('shows its formula with the figures put in, and lists each input', () => {
    const f = get(figId.x('pension', FYTD));
    expect(f.cls).toBe('calculated');
    expect(f.value).toBeCloseTo(e.total.r[FYTD]! - e.total.b[FYTD]!, 9);
    expect(f.formula).toBe('Net return − policy benchmark');
    expect(f.inputs.map((i) => i.id)).toEqual([figId.r('pension', FYTD), figId.b('pension', FYTD)]);
    expect(f.worked).toContain(f.inputs[0]!.display);
    expect(f.worked).toMatch(/= [+−]?\d+\.\d pp$/);
  });

  it('cites the sources of its inputs, once each', () => {
    const f = get(figId.x('pension', FYTD));
    expect(f.sources.map((s) => s.pageTable)).toEqual([`p. ${CIO_LATEST.pages.pension[1]}`]);
  });

  it('a change against the prior report takes one input from each report', () => {
    const prior = priorVintage(CIO_LATEST)!;
    const f = get(figId.dmv('opeb'));
    expect(f.value).toBe(CIO_LATEST.ENT.opeb.mv - prior.ENT.opeb.mv);
    expect(f.inputs.map((i) => i.id)).toEqual([
      figId.mv('opeb'),
      `${figId.mv('opeb')}@${prior.dataThrough}`,
    ]);
    expect(f.sources).toHaveLength(2);
    expect(f.notes.join(' ')).toMatch(/not a return/);
    expect(f.when).toEqual({
      kind: 'between',
      from: prior.dataThrough,
      to: CIO_LATEST.dataThrough,
    });
  });

  it('FYTD across a new fiscal year is not calculated, and says why', () => {
    const july = CIO_VINTAGES.find((v) => v.dataThrough.slice(5, 7) === '07')!;
    const f = get(figId.dr('pension', FYTD), { vintage: july, base: 'reported_public' });
    expect(f.value).toBeNull();
    expect(f.cls).toBe('missing');
    expect(f.display).toBe('not calculated');
    expect(f.notes[0]).toMatch(/fiscal year restarted on July 1/);
  });

  it('within one fiscal year, FYTD change is later minus earlier', () => {
    const v = CIO_VINTAGES.find((x) => ['09', '10', '11'].includes(x.dataThrough.slice(5, 7)))!;
    const prior = priorVintage(v)!;
    const f = get(figId.dr('pension', FYTD), { vintage: v, base: 'reported_public' });
    expect(f.value).toBeCloseTo(v.ENT.pension.total.r[FYTD]! - prior.ENT.pension.total.r[FYTD]!, 9);
    expect(f.notes.join(' ')).toMatch(/includes the earlier months/);
  });

  it('a trailing change says how much the two windows share', () => {
    const f = get(figId.dr('pension', PERIODS.indexOf('3 Y')));
    expect(f.notes[0]).toMatch(/share \d+ of 36 months/);
  });

  it('with an input missing, it is missing too', () => {
    const f = get(figId.contrib('pension', 'growth', TEN_Y));
    expect(f.value).toBeNull();
    expect(f.cls).toBe('missing');
    expect(f.worked).toBe('');
  });
});

describe('the proxy attribution', () => {
  it('is classified as a proxy estimate at every level', () => {
    expect(get(figId.contrib('pension', 'growth', FYTD)).cls).toBe('proxy_estimate');
    expect(get(figId.explained('pension', FYTD)).cls).toBe('proxy_estimate');
    expect(get(figId.residual('pension', FYTD)).cls).toBe('proxy_estimate');
  });

  it('explained + residual = the total-fund excess', () => {
    for (const v of CIO_VINTAGES) {
      for (const fund of ['pension', 'opeb'] as const) {
        const pa = proxyAttribution(v.ENT[fund], FYTD);
        if (pa.explained === null || pa.total === null) continue;
        expect(pa.explained + pa.residual!, `${v.dataThrough} ${fund}`).toBeCloseTo(pa.total, 9);
      }
    }
  });

  it('with any composite unprinted, explains nothing rather than a partial sum shown as whole', () => {
    // the report prints no ten-year composite figures: the old table showed "+0.00 pp explained"
    const pa = proxyAttribution(CIO_LATEST.ENT.pension, TEN_Y);
    expect(pa.total).not.toBeNull();
    expect(pa.explained).toBeNull();
    expect(pa.residual).toBeNull();
    expect(get(figId.explained('pension', TEN_Y)).cls).toBe('missing');
  });

  it('writes the sum with each sign once', () => {
    const f = get(figId.explained('pension', FYTD));
    expect(f.worked).not.toMatch(/\+ \+|\+ −|− \+/);
    expect(f.inputs).toHaveLength(CIO_LATEST.ENT.pension.comps.length);
  });
});

describe('the policy', () => {
  it('the IPS range cites the IPS of the fund on screen', () => {
    const p = get(figId.ipsTarget('pension', 'growth'));
    const o = get(figId.ipsTarget('opeb', 'growth'));
    expect(p.sources).toEqual([SOURCES.IPS_T1]);
    expect(o.sources).toEqual([SOURCES.IPS_OPEB_T1]);
    expect(p.when.kind).toBe('policy');
  });

  it('distance to bound is the nearer of the two', () => {
    const c = CIO_LATEST.ENT.pension.comps.find((x) => x.k === 'growth')!;
    const ips = ipsRange('pension', c.n)!;
    const f = get(figId.comp('pension', 'growth', 'bound'));
    expect(f.value).toBeCloseTo(Math.min(c.pct - ips.lo, ips.hi - c.pct), 9);
    expect(f.notes.join(' ')).toMatch(/not a compliance finding/);
  });
});

describe('figures that are not a published report', () => {
  it('a template file is labelled as its page is, and never cites a report page', () => {
    const file = { ...CIO_LATEST, origin: 'file' as const, file: 'June.xlsx', url: null };
    const f = get(figId.r('pension', FYTD), { vintage: file, base: 'calculated' });
    expect(f.cls).toBe('calculated');
    expect(f.report).toMatch(/Template file June\.xlsx, not published/);
    expect(f.read.join(' ')).toMatch(/template file/);
    expect(f.sources[0]!.url).toBeUndefined();
  });
});

describe('addresses', () => {
  it('every address the tab can show resolves, for every report and both funds', () => {
    let n = 0;
    for (const v of CIO_VINTAGES) {
      const c: ProvenanceContext = { vintage: v, base: 'reported_public' };
      for (const fund of ['pension', 'opeb'] as const) {
        for (const id of figureIds(v, fund)) {
          const r = resolveFigure(id, c);
          expect(r.ok, `${v.dataThrough} ${id}`).toBe(true);
          if (!r.ok) continue;
          n++;
          // every record says what it is, when it was true and where it came from
          expect(r.fig.label.length).toBeGreaterThan(0);
          expect(r.fig.sources.length, id).toBeGreaterThan(0);
          expect(whenText(r.fig.when).length).toBeGreaterThan(0);
          if (r.fig.formula && r.fig.inputs.length === 0) {
            // only a figure computed when the report was read has a formula but no inputs
            expect(id).toMatch(/\.other\./);
          }
        }
      }
    }
    expect(n).toBeGreaterThan(1000);
  });

  it('a bad address fails with a reason, never a blank record', () => {
    for (const bad of [
      '',
      'nonsense',
      'pension',
      'pension.r.2Y',
      'pension.zzz.w',
      'pension.growth.w.extra',
      'pension.aum@1999-01-31',
      'pension.aum@2026-06-30@2025-06-30',
      'other.aum',
    ]) {
      const r = resolveFigure(bad, ctx);
      expect(r.ok, bad).toBe(false);
      if (!r.ok) expect(r.reason.length, bad).toBeGreaterThan(10);
    }
  });

  it('the earliest report has no change against a prior, so offers none', () => {
    const first = CIO_VINTAGES[0]!;
    const c: ProvenanceContext = { vintage: first, base: 'reported_public' };
    expect(figureIds(first, 'pension')).not.toContain(figId.dmv('pension'));
    expect(resolveFigure(figId.dmv('pension'), c).ok).toBe(false);
  });
});

describe('the change between two reports, as the Compare tab shows it', () => {
  const june25 = CIO_VINTAGES.find((v) => v.dataThrough === '2025-06-30')!;

  it('is the later figure minus the earlier, with both reports cited', () => {
    const f = get(`pension.chg.r-3Y.2025-06-30@${CIO_LATEST.dataThrough}`);
    const i = PERIODS.indexOf('3 Y');
    expect(f.value).toBeCloseTo(
      CIO_LATEST.ENT.pension.total.r[i]! - june25.ENT.pension.total.r[i]!,
      9,
    );
    expect(f.cls).toBe('calculated');
    expect(f.inputs.map((x) => x.id)).toEqual([
      'pension.r.3Y@2025-06-30',
      `pension.r.3Y@${CIO_LATEST.dataThrough}`,
    ]);
    expect(f.sources).toHaveLength(2);
    // the Compare tab's own note: the windows overlap
    expect(f.notes[0]).toBe('The two windows share 24 of 36 months.');
    expect(f.when).toEqual({ kind: 'between', from: '2025-06-30', to: CIO_LATEST.dataThrough });
  });

  it('says why a pair is not compared, in the Compare tab’s words', () => {
    const f = get(`pension.chg.r-FYTD.2025-06-30@${CIO_LATEST.dataThrough}`);
    expect(f.display).toBe('not calculated');
    expect(f.notes[0]).toBe('Different fiscal years (FY2025 and FY2026) — not compared.');
  });

  it('agrees with every row of the comparison, for both funds', () => {
    for (const fund of ['pension', 'opeb'] as const) {
      const c = compareReports(june25, CIO_LATEST, fund);
      for (const line of allLines(c)) {
        const base = compareFigId(fund, line.key);
        expect(base, line.key).not.toBeNull();
        const f = get(figId.chg(fund, line.key, june25, CIO_LATEST));
        if (line.change === null) expect(f.value, line.key).toBeNull();
        else expect(f.value, line.key).toBeCloseTo(line.change, 9);
      }
    }
  });

  it('needs the earlier report first, and a published one', () => {
    for (const bad of [
      `pension.chg.r-3Y.${CIO_LATEST.dataThrough}@2025-06-30`,
      'pension.chg.r-3Y.2019-01-31',
      'pension.chg.nothing.2025-06-30',
    ]) {
      expect(resolveFigure(bad, ctx).ok, bad).toBe(false);
    }
  });
});

describe('growth of a dollar and geography', () => {
  it('cite the pages they are printed on', () => {
    const [summary, , , geo] = CIO_LATEST.pages.pension;
    expect(get('pension.god').sources[0]!.pageTable).toBe(`p. ${summary}`);
    expect(get('pension.geo.dm').sources[0]!.pageTable).toBe(`p. ${geo}`);
    expect(get('pension.country.united-states').sources[0]!.pageTable).toBe(`p. ${geo}`);
    expect(get('pension.country.united-states').value).toBe(
      CIO_LATEST.ENT.pension.geo.top.find(([n]) => n === 'United States')![1],
    );
  });

  it('a country not in the top five has no address', () => {
    expect(resolveFigure('pension.country.atlantis', ctx).ok).toBe(false);
  });
});
