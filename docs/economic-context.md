# Economic Context — public macro data beside the fund

The Economic Context tab (`#/macro`, nav label "Economy") answers three questions for the
investment office: **where the U.S. economy sits** against its long-run norms, **which way it is
moving**, and **which of the fund's policy sleeves today's readings lean against** under stated
assumptions. It is market context. It is kept apart from portfolio performance, and nothing on it
is a LACERA return, a forecast, or a recommendation.

The tab combines two exploratory dashboards built outside this repository in September 2026:

| Taken from | What | Changed on the way in |
|---|---|---|
| Economic regime dashboard (ChatGPT) | Six-question indicator board with each series at its own date; calendar-matched year-over-year changes, missing stays missing; staleness by frequency; direction rules over core PCE, unemployment and payrolls (±0.15 pp, +0.15/+0.10 pp); common-date Treasury curve against one month and one year earlier; transmission-channel sentences; 1Y/3Y/5Y history; sources and methodology | ICE BofA spreads replaced (terms forbid republication); the site reads a dated snapshot instead of calling FRED through a server-side key; the regime is paired with a level read rather than standing alone |
| Sleeve Exposure Monitor (Claude) | Seven factors as the mean of signed component z-scores since 1995; 60-month factor history; stated sensitivity grid; exposure = Σ sensitivity × factor z; drill-down from the fund to category, asset class, factor and series; explicit caveats | Moody's Baa and University of Michigan series replaced (terms); oil and gas as year-over-year changes, not price levels; sleeves and weights from IPS Table 1 for the selected fund instead of scaled sub-weights, which adds Non-Core Real Estate and Diversified Hedge Funds rows; a quadrant is named only outside the ±0.5 σ band |

## Layout and interaction

Four sub-tabs (`?tab=`): **Summary** (the four headline reads, the regime map and the direction
rules), **Factors & lens** (the portfolio lens with its what-if control, and the seven factors),
**Indicators** (the board, history and the Treasury curve with transmission channels) and
**Sources & method**. The page states once, in its "About these figures" line, that figures are
`calculated` unless marked; reported levels, proxy estimates and stale series are marked where
they appear. FRED is cited once at the page foot; panel chips cite anything else (IPS Table 1).

- **What if?** On the lens, seven sliders set factor readings (±3 σ in quarter steps); the sleeves
  re-rank as they move and the scenario is kept in the address (`?s=realrates:-2`). The panel is
  marked "Scenario — not observed" and "Reset to observed" clears it. Only the latest readings
  change (`withScenario`); results remain proxy estimates.
- **History** zooms to a dragged range of months ("Reset zoom" or Escape returns); the values
  table lists every month in the chosen 1Y/3Y/5Y range.
- **Charts** read out a point under the pointer or with the arrow keys; the curve's legend keys
  show or hide each date's curve.

## Files

| Path | Role | Maintained by |
|---|---|---|
| `tools/fetch_macro_snapshot.py` | Pulls the allowlisted series from the FRED API, re-checks every series' notes for redistribution restrictions, aborts on a restricted or discontinued series, pads monthly arrays to the calendar, and writes the two fixture files | code |
| `app/src/fixtures/macroSnapshot.data.ts` | Raw observations only: monthly averages since January 1994, native daily and weekly observations for the last 400 days, the latest monthly observation, series metadata, the excluded list with reasons | **generated**, one JSON line, excluded from Prettier |
| `app/src/fixtures/macroSnapshot.meta.ts` | Retrieval date, last complete month, series count — read by the site header without loading the snapshot | **generated** |
| `app/src/lib/macro/series.ts` | Month arithmetic, transforms (level, YoY, 3-month annualised, monthly change, bps), z-score parameters, carry-forward, staleness | code |
| `app/src/lib/macro/factors.ts` | The seven factor definitions and their 60-month history | code |
| `app/src/lib/macro/regime.ts` | Level read (quadrant, near-norm band) and direction rules | code |
| `app/src/lib/macro/lens.ts` | Stated sensitivities, IPS Table 1 structure, asset / category / fund exposures, illustrative scenarios (`withScenario`, `parseScenario`) | code |
| `app/src/lib/macro/board.ts` | Indicator board definitions and readings, Treasury curves on common dates, transmission channels | code |
| `app/src/lib/macro/macro.test.ts` | 22 tests: scenario arithmetic and address-bar parsing, transform arithmetic, missing-base handling, z-score window, staleness, rules, quadrant naming, lens reconciliation, calendar alignment of the snapshot, no excluded series, no credential material | code |
| `app/src/views/MacroView.tsx`, `app/src/components/MacroCharts.tsx` | The tab and its SVG charts (lazy-loaded with the snapshot) | code |

## Refreshing the snapshot

The site never calls FRED and holds no key. To refresh:

```bash
# key from the environment (preferred) or from the untracked, git-ignored regime-dashboard/fred_key.txt
set FRED_API_KEY=...        # PowerShell: $env:FRED_API_KEY = '...'
python tools/fetch_macro_snapshot.py
cd app && npm test && npm run build
```

The tool prints one line per series and the retrieval date. It stops, and writes nothing, if an
allowlisted series' FRED notes gain restriction language or a series has not been updated in 400
days. Review the diff of the two fixture files, check the rendered tab, and record the refresh in
`CHANGELOG.md`. Never paste the key into a prompt, a commit, a screenshot or an output file; the
tool scrubs it from error messages.

## Data and terms

- **Provider:** Federal Reserve Economic Data (FRED), Federal Reserve Bank of St. Louis. Each
  series keeps its original source (BLS, BEA, Federal Reserve Board, Chicago Fed, St. Louis Fed,
  EIA, Census, Employment and Training Administration), shown in the Sources table with a link
  to the FRED series page.
- **Used (38):** series whose FRED notes carry no redistribution restriction as of the retrieval
  date.
- **Left out (7):** ICE BofA US High Yield, US Corporate and CCC & Lower option-adjusted spreads
  (ICE: reproduction prohibited without prior written permission); Moody's Baa minus 10-year
  (proprietary); IMF copper price and University of Michigan sentiment (copyright, reprinted with
  permission); the Philadelphia Fed leading index (discontinued in 2020). The tab lists all seven
  with the reason, so the omission is visible rather than silent.

## Method

**Monthly values.** FRED's monthly averages for daily and weekly series; native values for
monthly series. A month the source did not publish (for example October 2025) is `null` and
stays a gap in every line and every change.

**Transforms.** Year-over-year compares the same calendar month; a missing base month yields
no value, never a neighbouring month. The payrolls growth input is the three-month change,
annualised. Board changes: daily and weekly series against the last observation at least 30
days earlier; monthly series against the prior month.

**Z-scores.** (value − mean) ÷ standard deviation of the series' own history from January 1995,
or its first month if later, to the last complete month before retrieval. At least 36
observations are required. The same parameters are applied to every month of the history, so
earlier points use today's yardstick (a look-ahead that is stated on the page).

**Factors.** Equal-weighted mean of signed component z-scores, reported for a month only when at
least half the components are present; a monthly release that has not reached the month is
carried forward for at most three months, and the component table shows which month was used.

| Factor | Components (sign) |
|---|---|
| Growth | Industrial production YoY, retail sales YoY, payrolls 3-month annualised, initial claims 4-week average (−), capacity utilisation, NFCI (−), housing starts YoY |
| Inflation | Core PCE YoY, core CPI YoY, PPI all commodities YoY, 5y5y forward inflation expectation, average hourly earnings YoY, PPI industrial commodities YoY |
| Real rates | 10-year TIPS yield, 10-year and 30-year Treasury yields |
| Credit conditions | NFCI credit subindex, NFCI risk subindex, St. Louis Fed Financial Stress Index (higher = tighter) |
| Commodities | WTI YoY, Henry Hub YoY, PPI industrial commodities YoY, PPI metals YoY |
| Curve slope | 10-year minus 3-month, 10-year minus 2-year |
| U.S. dollar | Nominal broad dollar index |

**Level read.** Growth z against inflation z. Within ±0.5 σ a reading is "near the norm" and no
quadrant is named on its sign: the page says the reading is on the border between two quadrants,
or near the centre.

**Direction read.** On the latest month in which core PCE, unemployment and payrolls are all
published (and not stale): inflation *rising* if core PCE YoY rose more than 0.15 pp over three
months, *easing* if it fell more than 0.15 pp, else *steady*; labour *softening* if the
three-month average unemployment rate is 0.15 pp or more above the prior three months or average
payroll change is negative, *firm* if 0.10 pp or less with positive payrolls, else *mixed*. Label
"Mixed signals" whenever inflation is steady or labour is mixed.

**Portfolio lens (proxy estimate).** Exposure of an asset class = Σ over the seven factors of
stated sensitivity × factor z. Categories and the total fund are the IPS Table 1 long-term
target-weighted averages (Pension: IPS restated June 12, 2024; OPEB: OPEB IPS). Sensitivities
are analyst priors in [−1, +1], not estimated from LACERA returns; the full grid is on the page.
The ten rows from the Sleeve Exposure Monitor are kept as set; Non-Core Real Estate
`[0.6, 0.3, −1.0, −0.6, 0.1, 0, −0.1]` and Diversified Hedge Funds `[0.2, 0, −0.1, −0.3, 0, 0, 0]`
were added so every IPS sleeve has a row, and are marked on the page.

**Staleness.** Against the retrieval date, not the viewer's clock: daily series after 7 days,
weekly after 21, monthly 60 days after the observation month ends. A stale board item carries the
`stale` classification; a stale direction input suppresses the direction read.

## Classifications

| Figure | Classification |
|---|---|
| Board levels and rescaled levels (%, bps, thousands, index) at a native date; Treasury curve | `reported_public` |
| Year-over-year and monthly changes; monthly averages of daily or weekly series in the history chart; factor z-scores; level and direction reads; transmission sentences | `calculated` |
| Portfolio lens exposures and drivers | `proxy_estimate` |
| A board item past its staleness threshold | `stale` |

## Limitations

- A dated snapshot. The page states the retrieval date and does not update itself.
- Z-scores depend on the window and use the full sample; the history is not a real-time record.
- The factor set, component choices, near-norm band and rule thresholds are analyst assumptions.
- The lens uses policy targets, not holdings; it ignores actual weights, overlays, currency hedges,
  private-market valuation lags and manager selection. Real rates carry large negative
  sensitivities in most sleeves, so a high real-rate reading dominates the total.
- U.S. data only; no non-U.S. growth, inflation or currency factors.
- Nothing here is combined with the fiscal-year tabs or the CIO Monthly tab.
