import { describe, expect, it } from 'vitest';

import { CIO_LATEST, CIO_VINTAGES, vintageFromFeed } from '../fixtures/cioMonthly';
import { DECK_DATA, deckDataBlock } from '../fixtures/deckData';
import { deckDataFor, sanitizeDeckData } from './deckFeed';

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
    // the macro strip: FRED's three lines as known on that report's date, without the latest
    // report's commentary or typed lines
    expect(d.MACRO.map((m) => m.l)).toEqual([
      'PCE inflation, February 2025',
      'Federal funds target range',
      'Unemployment and participation, February 2025',
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
