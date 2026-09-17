import { fileURLToPath } from 'node:url';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Smoke suite for the trust-and-controls tranche: every route renders, nothing scrolls
 *  the page body horizontally at any audited viewport, axe passes on every route, and the
 *  three demonstrated controls (cross-entity block, ACFR completion gate, publication gate)
 *  are visible in a real browser. */

const ROUTES = [
  '/',
  '/performance',
  '/allocation',
  '/funded',
  '/risk',
  '/holdings',
  '/import',
  '/recon',
  '/exceptions',
  '/acfr',
  '/cio',
  '/cio?tab=performance',
  '/cio?tab=positioning',
  '/cio?tab=markets',
  '/cio?tab=present',
  '/macro',
  '/macro?tab=factors',
  '/macro?tab=indicators',
  '/macro?tab=sources',
];

const hash = (route: string) => `/#${route}`;
const PENSION_CSV = fileURLToPath(
  new URL('../../data/sample/demofund_export_v1.csv', import.meta.url),
);
const CIO_FEED_CSV = fileURLToPath(
  new URL('../../data/sample/cio_monthly_feed_demofund.csv', import.meta.url),
);

async function ready(page: Page, route: string) {
  await page.goto(hash(route));
  await expect(page.locator('#view-title')).toBeVisible();
}

test.describe('routes render without horizontal overflow', () => {
  for (const route of ROUTES) {
    test(`route ${route}`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (e) => pageErrors.push(String(e)));
      await ready(page, route);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `page-level horizontal overflow on ${route}`).toBeLessThanOrEqual(1);
      expect(pageErrors).toEqual([]);
    });
  }
});

test.describe('accessibility (axe, desktop project)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) < 768, 'desktop project only');
  for (const route of ROUTES) {
    test(`axe clean on ${route}`, async ({ page }) => {
      await ready(page, route);
      // the presented slides are the standalone deck page in a frame, audited as that page
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .exclude('.deck-frame-wrap iframe')
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
    });
  }
});

test.describe('demonstrated controls (desktop project)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) < 768, 'desktop project only');

  test('cross-entity import is hard-blocked with E-ENTITY', async ({ page }) => {
    await ready(page, '/import');
    await page.getByRole('button', { name: 'OPEB Trust' }).click();
    // wait for the dataset context to reflect the switch before staging the file —
    // the import panel names the active workspace once EntitySync has propagated
    await expect(page.getByText(/Active workspace: DEMO-OPEB/)).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(PENSION_CSV);
    await expect(page.getByText(/E-ENTITY/).first()).toBeVisible();
    await expect(page.getByText(/Nothing was applied/).first()).toBeVisible();
  });

  test('ACFR completion stays disabled while requirements are open', async ({ page }) => {
    await ready(page, '/acfr');
    await page.getByLabel('Viewer role').selectOption('leadership');
    await expect(page.getByText(/Completion unavailable/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Mark complete/ })).toBeDisabled();
  });

  test('workstation surfaces the demonstrated publication gate', async ({ page }) => {
    await ready(page, '/recon');
    await expect(page.getByText(/Publication gate \(demonstrated\)/)).toBeVisible();
  });
});

test.describe('CIO Monthly deck stays served at /deck/ (desktop project)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) < 768, 'desktop project only');

  test('deck renders from the shared data block and links back to the dashboard', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.goto('/deck/');
    await expect(page.locator('#s1-title')).toContainText('Executive read');
    await expect(page.locator('#dash-link')).toHaveAttribute('href', '../#/cio');
    await expect(page.locator('#dash-link')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('the slides are presented inside the dashboard, fed by the report on screen', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await ready(page, '/cio');
    await page.getByRole('link', { name: 'Present slides' }).click();
    await expect(page).toHaveURL(/tab=present/);
    const deck = page.frameLocator('.deck-frame-wrap iframe');
    await expect(deck.locator('#s1-title')).toContainText('Executive read');
    await expect(deck.locator('.v-report').first()).toHaveText('August 12, 2026');
    // inside the dashboard the deck does not link back to it
    await expect(deck.locator('#dash-link')).toBeHidden();
    // the header fund toggle switches the slides
    await page.getByRole('button', { name: 'OPEB Trust' }).click();
    await expect(deck.locator('.ent-chip').first()).toHaveText('OPEB Master Trust');
    // another report reloads the slides with its own figures and no other month's editorial pages
    await page.getByRole('combobox', { name: 'Report' }).selectOption('2025-02-28');
    await expect(deck.locator('.v-report').first()).toHaveText('April 9, 2025');
    await expect(deck.locator('#mkt-finding')).toContainText('not available');
    await expect(deck.locator('section[data-id="ops"] .finding')).toContainText('Not carried');
    expect(pageErrors).toEqual([]);
  });

  test('a panel links to its slide and the slide opens where the panel pointed', async ({
    page,
  }) => {
    await ready(page, '/cio?tab=performance');
    await page
      .locator('#cio-perf')
      .getByRole('link', { name: /Slide 3/ })
      .click();
    await expect(page).toHaveURL(/tab=present/);
    await expect(page).toHaveURL(/slide=3/);
    const deck = page.frameLocator('.deck-frame-wrap iframe');
    await expect(deck.locator('#counter')).toHaveText('3 / 9');
  });

  test('selecting an earlier report moves the masthead, band and panels together', async ({
    page,
  }) => {
    await ready(page, '/cio');
    const select = page.getByRole('combobox', { name: 'Report' });
    const options = await select.locator('option').allTextContents();
    expect(options.length).toBeGreaterThan(1);
    // the second option is the prior report
    const priorValue = await select.locator('option').nth(1).getAttribute('value');
    await select.selectOption(priorValue!);
    await expect(page).toHaveURL(new RegExp(`v=${priorValue}`));
    const priorLabel = options[1]!.split(' — data through ')[1]!;
    await expect(page.locator('.asof')).toContainText(priorLabel);
    await expect(page.locator('.about-figures summary')).toContainText(priorLabel);
    // the report slider follows the selection
    await expect(page.getByRole('slider', { name: 'Report month' })).toHaveAttribute(
      'aria-valuetext',
      new RegExp(priorLabel),
    );
  });

  test('an imported schema-1.4 feed appears as the Workstation dataset on the tab', async ({
    page,
  }) => {
    await ready(page, '/import');
    await page.locator('input[type="file"]').setInputFiles(CIO_FEED_CSV);
    await page.getByRole('button', { name: 'Apply this dataset' }).click();
    await expect(page.getByText(/Import applied/)).toBeVisible();
    await page.goto(hash('/cio?v=workstation'));
    await expect(page.getByText(/Workstation feed \(schema 1\.4\)/)).toBeVisible();
    await expect(page.locator('.asof')).toContainText('workstation feed');
    await expect(page.locator('.about-figures summary')).toContainText('June 30, 2026');
    // the feed round-trips the latest public vintage, so the headline tile matches it
    await expect(page.locator('.grid-kpi .stat-value').first()).toHaveText('$93.9B');
    // and the slides present the imported figures, locked to the feed's one fund
    await page.getByRole('tab', { name: 'Present slides' }).click();
    const deck = page.frameLocator('.deck-frame-wrap iframe');
    await expect(deck.locator('.v-report').first()).toContainText('Workstation dataset');
    await expect(deck.locator('#entity-seg')).toBeHidden();
  });

  test('the two-minute read answers the standing questions from the data', async ({ page }) => {
    await ready(page, '/cio');
    const read = page.locator('#cio-read');
    await expect(read.getByText('On track against policy and the hurdle?')).toBeVisible();
    // the answer quotes the reported month return and its benchmark
    await expect(read).toContainText('returned 0.1% net in June');
    await expect(read).toContainText('policy benchmark');
    // and each answer offers the evidence
    await expect(read.getByRole('button', { name: 'See the figures ↓' })).toHaveCount(4);
  });

  test('view state travels in the URL and a pasted link reproduces it', async ({ page }) => {
    await ready(page, '/cio?tab=performance');
    await page.getByRole('button', { name: 'OPEB Trust' }).click();
    await page.getByRole('button', { name: 'Excess vs. benchmark' }).click();
    await page.getByRole('combobox', { name: 'Report' }).selectOption('2026-03-31');
    const url = page.url();
    expect(url).toContain('e=OPEB');
    expect(url).toContain('perf=excess');
    expect(url).toContain('v=2026-03-31');
    expect(url).toContain('tab=performance');
    // a fresh visit to that link shows the same screen
    await page.goto('/');
    await page.goto(url);
    await expect(page.locator('.asof')).toContainText('March 31, 2026');
    await expect(page.locator('.band .entity')).toContainText('OPEB');
    await expect(page.getByRole('button', { name: 'Excess vs. benchmark' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('the trend panel switches between chart and table', async ({ page }) => {
    await ready(page, '/cio?tab=performance');
    const trend = page.locator('#cio-trend');
    await expect(trend.locator('figure.spark')).toHaveCount(4);
    await trend.getByRole('button', { name: 'Table', exact: true }).click();
    await expect(trend.locator('table')).toBeVisible();
    await expect(page).toHaveURL(/trend=table/);
  });

  test('compare mode shows both funds against their own benchmarks', async ({ page }) => {
    await ready(page, '/cio?tab=performance');
    await page.getByLabel('Compare both funds').check();
    await expect(page.locator('#cio-perf thead')).toContainText('Pension Fund');
    await expect(page.locator('#cio-perf thead')).toContainText('OPEB Master Trust');
    await page.getByRole('tab', { name: 'Positioning' }).click();
    await expect(page.locator('#cio-comps')).toContainText('compare the drift columns');
  });

  test('the Overview leads with the monthly vintage and keeps it apart from FY2025', async ({
    page,
  }) => {
    await ready(page, '/');
    const strip = page.locator('.monthly-strip');
    await expect(strip).toContainText('Latest monthly report');
    await expect(strip).toContainText('data through June 30, 2026');
    await expect(strip).toContainText('A separate vintage from the fiscal-year figures below');
    await expect(page.locator('.fy-divider')).toContainText('Fiscal year ended June 30, 2025');
    await strip.getByRole('link', { name: 'Open the CIO Monthly view' }).click();
    await expect(page).toHaveURL(/#\/cio/);
  });

  test('every page offers the definitions glossary', async ({ page }) => {
    for (const route of ['/', '/cio', '/holdings']) {
      await ready(page, route);
      await expect(page.locator('#glossary summary')).toBeVisible();
    }
    await page.locator('#glossary summary').click();
    await expect(page.getByText('TWR — time-weighted return')).toBeVisible();
  });

  test('the panel menu copies tables and links, and hides the table action without a table', async ({
    page,
  }) => {
    await ready(page, '/cio?tab=performance');
    const perf = page.locator('#cio-perf');
    await perf.getByLabel('Panel actions').click();
    await expect(perf.getByRole('button', { name: 'Copy table as CSV' })).toBeVisible();
    await expect(perf.getByRole('button', { name: 'Copy link to this panel' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Summary' }).click();
    const read = page.locator('#cio-read');
    await read.getByLabel('Panel actions').click();
    await expect(read.getByRole('button', { name: 'Copy table as CSV' })).toBeHidden();
    await expect(read.getByRole('button', { name: 'Copy link to this panel' })).toBeVisible();
  });

  test('a panel link opens the right tab and scrolls to the panel', async ({ page }) => {
    await ready(page, '/cio?tab=positioning&p=cio-hist');
    await expect(page.locator('#cio-hist')).toBeInViewport();
  });

  test('each page states its vintage and classification once, and cites on demand', async ({
    page,
  }) => {
    await ready(page, '/');
    await expect(page.locator('.about-figures summary')).toContainText(
      'reported public unless marked',
    );
    await expect(page.locator('.kpi-provenance')).toHaveCount(0);
    const chip = page.locator('#ov-growth .src-chip');
    await chip.locator('summary').click();
    await expect(chip.getByRole('link', { name: /2025 PAFR/ })).toBeVisible();
    // method notes are collapsed until asked for
    const method = page.locator('#ov-returns .method');
    await expect(method.getByText(/money-weighted returns/)).toBeHidden();
    await method.locator('summary').click();
    await expect(method.getByText(/money-weighted returns/)).toBeVisible();
  });

  test('charts read out a point under the pointer or the arrow keys', async ({ page }) => {
    await ready(page, '/performance');
    const chart = page.locator('.pair-chart');
    await chart.focus();
    await expect(page.locator('#perf-chart .chart-tip')).toContainText('10 Years');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#perf-chart .chart-tip')).toContainText('5 Years');
    // the table row for the same horizon is highlighted with it
    await expect(page.locator('#perf-returns tr.is-linked')).toContainText('5 Years');
    // a legend key hides its series
    await page.getByRole('button', { name: 'Policy benchmark' }).click();
    await expect(page.locator('.bar-bench')).toHaveCount(0);
  });

  test('switching funds says when it discards an applied import', async ({ page }) => {
    await ready(page, '/import');
    await page.locator('input[type="file"]').setInputFiles(CIO_FEED_CSV);
    await page.getByRole('button', { name: 'Apply this dataset' }).click();
    await expect(page.getByText(/Import applied/)).toBeVisible();
    await page.getByRole('button', { name: 'OPEB Trust' }).click();
    await expect(page.getByText(/Import discarded:/)).toBeVisible();
    await expect(page.getByText(/DEMOFUND, 121 records/)).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByText(/Import discarded:/)).toHaveCount(0);
  });
});

test.describe('Economic Context (desktop project)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) < 768, 'desktop project only');

  test('dates, market-context separation and the two-minute read', async ({ page }) => {
    await ready(page, '/macro');
    await expect(page.locator('#view-title')).toContainText('Economic context');
    await expect(page.locator('.asof')).toContainText('monthly factors through');
    await expect(page.locator('.about-figures summary')).toContainText(
      'market context, not LACERA performance',
    );
    const read = page.locator('#mac-read');
    await expect(read.locator('.stat-value')).toHaveCount(4);
    await expect(read).toContainText('Where the economy sits');
    await expect(read).toContainText('Which way it is moving');
    await expect(read).toContainText('proxy estimate');
  });

  test('the portfolio lens follows the fund and shows its arithmetic', async ({ page }) => {
    await ready(page, '/macro?tab=factors');
    const lens = page.locator('#mac-lens');
    await expect(lens).toContainText('Diversified Hedge Funds');
    await lens.getByRole('button', { name: 'Natural Resources' }).click();
    await expect(page).toHaveURL(/lens=asset-Natural/);
    await expect(lens.locator('.lens-detail h3')).toContainText('Natural Resources');
    await expect(lens.locator('.lens-detail')).toContainText('Sensitivities from the');
    // OPEB policy has no hedge-fund sleeve and cites the OPEB IPS
    await page.getByRole('button', { name: 'OPEB Trust' }).click();
    await expect(lens).not.toContainText('Diversified Hedge Funds');
    await expect(lens.locator('.src-chip summary')).toHaveAttribute('aria-label', /OPEB/);
  });

  test('a what-if scenario re-ranks the sleeves and is marked as not observed', async ({
    page,
  }) => {
    await ready(page, '/macro?tab=factors');
    const lens = page.locator('#mac-lens');
    await lens.locator('.scenario > summary').click();
    await lens.getByRole('slider').nth(2).fill('-2');
    await expect(page).toHaveURL(/s=realrates%3A-2|s=realrates:-2/);
    await expect(lens.getByText('Scenario — not observed')).toBeVisible();
    await lens.getByRole('button', { name: 'Reset to observed' }).click();
    await expect(lens.getByText('Scenario — not observed')).toHaveCount(0);
  });

  test('a factor opens to its components, and the state is in the URL', async ({ page }) => {
    await ready(page, '/macro?tab=factors');
    const factors = page.locator('#mac-factors');
    const credit = factors.getByRole('button', { name: /Credit conditions/ });
    await credit.click();
    await expect(credit).toHaveAttribute('aria-expanded', 'true');
    await expect(factors.getByRole('link', { name: 'NFCI credit' })).toBeVisible();
    await expect(page).toHaveURL(/f=credit/);
    await page.getByRole('tab', { name: 'Indicators' }).click();
    const history = page.locator('#mac-history');
    await history.getByRole('combobox', { name: 'History series' }).selectOption('DGS10');
    await history.getByRole('button', { name: '1Y' }).click();
    const url = page.url();
    expect(url).toContain('hs=DGS10');
    expect(url).toContain('hr=1');
    await page.goto('/');
    await page.goto(url);
    await expect(page.locator('#mac-history h2')).toContainText('10-year Treasury');
    await page.getByRole('tab', { name: 'Factors & lens' }).click();
    await expect(
      page.locator('#mac-factors').getByRole('button', { name: /Credit conditions/ }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  test('restricted series are disclosed and never shown', async ({ page }) => {
    await ready(page, '/macro?tab=sources');
    const sources = page.locator('#mac-sources');
    await expect(sources).toContainText('BAMLH0A0HYM2');
    await expect(sources).toContainText('reproduction in any form is prohibited');
    await sources.getByText(/series, with original sources/).click();
    await expect(sources.getByRole('link', { name: 'UNRATE' })).toBeVisible();
    await expect(sources.getByRole('link', { name: 'BAMLH0A0HYM2' })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Indicators' }).click();
    await expect(page.locator('#mac-board')).not.toContainText('High Yield');
  });
});
