# Workbook QA Evidence

## Stage 4 — independent audit (2026-08-04)

Auditor pass separate from the build QA: reads only the workbook file, recomputes the entire
calculation chain from the Inputs sheets with independent code, and audits structure and the
export table (`tools/`-independent script; findings below).

**Recomputation:** all 12 monthly TF returns, benchmark returns with effective-dated policy
weights, QTD/FYTD chain-links, all six category contributions, residual, and all allocation
weights/targets tie to Excel's cached values within 1e-9. Contribution residual 0.052% ≤ 10 bp
tolerance. Transfers net to zero every month. No error values on any sheet; no hardcoded
constants inside calculation areas; formula patterns consistent down every 12-row grid column.

**Findings and dispositions:**

| # | Finding | Severity | Disposition |
|---|---|---|---|
| A1 | `public_reference` rows with `$K`/`$B` units carried `scale="1"` | Warning (metadata) | **Fixed** — generator now maps unit→scale (`$K`→`k`, `$mm`→`mm`, `$B`→`bn`); workbook rebuilt, re-QA'd |
| A2 | openpyxl reports 0 data validations on Crosswalk/QA_Checklist | Warning (tooling) | **Not a defect** — Excel stores cross-sheet list validations in the x14 extension block (verified present with correct ranges/sources in raw sheet XML); openpyxl cannot read that block. Same storage form as the starter workbook. |
| A3 | Flat CSV interface had no in-band schema version | Improvement | **Fixed** — `schema_version` column (29th) added to `Export_Contract` and the contract |

Post-fix re-run: build → Excel QA (all values OK, 10/2/0 checks) → audit (0 critical,
0 warning apart from A2's documented tooling limitation). Reference workbook hash re-verified
unchanged (`120d466f…c793d32`).

## Stage 3 build QA

Build: `tools/build_workbook.py` (deterministic, seed 20260630).
QA: `tools/qa_excel.py` — opens the workbook in desktop Excel via COM, forces
`CalculateFullRebuild`, compares against an independent Python recomputation
(`outputs/expected_values.json`), scans every sheet for formula errors, renders every sheet to
PDF (`outputs/renders/`), and saves so cached values persist.

## Reference integrity

- `reference/Portfolio_Analytics_Market_Pulse_ACFR_Starter.xlsx` SHA-256
  `120d466ff8fadf73a02ac1b9756145cd916cfac4ee7eef07a091c8dc4c793d32`
  recorded before work and re-verified after the final export — **unchanged**.

## Formula verification (Excel recalculation vs independent Python recomputation)

| Value | Excel | Python | Match |
|---|---|---|---|
| TF 1M return | 0.006177 | 0.006177 | ✔ |
| TF QTD return | 0.041658 | 0.041658 | ✔ |
| TF FYTD return | 0.124117 | 0.124117 | ✔ |
| Benchmark 1M / QTD / FYTD | 0.005906 / 0.043344 / 0.125730 | same | ✔ |
| Contribution residual | 0.000521 | 0.000521 | ✔ |
| All 12 monthly TF returns | grid | grid | ✔ (≤1e-9) |
| Allocation weights (6 categories) | grid | grid | ✔ (≤1e-9) |

Trace of the highest-impact chain (spot-audited by hand): Jun 2026 TF return =
Σ w(Jun)×r(Jun) with w from BMV grid; QTD = index(Jun)/index(Mar)−1 = 1.1241/1.0792−1 = 4.17%;
contribution arithmetic total 4.11% + residual 0.05% = chain-linked 4.17%. ✔

## Control results (final build)

CHK-01…CHK-05, CHK-08…CHK-12: **PASS**. CHK-06 (3 missing closes) and CHK-07 (2 proxies without
final-day data): **WARN — deliberate demo states**, documented on `README` and `Checks`.
Roll-up: 10 PASS / 2 WARN / 0 FAIL. Error scan: zero `#REF!/#VALUE!/#DIV/0!/#NAME?` cells on any
sheet.

## Defects found and fixed during the build

| # | Defect | Fix |
|---|---|---|
| 1 | `ROWS(TableName)` with a bare table name written via openpyxl evaluates to `#NAME?` in Excel (9 dependent cells errored) | All table formulas rewritten to explicit column references, e.g. `ROWS(ACFRCrosswalkTable[Section])` |
| 2 | Export-count check based on `COUNTA(A:A)` minus a header constant miscounted title rows | Replaced with `COUNTIF(A:A,"REC-*")` |
| 3 | Data-validation formulas carried a leading `=` (potentially ignored) | Removed |
| 4 | Checks summary labels clipped by adjacent bordered cells | Labels moved to the description column |
| 5 | Wrapped tracker rows clipped at default row height | Explicit row heights on Crosswalk / QA_Checklist / Inputs_Public |

## Visual QA (rendered PDFs, `outputs/renders/`)

Inspected every sheet. Exec_View, Calc_Returns, Calc_Contribution, Calc_Allocation, Checks,
README, Inputs_*, Policy_Targets: readable, no clipping, statuses color-coded with text.
Crosswalk/QA_Checklist: full content present; the one-page-wide print render is small by
design — these sheets are built for on-screen use (frozen panes, 42/28 pt rows). Export_Contract
prints tiny (28 columns) — it is a machine interface, not a presentation sheet.

## Limitations

- QA depends on desktop Excel (COM); on a machine without Excel, `tools/build_workbook.py`
  still reproduces the workbook byte-logic but cached values/renders require Excel or
  LibreOffice (not installed here).
- Conditional-format colors were verified in the rendered PDFs for the status columns; Excel's
  in-app filter/validation dropdowns were not exercised programmatically.
