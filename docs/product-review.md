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
