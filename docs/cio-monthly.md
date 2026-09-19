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
Monthly Excel template, save its Export tab as CSV and open it with **Open a template file** on
the tab. The file is read in the browser only and never published. See `docs/cio-template.md`.

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
inflation, the federal funds target range and the unemployment and participation rates. Those are
FRED series (PCEPI, PCEPILFE, DFEDTARL/DFEDTARU, UNRATE, CIVPART), so the strip reads them from
FRED for **every** report rather than typing them in for the latest:

- **As known then, not as revised since.** Each report is read from FRED's real-time archive
  (ALFRED) as of the **month end before the report's month** — July 31, 2026 for the August 12,
  2026 report. Checked against that report: as of July 31 FRED gives exactly the printed PCE
  3.7% (core 3.3%), unemployment 4.2%, participation 61.5% and range 3.50–3.75%; as of the
  meeting date it gives July's labor figures (4.1% / 61.4%), which the report did not print.
  Reading today's values would show revised figures the meeting never saw.
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

The standalone `/deck/` is unchanged for people who open it directly: it shows the latest public
report from its generated block, and the unit test fails if that block drifts from the fixture.

## Reading the tab

The tab has five sub-tabs (`?tab=`): **Slides** (the default), **Summary** (headline figures,
two-minute read, what changed), **Performance** (by period, attribution, trend across reports),
**Positioning** (composites, flows, distribution, geography) and **Markets & items**. The
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

State that changes what a panel shows lives in the URL — `?e=` fund, `?v=` report, `tab`,
`perf`, `attr`, `trend`, `compare`, `slide` — so a pasted link reproduces the screen. Each panel's
⋯ menu copies its table as CSV or a link that opens that panel (`?p=`), and the footer glossary
defines the terms.

