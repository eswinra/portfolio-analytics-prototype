# Changelog

## 2026-08-13 — Revision 9.1: post-audit follow-ups

- Import confidentiality copy hardened per the second external audit: browser-local
  processing is now stated as a privacy property, not an authorization or security
  control — confidential or non-public data belongs only in an approved private
  environment.
- Sanitized replacement handoff written to `outputs/handoff-2026-08-13-rev9.md`
  (ignored; pinned to commit 3d4bc9a, source-precedence ordered). The four historical
  prompt files were marked “SUPERSEDED — HISTORICAL REFERENCE — DO NOT EXECUTE”
  outside the repository; verified none of them ever entered the repo or its history.

## 2026-08-13 — Revision 9: trust & controls (external-audit tranche)

Owner-approved response to the external audit (11 findings independently verified): one
coherent tranche hardening controls, methodology honesty, delivery safety, and mobile/a11y.
No visual redesign.

- **Entity registry hard gate**: `app/src/fixtures/entityRegistry.ts` maps entity → legal
  fund → policy pack; staging AND apply both run `checkEntityMatch`. A cross-fund file is
  rejected before staging with `E-ENTITY` naming both funds and stating that nothing was
  applied (`E-UNREGISTERED` / `E-TRACKER` for unknown and tracker entities). Switching
  workspace tabs discards any staged preflight; the Import panel now names the active
  workspace. Policy identity is never inferred from entity-name text (`inferPolicyEntity`
  removed).
- **ACFR completion eligibility**: `sectionEligibility` computes open requirements
  (tie-outs, artifacts, Blocked items, independent reviewer, ready-for-sign-off status).
  Leadership sees “Completion unavailable — N requirement(s) open” with a visibly disabled
  action; a section whose recorded status outruns its controls carries a
  “status ahead of controls” tag (the INTRO fixture demonstrates detection); completion
  rows write `reviewed_by`.
- **Methodology fail-closed**: fund-vs-benchmark legs compare `return_method` and
  `gross_net`; a mismatch suppresses the comparison and raises a blocking `METHOD-*`
  exception instead of computing a number.
- **Proxy impact honesty**: context-only series report a modeled impact of 0.0 pp and are
  labeled “(context)”; mapped proxies quantify the coverage loss in percentage points.
- **Publication gate (demonstrated)**: `publishEligible`/`publishBlockers` derive from
  blocking-tier exceptions plus out-of-tolerance reconciliations; the workstation title
  band shows ELIGIBLE / INELIGIBLE with the blocking conditions listed.
- **Source registry and date separation**: typed `SOURCES` registry (ACFR page-anchored
  URLs; deliberately no fabricated PAFR/IPS links) rendered by `SourceLine`; `DateLine`
  separates report date, actuarial valuation date, data-through, and retrieval; TWR
  net-of-fees kickers with the MWR non-comparability and benchmark-lag footnotes; UAAL
  shown in $B alongside thousands; derived tables labeled “calculated from quoted
  figures”.
- **Honest renames**: Risk & Compliance → Policy Monitoring; Holdings & Managers →
  Holdings & Fees; the OPEB funded view is titled “Benefits & prefunding”.
- **Mobile and a11y**: zero page-level horizontal overflow at 320/360/375 across all ten
  routes (charts compress via `--chart-gap` and shrinkable bars; role-row note and grid
  minmax fixes); tables card at ≤640px with data-labels and Status/Tier first; header
  contrast raised; route changes move focus to the view title; scrollable table regions
  are labeled; disabled primary buttons are visibly disabled.
- **Delivery safety**: dev-server `fs.allow` narrowed to the app plus `data/sample`
  (references are never servable); the Pages workflow now gates deploy on lint, format
  check, the test suite, and `npm audit --omit=dev --audit-level=high` before build.
  Repo-settings recommendation (owner action): require reviewers on the `github-pages`
  environment.
- **Verification**: 124 vitest tests (entity gate, ACFR eligibility truth table, method
  fail-closed, publication gate, jsdom component tests for the two gates); new Playwright
  smoke suite — 45 checks across desktop and 320/360/375 — covering per-route overflow,
  axe on Overview and Import, and the three demonstrated controls; screenshot evidence in
  `outputs/` (ignored).

## 2026-08-13 — Revision 8.2: Dashboard | Workstation split (owner-directed)

The app now has two first-class modes, matching the workflow architecture: a place where
the work is populated and a presentation layer that (in the internal version) feeds from it.

- **Mode switch** in the nav bar (Dashboard | Workstation), all URLs stable.
- **Dashboard** (6 tabs): Overview, Performance, Allocation, Funded Status, Risk &
  Compliance, Holdings & Managers — the published-FY2025-figures presentation.
- **Workstation** (4 tabs): Data (import pipeline), Reconciliation, Exceptions, and ACFR
  Workflow — moved out of the presentation nav, where it belonged: it is a production
  tracker, not presentation content. Workstation pages keep the synthetic-data banner, now
  stating the feed relationship: in the internal version the dashboard consumes what the
  workstation publishes; here the dashboard quotes published documents while the
  workstation demonstrates the pipeline.
- Footer restates the same relationship with the four workstation links.
- Verified in the browser across every mode transition; 106 tests, pipeline clean.

## 2026-08-13 — Revision 8.1: team workflow demo restored (Import, Reconciliation, Exceptions)

Owner-approved restoration of the operating half of the team-tool vision, incorporated into
the LACERA design without touching the seven-tab presentation nav.

- **Team workflow demo section**: Import, Reconciliation, and Exceptions return as
  footer-linked views styled on the LACERA system, each carrying a surface-tinted banner
  ("Team workflow demo — synthetic contract data (schema 1.3, V01–V23)") plus its own
  sub-nav, keeping the published/synthetic wall explicit. The title band labels these views
  "Team workflow demo · synthetic DEMOFUND/DEMO-OPEB data".
- **Import**: the full pipeline proof is back — drag-and-drop with preflight, apply/discard,
  downloadable error report, the schema-1.3 Data Dictionary rendered from the validator's
  constants, template downloads, and the first-timer guide. The draft-data banner reappears
  (workflow section only) when imported rows are review_status=draft.
- **Reconciliation**: paired sources with computed variance, tolerance-as-data, and the
  deliberate demo break, restyled in the tag language (breaks render as the navy Blocked
  tag).
- **Exceptions triage**: tier + days-open queue, Team Activity provenance panel, passing
  controls, and the dataset provenance/citations details. Risk & Compliance links to it.
- **Plumbing**: DatasetProvider remounted beside the published-figures context with an
  EntitySync bridge, so the header Pension/OPEB toggle drives the synthetic dataset too;
  ui.tsx regains compatibility helpers (Pill→Tag mapping, fmtPct/fmtMm/fmtSmartReturn,
  ClassBadge).
- Verified end-to-end in the browser: preflight → apply → draft banner → restore; entity
  sync to DEMO-OPEB; 106 tests, lint, typecheck, build clean.

## 2026-08-13 — Revision 8: LACERA redesign (published FY2025 figures, seven views)

Implemented the owner's design handoff (`design_handoff_lacera_portfolio_analytics/`) —
a LACERA-branded presentation layer quoting only published documents.

- **New chrome**: notice bar, LACERA wordmark header with a Pension Plan / OPEB Trust
  segmented control, seven-tab nav with 3px accent underline, accent-800 title band with
  "Copy board brief" on Overview, accent-200 strip, and the mission footer. Single navy
  ramp on white, square-cornered 1px-bordered panels, Mulish throughout — self-hosted via
  @fontsource so the built site still makes zero network requests.
- **Seven views**: Overview (KPIs, FY2016–25 growth bars, allocation strip, returns table,
  FY2025 flows), Performance (returns + grouped bars, three-year changes table, cumulative
  investment income SVG), Allocation (full-width policy bullets with ½-step ticks and
  published-actual diamonds + complete IPS Tables 1–2), Funded Status (funded-ratio bars,
  membership / OPEB enrollment + prefunding story), Risk & Compliance (range-compliance
  table, excess-by-horizon cards, governance notes), Holdings & Managers (largest equity/
  fixed income holdings, management fees), and the ACFR Workflow board restyled on the new
  system while keeping its contract-record plumbing (tracker file + crosswalk).
- **Every displayed figure is a reported_public quotation** from the 2025 PAFR, 2025 ACFR,
  or the IPS documents, with per-panel source citations (config-gated). The OPEB actual mix
  is deliberately not reproduced (published only as a chart) and the views say so.
- **Retired from navigation** (legacy routes redirect): Trends, Exceptions, Recon, Import,
  Methodology — the synthetic daily-workflow story steps back behind the presentation
  layer. The contract engine, validators, fixtures, generators, and all 106 tests remain
  intact and green.
- Bundle: Recharts dropped from the build; Mulish woff2 subsets bundled locally.

## 2026-08-13 — Revision 7.1: ACFR sections own their items; diagram removed (owner feedback)

- **Tie-out items nested under their sections**: the page-level crosswalk (23 tables and
  disclosures) now lives inside its section cards — Investment items under INV; Financial,
  Financial Notes, RSI and SI under FIN; Statistical under STAT. Each card shows
  "tie-out items X / Y complete" beside its artifact progress; Introduction and Actuarial
  state that the investment-data crosswalk has no items for them. The separate crosswalk
  register is gone; the QA checklist (28 controls, cross-section by nature) remains as a
  collapsed register.
- **Viewer-role selector fixed**: normal type size instead of inheriting the KPI-tile scale.
- **Architecture panel removed from Methodology** at the owner's decision — the workflow
  tree stays an internal working reference; the public page keeps its prose boundaries.
- Tests 106/106; lint, typecheck, build clean; verified in the browser.

## 2026-08-13 — Revision 7: full team-tool backlog (contract 1.3 — recon, ACFR board, private markets)

Remainder of the confirmed backlog plus the architecture reference from the internal review.

- **Contract schema 1.3.0** (column set unchanged; 1.0–1.2 files stay valid): `recon_value`
  source-side pairs (V05 key gains source_name for this type; V23 caps a key at two sources),
  `tolerance_definition` (tolerance-as-data, ≥ 0), `acfr_section_status` (V22 enum; one row
  per change — the file is the change log), `acfr_artifact_link` (links + metadata, never
  files), `pm_commitment`/`pm_capital_account` (primitives only). Fixtures 358 → 376 records
  each; new tracker fixture `demo_acfr_status_v1.csv` (24 records, entity DEMO-ACFR).
- **Reconciliation tab** (nav: nine tabs): paired sources with the variance computed on
  screen, tolerance carried as data, owner/review status/aging per pair; the internal-book
  side ties exactly to the workbook's own EMV values and one category pair is a deliberate
  demo break that also lands in Exceptions.
- **ACFR board rebuilt on contract records**: five-section readiness cards (status, draft
  version, owner, due-date aging, artifacts in/expected, full history expander), a
  viewer-role toggle labeled "demonstration only — not access control", and a
  leadership-gated Complete action that copies a ready-to-append CSV row — the file is the
  record, so the demo cannot and does not write state. Recommendation stated on the page:
  the enforceable tracker belongs in the identity-aware internal M365 environment (hybrid).
  Crosswalk/QA registers demoted to an expander.
- **Private-markets monitoring** on Performance: commitment / called / unfunded* /
  distributed / lagged NAV / DPI* / TVPI* per synthetic sleeve (*computed, never imported;
  zero-called ratios render em-dash, never zero).
- **Performance period toggles** (1M / QTD / FYTD / ITD): on-screen chain-link
  reconciliation of the selected window vs the exported figure (0.0 bp TIES on the fixture;
  ITD = FYTD is stated, not hidden).
- **Trends risk lenses** (min-20-observation gates, proxy-estimate labeled): max drawdown
  with peak→trough dates, best/worst day, deviation vs 20-day average, and a date-matched
  rolling correlation matrix. Daily fund-level risk remains deliberately unbuilt.
- **Freshness lines** on every data view (newest as-of + entering actor); **enriched daily
  brief** (policy breaches/near-bound, recon breaks, tiered+aged exceptions, draft count).
- **Architecture diagram on Methodology**: the workflow tree recreated as a native inline
  SVG with code-true vocabulary and LIVE/TARGET chips — every consumption-layer tab is
  live; the AI intake→structure→extract engine and identity-enforced approvals are
  target-state. Authoring template generator added (`tools/make_authoring_template.py`).
- Tests 86 → 106; Excel QA all PASS both entities; every new surface browser-verified.

## 2026-08-13 — Revision 6: team-tool foundation (schema 1.2 provenance, dictionary, triage)

First tranche of the internally-reviewed team-tool backlog (three items confirmed by the
owner; requirements produced by an internal domain review and verified against the code).

- **Schema 1.2 — provenance in the contract**: `entered_by`, `reviewed_by`, `review_status`
  append after `schema_version`; column sets are version-gated so 1.0/1.1 files stay valid
  (all three columns or none — partial headers reject). New rules **V19** (entered_by on
  user-import rows), **V20** (reviewer named on reviewed/published rows), **V21**
  (review_status enum). Any draft row raises a yellow **Draft data** banner and an
  informational exception. New **Team Activity** panel on Exceptions derives per-actor
  entry/review counts from the rows — the file is the audit log; the app stores nothing.
  Both workbooks, fixtures (still 358 records each), and the import example regenerated at
  1.2.0 with synthetic actor labels (`PA-ANALYST-1`, `PA-LEAD-1`); the import example's new
  day is entered by `PA-ANALYST-2` as `draft`, so the demo import now shows the full review
  workflow. Four new invalid samples (V19/V20/V21/partial header). Excel QA: all PASS.
- **In-app Data Dictionary + onboarding (Import)**: every column and enum token rendered
  from the validator's own constants — a typed map makes an undocumented column a compile
  error, and a test pins token lists to the schema. "How to fill the template" first-timer
  guide covers the three Monday-morning failures (whole-number percents/V10, two entities/
  V17, blank-without-missing/V08) with fixes.
- **Exceptions triage**: every issue now carries a **tier** (blocking / warning /
  informational) and **days open** computed from dates inside the file; the queue sorts by
  tier then age (the 4-day stale series now outranks the 1-day missing close).
- **Allocation near-bound rider**: sleeves within 1.0 pp of a policy bound show an amber
  "Near bound" state (early warning, never a breach); the Overview policy tile surfaces
  the count. Threshold is a documented constant until tolerance-as-data arrives with the
  Reconciliation work.
- Tests 72 → 86; typecheck, lint, production build clean; draft-banner path verified
  end-to-end in the browser (preflight → apply → banner → restore).

## 2026-08-06 — Revision 5.5: Policy page removed (owner decision)

- The Policy tab restated IPS tables the PA team already owns, so it no longer occupies a
  navigation slot. Navigation is eight tabs: Overview | Performance | Trends | Allocation |
  Exceptions | ACFR | Import | Methodology.
- The quoted IPS allocation tables (both funds: min/target/max, ½-step, Table-2 benchmarks
  with lags, interpretation notes) move to **Methodology** as collapsed `reported_public`
  audit references — the citations survive for auditors and non-PA audiences without daily
  screen cost. `#/policy` redirects to `#/methodology`; in-app links updated
  (Allocation footnote, Overview proxy detail).
- No data, validator, or calculation changes. Tests 72/72, lint clean, production build OK.

## 2026-08-06 — Revision 5.4: import example, glyph fix, shareable Excel dashboard

- `tools/make_import_example.py`: deterministic day-after workbook + ready-to-upload CSV
  demonstrating the daily append workflow (clears the stale-proxy exception, lifts coverage).
- Fixed σ rendering as Σ in Trends table headers (`text-transform: uppercase` exemption);
  clarified Trends captions (per-bar meaning, sparkline range, full-series scale).
- `tools/make_dashboard_workbook.py`: standalone `Fund_Pulse_Dashboard.xlsx` mirroring the
  web Overview/Trends story for e-mail sharing, with COM-verified recalc and chart fills.

## 2026-08-06 — Revision 5.3: Trends (history-in-the-file)

- New **Trends** view: daily policy-weighted read-through trend (per-day bars with per-day
  coverage in the tooltip), per-proxy windows (1d / 5d trading week / MTD from first close of
  the month / sigma-20 daily volatility) with sparklines, and the fund's latest months plus
  chain-linked rolling 3-month vs benchmark.
- Architecture decision made explicit in the UI: the app saves NOTHING between imports — the
  history lives inside the dataset (the daily workflow appends one day per close, so every
  imported file deepens every window). All windows use present observations only and render
  em-dash when history is insufficient; nothing is imputed.
- New pure module `src/lib/finance/trends.ts` with 8 tests (gap skipping, MTD boundary,
  volatility window, per-day coverage variation). Tests 64 -> 72.


## 2026-08-06 — Revision 5.2: fund-first Overview with charts; self-explaining pulse

- Overview now leads with the FUND, per owner feedback: KPI tiles (FYTD vs benchmark, FYTD
  excess with ahead/trailing context, QTD with excess, policy status) plus two charts — Growth
  of $1 vs benchmark and a new monthly-returns bar chart (validated polarity palette, single
  series). Both follow the Pension/OPEB switch.
- The daily proxy pulse is a compact strip below the charts, and a flat reading now explains
  itself ("Flat — drivers offset: Global Equity +5 bp, Investment Grade Bonds −5 bp"); non-flat
  days name the leading driver. Coverage, data issues, copy-brief and the full proxy detail
  remain one line/click away.


## 2026-08-06 — Revision 5.1: flat navigation, Overview naming (user preference)

- All eight views back as top-level tabs (Overview | Performance | Allocation | Exceptions |
  Policy | ACFR | Import | Methodology) — the More dropdown removed at the owner's request;
  "Pulse" renamed "Overview". Simplified first screen and per-view trimming from revision 5
  unchanged.


## 2026-08-06 — Revision 5: information-architecture simplification (external UX review adopted)

- **New first screen (Pulse)**: four tiles (covered-proxy impact / policy-weight coverage /
  policy status / data issues), today's covered drivers in bp, top needs-review issues, one
  periodic-context line, copy-brief action; proxy math, market-context table and methodology
  behind one expander. Mobile Pulse height 5,061px -> 1,631px; header+nav 413px -> 266px
  (incl. the persistent disclaimer band).
- **Navigation**: Pulse | Performance | Allocation | Exceptions | More (Policy & benchmarks,
  ACFR workflow, Import, Methodology & disclosures) with an accessible disclosure menu; legacy
  routes redirect. Header metadata (schema/fixture/policy pack) moved to Exceptions > Data
  details.
- **Performance** merges the period table (hurdle retained WITH its inline definition), growth
  chart + monthly table, contribution chart (zero-value categories omitted from the chart,
  retained in the accessible detail), and the 5-line reconciliation with full detail expander.
- **Allocation** rendered as policy-range bullet rows (min - target - max, actual marker,
  distance-to-boundary); EMV/dollar over/under behind "Dollar details" (a dollar gap must not
  read as a trade size); "Non-policy exposures" one-liner for Overlays/Other.
- **Exceptions**: root-cause merged in the model (a degraded series + its control = ONE issue;
  "2 issues affecting 2 controls", never four warnings); summary line; passing controls and
  provenance/citations behind expanders (absorbs the former Data-quality view).
- **ACFR**: action queue (blocked/review/in-progress, top 5) with Crosswalk/QA subtabs; the
  full 51-record registers behind "Show the full register" with status filters.
- **Formatting**: fmtSmartReturn — "Flat" under 0.5 bp (kills the negative-zero artifact), bp
  under 25 bp, percent above. Covered-basket return demoted to the Pulse expander (kept, per
  the adopted-with-modification note). Import warning condensed with licensed-data guidance
  behind an inline expander.
- Tests 63 -> 64 (exception root-cause merge). Full pipeline green; browser-verified desktop
  and mobile.


## 2026-08-06 — Revision 4: schema 1.1, OPEB workbook, Policy-page switch fix

- **Policy page now follows the main Pension/OPEB masthead switch** (its separate internal
  toggle removed) — reported by the user.
- **Contract schema 1.1.0**: `policy_target` (explicit `policy_min/target/max/halfstep` per
  category) and `benchmark_definition` (numeric lag months + formula) record types, classified
  `reported_public` with IPS citations (V15 widened to the quotation types). The app builds
  allocation bands from dataset policy records when present (`policySource: "dataset"`),
  falling back to the bundled pack for 1.0.x files.
- **OPEB Excel workbook**: `tools/build_workbook.py --entity OPEB` builds
  `outputs/..._OPEB.xlsx` with per-entity config (seed 20260631, OPEB IPS bands/targets/6.0%
  hurdle, no transfers); `qa_excel.py`/`make_fixtures.py` parameterized the same way. The OPEB
  fixture is now workbook-derived (replacing the engine-only generator, which was removed), and
  both funds share one market-context series via a dedicated market RNG.
- Both fixtures regenerated at 358 records from Excel-QA'd workbooks (Pension audited values
  unchanged: FYTD 12.41%, residual 5.2 bps; OPEB: FYTD 6.34% vs benchmark 8.20%, residual
  2.5 bps). 63 tests green.

## 2026-08-06 — Revision 3: dual-fund tabs (Pension / OPEB)

- **Fund tabs** under the Fund Pulse masthead switch the entire dataset and policy scope:
  Pension (DEMOFUND, Pension IPS pack) vs OPEB (DEMO-OPEB, OPEB IPS pack — bands 35–55% Growth,
  ½-step read-through weights 40/14.5/2, synthetic 6.0% hurdle). Every view, band, exception,
  and the daily brief follow the selected entity; an applied import overrides the active tab
  until reset, and switching tabs returns to that tab's fixture.
- New deterministic OPEB dataset (`data/sample/demo_opeb_export_v1.csv`, 338 records, seed
  20260631) generated by `tools/make_opeb_fixture.py` using the same calculation rules as the
  Pension workbook engine (BOP-weighted monthly, chain-linked, residual disclosed — 2.7 bps
  PASS). Market-context rows are shared with the Pension fixture (entity relabeled); citation
  rows keep their cited public entities. The Excel workbook remains the auditable demonstration
  for the Pension entity (DECISIONS #22).
- Tests 62 → 63 (OPEB fixture contract + policy scoping + internal chain-link consistency).

## 2026-08-06 — Revision 2: external-review adoption, IPS policy pack, Daily Pulse

- Verified and adopted an external code review (all 8 code-level claims reproduced; see chat
  analysis): display rounding tie-out, hash-router skip-link bug, positional chart join,
  entity blending, trusted derived fields, partial totals, V10 over-reach, hard-coded ranges.
- **IPS policy pack**: both public Investment Policy Statements (restated 2024-06-12) encoded
  with explicit min/target/max (Pension Cash 0–3% asymmetry), ½-step targets, benchmark
  formulas + lags, citations, and a source-inconsistency data note (OPEB RAIH sub-class ½-steps
  sum 15.5% vs category 16.5% — flagged, not silently corrected). New Policy view; Allocation
  now uses the real Pension bands with distance-to-boundary.
- **Daily proxy pulse** on Overview: policy-weighted read-through with honest policy-weight
  coverage (40.5% in the demo — Natural Resources proxy deliberately unpriced), covered-basket
  return, exceptions queue with staff-analytics framing, and a generated copy-to-clipboard
  daily brief. Market-pulse CSV template added (`data/sample/market_pulse_template.csv`) for
  the Bloomberg BDH export workflow, with a prominent internal-use/licensing warning.
- **Integrity foundation**: V17 now rejects multi-entity files; date-keyed series joins;
  span-matched excess; derived fields recomputed; partial totals suppressed with an exception;
  missing-flagged values discarded at parse; V10 scoped to return/contribution records.
- **Import preflight**: validate-and-summarize before an explicit Apply; downloadable error
  report; template and invalid-sample downloads.
- **A11y/UX fixes**: skip link (hash-router safe), route-change scroll/focus reset, expandable
  monthly data table (fixes the chart's aria promise), mobile allocation cards, scrollable
  mobile nav, ACFR days-remaining column, contribution rounding-adjustment line with
  unrounded-values footnote.
- Tests: 49 → 62 (read-through, asymmetric bands, entity rejection, discard-on-missing,
  V10 scoping, suppression rules). Full pipeline green.

## 2026-08-04 — Stage 7: Public-release audit

- `docs/public-release-audit.md`: PASS with 3 manual-review warnings (license choice,
  process-meta files, owner/visibility confirmation). Evidence: 78-file tracked inventory with
  `git ls-files`/`git check-ignore`; zero office/PDF files tracked; zero secrets in files and
  full history; zero network calls in the app; minimal-permission workflow; clean-clone
  `npm ci` → 49/49 tests → lint → build all green; no source maps.
- No remote created, nothing pushed; publication commands proposed only, pending explicit
  approval (Prompt 8A/8B).

## 2026-08-04 — Stage 6: PA-team product review

- Full presentation audit of the production build under a simulated Pages subpath
  (`docs/product-review.md`): two-minute read, classification legibility, reconciliation
  tie-out, import rejection E2E, ACFR filter ARIA state, mobile layout — results and evidence
  recorded.
- Fixed M1 (medium): the stale-demo proxy rendered as missing — daily staleness threshold
  corrected to 3 calendar days and strip logic gives stale precedence over missing-at-end;
  the three data states now render distinctly (✓/△/✕). Tests updated; pipeline re-run green.
- Accepted-with-mitigation findings L1–L3 and residuals R1–R2 documented.
- Added `docs/demo-script.md` (timed 5–7 minute walkthrough with Q&A anchors); no separate demo
  route added (smallest-prototype principle).

## 2026-08-04 — Stage 5: Dashboard build

- Built the static web prototype in `app/` (Vite + React 18 + TypeScript strict): Overview,
  Contribution, Allocation, Data quality, ACFR workflow, Import, and Limitations views; Zod
  contract schema + V01–V18 import validator; pure finance modules; two validated charts.
- 49 unit tests (finance math incl. compounding/averaging counter-example, tolerance edges,
  staleness thresholds, period alignment; contract parsing against the valid fixture and all 8
  invalid fixtures plus mutation cases). Format, lint, typecheck, tests and production build all
  pass; built app verified in a browser under a simulated Pages subpath with zero console errors.
- Contract correction found by the app's own validator: V09 originally over-enforced period
  spans and rejected the canonical fixture — scoped to return/contribution record types
  (docs updated).
- Data correction found during browser review: `public_reference` rows were attributed to
  `DEMOFUND`; `entity_id` now names the cited public entity. Workbook, QA and fixtures
  regenerated (`tools/build_workbook.py` r2).
- Added `.github/workflows/pages.yml` (minimal-permission Pages deploy; not executed remotely),
  `README.md`, `docs/architecture.md`.

## 2026-08-04 — Stage 4: Workbook audit and data contract

- Independent audit of the expanded workbook (fresh recomputation from the file's own inputs):
  all calculations tie ≤1e-9; findings and dispositions recorded in `docs/workbook-qa.md`.
- Corrections to the derived workbook: unit→scale metadata mapping on public-reference records;
  `schema_version` column added to `Export_Contract` (now 29 columns). Rebuilt and re-verified;
  no check was weakened or removed.
- Locked the web interface: `docs/data-contract.md`, `docs/data-dictionary.md`,
  `docs/import-validation-rules.md` (18 validation rules with severities).
- Added deterministic synthetic fixtures: `data/sample/demofund_export_v1.csv` (338 records)
  plus 8 named malformed variants under `data/sample/invalid/` and `data/sample/README.md`;
  generated by new `tools/make_fixtures.py`.
- Reference workbook hash re-verified unchanged.

## 2026-08-04 — Stage 3: Excel bridge

- Created `outputs/Portfolio_Analytics_Dashboard_Workbook_Prototype.xlsx` (14 sheets, 338-record
  normalized export table, schema 1.0.0) via deterministic generator `tools/build_workbook.py`
  (seed 20260630).
- Added Excel-COM QA harness `tools/qa_excel.py`: full recalculation, comparison against an
  independent Python recomputation, formula-error scan, per-sheet PDF renders
  (`outputs/renders/`).
- QA result: all computed values match Python expectations (≤1e-9); 10 PASS / 2 deliberate
  WARN / 0 FAIL controls; zero formula errors. Evidence in `docs/workbook-qa.md`.
- Fixed during build: bare-table-name `#NAME?` formulas, export-count COUNTA fragility,
  data-validation `=` prefixes, clipped labels, wrapped-row heights.
- Corrected the starter's `Overview!B10` defect class in the derived trackers by using
  structured references (CHK-10/CHK-11).
- Verified `reference/` starter workbook SHA-256 unchanged
  (`120d466ff8fadf73…c793d32`).
- Documentation: `docs/expanded-workbook-spec.md`, `docs/workbook-methodology.md`,
  `docs/workbook-qa.md`.

## 2026-08-04 — Stage 2: Discovery documentation

- Added `docs/discovery/` (source inventory, workbook assessment, concept and scope,
  architecture options, data principles, risks and open items) and `DECISIONS.md` after the
  four-reviewer pressure test. Key scope changes: Brinson attribution deferred, peer-universe
  data excluded, monthly portfolio granularity, no Alpaca price republication.
