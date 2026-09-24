# Web Prototype Architecture

## Stack

Vite 5 + React 18 + TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`),
Zod at the import boundary, PapaParse for CSV, SheetJS CE for workbooks (bundled, loaded only
when a workbook is opened), Recharts for the two charts, Vitest for tests, ESLint (flat) +
Prettier. No backend, no secrets, no telemetry, no external fonts/CDNs — the built site requests
nothing but its own files.

## Layering

```
data/sample/demofund_export_v1.csv        canonical fixture (generated from the workbook)
        │  (?raw import at build time — no duplication)
        ▼
src/lib/contract/   schema.ts (Zod, enums)  parse.ts (V01–V18 validator, all-or-nothing)
        ▼
src/lib/dataset/    model.ts (typed Dataset built from records)  useDataset.tsx (state)
        ▼
src/lib/finance/    returns / contribution / allocation / staleness  — pure, no React, tested
        ▼
src/views + src/charts + src/components   presentation only; no finance math in components
```

User imports go through exactly the same parser as the bundled fixture; a rejected file leaves
state untouched and yields a row-level report.

## Revision 2 additions (post-review, 2026-08-06)

- **IPS policy pack** (`src/fixtures/policyPack.ts`): `reported_public` reference data quoted
  from both public LACERA Investment Policy Statements (restated June 12, 2024) with explicit
  **min/target/max** bands (the Pension Cash +2/−1 asymmetry is the reason ± half-widths are
  banned), dated ½-step transition targets, and benchmark formulas with lag months as structured
  metadata. Surfaced as collapsed audit references on the Methodology view (the dedicated Policy
  page was removed in revision 5.5 — the PA team owns the IPS, so a restatement earned no
  navigation slot); Allocation measures the synthetic portfolio against the real Pension bands
  and shows distance-to-boundary as staff analytics.
- **Daily proxy pulse**: `src/lib/finance/readThrough.ts` computes the policy-weighted proxy
  read-through (Σ ½-step weight × proxy daily return) with coverage expressed in policy-weight
  terms; unpriced classes are excluded and listed, never imputed as zero. Labeled
  `proxy_estimate`, never portfolio performance. A generated plain-text daily brief
  (`src/lib/dataset/brief.ts`) supports the EOD email/Teams workflow via copy-to-clipboard.
- **Integrity hardening**: multi-entity files rejected (V17); monthly chart series joined by
  month-end date, never array position; period excess computed only on matched spans; derived
  fields (`over_under_pct`, totals) recomputed from primitives; partial sleeve totals suppressed;
  missing-flagged values discarded at parse; V10 scoped to return/contribution records; a
  derived exceptions queue (checks + market states + range breaches + span mismatches).
- **Preflight import**: files are validated and summarized (rows scanned, entity, errors,
  warnings, downloadable error report) and applied only on explicit confirmation.
- **A11y/UX**: skip link focuses main directly (hash-router safe); scroll/focus reset on route
  change; expandable monthly data table under the growth chart; mobile card layout for the
  allocation table; scrollable single-row mobile nav; confidentiality warning on Import.

## Notable decisions

- **Relative base + hash routing** (revision of the discovery-stage `basename` idea): `base: './'`
  with `HashRouter` makes the build path-independent — it works on a GitHub Pages *project* site,
  a local file server, or any subpath with no repo-name coupling and no 404-rewrite hack. Deep
  links (`…/#/contribution`) refresh correctly. Trade-off: URLs carry `#`, acceptable for a demo.
- **Fixture via `?raw` import**: `data/sample/` stays the single source of truth; Vite inlines
  the CSV at build time (~60 KB), so runtime needs no fetch and file:// serving still works.
- **Checks travel with the data**: workbook control results are records in the contract, so the
  web app displays the same control state the analyst saw in Excel — no re-derivation drift.
- **ACFR workflow data is app-bundled** (`src/fixtures/acfrWorkflow.ts`), not part of contract
  1.x: the import path is deliberately confined to performance records. Adding tracker records
  is a documented candidate for schema 1.1.
- **Chart palette validated** with the dataviz six-check validator: series pair `#3a6ea5` /
  `#c78f2e` (benchmark also dash-encoded and direct-labeled; the amber's <3:1 surface-contrast
  WARN is relieved by direct labels plus the adjacent table), contribution polarity pair
  `#3a6ea5` / `#b4562a` (all checks pass). Status colors are icon + text + color, never color
  alone.
- **Chunk split** (`react`, `charts`, app) keeps the initial parse cost reasonable
  (gzip ≈ 54 + 105 + 42 KB).

## Accessibility

Semantic tables with captions and column headers; skip link; `aria-label` chart summaries with
data tables adjacent; keyboard-reachable controls with visible focus (`:focus-visible` outline);
`aria-live` import outcomes; `aria-pressed` filter buttons; no color-only encoding; system fonts
with tabular numerals for figures.

## Security posture

- Imports parsed in-browser; no network transmission; no storage.
- Workbooks (`lib/workbook.ts`): one sheet is turned into the CSV text Excel would write and goes
  through the same validator as a CSV — there is no second path for the data. Stored values, not
  displayed ones; dates as calendar dates; formulas never calculated (a file not saved by Excel)
  and cells showing Excel errors are refused with the cells named, never read as blanks. SheetJS
  CE 0.20.3 comes from its official tarball (the npm registry's `xlsx` stops at 0.18.5, which
  has published advisories), pinned by integrity hash, bundled as its own chunk (~163 KB gzip)
  and fetched from the site only on first use. Workbooks up to 10 MB.
- Imported strings rendered as text nodes only (React default escaping; no `dangerouslySetInnerHTML`).
- CSV cell values are never re-emitted into downloadable CSV without escaping (no export path in v1).
- Bounds: 5 MB / 20,000 rows per import.
- CI workflow uses minimal Pages permissions and no secrets.

## Revision 7 additions (2026-08-13)

- **Contract 1.3**: six record types — `recon_value` + `tolerance_definition` (Reconciliation
  tab; variance computed, tolerance-as-data; V05 natural key gains source_name for recon rows
  only; V23), `acfr_section_status` + `acfr_artifact_link` (ACFR board as contract records in
  a single-entity tracker file; V22), `pm_commitment` + `pm_capital_account` (private-markets
  primitives; ratios computed in `lib/finance/privateMarkets.ts`).
- **New surfaces**: Recon tab (`views/ReconView.tsx`), ACFR readiness board with soft
  demonstration-only roles (`views/AcfrView.tsx` + `lib/dataset/acfr.ts`), private-markets
  panel on Performance, period-toggle chain-link reconciliation on Performance, risk lenses +
  rolling correlation on Trends (min-history gated), per-view freshness lines, enriched brief.
- **Architecture diagram**: the PA workflow tree rendered as a native inline SVG
  (`components/ArchitectureDiagram.tsx`) on Methodology — token-aligned with the code,
  LIVE/TARGET chips marking current vs target state; no raster asset, no network request.

## Revision 7.1 (2026-08-13)

- Architecture diagram removed from the public Methodology page at the owner's decision
  (`ArchitectureDiagram.tsx` deleted); the workflow tree remains an internal working
  reference outside the repo.
- ACFR tie-out items (the page-level crosswalk) nested under their section cards
  (Investment → INV; Financial, Financial Notes, RSI and SI → FIN; Statistical → STAT);
  the separate crosswalk register removed, QA controls kept as a cross-section register.

## Revision 8 (2026-08-13) — LACERA redesign

- Adopted the design-handoff redesign (`design_handoff_lacera_portfolio_analytics/`):
  seven-view IA (Overview, Performance, Allocation, Funded Status, Risk & Compliance,
  Holdings & Managers, ACFR Workflow) on the LACERA navy ramp with Mulish, quoting
  published FY2025 figures (2025 PAFR/ACFR, IPS restated June 12, 2024) with per-panel
  citations (`fixtures/published.ts`, `config.ts` for defaultEntity/nearBoundPp/showSources).
- Mulish is self-hosted via `@fontsource/mulish` — the built site still makes zero network
  requests (the design's Google Fonts link was deliberately not used).
- Synthetic-workflow views (Trends, Exceptions, Recon, Import, Methodology) retired from
  navigation with legacy-route redirects; the contract engine (`lib/contract`, `lib/dataset`,
  `lib/finance`), data fixtures, Python generators, and the full test suite remain intact.
  The ACFR view still builds its board from the contract tracker file.

## Revision 9 (2026-08-13) — trust & controls

Context: revisions 8.1/8.2 restored the synthetic workflow surfaces as a footer-linked demo
and then split the shell into Dashboard (published figures) and Workstation (synthetic
contract pipeline) modes. Revision 9 hardens that architecture per an external audit:

- **Entity registry** (`app/src/fixtures/entityRegistry.ts`): the only mapping from an
  entity id to its legal fund and policy pack. `checkEntityMatch` gates both staging and
  apply; policy identity is never inferred from entity-name text. Tracker entities are
  registered but not importable into a fund workspace.
- **Computed gates, not copy**: ACFR section completion (`lib/dataset/acfr.ts`
  `sectionEligibility`), methodology fail-closed benchmark comparison and the demonstrated
  publication gate (`lib/dataset/model.ts` `publishEligible`/`publishBlockers`) are all
  derived from the loaded dataset, so imported files exercise the same controls as fixtures.
- **Source registry** (`app/src/fixtures/sources.ts`): typed citation records rendered by
  `SourceLine`; entries carry a URL only when a stable public one exists.
- **Verification layers**: vitest unit + jsdom component tests (`src/**/*.test.ts(x)`), and
  a Playwright smoke suite (`app/e2e/`, `playwright.config.ts`) run against the production
  build at desktop and 320/360/375 widths — per-route overflow probe, axe checks, and the
  three demonstrated controls. CI (pages.yml) gates deploy on lint, format, tests, a
  production-dependency audit, the build (which type-checks `app/scripts` too) and, since the
  September 18, 2026 audit, the Playwright suite on the built site; the full dependency audit
  (development tooling included) is reported in each run's summary without blocking a release.
  Visual baselines stay local (platform-specific; `playwright.visual.config.ts`).
- Dev-server `fs.allow` is narrowed to the app and `data/sample`, keeping `reference/`
  outside every served root.

## Revision 16 (2026-09-17) — less noise, motion that shows change, slides fed by the dashboard

Conventions every dashboard view now follows:

- **One page statement** (`components/page.tsx`): `PageMeta` sets the classification that applies
  unless a figure is marked and the sources that cover the whole page; `AboutFigures` is the one
  line under the tabs that says what the figures are, with dates and the classification legend
  behind it; `PageSources` lists page-wide sources once at the foot. `ClassBadge` renders only
  when a figure's classification differs from the page's, and `SourceLine` renders a "Source"
  chip that opens the full citation and omits sources the page already lists. Outside `PageMeta`
  (the workstation) every badge and citation renders where it is used, as before.
- **Panels** (`components/ui.tsx`): a title with at most one muted line under it; `note` is the
  one visible takeaway; `method` holds the calculation and caveats behind "How this is
  calculated"; citation chips, slide links and the method toggle share one footer row; a ⋯ menu
  (`components/PanelMenu.tsx`) copies the table as CSV or a link to the panel (`?p=`).
- **Sub-tabs** (`components/SubTabs.tsx`) split the long views, kept in the address (`?tab=`);
  a jump to a panel on another sub-tab opens that tab first.
- **Motion** (`lib/motion.ts`, `components/ChartKit.tsx`, CSS under
  `prefers-reduced-motion: no-preference`): charts draw in the first time they scroll into view,
  bars and lines move to new values when the fund, report or range changes, headline figures
  that change flash once, and disclosures open smoothly. Nothing counts up — a displayed number is
  always a reported or calculated value. Under reduced motion everything renders settled, and the
  Playwright configs run with reduced motion so tests and baselines read the settled page.
- **Interaction**: pointer and arrow-key tooltips (one tab stop per chart), legend keys that hide
  a series, linked highlighting between a table and its chart, the CIO report slider, the
  Economy what-if sliders and a zoomable history chart. Every value a tooltip shows is also in a
  table or in text on the page.
- **Slides inside the dashboard**: see `docs/cio-monthly.md`, "The dashboard feeds the slides".
- **Provenance drawer** (`lib/provenance.ts`, `components/Provenance.tsx`): every figure on the
  CIO Monthly Summary, Performance, Positioning, Markets & items, Explore and Compare tabs has an
  address and opens a record of its source page, classification, calculation (each input opens its
  own record) and period. A Compare change resolves through `compareReports`, the function the
  table uses. Market and macro figures have addresses outside either fund (`market.…`,
  `macro.…`), and the FRED source records live in `lib/cioSource.ts` with the report's. The
  library is pure and holds the calculations the tables show, so the two cannot disagree; the
  component wraps a figure in `<Fig id>` and renders plain text outside the provider. See
  `docs/cio-monthly.md`, "Where a figure came from".
- **Cell-level trace** (`lib/cioPackage.ts` `FigureTrace`, `lib/workbook.ts` `SheetOrigin`): a
  template workbook's Export tab is read with its formulas, and every figure keeps its Export row,
  its cell and the input cell it was typed in; the provenance drawer and the Monthly run show them.
  See `docs/cio-template.md`, "Every figure traced to its cell".
- **Monthly run** (`views/MonthlyRunView.tsx`, `lib/reconcile.ts`, `/run`, the Workstation's
  first view): one template file from the file to the slides — read, the template's checks,
  reconciliation (same-period pairs, compounding from the prior reports within the rounding of the
  printed figures, and a tie-out to the published report when there is one), the dashboard, the
  slides and their PDF. File opening is shared with the CIO tab (`useTemplateOpener` in
  `lib/cioFile.tsx`). See `docs/cio-template.md`, "The Monthly run".
- **Cross-filter** (`lib/crossFilter.ts`): one category, carried in the address (`cat`), is
  followed on CIO Monthly's Performance, Positioning and Explore sub-tabs; the panels reuse
  `components/explore/CategoryTrend.tsx`, which now draws the return history, the weight history
  or both (`show`). See `docs/cio-monthly.md`, "One choice, followed across…".
- **Saved views** (`lib/savedViews.ts`, `components/SavedViews.tsx`, the title band on every
  dashboard view): a view is already its address, so saving one stores that address and a name in
  this browser's local storage — the site's only use of browser storage. No figure, file or
  dataset is stored, and nothing is sent anywhere. Three rules:
  - **A saved view says which report it shows.** A view of the latest CIO report is saved either
    following the latest report or pinned to the one on screen (`v=` added), and the list says
    which: "follows the latest report" or "fixed to the August 12, 2026 report". A view never
    changes reports without saying so.
  - **A view of a template file or an imported dataset cannot be saved.** Neither is stored, so
    the address would reopen to a different report than the one saved; the menu says so.
  - **What comes back from storage is checked like any other input** (`parseSavedViews`): the
    record must be version 1, and each entry must be a known dashboard address with a name and a
    date. Anything else — a script URL, another site, a malformed entry — is dropped and counted,
    never followed.

  Up to 24 views; saving an address already saved renames it; a deleted view can be put back.
  If the browser blocks storage (a private window, a policy), the list lasts until the page is
  closed, and says so. The route and sub-tab lists moved to `lib/routes.ts`, so the navigation,
  the sub-tab bars and the names offered for saved views read one list.
- **Exception Center** (`lib/exceptionCenter.ts`, `views/ExceptionCenterView.tsx`, `/exceptions`):
  policy ranges, report-specific data conditions and the changes to explain, for both funds in
  the report on screen; each item links to its panel with the provenance record open. The changes
  come from the same `cioChanges` the CIO "What changed" panel uses. The synthetic pipeline's
  queue moved to Workstation › Data quality (`/data-quality`).

## Revision 32 (2026-09-20) — geography as a map, projected at build time

The geographic exposure map ships no mapping library and makes no request at run time. Natural
Earth's Admin 0 countries at 1:110m (public domain) are projected once by
`tools/make_world_paths.py` — Robinson projection, Douglas-Peucker simplification, integer
coordinates — into `app/src/fixtures/worldMap.data.ts`, about 44 KB of SVG path data that is
reviewable in the repository like any other fixture.

- **Where the rules live.** `app/src/lib/geoMap.ts` holds the pure parts: the class breaks, the
  report-name to country-code lookup, the badge collision solver and the alternative text. It is
  unit-tested on its own. `app/src/components/WorldMap.tsx` renders and holds no logic.
- **Two generated blocks in the deck.** `public/deck/index.html` is one self-contained file and
  cannot import anything, so `npm run sync:deck` now writes two marked blocks into it: the existing
  per-report `SHARED DATA` (declared `let`, replaced when the dashboard feeds the deck another
  vintage) and a new `WORLD OUTLINES` block (declared `const`). The outlines are the same for every
  report, so they are kept off the per-report feed. Each block has its own drift test.
- **Two copies, held together by tests.** The deck repeats the class breaks, the legend labels and
  the badge radius in its own inline script. Three unit tests read the deck's HTML and fail if any
  of them stops matching `geoMap.ts`, so a reader cannot find different breaks on the slide than on
  the dashboard.
- **Generated data is prettier-ignored.** `worldMap.data.ts` joins the two macro fixtures in
  `app/.prettierignore`: one long path string per country is the point, and reformatting it would
  put the file permanently at odds with its generator.

## Revision 33 (2026-09-20) — a vintage that is identified, and two bugs it uncovered

Adding the report's GDP chart turned up two defects that had already shipped, both of the same
shape: state that had to be listed in two places, with nothing checking the two lists agreed.

- **The embedded feed dropped fields.** `public/deck/index.html` declares each data field with
  `let` and the dashboard's feed assigns them one by one. `NETPOS` was added to the generated block
  in Revision 31 but never to that assignment, so inside the dashboard an older report showed the
  *latest* report's net position page under its own date — exactly the vintage mixing the project's
  rules forbid. Both `NETPOS` and `GDP` are now read, both are handed on to a presenter window, and
  a unit test walks `DECK_FIELDS` and fails if any field is missing from either place.
- **The speaker notes were indexed by position.** `NOTES` was an array written when the executive
  read was slide 1. Revision 26 put a cover and a contents page in front of it and Revision 31
  added the net position page, so since Revision 26 the presenter view and every printed figures
  page had carried the note for the wrong slide, and the last two slides had none. The notes are
  now keyed by the slide's own `data-id`, the heading is derived from the slide's title and
  position instead of typed into the note, and a unit test fails if a slide has no note or a note
  has no slide.

The GDP data itself is a vintage that is identified rather than assumed — see `docs/cio-monthly.md`,
"The economy around the fund". The identification is only sound because it is over-determined:
thirteen or fourteen printed figures must all match to a tenth before a month end is accepted.
