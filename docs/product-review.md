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
| H4 | High | The new test surfaced two transcription discrepancies: the OPEB cumulative-NII series steps −$41.0M in FY2023 against $248M of NII (the FY2024–FY2025 steps tie); the OPEB Real Assets ½-step sub-rows sum to 15.5% vs the category's 16.5% | **Disclosed, not corrected**: “verification open” notes on the Performance (OPEB) and Allocation (OPEB) views; open items O1–O2 below; the test pins each discrepancy explicitly so a silent change fails |
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

### Open verification items

- O1: OPEB cumulative net investment income, FY2016–FY2023 steps, against the 2025 PAFR (p. 7) —
  the series stays on screen with a disclosure until re-checked.
- O2: OPEB IPS ½-step sub-targets under Real Assets and Inflation Hedges (Real Estate 6.5 ·
  Natural Resources 2 · Infrastructure 2 · TIPS 5 → 15.5 vs 16.5) against the OPEB IPS.

### Re-verification

Prettier ✓ · ESLint ✓ · `tsc` ✓ · Vitest 172/172 (15 files, +46 tests) ✓ · production build ✓ ·
Playwright 53/53 (desktop + 375/360/320; axe on all ten routes) ✓ · zero console/page errors ✓ ·
after-renders reviewed (Overview, Performance/OPEB, Allocation/OPEB, Reconciliation, Exceptions,
Import, mobile Overview/Performance/Holdings, print Overview).
