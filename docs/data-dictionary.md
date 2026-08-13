# Data Dictionary — schema 1.1.0

One row per column of the export/import table. "Req" = required (C = conditionally, see
`docs/data-contract.md`).

| Column | Type | Req | Definition / allowed values |
|---|---|---|---|
| `record_id` | string | ✔ | Unique per file, `REC-nnnn` in fixtures. Opaque identifier only. |
| `record_type` | enum | ✔ | `monthly_return`, `monthly_benchmark_return`, `period_return`, `allocation`, `contribution_qtd`, `market_close`, `public_reference`, `check_result`, `policy_target`, `benchmark_definition` (schema 1.1) |
| `entity_id` | string | ✔ | Synthetic entity id (`DEMOFUND` in fixtures) for all record types **except** `public_reference`, where it names the cited public entity (e.g. "LACERA Pension Plan") so quotations are never attributed to the synthetic fund. |
| `metric_id` | string | ✔ | e.g. `net_return_m`, `bench_return_m`, `net_return`, `bench_return`, `hurdle_return`, `emv`, `weight_actual`, `weight_target`, `over_under_pct`, `contribution`, `contribution_arith_total`, `return_chain_linked`, `residual`, `close`, check ids `CHK-nn`, or the quoted public metric name |
| `category_id` | string | C | `GROWTH`, `CREDIT`, `RAIH`, `RRM`, `OVERLAY`, `OTHER`, `TOTAL`; proxy ids (`DEMO-*`) for `market_close` |
| `value` | number \| status string \| empty | ✔* | Decimal fraction for % units (0.0417 = 4.17%); level for `px`; $ amount at `scale`; status text for `check_result`. Empty only with `quality_status=missing`. |
| `unit` | string | ✔ | `%`, `$mm`, `$K`, `$B`, `px`, `status` |
| `currency` | string | ✔ | ISO code; fixtures `USD` |
| `scale` | string | ✔ | `1`, `k`, `mm`, `bn` — multiplier implied by unit; `$mm`→`mm` etc. |
| `as_of_date` | date | ✔ | Observation/valuation date of the record |
| `period_start` / `period_end` | date | C | Inclusive civil dates; `start ≤ end`; month records use first/last day of month |
| `period_type` | enum | C | `D`,`M`,`Q`,`FY`,`1M`,`QTD`,`FYTD`,`1Y`,`ITD` |
| `frequency` | enum | ✔ | `Daily`, `Monthly`, `Quarterly`, `Annual`, `Ad Hoc` — drives staleness thresholds below |
| `classification` | enum | ✔ | `reported_public`, `synthetic`, `proxy_estimate`, `calculated` (origin; see data-state note) |
| `source_type` | enum | ✔ | `workbook`, `public_report`, `synthetic_generator`, `user_import` |
| `source_name` | string | ✔ | Sheet / document short name |
| `page_table` | string | C | Page/table citation; required for `public_reference` |
| `provider` | string | ✔ | e.g. `synthetic generator`, `workbook formulas`, `LACERA ACFR 2025`, `LACERA / Meketa` |
| `retrieved_date` | date | ✔ | When the value was captured |
| `book_of_record` | enum | C | `IBOR`, `ABOR`, `n/a` — balance/return basis |
| `return_method` | enum | C | `TWR`, `MWR`, `n/a` |
| `gross_net` | enum | C | `gross`, `net`, `n/a` |
| `valuation_status` | enum | opt | `final` (default), `preliminary`, `estimated` |
| `benchmark_id` | string | C | e.g. `BM-GROWTH`, `BM-TOTAL`; identifies the synthetic benchmark series and version |
| `method_id` | string | opt | Calculation method tag: `bop_weighted_sum`, `chain_linked`, `policy_weighted_sum`, `bop_weight_x_return_sum`, `geometric_scaling`, `monthly_net_return` |
| `quality_status` | enum | ✔ | `ok`, `missing`; reserved `estimated`, `exception:<reason>` |
| `note` | string | opt | Free text; for `market_close` carries the category read-through |
| `schema_version` | semver | ✔ | `1.0.0` |

## Data-state derivation (consumer-side)

`stale` if `as_of_date` is older than the newest record of its dataset by more than:
Daily → 1 business day; Monthly → 45 calendar days; Quarterly → 135 days; Annual → 450 days.
`missing` comes from `quality_status`. Origin classification and state render as separate
badges; `calculated` displays the weakest origin among its inputs (lineage via `method_id` +
`source_name`).

## Provenance columns (schema 1.2)

`entered_by` — who keyed the row (initials or role label; synthetic labels like
`PA-ANALYST-1` in public fixtures). Required on `user_import` rows (V19).
`reviewed_by` — reviewer; required when `review_status` is `reviewed`/`published` (V20).
`review_status` — `draft` · `reviewed` · `published` · `n/a` (blank ≡ n/a; V21). Draft rows
raise the app's draft banner. The in-app Data Dictionary panel (Import page) renders these
definitions from the validator's own constants and cannot drift from this document's intent.

## Category display names

`GROWTH` Growth · `CREDIT` Credit · `RAIH` Real Assets & Inflation Hedges · `RRM` Risk
Reduction & Mitigation · `OVERLAY` Overlays & Hedges · `OTHER` Other Asset · `TOTAL` Total
fund (synthetic DEMOFUND).
