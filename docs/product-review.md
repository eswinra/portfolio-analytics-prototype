# Product Review — PA-team presentation audit (stage 6)

Reviewed against the production build served under a simulated GitHub Pages subpath
(`…/portfolio-analytics-prototype/`), desktop and mobile viewports, 2026-08-04.

## Audit answers

| Question | Result | Evidence |
|---|---|---|
| Does the first view answer its decision question in two minutes? | **Yes** | Overview = 4 tiles (FYTD vs benchmark, excess, reconciliation status, checks 10/2/0) + one period table + one chart + data-trust strip. No scrolling needed for the headline on a 1280×800 screen. |
| Are reported public / synthetic / proxy / calculated / stale / missing impossible to confuse? | **Yes** | Persistent disclaimer band; `synthetic` badges on tiles; classification census view; cited-public table (8 rows, page-level citations, real entity names); state pills icon+text+color; the two deliberately degraded proxies render distinctly (✕ missing vs △ stale) after fix M1. |
| Every date, period, benchmark, unit, source legible? | **Yes** | Every period row shows start → end; as-of in masthead + per view; benchmark labeled synthetic with method note; units on all $ figures; source (fixture vs import) shown. |
| Do displayed calculations reconcile to the workbook/fixtures? | **Yes** | On-screen: contribution 3.67 / 0.07 / 0.52 / −0.15 / 0.00 / 0.00, arithmetic 4.11%, chain-linked 4.17%, residual 0.05% PASS — identical to the audited workbook (`docs/workbook-qa.md`); unit test locks fixture ↔ display equivalence. |
| Visuals readable at presentation size, add analytical meaning? | **Yes** | Two charts only, both validated palettes with direct labels; everything else compact tables. |
| Drill-downs, import errors, empty states, keyboard, contrast, responsive? | **Yes with notes** | ACFR filter works with `aria-pressed` (verified); malformed-file drop E2E produced a correct V03 row-level rejection with state untouched; mobile 375px: no body-level horizontal scroll, tiles stack, tables scroll internally; skip link + `:focus-visible` outlines + `aria-live` outcomes present. Residuals R1–R2 below. |
| Is the ACFR workflow content operationally useful? | **Yes, as a concept demo** | Real crosswalk structure (page → source → tie-out → test), readiness/blocked KPIs with correct denominators, status filtering. Statuses/dates are labeled illustrative; owners intentionally TBD. |
| Any copy implying official status, endorsement, current performance, or audit assurance? | **None found** | Disclaimer band on every view; footer; per-view synthetic notes; README statement; tile badges. |

## Findings

| # | Severity | Finding | Disposition |
|---|---|---|---|
| M1 | Medium | The stale-demo proxy (DEMO-USD) rendered **missing**, indistinguishable from the missing-demo proxy, contradicting the on-screen note ("one missing, one stale") | **Fixed**: daily staleness threshold corrected to 3 calendar days (Friday-close-viewed-Monday is current); strip logic gives stale precedence over missing-at-end; tests updated; verified in the rebuilt bundle |
| L1 | Low | Benchmark line color `#c78f2e` is below 3:1 contrast against the surface (validator WARN) | **Accepted with relief**: dashed-line secondary encoding, direct end labels, and the adjacent period table satisfy the validator's relief requirement; documented in `docs/architecture.md` |
| L2 | Low | Hash-based URLs (`#/contribution`) look less clean than path routing | **Accepted**: deliberate trade-off for path-independent static hosting (DECISIONS #11) |
| L3 | Low | ACFR completion figures could be mistaken for real progress | **Accepted with mitigation**: view header and tile subtext state "illustrative demo values"; denominator note explains the corrected count |

## Residual items (not fixable in this stage, disclosed)

- R1: The import **success** path is verified by unit tests (V17 warning flow included) but was not
  E2E-exercised in the browser (would require scripting a 60 KB file drop); the reject path was
  E2E-verified.
- R2: Keyboard traversal was verified structurally (semantic elements, skip link, visible focus
  styles, `aria-pressed`/`aria-live`); a full manual tab-order walkthrough on physical hardware
  remains for the live demo rehearsal.

## Demo route decision

A separate guided demo route was **not** added: the seven-view navigation already sequences the
story, and an extra route would dilute the "smallest maintainable prototype" principle. A timed
walk-through lives in `docs/demo-script.md` instead.

## Re-verification after fixes

Prettier ✓ · ESLint ✓ · `tsc` strict ✓ · 49/49 tests ✓ · production build ✓ · rebuilt bundle
re-checked in the browser (states render ✓ current / △ stale / ✕ missing; zero console errors).

## Revision 10 audit — 2026-09-06

Live site audited as deployed (`https://eswinra.github.io/portfolio-analytics-prototype/`):
desktop 1280×800, phones 375/360/320, print media; every route; console and network; then a
code-level review of the financial logic, provenance, and accessibility. Renders:
`outputs/renders/audit/` (before) and `outputs/renders/audit_after/` (after).

### Baseline

All gates green at the start (Prettier, ESLint, tsc, Vitest 126/126, build, Playwright 45/45,
axe on `/` and `/import`); zero console errors; single origin, no external requests.

### Findings and dispositions

| # | Severity | Finding | Disposition |
|---|---|---|---|
| H1 | High | The three ACFR deep links (`ACFR_EQ/FI/FEES`) anchored `#page=` on the printed page number; the FY2025 file's front matter puts printed page *n* at PDF page *n*+2, so every link opened the wrong table (“p. 114” opened the rates-of-return schedule) | **Fixed**: `acfrPage(printed)` in `app/src/fixtures/sources.ts`; verified against the reference PDF's page footers |
| H2 | High | The Overview KPI tiles — the two-minute read — carried no classification, source, or valuation date | **Fixed**: `reported_public` badge + source line under the tile row (the funded ratio's June 30, 2024 valuation named); source lines added to the Overview changes panel, the Policy Monitoring compliance table, and the IPS tables |
| H3 | High | Every published figure is an untested literal with derived prose beside it (“6.4% of the fund”, “within their IPS ranges”, “exceeded the assumed rate at every horizon”) | **Fixed**: `published.test.ts` (41 tests) checks statement identities, tile/flow agreement, mix/IPS sums, fee arithmetic, and each sentence; the assumed-rate sentence is computed against the decade-high rate from ACFR pp. 112–113 (7.25%/7.00% Pension, 6.00%/6.25% OPEB) |
| H4 | High | The new test surfaced two transcription discrepancies: the OPEB cumulative-NII series steps −$41.0M in FY2023 against $248M of NII (the FY2024–FY2025 steps tie); the OPEB Real Assets ½-step sub-rows sum to 15.5% vs the category's 16.5% | **Disclosed 2026-09-06, resolved 2026-09-07** against the source documents (see “Open items — resolved”): the cumulative-NII values were a transcription error (FY2021/FY2022 swapped by a text-order read of the PAFR chart) and are corrected from the printed bar positions; the ½-step sub-rows are printed that way in the OPEB IPS itself and stay as printed with an on-screen note |
| H5 | High | Contribution reconciliation (arithmetic sum vs chain-linked return, 10 bps tolerance) was computed in the model but never displayed and did not gate publication | **Fixed**: panel on the Reconciliation view (fixture: 4.11% vs 4.17%, residual 5.2 bps, PASS); a FAIL is a publication blocker |
| H6 | High | A proxy's “daily” return divided the last two *present* closes, so a missing close produced a multi-day move labelled daily (`model.ts`); `dailyReadThroughSeries` did the same | **Fixed**: `lastDailyReturn()` requires the immediately preceding observation (null otherwise → excluded from the read-through, coverage falls); the series builder skips gaps; unit tests added |
| M1 | Medium | The Exceptions caption said no `reported_public` row feeds a calculation; the 16 IPS `policy_target` rows set the bands the allocation checks test against | **Fixed**: the caption states what the bands do and what reported_public never enters (returns, contribution, reconciliation) |
| M2 | Medium | “Show N passing controls” listed every check | **Fixed** |
| M3 | Medium | Mobile: four-row nav; the Fund-vs-benchmark and Holdings tables clipped their last column with no scroll affordance; print used the screen layout | **Fixed**: single-row scrollable nav, scroll-shadow tables, compact table type ≤480 px, print stylesheet |
| M4 | Medium | A throwing view blanked the whole shell; no code-splitting (531 KB main chunk; unused `recharts` dependency) | **Fixed**: per-route `ErrorBoundary`; Workstation views lazy-loaded (main chunk 370 KB, ImportView 117 KB on demand); `recharts` removed |
| M5 | Medium | axe ran on two of ten routes | **Fixed**: all routes in the desktop project (53/53) |
| L1 | Low | Copy-brief and ACFR “Mark complete” outcomes were not announced to assistive tech; link-styled buttons lacked `type="button"`; the download object URL was revoked synchronously; `Math.random()` record ids; Policy Monitoring rows used `act ?? 0` for a null actual | **Fixed** |
| L2 | Low | The cumulative-income chart total read as a published figure (it is a sum of quoted annual figures) | **Fixed**: labelled calculated |

### Residual items (documented, not changed)

- R3: `.cardable` tables switch to `display: flex` under 640 px, which drops table semantics for
  screen readers; restoring them needs explicit ARIA roles on three tables.
- R4: 18 `.table-scroll` containers lack `tabIndex`/`role="region"`; current Chromium and Firefox
  make overflow containers keyboard-focusable by default, so the impact is limited to older browsers.
- R5: Switching Pension ↔ OPEB discards an applied import without a notice (entity isolation is
  deliberate; the missing notice is not).
- R6: The import error list renders up to 50 rows inside one `role="alert"` region.
- R7: `app/src/lib/dataset/brief.ts` is unused; two day-difference helpers are duplicated.
- R8: `app/public/deck/index.html` (the interactive sample deck) was outside this audit's scope.
- R9: Bar heights are not clamped for negative values; all published growth/cumulative values are
  positive.

### Residuals resolved 2026-09-07 (revision 12.3)

- R3 resolved: the four card-style tables carry explicit ARIA table roles (`table`, `rowgroup`,
  `row`, `columnheader`, `cell`), so their semantics survive the phone layout's `display: flex`.
- R4 resolved: every scrolling table container is a labelled, keyboard-focusable region
  (`role="region"`, `aria-label` taken from the table's caption, `tabIndex=0`).
- R5 resolved: switching Pension ↔ OPEB after an import now shows a dismissible “Import
  discarded” notice naming the dataset and its row count.
- Visual regression added as local QA (`npm run test:visual`, baselines under
  `outputs/visual-snapshots/`, refreshed deliberately with `npm run test:visual:update`); R6–R9
  remain as documented.

### Open items — resolved 2026-09-07

Both public documents were located on lacera.gov and downloaded to `outputs/data/public_docs/`
(ignored): `pafr_2025.pdf` (2025 PAFR, 8 pages, 8.6 MB) and `IPS-OPEB.pdf` (OPEB Master Trust
IPS restated June 12, 2024, 83 pages, 1.3 MB); `invest_policy_stmt.pdf` (Pension IPS, same
restatement) was fetched for the row-by-row re-check.

- O1 **resolved — transcription error corrected.** PAFR p. 7 prints the OPEB cumulative-NII chart
  with 685.6 over the 2021 tick and 397.1 over the 2022 tick (label x-centres 485.9 and 505.8
  against axis ticks at 485.2 and 505.1); the fixture had the two swapped because a text-order
  read of the labels lists them the other way round. With the printed order the series ties every
  year: +452.2 (FY2021, +28.4%), −288.5 (FY2022, −11.2%), +247.5 vs $248M (FY2023), +368.4 vs
  $368M, +472.6 vs $472M. The Pension chart (p. 5) was checked the same way and matches.
- O2 **resolved — source-document inconsistency, reproduced as printed.** OPEB IPS Table 1
  (printed p. 21, PDF p. 24) prints Real Estate 6.5 · Natural Resources 2 · Infrastructure 2 ·
  TIPS 5 under a 16.5 category ½-step. The values stay as printed and the Allocation view says so;
  the test records it as a verified source gap. Pension IPS Table 1 (printed p. 20) matches the
  app row by row.
- Citations now carry verified links: PAFR page anchors equal printed pages; `IPS_T1` → Pension
  IPS p. 20; new `IPS_OPEB_T1` → OPEB IPS p. 21 (OPEB views cite the OPEB document).

### Re-verification

Prettier ✓ · ESLint ✓ · `tsc` ✓ · Vitest 172/172 (15 files, +46 tests) ✓ · production build ✓ ·
Playwright 53/53 (desktop + 375/360/320; axe on all ten routes) ✓ · zero console/page errors ✓ ·
after-renders reviewed (Overview, Performance/OPEB, Allocation/OPEB, Reconciliation, Exceptions,
Import, mobile Overview/Performance/Holdings, print Overview).

Re-verified 2026-09-07 after the corrections: Prettier ✓ · ESLint ✓ · `tsc` ✓ · Vitest 172/172 ✓ ·
production build ✓ · Playwright 53/53 ✓ · rendered citation links checked in a browser (PAFR
pp. 4–7, Pension IPS p. 20, OPEB IPS p. 21) ✓ · zero page errors ✓.

## Revision 13 — user-experience pass, 2026-09-07

Eight improvements from the post-audit review, in the order they change a first-time reader's
experience: the Overview now leads with the latest monthly report (a separate vintage block above
a labelled fiscal-year divider); the CIO Monthly tab opens with a computed two-minute read and a
"what changed" list; tile subtitles carry direction chips; the trend panel switches between small
multiples and the table; both funds can be shown side by side; view state travels in the URL;
every table can be copied as CSV; a glossary sits in the footer of every page; and the two long
views carry a sticky section bar.

Checked in a browser at 1280 px and 375 px: no horizontal overflow, no console or page errors,
axe clean on all eleven routes, and the copy action produces the displayed values with a
formula-injection guard. Renders under `outputs/renders/rev14/`.

