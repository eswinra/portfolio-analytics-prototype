import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

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
  // the Exception Center on a report with a data condition (a month missing before it)
  '/exceptions?v=2025-12-31',
  '/data-quality',
  '/acfr',
  '/cio',
  '/cio?tab=summary',
  '/cio?tab=performance',
  '/cio?tab=positioning',
  '/cio?tab=markets',
  '/cio?tab=explore',
  '/cio?tab=compare',
  // the provenance drawer open, on the widest record (a proxy with four inputs) and on one that
  // cites two documents
  '/cio?tab=performance&fig=pension.attr.FYTD',
  '/cio?tab=positioning&fig=pension.growth.bound',
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
// the example workbook's Export tab, saved by desktop Excel as "CSV UTF-8"
const CIO_TEMPLATE_CSV = fileURLToPath(
  new URL('../../data/sample/cio_template_example_aug2026.csv', import.meta.url),
);

// the filled example workbook as downloaded (saved by Excel, so its formulas carry values), and
// the blank template as generated (its formulas not yet calculated)
const CIO_EXAMPLE_XLSX = fileURLToPath(
  new URL('../public/templates/CIO_Monthly_Template_Example.xlsx', import.meta.url),
);
const CIO_BLANK_XLSX = fileURLToPath(
  new URL('../public/templates/CIO_Monthly_Template.xlsx', import.meta.url),
);
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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

// audit 2026-09-18, finding 7: the standalone deck's controls stay on a phone's screen
test.describe('standalone deck on a phone', () => {
  test('nothing scrolls sideways and the controls stay on screen', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 1280) >= 768, 'phone projects only');
    await page.goto('/deck/');
    await expect(page.locator('#counter')).toBeVisible();
    const r = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      vw: window.innerWidth,
      off: [...document.querySelectorAll('.bar *, .metabar *, .acts *')].filter((el) => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1);
      }).length,
    }));
    expect(r.scroll).toBeLessThanOrEqual(r.vw + 1);
    expect(r.off).toBe(0);
    for (const id of ['#prev', '#next', '#full-btn']) {
      await expect(page.locator(id)).toBeInViewport();
    }
    await expect(page.getByRole('link', { name: 'read the dashboard summary' })).toBeVisible();
  });
});

test.describe('CIO template file (read in the browser, never uploaded)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) < 768, 'desktop project only');
  const fileInput = (page: Page) => page.locator('.vs-file input[type="file"]');

  test('builds the tab and the slides from the Excel export, sending nothing', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    const sent: string[] = [];
    page.on('request', (r) => {
      if (r.method() !== 'GET') sent.push(`${r.method()} ${r.url()}`);
    });
    await ready(page, '/cio?tab=summary');
    await fileInput(page).setInputFiles(CIO_TEMPLATE_CSV);
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'Template file cio_template_example_aug2026.csv' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/v=file/);
    await expect(page.getByLabel('Report', { exact: true })).toHaveValue('file');
    await expect(page.locator('.masthead')).toContainText(
      'template file for August 12, 2026 (not published)',
    );
    const axeOpen = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(axeOpen.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
    // the items for attention are the file's
    await page.getByRole('tab', { name: 'Markets & items' }).click();
    await expect(page.locator('#cio-ops')).toContainText('Risk system onboarding');
    // the slides say where their figures come from
    await page.getByRole('tab', { name: 'Slides' }).click();
    const deck = page.frameLocator('.deck-frame-wrap iframe');
    await expect(deck.locator('#deck-origin')).toContainText(
      'template file (cio_template_example_aug2026.csv), not published',
    );
    await expect(deck.locator('.slide .src').first()).toContainText('Source: template file');
    expect(sent).toEqual([]);
    expect(pageErrors).toEqual([]);
    // closing it returns to the latest published report
    await page.getByRole('button', { name: 'Close file' }).click();
    await expect(page).not.toHaveURL(/v=file/);
  });

  test('refuses a broken file, says why, and shows nothing from it', async ({ page }) => {
    await ready(page, '/cio?tab=summary');
    await fileInput(page).setInputFiles({
      name: 'wrong.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Report,,\nReport date,,2026-09-09\n'),
    });
    await expect(page.getByRole('alert')).toContainText('wrong.csv was not opened');
    await expect(page.getByRole('alert')).toContainText('Export tab');
    await expect(page).not.toHaveURL(/v=file/);
    const axeAlert = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('.deck-frame-wrap iframe')
      .analyze();
    expect(axeAlert.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  });

  test('opens the filled workbook itself, with the site’s own reader, sending nothing', async ({
    page,
    baseURL,
  }) => {
    const requests: string[] = [];
    page.on('request', (r) => requests.push(`${r.method()} ${r.url()}`));
    await ready(page, '/cio?tab=summary');
    // the workbook reader loads only when a workbook is opened
    expect(requests.filter((r) => /\/xlsx-[^/]*\.js$/.test(r))).toEqual([]);
    await fileInput(page).setInputFiles(CIO_EXAMPLE_XLSX);
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'Template file CIO_Monthly_Template_Example.xlsx' }),
    ).toBeVisible();
    await expect(page.locator('.masthead')).toContainText(
      'template file for August 12, 2026 (not published)',
    );
    await expect(page.locator('.grid-kpi .stat-value').first()).toHaveText('$93.9B');
    expect(requests.filter((r) => /\/xlsx-[^/]*\.js$/.test(r))).toHaveLength(1);
    // nothing sent, and nothing fetched from anywhere but this site
    expect(requests.filter((r) => !r.startsWith('GET '))).toEqual([]);
    expect(
      requests.filter((r) => /^GET https?:/.test(r) && !r.startsWith(`GET ${baseURL}`)),
    ).toEqual([]);
  });

  test('asks for the blank template to be saved by Excel before it is read', async ({ page }) => {
    await ready(page, '/cio?tab=summary');
    await fileInput(page).setInputFiles(CIO_BLANK_XLSX);
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('CIO_Monthly_Template.xlsx was not opened');
    await expect(alert).toContainText('formulas have not been calculated');
    await expect(page).not.toHaveURL(/v=file/);
  });

  test('a reload clears the file, and the page says so', async ({ page }) => {
    await ready(page, '/cio?tab=summary');
    await fileInput(page).setInputFiles(CIO_TEMPLATE_CSV);
    await expect(page).toHaveURL(/v=file/);
    await page.reload();
    await expect(page.getByText(/template file was cleared when the page reloaded/)).toBeVisible();
    await expect(page.getByLabel('Report', { exact: true })).not.toHaveValue('file');
  });
});

test.describe('how the CIO slides work (shareable page)', () => {
  test('the CIO Monthly tab links to it', async ({ page }) => {
    await ready(page, '/cio');
    const link = page.getByRole('link', { name: /How this report works/ });
    await expect(link).toHaveAttribute('href', 'how-it-works/');
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('it opens on its own, points to the code, and fits the screen', async ({ page }) => {
    await page.goto('/how-it-works/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'How the CIO Monthly slides work',
    );
    await expect(page.getByRole('link', { name: 'Open the slides' })).toHaveAttribute(
      'href',
      '../#/cio',
    );
    // every code link goes to the public repository
    const code = page.locator('.code a');
    expect(await code.count()).toBeGreaterThan(5);
    for (const href of await code.evaluateAll((as) => as.map((a) => a.getAttribute('href')))) {
      expect(href).toMatch(/^https:\/\/github\.com\/eswinra\/portfolio-analytics-prototype/);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    // the template downloads it offers are on the site
    for (const name of ['CIO_Monthly_Template.xlsx', 'CIO_Monthly_Template_Example.xlsx']) {
      const res = await page.request.get(`/templates/${name}`);
      expect(res.status(), name).toBe(200);
    }
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  });
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

test.describe('CIO Monthly › Explore (desktop project)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) < 768, 'desktop project only');

  test('a category, a month, a pair and a scenario, all kept in the address', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await ready(page, '/cio?tab=explore');
    const grid = page.locator('#cio-x-grid');
    // a month no report carries is shown as such, never filled
    await expect(grid.locator('thead th')).toHaveCount(18);
    await expect(grid.locator('thead')).toContainText('no report');

    await grid.getByRole('button', { name: 'Growth', exact: true }).click();
    await expect(page).toHaveURL(/cat=growth/);
    await expect(page.locator('#cio-x-cat h2')).toHaveText('Growth: return and weight');

    await grid
      .getByRole('button', { name: 'Open the report with data through March 2026' })
      .click();
    await expect(page).toHaveURL(/v=2026-03-31/);
    await expect(page.locator('#cio-x-cat .x-lede')).toContainText(
      'In March 2026 it was 47.0% of the fund against a 48.0% target (policy range 40–56%).',
    );

    const corr = page.locator('#cio-x-corr');
    await corr.getByRole('button', { name: /^Growth and Real Assets/ }).click();
    await expect(page).toHaveURL(/pair=growth-ra/);
    await expect(corr.locator('.x-lede')).toContainText('correlation 0.33 over 16 months');
    await expect(corr.locator('.x-lede')).toContainText('cannot tell a relation from none');

    const scen = page.locator('#cio-x-scenario');
    await scen.getByLabel('Growth').fill('50');
    await expect(scen).toContainText('No amounts yet');
    await expect(scen).toContainText('The targets add to 102.0%; they must add to 100%.');
    await scen.getByLabel('Risk Reduction & Mit.').fill('22');
    await expect(scen.locator('.x-lede')).toHaveText(
      '$2,787M bought and $2,787M sold — 3.1% of the fund changing hands.',
    );
    await expect(page).toHaveURL(/targets=growth%3A50/);

    // the link reproduces the screen
    await page.reload();
    await expect(page.locator('#cio-x-cat h2')).toHaveText('Growth: return and weight');
    await expect(scen.getByLabel('Growth')).toHaveValue('50');
    await expect(scen.locator('.x-lede')).toContainText('$2,787M bought');
    await scen.getByRole('button', { name: /Reset to the report/ }).click();
    await expect(page).not.toHaveURL(/targets=/);
    expect(pageErrors).toEqual([]);
  });

  test('Play steps through the reports, oldest first, and stops at the latest', async ({
    page,
  }) => {
    await page.clock.install();
    await ready(page, '/cio?tab=explore');
    await page.getByRole('button', { name: 'Play the reports' }).click();
    await expect(page).toHaveURL(/v=2025-02-28/);
    const marked = page.locator('#cio-x-grid .x-month[aria-pressed="true"]');
    await expect(marked).toHaveAccessibleName('Open the report with data through February 2025');
    await page.clock.runFor(1600);
    await expect(page).toHaveURL(/v=2025-03-31/);
    await expect(marked).toHaveAccessibleName('Open the report with data through March 2025');
    // Pause holds the report on screen
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.clock.runFor(5000);
    await expect(page).toHaveURL(/v=2025-03-31/);
    // playing on reaches the latest report and stops there
    await page.getByRole('button', { name: 'Play the reports' }).click();
    await page.clock.runFor(1600 * 20);
    await expect(page).not.toHaveURL(/v=/);
    await expect(marked).toHaveAccessibleName('Open the report with data through June 2026');
    await expect(page.getByRole('button', { name: 'Play the reports' })).toBeVisible();
  });

  test('the OPEB Trust uses its own policy ranges', async ({ page }) => {
    await ready(page, '/cio?tab=explore');
    await page.getByRole('button', { name: 'OPEB Trust' }).click();
    await expect(page.locator('#cio-x-scenario')).toContainText('range 35–55%');
  });
});

test.describe('contract workbook import (desktop project)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) < 768, 'desktop project only');
  const bookOf = (sheets: [string, unknown[][]][]) => {
    const wb = XLSX.utils.book_new();
    for (const [name, rows] of sheets) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
    }
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  };

  test('a workbook with a title block is preflighted like its CSV, and applies', async ({
    page,
  }) => {
    const [header, ...rows] = Papa.parse<string[]>(readFileSync(PENSION_CSV, 'utf8').trim()).data;
    const num = (v: string) => (/^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v);
    const buffer = bookOf([
      ['README', [['Synthetic demonstration workbook']]],
      [
        'Contract',
        [['DEMOFUND contract export'], ['synthetic'], [], header!, ...rows.map((r) => r.map(num))],
      ],
    ]);
    await ready(page, '/import');
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: 'demofund.xlsx', mimeType: XLSX_TYPE, buffer });
    await expect(page.getByText('Preflight — demofund.xlsx, sheet Contract')).toBeVisible();
    await page.getByRole('button', { name: 'Apply this dataset' }).click();
    await expect(page.getByText(/Import applied/)).toBeVisible();
  });

  test('a workbook without a contract sheet is refused, naming its sheets', async ({ page }) => {
    const buffer = bookOf([
      ['README', [['notes']]],
      [
        'Returns',
        [
          ['month', 'return'],
          ['2026-06-30', 0.01],
        ],
      ],
    ]);
    await ready(page, '/import');
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: 'other.xlsx', mimeType: XLSX_TYPE, buffer });
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('other.xlsx was not read');
    await expect(alert).toContainText('Its sheets: README, Returns.');
    await expect(page.getByText(/Preflight —/)).toHaveCount(0);
  });
});

test.describe('CIO slide 2 drivers (desktop project)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) < 768, 'desktop project only');

  test('a category opens to what drove its month, from the published figures', async ({ page }) => {
    await ready(page, '/cio?tab=slides&slide=4');
    const deck = page.frameLocator('.deck-frame-wrap iframe');
    await deck.locator('#alloc-legend button', { hasText: 'Credit' }).first().click();
    await deck.getByRole('button', { name: /What drove this month/ }).click();
    const det = deck.locator('.det');
    // its share of the fund's month: month-end weight x its return, called indicative
    await expect(det).toContainText('Indicative contribution');
    await expect(det).toContainText('+0.11 pts');
    // the value bridge against the previous report, which adds up to the month's close
    await expect(det).toContainText('Value since May 2026');
    await expect(det).toContainText('$11,760 mm');
    await expect(det).toContainText('$11,749 mm');
    await expect(det).toContainText('Rebalancing flow');
    // market moves are named as context, never as attribution
    await expect(det).toContainText('Markets this month');
    await expect(det).toContainText('Index moves (p. 5) are context, not attribution.');
    // the card still clears the note row under it
    const gap = await deck.locator('.slide.active').evaluate((slide) => {
      const d = slide.querySelector('.det')!.getBoundingClientRect();
      const nb = slide.querySelector('.nb')!.getBoundingClientRect();
      return nb.top - d.bottom;
    });
    expect(gap).toBeGreaterThan(0);
    await deck.getByRole('button', { name: /Hide what drove this month/ }).click();
    await expect(det).not.toContainText('Indicative contribution');
  });
});

test.describe('compare two reports (desktop project)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) < 768, 'desktop project only');

  test('defaults to the same month a year earlier, and withholds what cannot be compared', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await ready(page, '/cio?tab=compare');
    const head = page.locator('#cio-compare');
    await expect(head.getByRole('heading')).toContainText('June 2025 against June 2026');
    await expect(head.getByLabel('Report to compare with')).toHaveValue('2025-06-30');

    const returns = page.locator('#cio-cmp-returns');
    // across a fiscal-year reset FYTD measures different things, so it is shown but not compared
    const fytd = returns.locator('tbody tr', { hasText: 'FYTD' });
    await expect(fytd).toContainText('not compared');
    await expect(fytd).toContainText('FY2025 and FY2026');
    // a trailing window a year apart shares most of its months, and says so
    await expect(returns.locator('tbody tr', { hasText: '3 Y' })).toContainText(
      'share 24 of 36 months',
    );
    // a change in market value is not a return
    await expect(page.locator('#cio-cmp-fund')).toContainText('not a return');
    // a difference of two percentages is percentage points
    await expect(returns.locator('tbody tr', { hasText: '1 Y' })).toContainText('pp');
    expect(errors).toEqual([]);
  });

  test('the marker means what it means on Summary, so it does not mark everything', async ({
    page,
  }) => {
    await ready(page, '/cio?tab=compare');
    await expect(page.locator('tr.cmp-mat')).toHaveCount(3);
    // the filter leaves only the marked rows
    await page.getByRole('checkbox', { name: /Only rows that crossed a threshold/ }).check();
    await expect(page).toHaveURL(/material=1/);
    await expect(page.locator('table.cmp tbody tr')).toHaveCount(3);
    await expect(page.locator('#cio-cmp-geo')).toContainText('Nothing in this section');
  });

  test('picking another report compares against it, in date order either way', async ({ page }) => {
    await ready(page, '/cio?tab=compare');
    await page.getByLabel('Report to compare with').selectOption('2026-05-31');
    await expect(page).toHaveURL(/vs=2026-05-31/);
    await expect(page.locator('#cio-compare').getByRole('heading')).toContainText(
      'May 2026 against June 2026',
    );
    // an older report on screen compared with a newer one still runs earlier then later
    await ready(page, '/cio?tab=compare&v=2025-06-30&vs=2026-06-30');
    await expect(page.locator('#cio-compare').getByRole('heading')).toContainText(
      'June 2025 against June 2026',
    );
  });

  test('the other fund cites its own pages', async ({ page }) => {
    // the first draft hardcoded the Pension Fund's pp. 8-9, which is wrong for the trust
    await ready(page, '/cio?tab=compare');
    const cite = page.locator('#cio-compare .src-chip summary');
    await expect(cite).toHaveAttribute('aria-label', /pp\. 8–9/);
    await page.getByRole('button', { name: 'OPEB Trust' }).click();
    await expect(cite).toHaveAttribute('aria-label', /pp\. 13–14/);
    await expect(cite).not.toHaveAttribute('aria-label', /pp\. 8–9/);
  });
});

const SAVED_KEY = 'lacera-portfolio-analytics:saved-views:v1';

test.describe('saved views (desktop project)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) < 768, 'desktop project only');

  test('a saved view is named for what it shows, kept, and reopens the same address', async ({
    page,
  }) => {
    await ready(page, '/cio?tab=compare&e=OPEB');
    await page.locator('.saved-views > summary').click();
    const menu = page.locator('.sv-pop');
    await expect(menu.getByLabel('Name for this view')).toHaveValue(
      'CIO Monthly › Compare · OPEB Trust · latest report',
    );
    // pinning fixes the report, and the offered name says which
    await menu.getByLabel(/Keep the August 12, 2026 report/).check();
    await expect(menu.getByLabel('Name for this view')).toHaveValue(
      'CIO Monthly › Compare · OPEB Trust · August 12, 2026 report',
    );
    await menu.getByRole('button', { name: 'Save this view' }).click();
    await expect(menu.locator('.sv-status')).toContainText('Saved');
    await expect(menu.locator('.sv-list li')).toHaveCount(1);
    await expect(menu.locator('.sv-meta')).toContainText('fixed to the August 12, 2026 report');

    // only an address and a name are stored: no figure
    const stored = await page.evaluate((k) => localStorage.getItem(k), SAVED_KEY);
    expect(JSON.parse(stored!).views[0].href).toBe('/cio?tab=compare&e=OPEB&v=2026-06-30');
    expect(stored).not.toMatch(/\d+\.\d%/);

    // kept across a reload, and opened from another page
    await ready(page, '/performance');
    await expect(page.locator('.saved-views > summary')).toHaveText('Saved views (1)');
    await page.locator('.saved-views > summary').click();
    await page
      .getByRole('link', { name: 'CIO Monthly › Compare · OPEB Trust · August 12, 2026 report' })
      .click();
    await expect(page).toHaveURL(/#\/cio\?tab=compare&e=OPEB&v=2026-06-30$/);
    await expect(page.locator('.band .entity')).toHaveText('OPEB Master Trust');
    await expect(page.locator('.saved-views')).not.toHaveAttribute('open', '');
  });

  test('a view that follows the latest report says so, and saving it again renames it', async ({
    page,
  }) => {
    await ready(page, '/exceptions');
    await page.locator('.saved-views > summary').click();
    const menu = page.locator('.sv-pop');
    await menu.getByRole('button', { name: 'Save this view' }).click();
    await expect(menu.locator('.sv-meta')).toContainText('follows the latest report');
    await expect(menu.getByLabel('This view is saved as')).toHaveValue(
      'Exception Center · latest report',
    );
    await menu.getByLabel('This view is saved as').fill('Monday morning');
    await menu.getByRole('button', { name: 'Rename' }).click();
    await expect(menu.locator('.sv-list li')).toHaveCount(1);
    await expect(menu.getByRole('link', { name: 'Monday morning' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('a deleted view can be put back', async ({ page }) => {
    await ready(page, '/allocation?e=OPEB');
    await page.locator('.saved-views > summary').click();
    const menu = page.locator('.sv-pop');
    await menu.getByRole('button', { name: 'Save this view' }).click();
    await menu.getByRole('button', { name: 'Delete Allocation · OPEB Trust' }).click();
    await expect(menu.locator('.sv-list li')).toHaveCount(0);
    await expect(menu.getByText('No saved views in this browser yet.')).toBeVisible();
    await menu.getByRole('button', { name: 'Undo' }).click();
    await expect(menu.locator('.sv-list li')).toHaveCount(1);
    const stored = await page.evaluate((k) => localStorage.getItem(k), SAVED_KEY);
    expect(JSON.parse(stored!).views).toHaveLength(1);
  });

  test('a view of a template file cannot be saved, and says why', async ({ page }) => {
    await ready(page, '/cio?tab=summary&v=file');
    await page.locator('.saved-views > summary').click();
    const menu = page.locator('.sv-pop');
    await expect(menu).toContainText('never stored, so a view of it cannot be saved');
    await expect(menu.getByRole('button', { name: 'Save this view' })).toHaveCount(0);
  });

  test('stored entries that are not dashboard views are left out, and counted', async ({
    page,
  }) => {
    await page.addInitScript((k) => {
      const at = '2026-09-22T09:00:00.000Z';
      localStorage.setItem(
        k,
        JSON.stringify({
          v: 1,
          views: [
            { id: 'a', name: 'Performance', href: '/performance', savedAt: at },
            { id: 'b', name: 'Script', href: 'javascript:alert(1)', savedAt: at },
            { id: 'c', name: 'Elsewhere', href: '//example.org/', savedAt: at },
          ],
        }),
      );
    }, SAVED_KEY);
    await ready(page, '/');
    await page.locator('.saved-views > summary').click();
    const menu = page.locator('.sv-pop');
    await expect(menu.locator('.sv-open')).toHaveCount(1);
    await expect(menu.locator('.sv-open')).toHaveAttribute('href', '#/performance');
    await expect(menu).toContainText(
      '2 stored entries were not a dashboard view and were left out.',
    );
  });

  test('axe clean with the menu open and a view saved', async ({ page }) => {
    await ready(page, '/cio?tab=summary');
    await page.locator('.saved-views > summary').click();
    await page.locator('.sv-pop').getByRole('button', { name: 'Save this view' }).click();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('.deck-frame-wrap iframe')
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  });
});

test.describe('saved views on a phone', () => {
  test('the menu stays on screen', async ({ page }) => {
    await ready(page, '/exceptions');
    await page.locator('.saved-views > summary').click();
    const box = await page.locator('.sv-pop').boundingBox();
    const width = page.viewportSize()!.width;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe('Exception Center (desktop project)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) < 768, 'desktop project only');

  test('comes second in the dashboard, and the Overview says what it holds', async ({ page }) => {
    await ready(page, '/');
    const nav = page.locator('.mainnav-links a');
    await expect(nav.nth(0)).toHaveText('Overview');
    await expect(nav.nth(1)).toHaveText('Exceptions');
    const line = page.locator('.strip-exceptions');
    await expect(line).toContainText('no policy exceptions');
    await expect(line).toContainText('across both funds');
    await line.getByRole('link', { name: 'Open the Exception Center →' }).click();
    await expect(page).toHaveURL(/#\/exceptions/);
    await expect(page.locator('#view-title')).toHaveText('Exception Center');
  });

  test('an empty section still says how far from an exception it is', async ({ page }) => {
    await ready(page, '/exceptions');
    const lead = page.locator('.xc-lead');
    await expect(lead).toHaveText(
      'No policy exceptions · no data conditions · 13 changes to explain, across both funds.',
    );
    const policy = page.locator('#x-policy');
    await expect(policy.getByRole('heading')).toHaveText(
      'No composite is within 1.0 pp of an IPS bound',
    );
    await expect(policy).toContainText('The nearest is Real Assets & Inflation Hedges');
    await expect(policy).toContainText('3.4 pp from its lower bound');
    // what holds for every report is not listed; it is one link away
    await expect(
      page.locator('#x-data').getByRole('link', { name: 'freshness matrix' }),
    ).toBeVisible();
  });

  test('the changes to explain are exactly the two funds’ “What changed” lists', async ({
    page,
  }) => {
    await ready(page, '/exceptions');
    const listed = await page.locator('#x-explain tbody tr').count();
    let onCio = 0;
    for (const e of ['PENSION', 'OPEB']) {
      await ready(page, `/cio?tab=summary&e=${e}`);
      // the fiscal-year reset line is context, not a change, on both pages
      onCio += await page
        .locator('#cio-changed .change-row')
        .filter({ hasNotText: 'New fiscal year' })
        .count();
    }
    expect(listed).toBe(13);
    expect(onCio).toBe(listed);
  });

  test('an item opens its fund and panel with the figure’s record on top', async ({ page }) => {
    await ready(page, '/exceptions');
    await page.getByRole('link', { name: 'Open in CIO Monthly: Real Assets & IH weight' }).click();
    await expect(page).toHaveURL(/tab=summary/);
    await expect(page).toHaveURL(/e=OPEB/);
    await expect(page.locator('.band .entity')).toHaveText('OPEB Master Trust');
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('heading', { level: 2 })).toContainText('change in weight');
    await expect(drawer).toContainText('+1.0 pp');
  });

  test('a report with a month missing before it says so, dated by that report', async ({
    page,
  }) => {
    await ready(page, '/exceptions?v=2025-12-31');
    await expect(page.locator('.asof')).toContainText('Data through December 31, 2025');
    const data = page.locator('#x-data');
    await expect(data.getByRole('heading')).toHaveText('Data conditions in this report (1)');
    await expect(data).toContainText('The prior report is 2 months earlier');
    await expect(data).toContainText('no report with data through November 30, 2025');
    // choosing another report keeps the page and moves the date
    await page.getByLabel('Report', { exact: true }).selectOption('2026-06-30');
    await expect(page).not.toHaveURL(/v=/);
    await expect(page.locator('#x-data').getByRole('heading')).toHaveText(
      "Nothing unusual about this report's data",
    );
  });

  test('the synthetic pipeline queue is Workstation › Data quality', async ({ page }) => {
    await ready(page, '/data-quality');
    await expect(page.locator('#view-title')).toHaveText('Data quality');
    await expect(page.locator('.mainnav-links a.active')).toHaveText('Data quality');
    await expect(page.locator('.workflow-banner')).toContainText('synthetic contract data');
  });
});

test.describe('provenance drawer (desktop project)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) < 768, 'desktop project only');

  test('selecting a figure shows its page, classification and period, and the address', async ({
    page,
  }) => {
    await ready(page, '/cio?tab=summary');
    const figure = page.locator('[data-fig="pension.r.FYTD"]');
    await figure.click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await expect(page).toHaveURL(/fig=pension\.r\.FYTD/);
    // focus moves into the drawer, onto the figure's name
    await expect(drawer.getByRole('heading', { level: 2 })).toBeFocused();
    await expect(drawer.getByRole('heading', { level: 2 })).toHaveText(
      'Net return, fiscal year to date',
    );
    await expect(drawer).toContainText('reported public');
    // the page it is printed on, linked to that page of the public PDF
    const link = drawer.getByRole('link', {
      name: /CIO Monthly Report \(August 12, 2026\), p\. 9/,
    });
    await expect(link).toHaveAttribute('href', /CIO-Monthly-Report-Aug-2026\.pdf#page=9$/);
    await expect(drawer).toContainText('July 1, 2025 – June 30, 2026, cumulative over 12 months');

    // Escape closes it, clears the address and returns focus to the figure
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(page).not.toHaveURL(/fig=/);
    await expect(figure).toBeFocused();
  });

  test('a calculated figure opens each of its inputs, and Back retraces the path', async ({
    page,
  }) => {
    await ready(page, '/cio?tab=summary&fig=pension.x.FYTD');
    const drawer = page.getByRole('dialog');
    const title = drawer.getByRole('heading', { level: 2 });
    await expect(title).toHaveText('Excess over the policy benchmark, fiscal year to date');
    await expect(drawer).toContainText('12.2% − 14.8% = −2.6 pp');
    await expect(drawer).toContainText('calculated');

    await drawer
      .getByRole('button', { name: 'Policy benchmark return, fiscal year to date' })
      .click();
    await expect(title).toHaveText('Policy benchmark return, fiscal year to date');
    await expect(page).toHaveURL(/fig=pension\.b\.FYTD/);
    await expect(drawer).toContainText('reported public');
    // nothing else in the report ties a benchmark to another figure, and the record says so
    await expect(drawer).toContainText('rests on its position on the page alone');

    await drawer.getByRole('button', { name: /Back to Excess over the policy benchmark/ }).click();
    await expect(title).toHaveText('Excess over the policy benchmark, fiscal year to date');
    await expect(drawer.getByRole('button', { name: /Back to/ })).toHaveCount(0);
  });

  test('a figure from the prior report cites the prior report', async ({ page }) => {
    await ready(page, '/cio?tab=performance');
    await page.locator('[data-fig="pension.r.1M@2026-05-31"]').click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toContainText('July 8, 2026 report, data through May 31, 2026');
    await expect(
      drawer.getByRole('link', { name: /CIO Monthly Report \(July 8, 2026\)/ }),
    ).toBeVisible();
  });

  test('the proxy says what it is at every level, and explains nothing it cannot', async ({
    page,
  }) => {
    await ready(page, '/cio?tab=performance&attr=7');
    const table = page.locator('#cio-attr table');
    // no composite prints a ten-year return, so the proxy explains nothing rather than +0.00 pp
    const explained = table.locator('tbody tr', { hasText: 'Explained by the proxy' });
    await expect(explained.locator('td').nth(2)).toHaveText('—');
    await explained.locator('[data-fig="pension.attr.FYTD"]').click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toContainText('proxy estimate');
    await expect(drawer).toContainText('not a Brinson decomposition');
    await expect(drawer.locator('.prov-inputs li')).toHaveCount(4);
  });

  test('a link to an address the page does not have says so', async ({ page }) => {
    await ready(page, '/cio?tab=summary&fig=pension.nothing.here');
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('heading', { level: 2 })).toHaveText(
      'Nothing on this page has that address',
    );
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(drawer).toBeHidden();
  });

  test('every figure on the three detail tabs opens a record', async ({ page }) => {
    for (const tab of ['summary', 'performance', 'positioning']) {
      await ready(page, `/cio?tab=${tab}`);
      const ids = await page
        .locator('[data-fig]')
        .evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute('data-fig')!))]);
      expect(ids.length, tab).toBeGreaterThan(10);
      const drawer = page.getByRole('dialog');
      for (const id of ids) {
        await page.locator(`[data-fig="${id}"]`).first().click();
        await expect(drawer.getByRole('heading', { level: 2 }), id).not.toHaveText(
          'Nothing on this page has that address',
        );
        await page.keyboard.press('Escape');
        await expect(drawer).toBeHidden();
      }
    }
  });
});

test.describe('when each figure was true (desktop project)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) < 768, 'desktop project only');

  test('the tab states that its figures do not share one as-of date', async ({ page }) => {
    await ready(page, '/cio?tab=summary');
    const panel = page.locator('#cio-freshness');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading')).toContainText('Not everything here is as of June 30');
    // the figures span the fund month and the month after it — not the publication date
    await expect(panel.locator('.fresh-lead')).toContainText('June 30, 2026 to July 31, 2026');

    // the subtler mistake is a figure AHEAD of the fund month, so those come first
    const first = panel.locator('tbody tr').first();
    await expect(first).toHaveClass(/fresh-ahead/);
    await expect(panel.locator('tr.fresh-ahead')).toHaveCount(4);
    await expect(panel.locator('tr.fresh-anchor')).toHaveCount(4);
    await expect(panel.locator('tr.fresh-undated')).toHaveCount(2);

    // the market table is a different month from the performance beside it, and says so
    const market = panel.locator('tbody tr', { hasText: 'Market index returns' });
    await expect(market).toContainText('1 month ahead');
    await expect(market).toContainText('not the month the fund performance covers');

    // a lag with no single date says how it is dated instead of showing a number
    await expect(panel.locator('tbody tr', { hasText: 'NCREIF ODCE' })).toContainText(
      'latest available quarter',
    );
  });

  test('an older report shows its own dates, not the latest report’s', async ({ page }) => {
    await ready(page, '/cio?tab=summary&v=2025-10-31');
    const panel = page.locator('#cio-freshness');
    await expect(panel.getByRole('heading')).toContainText('as of October 31, 2025');
    // the curve is that report's observation — using the latest transcription put June 2026 here
    await expect(panel.locator('tbody tr', { hasText: 'Treasury yield curve' })).toContainText(
      'October 31, 2025',
    );
    // and its GDP chart is three months behind the fund figures
    await expect(panel.locator('tbody tr', { hasText: 'Quarterly real GDP' })).toContainText(
      '3 months behind',
    );
  });
});

test.describe('forecast volatility (desktop project)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) < 768, 'desktop project only');

  test('the slide carries both funds’ pages, and never shows an unprinted share as zero', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/deck/#10');
    const slide = page.locator('section[data-id="fvol"]');
    await expect(slide).toBeVisible();
    await expect(page.locator('#fv-page')).toHaveText('Report p. 10');
    await expect(page.locator('#fv-vol')).toContainText('8.9%');
    await expect(page.locator('#fv-vol')).toContainText('8.6%');
    // the sum the report prints beside the figures is shown, not just asserted in a test
    await expect(page.locator('#fv-ar')).toContainText('0.04% + 1.24% = 1.28%');
    // the point of the page: half the capital, most of the risk
    await expect(page.locator('#fv-finding')).toContainText('49% of capital and 78% of forecast');
    // the capital bar prints no label for the overlays sliver, so it is not drawn as 0%
    await expect(page.locator('#fv-bars')).toContainText('not printed');
    await expect(page.locator('#fv-tr-vol .pt')).toHaveCount(13);
    await expect(page.locator('#fv-tr-ar .pt')).toHaveCount(13);
    // the device that differs from the report is named on the slide
    await expect(page.locator('#fv-note')).toContainText('two stacked columns');
    await expect(page.locator('#fv-note')).toContainText('99%');

    // the other fund is its own page, and it forecasts BELOW its benchmark
    await page.locator('#entity-seg .seg-btn[data-v="opeb"]').click();
    await expect(page.locator('#fv-page')).toHaveText('Report p. 15');
    await expect(page.locator('#fv-vol')).toContainText('7.9%');
    await expect(page.locator('#fv-vol')).toContainText('−0.2 pts');
    await expect(page.locator('#fv-ar')).toContainText('0.10% + 0.62% = 0.72%');
    expect(errors).toEqual([]);
  });
});

test.describe('the trend under each figure on Fund at a glance (desktop project)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) < 768, 'desktop project only');

  test('each of the four figures carries its history, with the missing month broken', async ({
    page,
  }) => {
    await page.goto('/deck/#4');
    const tiles = page.locator('#sum-tiles .tile');
    await expect(tiles).toHaveCount(4);
    // one trend per figure, as the report's page 8 has it
    await expect(page.locator('#sum-tiles .spk')).toHaveCount(4);
    await expect(page.locator('#sum-tiles .spk path')).toHaveCount(4);
    // no report covers November 2025, so every trend breaks there and says so
    await expect(page.locator('#sum-tiles .spk .gapmark')).toHaveCount(4);
    await expect(page.locator('#sum-sparknote')).toContainText('No report covers Nov 25');
    await expect(page.locator('#sum-sparknote')).toContainText('never published');
    // the line is drawn in two pieces around the gap, not straight through it
    const d = await page.locator('#sum-tiles .spk path').first().getAttribute('d');
    expect((d!.match(/M /g) ?? []).length).toBe(2);
  });
});

test.describe('quarterly real GDP growth (desktop project)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) < 768, 'desktop project only');

  test('the dashboard charts the report’s own GDP page with its vintage', async ({ page }) => {
    await ready(page, '/cio?tab=markets');
    const fig = page.locator('#cio-macro figure.gdpf');
    await expect(fig.locator('.gdpf-plot')).toHaveAttribute('role', 'img');
    await expect(fig.locator('.gdpf-plot')).toHaveAttribute('aria-label', /Q2 26 1\.5%/);
    await expect(fig.locator('.gdpf-col')).toHaveCount(14);
    // the sign is the side of the zero line and the colour, not the colour alone
    await expect(fig.locator('.gdpf-bar.neg')).toHaveCount(1);
    await expect(fig.locator('.gdpf-bar.last')).toHaveCount(1);
    await expect(fig.locator('figcaption')).toContainText('as FRED showed it on July 31, 2026');
    // the latest report's chart is current, so it carries no "behind" note
    await expect(fig.locator('.gdpf-stale')).toHaveCount(0);
  });

  test('a report whose chart was not redrawn says how far behind it is', async ({ page }) => {
    await ready(page, '/cio?tab=markets&v=2025-10-31');
    const fig = page.locator('#cio-macro figure.gdpf');
    // the December 2025 report prints the chart as FRED stood on July 31, 2025
    await expect(fig.locator('.gdpf-col')).toHaveCount(13);
    await expect(fig.locator('figcaption')).toContainText('July 31, 2025');
    await expect(fig.locator('.gdpf-stale')).toContainText('4 months older');
    await expect(fig.locator('.gdpf-stale')).toContainText('reproduced as printed');
  });

  test('the slide carries it, and every fed field follows the report on screen', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    // an older report inside the dashboard: the whole deck must move to it, not just its labels
    await ready(page, '/cio?v=2025-10-31&slide=12');
    const deck = page.frameLocator('.deck-frame-wrap iframe');
    await expect(deck.locator('.v-report').first()).toHaveText('December 10, 2025');
    await expect(deck.locator('#gplot .gc')).toHaveCount(13);
    await expect(deck.locator('#gcap')).toContainText('FRED as of July 31, 2025');
    await expect(deck.locator('#gcap .stale')).toContainText('4 months older');
    // the net position page is carried for the latest report only — it must not leak into an
    // older report's deck, which is what happened before the feed carried every field
    await expect(deck.locator('section[data-id="netpos"] #np-finding')).toHaveText(
      'Not carried for this report',
    );
    expect(errors).toEqual([]);
  });
});

test.describe('geographic exposure map (desktop project)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) < 768, 'desktop project only');

  test('the slide maps the countries the report names, and follows the filter', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/deck/#13');
    const slide = page.locator('section[data-id="geo"]');
    await expect(slide).toBeVisible();
    await slide.locator('[data-toggle-view="geo"] .seg-btn[data-v="map"]').click();

    const map = page.locator('#geo-map');
    const svg = map.locator('svg.wm');
    await expect(svg).toHaveAttribute('role', 'img');
    // the alternative text carries the figures, so the map is not the only way to read them
    await expect(svg).toHaveAttribute('aria-label', /United States 75\.7%/);
    expect(await map.locator('path').count()).toBeGreaterThan(150);
    await expect(map.locator('path[class]')).toHaveCount(10);
    await expect(map.locator('.bdg')).toHaveCount(10);
    // the legend states the class breaks rather than leaving a shade to be guessed
    await expect(map.locator('.wm-leg')).toContainText('under 1%');
    await expect(map.locator('.wm-leg')).toContainText('10% and over');
    await expect(map.locator('.wm-leg')).toContainText('not named in the report');
    // what the report does not name is missing, not zero, and the page says so
    await expect(map.locator('.wm-cap')).toContainText('missing rather than zero');
    // the method note is the map's, not the bar chart's
    await expect(page.locator('#geo-note')).toContainText('Area is not value');

    // the group filter takes the map with it, and badges keep the rank the table shows
    await slide.locator('#geo-filter .seg-btn[data-v="em"]').click();
    await expect(map.locator('.bdg:not(.off)')).toHaveCount(5);
    await expect(map.locator('path[class].off')).toHaveCount(5);
    await slide.locator('#geo-filter .seg-btn[data-v="all"]').click();
    await expect(map.locator('.bdg:not(.off)')).toHaveCount(10);

    // going back to the chart restores its own note
    await slide.locator('[data-toggle-view="geo"] .seg-btn[data-v="chart"]').click();
    await expect(page.locator('#geo-note')).toContainText('fixed 0–80% scale');
    expect(errors).toEqual([]);
  });

  test('the dashboard panel shows the same map above the table', async ({ page }) => {
    await ready(page, '/cio?tab=positioning');
    const fig = page.locator('#cio-geo figure.wmap');
    await expect(fig.locator('svg.wmap-svg')).toHaveAttribute('role', 'img');
    await expect(fig.locator('.wmap-bdg')).toHaveCount(10);
    await expect(fig.locator('path[class]')).toHaveCount(10);
    await expect(fig.locator('figcaption')).toContainText('area is not value');
    await expect(fig.locator('figcaption')).toContainText('missing rather than zero');
    // the badge numbers are the table's row order
    const first = await fig.locator('.wmap-bdg text').first().textContent();
    expect(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']).toContain(first);
    await expect(page.locator('#cio-geo tbody tr').first()).toContainText('United States');
  });
});

test.describe('the deck prints as a publishable document (desktop project)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) < 768, 'desktop project only');

  test('a cover, then every slide followed by the figures behind it', async ({ page }) => {
    await page.goto('/deck/');
    await page.locator('.slide').first().waitFor();
    await page.emulateMedia({ media: 'print' });
    const doc = await page.evaluate(() => {
      (window as unknown as { __buildPrintout: () => void }).__buildPrintout();
      const order = [...document.querySelectorAll('.stage > .slide, .stage > .pp')].map((el) =>
        el.classList.contains('pp-data')
          ? 'figures'
          : el.classList.contains('pp-variant')
            ? 'variant'
            : 'slide',
      );
      const pages = [...document.querySelectorAll('.pp-data')].map((el) => el.textContent ?? '');
      const variants = [...document.querySelectorAll('.pp-variant')].map(
        (el) => el.querySelector('.pp-tag')?.textContent ?? '',
      );
      return {
        order,
        cover: document.querySelector('.slide.cover')?.textContent ?? '',
        pages,
        variants,
      };
    });
    // the deck's own cover and contents slides open the document; every other slide is
    // followed by its tab snapshots and its figures page
    expect(doc.order.slice(0, 2)).toEqual(['slide', 'slide']);
    expect(doc.order.filter((p) => p === 'slide')).toHaveLength(14);
    expect(doc.order.filter((p) => p === 'figures')).toHaveLength(12);
    // a tab that draws a different picture is its own page, right after its slide
    expect(doc.variants).toEqual([
      'Tab: excess vs. benchmark',
      'Tab: sorted by return',
      'Tab: map',
    ]);
    doc.order.forEach((p, i) => {
      if (p === 'variant') expect(doc.order[i - 1]).toBe('slide');
      if (p === 'figures') expect(['slide', 'variant']).toContain(doc.order[i - 1]);
    });
    expect(doc.cover).toContain('not an official LACERA publication');
    // the cover's dates are a labelled colophon: label and value are separate cells
    expect(doc.cover).toContain('Fund figures through');
    expect(doc.cover).toContain('June 30, 2026');
    expect(doc.cover).toContain('Board of Investments');
    // each figures page carries the numbers behind its slide, with source and data labels
    expect(doc.pages[1]).toContain('Indicative contribution');
    expect(doc.pages[1]).toContain('$45,687');
    expect(doc.pages[1]).toContain('Data labels: reported_public · calculated');
    expect(doc.pages[4]).toContain('Net flow');
    // the net position page names its own scope and keeps the two books apart
    expect(doc.pages[5]).toContain('LACERA Pension Plan');
    expect(doc.pages[5]).toContain('Fiscal year, summed');
    expect(doc.pages[5]).toContain('Investment book market value');
    // forecast volatility sits between the distribution and the market table
    expect(doc.pages[7]).toContain('Share of forecast risk');
    expect(doc.pages[7]).toContain('Allocation + selection (calculated)');
    expect(doc.pages[8]).toContain('U.S. Large Cap');
    // the macro page is its own slide now, and carries the GDP quarters with their vintage
    expect(doc.pages[9]).toContain('Real GDP, quarterly, annualised');
    expect(doc.pages[9]).toContain('Macro indicator');
    expect(doc.pages[11]).toContain('Risk system onboarding');
    // and they are landscape slide-sized pages, like the slides
    const size = await page.locator('.pp-data').first().boundingBox();
    expect([Math.round(size!.width), Math.round(size!.height)]).toEqual([1280, 720]);
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
    await expect(page.locator('#dash-link')).toHaveAttribute('href', '../#/cio?tab=summary');
    await expect(page.locator('#dash-link')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('the slides are presented inside the dashboard, fed by the report on screen', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    // opening the tab shows the slides: they live inside the dashboard, no click out
    await ready(page, '/cio');
    await expect(page.getByRole('tab', { name: 'Slides' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const deck = page.frameLocator('.deck-frame-wrap iframe');
    await expect(deck.locator('#s1-title')).toContainText('Executive read');
    // the page's arrow keys step the slides without clicking into them: the deck opens on its
    // cover, so two presses reach the executive read and the next two build it
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
    await expect(deck.locator('#counter')).toHaveText('3 / 14');
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
      .getByRole('link', { name: /Slide 5/ })
      .click();
    await expect(page).toHaveURL(/slide=5/);
    await expect(page.getByRole('tab', { name: 'Slides' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const deck = page.frameLocator('.deck-frame-wrap iframe');
    await expect(deck.locator('#counter')).toHaveText('5 / 14');
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
    // the slides present the imported figures, locked to the feed's one fund
    const deck = page.frameLocator('.deck-frame-wrap iframe');
    await expect(deck.locator('.v-report').first()).toContainText('Workstation dataset');
    await expect(deck.locator('#entity-seg')).toBeHidden();
    // the feed round-trips the latest public vintage, so the headline tile matches it
    await page.getByRole('tab', { name: 'Summary' }).click();
    await expect(page.locator('.grid-kpi .stat-value').first()).toHaveText('$93.9B');
  });

  // audit 2026-09-18, findings 1 and 2
  test('a feed missing figures says so, and keeps its synthetic label on page and slides', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    const csv = readFileSync(CIO_FEED_CSV, 'utf8')
      .split(/\r?\n/)
      .filter((l) => !/,cio_monthly,DEMOFUND,(hist_count|hist_stat|flow|cash),/.test(l))
      .join('\n')
      .replaceAll(',reported_public,', ',synthetic,');
    await ready(page, '/import');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'demo_missing.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await page.getByRole('button', { name: 'Apply this dataset' }).click();
    await expect(page.getByText(/Import applied/)).toBeVisible();
    await page.goto(hash('/cio?v=workstation&tab=summary'));
    await expect(page.locator('.about-figures')).toContainText('synthetic');
    await expect(page.locator('.grid-kpi')).toContainText('cash and equivalents not supplied');
    const read = page.locator('#cio-read');
    await expect(read).toContainText('June flows were not supplied');
    await expect(read).toContainText('The return distribution was not supplied.');
    await expect(read).not.toContainText('$0M');
    await page.getByRole('tab', { name: 'Slides' }).click();
    const deck = page.frameLocator('.deck-frame-wrap iframe');
    await expect(deck.locator('#deck-origin')).toContainText(
      'workstation dataset (DEMOFUND), not published',
    );
    await expect(deck.locator('.slide .src .cls').first()).toHaveText('synthetic');
    expect(pageErrors).toEqual([]);
  });

  test('a template without flows shows them as not supplied on the slides', async ({ page }) => {
    const csv = readFileSync(CIO_TEMPLATE_CSV, 'utf8')
      .split(/\r?\n/)
      .filter((l) => !/^allocation,(pension|opeb),[^,]+,flow,/.test(l))
      .join('\n');
    await ready(page, '/cio?tab=summary');
    await page.locator('.vs-file input[type="file"]').setInputFiles({
      name: 'no_flows.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await expect(page).toHaveURL(/v=file/);
    await expect(page.locator('#cio-read')).toContainText('June flows were not supplied');
    await page.goto(hash('/cio?v=file&tab=slides&slide=7'));
    const deck = page.frameLocator('.deck-frame-wrap iframe');
    await expect(deck.locator('#al-finding')).toContainText('flows not supplied');
  });

  // audit 2026-09-18, finding 4
  test('July shows a new fiscal year, not a fall in FYTD', async ({ page }) => {
    await ready(page, '/cio?v=2025-07-31&tab=summary');
    await expect(page.locator('.grid-kpi')).toContainText('new fiscal year');
    await expect(page.locator('.change-list .change-row').first()).toContainText(
      'New fiscal year: FYTD restarted July 1',
    );
    await expect(page.locator('.change-list')).not.toContainText('−8.7 pp');
  });

  test('the two-minute read answers the standing questions from the data', async ({ page }) => {
    await ready(page, '/cio?tab=summary');
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
