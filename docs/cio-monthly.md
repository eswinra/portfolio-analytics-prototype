# CIO Monthly — the monthly report layer

The CIO Monthly tab (`#/cio`) and the slide deck present the figures of LACERA's public Chief
Investment Officer Monthly Report. Both read one fixture; nothing is typed twice. The deck is
presented two ways: inside the dashboard, fed live by the dashboard — the deck is the tab's first
view, so opening CIO Monthly shows the slides and the page's ← → keys step through them — and as
the standalone page at `/deck/` (latest public report).
This layer is a separate reporting vintage from the fiscal-year tabs (2025 PAFR/ACFR, IPS) and
is never combined with them: market value at a month end is not fiduciary net position at
June 30, and monthly periods are not fiscal-year horizons.

## Files

| Path | Role | Maintained by |
|---|---|---|
| `tools/extract_cio_report.py` | Reads a report PDF by word coordinates (never by text order), validates it against the identities the report prints, writes JSON, and emits the TypeScript vintage file — or, with `--append-ts`, adds one new report to it | code |
| `.github/workflows/cio-report.yml` | "CIO report": adds a new report from its lacera.gov link on GitHub and proposes it as a pull request (`add`); on that pull request, tidies the typed file, regenerates the deck block and runs the checks (`check`) | code |
| `app/src/fixtures/cioVintages.data.ts` | One entry per accepted report, oldest first: fund figures for both entities, the market table (2026 layouts), pages read, public URL | **generated** — do not edit |
| `tools/fetch_cio_macro.py` | Reads the macro strip's FRED series for every report as FRED showed them on the report's as-of date (real-time archive), checks each series' terms, writes raw values | code |
| `app/src/fixtures/cioMacro.data.ts` | FRED values per report: PCE and core PCE index levels a year apart, unemployment and participation rates, the federal funds target range and the day it took effect | **generated** — do not edit |
| `app/src/lib/cioMacro.ts` | `macroAsOf()` (the as-of rule), `yoy()`, `macroLines()`: the strip's three FRED lines | code |
| `app/src/fixtures/cioMonthly.data.ts` | Editorial content for the **latest** report only: the report's macro commentary, the dollar and themes lines, the macro figures as printed (checked against FRED), items for attention, period and bin labels, status labels; `EDITORIAL_FOR` names the report it belongs to | analyst, monthly |
| `app/src/fixtures/cioMonthly.ts` | Types, `CIO_VINTAGES`, `CIO_LATEST`, label helpers, `cioFor()` | code |
| `app/src/fixtures/deckData.ts` | Builds the standalone deck's data block from the latest vintage (`VINTAGE` labels included), declared with `let` so an embedded deck can take the dashboard's data instead | code |
| `app/src/lib/deckFeed.ts` | `deckDataFor(vintage)`: the data the dashboard hands the embedded deck for the report on screen — any vintage or an imported feed — with markup characters stripped | code |
| `app/src/components/DeckFrame.tsx` | The Present sub-tab: the deck page in a frame, loaded with the report on screen; fund and slide stay in step both ways | code |
| `app/public/how-it-works/index.html` | The shareable plain-language page "How the CIO Monthly slides work" (`/how-it-works/`), linked from the CIO Monthly tab's header; sources, the monthly steps and links to the code on GitHub | analyst, when the process changes |
| `app/scripts/sync-deck-data.ts` | Regenerates the block between the markers in `app/public/deck/index.html` (`npm run sync:deck`) | code |
| `app/scripts/cio-diff.ts` | Prints what changed between two vintages (`npm run cio:diff`, optionally two data-through dates) | code |
| `app/src/fixtures/cioMonthly.test.ts` | Identities for every vintage; editorial-for-latest guard; FRED figures for every report, read as of the right date, reproducing the latest report's printed ones; deck block equals the generated block; the deck's script parses; no hardcoded month or report date in the deck prose | code |

## Before the report is published

The slides can also be built from the team's own figures, before the PDF exists: fill the CIO
Monthly Excel template, save it and open it (the workbook, or its Export tab as CSV) with **Open a
template file** on the tab. The file is read in the browser only and never published. See `docs/cio-template.md`.

## Monthly update

### From GitHub (no PC needed)

`.github/workflows/cio-report.yml` runs the steps below on GitHub, so anyone with write access to
the repository can add a report from a browser:

1. Actions → **CIO report** → **Run workflow**, and paste the report's PDF link from lacera.gov.
   The link must be a lacera.gov `…/financials/cio_report/…pdf` address; anything else is refused.
2. GitHub downloads the PDF to the runner (it is not committed: the reports stay on lacera.gov),
   runs the extractor with `--url … --append-ts app/src/fixtures/cioVintages.data.ts` (the new
   report is added last and every existing one is left byte for byte; a report that fails a check,
   is already on the site or is older than the latest is refused), runs `fetch_cio_macro.py`,
   `npm run sync:deck` and `npm run cio:diff`, pushes a branch `cio-report/<data-through>` and opens
   a pull request with the steps and the changes. If Actions may not open pull requests in the
   repository, the run's summary gives the one-click link instead.
3. On the pull request, type the report's written parts into `app/src/fixtures/cioMonthly.data.ts`
   (the list is in the pull request). Each commit runs the **check** job: it formats that file,
   regenerates the deck's data block, commits both back if they changed, then runs lint, the
   format check, the tests and the build. The tests stay red until `EDITORIAL_FOR` names the new
   report and FRED reproduces `MACRO_PRINTED`, and their messages say which value to fix.
4. Merge when green; `pages.yml` tests again and publishes.

One-time setup, done by the repository owner: add the repository secret `FRED_API_KEY`
(Settings → Secrets and variables → Actions); optionally allow Actions to open pull requests
(Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests");
add teammates as collaborators with write access.

### Locally

1. Download the new report from lacera.gov to `outputs/data/public_docs/cio/` (ignored) and add its
   URL path to `URL_PATHS` in the extractor.
2. Run the extractor over the folder and emit the fixture:

   ```bash
   python tools/extract_cio_report.py outputs/data/public_docs/cio/*.pdf --out outputs/data/cio_vintages.json
   python tools/extract_cio_report.py --emit-ts app/src/fixtures/cioVintages.data.ts --from-json outputs/data/cio_vintages.json
   ```

   A report is **rejected**, with the reason, when any identity fails or a page is not
   machine-readable; it is never patched by hand.
3. `python tools/fetch_cio_macro.py` — reads the macro strip's FRED figures for every report,
   the new one included (the key comes from `FRED_API_KEY` or the ignored
   `regime-dashboard/fred_key.txt` and is never printed or written).
4. Refresh `cioMonthly.data.ts` from the new report's editorial pages (4–6, 19–20, 24): the macro
   commentary, the dollar and themes lines, `MACRO_PRINTED` (the macro figures as printed) and
   the items for attention; set `EDITORIAL_FOR` to its meeting date. The test suite fails until
   this is done, and fails if FRED's figures do not reproduce the printed ones.
5. `cd app && npm run cio:diff` — read the changes as the checklist for the month; a target
   change is flagged because drift is not comparable across policy versions.
6. `npm run sync:deck`, then `npm test`, `npm run build`, `npx playwright test`.

## What the extractor reads

| Page (2026 layout) | Content | Checks |
|---|---|---|
| Cover | Meeting date (older covers name only the month) | present |
| Performance Summary (8 / 13) | AUM, cash and equivalents, monthly return, growth of a dollar | AUM ties to the table total; monthly return ties to the 1-month cell |
| Historical Net Performance (9 / 14) | Total fund, benchmark, hurdle and composite rows by period; market value, weight, target; return histogram and statistics | weights sum to 100 ±0.25; composites sum to the total ±2 (a report-side unitemized cash line ≤0.3% is kept as "Not itemized"); one count per bin summing to the printed month count |
| Geographic exposure (11 / 16) | DM/EM split, market counts, top five countries per group | DM + EM = 100; counts add; five per group |
| Portfolio updates (18) | Rebalancing flows per composite, overlay program gains | flows net to the printed net |
| Market table (5, 2026 reports) | Index returns by period | one value per period column; absent in 2025 layouts and shown as such |

Columns are assigned by nearest header anchor, so a period the report does not print (YTD in
the April 2025 report) stays `null` instead of shifting the row. January 2026 is excluded: its
performance table is an image in the PDF.

## Macro strip from FRED

The report's macro pages (pp. 4 and 6, "Sources: Bloomberg, St. Louis Federal Reserve") print PCE
inflation, the federal funds target range, the unemployment and participation rates, and a
Treasury yield curve. Those are FRED series (PCEPI, PCEPILFE, DFEDTARL/DFEDTARU, UNRATE, CIVPART,
DGS3MO/DGS2/DGS5/DGS10/DGS30), so the strip reads them from FRED for **every** report rather than
typing them in for the latest:

- **As known then, not as revised since.** Each report is read from FRED's real-time archive
  (ALFRED) as of the **month end before the report's month** — July 31, 2026 for the August 12,
  2026 report. Checked against that report: as of July 31 FRED gives exactly the printed PCE
  3.7% (core 3.3%), unemployment 4.2%, participation 61.5% and range 3.50–3.75%; as of the
  meeting date it gives July's labor figures (4.1% / 61.4%), which the report did not print.
  Reading today's values would show revised figures the meeting never saw.
- **The yield curve carries the other as-of date (Revision 27).** The page's chart of 3M, 2Y, 5Y,
  10Y and 30Y constant-maturity yields ends at the month the **fund figures** cover, not at the
  date the rest of the page is read as of. Checked against the August 2026 report, which prints
  3.9 / 4.1 / 4.2 / 4.4 / 4.9: FRED gives exactly those for June 30, 2026, and 3.8 / 4.2 / 4.4 /
  4.7 / 5.2 for July 30. So the curve is read at the report's data-through date (the last
  observation on or before it, read a few days later because the H.15 release lags a day and a
  month can end on a weekend), and the strip's line names that date. The printed labels are held
  in `MACRO_PRINTED.curve`, and a unit test fails if FRED stops reproducing them. Reading the
  chart itself was rejected: its five end labels are a stacked list whose only link to a tenor is
  the colour of the line, which would have to be guessed.
- **What that means for older reports.** The strip shows what was published by that date. For the
  November and December 2025 reports that is August 2025 PCE: the fall 2025 federal shutdown
  held back the later releases, and the strip shows the gap as it stood rather than filling it.
- **What stays typed.** The U.S. Dollar Index the report prints is not a FRED series (FRED's broad
  dollar index is a different measure), and the themes are the CIO's commentary, so those two
  lines and the report's commentary beside the FRED figures are typed for the latest report
  only. The printed values of the FRED-backed figures are typed as `MACRO_PRINTED`, and a unit
  test fails if FRED does not reproduce them.
- **Separate from the Economic Context tab.** That tab is a FRED snapshot of the latest data; the
  strip is FRED as of each report's date. They answer different questions and are not combined.

On the slides, the strip appears with → on slide 7 and the index chart tightens its rows to make
room; printing uses the same layout.

## Classification

Every figure is `reported_public` from the page cited beside it; the macro strip's FRED figures
are `reported_public` from FRED as of the date shown, except PCE inflation, which is `calculated`
(year-over-year from the price index). Excess returns, drift, changes
against the prior report and the gap attribution are `calculated`; the attribution is a
`proxy_estimate` (composite excess × month-end weight) and its residual is always shown.

## Workstation feed (schema 1.4)

The internal version does not read PDFs: the same figures arrive as `cio_monthly` contract rows
(see `docs/data-contract.md`, 1.4.0). `app/src/lib/dataset/cioFeed.ts` assembles them into the
entity shape the tab renders; an applied import that carries the feed appears in the report
selector as "Workstation dataset", with the publication gate shown and changes computed against
the newest public report that precedes it. The public sample
(`data/sample/cio_monthly_feed_demofund.csv`) is generated from the latest extracted vintage and
round-trips it exactly, which is the test that the two paths agree. Geography and the market
table are not part of the feed; the tab says so instead of filling them in.

## The dashboard feeds the slides

The slides are no longer a separate artefact to update. On the **Slides** sub-tab — the tab's
default view — the dashboard loads `public/deck/index.html` in a frame and hands it the data for whatever is on
screen:

- **Any report.** Move the report slider or pick a month; the slides reload with that report's
  figures (`deckDataFor`), including the macro strip's FRED figures as of that report's date.
  Editorial pages — the report's commentary and the items for attention — exist for the latest
  public report only, so for any other report those are left out or the slide says so rather
  than show another month's text; the market slide says when the report's table was not
  extracted.
- **An imported workstation feed.** Apply a schema 1.4 import and choose "Workstation dataset":
  the slides present the imported figures, locked to the feed's one fund. Text from the file is
  stripped of `<`, `>` and `"` before it reaches the slides (in `deckFeed.ts` and again in the
  deck), because slide prose is written as HTML.
- **In step.** The header's fund toggle switches the slides, E in the slides switches the
  dashboard, and the slide number is kept in the address (`?slide=3`). ← → on the page step the
  slides without clicking into them, and the band's "Present full screen" shows them alone. Each
  panel with a matching slide carries a "▶ Slide n" link that opens the slides at that slide.
- **Mechanics.** The deck reads `window.parent.__laceraDeckFeed` once, when its script starts,
  only when loaded with `?embed=1` from the same origin; anything unreadable leaves its built-in
  data. A presenter window (P) reads the same data from its opener. Messages between the two
  windows are checked for origin and source.

- **Slide 2 drivers (Revision 24).** A composite chosen on slide 2 opens to what drove its
  month, from the published figures only (the report prints no sub-asset-class returns): its
  share of the fund's month (month-end weight x its return, called indicative because
  beginning-of-month weights are not published), how its market value moved since the previous
  report (earlier close + return effect + the report's rebalancing flow + an unexplained
  remainder = this close), and the month's index moves from the report's own market table, named
  as context rather than attribution. For the Total Fund the first column is the four composites
  and the reported total, with the difference carried in the note. The previous report's market
  values ride in the deck data as `PRIOR` (`deckPrior` in `lib/deckFeed.ts`), and are absent —
  with the bridge — for a template file or an imported feed, which are not part of the series.
- **Opening slides (Revision 26).** The deck opens the way the report does: a **cover** (title,
  fund, the three dates, the disclosure) and a **contents** slide naming each section, the slides
  in it and the question it answers, generated from the deck's own section list, with each line a
  jump. Page numbers are computed from a slide's place, so adding a slide never leaves a stale
  number. The dashboard's panel links (`SLIDE` in `views/CioMonthlyView.tsx`) are pinned to the
  deck's order by a unit test.
- **Said, not left to be inferred (Revision 26).** Slide 3 carries the report's three dates in one
  line. Slide 5 says when FYTD and 1 Y are the same twelve months, and that the actuarial hurdle is
  a Total Fund measure when a composite is chosen. Slide 9 says when the market table's FYTD column
  is the same month as its 1 M column (a table dated July 31 holds one month of the fiscal year).
  Each line is computed, so it appears only where it is true.
- **Chrome (Revision 23).** One bar under the slide: the arrows and the section strip (Where we
  stand → Why → Positioning → Context → Attention) on the first row, the controls and one line of
  provenance on the second, so the slide takes the rest of the window. Speaker notes are in the
  presenter window (P), not a drawer. A build costs a key press only in the view that has it: a
  slide showing its table, and the performance slide showing a composite or the excess view, are
  drawn complete, so one press moves to the next slide. Each slide's footer carries "not an
  official LACERA publication", the one disclosure that stays on screen and in print.

## The PDF for publication

Printing the deck produces the document that can be posted: the deck's cover and contents slides,
then every slide followed by a page of the figures behind it — the table, the report pages it came
from, and how each figure is labelled. Nothing is redrawn for print: the slide pages are the
slides, with every build shown.

| How | What |
|---|---|
| In the deck: **Print / PDF**, then "Save as PDF" | The fund on screen, 29 landscape pages |
| `npm run deck:pdf` (from `app/`) | Both funds, into `outputs/cio_deck/CIO_Monthly_<Month><Year>_<Fund>.pdf`; `-- --fund opeb` for one, `-- --out <dir>` elsewhere |

A tab that draws a different picture — the performance slide's excess view, the market slide
sorted by return, the geography slide's map — is captured as its own page straight after its
slide, with what that tab hides kept hidden. Tabs that only reorder or filter the same numbers (periods, composites, the items
filter) are covered by the figures page, which lists them all.

The figures pages are built from the same data the slides are drawn from (`printout()` in the
deck), so they cannot drift from the picture:

| Slide | Its figures page |
|---|---|
| 1 Cover · 2 What this covers | None: they carry no figures of their own |
| 3 Executive read · 4 Fund at a glance | Fund lines, the composites with weights, targets and returns — and, for slide 4, the indicative contribution and the month's flows the drill-down shows |
| 5 Performance vs. policy · 6 Where the gap came from | Every composite over all eight periods: return, benchmark, calculated excess, the hurdle for the fund, and the indicative contribution to excess |
| 7 Allocation and flows | Market value, weight, target, drift and flow by composite, the net flow, and the overlay programs |
| 8 Change in fiduciary net position | The twelve months, their sum, the three fiscal years with their month counts, and the two books side by side |
| 9 Return distribution | The 14 bins with their month counts, and the printed statistics |
| 10 Forecast volatility | The five forecast figures with their sum, the three shares per category with their printed totals, and both 13-month trends |
| 11 Market context | The market table over all periods |
| 12 The economy around the fund | The GDP quarters with the vintage they were read at, and every macro indicator with its detail |
| 13 Geographic exposure | Developed and emerging shares and market counts, and the ten countries |
| 14 Items for attention | Every item as printed, with its status and report page |

### The change in fiduciary net position (slide 8)

The report's page 21 is a picture in the PDF, so nothing can be extracted from it. Its figures are
read from the page and typed into `NET_POSITION` in `app/src/fixtures/cioMonthly.data.ts`, and two
figures printed beside them hold the reading to account: the twelve months add to the fiscal year's
printed total ($7,841mm against $7.8B), and their signs give the printed month counts (9 added, 3
took away). Both are unit tests, so a slip in the typing fails the build instead of reaching a
slide. Only the net line is carried — the page stacks contributions, net investment income,
benefits and administrative expenses behind it but prints no figure for any of them, and the slide
says so rather than implying a split it cannot show.

Two things about this page differ from every other slide, and the slide states both:

- **It is not drawn per entity.** The report prints it once, in section 04 (Portfolio and
  Structural), with no entity heading and no OPEB counterpart. Which plan it belongs to is settled
  by scale, not assumption: the year's months add to $7,841mm, while the whole OPEB Master Trust's
  market value moved $1,421mm over the same year. The fixture records the scope, the slide shows it
  as a fixed chip instead of the entity chip, and the slide does not follow the entity toggle. A
  slide that opts out this way sets `data-scope`, which the printed header follows.
- **It is a different book.** This is the plan's fiduciary net position, an accounting measure. The
  investment-book market value the rest of the deck shows moved $8,731mm over the same fiscal year
  (pension market value at each June 30, from the reports themselves). The slide names the
  difference rather than letting $7.8B be read as the change in market value, and the figures page
  sets the two bases against each other with the difference marked `calculated`.

Only the latest report carries this page in the deck; earlier reports show "not carried for this
report", as they do for other pages a vintage does not supply.

### When each figure was true — the freshness matrix (Summary tab)

A report is not a single as-of date, and the tab had no way of saying so. The August 12, 2026
report carries fund figures through June 30, a market table through July 31, FRED series read as of
July 31, a Treasury curve read at the fund's own month end, a GDP chart at whatever vintage the
report last drew it from, and two figures with a valuation lag and no single date at all. Five of
nine figures carry a date other than the one the masthead shows.

The panel places every figure against the month the fund figures cover, newest first:

| | |
|---|---|
| **Ahead of the fund month** | the market table, the macro series, the GDP chart — and the report's own presentation date |
| **On the fund month** | fund figures, return distribution, geography, the Treasury curve |
| **No single date** | NCREIF ODCE (latest available quarter), private equity and real estate (best available, cash-flow adjusted) |

**Ahead is the ordering rule, not behind.** A figure that lags is the mistake people expect; a
figure that is *newer* than the month beside it is the one that gets read as coeval. The report
prints its market table a month after the fund figures, so the index moves on the Markets tab are
not the month whose performance sits on the Summary tab. Nothing else on the site said that.

Direction is carried by a marker **shape** as well as colour — a caret up for ahead, a caret down
for behind, a square on the anchor, a rule where there is no single date — so it survives a
greyscale page and a colour-blind reader.

The logic is pure and tested in `app/src/lib/freshness.ts`; `FreshnessMatrix.tsx` renders the rows
and adds nothing. Two of the unit tests caught real bugs while the panel was being built:

- the Treasury curve was being read from `MACRO_PRINTED`, which is the *latest* report's
  transcription — putting a June 2026 curve on the April 2025 report. It now uses each vintage's
  own observation (`CIO_MACRO[reportDate].curve.y10.date`), and a test pins that.
- the spread line counted the report's publication date as a figure date, overstating the range.
  Nothing is reported *as of* the day a report is presented, so it is excluded from the span and
  from the headline count, while still appearing as a row for context.

### Forecast volatility (slide 10)

The report gives each fund a page of forecast risk — p. 10 for the Pension Fund, p. 15 for the OPEB
Master Trust — and the deck did not carry them at all; the speaker note on the return distribution
slide said as much. Both pages are images in the PDF: page 10 yields eleven words of extractable
text and nothing from its charts. The figures are therefore transcribed, read from the pages
rendered at 420 dpi from the published file, into `FORECAST_VOL` in
`app/src/fixtures/cioMonthly.data.ts`.

Nothing is typed without a check. Every figure is held to something the report prints beside it,
and all of these are unit tests:

| Check | What it catches |
|---|---|
| allocation risk + selection risk = total active risk | a mistyped digit in any of the three |
| the contributions to active risk sum to 100% | a dropped or duplicated slice |
| each 13-month trend ends at the headline figure above it | a trend read off by one position |
| the capital-based bar equals the fund's own weights from pp. 9 / 14, rounded | **the category mapping** |

The last one is the important one. The bars are colour-coded with no labels on the segments, so
which colour is which functional category has to be read from a legend — and a reader who got it
backwards would swap Growth and Risk Reduction. Because the capital-based bar is the same
allocation the report prints on another page, 49/13/14/24 must line up with 48.6/12.5/14.4/23.8,
and 45/16/13/26 with 45.2/15.8/13.1/25.9. They do, which makes the mapping verified rather than
assumed.

The one figure with no second printing is the risk-based bar: the Pension Fund's five whole-percent
shares sum to 99%. That is recorded as printed, the slide says so, the figures page prints the
total, and a test asserts the gap stays within whole-percent rounding.

**One device differs from the report, on purpose.** The report sets capital against risk as two
stacked columns, which asks a reader to compare segment heights across a gap. The page exists to
say that Growth is about half the money and most of the risk, so the slide pairs the bars per
category — upper bar capital, lower paler bar risk — and states the change on the page. A category
the report does not label on one of the two bars reads "not printed", never 0%: the Pension Fund's
overlays sliver is 0.7% of capital and the report prints no figure for it.

### The trend under each figure on Fund at a glance (slide 4)

The report's page 8 puts a chart under each of its four headline figures — total market value,
monthly return, growth of a dollar and cash equivalents. The deck printed the figures without the
trend, so a reader could see what the month was but not whether it was a change. Each figure now
carries its history beside it, drawn from the published reports rather than from anything new.

The series is one point per month the extracted reports cover, truncated at the report on screen —
an older report must not show months it could not have known — and it is built by `deckHistory()`
in `app/src/lib/deckFeed.ts`, travelling to the deck as the `HISTORY` field of the per-report
block.

**The gap is the point worth reading.** No published report covers November 2025, so that month is
`null` on both funds and the line breaks there, with a dotted rule marking the break. A straight
segment across it would invent a month that was never published, which is the same mistake as
showing missing data as zero. The caption under the tiles says it in words as well, and the figures
page prints `no report` in every column of that row. Unit tests check that the series is
contiguous, that exactly the months with reports carry values, that November 2025 is the only gap,
that each point equals what that report printed, and that an older report shows no later month; a
browser test checks that each drawn path is in two pieces rather than one.

### The geographic exposure map (slide 11, and the Positioning tab)

The geography slide has a third view beside Chart and Table: a world map with the countries the
report names shaded, and a numbered badge on each one. The map does not replace the bars. A share
of AUM is a quantity, and a bar against a common axis is how a quantity is read; on a map the
United States at 75.7% and Canada at 2.5% take up comparable parts of the page. The map answers the
one question the bars cannot — where in the world those countries are — and the slide says as much
in its own method note, which changes with the view.

Three choices make it honest rather than decorative:

- **Class breaks, not a ramp.** The shares run from about 76% to 0.4%. A linear ramp would paint one
  country black and nine of them the same near-white, so the map uses four classes — under 1%, 1–2%,
  2–10%, 10% and over — and the legend prints the breaks, so a shade is never left to be guessed.
- **Rank badges.** The number on each country is its rank in the table beside it, so a reader who
  finds 7 on the map reads 7 in the list. They also solve the small-country problem: Taiwan is about
  three units wide on a 1000-unit map, and its badge, not its outline, is what locates it. Badges
  that would overlap are pushed apart along the line between them (`spreadBadges` in
  `app/src/lib/geoMap.ts`, unit-tested for separation and for staying in frame).
- **One neutral fill for everything else, with its own legend entry.** The report names ten
  countries; the other 166 drawn are `missing`, not zero, and the caption says so. The neutral is
  `#E3E6EA` rather than something paler because at 4% off white the rest of the world disappeared
  when the deck was printed to PDF.

The outlines are Natural Earth's Admin 0 countries at 1:110m, public domain, projected **once at
build time** by `tools/make_world_paths.py` into `app/src/fixtures/worldMap.data.ts`. Nothing is
fetched at run time and no mapping library ships: the page draws plain `<path>` elements from a
fixture that is reviewable like any other. The projection is Robinson — neither equal area nor
conformal, which is acceptable precisely because the map is a locator and not a measuring device.
Antarctica is dropped; rings that round to a splinter are dropped, except that no country is ever
removed altogether, so Luxembourg survives as its largest ring alone.

```bash
python tools/make_world_paths.py --tolerance 1.0
```

Regenerate with the command above and then `npm run sync:deck`. The fixture is prettier-ignored
(one long path string per country, by design) and the deck carries it in a second generated block,
`WORLD OUTLINES`, declared `const`: it is the same for every report, so there is no reason for 44 KB
of coastline to travel down the per-report feed. A unit test fails if that block drifts from the
fixture, and three more fail if the deck's inlined copy of the class breaks, the legend labels or
the badge radius stops matching `app/src/lib/geoMap.ts` — a reader comparing the slide with the
dashboard must not find different breaks.

The same map appears on the dashboard's Positioning tab above the country table
(`app/src/components/WorldMap.tsx`). Both carry `role="img"` with alternative text that lists every
named country and its share, so the figures are never only in the picture.

### The economy around the fund (slide 11, and the Markets tab)

The report gives its Key Macro Indicators a page of their own (p. 6), and so does the deck. Until
Revision 33 those indicators were a strip of chips on the market slide, revealed by a build step;
adding quarterly real GDP growth made a seventh chip, and measured at slide size seven chips of
that text ran 53px into the note beneath them. Shrinking the market chart far enough to clear it
would have left the seventeen index rows 13px each, so the macro page became its own slide. The
market slide is now the index table alone, at the height the strip gave back.

**Quarterly real GDP growth** is the report's own chart, rebuilt from FRED rather than typed
(`tools/fetch_cio_gdp.py`, series `A191RL1Q225SBEA` — real GDP, percent change from the preceding
period, at an annual rate). The obvious rule — read FRED as of the month end before the report, the
rule the same page's inflation and labour figures follow — reproduces only eight of the fifteen
charts, and the reason is worth stating plainly:

> **The report does not redraw this chart every month.** The September, October, November and
> December 2025 reports all print it exactly as FRED stood on July 31, 2025, revisions and all.
> Seven of the sixteen reports carry a GDP chart older than the rest of their own macro page.

So the vintage is **identified, not assumed**. For each report the tool reads the printed bar
labels off the PDF and searches FRED's archive backwards from the report's as-of date for the month
end whose vintage reproduces every one of them. Thirteen or fourteen figures agreeing to a tenth is
not chance, so a match identifies the vintage; the latest matching month end is recorded, and where
it is earlier than the rest of the macro page the slide says so and by how many months. Without
that, a reader comparing two reports would take a revision for a change in the economy.

The tool writes the printed labels alongside the FRED values, so a unit test checks the two still
agree without a network call, and further tests check that the quarters are consecutive, that no
quarter appears before it was published, and that the late-2025 run of four held vintages is still
there. The same chart appears on the dashboard's Markets & items tab
(`app/src/components/GdpBars.tsx`); both put the value labels inside the plot band so a negative
quarter's label cannot land on the axis.

```bash
python tools/fetch_cio_gdp.py
```

The cover states what the deck is and what it is not, the contents page says what each section
answers and which slides it holds, and every page keeps the footer disclosure.
A figure the report did not supply says "not supplied" on the page, as on the slide. The generated
files are not committed (`outputs/` is ignored) — the report they come from is published, and the
PDF is regenerated from it.

The standalone `/deck/` is unchanged for people who open it directly: it shows the latest public
report from its generated block, and the unit test fails if that block drifts from the fixture.

## Reading the tab

The tab has six sub-tabs (`?tab=`): **Slides** (the default), **Summary** (headline figures,
two-minute read, what changed), **Performance** (by period, attribution, trend across reports),
**Positioning** (composites, flows, distribution, geography), **Markets & items** and **Explore**
(below). The
report slider above them moves across the sixteen extracted reports; figures that change flash
briefly and bars move to their new values.

The Summary opens with a **two-minute read**: four standing questions answered from the figures on
the page by `app/src/lib/cioNarrative.ts`. Nothing there is written for a particular month — the
hurdle sentence flips when a period falls below it, the attribution sentence says "lead" or
"shortfall" as the sign requires, and that answer carries the `proxy_estimate` badge. Each answer
links to the panel holding its evidence. **What changed** lists the moves an analyst would act on
against the prior report (half a point of weight, a tenth of a point of return, an excess that
changed sign, any policy-target change) with direction chips.

Four rules keep those sentences honest (audit, September 18, 2026):

- **Periods.** A new fiscal year restarts FYTD on July 1, so the July report's FYTD is not compared
  with June's completed year: the change list and the FYTD tile say "new fiscal year" instead of a
  change, and FYTD excess sign flips are not counted across the turn (calendar YTD likewise across
  January). `cioChanges` requires both reports' data-through dates, so no caller can skip this.
- **Market period.** The market table is as of a month after the fund figures; its lead is named
  with its own dates ("from July 1 to July 31, 2026"), never folded into the fund month.
- **Histogram.** The bins do not rank months within a bin, so the latest month is placed in its
  range with the months below and beside it (a bracket), not at a percentile.
- **Missing is missing.** A figure the input did not supply — cash, flows, the distribution —
  is `null` and shown as "not supplied"; a net is computed only from a complete set of flows.
  An imported feed is labelled with its own rows' classification (the most cautious one when they
  are mixed) and its dataset ID, on the page and on every slide.

The deck carries an equivalent narrative implementation in its own file, because it must stay
self-contained. Both read the same fixture; if the wording changes in one, change it in the other
(`app/public/deck/index.html`, the executive slide).

### Explore

**Explore** treats the sixteen published reports as one monthly history
(`app/src/lib/cioHistory.ts`, pure and unit-tested; panels in `app/src/components/explore/`,
composed by `app/src/views/CioExplore.tsx`). The report slider is its timeline: every panel marks
the report on screen, and choosing a month in the grid opens that report.

| Panel | Question | What it shows |
|---|---|---|
| Month by month | Which categories moved the fund? | Every one-month return the reports printed, categories × data months; a category chosen here is followed in the next panel |
| Chosen category | How did it do, and where did it sit? | Monthly return against benchmark; weight against target inside the IPS Table 1 range (market value for the Total Fund); figures table |
| Correlations | Have the categories moved together? | Pairwise correlation of one-month returns with the months behind it and an approximate 95% range; the chosen pair as a scatter |
| Scenario | What would it take to move to different targets? | Dollars per category from the report's month-end market values to targets the reader enters |

Rules it keeps:

- **As first reported.** Each month is that report's own one-month figure; later restatements are
  not applied (the reports print only their own month).
- **Gaps stay gaps.** No report carries November 2025 data. That column is marked "no report",
  lines break across it, and correlations use only months where both categories have a figure.
- **Thin evidence is said to be thin.** A correlation is shown from 12 months, with its count and
  an approximate 95% range (Fisher z, which assumes independent months); a range that includes
  zero is hatched and said to be indistinguishable from none. Appraisal-based private holdings
  smooth monthly returns, so correlations with them read low and the true range is wider — the
  panel says so. For the Pension Fund, with 16 months, every pair’s range includes zero (September 2026).
- **The scenario is arithmetic.** Proposed target × the lines' total − the category's market
  value; the other line (cash, overlays) is a source of funds, so buys equal sells. Nothing is
  shown until the targets add to 100% (±0.05); a target outside the IPS range is flagged as
  needing a policy change. It is labelled hypothetical, not a recommendation or a trade plan.
- The Total Fund is left out of the correlations (it contains each category). Everything derived
  is `calculated`; the inputs are the reports' printed figures (`reported_public`). With a
  template file or workstation dataset on screen, the history panels still use the published
  reports (and say so); the scenario uses the figures on screen.

State that changes what a panel shows lives in the URL — `?e=` fund, `?v=` report, `tab`,
`perf`, `attr`, `trend`, `compare`, `slide`, and on Explore `cat`, `pair`, `targets` — so a
pasted link reproduces the screen. Each panel's
⋯ menu copies its table as CSV or a link that opens that panel (`?p=`), and the footer glossary
defines the terms.

