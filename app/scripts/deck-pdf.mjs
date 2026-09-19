/**
 * Renders the CIO Monthly deck to a PDF for publication: a cover, then every slide followed by
 * the figures behind it. The pages come from the deck itself (public/deck/index.html) under its
 * print stylesheet, so what is posted is what the deck shows — no second drawing of anything.
 *
 *   npm run deck:pdf                 both funds, into outputs/cio_deck/
 *   npm run deck:pdf -- --fund opeb  one fund
 *   npm run deck:pdf -- --out ../outputs/board
 *
 * The deck file opens from disk, so this needs no server. Chromium comes from the Playwright
 * browsers the browser suite already installs (`npx playwright install chromium`).
 */

import { mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));
const DECK = join(HERE, '..', 'public', 'deck', 'index.html');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const fundArg = arg('fund', 'both').toLowerCase();
const funds = fundArg === 'both' ? ['pension', 'opeb'] : [fundArg];
if (!funds.every((f) => f === 'pension' || f === 'opeb')) {
  throw new Error('--fund takes pension, opeb or both');
}
const outDir = resolve(HERE, '..', '..', arg('out', 'outputs/cio_deck'));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(pathToFileURL(DECK).href);
await page.locator('.slide').first().waitFor();

for (const fund of funds) {
  await page.locator(`#entity-seg .seg-btn[data-v="${fund}"]`).click();
  // the built slides settle (counters count up, bars grow) before the page is taken
  await page.waitForTimeout(900);
  const { vintage, pages, name } = await page.evaluate(() => {
    window.__buildPrintout();
    const v = window.__laceraDeckData.VINTAGE;
    const seg = document.querySelector('#entity-seg .seg-btn[aria-pressed="true"]');
    return {
      vintage: v,
      pages: document.querySelectorAll('.pp').length + document.querySelectorAll('.slide').length,
      name: seg ? seg.textContent.trim() : '',
    };
  });
  const month = vintage.monthYear.replace(' ', '');
  const file = join(outDir, `CIO_Monthly_${month}_${fund === 'pension' ? 'PensionFund' : 'OPEBMasterTrust'}.pdf`);
  await page.pdf({ path: file, printBackground: true, preferCSSPageSize: true });
  const kb = Math.round(statSync(file).size / 1024);
  console.log(`${name}: ${pages} pages (cover + 9 slides + 9 figures pages) → ${file} (${kb} KB)`);
}

await browser.close();
if (errors.length) {
  console.error('page errors:', errors);
  process.exit(1);
}
