import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CIO_VINTAGES } from '../fixtures/cioMonthly';
import { WORLD_MARKS, WORLD_NAMED, WORLD_SHAPES, WORLD_VIEWBOX } from '../fixtures/worldMap.data';

import {
  BADGE_R,
  BREAK_LABELS,
  codeForCountry,
  mapAltText,
  mapModel,
  shareBand,
  SHARE_BREAKS,
  spreadBadges,
} from './geoMap';

const [, , VW, VH] = WORLD_VIEWBOX.split(' ').map(Number) as [number, number, number, number];

/** Every country any of the sixteen reports names, for both funds. */
const namedInReports = [
  ...new Set(
    CIO_VINTAGES.flatMap((v) =>
      Object.values(v.ENT).flatMap((e) => (e?.geo?.top ?? []).map((t) => t[0])),
    ),
  ),
].sort();

describe('geographic exposure map: the outlines the reports need', () => {
  it('every country any report names has an outline and a mark', () => {
    expect(namedInReports.length).toBeGreaterThan(8);
    for (const name of namedInReports) {
      const code = codeForCountry(name);
      expect(code, `${name} has no country code`).not.toBeNull();
      expect(
        WORLD_SHAPES.some((s) => s.c === code),
        `${name} (${code}) has no outline in the fixture`,
      ).toBe(true);
      expect(WORLD_MARKS[code!], `${name} (${code}) has no badge position`).toBeDefined();
    }
  });

  it('the named list and the marks agree with each other', () => {
    expect(Object.keys(WORLD_MARKS).sort()).toEqual(Object.keys(WORLD_NAMED).sort());
    // every name the fixture claims to carry is one a report actually prints
    for (const name of Object.values(WORLD_NAMED)) expect(namedInReports).toContain(name);
  });

  it('a name the map has no outline for is reported, not dropped', () => {
    expect(codeForCountry('Ruritania')).toBeNull();
    const model = mapModel([
      ['United States', 50, 'dm'],
      ['Ruritania', 1, 'em'],
    ]);
    expect(model.unplaced).toEqual(['Ruritania']);
    expect(model.badges).toHaveLength(1);
  });
});

describe('geographic exposure map: the generated outlines are well formed', () => {
  it('every path is closed subpaths of finite points inside the frame', () => {
    expect(WORLD_SHAPES.length).toBeGreaterThan(150);
    for (const s of WORLD_SHAPES) {
      expect(s.d, `${s.c} path shape`).toMatch(/^(M-?[\d. -]+Z)+$/);
      for (const sub of s.d.split('M').slice(1)) {
        const nums = sub.replace(/Z$/, '').trim().split(/\s+/).map(Number);
        expect(nums.length % 2, `${s.c} has an odd coordinate count`).toBe(0);
        expect(nums.length / 2, `${s.c} subpath is not a polygon`).toBeGreaterThanOrEqual(3);
        for (let i = 0; i < nums.length; i += 2) {
          expect(Number.isFinite(nums[i]!) && Number.isFinite(nums[i + 1]!)).toBe(true);
          expect(nums[i]!).toBeGreaterThanOrEqual(-1);
          expect(nums[i]!).toBeLessThanOrEqual(VW + 1);
          expect(nums[i + 1]!).toBeGreaterThanOrEqual(-1);
          expect(nums[i + 1]!).toBeLessThanOrEqual(VH + 1);
        }
      }
    }
  });

  it('no country code is drawn twice', () => {
    const codes = WORLD_SHAPES.map((s) => s.c);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('geographic exposure map: classes and badges', () => {
  it('a share falls in the class its legend entry names', () => {
    expect(SHARE_BREAKS).toEqual([1, 2, 10]);
    expect(BREAK_LABELS).toHaveLength(SHARE_BREAKS.length + 1);
    expect(shareBand(0.4)).toBe(0);
    expect(shareBand(0.99)).toBe(0);
    expect(shareBand(1)).toBe(1);
    expect(shareBand(1.9)).toBe(1);
    expect(shareBand(2)).toBe(2);
    expect(shareBand(9.99)).toBe(2);
    expect(shareBand(10)).toBe(3);
    expect(shareBand(75.7)).toBe(3);
  });

  it('badges are pushed apart and stay in the frame', () => {
    const model = mapModel(CIO_VINTAGES.at(-1)!.ENT.pension!.geo.top);
    expect(model.badges.length).toBe(10);
    for (const b of model.badges) {
      expect(b.x).toBeGreaterThanOrEqual(BADGE_R - 0.1);
      expect(b.x).toBeLessThanOrEqual(VW - BADGE_R + 0.1);
      expect(b.y).toBeGreaterThanOrEqual(BADGE_R - 0.1);
      expect(b.y).toBeLessThanOrEqual(VH - BADGE_R + 0.1);
    }
    for (let i = 0; i < model.badges.length; i++) {
      for (let j = i + 1; j < model.badges.length; j++) {
        const a = model.badges[i]!;
        const b = model.badges[j]!;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        expect(d, `${a.name} and ${b.name} overlap`).toBeGreaterThan(BADGE_R * 1.8);
      }
    }
  });

  it('badges carry the report’s own rank, so the map and the table agree', () => {
    const top = CIO_VINTAGES.at(-1)!.ENT.pension!.geo.top;
    const model = mapModel(top);
    for (const b of model.badges) {
      expect(top[b.rank - 1]![0]).toBe(b.name);
      expect(top[b.rank - 1]![1]).toBe(b.share);
    }
  });

  it('two badges that start at the same point are still separated', () => {
    const out = spreadBadges([
      { x: 100, y: 100 },
      { x: 100, y: 100 },
    ]);
    expect(Math.hypot(out[0]!.x - out[1]!.x, out[0]!.y - out[1]!.y)).toBeGreaterThan(BADGE_R * 1.8);
  });

  it('a country the report does not name has no class, which is missing and not zero', () => {
    const model = mapModel(CIO_VINTAGES.at(-1)!.ENT.pension!.geo.top);
    const shaded = model.shapes.filter((s) => s.band != null);
    expect(shaded).toHaveLength(10);
    expect(model.shapes.filter((s) => s.band == null).length).toBe(WORLD_SHAPES.length - 10);
  });

  it('the alternative text carries every named country and counts the rest', () => {
    const e = CIO_VINTAGES.at(-1)!.ENT.pension!;
    const alt = mapAltText(mapModel(e.geo.top), e.short);
    for (const [name, share] of e.geo.top) expect(alt).toContain(`${name} ${share.toFixed(1)}%`);
    expect(alt).toContain(`other ${WORLD_SHAPES.length - 10} countries`);
    expect(alt).toMatch(/missing rather than zero/);
  });
});

describe('the deck’s own copy of the map rules matches this one', () => {
  // the deck at public/deck/index.html cannot import anything, so it repeats these two rules.
  // A reader comparing the slide with the dashboard must not find different class breaks.
  const html = readFileSync(new URL('../../public/deck/index.html', import.meta.url), 'utf8');

  it('the class breaks are the same', () => {
    expect(html).toContain(`const BREAKS = [${SHARE_BREAKS.join(', ')}];`);
  });

  it('the legend labels are the same', () => {
    const want = BREAK_LABELS.map((l) => `'${l}'`).join(', ');
    expect(html).toContain(`const BREAK_LABELS = [${want}];`);
  });

  it('the badge radius is the same', () => {
    expect(html).toContain(`const R = ${BADGE_R};`);
  });
});
