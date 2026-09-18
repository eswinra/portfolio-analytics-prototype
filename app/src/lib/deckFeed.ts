import {
  BINS,
  CIO_LATEST,
  deckVintage,
  macroFor,
  OPS,
  PERIODS,
  STATUS,
  type CioDeckData,
  type CioVintage,
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
  opts: { feed?: boolean; pkg?: CioPackage | null } = {},
): CioDeckData {
  const latest = !opts.feed && v === CIO_LATEST;
  // a template file carries its own macro strip and items for attention, typed by the team
  const pkg = opts.pkg ?? null;
  return sanitizeDeckData({
    PERIODS,
    ENT: v.ENT,
    BINS,
    MKT: v.MKT ?? [],
    MACRO: pkg ? pkg.macro : opts.feed ? [] : macroFor(v),
    OPS: pkg ? pkg.ops : latest ? OPS : [],
    STATUS,
    VINTAGE: opts.feed ? feedVintage(v) : deckVintage(v),
  });
}

/** A workstation feed's labels: one fund, and no macro strip to date. */
function feedVintage(v: CioVintage): DeckVintage {
  const out: DeckVintage = { ...deckVintage(v), single: true };
  delete out.macroLabel;
  return out;
}

/** Name of the parent-window property the embedded deck reads its data from. */
export const DECK_FEED_KEY = '__laceraDeckFeed';
