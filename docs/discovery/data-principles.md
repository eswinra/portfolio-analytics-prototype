# Data Principles — Classification and Provenance Model

Stage: Discovery documentation. These principles bind every derived artifact (workbook, fixtures,
web prototype).

## Classification enum (exactly one per displayed value)

| Classification | Meaning | Rule |
|---|---|---|
| `reported_public` | Reproduced verbatim from a cited public source for the exact stated period | Requires source name, page/table, provider, as-of, retrieval date. Never applied to derived or re-based values. |
| `synthetic` | Invented demo data, deterministic and conspicuously labeled | Must be visually flagged everywhere it appears; must not be tuned to mimic undisclosed actual values |
| `proxy_estimate` | A public proxy standing in for an exposure (e.g., ETF as category proxy) | Never rendered as portfolio performance; always paired with "proxy" badge and its own source |
| `calculated` | Derived by a documented formula from other rows | Inherits the **weakest** input classification for trust display; formula/method id required |
| `stale` | Value valid but older than its freshness threshold | Derived state: age > 1.5 × stated frequency (documented per dataset); shown with original as-of |
| `missing` | Required input absent | Rendered as an explicit missing state; never as 0, blank, or interpolated |

`stale` and `missing` are *states* that overlay the origin classifications (`reported_public`,
`synthetic`, `proxy_estimate`, `calculated`); a value can be `synthetic` **and** `stale`. The
workbook and app carry origin and state as separate fields.

## Required provenance fields (per record)

- **Identity:** entity id (explicitly synthetic, e.g. `DEMOFUND`), metric id, category id.
- **Value:** value, unit, currency, scale (e.g., mm), sign convention.
- **Vintage:** as-of date, period start, period end, period type (`D`/`M`/`Q`/`FY`/`ITD`),
  frequency, time zone (dates are civil dates, market close US/Eastern where relevant).
- **Source:** source type (`public_report` / `synthetic_generator` / `user_import`), source
  name/file, page or table reference, provider, retrieval date.
- **Method:** book of record (`IBOR`/`ABOR`/`n/a`), return method (`TWR`/`MWR`/`n/a`),
  gross/net, fee basis, valuation status (`final`/`preliminary`/`estimated`), benchmark id +
  methodology version + effective date where applicable.
- **Quality:** validation status, exception reason, tolerance used, lineage (input row ids).

## Non-negotiable integrity rules

1. A total return is never the average of component returns; category weights must be valid
   beginning-of-period weights and contribution must reconcile to the displayed total within a
   documented tolerance, with the residual shown.
2. Portfolio and benchmark values compare only when period, currency, methodology, and effective
   policy version match; lagged benchmark components carry an explicit lag field.
3. Values with different as-of dates or period types never aggregate silently; mixed-vintage
   requests are rejected with an explanation, not coerced.
4. Market context (indexes/proxies) renders in a visually separate block from portfolio
   performance, with distinct labeling.
5. IBOR, ABOR, exposure, notional, and fiduciary-net-position figures are distinct metrics —
   never interchangeable, each labeled with its book.
6. TWR vs MWR, gross vs net, market-value change vs return are separate metric ids; the UI never
   relabels one as another.
7. Every displayed metric shows unit, currency, period, as-of, source, and classification either
   inline or one interaction away (tooltip/expand), and the disclaimer is persistent.
8. Uploaded files are parsed entirely in the browser; contents never leave the machine.

## Evidence this model is needed (from the reference set)

- Three different Pension "totals" for June 30, 2025 depending on book/scope (ACFR printed
  pp. 25, 108, 112) — see `source-inventory.md` §6.
- Total fund 1-year return is 9.7% / 11.8% / 15.1% across the three report vintages.
- Quarterly contribution components visibly do not sum to the total (overlays excluded by
  footnote) — reconciliation must be explicit, not assumed (quarterly report p.8).
- Policy benchmarks embed 1-month and 3-month lags (quarterly report pp. 187–190).
- The ACFR marks FY2025 actuarial fields "N/A — valuation not yet available" (printed p.112):
  even official documents ship with explicit missing states.
