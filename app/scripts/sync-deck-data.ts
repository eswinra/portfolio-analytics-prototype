import { readFileSync, writeFileSync } from 'node:fs';

import {
  DECK_BLOCK_BEGIN,
  DECK_BLOCK_END,
  DECK_WORLD_BEGIN,
  DECK_WORLD_END,
  deckDataBlock,
  deckWorldBlock,
} from '../src/fixtures/deckData';

/** Regenerates the shared data block inside public/deck/index.html from the CIO Monthly fixture.
 *  Run with `npm run sync:deck` after editing src/fixtures/cioMonthly.data.ts. */

const file = new URL('../public/deck/index.html', import.meta.url);
const html = readFileSync(file, 'utf8');
const nl = html.includes('\r\n') ? '\r\n' : '\n';
const lines = html.split(nl);

/** Replaces one marked block in place and says whether it had drifted. */
function replace(beginMark: string, endMark: string, next: string, what: string): void {
  const begin = lines.indexOf(beginMark);
  const end = lines.indexOf(endMark);
  if (begin < 0 || end < 0 || end < begin) {
    throw new Error(`public/deck/index.html: ${what} markers not found`);
  }
  const before = lines.slice(begin + 1, end).join('\n');
  lines.splice(begin + 1, end - begin - 1, ...next.split('\n'));
  console.log(before === next ? `${what} already in sync` : `${what} regenerated`);
}

replace(DECK_BLOCK_BEGIN, DECK_BLOCK_END, deckDataBlock(), 'deck data block');
replace(DECK_WORLD_BEGIN, DECK_WORLD_END, deckWorldBlock(), 'world outlines block');
writeFileSync(file, lines.join(nl));
