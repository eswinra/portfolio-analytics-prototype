# Data Contract — Workbook ↔ Web Prototype Interface

Schema version: **1.3.0** (semver; `schema_version` column on every record). The web prototype
consumes only this contract — never workbook presentation cells. Canonical valid instance:
`data/sample/demofund_export_v1.csv` (376 records; OPEB twin `demo_opeb_export_v1.csv`; ACFR
tracker `demo_acfr_status_v1.csv`).

## 1.3.0 additions (2026-08-13) — reconciliation, ACFR workflow, private markets

Six record types; the column set is unchanged from 1.2 (minor-version gating unchanged:
32 columns ⇒ schema_version 1.2+).

- `recon_value` — one row per SOURCE side of a reconciliation pair; the two sides share
  (entity, metric_id, category_id, as_of) and differ in `source_name` (generic labels:
  `internal_book`, `custodian_feed`). **The variance is always computed by the app, never
  imported.** V05's natural key includes `source_name` for this type only; V23 caps a key at
  two sources.
- `tolerance_definition` — per-metric absolute threshold as data (`value` ≥ 0, V23):
  tolerance-as-data, so thresholds are configurable without a settings store.
- `acfr_section_status` — one row PER STATUS CHANGE of an ACFR section (`category_id` =
  FIN/INV/ACT/STAT/INTRO; `value` = status token, V22 enum: not_started / in_progress /
  in_review / ready_signoff / complete; `page_table` = draft version; `period_end` = due
  date). Latest row per section is the state; the full history is the change log — the file
  is the record. Lives in its own single-entity tracker file (V17).
- `acfr_artifact_link` — links + metadata only, never files (`metric_id` = per-artifact slug;
  `source_name` = title; `value` 1 + ok = received, blank + missing = outstanding;
  `note` = link, synthetic placeholders in public fixtures).
- `pm_commitment` / `pm_capital_account` — private-markets primitives per sleeve
  (commitment_total, called_itd, distributed_itd, nav in $mm). **Unfunded, DPI and TVPI are
  computed by the app**; NAV rows carry `valuation_status=lagged` and a lag note.

## 1.2.0 additions (2026-08-06) — provenance

Three columns append after `schema_version` (the 29-column prefix of 1.0/1.1 files is
untouched):

- `entered_by` — who keyed the row (initials or role label). **Public fixtures carry
  synthetic actor labels only** (`PA-ANALYST-1`); real initials belong in the team's own
  local imports, which never leave the browser.
- `reviewed_by` — who reviewed the row; required once `review_status` is `reviewed` or
  `published` (V20).
- `review_status` — enum `draft` / `reviewed` / `published` / `n/a` (blank ≡ n/a, V21). Any
  `draft` row raises a visible banner in the app and an informational exception.

**Version gating (V02, amended):** a file's column set must be exactly the 29 base columns
*or* the 32-column set — all three provenance columns or none. 32 columns require every row
to declare `schema_version` 1.2.x; 29 columns require 1.0.x/1.1.x. Mismatches reject.
`entered_by` is required on `source_type=user_import` rows in 1.2 files (V19).

**The audit log is the file:** there is no separate log store. Rows carry who/when; the app
derives its Team Activity panel and draft census purely from the records, consistent with
the history-in-the-file architecture.

## 1.1.0 additions (2026-08-06)

Two record types carry the quoted IPS policy structure with the dataset (both classified
`reported_public` with page-level citations — V15 allows the quotation types only):

- `policy_target` — grain: entity x policy class x metric, where metric_id is one of
  `policy_min` / `policy_target` / `policy_max` / `policy_halfstep` (explicit bounds; never
  reconstruct from a +/- half-width — Pension Cash is 0-3% around a 1% target). No period span;
  the effective date is stated in `note`.
- `benchmark_definition` — metric_id `benchmark_lag_months` (numeric), formula text in `note`,
  `benchmark_id` linking the series records.

The app builds allocation bands from `policy_target` records when present (`policySource:
"dataset"`), falling back to the app-bundled pack for 1.0.x files. Column set unchanged; 1.0.x
files remain valid.

## Shape

One flat CSV/table; one record per row; 29 columns exactly (order not significant, names are);
UTF-8; ISO-8601 dates (civil dates, no time zone component — market closes are US business
days, monthly records use month-end dates).

## Record types

| record_type | Grain | Value semantics |
|---|---|---|
| `monthly_return` | entity × category(+TOTAL) × month | decimal monthly net return |
| `monthly_benchmark_return` | entity × category(+TOTAL) × month | decimal benchmark return |
| `period_return` | entity × TOTAL × {1M, QTD, FYTD} × {net_return, bench_return, hurdle_return} | decimal period return |
| `allocation` | entity × category × {emv, weight_actual, weight_target, over_under_pct} at as-of | $mm or decimal weight |
| `contribution_qtd` | entity × category (+ arith total, chain-linked, residual) | decimal contribution |
| `market_close` | proxy × business day | synthetic price level |
| `public_reference` | cited public value | as cited (unit varies) |
| `check_result` | control id | status string PASS/WARN/FAIL |

Aggregate note: `period_return`(1M) intentionally equals `monthly_return`(TOTAL, final month) —
aggregates are a *view* for tiles; series records feed charts. They differ by `metric_id` and
`record_type`, so they are not duplicates under the key below, and the app must never sum
across record types.

## Identity and duplicate detection

Natural key: `(record_type, entity_id, metric_id, category_id, as_of_date, period_start,
period_end)`. Imports containing two rows with the same natural key are rejected (see
`docs/import-validation-rules.md`). `record_id` must also be unique per file.

## Required vs optional fields

Required on every record: `record_id`, `record_type`, `entity_id`, `metric_id`, `value` *or*
`quality_status=missing`, `unit`, `currency`, `scale`, `as_of_date`, `classification`,
`source_type`, `source_name`, `provider`, `retrieved_date`, `quality_status`, `schema_version`.
Conditionally required: `category_id` (all except `public_reference`); `period_start/end/type`
(all return/contribution records); `book_of_record`, `return_method`, `gross_net` (return
records); `benchmark_id` (benchmark records); `page_table` (`public_reference` records).
Optional: `valuation_status` (defaults `final`), `method_id`, `note`.

## Safe null behavior

An empty `value` is legal **only** when `quality_status = missing`; the app renders an explicit
missing state and excludes the record from every calculation. Any other empty required field
rejects the file. Nulls are never coerced to 0. A `stale` state is *derived* by the consumer
(record age vs `frequency` — thresholds in `docs/data-dictionary.md`), not asserted in data.

## Period compatibility

- Returns combine only by chain-linking within one (`entity_id`, `category_id`, `metric_id`)
  series of contiguous equal `period_type` records; gaps break the chain and the affected
  aggregate reports missing.
- Portfolio vs benchmark comparisons require identical `period_start`, `period_end`, and
  `period_type`.
- Records with different `as_of_date` never aggregate; the UI shows per-dataset as-of.

## Versioning and rejection

- Major version mismatch (e.g., `2.x` file into a `1.x` app) → reject whole file.
- Minor/patch above the app's known version → accept known columns, warn.
- Unknown `record_type` / `classification` / `period_type` token → reject file (closed enums).
- Import is all-or-nothing: any rejection leaves prior app state untouched and produces a
  row-level error report.

## Enums

- `classification`: `reported_public` | `synthetic` | `proxy_estimate` | `calculated`
  (data-state overlays `stale`/`missing` are carried in `quality_status` or derived).
- `quality_status`: `ok` | `missing` | (reserved: `estimated`, `exception:<reason>`).
- `period_type`: `D` | `M` | `Q` | `FY` | `1M` | `QTD` | `FYTD` | `1Y` | `ITD`.
- `book_of_record`: `IBOR` | `ABOR` | `n/a`. `return_method`: `TWR` | `MWR` | `n/a`.
  `gross_net`: `gross` | `net` | `n/a`. `source_type`: `workbook` | `public_report` |
  `synthetic_generator` | `user_import`.

## Fixtures

`data/sample/demofund_export_v1.csv` — deterministic, wholly synthetic (entity `DEMOFUND`),
regenerated only via `tools/build_workbook.py` → `tools/qa_excel.py` → `tools/make_fixtures.py`.
`data/sample/invalid/*.csv` — eight malformed variants, one named defect each, used as
validator test vectors.
