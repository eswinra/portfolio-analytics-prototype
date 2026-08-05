# Starter Workbook Assessment

Stage: Discovery documentation. Read-only assessment of
`reference/Portfolio_Analytics_Market_Pulse_ACFR_Starter.xlsx` (SHA-256 `120d466f…`, unchanged).

## What it does today

1. **Market Pulse** — a one-day (Aug 3, 2026) EOD snapshot of seven ETF proxies with hardcoded
   OHLC inputs and two live formulas per row:
   - `H6:H12` daily return `=IF(C6=0,"",G6/C6-1)` (close / prior close − 1)
   - `I6:I12` recovery from low `=IF(E6=0,"",G6/E6-1)`
   Number format `0.00%;[Red]\(0.00%\);\-` renders zero as “-”. Conditional formats color the
   daily-return column by sign. Each row maps the proxy to a LACERA functional category and cites
   the data source.
2. **Institutional Summary / Teams Drafts** — a narrative block duplicated verbatim across two
   sheets, containing values that exist nowhere as data (index levels 7,600.50 / 53,178.41 /
   25,913.90 / 2,981.91, a ~4.68% 10-year yield, ~$79.47 WTI).
3. **ACFR Crosswalk** — 23 rows mapping ACFR Investment Section (and related Financial/RSI/
   Statistical) tables to authoritative sources, secondary tie-outs, owners (TBD), periods,
   statuses, and validation tests. Status list validation and status-driven conditional formats.
4. **QA Checklist** — 28 controls across scope/dates, market values, performance, historical
   schedules, holdings, fees, managers, cross-report, governance; severity/frequency/status
   validations.
5. **Overview** — KPI block: crosswalk item count, complete count, in-progress count,
   completion %.

## Confirmed defects

| # | Location | Severity | Issue |
|---|---|---|---|
| 1 | `Overview!B10` | Critical (KPI wrong) | `=COUNTA('ACFR Crosswalk'!C2:C200)` includes header cell `C4` → returns 24 for 23 items. `Completion %` (B13) therefore caps at 95.8% and can never reach 100%. |
| 2 | `Overview!B11:B12` | Warning | `COUNTIF('ACFR Crosswalk'!L2:L200, …)` also spans the header row. Benign today (header text never equals a status value) but the same off-by-range pattern as #1. |
| 3 | `Overview` KPI block | Warning | Ignores the QA Checklist entirely — 28 controls with statuses have no roll-up. |
| 4 | `Market Pulse!A15` / `Teams Drafts!A5` | Warning | Narrative duplicated as two independent static strings; numbers inside are not linked to any input cell, so table and narrative can silently diverge. |
| 5 | Whole workbook | Warning | No as-of date exists as a *data* value (dates live inside title strings); no history dimension; a second day of data has nowhere to go. |
| 6 | Whole workbook | Info | No provenance/classification fields; the Alpaca-sourced prices are visually indistinguishable from what synthetic or manual entries would look like. |
| 7 | `ACFR Crosswalk!K5:K27` | Info | Due-date column empty, no date validation. |
| 8 | `Market Pulse!I6:I12` | Info | Recovery-from-low column lacks the conditional formatting applied to daily return. |
| 9 | Wide tables | Info | No freeze panes on 16-column crosswalk; header scrolls out of view. |

No `#REF!`/`#VALUE!`/`#DIV/0!` errors, no circular references, no hardcoded formula overrides,
no hidden rows/columns/sheets, no VBA.

## Useful conventions worth preserving

- Proxy → functional-category mapping column (mirrors the official category structure).
- Source and source-URL columns on every data row.
- List-driven status values with status-colored conditional formatting.
- Real Excel tables (structured ranges) for the two trackers.
- The explicit disclaimer sentence at the end of the pulse narrative ("not estimates of LACERA's
  official portfolio performance").

## Most important gaps (drives the Excel-bridge design)

1. **No calculation engine** — nothing computes a portfolio-level figure, weight, contribution,
   or variance; the only formulas are two ratio columns and four COUNT formulas.
2. **No data-trust layer** — no classification, no freshness/staleness logic, no tolerance
   checks, no validation status.
3. **No history** — single-day snapshot; no period definitions (FYTD/QTD/YTD) anywhere.
4. **Narrative not derived from data** — the flagship output (Teams draft) is hand-maintained.
5. **Range-discipline bugs** — COUNTA/COUNTIF over open-ended ranges that swallow headers;
   the expanded workbook must use structured references (`Table[Column]`) instead.
