import { DECK_DATA } from './cioMonthly.data';

/** The slide deck at public/deck/index.html is a self-contained file (it must open from a
 *  desktop or a USB stick), so it cannot import the fixture. Its data block is generated from
 *  the fixture instead, between these two marker lines, by `npm run sync:deck`; the unit test in
 *  cioMonthly.test.ts fails when the block on disk differs from what this function returns. */

export const DECK_BLOCK_BEGIN =
  '  /* ==== SHARED DATA — generated from src/fixtures/cioMonthly.data.ts by `npm run sync:deck`; edit the fixture, not this block ==== */';
export const DECK_BLOCK_END = '  /* ==== END SHARED DATA ==== */';

const NAMES = ['PERIODS', 'ENT', 'BINS', 'MKT', 'MACRO', 'OPS', 'STATUS'] as const;

/** The lines between the markers (no trailing newline). */
export function deckDataBlock(): string {
  return NAMES.map((name) => `  const ${name} = ${JSON.stringify(DECK_DATA[name])};`).join('\n');
}
