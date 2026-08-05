# Project Brief: Portfolio Analytics Dashboard Prototype

## Purpose

Explore how an end-of-day Market Pulse and an ACFR-oriented workbook could evolve into a useful daily portfolio analytics experience for a public-pension Portfolio Analytics team.

Claude Code is expected to make an independent product and architecture recommendation after inspecting the source material. The brief defines the outcome and guardrails, not a prescribed screen list.

## Audience

- Portfolio Analytics analysts
- Investment leadership
- Investment reporting and ACFR stakeholders
- Potential internal data and technology partners

## Desired outcome

A presentation-ready prototype that helps the audience understand:

- what happened in markets;
- what an authorized daily portfolio view could show;
- what drove a result and whether it reconciles;
- whether the underlying data is current, complete, and fit for use;
- how Excel-based analytics and reporting controls could feed a future dashboard.

The primary decision question is: **How did the portfolio perform, what drove the result, and is the data reliable?** For the public demo, any same-day portfolio answer must be explicitly synthetic or a proxy estimate rather than represented as official performance.

## Local reference inputs

The original files are stored under `reference/` and must remain read-only:

- `Portfolio_Analytics_Market_Pulse_ACFR_Starter.xlsx`
- `ACFR-2025.pdf`
- `CIO-Monthly-Report-July-2026.pdf`
- `total_fund_performance-2026Q1.pdf`
- `opeb_performance-2026Q1.pdf`

The reports span different annual, quarterly, and monthly reporting dates. A report's publication month is not necessarily its portfolio as-of month. Discovery must identify those vintages, definitions, providers, and delays before using any number.

Their local availability does not authorize republishing the files. Keep them out of the public repository.

## Requested sequence

1. Independently inspect the workbook and public reports.
2. Recommend the strongest product concept and data architecture.
3. Expand the Excel concept first, in a new workbook, with synthetic/public inputs, formulas, controls, and clear provenance.
4. Validate the expanded workbook and lock a normalized data contract.
5. Build the web dashboard from that approved contract.
6. Prepare a short PA-team demo and an honest future-state roadmap.
7. Audit every tracked file before creating or publishing a GitHub Pages site.

## Public prototype boundary

The prototype may use:

- explicitly synthetic portfolio data;
- cited public, license-compatible market or report data;
- transparent calculations derived from those inputs;
- a fixed demo snapshot or deterministic sample history.

The prototype may not use or imply access to:

- actual non-public positions or manager/account data;
- validated daily cash flows, prices, valuations, derivatives, FX, or fees;
- proprietary benchmark constituents or licensed data without authorization;
- credentials, internal systems, internal URLs, or confidential documents.

An actual daily total-fund return would require authorized holdings or beginning weights, flows, prices, FX, benchmark data, overlays, corporate actions, valuation rules, fees/accruals, and reconciliation to the official performance process. That future state must be described, not simulated as fact.

## Success criteria

- Claude's recommendation is evidence-based and not just a generic dashboard list.
- The expanded workbook is a separate, auditable artifact and the original remains byte-for-byte unchanged.
- Every metric has a definition, classification, period, unit, source, and as-of date.
- Return and contribution calculations use valid methodology and visible reconciliation checks.
- The web prototype is understandable in under two minutes and useful under analyst drill-down.
- The app works from static hosting, uses no secret or backend, and processes uploads locally in the browser.
- The repository contains only approved source code, documentation, and clearly synthetic/public sample data.
- The demo never claims to be an official LACERA product or performance report.

## Non-goals for the public phase

- production authentication or entitlements;
- connection to custodian, IBOR, accounting, risk, or performance systems;
- official daily performance calculation;
- automated investment advice or market prediction;
- public release of the local reference workbook or PDFs.
