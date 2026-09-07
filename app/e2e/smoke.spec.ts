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
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
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
    expect(pageErrors).toEqual([]);
  });

  test('the dashboard tab links to the deck', async ({ page }) => {
    await ready(page, '/cio');
    await expect(page.getByRole('link', { name: 'Open as slides' })).toHaveAttribute(
      'href',
      'deck/',
    );
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
    await expect(page.locator('#view-title')).toContainText(priorLabel);
    await expect(
      page.getByText(/The slide deck always shows the latest public report/),
    ).toBeVisible();
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
    await expect(page.locator('#view-title')).toContainText('June 30, 2026');
    // the feed round-trips the latest public vintage, so the headline tile matches it
    await expect(page.locator('.grid-kpi .stat-value').first()).toHaveText('$93.9B');
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
    await ready(page, '/cio');
    await page.getByRole('button', { name: 'OPEB Trust' }).click();
    await page.getByRole('button', { name: 'Excess vs. benchmark' }).click();
    await page.getByRole('combobox', { name: 'Report' }).selectOption('2026-03-31');
    const url = page.url();
    expect(url).toContain('e=OPEB');
    expect(url).toContain('perf=excess');
    expect(url).toContain('v=2026-03-31');
    // a fresh visit to that link shows the same screen
    await page.goto('/');
    await page.goto(url);
    await expect(page.locator('#view-title')).toContainText('March 31, 2026');
    await expect(page.locator('.band .entity')).toContainText('OPEB');
    await expect(page.getByRole('button', { name: 'Excess vs. benchmark' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('the trend panel switches between chart and table', async ({ page }) => {
    await ready(page, '/cio');
    const trend = page.locator('#cio-trend');
    await expect(trend.locator('figure.spark')).toHaveCount(4);
    await trend.getByRole('button', { name: 'Table', exact: true }).click();
    await expect(trend.locator('table')).toBeVisible();
    await expect(page).toHaveURL(/trend=table/);
  });

  test('compare mode shows both funds against their own benchmarks', async ({ page }) => {
    await ready(page, '/cio');
    await page.getByLabel('Compare both funds').check();
    await expect(page.locator('#cio-perf thead')).toContainText('Pension Fund');
    await expect(page.locator('#cio-perf thead')).toContainText('OPEB Master Trust');
    await expect(page.locator('#cio-comps')).toContainText('compare the drift columns');
  });

  test('the Overview leads with the monthly vintage and keeps it apart from FY2025', async ({
    page,
  }) => {
    await ready(page, '/');
    const strip = page.locator('.monthly-strip');
    await expect(strip).toContainText('Latest monthly report');
    await expect(strip).toContainText('data through June 30, 2026');
    await expect(strip).toContainText('not the fiduciary net position at the fiscal year end');
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

  test('tables offer a copy action and panels without one do not', async ({ page }) => {
    await ready(page, '/cio');
    // the performance panel has a table
    await expect(
      page.locator('#cio-perf').getByRole('button', { name: /Copy table as CSV/ }),
    ).toBeVisible();
    // the two-minute read has none, so its slot is hidden
    await expect(
      page.locator('#cio-read').getByRole('button', { name: /Copy table as CSV/ }),
    ).toBeHidden();
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
