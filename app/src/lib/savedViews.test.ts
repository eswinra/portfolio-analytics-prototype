import { describe, expect, it } from 'vitest';

import { CIO_LATEST, CIO_VINTAGES } from '../fixtures/cioMonthly';

import { FEED_KEY, FILE_KEY } from './cioVintage';
import { CIO_TABS, DASHBOARD_VIEWS, MACRO_TABS } from './routes';
import {
  deleteView,
  describeView,
  followsLatest,
  isDashboardHref,
  MAX_NAME_LENGTH,
  MAX_SAVED_VIEWS,
  parseSavedViews,
  pinReport,
  restoreView,
  saveView,
  serializeSavedViews,
  unsaveableReason,
  viewVintage,
  type SavedView,
} from './savedViews';

const AT = '2026-09-22T09:00:00.000Z';
const view = (i: number, href = `/cio?tab=summary&v=${CIO_VINTAGES[i % 16]!.dataThrough}`) => ({
  id: `id-${i}`,
  name: `View ${i}`,
  href,
  savedAt: AT,
});

describe('which addresses can be saved', () => {
  it('every dashboard view, with or without settings', () => {
    for (const [path] of DASHBOARD_VIEWS) {
      expect(isDashboardHref(path), path).toBe(true);
      expect(isDashboardHref(`${path}?e=OPEB`), path).toBe(true);
    }
  });

  it('nothing that is not a dashboard view', () => {
    for (const bad of [
      '',
      'cio',
      '//evil.example/cio',
      'https://evil.example/',
      'javascript:alert(1)',
      '/import',
      '/data-quality',
      '/nowhere',
      '/cio?tab=summary\\x',
      `/cio?${'x'.repeat(2000)}`,
      42,
      null,
    ]) {
      expect(isDashboardHref(bad), String(bad)).toBe(false);
    }
  });

  it('not a view of a template file or an imported dataset, and says why', () => {
    expect(unsaveableReason(`/cio?v=${FILE_KEY}`)).toMatch(/never stored/);
    expect(unsaveableReason(`/exceptions?v=${FEED_KEY}`)).toMatch(/not stored/);
    expect(unsaveableReason('/cio?tab=compare')).toBeNull();
  });
});

describe('a saved view says which report it shows', () => {
  it('a view of the latest report follows the latest, unless pinned', () => {
    expect(followsLatest('/cio?tab=summary')).toBe(true);
    expect(viewVintage('/cio?tab=summary')).toBe('follows the latest report');
    const pinned = pinReport('/cio?tab=summary');
    expect(followsLatest(pinned)).toBe(false);
    expect(new URLSearchParams(pinned.split('?')[1]).get('v')).toBe(CIO_LATEST.dataThrough);
    expect(viewVintage(pinned)).toBe(`fixed to the ${CIO_LATEST.reportLabel} report`);
  });

  it('pinning an address with no settings still produces a valid address', () => {
    expect(pinReport('/exceptions')).toBe(`/exceptions?v=${CIO_LATEST.dataThrough}`);
  });

  it('views without a report are not about a report', () => {
    expect(followsLatest('/performance')).toBe(false);
    expect(viewVintage('/performance')).toBeNull();
    expect(pinReport('/allocation?e=OPEB')).toBe('/allocation?e=OPEB');
  });

  it('a report that is no longer on the site is named as such, not as another report', () => {
    expect(viewVintage('/cio?v=2019-01-31')).toBe(
      'a report no longer on this site (data through 2019-01-31)',
    );
  });
});

describe('the name a view is offered', () => {
  it('names the view, sub-tab, fund and report', () => {
    const vs = CIO_VINTAGES.find((v) => v.dataThrough === '2025-06-30')!;
    expect(describeView(`/cio?tab=compare&e=OPEB&vs=${vs.dataThrough}`)).toBe(
      `CIO Monthly › Compare · OPEB Trust · latest report against the ${vs.reportLabel} report`,
    );
    expect(describeView('/performance')).toBe('Performance · Pension Plan');
  });

  it('the CIO and Economy sub-tabs come from the same list the tab bars use', () => {
    for (const [key, label] of CIO_TABS) {
      expect(describeView(`/cio?tab=${key}`)).toContain(`CIO Monthly › ${label}`);
    }
    for (const [key, label] of MACRO_TABS) {
      expect(describeView(`/macro?tab=${key}`)).toContain(`Economy › ${label}`);
    }
    // no tab in the address is each view's first tab, as the page itself shows
    expect(describeView('/cio')).toContain('CIO Monthly › Slides');
  });

  it('the Exception Center covers both funds, so it names no fund', () => {
    const name = describeView('/exceptions?e=OPEB');
    expect(name).toBe('Exception Center · latest report');
  });

  it('a figure whose record is open is named', () => {
    expect(describeView('/cio?tab=summary&fig=pension.r.FYTD')).toContain(
      'Net return, fiscal year to date',
    );
  });
});

describe('the list', () => {
  it('saves newest first, and names an unnamed view by its address', () => {
    const one = saveView([], { ...view(1), name: '  ' });
    expect(one.ok).toBe(true);
    if (!one.ok) return;
    expect(one.views[0]!.name).toBe(describeView(view(1).href));
    const two = saveView(one.views, view(2));
    expect(two.ok && two.views.map((v) => v.id)).toEqual(['id-2', 'id-1']);
  });

  it('saving an address already saved renames it, keeps its id and moves it to the top', () => {
    let views: SavedView[] = [];
    for (const i of [1, 2, 3]) {
      const r = saveView(views, view(i));
      if (r.ok) views = r.views;
    }
    const again = saveView(views, { ...view(1), id: 'new-id', name: 'Renamed' });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.replaced).toBe(true);
    expect(again.views).toHaveLength(3);
    expect(again.views[0]).toMatchObject({ id: 'id-1', name: 'Renamed' });
  });

  it('trims and caps a name', () => {
    const r = saveView([], { ...view(1), name: `  a   b ${'c'.repeat(300)}` });
    expect(r.ok && r.views[0]!.name.startsWith('a b c')).toBe(true);
    expect(r.ok && r.views[0]!.name.length).toBe(MAX_NAME_LENGTH);
  });

  it('refuses past the limit, and refuses what cannot be saved, with the reason', () => {
    let views: SavedView[] = [];
    for (let i = 0; i < MAX_SAVED_VIEWS; i++) {
      const r = saveView(views, view(i, `/cio?tab=summary&p=panel-${i}`));
      if (r.ok) views = r.views;
    }
    expect(views).toHaveLength(MAX_SAVED_VIEWS);
    const full = saveView(views, view(99, '/performance'));
    expect(full.ok).toBe(false);
    if (!full.ok) expect(full.reason).toMatch(/up to 24 saved views/);
    const file = saveView([], view(1, `/cio?v=${FILE_KEY}`));
    expect(file.ok).toBe(false);
  });

  it('a deleted view can be put back where it was', () => {
    const views = [view(1), view(2), view(3)];
    const gone = deleteView(views, 'id-2');
    expect(gone.map((v) => v.id)).toEqual(['id-1', 'id-3']);
    expect(restoreView(gone, views[1]!, 1).map((v) => v.id)).toEqual(['id-1', 'id-2', 'id-3']);
    // not twice
    expect(restoreView(views, views[1]!, 1)).toBe(views);
  });
});

describe('what comes back from storage is checked', () => {
  it('round-trips', () => {
    const views = [view(1), view(2, '/exceptions?v=2025-12-31')];
    expect(parseSavedViews(serializeSavedViews(views))).toEqual({
      views,
      dropped: 0,
      unreadable: false,
    });
  });

  it('nothing stored is an empty list, not an error', () => {
    expect(parseSavedViews(null)).toEqual({ views: [], dropped: 0, unreadable: false });
  });

  it('a value that is not ours is unreadable, and nothing is followed', () => {
    for (const raw of ['{', '[]', '"x"', '{"v":2,"views":[]}', '{"v":1}', 'null']) {
      const r = parseSavedViews(raw);
      expect(r.views, raw).toEqual([]);
      expect(r.unreadable, raw).toBe(true);
    }
  });

  it('drops each entry that is not a dashboard view, and counts them', () => {
    const raw = JSON.stringify({
      v: 1,
      views: [
        view(1),
        { ...view(2), href: 'javascript:alert(1)' },
        { ...view(3), href: '//evil.example/' },
        { ...view(4), href: `/cio?v=${FILE_KEY}` },
        { ...view(5), name: '' },
        { ...view(6), savedAt: 'yesterday' },
        { ...view(7), id: 'id-1' },
        null,
        'x',
      ],
    });
    const r = parseSavedViews(raw);
    expect(r.views.map((v) => v.id)).toEqual(['id-1']);
    expect(r.dropped).toBe(8);
    expect(r.unreadable).toBe(false);
  });
});
