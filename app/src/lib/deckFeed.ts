import { NET_POSITION } from '../fixtures/cioMonthly.data';
import { deckGdp } from './cioGdp';

import {
  BINS,
  CIO_LATEST,
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
    NETPOS: latest ? NET_POSITION : null,
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
