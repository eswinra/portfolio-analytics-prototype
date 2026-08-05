# Expanded Workbook Specification

Artifact: `outputs/Portfolio_Analytics_Dashboard_Workbook_Prototype.xlsx` (git-ignored; rebuild
with `python tools/build_workbook.py`, QA with `python tools/qa_excel.py` — requires Excel +
pywin32 for the QA step). Original starter workbook untouched: SHA-256
`120d466ff8fadf73…c793d32` verified identical before and after the build.

## Sheet map

| # | Sheet | Role | Key contents |
|---|---|---|---|
| 1 | `README` | Instructions | Purpose, color/classification legends, sheet map, update workflow, known demo states |
| 2 | `Lists` | Controlled vocabularies | Status, severity, frequency, classification, data-state, category, period-type, check-status lists (validation sources) |
| 3 | `Inputs_Public` | `reported_public` anchors | 8 cited values from the public reference set, each with as-of, period, book, method, source page, provider, retrieval date |
| 4 | `Inputs_Market` | Synthetic market strip | 6 demo proxies × 22 business days (June 2026) closes; calculated daily-return column; deliberate missing (DEMO-OIL) and stale (DEMO-USD) states |
| 5 | `Inputs_Portfolio` | Synthetic DEMOFUND inputs | Initial category BMVs; 12 monthly net returns × 6 categories; 12 monthly benchmark returns × 4 categories; end-of-month internal transfers (net-zero, checked) |
| 6 | `Policy_Targets` | Assumptions | `AsOfDate` + `SchemaVersion` named cells; synthetic hurdle; two effective-dated policy-weight versions with ranges; formula grid of applied monthly weights |
| 7 | `Calc_Returns` | Engine | BMV/EMV evolution, beginning weights, category returns, TF monthly return (SUMPRODUCT), growth indexes (portfolio/benchmark/hurdle), period results (1M/QTD/FYTD) |
| 8 | `Calc_Contribution` | Contribution + reconciliation | Monthly weight×return grid (Apr–Jun 2026), QTD sums, arithmetic total vs chain-linked QTD, residual, tolerance (input cell, 10 bps), PASS/FAIL status |
| 9 | `Calc_Allocation` | Allocation | EMV, actual %, effective-dated target, over/under % and $mm, range status |
| 10 | `Checks` | Controls | CHK-01…CHK-12 with result, status (PASS/WARN/FAIL), expected, note; roll-up counts |
| 11 | `Crosswalk` | ACFR tracker | 23 rows (Excel table `ACFRCrosswalkTable`), status validation + conditional formats, illustrative statuses/due dates |
| 12 | `QA_Checklist` | ACFR QA tracker | 28 controls (Excel table `ACFRQATable`), frequency/severity/status validations |
| 13 | `Exec_View` | Executive read | Performance tiles, contribution + reconciliation, allocation vs policy, data-trust block, ACFR readiness KPIs, market-context strip |
| 14 | `Export_Contract` | Web interface | 338 normalized records, 28 columns, schema 1.0.0; derived values formula-linked, inputs static |

## Conventions

- **Blue font + light-blue fill** = editable input; **black** = same-sheet formula; **green** =
  cross-sheet link; amber banner = disclaimer (every sheet).
- Named ranges: `AsOfDate`, `SchemaVersion`, `TF_1M/QTD/FYTD`, `BM_1M/QTD/FYTD`,
  `Contribution_Residual`, `Contribution_Status`, `Checks_Pass/Warn/Fail`, `EXPORT_EXPECTED`.
- No open-ended COUNT ranges: tracker KPIs use structured references
  (`ROWS(ACFRCrosswalkTable[Section])`), fixing the starter's `Overview!B10` header-count defect.
- All assumptions (tolerance, hurdle, targets, effective dates) are visible input cells with
  comments, never constants inside formulas.

## Export_Contract record types (338 records)

| record_type | Count | Notes |
|---|---|---|
| `monthly_return` | 84 | 6 categories + TOTAL × 12 months (portfolio) |
| `monthly_benchmark_return` | 60 | 4 categories + TOTAL × 12 months |
| `period_return` | 9 | 1M/QTD/FYTD × portfolio/benchmark/hurdle |
| `allocation` | 24 | emv / weight_actual / weight_target / over_under_pct × 6 categories |
| `contribution_qtd` | 9 | 6 categories + arithmetic total + chain-linked + residual |
| `market_close` | 132 | 6 proxies × 22 business days (3 blank values carry `quality_status=missing`) |
| `public_reference` | 8 | the cited `reported_public` rows |
| `check_result` | 12 | CHK-01…CHK-12 statuses |

Columns: record_id, record_type, entity_id, metric_id, category_id, value, unit, currency,
scale, as_of_date, period_start, period_end, period_type, frequency, classification,
source_type, source_name, page_table, provider, retrieved_date, book_of_record, return_method,
gross_net, valuation_status, benchmark_id, method_id, quality_status, note.

## Known limitations

- openpyxl writes formulas without cached values; the QA step opens the workbook in Excel,
  recalculates, verifies against an independent Python recomputation
  (`outputs/expected_values.json`), and saves so cached values exist for downstream readers.
- Excel does not resolve a *bare* table name written directly into XML (`ROWS(TableName)` →
  `#NAME?`); all table formulas therefore use explicit column references.
- The PDF renders under `outputs/renders/` are fit-to-width print artifacts; wide tracker sheets
  are designed for on-screen use with frozen panes, not print.
