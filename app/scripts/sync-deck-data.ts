import { readFileSync, writeFileSync } from 'node:fs';

import { DECK_BLOCK_BEGIN, DECK_BLOCK_END, deckDataBlock } from '../src/fixtures/deckData';

/** Regenerates the shared data block inside public/deck/index.html from the CIO Monthly fixture.
 *  Run with `npm run sync:deck` after editing src/fixtures/cioMonthly.data.ts. */

const file = new URL('../public/deck/index.html', import.meta.url);
const html = readFileSync(file, 'utf8');
const nl = html.includes('\r\n') ? '\r\n' : '\n';
const lines = html.split(nl);
const begin = lines.indexOf(DECK_BLOCK_BEGIN);
const end = lines.indexOf(DECK_BLOCK_END);
if (begin < 0 || end < 0 || end < begin) {
  throw new Error('public/deck/index.html: shared-data markers not found');
}
const before = lines.slice(begin + 1, end).join('\n');
const after = deckDataBlock();
lines.splice(begin + 1, end - begin - 1, ...after.split('\n'));
writeFileSync(file, lines.join(nl));
console.log(before === after ? 'deck data block already in sync' : 'deck data block regenerated');
