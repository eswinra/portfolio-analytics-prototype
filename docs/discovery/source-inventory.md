# Source Inventory

Stage: Discovery documentation. All observations below come from read-only inspection of the
local public reference set under `reference/`. Printed ACFR page numbers equal PDF page − 2
(e.g., printed p.104 = PDF p.106); all ACFR references below use **printed** page numbers,
matching the numbers used inside the starter workbook's crosswalk.

Reference file hashes (SHA-256, recorded 2026-08-04, before any derived work):

| File | SHA-256 (first 16 hex) |
|---|---|
| `reference/Portfolio_Analytics_Market_Pulse_ACFR_Starter.xlsx` | `120d466ff8fadf73` |
| `reference/ACFR-2025.pdf` | `ecb8fff14408e5c4` |
| `reference/CIO-Monthly-Report-July-2026.pdf` | `b4d6fe48e46b0e3c` |
| `reference/total_fund_performance-2026Q1.pdf` | `41be693258afc893` |
| `reference/opeb_performance-2026Q1.pdf` | `7f366b04415fa102` |

## 1. Starter workbook — `Portfolio_Analytics_Market_Pulse_ACFR_Starter.xlsx`

| Sheet | Range(s) | Content |
|---|---|---|
| `Overview` | `A9:B13` KPI block; `D9:H15` instructions | 4 formulas: `B10` COUNTA crosswalk items, `B11`/`B12` COUNTIF statuses, `B13` completion % |
| `Market Pulse` | `A5:M12` proxy table; `A14:M25` narrative | 7 ETF proxies (SPY, ACWI, IWM, AGG, GLD, USO, UUP), OHLC prior-close inputs, formulas `H6:H12` daily return, `I6:I12` recovery from low; source column cites "Alpaca SIP consolidated bars"; example date Aug 3, 2026 |
| `ACFR Crosswalk` | table `ACFRCrosswalkTable` `A4:P27` (23 data rows) | ACFR page, section, table, fund, metrics, authoritative source, secondary tie-out, owner, reviewer, period, due date, status, validation test, variance, notes, source URL |
| `QA Checklist` | table `ACFRQATable` `A4:I32` (28 data rows) | Category, control, applies-to, frequency, severity, owner, status, evidence, resolution |
| `Teams Drafts` | `A5` and `A23` | Two static drafts; Draft 1 duplicates `Market Pulse!A15` verbatim |
| `Lists` | `A1:C6` | Validation lists: Status (5), Severity (3), Frequency (4) |

Controls present: two Excel tables; x14 list validations (`ACFR Crosswalk` L5:L27 → `Lists!A2:A6`;
`QA Checklist` D5:D32 → `Lists!C2:C5`, E5:E32 → `Lists!B2:B4`, G5:G32 → `Lists!A2:A6`);
conditional formats on `Market Pulse!H6:H12` (sign) and both status columns. No charts, no VBA,
no defined names, no hidden sheets/rows/columns.

## 2. ACFR 2025 — fiscal year ended June 30, 2025 (published ~Dec 2025)

| Printed page | Table / disclosure | Notes |
|---|---|---|
| 25 | Statement of Fiduciary Net Position (MD&A analysis pp. 23–27) | ABOR basis; Pension FNP $86.2B |
| 27 | OPEB Trust / Custodial Fund financial analysis | OPEB FNP $5.0B; Custodial $221M |
| 60 | Note G — deposit and investment risks | incl. non-U.S. securities by currency |
| 95 | RSI — Schedule of Investment Returns, Pension | annual MWR net of investment expense, 10 yrs |
| 99 | RSI — Schedule of Investment Returns, OPEB | annual MWR; schedule building toward 10 yrs |
| 104–107 | Chief Investment Officer's Report | TWR net-of-fees headline table; functional-category descriptions; overlay contribution $47M FY25 |
| 108 | Investment Summary — Pension Plan | IBOR fair values by category; total $85,184,786K; Currency Hedges −$96,752K (negative) |
| 109 | Investment Summary — OPEB Master Trust and OPEB Custodial Fund | IBOR; OPEB MT $5,025,968K incl. Operational Cash $9,374K "N/A" percent |
| 110 | Investment Results Based on Fair Value — Pension | net TWR by category vs benchmarks, quarter/1/3/5/10Y; footnote: total fund = weighted average of category returns; 1–3 month delays disclosed |
| 111 | Investment Results — OPEB Master Trust | same; footnote 3: newly funded accounts lack TWR |
| 112 | Total Investment Rates of Return — Pension | 10 fiscal years: fair value, TWR, MWR, smoothed return, assumed rate, funded ratio; FY25 actuarial fields N/A (valuation not yet available) |
| 113 | Total Investment Rates of Return — OPEB | same; agent-plan methodology change note (2018) |
| 114 | Largest Equity Holdings — Pension and OPEB | top-10, custody scope footnote |
| 115 | Largest Fixed Income Holdings — Pension and OPEB | top-10 by fair value with par |
| 116 | Schedule of Investment Management Fees | FY25 vs FY24 by asset class and fund; footnote on incentive fees/carry differences vs financial statements |
| 117 | List of Investment Managers | roster by category |
| 155–156 | Statistical — Changes in Fiduciary Net Position (Pension / OPEB) | 10-year additions/deductions history |

## 3. Total Fund Performance Report, quarter ended March 31, 2026 (191 PDF pages, "ATTACHMENT 1")

| PDF page | Content |
|---|---|
| 4 | Quarterly snapshot: EMV $89,631mm; Sharpe 0.86, StdDev 5.0, TE 2.4 (3Y ann.); batting average .750; estimated public-markets fees ~$11.4mm by category |
| 6 | Summary: net TWR lattice QTD…ITD vs policy benchmark; fiscal-year table FY21–FY25 |
| 7 | Asset allocation vs policy: $ and %, over/under (Growth −1.0% / −$911mm etc.) |
| 8 | Contribution to return (QTD): Growth −0.60, Credit +0.25, RA&IH +0.56, RR&M +0.27, Total 0.60; overlays/other excluded by footnote (components sum 0.48) |
| 9 | Return attribution (QTD): allocation + selection (+interaction in total value add): TF 0.07 + 0.26 = 0.32 |
| 10 | Active return vs tracking error, rolling 36M; cumulative excess vs 7% actuarial target and policy |
| 11 | Risk vs return 5Y: Sharpe/information ratio/TE by category |
| 12–13 | Performance detail: full composite hierarchy with inception dates, dual benchmarks (category + asset-class) |
| 124–131 | Compliance monitor: advisories/exceptions by category; guideline ranges; one Credit EMP exception disclosed |
| ~132–185 | Manager scorecards and Meketa trailing net performance appendix (manager-level MV and returns) |
| 186 | InvMetrics Public DB > $1B peer universe (licensed percentile data) |
| 187–190 | Benchmark definitions: nested weights; PE-Growth = MSCI ACWI IMI Net + 200 bps (3M lag); Non-Core RE = NFI-ODCE Net + 225 bps (3M lag); Credit = 70 S&P UBS Lev Loan / 30 HY + 100 bps (1M lag); RA&IH = 33 Core RE (ODCE 3M lag) / 20 NR (65 S&P GNR 3M lag + 35 NCREIF Farmland) / 27 Infra (DJ Brookfield 3M lag) / 20 TIPS; RR&M = 54 Agg / 33 HF (T-bill+200, 1M lag) / 8 Long Treasury / 4 Cash |
| 191 | Meketa disclaimer (sole-benefit recipient language; AI-assistance disclosure) |

## 4. OPEB Trust Performance Report, quarter ended March 31, 2026 (53 PDF pages)

| PDF page | Content |
|---|---|
| 4 | Snapshot: EMV $5,829mm; Sharpe 0.72, StdDev 8.1, TE 1.7; batting average .700; sub-trust ownership LA County $5,684mm / LACERA $33mm / Superior Court $112mm |
| 6 | Summary lattice + per-sub-trust returns (three sub-trusts shown separately) |
| remainder | Category detail, manager pages, compliance monitor, scorecard, appendix (mirrors total fund structure) |

## 5. CIO Monthly Report — July 8, 2026 Board of Investments meeting (25 PDF pages)

| PDF page | Content |
|---|---|
| 5 | Global market performance **as of June 30, 2026** (index table incl. reference portfolio 60:40) |
| 6 | Key macro indicators (Bloomberg / St. Louis Fed); footnote: labor data lagged one month due to government shutdown |
| 8 | Total fund summary **as of May 2026**: AUM $93.9B; allocation $mm and % vs target; monthly return 2.0% |
| 9 | Historical net performance lattice vs policy benchmark and actuarial hurdle; monthly return distribution 06/2016–05/2026 |
| 11 | Geographic exposure (ex-overlays, domicile basis) |
| 13–14 | OPEB equivalents (AUM $6.3B) |
| 18 | Overlay/hedge program G/L (currency hedge, cash/rebalance overlay); net rebalancing by category |
| 20 | Manager/consultant updates |
| 25 | Disclosures: ODCE latest-available-quarterly; PE/RE cash-flow-adjusted values; definitions (active risk, tracking error, etc.) |

## 6. Cross-source timeline

| As-of | Source | Total fund measure |
|---|---|---|
| Jun 30, 2025 | ACFR (IBOR Investment Summary, printed p.108) | $85.18B investments |
| Jun 30, 2025 | ACFR (ABOR / FNP, printed p.25) | $86.2B fiduciary net position |
| Jun 30, 2025 | ACFR (rates-of-return table, printed p.112) | $82.39B "total investment portfolio fair value" (third scope) |
| Mar 31, 2026 | Quarterly report (PDF p.4) | $89.63B ending market value |
| May 2026 | CIO monthly (PDF p.8) | $93.9B AUM |
| Jun 30, 2026 | CIO monthly (PDF p.5) | market indexes only — no fund values |
| Aug 3, 2026 | Starter workbook | ETF proxy prices only — no fund values |

The same headline can therefore legitimately take multiple values depending on as-of date and
book of record. Any derived artifact must carry both dimensions explicitly.
