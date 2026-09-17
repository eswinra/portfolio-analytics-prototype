import {
  BINS,
  CIO_LATEST,
  deckVintage,
  MACRO,
  OPS,
  PERIODS,
  STATUS,
  type CioDeckData,
  type CioVintage,
} from '../fixtures/cioMonthly';

/** The dashboard feeds the CIO Monthly slides. When the deck is presented inside the dashboard
 *  it takes this object for the report on screen — any extracted vintage, or an imported
 *  workstation feed — instead of its built-in block, so the slides and the tabs cannot disagree.
 *
 *  Editorial pages (macro strip, items for attention) exist for the latest public report only;
 *  for any other report they are empty and the deck says so rather than showing another month's
 *  text. A workstation feed carries one fund, so the deck locks to it (`single`). */

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

export function deckDataFor(v: CioVintage, opts: { feed?: boolean } = {}): CioDeckData {
  const latest = !opts.feed && v === CIO_LATEST;
  return sanitizeDeckData({
    PERIODS,
    ENT: v.ENT,
    BINS,
    MKT: v.MKT ?? [],
    MACRO: latest ? MACRO : [],
    OPS: latest ? OPS : [],
    STATUS,
    VINTAGE: { ...deckVintage(v), ...(opts.feed ? { single: true } : {}) },
  });
}

/** Name of the parent-window property the embedded deck reads its data from. */
export const DECK_FEED_KEY = '__laceraDeckFeed';
