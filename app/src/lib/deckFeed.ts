import { FORECAST_VOL, NET_POSITION } from '../fixtures/cioMonthly.data';
import { deckGdp } from './cioGdp';

import {
  BINS,
  CIO_LATEST,
  CIO_VINTAGES,
  deckVintage,
  priorVintage,
  macroFor,
  OPS,
  PERIODS,
  monthYear,
  STATUS,
  type CioDeckData,
  type CioVintage,
  type DeckPrior,
  type DeckVintage,
} from '../fixtures/cioMonthly';
import type { CioPackage } from './cioPackage';

/** The dashboard feeds the CIO Monthly slides. When the deck is presented inside the dashboard
 *  it takes this object for the report on screen — any extracted vintage, or an imported
 *  workstation feed — instead of its built-in block, so the slides and the tabs cannot disagree.
 *
 *  The macro strip's FRED figures exist for every public report, read as FRED showed them on
 *  that report's date. Editorial pages (the report's commentary, items for attention) exist for
 *  the latest public report only; for any other report they are left out and the deck says so
 *  rather than showing another month's text. A workstation feed carries one fund and no macro
 *  strip, so the deck locks to it (`single`). */

/** Deck strings are written into the slides as HTML. Anything that arrives through an imported
 *  file is stripped of the characters that could open a tag or close an attribute. */
export function sanitizeDeckData<T>(x: T): T {
  if (typeof x === 'string') return x.replace(/[<>"]/g, '') as T;
  if (Array.isArray(x)) return x.map((v) => sanitizeDeckData(v)) as T;
  if (x && typeof x === 'object') {
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, sanitizeDeckData(v)])) as T;
  }
  return x;
}

export function deckDataFor(
  v: CioVintage,
  opts: {
    feed?: boolean;
    /** the feed's dataset ID and row classifications, shown on every slide */
    feedName?: string;
    feedCls?: readonly string[];
    pkg?: CioPackage | null;
  } = {},
): CioDeckData {
  const latest = !opts.feed && v === CIO_LATEST;
  // a template file carries its own macro strip and items for attention, typed by the team
  const pkg = opts.pkg ?? null;
  return sanitizeDeckData({
    // the month before, for slide 2's value bridge — published reports only: a template file or
    // an imported feed is not part of the series, and its month must not be bridged to one
    // the net position page is transcribed for the latest report only, like the editorial pages
    // the GDP chart is the report's own page, so an imported feed or a template file has none
    GDP: opts.feed || pkg ? null : deckGdp(v.reportDate),
    // the trend under each figure on Fund at a glance; an imported feed is not part of the series
    HISTORY: opts.feed || pkg ? [] : deckHistory(v),
    NETPOS: latest ? NET_POSITION : null,
    // the forecast volatility pages are transcribed for the latest report only, like p. 21
    FVOL: latest ? FORECAST_VOL : null,
    PRIOR: opts.feed || pkg ? null : deckPrior(v),
    PERIODS,
    ENT: v.ENT,
    BINS,
    MKT: v.MKT ?? [],
    MACRO: pkg ? pkg.macro : opts.feed ? [] : macroFor(v),
    OPS: pkg ? pkg.ops : latest ? OPS : [],
    STATUS,
    VINTAGE: opts.feed
      ? feedVintage(v, opts.feedName ?? 'unnamed', opts.feedCls ?? [])
      : deckVintage(v),
  });
}

/** The previous published report's market values, or null when there is no earlier report. */
export function deckPrior(v: CioVintage): DeckPrior | null {
  const p = priorVintage(v);
  if (!p || p.origin === 'file') return null;
  const mvOf = (e: CioVintage['ENT']['pension']) => ({
    mv: e.mv,
    comps: Object.fromEntries(e.comps.map((c) => [c.k, c.mv])),
    other: e.other ? e.other.mv : null,
  });
  return {
    reportLabel: p.reportLabel,
    monthYear: monthYear(p.dataThrough),
    ENT: { pension: mvOf(p.ENT.pension), opeb: mvOf(p.ENT.opeb) },
  };
}

/** One point per month the published reports cover, up to and including the report on screen.
 *
 *  The deck draws the trend under each figure on Fund at a glance, as the report's page 8 does.
 *  A month no report covers is `null` on both funds, and the line breaks there: November 2025 has
 *  no report in the published set, and a segment drawn across it would invent a month that was
 *  never published. Truncated at the report on screen, because an older report cannot show months
 *  it could not have known. */
export interface DeckHistoryPoint {
  /** 'YYYY-MM' of the month the figures cover */
  m: string;
  /** 'Jun 26', for the axis ends */
  label: string;
  pension: DeckHistoryFigures | null;
  opeb: DeckHistoryFigures | null;
}

export interface DeckHistoryFigures {
  /** total market value, $ billions */
  aum: number;
  /** the month's net return, percent */
  r1: number | null;
  /** growth of a dollar over trailing five years */
  god: number | null;
  /** cash equivalents, $ millions */
  cash: number | null;
}

function figuresOf(e: CioVintage['ENT']['pension']): DeckHistoryFigures {
  return { aum: e.aum, r1: e.total.r[0] ?? null, god: e.god ?? null, cash: e.cash ?? null };
}

export function deckHistory(v: CioVintage): DeckHistoryPoint[] {
  const published = CIO_VINTAGES.filter((x) => x.origin !== 'file');
  const byMonth = new Map(published.map((x) => [x.dataThrough.slice(0, 7), x]));
  const first = published[0];
  if (!first || !byMonth.has(v.dataThrough.slice(0, 7))) return [];
  const out: DeckHistoryPoint[] = [];
  let [y, m] = [Number(first.dataThrough.slice(0, 4)), Number(first.dataThrough.slice(5, 7))];
  const last = v.dataThrough.slice(0, 7);
  for (let guard = 0; guard < 600; guard++) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const hit = byMonth.get(key) ?? null;
    out.push({
      m: key,
      label: monthYear(`${key}-01`).replace(/^(\w{3})\w* (\d\d)(\d\d)$/, '$1 $3'),
      pension: hit ? figuresOf(hit.ENT.pension) : null,
      opeb: hit ? figuresOf(hit.ENT.opeb) : null,
    });
    if (key === last) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** A workstation feed's labels: one fund, no macro strip, and its own name and classification
 *  on every slide — an import is never presented as the published report. */
function feedVintage(v: CioVintage, name: string, cls: readonly string[]): DeckVintage {
  // named by its dataset ID: the source its rows cite may be a public report it only re-expresses
  const out: DeckVintage = {
    ...deckVintage(v),
    single: true,
    local: { kind: 'workstation dataset', name, cls: cls.join(' · ') || 'unclassified' },
  };
  delete out.macroLabel;
  return out;
}

/** Name of the parent-window property the embedded deck reads its data from. */
export const DECK_FEED_KEY = '__laceraDeckFeed';
