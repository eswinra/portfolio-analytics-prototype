# Web Prototype Architecture

## Stack

Vite 5 + React 18 + TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`),
Zod at the import boundary, PapaParse for CSV, Recharts for the two charts, Vitest for tests,
ESLint (flat) + Prettier. No backend, no secrets, no telemetry, no external fonts/CDNs — the
built site makes zero network requests.

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

- Imports parsed in-browser (FileReader); no network transmission; no storage.
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
  three demonstrated controls. CI (pages.yml) gates deploy on lint, format, tests, and a
  production-dependency audit; Playwright runs locally by design (no browsers in CI).
- Dev-server `fs.allow` is narrowed to the app and `data/sample`, keeping `reference/`
  outside every served root.
