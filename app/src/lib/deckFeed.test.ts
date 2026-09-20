import { describe, expect, it } from 'vitest';

import { CIO_LATEST, CIO_VINTAGES, vintageFromFeed } from '../fixtures/cioMonthly';
import { DECK_DATA, deckDataBlock } from '../fixtures/deckData';
import { deckDataFor, deckHistory, sanitizeDeckData } from './deckFeed';

describe('dashboard → slides feed', () => {
  it('gives the embedded deck exactly the standalone deck data for the latest report', () => {
    expect(deckDataFor(CIO_LATEST)).toEqual(DECK_DATA);
  });

  it('keeps the standalone data block assignable, so an embedded deck can take the feed', () => {
    for (const line of deckDataBlock().split('\n')) expect(line.trim()).toMatch(/^let [A-Z]+ = /);
  });

  it('carries each vintage its own figures and no other month’s editorial pages', () => {
    const older = CIO_VINTAGES[0]!;
    expect(older).not.toBe(CIO_LATEST);
    const d = deckDataFor(older);
    expect(d.ENT).toEqual(older.ENT);
    // the macro strip: FRED's four lines as known on that report's date, without the latest
    // report's commentary or typed lines
    expect(d.MACRO.map((m) => m.l)).toEqual([
      'PCE inflation, February 2025',
      'Federal funds target range',
      'Unemployment and participation, February 2025',
      'Treasury yields, Feb 28, 2025',
    ]);
    for (const m of d.MACRO) expect(m.s).not.toMatch(/\(p\. \d+/);
    expect(d.VINTAGE.macroLabel).toBe('March 31, 2025');
    expect(d.OPS).toEqual([]);
    expect(d.MKT).toEqual(older.MKT ?? []);
    expect(d.VINTAGE.reportLabel).toBe(older.reportLabel);
  });

  it('locks a workstation feed to its one fund and strips markup from imported text', () => {
    const entity = structuredClone(CIO_LATEST.ENT.pension);
    entity.short = 'DEMO<img src=x onerror=alert(1)>"fund"';
    const v = vintageFromFeed({
      entityId: 'DEMOFUND',
      asOf: '2026-06-30',
      entity,
      sourceName: 'demo.csv',
      pageTable: 'rows',
    });
    const d = deckDataFor(v, { feed: true, feedName: 'DEMOFUND', feedCls: ['synthetic'] });
    expect(d.VINTAGE.single).toBe(true);
    // an import carries its own name and classification onto the slides (audit 2026-09-18)
    expect(d.VINTAGE.local).toEqual({
      kind: 'workstation dataset',
      name: 'DEMOFUND',
      cls: 'synthetic',
    });
    expect(d.MACRO).toEqual([]);
    expect(d.VINTAGE.macroLabel).toBeUndefined();
    expect(d.ENT.pension.short).toBe('DEMOimg src=x onerror=alert(1)fund');
    expect(JSON.stringify(d)).not.toMatch(/[<>]/);
  });

  it('sanitizes deeply and leaves numbers and nulls alone', () => {
    expect(sanitizeDeckData({ a: ['<b>', 1, null], b: { c: '"x"' } })).toEqual({
      a: ['b', 1, null],
      b: { c: 'x' },
    });
  });
});

describe('the history behind Fund at a glance', () => {
  const published = CIO_VINTAGES.filter((v) => v.origin !== 'file');

  it('runs one point per month, from the first report to the one on screen', () => {
    const h = deckHistory(CIO_LATEST);
    expect(h[0]!.m).toBe(published[0]!.dataThrough.slice(0, 7));
    expect(h.at(-1)!.m).toBe(CIO_LATEST.dataThrough.slice(0, 7));
    // contiguous months, no jumps
    for (let i = 1; i < h.length; i++) {
      const [y, m] = h[i - 1]!.m.split('-').map(Number) as [number, number];
      const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
      expect(h[i]!.m, `after ${h[i - 1]!.m}`).toBe(next);
    }
  });

  it('a month no report covers is null on both funds, not zero and not carried forward', () => {
    const h = deckHistory(CIO_LATEST);
    const months = new Set(published.map((v) => v.dataThrough.slice(0, 7)));
    for (const p of h) {
      if (months.has(p.m)) {
        expect(p.pension, p.m).not.toBeNull();
        expect(p.opeb, p.m).not.toBeNull();
      } else {
        expect(p.pension, p.m).toBeNull();
        expect(p.opeb, p.m).toBeNull();
      }
    }
    // the published set has exactly one such month, and the slide says so in words
    expect(h.filter((p) => !p.pension).map((p) => p.m)).toEqual(['2025-11']);
  });

  it('every point carries the figures that report printed', () => {
    const h = deckHistory(CIO_LATEST);
    for (const v of published) {
      const p = h.find((x) => x.m === v.dataThrough.slice(0, 7));
      expect(p, v.dataThrough).toBeDefined();
      expect(p!.pension!.aum).toBe(v.ENT.pension.aum);
      expect(p!.pension!.r1).toBe(v.ENT.pension.total.r[0] ?? null);
      expect(p!.pension!.cash).toBe(v.ENT.pension.cash ?? null);
      expect(p!.opeb!.aum).toBe(v.ENT.opeb.aum);
    }
  });

  it('an older report shows no month it could not have known', () => {
    const older = published[published.length - 4]!;
    const h = deckHistory(older);
    expect(h.at(-1)!.m).toBe(older.dataThrough.slice(0, 7));
    expect(h.length).toBeLessThan(deckHistory(CIO_LATEST).length);
    for (const p of h) expect(p.m <= older.dataThrough.slice(0, 7)).toBe(true);
  });

  it('an imported feed is not part of the series', () => {
    const d = deckDataFor(CIO_LATEST, { feed: true, feedName: 'X', feedCls: [] });
    expect(d.HISTORY).toEqual([]);
  });
});
