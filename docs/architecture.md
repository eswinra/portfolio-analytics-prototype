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
