import { CIO_LATEST, CIO_VINTAGES, longDate } from '../fixtures/cioMonthly';
import { FEED_KEY, FILE_KEY } from './cioVintage';
import { resolveFigure } from './provenance';
import { CIO_TABS, DASHBOARD_VIEWS, MACRO_TABS } from './routes';

/** Saved views: named addresses kept in this browser.
 *
 *  A view is already its address — the page, fund, report, sub-tab and toggles are all in the
 *  URL — so saving one stores that address and a name, nothing else. No figure, no file and no
 *  dataset is ever stored, and nothing is sent anywhere.
 *
 *  Three rules keep a saved view from misleading anyone later:
 *
 *  1. It says which report it shows. A view of the latest CIO report either follows the latest
 *     report or is pinned to the one on screen, and its record says which; a view never switches
 *     reports without saying so.
 *  2. A view of a template file or an imported dataset cannot be saved. Neither is stored, so the
 *     address would reopen to a different report than the one saved.
 *  3. What comes back from storage is checked like any other input. An entry that is not a
 *     dashboard address — a script URL, another site, a malformed record — is dropped, not
 *     followed. */

export interface SavedView {
  id: string;
  name: string;
  /** the dashboard address, e.g. `/cio?tab=compare&vs=2025-06-30` (the part after `#`) */
  href: string;
  /** ISO timestamp */
  savedAt: string;
}

export const SAVED_VIEWS_KEY = 'lacera-portfolio-analytics:saved-views:v1';
export const MAX_SAVED_VIEWS = 24;
export const MAX_NAME_LENGTH = 120;
const MAX_HREF_LENGTH = 1000;

const VIEW_LABEL = new Map(DASHBOARD_VIEWS.map(([path, label, band]) => [path, { label, band }]));
/** views dated by the CIO report on screen */
const REPORT_VIEWS = new Set(['/cio', '/exceptions']);
/** views that cover both funds at once */
const BOTH_FUNDS = new Set(['/exceptions']);

function split(href: string): { path: string; params: URLSearchParams } {
  const [path = '', query = ''] = href.split('?');
  return { path, params: new URLSearchParams(query) };
}

/** A dashboard address this site can open: a known view, nothing else. */
export function isDashboardHref(href: unknown): href is string {
  if (typeof href !== 'string' || href.length === 0 || href.length > MAX_HREF_LENGTH) return false;
  if (!href.startsWith('/') || href.startsWith('//')) return false;
  if (/[\s\\]/.test(href)) return false;
  return VIEW_LABEL.has(split(href).path);
}

/** Why the view on screen cannot be saved, or null when it can. */
export function unsaveableReason(href: string): string | null {
  if (!isDashboardHref(href)) return 'Only dashboard views can be saved.';
  const v = split(href).params.get('v');
  if (v === FILE_KEY) {
    return 'A template file is read in this browser and never stored, so a view of it cannot be saved.';
  }
  if (v === FEED_KEY) {
    return 'An imported dataset is not stored, so a view of it cannot be saved.';
  }
  return null;
}

/** The view follows whatever report is latest when it is opened. */
export function followsLatest(href: string): boolean {
  const { path, params } = split(href);
  return REPORT_VIEWS.has(path) && !params.get('v');
}

/** The same address, fixed to the report that is latest now. */
export function pinReport(href: string, dataThrough = CIO_LATEST.dataThrough): string {
  if (!followsLatest(href)) return href;
  const { path, params } = split(href);
  params.set('v', dataThrough);
  return `${path}?${params.toString()}`;
}

function reportLabel(dataThrough: string | null): string | null {
  if (!dataThrough) return null;
  const v = CIO_VINTAGES.find((x) => x.dataThrough === dataThrough);
  return v ? `${v.reportLabel} report` : null;
}

/** A plain name for an address: "CIO Monthly › Compare · OPEB Trust · August 12, 2026 report
 *  against the August 13, 2025 report". Offered as the default when a view is saved. */
export function describeView(href: string): string {
  const { path, params } = split(href);
  const view = VIEW_LABEL.get(path);
  if (!view) return 'Unknown view';
  const parts: string[] = [];

  let title = path === '/exceptions' ? view.band : view.label;
  const tabs = path === '/cio' ? CIO_TABS : path === '/macro' ? MACRO_TABS : null;
  if (tabs) {
    const key = params.get('tab') ?? tabs[0]![0];
    const tab = tabs.find(([k]) => k === key) ?? tabs[0]!;
    title += ` › ${tab[1]}`;
  }
  parts.push(title);

  if (!BOTH_FUNDS.has(path)) parts.push(params.get('e') === 'OPEB' ? 'OPEB Trust' : 'Pension Plan');

  if (REPORT_VIEWS.has(path)) {
    const v = params.get('v');
    const onScreen = v ? (reportLabel(v) ?? `report through ${v}`) : 'latest report';
    const vs = reportLabel(params.get('vs'));
    parts.push(vs ? `${onScreen} against the ${vs}` : onScreen);
  }

  const fig = params.get('fig');
  if (fig) {
    const vintage = CIO_VINTAGES.find((x) => x.dataThrough === params.get('v')) ?? CIO_LATEST;
    const r = resolveFigure(fig, { vintage, base: 'reported_public' });
    if (r.ok) parts.push(r.fig.label);
  }
  return parts.join(' · ');
}

/** What a saved view will show when opened, in words, for its entry in the list. */
export function viewVintage(href: string): string | null {
  const { path, params } = split(href);
  if (!REPORT_VIEWS.has(path)) return null;
  const v = params.get('v');
  if (!v) return 'follows the latest report';
  const label = reportLabel(v);
  return label ? `fixed to the ${label}` : `a report no longer on this site (data through ${v})`;
}

/* ---- the list --------------------------------------------------------------------------- */

export type SaveResult =
  { ok: true; views: SavedView[]; replaced: boolean } | { ok: false; reason: string };

/** Add a view, or rename the one already saved at the same address. Newest first. */
export function saveView(
  views: SavedView[],
  entry: { id: string; name: string; href: string; savedAt: string },
): SaveResult {
  const why = unsaveableReason(entry.href);
  if (why) return { ok: false, reason: why };
  const name = entry.name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
  const view: SavedView = {
    id: entry.id,
    name: name || describeView(entry.href),
    href: entry.href,
    savedAt: entry.savedAt,
  };
  const existing = views.find((x) => x.href === entry.href);
  if (existing) {
    return {
      ok: true,
      replaced: true,
      views: [{ ...view, id: existing.id }, ...views.filter((x) => x !== existing)],
    };
  }
  if (views.length >= MAX_SAVED_VIEWS) {
    return {
      ok: false,
      reason: `This browser keeps up to ${MAX_SAVED_VIEWS} saved views. Delete one to save another.`,
    };
  }
  return { ok: true, replaced: false, views: [view, ...views] };
}

export function deleteView(views: SavedView[], id: string): SavedView[] {
  return views.filter((x) => x.id !== id);
}

/** Put a deleted view back where it was. */
export function restoreView(views: SavedView[], view: SavedView, index: number): SavedView[] {
  if (views.some((x) => x.id === view.id || x.href === view.href)) return views;
  const out = [...views];
  out.splice(Math.min(Math.max(index, 0), out.length), 0, view);
  return out.slice(0, MAX_SAVED_VIEWS);
}

/* ---- storage: checked on the way in, like any other input ------------------------------- */

export interface ParsedViews {
  views: SavedView[];
  /** entries that were present but not a valid dashboard view, and were dropped */
  dropped: number;
  /** the stored value could not be read at all */
  unreadable: boolean;
}

const isIso = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(s) && !Number.isNaN(Date.parse(s));

export function parseSavedViews(raw: string | null): ParsedViews {
  if (raw === null || raw === '') return { views: [], dropped: 0, unreadable: false };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { views: [], dropped: 0, unreadable: true };
  }
  const list =
    data !== null && typeof data === 'object' && (data as { v?: unknown }).v === 1
      ? (data as { views?: unknown }).views
      : undefined;
  if (!Array.isArray(list)) return { views: [], dropped: 0, unreadable: true };
  const views: SavedView[] = [];
  let dropped = 0;
  for (const item of list) {
    const x = item as Partial<SavedView> | null;
    const ok =
      x !== null &&
      typeof x === 'object' &&
      typeof x.id === 'string' &&
      x.id.length > 0 &&
      x.id.length <= 64 &&
      typeof x.name === 'string' &&
      x.name.trim().length > 0 &&
      x.name.length <= MAX_NAME_LENGTH &&
      isDashboardHref(x.href) &&
      unsaveableReason(x.href) === null &&
      isIso(x.savedAt) &&
      !views.some((y) => y.id === x.id || y.href === x.href);
    if (ok && views.length < MAX_SAVED_VIEWS) {
      views.push({ id: x.id!, name: x.name!, href: x.href!, savedAt: x.savedAt! });
    } else {
      dropped++;
    }
  }
  return { views, dropped, unreadable: false };
}

export function serializeSavedViews(views: SavedView[]): string {
  return JSON.stringify({ v: 1, views });
}

/** "September 22, 2026" from an ISO timestamp, in the reader's own time zone. */
export function savedOn(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return longDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
}
