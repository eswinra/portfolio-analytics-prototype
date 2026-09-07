import {
  BINS,
  CIO_LATEST,
  deckVintage,
  MACRO,
  OPS,
  PERIODS,
  STATUS,
  type CioDeckData,
} from './cioMonthly';

/** The slide deck at public/deck/index.html is a self-contained file (it must open from a
 *  desktop or a USB stick), so it cannot import the fixture. Its data block is generated from
 *  the latest vintage instead, between these two marker lines, by `npm run sync:deck`; the unit
 *  test in cioMonthly.test.ts fails when the block on disk differs from what this returns. */

export const DECK_BLOCK_BEGIN =
  '  /* ==== SHARED DATA — generated from src/fixtures/cioMonthly.ts (latest vintage) by `npm run sync:deck`; edit the fixtures, not this block ==== */';
export const DECK_BLOCK_END = '  /* ==== END SHARED DATA ==== */';

export const DECK_DATA: CioDeckData = {
  PERIODS,
  ENT: CIO_LATEST.ENT,
  BINS,
  MKT: CIO_LATEST.MKT ?? [],
  MACRO,
  OPS,
  STATUS,
  VINTAGE: deckVintage(CIO_LATEST),
};

const NAMES = ['PERIODS', 'ENT', 'BINS', 'MKT', 'MACRO', 'OPS', 'STATUS', 'VINTAGE'] as const;

/** The lines between the markers (no trailing newline). */
export function deckDataBlock(): string {
  return NAMES.map((name) => `  const ${name} = ${JSON.stringify(DECK_DATA[name])};`).join('\n');
}
