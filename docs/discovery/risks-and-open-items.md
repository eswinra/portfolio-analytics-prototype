# Risks and Open Items

Stage: Discovery documentation.

## Finance risks

| Risk | Mitigation |
|---|---|
| Synthetic figures mistaken for official performance | Persistent disclaimer; `synthetic` badges on every value; entity id `DEMOFUND`; no LACERA branding on data surfaces |
| Contribution that fails to reconcile | Beginning-weight methodology; visible residual vs documented tolerance; test coverage; "excluded components" line item |
| Benchmark mismatch (period/lag/version) | Benchmark id + effective date + lag fields; comparisons blocked on mismatch |
| Averaging component returns | No such code path; calculation module computes weighted results only; unit test asserts the counter-example |
| Wrong annualization | Annualize only >1Y periods; method documented per metric |
| TWR/MWR/market-value-change conflation | Separate metric ids; labels carried from contract to UI |

## Data risks

| Risk | Mitigation |
|---|---|
| Double-ingesting the same metric from overlapping reports (FY25 return appears in ACFR, quarterly, monthly) | Duplicate detection on (entity, metric, period, as-of, source); one designated authority per metric |
| Mixed vintages aggregated silently | Hard rejection rule; per-dataset as-of surfaced in the data-trust strip |
| Book-of-record confusion | `book_of_record` required on all balance metrics |
| Malformed user imports producing partial state | All-or-nothing import; row-level rejection report; app state unchanged on failure |

## Security / confidentiality / licensing risks

| Risk | Mitigation |
|---|---|
| Reference files or local paths leaking into the repo | `reference/` ignored and deny-listed; release audit uses `git ls-files` evidence; relative paths only in committed files |
| Republishing licensed data (Alpaca prices, InvMetrics percentiles, index series) | Replaced by synthetic series; peer universe excluded; index names used nominatively with attribution only |
| Implied LACERA endorsement | Neutral prototype branding; explicit not-an-official-system statement in app and README |
| Secrets/telemetry creep | No env files, no analytics, no external requests; CI workflow with minimal permissions and no API keys |
| Manager/holdings detail (public in PDFs but confidentiality-adjacent) | Excluded from prototype scope entirely |

## Usability / presentation risks

| Risk | Mitigation |
|---|---|
| Number-wall density on a conference screen | One headline view, four drill-downs; compact tables over decorative charts |
| Color-only status encoding | Icon + text + color everywhere; contrast-checked palette |
| Illegible dates/units | As-of, unit, currency, period rendered with every metric block |
| Retail-trading look | Institutional visual language; no buy/sell framing; restrained animation |

## Open items (with default recommendations)

1. **Relative weight of the ACFR workflow view vs performance views.** Default: performance
   first, workflow as one of four drill-downs. Would change if the PA team says ACFR-season
   coordination is the sharper pain point.
2. **Demo period span.** Default: 12 synthetic months (July 2025–June 2026 demo fiscal year)
   plus one daily market strip month, so FYTD/QTD/1Y all have meaning.
3. **Repository name/visibility.** Deferred to the release stage; nothing remote happens without
   explicit approval.
4. **OPEB parallel views.** Default: single synthetic fund in v1; the contract carries an entity
   dimension so an OPEB-like second entity can be added without schema change.
