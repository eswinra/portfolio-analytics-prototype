# CIO Monthly — the monthly report layer

The CIO Monthly tab (`#/cio`) and the slide deck present the figures of LACERA's public Chief
Investment Officer Monthly Report. Both read one fixture; nothing is typed twice. The deck is
presented two ways: inside the dashboard on the tab's **Present slides** sub-tab, fed live by the
dashboard, and as the standalone page at `/deck/` (latest public report).
This layer is a separate reporting vintage from the fiscal-year tabs (2025 PAFR/ACFR, IPS) and
is never combined with them: market value at a month end is not fiduciary net position at
June 30, and monthly periods are not fiscal-year horizons.

## Files

| Path | Role | Maintained by |
|---|---|---|
| `tools/extract_cio_report.py` | Reads a report PDF by word coordinates (never by text order), validates it against the identities the report prints, writes JSON, and emits the TypeScript vintage file | code |
| `app/src/fixtures/cioVintages.data.ts` | One entry per accepted report, oldest first: fund figures for both entities, the market table (2026 layouts), pages read, public URL | **generated** — do not edit |
| `app/src/fixtures/cioMonthly.data.ts` | Editorial content for the **latest** report only: macro strip, items for attention, period and bin labels, status labels; `EDITORIAL_FOR` names the report it belongs to | analyst, monthly |
| `app/src/fixtures/cioMonthly.ts` | Types, `CIO_VINTAGES`, `CIO_LATEST`, label helpers, `cioFor()` | code |
| `app/src/fixtures/deckData.ts` | Builds the standalone deck's data block from the latest vintage (`VINTAGE` labels included), declared with `let` so an embedded deck can take the dashboard's data instead | code |
| `app/src/lib/deckFeed.ts` | `deckDataFor(vintage)`: the data the dashboard hands the embedded deck for the report on screen — any vintage or an imported feed — with markup characters stripped | code |
| `app/src/components/DeckFrame.tsx` | The Present sub-tab: the deck page in a frame, loaded with the report on screen; fund and slide stay in step both ways | code |
| `app/scripts/sync-deck-data.ts` | Regenerates the block between the markers in `app/public/deck/index.html` (`npm run sync:deck`) | code |
| `app/scripts/cio-diff.ts` | Prints what changed between two vintages (`npm run cio:diff`, optionally two data-through dates) | code |
| `app/src/fixtures/cioMonthly.test.ts` | Identities for every vintage; editorial-for-latest guard; deck block equals the generated block; no hardcoded month or report date in the deck prose | code |

## Monthly update

1. Download the new report from lacera.gov to `outputs/data/public_docs/cio/` (ignored) and add its
   URL path to `URL_PATHS` in the extractor.
2. Run the extractor over the folder and emit the fixture:

   ```bash
   python tools/extract_cio_report.py outputs/data/public_docs/cio/*.pdf --out outputs/data/cio_vintages.json
   python tools/extract_cio_report.py --emit-ts app/src/fixtures/cioVintages.data.ts --from-json outputs/data/cio_vintages.json
   ```

   A report is **rejected**, with the reason, when any identity fails or a page is not
   machine-readable; it is never patched by hand.
3. Refresh `cioMonthly.data.ts` from the new report's editorial pages (4–6, 19–20, 24) and set
   `EDITORIAL_FOR` to its meeting date. The test suite fails until this is done.
4. `cd app && npm run cio:diff` — read the changes as the checklist for the month; a target
   change is flagged because drift is not comparable across policy versions.
5. `npm run sync:deck`, then `npm test`, `npm run build`, `npx playwright test`.

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

## Classification

Every figure is `reported_public` from the page cited beside it. Excess returns, drift, changes
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

The slides are no longer a separate artefact to update. On the **Present slides** sub-tab the
dashboard loads `public/deck/index.html` in a frame and hands it the data for whatever is on
screen:

- **Any report.** Move the report slider or pick a month; the slides reload with that report's
  figures (`deckDataFor`). Editorial pages — the macro strip and items for attention — exist for
  the latest public report only, so for any other report those slides say so rather than show
  another month's text; the market slide says when the report's table was not extracted.
- **An imported workstation feed.** Apply a schema 1.4 import and choose "Workstation dataset":
  the slides present the imported figures, locked to the feed's one fund. Text from the file is
  stripped of `<`, `>` and `"` before it reaches the slides (in `deckFeed.ts` and again in the
  deck), because slide prose is written as HTML.
- **In step.** The header's fund toggle switches the slides, E in the slides switches the
  dashboard, and the slide number is kept in the address (`?tab=present&slide=3`). Each panel with
  a matching slide carries a "▶ Slide n" link that opens the Present tab at that slide.
- **Mechanics.** The deck reads `window.parent.__laceraDeckFeed` once, when its script starts,
  only when loaded with `?embed=1` from the same origin; anything unreadable leaves its built-in
  data. A presenter window (P) reads the same data from its opener. Messages between the two
  windows are checked for origin and source.

The standalone `/deck/` is unchanged for people who open it directly: it shows the latest public
report from its generated block, and the unit test fails if that block drifts from the fixture.

## Reading the tab

The tab has five sub-tabs (`?tab=`): **Summary** (headline figures, two-minute read, what
changed), **Performance** (by period, attribution, trend across reports), **Positioning**
(composites, flows, distribution, geography), **Markets & items** and **Present slides**. The
report slider above them moves across the sixteen extracted reports; figures that change flash
briefly and bars move to their new values.

The Summary opens with a **two-minute read**: four standing questions answered from the figures on
the page by `app/src/lib/cioNarrative.ts`. Nothing there is written for a particular month — the
hurdle sentence flips when a period falls below it, the attribution sentence says "lead" or
"shortfall" as the sign requires, and that answer carries the `proxy_estimate` badge. Each answer
links to the panel holding its evidence. **What changed** lists the moves an analyst would act on
against the prior report (half a point of weight, a tenth of a point of return, an excess that
changed sign, any policy-target change) with direction chips.

The deck carries an equivalent narrative implementation in its own file, because it must stay
self-contained. Both read the same fixture; if the wording changes in one, change it in the other
(`app/public/deck/index.html`, the executive slide).

State that changes what a panel shows lives in the URL — `?e=` fund, `?v=` report, `tab`,
`perf`, `attr`, `trend`, `compare`, `slide` — so a pasted link reproduces the screen. Each panel's
⋯ menu copies its table as CSV or a link that opens that panel (`?p=`), and the footer glossary
defines the terms.

