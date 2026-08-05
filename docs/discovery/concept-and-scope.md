# Product Concept and Scope

Stage: Discovery documentation. This document records the concept evaluation, the four-reviewer
pressure test, and the approved scope for the public prototype.

## Decision framing

Primary decision question (from the project brief): **"How did the portfolio perform, what drove
the result, and is the data reliable?"** Audience: Portfolio Analytics analysts, investment
leadership, reporting/ACFR stakeholders, and potential internal technology partners, reviewing on
a conference-room screen with a two-minute executive read and analyst drill-down.

## Concepts considered

| Concept | Decision question answered | Strengths | Why not the spine |
|---|---|---|---|
| A. Daily Market Pulse publisher | "What happened in markets today and which functional categories does it touch?" | Automates the starter's current job; immediate utility | Demonstrates no portfolio analytics; highest risk of implying daily official performance |
| B. Performance & data-trust cockpit | The primary decision question, on clearly-labeled synthetic data | Grounded in observed report patterns (contribution, allocation vs policy, period lattice, benchmark lags); showcases reconciliation and classification discipline | — (selected) |
| C. ACFR control tower | "Is the ACFR investment section on track and fully tied out?" | Direct continuation of the starter's crosswalk/QA sheets; operationally real | Mostly a tracker UI; thin analytical demonstration |

**Selected: Concept B as the spine, C as one supporting view, A reduced to a clearly-separated
market-context strip.** Every widget must trace to an observed pattern in the public reports
(quarterly report pp. 6–13; CIO monthly pp. 8–9; ACFR printed pp. 108–113) rather than a generic
dashboard checklist.

## Four-reviewer pressure test — accepted revisions

1. **Attribution removed from v1** (senior PA reviewer): Brinson allocation/selection effects
   (quarterly report p.9) require benchmark-component machinery that synthetic data cannot make
   reconcile credibly; a PA team would test allocation + selection + interaction against excess
   return. v1 shows **weighted contribution with visible reconciliation** instead; attribution is
   listed under the future authorized internal version.
2. **Peer universe excluded** (senior PA reviewer): InvMetrics percentile data (quarterly report
   p.186) is licensed; neither reproduced nor imitated.
3. **Monthly portfolio granularity** (performance-measurement reviewer): synthetic portfolio
   series are monthly (CIO-monthly cadence), rolled up by chain-linking; daily series exist only
   in the market-context strip, which never displays a portfolio return. Contribution =
   beginning-of-period weight × return per month, compounded to the quarter with the compounding
   residual explicitly disclosed against a documented tolerance. Annualization only for periods
   longer than one year.
4. **No Alpaca republication** (data/release reviewer): the starter's ETF prices came from a
   commercial market-data API; derived artifacts use deterministic synthetic series labeled as
   such. `reported_public` values are limited to a small curated set quoted from LACERA's own
   public documents with page-level citations; index *names* are referenced nominatively but no
   index series is republished.
5. **Single headline view** (presentation reviewer): the two-minute read is one screen — KPI
   tiles (illustrative return vs benchmark vs hurdle, reconciliation status), one chart, and a
   data-trust strip. Contribution, allocation, data quality, and the ACFR workflow are drill-down
   views. Statuses are always icon + text + color, never color alone. Compact tables are
   preferred where they beat charts (allocation vs target, period lattice).

## Approved public prototype scope

**Headline view ("Fund Pulse — illustrative"):**
- Illustrative total-portfolio return tiles (month / QTD / FYTD / 1Y) vs synthetic policy
  benchmark and a labeled actuarial-hurdle reference, all conspicuously `synthetic`.
- One chart: cumulative growth of the synthetic portfolio vs its benchmark over the demo period.
- Data-trust strip: per-dataset classification badge, as-of date, freshness state, validation
  status; overall reconciliation state (pass/tolerance/fail).
- Market-context strip (separate visual block, labeled "market context — not portfolio
  performance"): synthetic daily proxy moves by functional category.

**Drill-down views:**
1. **Contribution** — category beginning weights × returns with reconciliation to the displayed
   total, residual, and tolerance; mirrors quarterly report p.8 honestly (including an
   "excluded: overlays" line so the sum visibly ties).
2. **Allocation vs policy** — actual vs effective-dated targets and ranges, variance in % and $
   (mirrors quarterly report p.7).
3. **Data quality** — dataset inventory with classification, vintage, staleness, and validation
   results; import-rejection log for user uploads.
4. **ACFR workflow** — the corrected crosswalk + QA checklist as a filterable readiness board
   with owner/status/evidence roll-ups (fixes the starter's B10 defect class).

**Import:** client-side CSV import mapped through the documented data contract; explicit
validation with row-level rejection reasons; no network transmission.

## Explicitly out of scope for the public prototype

- Brinson attribution, peer universes, manager scorecards, holdings drill-through, compliance
  monitor replication, forecast/prediction, live data feeds, any real daily total-fund return,
  authentication, any backend.

## Future authorized internal version (described, not built)

Requires: validated positions and beginning weights, daily flows, prices, FX, derivatives,
overlay data, fee accruals, benchmark licenses, valuation rules, and reconciliation to the
official performance book. Would add: true TWR/MWR calculation from custodial data, Brinson
attribution, manager-level views, compliance and exception feeds, peer comparisons under
license, and entitlement-controlled access.

## Should not be built (any version)

- Anything presenting a proxy or synthetic figure as official performance.
- Averaged component returns presented as a total return.
- Retail-trading affordances (buy/sell framing, prediction widgets, technical-analysis overlays).
- Republication of licensed index series or of the reference PDFs/workbook.
