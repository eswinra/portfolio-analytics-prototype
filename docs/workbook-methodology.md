# Workbook Methodology

All portfolio figures describe the synthetic entity `DEMOFUND`. Demo fiscal year:
July 2025 – June 2026; as-of date 2026-06-30 (`AsOfDate`). Nothing here is an actual LACERA
value or method statement.

## Market values and weights

- `BMV(cat, m)` — beginning market value: month 1 from `Inputs_Portfolio` initial values;
  thereafter `BMV(cat, m) = EMV(cat, m−1)`.
- `EMV(cat, m) = BMV(cat, m) × (1 + r(cat, m)) + transfer(cat, m)` where transfers are
  end-of-month internal reallocations that net to zero across categories each month (CHK-05).
  Because transfers net to zero and occur at month-end, the total-fund monthly return is exactly
  the weighted sum of category returns.
- `w(cat, m) = BMV(cat, m) / Σ BMV(·, m)` — valid beginning-of-period weights (CHK-01 asserts
  Σw = 100% every month).

## Returns

- Category monthly returns are synthetic net TWR-style inputs (decimals).
- Total fund monthly return: `r_TF(m) = Σ w(cat, m) × r(cat, m)` — a weighted sum with valid
  beginning weights, **never** an average of category returns.
- Multi-month periods are chain-linked through a growth index `G(m) = G(m−1) × (1 + r_TF(m))`:
  QTD = `G(Jun)/G(Mar) − 1`; FYTD = `G(Jun) − 1`. At fiscal year-end FYTD equals 1Y and is
  labeled as such. No annualization is applied (no period exceeds one year).
- Benchmark: category benchmark returns are synthetic inputs; the total benchmark is the
  policy-weighted sum using **effective-dated** weights (v1 for months starting before
  2026-01-01, v2 after), then chain-linked identically.
- Hurdle: a synthetic annual assumption `h` (6.75%) scaled geometrically:
  monthly `(1+h)^(1/12) − 1`, quarterly `(1+h)^(3/12) − 1`.

## Contribution and reconciliation

- Monthly contribution `c(cat, m) = w(cat, m) × r(cat, m)`; QTD contribution per category is the
  arithmetic sum over Apr–Jun 2026.
- The arithmetic total intentionally differs from the chain-linked QTD return by the
  **compounding residual**, which is displayed, exported, and tested: |residual| ≤ 10 bps
  (visible tolerance cell). Result in this build: residual = 0.052%, PASS.
- All six categories (including Overlays & Hedges and Other Asset) are included, so no
  contribution is hidden; this deliberately differs from the public quarterly report's
  presentation, where overlay contribution is excluded by footnote — the workbook shows how the
  same fact can be made visible instead.

## Allocation

- Actual weight = category EMV / total EMV at `AsOfDate`; target from the policy version
  effective at `AsOfDate`; over/under in % and $mm; range status vs the ± range columns.
  Overlays/Other have no policy weight and are labeled `n/a` rather than compared.

## Data-quality model

- `stale` / `missing` are demonstrated with real mechanics: DEMO-OIL lacks its final close
  (missing), DEMO-USD stops two business days early (stale). CHK-06/CHK-07 flag WARN with
  explanations; the executive view and export carry the states.
- Classification is carried per record (`reported_public` only on `Inputs_Public` rows quoted
  from cited public documents; everything else `synthetic` or `calculated`).

## Deliberate differences from actual published methodology

The public reports document net-of-fee TWR with 1–3 month lagged private-market benchmarks,
IBOR/ABOR distinctions, and MWR schedules. The workbook demonstrates the *shape* of those
disciplines on synthetic monthly data; it does not attempt lagged-benchmark arithmetic, MWR/IRR,
fee schedules, or book-of-record reconciliation. Those appear in the data contract as fields
(`book_of_record`, `return_method`, lag flags) so the future authorized version can populate
them from real systems.
