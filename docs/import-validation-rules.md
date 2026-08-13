# Import Validation Rules — schema 1.0.0

Applies to every dataset entering the web prototype: the bundled fixture at build time and
user CSV imports at runtime (parsed entirely in the browser; content never transmitted).
Import is **all-or-nothing**: any Reject finding aborts the import, leaves existing app state
untouched, and produces a row-level report (row number, column, rule id, message). Warn
findings import with visible flags.

## Rule table

| # | Rule | Severity | Test fixture |
|---|---|---|---|
| V01 | File parses as CSV, UTF-8, with a header row | Reject | — |
| V02 | All required columns present (unknown extra columns → Warn) | Reject | `invalid/missing_column.csv` |
| V03 | `schema_version` present and major version = 1 | Reject | `invalid/bad_schema_version.csv` |
| V04 | `record_id` unique within file | Reject | `invalid/duplicate_records.csv` |
| V05 | Natural key `(record_type, entity_id, metric_id, category_id, as_of_date, period_start, period_end)` unique | Reject | `invalid/duplicate_records.csv` |
| V06 | Enum columns contain only allowed tokens (`record_type`, `classification`, `period_type`, `quality_status`, `book_of_record`, `return_method`, `gross_net`, `frequency`, `source_type`) | Reject | `invalid/bad_classification.csv` |
| V07 | Numeric columns parse as finite numbers where `quality_status ≠ missing` | Reject | `invalid/bad_number.csv` |
| V08 | Empty `value` requires `quality_status = missing`; a non-empty value flagged `missing` is **discarded** (nulled) with a Warn — it can never render numerically | Reject/Warn | `invalid/blank_value_flagged_ok.csv` |
| V09 | `period_start ≤ period_end` (all records); start and end both present for return/contribution record types — balance, market and check records may carry a descriptive `period_type` without a span | Reject | `invalid/period_start_after_end.csv` |
| V10 | Percent plausibility: `unit=%` values on **return/contribution record types only** must satisfy \|v\| ≤ 0.60 (catches whole-number-percent files; allocation weights and other % levels may legitimately exceed the bound) | Reject | `invalid/whole_number_percent.csv` |
| V11 | Dates valid ISO-8601; `retrieved_date ≥ as_of_date` for `public_reference` → else Warn | Reject/Warn | — |
| V12 | Monthly series contiguity per (entity, category, metric): gaps → Warn, affected aggregates render missing | Warn | — |
| V13 | Weight coherence: `allocation` `weight_actual` values per (entity, as_of) sum to 1 ± 0.0001 | Reject | — |
| V14 | Contribution coherence: `contribution_qtd` categories + residual reconcile to `return_chain_linked` within the residual record ± 0.0001 | Reject | — |
| V15 | `reported_public` classification allowed only on quotation record types (`public_reference`, `policy_target`, `benchmark_definition`) | Reject | — |
| V16 | Mixed vintages: within one `record_type`+`metric_id` series, `as_of_date` must be single-valued for balance records (`allocation`) | Reject | — |
| V17 | Exactly **one** portfolio entity per file (`public_reference` citation rows exempt): multi-entity files are rejected outright — no silent blending; a single unknown entity → Warn banner | Reject/Warn | — |
| V18 | File size ≤ 5 MB, ≤ 20,000 rows (prototype bounds) | Reject | — |
| V19 | Schema 1.2 files: `entered_by` non-blank on every `source_type=user_import` row | Reject | — |
| V20 | `reviewed_by` non-blank whenever `review_status` ∈ {`reviewed`, `published`} | Reject | — |
| V21 | `review_status` ∈ {`draft`, `reviewed`, `published`, `n/a`} or blank (≡ n/a) | Reject | — |

V02 (amended for 1.2): the header must be exactly the 29 base columns or the 32-column set
including `entered_by`/`reviewed_by`/`review_status` — a partial provenance header rejects.
The declared `schema_version` must match the column set on every row (32 cols ⇒ 1.2.x;
29 cols ⇒ 1.0.x/1.1.x).

## Error-report format

`{ ruleId, severity, row, column, message, value }` — surfaced in the import drawer, sorted by
severity then row; downloadable as CSV from the UI. The report never echoes more than the
offending cell value.

## Security notes

- Parsing uses PapaParse with `download:false`, worker mode, and no dynamic typing beyond the
  schema (numbers parsed explicitly per column).
- Formula-looking strings (`=`, `+`, `-`, `@` prefixes) are treated as plain text everywhere
  and re-escaped if exported back to CSV (CSV-injection defense).
- No imported content is placed into `innerHTML`; rendering is text-node only.
- Imported data lives only in page memory; no storage, no network.
