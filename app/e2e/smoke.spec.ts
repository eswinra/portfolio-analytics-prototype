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
  '/acfr',
  '/cio',
  '/cio?tab=summary',
  '/cio?tab=performance',
  '/cio?tab=positioning',
  '/cio?tab=markets',
  '/cio?tab=explore',
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

test.describe('geographic exposure map (desktop project)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) < 768, 'desktop project only');

  test('the slide maps the countries the report names, and follows the filter', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/deck/#11');
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
    expect(doc.order.filter((p) => p === 'slide')).toHaveLength(12);
    expect(doc.order.filter((p) => p === 'figures')).toHaveLength(10);
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
    expect(doc.pages[7]).toContain('U.S. Large Cap');
    expect(doc.pages[9]).toContain('Risk system onboarding');
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
    await expect(deck.locator('#counter')).toHaveText('3 / 12');
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
    await expect(deck.locator('#counter')).toHaveText('5 / 12');
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
