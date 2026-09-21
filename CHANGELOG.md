# Changelog

## 2026-09-20 — Revision 35: forecast volatility, the last page the deck was missing

- **The report's forecast risk pages are now a slide.** Pages 10 and 15 — one per fund — were the
  pages the deck explicitly did not carry; the return distribution slide's own speaker note said
  so. Both are images in the PDF (page 10 yields eleven words of extractable text and nothing from
  its charts), so the figures are transcribed from the pages rendered at 420 dpi from the published
  file.
- **Every transcribed figure is held to something the report prints beside it.** Allocation risk
  plus selection risk must equal total active risk; the contributions to active risk must sum to
  100%; each thirteen-month trend must end at the headline figure above it; and the capital-based
  bar must equal the fund's own weights from pp. 9 / 14, rounded to whole percent. All are unit
  tests.
- **That last check is what makes the category mapping verifiable.** The bars are colour-coded with
  no labels on the segments, so which colour is which functional category has to be read off a
  legend — and reading it backwards would swap Growth with Risk Reduction. Because the
  capital-based bar is the same allocation the report prints on another page, 49/13/14/24 has to
  line up with 48.6/12.5/14.4/23.8, and 45/16/13/26 with 45.2/15.8/13.1/25.9. They do.
- **The one figure with no second printing says so.** The Pension Fund's five risk shares are whole
  percent and sum to 99%. It is recorded as printed, the slide says why, the figures page prints
  the total, and a test asserts the gap stays within whole-percent rounding.
- **One device differs from the report, deliberately and in writing.** The report sets capital
  against risk as two stacked columns, which asks a reader to compare segment heights across a gap.
  The page exists to say Growth is about half the money and most of the risk, so the slide pairs
  the bars per category and states the change on the slide itself. A category the report does not
  label on one of the two bars reads "not printed", never 0%.
- Both funds are carried: the Pension Fund forecasts 8.9% against an 8.6% benchmark, the OPEB
  Master Trust 7.9% against 8.1% — above and below respectively, which a test pins so a
  transcription that copied one page onto the other would fail.
- Fixed: the print stylesheet resets animated transforms by selector, and the new bars were not in
  its list, so they were absent from the first PDF — caught by rendering the page.
- Verification: lint · format · Vitest 528/528 (11 new) · build · Playwright 157/157 runnable
  (1 new) · `npm audit --omit=dev` 0 vulnerabilities · both PDFs regenerated at 29 pages · the
  slide, both funds and the figures page rendered and inspected.

## 2026-09-20 — Revision 34: the trend under each figure on Fund at a glance

- **The report's page 8 puts a chart under each headline figure; now so does slide 4.** Total market
  value, monthly return, growth of a dollar and cash equivalents each carry their history beside
  the number, drawn from the published reports. A figure alone says what the month was; the trend
  says whether it was a change.
- **The gap is the point.** No published report covers November 2025, so that month is null on both
  funds and every line breaks there, with a dotted rule marking the break. Drawing a straight
  segment across it would invent a month that was never published — the same mistake as showing
  missing data as zero. The caption under the tiles says so in words, and the figures page prints
  `no report` in all four columns of that row so the absence survives onto paper.
- **The series is truncated at the report on screen.** An older report shows no month it could not
  have known.
- **The field list test earned its keep on its first day.** `HISTORY` was added to the generated
  block and forgotten in the deck's feed assignment — the same slip that shipped as a bug in
  Revision 31 — and the unit test added yesterday to walk `DECK_FIELDS` failed immediately instead
  of letting an older report show the latest report's trends.
- Verification: lint · format · Vitest 517/517 (5 new) · build · Playwright 156/156 runnable
  (1 new) · both PDFs regenerated at 27 pages · slide 4 and its figures page rendered and
  inspected, gap included.

## 2026-09-20 — Revision 33: quarterly real GDP, and the economy gets the page the report gives it

- **The report's GDP chart, rebuilt from FRED rather than typed.** Quarterly real GDP growth
  (`A191RL1Q225SBEA`, percent change from the preceding period at an annual rate) now appears for
  every one of the sixteen reports, with the latest quarter picked out and every bar labelled.
- **The vintage is identified, not assumed — because one rule does not fit.** Reading FRED as of the
  month end before the report, the rule the same page's inflation and labour figures follow,
  reproduces only eight of the fifteen charts. The reason is that **the report does not redraw this
  chart every month**: the September, October, November and December 2025 reports all print it
  exactly as FRED stood on July 31, 2025, revisions and all, and seven of the sixteen carry a chart
  older than the rest of their own macro page. So `tools/fetch_cio_gdp.py` reads the printed bar
  labels off each PDF and searches FRED's archive backwards for the month end that reproduces every
  one of them. Thirteen or fourteen figures agreeing to a tenth is not chance. Where the identified
  vintage is older than the rest of the macro page, the slide says so and by how many months —
  without that, a reader comparing two reports takes a revision for a change in the economy.
- **The macro indicators get their own slide, as they have their own page in the report.** Adding
  GDP made a seventh chip in the market slide's strip, and measured at slide size seven chips of
  that text ran 53px into the note beneath them; shrinking the market chart far enough to clear it
  would have left the seventeen index rows 13px each. "The economy around the fund" now carries the
  GDP chart with room and the other indicators as a readable list. The market slide is the index
  table alone, at the height the strip gave back.
- **Fixed: the dashboard's feed was dropping fields.** The deck declares each data field with `let`
  and the embedded feed assigns them one by one; `NETPOS` was added to the generated block in
  Revision 31 but never to that assignment, so inside the dashboard an older report showed the
  *latest* report's net position page under its own date. Both `NETPOS` and `GDP` are now read and
  handed on to a presenter window, and a unit test walks the field list and fails if either place
  is missing one.
- **Fixed: the speaker notes were on the wrong slides.** `NOTES` was an array indexed by slide
  number, written when the executive read was slide 1. Revision 26 put a cover and contents page in
  front of it and Revision 31 added the net position page, so since Revision 26 the presenter view
  and every printed figures page carried the note for the wrong slide, and the last two slides had
  none at all. The notes are keyed by the slide's own id now, the heading is derived from the slide
  rather than typed into the note, and a unit test fails if a slide has no note or a note has no
  slide. Notes for the net position and economy slides are written.
- Verification: lint · format · Vitest 512/512 (13 new) · build · Playwright 155/155 runnable
  (3 new) · `npm audit --omit=dev` 0 vulnerabilities · both PDFs regenerated at 27 pages · the new
  slide, the market slide and the printed pages rendered and inspected.

## 2026-09-20 — Revision 32: geographic exposure as a map

- **A map, beside the bars rather than instead of them.** The geography slide gains a third view
  next to Chart and Table: a world map with the countries the report names shaded and a numbered
  badge on each. A share of AUM is a quantity, and a bar against a common axis is how a quantity is
  read — on a map the United States at 75.7% and Canada at 2.5% cover comparable parts of the page.
  The map answers what the bars cannot, which is where in the world those countries are, and the
  slide's method note changes with the view so the reader is never told about a scale that is not
  on screen.
- **Class breaks, printed.** Four classes — under 1%, 1–2%, 2–10%, 10% and over — because the shares
  run from about 76% to 0.4% and a continuous ramp would paint one country black and nine of them
  the same near-white. The legend prints the breaks.
- **Rank badges.** The number on each country is its rank in the table beside it, so a reader who
  finds 7 on the map reads 7 in the list. They also locate the countries too small to see: Taiwan is
  about three units wide on a 1000-unit map. Badges that would overlap are pushed apart along the
  line between them, which is unit-tested for separation and for staying in frame.
- **What the report does not name is missing, not zero.** The other 166 countries are drawn in one
  neutral fill with its own legend entry and a caption that says what it means. The neutral is
  `#E3E6EA` and not something paler because the first attempt, 4% off white, made the rest of the
  world vanish when the deck was printed to PDF — caught by rendering the page, not by a test.
- **Projected once, at build time.** `tools/make_world_paths.py` turns Natural Earth's Admin 0
  countries at 1:110m (public domain) into `app/src/fixtures/worldMap.data.ts` — Robinson
  projection, Douglas–Peucker simplification, integer coordinates, Antarctica dropped, about 44 KB.
  No mapping library ships and nothing is fetched at run time. No country is ever dropped
  altogether: one whose every ring falls under the area floor keeps its largest ring, which is what
  keeps Luxembourg on the map.
- **The deck gets a second generated block.** `npm run sync:deck` now writes `SHARED DATA` (the
  report on screen, `let`, replaced when the dashboard feeds the deck another vintage) and
  `WORLD OUTLINES` (`const`). The outlines are the same for every report, so they stay off the
  per-report feed. Both blocks have drift tests.
- **Two copies, held together.** The deck cannot import, so it repeats the class breaks, the legend
  labels and the badge radius. Three unit tests read the deck's HTML and fail if any of them stops
  matching `app/src/lib/geoMap.ts`.
- The same map appears on the dashboard's Positioning tab above the country table, and the printed
  document carries it as its own page after the geography slide. Both carry `role="img"` and
  alternative text listing every named country and its share; Natural Earth is credited on the
  slide and registered as a source record on the dashboard.
- Verification: lint · format · Vitest 499/499 (15 new) · build · Playwright 152/152 runnable
  (2 new) · `npm audit --omit=dev` 0 vulnerabilities · both PDFs regenerated at 25 pages · the
  printed map page rendered and inspected, which is how the vanishing-fill problem was found.

## 2026-09-20 — Revision 31: the change in fiduciary net position

- **The page the deck did not have.** The report's page 21 — what the fund took in and what it paid
  out, month by month across the fiscal year, with the three fiscal years beside it — is now slide
  8, between allocation and the return distribution. A column per month above or below the zero
  line, each labelled and signed; the fiscal years as figures, with the months that added and the
  months that took away.
- **Typed, because the page is a picture.** Page 21 is an image in the PDF, so nothing can be
  extracted from it. The figures are read from the page into `NET_POSITION`, and the two figures
  printed beside them hold the reading to account: the twelve months add to the printed fiscal-year
  total ($7,841mm against $7.8B) and their signs give the printed month counts (9 added, 3 took
  away). Both are unit tests. Only the net line is carried — the page stacks contributions, net
  investment income, benefits and administrative expenses behind it and prints no figure for any of
  them, and the slide says so rather than implying a split it cannot show.
- **Whose net position it is, established rather than assumed.** The report prints this page once,
  in section 04, with no entity heading and no OPEB counterpart. Scale settles it: the year's months
  add to $7,841mm, while the entire OPEB Master Trust moved $1,421mm over the same year. The slide
  carries a fixed scope chip — `LACERA Pension Plan` — instead of the entity chip, does not follow
  the entity toggle, and says so on the page. The reasoning is a unit test reading the market values
  the reports themselves print, so it is re-run rather than inherited.
- **The two books kept apart.** This is the plan's fiduciary net position, an accounting measure.
  Over the same fiscal year the investment-book market value moved $8,731mm. The slide names the
  difference so that $7.8B is not read as the change in market value, and the figures page sets the
  two bases against each other with the $890mm difference marked `calculated`.
- A slide that is not drawn per entity now sets `data-scope`, and the printed header follows it
  instead of the fund on screen — general, rather than a branch for this one page.
- The contents slide picked the new page up on its own, as it is built from the sections.
- Verification: lint · format · Vitest 484/484 (7 new) · build · Playwright 150/150 runnable · both
  PDFs regenerated at 24 pages · the slide and both printed pages checked in the browser and in the
  OPEB PDF, where the scope note has to do its work.

## 2026-09-19 — Revision 30: the items table and the bars

- **Status is a marker and a word.** The five pastel pills — each with its own fill, border and
  rounded corners, in colours from outside the report's palette — are replaced by a marker whose
  *shape* carries the status as much as its colour: a filled square in progress, a hollow square in
  development, a filled circle for attention, a rule for a quiet period, a check for completed.
  It reads in greyscale and for a colour-blind reader, which the pills did not, and the legend on
  the slide now shows the same markers. The status and page columns are set as columns of their
  own, the page right-aligned.
- **Bars end where the number says they end.** The drift and flow bars, and the distribution's
  columns, lose their rounded ends: a rounded end moves where a bar appears to stop against its
  axis, which is the one thing a bar chart is for.
- Checked at slide size: nothing overflows on any of the eleven slides, with every build shown.
- Verification: lint · format · Vitest 477/477 · build · Playwright 150/150 runnable · both PDFs
  regenerated (22 pages, and 21 KB smaller for the ink taken out).

## 2026-09-19 — Revision 29: the figures are set, not boxed

The pass that redrew the opening slides, carried through the rest of the deck. Nothing is drawn
around a number any more: a hairline above each block separates it, type carries the hierarchy, and
colour is kept for the two places it means something — the tiles belonging to the question on
screen, and a figure under the pointer.

- **Executive read.** The six tiles are a hairline grid rather than six bordered cards. The tiles
  belonging to the question on screen keep a two-pixel rule above them and a darker label; the rest
  are quiet. Hovering colours the figure and underlines its slide link.
- **Fund at a glance.** The four fund tiles lose the blue left edge, and the drill-down card loses
  its tinted panel: a hairline, then the composite, its market value against target, the return
  table and the drivers.
- **Performance.** The ten-year callout is set under a navy rule instead of in a tinted card with a
  coloured edge.
- **Distribution, geography, market context.** The statistics panel and the geography figures are
  separated by hairlines; the macro strip is six columns under one rule, divided by hairlines,
  rather than six boxes.
- Checked at slide size: no element on any of the eleven slides overflows its slide, with every
  build shown.
- Verification: lint · format · Vitest 477/477 · build · Playwright 150/150 runnable · both PDFs
  regenerated (22 pages each).

## 2026-09-19 — Revision 28: the opening slides are set, not assembled

The cover and contents slides were drawn from decoration — a gold bar, tinted cards with coloured
left edges. They are now set the way a report is, with type, alignment and hairlines doing the
work.

- **Cover.** The organisation line above the title, the fund under it, then the report's three
  dates as a colophon row under a hairline — each with its own small label — and the disclosure at
  the foot. No rule bar.
- **Contents.** A set list: the section in small capitals, the slides in it and the question they
  answer, the slide numbers right-aligned under a "Slide" heading, rows separated by hairlines. No
  fills, no coloured edges; hovering colours the type rather than the box.
- **The gold is gone.** It was the only decorative colour in the palette and is no longer used
  anywhere: the cover's rule, and — on the Explore tab — the benchmark marks and their legend key
  (now graphite, which reads against both the blue and the grey bars) and the scenario's problem
  panel (navy).
- Verification: lint · format · Vitest 477/477 · build · Playwright 150/150 runnable · both PDFs
  regenerated (22 pages each).

## 2026-09-19 — Revision 27: the Treasury yield curve joins the macro strip

The coverage check against the official August report found one gap whose figures are actually
readable: the yield curve on the report's macro page. It is now in the strip, for all 16 reports.

- **Read from FRED, at the date the report's chart ends.** The page carries two as-of dates:
  inflation and labour as known when the report was written, and the yield curve at the month the
  **fund figures** cover. Checked against the August 2026 report, which prints 3.9 / 4.1 / 4.2 /
  4.4 / 4.9 — FRED gives exactly those for June 30, 2026, and 3.8 / 4.2 / 4.4 / 4.7 / 5.2 for July
  30. The tool reads the last observation on or before the data-through date, a few days later,
  because the H.15 release lags a day and a month can end on a weekend.
- **Not scraped from the chart.** The chart's five end labels are a stacked list; the only link
  from a label to its tenor is the colour of its line, and the colours do not match the legend
  swatches exactly. Guessing that mapping would have put a number against the wrong maturity.
- The printed labels are held as `MACRO_PRINTED.curve`, and a unit test fails if FRED stops
  reproducing them — the same guard the other FRED-backed figures have.
- The strip's line reads "Treasury yields, Jun 30, 2026 · 3.9 · 4.1 · 4.2 · 4.4 · 4.9% · 3M · 2Y ·
  5Y · 10Y · 30Y constant maturity (FRED · Federal Reserve)" and appears on the deck's market
  slide, in the dashboard's macro panel, and on that slide's figures page in the PDF.
- The Excel template and its example were regenerated so the template's macro rows match the strip.
- Verification: lint · format · Vitest 477/477 · build · Playwright 150/150 runnable · the macro
  fetch re-run for all 16 reports · template rebuilt and re-exported through Excel (20 checks OK).

## 2026-09-19 — Revision 26: the deck opens like the report, and says what it used to leave implied

Three questions in a row about figures the slides had right but did not explain: why slide 1 says
June on a report presented in August, why the market table's FYTD equals its 1 M column, and why
only the Total Fund carries the actuarial hurdle. Each is now answered on the slide itself.

- **Cover slide.** Title, fund, the report's three dates, and the disclosure, written from the
  report's own labels.
- **Contents slide.** The five sections with the slides in each, the question each one answers, and
  where it starts; every line jumps there. Built from the deck's own section list, so it cannot
  drift from the slides.
- **Four computed notes**, each shown only where it is true, for any report:
  - slide 3 (executive read): fund figures through · markets and macro as of · presented to the
    Board — the three dates a CIO report carries;
  - slide 5 (performance): FYTD and 1 Y cover the same twelve months when the month ends the
    fiscal year; and, on a composite, that the actuarial hurdle is a Total Fund measure — the
    report prints none for a composite (checked against p. 9: one hurdle row, four benchmark rows);
  - slide 9 (market context): the fiscal year began July 1, so a table dated July 31 has one month
    in it and its FYTD column repeats 1 M (checked against p. 5, where the two columns are printed
    the same).
- **Page numbers are computed** from a slide's place, so adding a slide leaves no stale number. The
  dashboard's panel links (`SLIDE`) are pinned to the deck's order by a unit test that reads the
  deck file — the source of the numbering is the deck, not a remembered constant.
- The printed document opens with these two slides instead of its own generated cover: 22 landscape
  pages per fund (11 slides, 2 tab snapshots, 9 figures pages; the opening slides carry no figures).
- Verification: lint · format · Vitest 477/477 (1 new) · build · Playwright 150/150 runnable · both
  PDFs regenerated and read back.

## 2026-09-19 — Revision 25.1: a tab that changes the picture gets its own page

- The printed document now carries, straight after its slide, a snapshot of each tab that draws a
  different picture: the performance slide's **excess vs. benchmark** view and the market slide
  **sorted by return**. The snapshot is the slide itself with that tab chosen, and what the tab
  hides stays hidden — the print stylesheet shows every build, which would otherwise bring the
  benchmark bars and hurdle ticks back into the excess view.
- Tabs that only reorder or filter the same numbers (periods, composites, the items filter) are
  not duplicated: the figures page after each slide lists every period and every item.
- 21 landscape pages per fund. Verification: lint · format · Vitest 476/476 · build · Playwright
  150/150 runnable (the printed-document test now checks the snapshots and their order); both PDFs
  regenerated and read back.

## 2026-09-19 — Revision 25: the deck prints as a document that can be posted

Printing the deck now produces the publication file: **a cover, then every slide followed by a page
of the figures behind it** — 19 landscape pages per fund.

- **Auditable by construction.** Each figures page is built from the same data the slide is drawn
  from: the table, the report pages it came from, and how each figure is labelled
  (`reported_public`, `calculated`, `proxy_estimate`). A reader can check any number on a slide
  against the page that follows it. A figure the report did not supply says "not supplied" there
  too.
- **What each page carries.** Fund lines and composites (slides 1–2, with the drill-down's
  indicative contribution and the month's flows); every composite over all eight periods with
  benchmark, calculated excess, hurdle and contribution (3–4); market value, weight, target, drift,
  flows and overlays (5); the 14 bins and the printed statistics (6); the market table and the
  macro strip (7); geographic shares and the ten countries (8); every item for attention with its
  status and page (9).
- **The cover** states what the deck is and is not; every page keeps the footer disclosure.
- **Two ways to make it.** In the deck, **Print / PDF** → "Save as PDF" for the fund on screen.
  Or `npm run deck:pdf` (from `app/`), which drives the deck itself in headless Chromium and writes
  both funds to `outputs/cio_deck/CIO_Monthly_<Month><Year>_<Fund>.pdf` (`-- --fund`, `-- --out`).
  Nothing is redrawn for print: the slide pages are the slides, with every build shown.
- Verification: lint · format · Vitest 476/476 · build · Playwright 150/150 runnable (1 new: cover,
  slide/figures pairs for all nine slides, page size, labels). Both PDFs generated and read back:
  19 pages, 211 KB each.

## 2026-09-19 — Revision 24: slide 2 opens to what drove the month

A composite chosen on slide 2 now expands to the drivers behind its return. The report prints no
sub-asset-class returns, so the drivers are what its own figures support, and each is labelled for
what it is:

- **Its share of the fund's month** — month-end weight × its return, called indicative because
  beginning-of-month weights are not published, against the fund's return. For the Total Fund the
  column is the four composites and the reported total, with the difference (overlays, cash, other
  assets, weight drift) carried in the note rather than hidden.
- **Value since the previous report** — earlier close + return effect + the report's rebalancing
  flow + an unexplained remainder = this month's close. The remainder is shown, never absorbed; a
  fund whose flows are not supplied says so.
- **Markets this month** — the month's index moves from the report's own market table, named as
  context, not attribution: a composite holds far more than those indices, and public markets do
  not explain private valuations.
- The previous report's market values travel with the deck data (`PRIOR`, built by `deckPrior`),
  and are absent — with the bridge — for a template file or an imported feed, which are not part
  of the published series.
- Opening the drivers replaces the headline row they restate, so the card still clears the note and
  source row beneath it: 4 px on every selection, both funds (checked in the browser suite).
- Verification: lint · format · Vitest 476/476 · build · Playwright 149/149 runnable (1 new).

## 2026-09-19 — Revision 23: the deck's chrome, and steps that only cost a press where they build

- **One bar, at the bottom.** The top bar is gone. The section strip (Where we stand → Why →
  Positioning → Context → Attention) now sits beside the arrows under the slide, with the controls
  and one line of provenance on the row below it. The slide gets the rest of the window: the deck's
  chrome is 76 px at 1280 and wider, against 138 px before, and the dashboard's frame is sized to
  the measured heights again.
- **Speaker notes live in the presenter window.** The notes drawer and its button are gone (P opens
  the presenter view, which has always carried the notes, a timer and the next slide).
- **A finished look, with the disclosure kept.** The "PROTOTYPE SAMPLE" chip is removed. Each slide
  footer says "NOT AN OFFICIAL LACERA PUBLICATION" and the bar carries one line of provenance: this
  is built from the published report by this project, not by LACERA, and that has to stay legible
  on screen and in print.
- **Steps only where they build.** A slide's builds live in its chart view, so a slide showing its
  table now reports no steps and one press moves to the next slide; the same holds on the
  performance slide for a composite or the excess view, which are drawn complete. A build already
  reached is remembered, so switching back to the chart returns to it.
- Checked: no element on any of the nine slides overflows its slide; the deck keeps its controls on
  screen at 320–375 px.
- Verification: lint · format · Vitest 476/476 · build · Playwright 148/148 runnable.

## 2026-09-18 — Revision 22.1: play through the reports

- **Play the reports** (beside the report slider on CIO Monthly): steps through the 16 published
  reports every 1.6 seconds. It starts from the oldest when played at the latest and stops at the
  latest. The page follows the report on screen, so the Explore markers, the headline figures and
  the slides all move with it. **Pause** holds the current report. Choosing a report by hand while
  it plays carries on from there. At each step a screen reader hears the report on screen. Play is
  disabled while a template file or workstation dataset is shown. This restores the V3 "Play
  timeline" control that Revision 22 left out.
- Verification: lint · format · Vitest 476/476 · build · Playwright 148/148 runnable (new: play from
  the oldest, pause holds, play on to the latest and stop, on a controlled clock).

## 2026-09-18 — Revision 22: CIO Monthly › Explore — the published reports as one history

Three ideas from the ChatGPT "V3" package, rebuilt on the project's rules and the 16 published CIO
reports. The V3 code itself was not used.

- **Month by month** (cross-filter + timeline): every one-month return the reports printed, with
  categories as rows and data months as columns. Choosing a category follows it in the next panel.
  Choosing a month opens that report, and the report slider above is the timeline, so every panel
  marks the report on screen. No report carries November 2025, so that column says "no report" and
  is never filled in.
- **Chosen category**: monthly return against benchmark, and weight against target inside the IPS
  Table 1 range (market value for the Total Fund, labelled as not a return), with a figures table.
- **Correlations**: the categories' one-month returns pair by pair, each with its month count and an
  approximate 95% range (Fisher z). A range that includes zero is hatched and described as
  indistinguishable from no relation. Missing months are left out, never counted as zero. The chosen
  pair is shown as a scatter of its months. The panel warns that appraisal smoothing understates
  correlations with private holdings. For the Pension Fund at 16 months, every pair's range
  includes zero.
- **Scenario**: dollars per category to reach targets the reader enters, from the report's
  month-end market values. The other line (cash and overlays) is a source of funds, so buys equal
  sells. Nothing is calculated until the targets add to 100%. A target outside the IPS range is
  flagged. The panel is labelled hypothetical, not a recommendation or a trade plan.
- Pure, tested calculations in `lib/cioHistory.ts` (history with gaps, correlation and range,
  rebalance, targets in the address). Panels are in `components/explore/`, composed by
  `views/CioExplore.tsx`. Selections live in the address (`cat`, `pair`, `targets`).
- Verification: lint · format · Vitest 476/476 (15 new) · build · Playwright 147/147 runnable (7 new:
  the interactions and the shared link, the OPEB ranges, no sideways scroll at 320–375 px, axe).

## 2026-09-18 — Revision 21: open Excel workbooks directly, read in the browser

The CIO Monthly tab and the Import page now open an Excel workbook as well as a CSV. Before, a
person had to save the right tab as CSV first.

- **One path for the data.** `lib/workbook.ts` turns one sheet into the CSV text Excel would write.
  That text goes through the reader that already checks CSV files: `readCioPackage` for the CIO
  template, and the contract validator for imports. A workbook passes exactly the same checks as its
  CSV. The example workbook read this way gives a package equal to the one read from its "CSV UTF-8"
  export (unit test). Both demo workbooks' `Export_Contract` sheets give the same 376 records as their
  exported CSVs, at full precision (the CSV export rounds to 10 significant digits).
- **Values as stored, not as displayed.** A cell shown as 1.23% is read as 0.0123 and a date as its
  calendar date. A workbook whose formulas were never calculated (written by a program other than
  Excel) is refused with that reason, never read as blanks. So are cells showing Excel errors, with
  the cells named.
- **Choosing the sheet.** The CIO template uses its Export tab. Contract imports use
  `Export_Contract` or `Contract`, or else the sheet headed by the contract's column names. Title
  rows above the column names are skipped. When no sheet fits, the message lists the sheets it found.
- **SheetJS CE 0.20.3** (Apache-2.0) comes from its official tarball, pinned by integrity hash. The
  npm registry's `xlsx` stops at 0.18.5, which has published advisories. It is bundled as its own
  chunk (500 KB, 163 KB gzip), and the site fetches it from itself the first time a workbook is
  opened. Nothing is loaded from a CDN, and the file is never sent anywhere (browser test: no
  request other than GET, and none off-site). Workbooks are limited to 10 MB.
- **The example workbook opens as downloaded.** `tools/qa_cio_template.py` now recalculates and
  saves `CIO_Monthly_Template_Example.xlsx` through Excel, so its formulas carry their results. The
  blank template stays as generated. Opened directly, it gets the "not calculated" message.
- The how-it-works guide, `docs/cio-template.md`, `docs/data-contract.md`, `docs/architecture.md`
  and the README describe the workbook path. The CSV step is now optional.
- Verification: lint · format · Vitest 461/461 (11 new) · production audit 0 · build · Playwright 140/140 runnable
  (4 new desktop tests: example workbook built with nothing sent, blank template refused, contract
  workbook with a title block applied, workbook without a contract sheet refused).

## 2026-09-18 — Revision 20.1: dependency advisories cleared; browser tests gate every deploy

Audit finding 8, and the release checks it recommended.

- **Dependencies:** the smallest upgrades that clear every advisory — Vite 5 → 6.4.3, Vitest
  2 → 4.1.11, `@vitejs/plugin-react` → 4.7.0, `react-router-dom` 6 → 7.18.4, `vite-node` 3.2.4
  added explicitly (Vitest 4 no longer brings it; the project's scripts run on it), and the
  non-breaking fixes for `js-yaml` and `nanoid`. `npm audit`: 9 advisories (1 critical, 3 high,
  5 moderate) → 0. None affected the published static site — the critical and high entries were
  the Vitest UI server and Vite's dev server (the latter on Windows) — but both are the tools
  used to build it. Newer majors (Vite 8, Vitest 5) were not needed and not taken.
- **URL-bound controls:** React Router 7 applies URL updates as a transition, so a checkbox or
  selector bound to the address snapped back for a moment (the browser suite caught it on
  "Compare both funds"). `useUrlParam` now shows the value just set until the address catches up,
  and updates the address from its latest state.
- **Deploy gates** (`pages.yml`): the Playwright suite now runs on the built site before it is
  published (every route at desktop and three phone widths, accessibility scans, the CIO flows);
  the full dependency audit, development tooling included, is written to each run's summary.
- Verification: lint · format · Vitest 450/450 · build · Playwright 136/136 runnable (twice on
  the new versions) · `npm run sync:deck` and `cio:diff` on vite-node 3.2.4 · clean-checkout
  rehearsal of the deploy job including the browser suite.

## 2026-09-18 — Revision 20: fixes from the September 18 audit (import integrity, CIO reporting)

An independent read-only audit at `7c150c0` reproduced eight problems; all eight reproduced here
too. This revision fixes the first seven; dependencies follow separately.

- **Missing data is missing, never zero (P1).** Cash, flows and the return distribution are
  `null` when an import or template file does not supply them, and every panel, sentence and
  slide says "not supplied". A net flow is computed only from a complete set of flows. A template
  must give every flow or none. Before: a template without flows read "June flows netted $0M", and
  a feed without a histogram read "0 of them fell below −2%".
- **Imports keep their own label (P1).** A Workstation feed is classified as its rows are — the
  most cautious class when they are mixed — on the page and on every slide, with its dataset ID;
  before, a synthetic feed was labelled reported_public and cited the published report's pages.
- **Template checks (P2).** Refused now: fractional or negative bin counts, a negative standard
  deviation, a latest month outside the lowest–highest range or different from the Total Fund 1M
  return, weights or targets outside 0–100% or targets not adding to 100%, negative market values
  or cash, impossible calendar dates, and a report date on or before the data-through date. Every
  rule holds for all 16 published reports.
- **Fiscal-year rollover (P2).** July's FYTD is no longer compared with June's completed year:
  the change list opens with "New fiscal year: FYTD restarted July 1" and the FYTD tile says "new
  fiscal year"; FYTD (and, across January, YTD) excess flips are not counted across the turn. The
  change list now requires both reports' dates.
- **Market period (P2).** The executive read and slide 1 name the market table with its own dates
  ("from July 1 to July 31, 2026"); slide 7's notes no longer say FYTD equals 1 Y.
- **Histogram precision (P2).** "Sits above 27% of months" becomes a bracket from the grouped bins:
  "falls in the 0 to 1% range: 32 of the last 120 months were lower and 24 shared the range".
- **Deck on a phone (P2).** The standalone deck's chrome wraps inside the screen (at 390 px the
  page was 1,014 px wide); presenter-only controls hide, and a line points to the readable summary.
- **Release checks.** The build now type-checks `app/scripts` (two scripts assumed a histogram).
- Verification: lint · format · Vitest 450/450 (11 new regressions from the audit's cases) ·
  build · Playwright 136/136 runnable (new: feed missing figures and synthetic, template without
  flows, the July reset, the deck on three phone widths) · the audit's reproduction script now
  shows every case handled.

## 2026-09-18 — Revision 19.1: the how-it-works guide has the template steps

- `/how-it-works/` now walks through building the slides from the CIO template in five steps —
  download (with the filled example), fill the yellow cells, check, save the Export tab as CSV
  UTF-8, open it on the CIO Monthly tab — and says what happens with a faulty file and how the
  file is kept private. "Where the numbers come from" lists the template as a fourth source, and
  the GitHub section is now titled for published reports so the two routes are not confused.
- Verification: build · Playwright (the guide: heading, code links, template downloads, no
  horizontal overflow, axe) · page rendered at 1100 px and 360 px.

## 2026-09-18 — Revision 19: build the CIO slides from a template, before the report is published

- New Excel template (`app/public/templates/CIO_Monthly_Template.xlsx`, and a filled example of the
  latest public report): input tabs for both funds, the market table, the macro strip and the
  items for attention; a Checks tab with the report's own identities; an Export tab that writes a
  CSV in the new `cio-template-1` format (`docs/cio-template.md`). Built by
  `tools/make_cio_template.py`, checked in desktop Excel by `tools/qa_cio_template.py`.
- CIO Monthly tab: **Open a template file** reads that CSV in the browser and shows it as its own
  report — tab, panels and slides — labelled "template file …, not published", with changes
  against the latest earlier published report. Nothing is uploaded or stored: the file lives in
  memory, the address only says `v=file`, and a reload clears it (the tab says so). A file with any
  problem shows nothing and lists every problem (`app/src/lib/cioPackage.ts`).
- On the slides, the header, every source line and the speaker notes say the figures come from the
  template file and are not published; they are classified `calculated`.
- Round trip: the example workbook, recalculated and saved by Excel as CSV UTF-8, rebuilds the
  published August 12, 2026 report exactly (both funds, market table, macro strip, items). The
  one difference found on the way — top countries order — is fixed by listing them by share, as
  the report does.
- The how-it-works page links the template and the example; its code list names the reader and
  the format.
- Verification: lint · format · Vitest 439/439 (10 new: the round trip and every refusal) · build
  · Playwright 130/130 runnable (new: open the Excel export and see tab and slides built from it
  with no network request, a broken file refused with reasons, a reload clearing the file, axe on
  both states, both template downloads on the site) · Excel QA: 20 checks OK on the example.

## 2026-09-18 — Revision 18: add a CIO report from GitHub, no PC needed

- New workflow "CIO report" (`.github/workflows/cio-report.yml`). From the repository's Actions
  tab, anyone with write access pastes a report's lacera.gov PDF link; GitHub downloads the PDF
  (not stored in the repository), reads and checks it with the same extractor, pulls the macro
  strip's FRED figures as of the report's date, rebuilds the slides' data and proposes the update
  as a pull request listing what to type in and what changed. On that pull request a check job
  formats the typed file, regenerates the slides' data, commits it back and runs lint, format,
  tests and build; merging publishes.
- The extractor gained `--url` and `--append-ts`: one new report is added to the generated file
  and every existing report is kept byte for byte (checked by a round trip that removes the August
  2026 report and adds it back: identical file). A report already on the site, or older than the
  latest, is refused with the reason.
- The two tests a new report trips until its written parts are typed now say what to fix
  (`EDITORIAL_FOR`, the `MACRO_PRINTED` value that differs from FRED).
- The how-it-works page and `docs/cio-monthly.md` describe the GitHub route; the local route stays.
- Setup for the owner: repository secret `FRED_API_KEY`; optionally allow Actions to open pull
  requests (otherwise the run gives a one-click link); add teammates as collaborators.
- Verification: workflow YAML parsed and every shell step syntax-checked; the link check rejects
  other hosts, look-alike domains, http and appended text; both jobs run end to end locally against
  a scratch repository (real lacera.gov download, real FRED call, branch pushed, summary written,
  check job green); lint · format · Vitest 429/429 · build · Playwright 127/127 runnable.

## 2026-09-18 — Revision 17.1: a shareable "How this report works" page

- New page `/how-it-works/` (`app/public/how-it-works/index.html`): where the CIO Monthly slides'
  numbers come from (report PDF, FRED, typed in), the five steps that bring a new month onto the
  slides, how the slides work, and links to the code on GitHub. Plain static page, no scripts,
  light and dark themes, opens without the dashboard so it can be shared with the team.
- The CIO Monthly tab's header has a "How this report works ↗" link to it, beside "Present full
  screen".
- Verification: lint · format check · Vitest 429/429 · build · Playwright 127/127 runnable (new:
  the tab links to the page; the page opens on its own, every code link points to the public
  repository, no horizontal overflow at 320–1280 px, axe WCAG 2 AA clean).

## 2026-09-18 — Revision 17: the macro strip comes from FRED, for every report

- The CIO slides' macro strip (slide 7, and the Macro strip panel on the dashboard's CIO Monthly
  tab) now takes PCE inflation, the federal funds target range and the unemployment and
  participation rates from FRED, for **all 16 reports** instead of the latest only. Each report
  is read from FRED's real-time archive as of the month end before the report's month, so the
  figures are what was published then, not today's revised values. For the August 12, 2026
  report FRED as of July 31 gives exactly the printed figures (PCE 3.7%, core 3.3%, 4.2%, 61.5%,
  3.50–3.75%); a unit test checks this every run.
- New tool `tools/fetch_cio_macro.py` (reads the key like the Economic Context fetch and never
  prints or writes it; checks each series' FRED terms) writes `app/src/fixtures/cioMacro.data.ts`;
  `app/src/lib/cioMacro.ts` computes the lines (year-over-year PCE, the date the target range
  took effect) with unit tests.
- Still typed from the report, latest report only: the U.S. Dollar Index line (not a FRED series),
  the themes, and the report's commentary beside the FRED figures.
- Slide 7: the source line names FRED and its as-of date, the speaker notes explain the method,
  and the index chart tightens its rows when the strip appears (and when printing) — the strip
  used to overlap the source note.
- New unit test: the deck's script must parse. The deploy job runs the unit tests but not the
  browser tests, which were the only check that would have caught a broken slide script.
- Verification: lint · format check · Vitest 429/429 · build · Playwright 119/119 runnable ·
  slide 7 measured clear of the source line in every state (standalone, print, three older
  reports embedded) with no page errors.

## 2026-09-18 — Revision 16.3: the last typed-in statements on the slides now come from the data

- Slide 9's headline was typed into the page and said "nine positions open"; it counted the
  Finance Analyst Fellowship (2 positions), which the report marks completed. The headline is now
  counted from the items in the table — initiatives in progress, positions in searches not yet
  completed, manager updates, searches in quiet period — and reads "Six initiatives in progress,
  seven positions open, one manager update, one consultant search in quiet period".
- Slide 5's headline began "Within 1 pt of every target" whatever the figures were; it now says so
  only when the largest gap is within 1 pt, and otherwise names the largest gap.
- Slide 2's speaker notes carried a typed-in split of the Overlays & Hedges / Other Asset sliver
  ($476 mm / $73 mm) that no longer matched the data (combined $624 mm); the note now points to the
  combined value the slide shows from the data.
- Verification: lint · format check · Vitest 419/419 · build · Playwright 119/119 runnable · the
  built deck rendered for both funds with no page errors.

## 2026-09-17 — Revision 16.2: the slides size to the screen

- The slide frame on CIO Monthly was as tall as the window but only as wide as the page column,
  so on a wide monitor the 16:9 slide shrank to the width, floated in an empty band and ran off
  the bottom. The frame's height now follows its own width (the slide plus the deck's measured
  title bar, act strip and control bar), and on wide screens the frame extends past the page
  column up to the width at which the whole deck still fits the window height.
- Measured fits (frame, slide): 2000×1040 → 1455 px wide, slide 1431×805; 1440×900 → 1206,
  1164×655; 1205×1000 → 1155, 1131×636; 1024×768 → 929, 884×497; no page overflow at any width.
- Verification: Vitest 419/419 · build · Playwright 119/119 runnable.

## 2026-09-17 — Revision 16.1: the slides are the CIO Monthly tab's first view

- Opening CIO Monthly now shows the report's slides inside the dashboard — no click out to
  `/deck/`. "Slides" is the tab's first and default sub-tab; Summary, Performance, Positioning and
  Markets & items follow, one click each. The report slider and selector above the slides choose
  which report they present.
- The page's ← → (and Page Up / Page Down) keys step the slides without clicking into them,
  unless a control on the page has the keyboard. Choosing the Slides sub-tab or a "▶ Slide n" link
  brings the whole slide on screen and gives it the keyboard; opening the tab itself leaves the
  page where it is.
- The band button on CIO Monthly is now "Present full screen": from any sub-tab it opens the
  slides and presents them alone. The standalone deck's "Dashboard" link opens the Summary.
- Verification: Vitest 419/419 · production build · Playwright 119/119 runnable (the deck test
  now opens the tab and steps the slides with the page's arrow keys) · renders reviewed at 1205 px.

## 2026-09-17 — Revision 16: less noise, motion and interaction, and the CIO slides fed by the dashboard

- **Noise cut, audit trail kept.** Each page now states once what its figures are: an "About
  these figures" line (vintage, source and the classification that applies unless marked, with the
  detail and the legend behind it), a page-foot source list, and badges only where a figure's
  classification differs. Citations became "Source" chips that open the full reference; method
  notes and caveats moved behind "How this is calculated"; the table copy link became a ⋯ panel
  menu (copy table as CSV, copy a link to the panel). Panel headings are a title and at most one
  muted line; table rules are lighter. The notice bar and band title no longer repeat dates —
  the header carries the one date statement.
- **Long views split into sub-tabs** kept in the address (`?tab=`). CIO Monthly: Summary ·
  Performance · Positioning · Markets & items · Present slides. Economy: Summary · Factors & lens
  · Indicators · Sources & method. Measured at 1440 px, CIO Monthly went from 7.8 screens, 16
  panels and 1,171 words of small print on one page to a 1.8-screen Summary (6 panels, 203);
  Economy from 7.3 screens and 1,227 to a 1.8-screen Summary (196).
- **Motion that shows change** (off under reduced motion): charts draw in the first time they
  scroll into view; bars, lines and exposure bars move to new values when the fund, report,
  range or scenario changes; changed headline figures flash once; disclosures open smoothly.
  Nothing counts up from zero.
- **Interaction:** pointer and arrow-key tooltips on the Overview, Performance, CIO trend and
  Economy charts (one tab stop each); legend keys that hide a series; the Performance table and
  chart highlight each other, as do the Overview allocation strip and legend; a report slider
  across the 16 CIO reports (the trend charts mark the report on screen and open a report on
  click); what-if sliders on the Economy lens that re-rank the sleeves and are marked "Scenario —
  not observed" (`?s=`); drag-to-zoom on the Economy history chart; panel links (`?p=`).
- **The dashboard feeds the CIO slides.** The Present slides sub-tab shows the deck exactly as it
  presents standalone, in a frame, with the dashboard's data for the report on screen — any of the
  16 reports or an imported schema 1.4 workstation feed (locked to its one fund). The fund
  toggle and the slide number stay in step both ways, and "▶ Slide n" chips on panels open the
  matching slide. Editorial slides say when their pages exist only for the latest report; the
  market slide says when a report's table was not extracted. Imported text is stripped of markup
  characters before it reaches the slides. The standalone `/deck/` still shows the latest public
  report. New: `lib/deckFeed.ts` (5 tests), `components/DeckFrame.tsx`; the deck gained embed mode,
  guards for older reports and feeds, and a histogram window taken from the report.
- Verification: Prettier · ESLint · tsc · Vitest 419/419 · production build · Playwright 119/119
  runnable (axe WCAG 2 AA on every tab and sub-tab, the presented deck excluded as its own page;
  no page overflow at 320, 360 and 375 px; new tests for the embedded slides, slide links, panel
  menu and links, page statements, keyboard chart reading and the scenario) · renders reviewed
  at 1440 and 375 px.

## 2026-09-16 — Revision 15: Economic Context tab (public macro data beside the fund)

- **New Dashboard tab, "Economy" (`#/macro`)**, combining the two exploratory economic
  dashboards (ChatGPT regime dashboard, Claude Sleeve Exposure Monitor) into one page that
  answers where the U.S. economy sits against its long-run norms, which way it is moving, and
  which policy sleeves today's readings lean against. Method, sources and limits:
  `docs/economic-context.md`.
- **Two-minute read:** level read (growth and inflation z-scores; a quadrant is named only
  outside ±0.5 σ, so the current reading says "on the border between Overheating and
  Stagflation" instead of "Stagflation"), direction read (core PCE, unemployment and payroll
  rules), total-fund lens figure, and the largest three-month factor move.
- **Regime map** with the 12-month path; **direction rules table** with inputs and thresholds.
- **Portfolio lens** (proxy estimate) on the selected fund's IPS Table 1 long-term targets:
  fund, category and asset-class exposure = Σ stated sensitivity × factor z, largest driver per
  row, selectable factor arithmetic, the full sensitivity grid, and stated limitations. Pension
  and OPEB structures both reconcile (tested).
- **Seven factors** with 3- and 12-month changes, five-year lines, and a component drill-down
  (series, measure, latest value and month, signed z, sample).
- **Indicator board:** six questions, each series at its own latest date with its change basis,
  classification and five-year line. **History** (any factor or indicator, 1Y/3Y/5Y, values
  table), **Treasury curve** on common dates against one month and one year earlier,
  **transmission channels**, and **sources and terms** listing all 38 series used and the 7 left
  out with the reason.
- **Data:** a dated FRED snapshot (retrieved September 16, 2026) written by the new
  `tools/fetch_macro_snapshot.py`. The site calls no API and holds no key. ICE BofA spreads,
  Moody's Baa, IMF copper and University of Michigan sentiment are excluded on their
  redistribution terms; the tool re-checks every series' notes and aborts on restriction
  language. All derived figures are computed in `app/src/lib/macro/` (20 unit tests).
- The snapshot loads only with the tab (lazy chunk, 73 KB gzipped); the header reads its dates
  from a small generated meta file. Nav gaps tightened from 28 to 20 px so eight views and the
  mode switch share one row at conference-room widths. Glossary gains z-score, macro factor and
  stated sensitivity. The FRED key file is git-ignored (Revision 14).
- Verification: Prettier · ESLint · tsc · Vitest 412/412 · production build · Playwright
  79/79 runnable (axe WCAG 2 AA on every route including `/macro`; no page overflow at 320, 360
  and 375 px; four Economic Context interaction tests) · renders reviewed at 1440 and 375 px.

## 2026-09-16 — Revision 14: the site and deck take the CIO Monthly Report's visual identity

- Every colour now comes from the LACERA Chief Investment Officer Monthly Report,
  extracted programmatically from the August 2026 report's drawing fills and text
  runs rather than matched by eye: the title-bar navy `#10233D` for the view band,
  the pale blue-grey section band `#DBECF4`, cyan data bars `#05C3DE` for the fund
  against dark-blue `#254061` for the policy benchmark, the report's charcoal footer
  `#242424`, and the allocation pie's category colours (Growth `#376092`, Credit
  `#0070C0`, Real Assets & Inflation Hedges `#00B0F0`, Risk Reduction & Mitigation
  `#9ABADD`, overlays and other `#7F7F7F`) for every allocation display.
- Type follows the report: Arial for text, Segoe UI as the fallback its charts use.
  Both are system fonts, so the self-hosted Mulish package is removed and the site
  still makes zero network requests.
- The slide deck's house palette is aligned to the same extracted values (it had
  approximated them).
- Verification: Prettier · ESLint · tsc · Vitest 392/392 · production build ·
  Playwright 70/70 with axe WCAG 2 AA on every route, so the new palette passes
  contrast · renders reviewed against pages 1, 8 and 9 of the report.

## 2026-09-07 — Revision 13: user-experience pass (items 1–8 of the improvement list)

- **Overview leads with the monthly vintage.** A "latest monthly report" strip
  sits above the fiscal-year block: market value, month return against its
  benchmark, fiscal-year-to-date against the hurdle, and the widest allocation
  gap, with its own report date, its own citation, and a stated warning that
  this is the investment portfolio's market value rather than the fiscal-year
  fiduciary net position. A labelled divider opens the FY2025 block.
- **Two-minute read on the CIO Monthly tab.** Four standing questions — on track
  against policy and the hurdle, where the difference came from, positioned per
  policy, risk and market context — answered from the figures on the page by
  `app/src/lib/cioNarrative.ts` (13 unit tests). Nothing is written for a
  particular month: the hurdle sentence flips when a period falls below it, the
  attribution sentence says "lead" or "shortfall" as the sign requires, and the
  attribution answer carries the proxy-estimate badge. Each answer links to the
  panel holding its evidence.
- **What changed since the prior report**, as a list with direction chips: weight
  moves of half a point or more, return moves of a tenth or more, an excess that
  changed sign, any policy-target change (flagged because drift is not
  comparable across policy versions), and the market value. Tile subtitles now
  carry ▲/▼ chips with a sign and a unit rather than a sentence.
- **Trend across reports switches between chart and table.** Four small multiples
  (market value, monthly return, fiscal-year-to-date against benchmark, Growth
  weight against target) drawn from the same values the table lists; a report
  that does not print a period leaves a gap in the line.
- **Compare both funds**: the performance and composites panels put Pension and
  OPEB side by side for the same report, each against its own benchmark and its
  own policy targets, with a note that the return columns are not a like-for-like
  ranking.
- **Shareable state.** The fund (`?e=`), the selected report (`?v=`), the
  Returns/Excess view, the attribution period, the trend view and compare mode
  all live in the URL, so a pasted link reproduces the screen. `EntityProvider`
  moved inside the router to make the fund URL-backed.
- **Copy any table as CSV**: every panel holding a table offers it (values as
  displayed, formula-injection guarded); panels without a table hide the action
  via `:has()`.
- **Definitions**: a glossary in the footer of every page — TWR, MWR, policy
  benchmark, hurdle, FYTD, SAA and ½-step, drift and near bound, IBOR/ABOR,
  fiduciary net position, funded ratio and UAAL, bp and pp, lagged benchmarks —
  plus every classification badge, linked from the performance note.
- **Sticky section bar** on the CIO Monthly tab (eleven panels) and the ACFR
  workflow, following the panel nearest the top of the viewport.
- Verification: Prettier · ESLint · tsc · Vitest 392/392 (+12) · production build
  · Playwright 70/70 (+7 covering the read, URL state, trend toggle, compare,
  the Overview strip, the glossary and the copy action; axe still clean on every
  route) · zero page errors · no horizontal overflow at 320–375 px.

## 2026-09-07 — Revision 12.3: monthly QA discipline and the audit residuals

- Visual regression as local QA: `npm run test:visual` compares full-page
  renders of the Overview, the CIO Monthly tab and the deck's first two slides
  against baselines under `outputs/visual-snapshots/` (ignored, platform-
  specific); `npm run test:visual:update` refreshes them deliberately. Kept in
  its own Playwright config so the default smoke suite never depends on
  baselines.
- Accessibility residuals from the Revision 10 audit closed: the four
  card-style tables carry explicit ARIA table roles so their semantics survive
  the phone layout; every scrolling table container is a labelled, keyboard-
  focusable region (label taken from the table's caption); switching funds after
  an import shows a dismissible “Import discarded” notice naming the dataset and
  its row count (entity isolation stays deliberate; the silence is gone).
- Verification: Prettier · ESLint · tsc · Vitest 380/380 · production build ·
  Playwright 63/63 (axe on every route with the new roles and regions; discard
  notice exercised) · visual baselines created and compared (3/3).

## 2026-09-07 — Revision 12.2: the Workstation feed for the CIO Monthly layer (schema 1.4)

- Data contract 1.4.0: a `cio_monthly` record type carries the monthly report's
  figures as rows (returns, benchmarks, hurdle, market value, weight, target,
  flow, cash, histogram counts and statistics; closed metric vocabulary) and five
  trailing-period tokens (`3M`, `YTD`, `3Y`, `5Y`, `10Y`) join `period_type`.
  Rule V24 enforces the report's own identities per entity and as-of (weights to
  1, composites to the total, 14 bins to 120 months, every composite return
  paired with its benchmark, TOTAL 1M/FYTD/1Y present). `reported_public` is
  allowed on the feed when it re-expresses the public report.
- `app/src/lib/dataset/cioFeed.ts` assembles the rows into the entity shape the
  CIO Monthly tab renders; the dataset exposes it as `cioFeed`. An applied import
  that carries the feed appears in the tab's report selector as “Workstation
  dataset”, the masthead, notice bar and band say so, a banner shows the
  demonstrated publication gate and the rows' classification, and changes are
  computed against the newest public report before it. Geography, the market
  table and the editorial pages are not part of the feed and the tab says so.
- Sample `data/sample/cio_monthly_feed_demofund.csv` (121 rows, generated by
  `npm run emit:cio-sample` from the latest public vintage); a round-trip test
  proves the feed rebuilds the extracted figures exactly, and V24 tests reject
  broken weights, an unpaired return and an unknown metric. The Data tab offers
  the sample for download with instructions.
- Docs: data-contract 1.4.0 section, validation rule V24, sample README,
  cio-monthly.md “Workstation feed”; the data dictionary picks up the new tokens.
- Verification: Prettier · ESLint · tsc · Vitest · production build · Playwright
  (incl. importing the feed sample and opening it as the Workstation dataset) ·
  zero page errors.

## 2026-09-07 — Revision 12.1: interactivity that moves a reader to the evidence

- CIO Monthly tab: each headline tile jumps to the panel that supports it
  (composites, by-period table, gap attribution, trend across reports); the
  performance panel has a Returns / Excess-vs-benchmark view with signed bars
  and the margin over the hurdle; the gap-attribution panel's second period is
  selectable (1 M … 10 Y next to FYTD); every panel links to its slide in the
  deck when the latest report is shown.
- Composites table gains the IPS range and the distance to the nearer bound,
  comparing the month-end weight with the policy in force (IPS Table 1, restated
  June 12, 2024) — labelled calculated and explicitly not a compliance
  statement; “near bound” and “outside” tags use the same threshold as Policy
  Monitoring; cited to the IPS alongside the report.
- Classification badges carry a definition tooltip everywhere they appear
  (reported_public, synthetic, proxy_estimate, calculated, stale, missing).
- Deck: the two slide-2 notes that still quoted July's overlay and other-asset
  dollar figures are now written from the data.
- Verification: Prettier · ESLint · tsc · Vitest · production build · Playwright
  · rendered controls checked in a browser · zero page errors.

## 2026-09-07 — Revision 12: CIO Monthly history, extractor, and vintage-driven deck

- Sixteen CIO Monthly Reports (April 2025 – August 2026; data through February 2025
  – June 2026) are now in the fixture, extracted from the public PDFs by
  `tools/extract_cio_report.py`: pages are found by content, cells are read by word
  coordinates and assigned to header anchors, and every report must pass the
  identities it prints (weights to 100, composites to the total, histogram to the
  month count, flows to the net, five countries per group) or it is rejected with
  the reason. January 2026 is excluded (its performance table is an image). The
  July 2026 extraction reproduces the hand-lifted deck data exactly.
- The CIO Monthly tab selects any report (`#/cio?v=<data-through>`); the masthead,
  notice bar and title band follow the selection. Tiles and the performance table
  show changes against the prior report, the composites table gains a Δ-weight
  column, and a new "Trend by report" panel lists every vintage (market value,
  1 M, FYTD, 1 Y excess, weights, net flow) with row selection. Reports whose
  market table is not machine-readable say so; editorial panels (macro strip,
  items for attention) are shown for the latest report and linked for older ones.
- Citations are built per vintage (report date, pages, deep link into that PDF);
  the fixed July 2026 records left the source registry.
- The deck is generated from the latest vintage: its data block now carries a
  `VINTAGE` record and every month or report date in the prose is a placeholder
  filled from it; the executive slide's hurdle, gap-source, target-proximity and
  market/macro sentences are computed from the data instead of written for one
  month. It now shows the August 12, 2026 report (data through June 30, 2026).
- Editorial content for the August report (macro strip; initiatives, personnel,
  Acadian co-CIO appointment, real-estate consultant quiet period) with an
  `EDITORIAL_FOR` guard that fails the tests when a newer vintage lacks it.
- `npm run cio:diff` prints what changed between two reports — the monthly
  checklist; `docs/cio-monthly.md` documents the pipeline.
- Verification: Prettier · ESLint · tsc · Vitest 374/374 (16 vintages × identities)
  · production build · Playwright 61/61 (incl. report selection moving masthead,
  band and panels together; deck renders from the regenerated block) · zero page
  errors · no horizontal overflow at 320–375 px.

## 2026-09-07 — Revision 11: CIO Monthly integrated with the dashboard

- The CIO Monthly decision deck (`/deck/`, still served exactly where people
  view it) and the dashboard now share one data source. The deck's embedded
  figures were lifted verbatim into `app/src/fixtures/cioMonthly.data.ts` by
  evaluating the deck's own data block (not retyped), and that block is now
  regenerated from the fixture by `npm run sync:deck` between marker comments.
  A unit test fails if the block on disk differs from the fixture, so the two
  surfaces cannot drift. The deck's behaviour, presenter view and single-file
  portability are unchanged.
- New Dashboard tab “CIO Monthly” (`#/cio`, lazy-loaded): the monthly vintage
  (CIO Monthly Report of July 8, 2026, data through May 31, 2026) as panels —
  headline tiles, performance vs. benchmark and actuarial hurdle by period, the
  gap-attribution proxy with its residual shown (`proxy_estimate`), composites
  with drift vs. the 2024 SAA targets, May flows and overlay programs, the
  120-month return distribution, market context, the macro strip, geographic
  exposure, and items for attention — each with a classification badge and a
  page-level citation. The masthead date, notice bar and title band switch to
  the monthly vintage on this tab, and a note states that monthly figures are
  never combined with the fiscal-year tabs.
- Links both ways: “Open as slides” in the tab's title band; “Dashboard ↗” in
  the deck's control bar.
- Source registry: eight CIO Monthly Report records with verified deep links
  (the lacera.gov file is byte-identical to the reference copy; the PDF index
  equals the printed page).
- Consistency test for the monthly figures (composites sum to the fund, weights
  to 100%, May flows to the net, 120 months per histogram, latest month placed
  in its bin, geography lists five per group in order) — all pass on the lifted
  data.
- Verification: Prettier · ESLint · tsc · Vitest 189/189 (+17) · production
  build · Playwright 60/60 (the new route on four viewports plus axe; deck
  renders from the shared block and links back) · zero page errors · no
  horizontal overflow at 375 px.

## 2026-09-07 — Revision 10.1: open items resolved against the source documents

- Located and downloaded the two public documents the audit was missing
  (`outputs/data/public_docs/`, ignored): the 2025 PAFR (`pafr_2025.pdf`,
  lacera.gov annual reports) and the OPEB Master Trust IPS restated June 12,
  2024 (`IPS-OPEB.pdf`). The Pension IPS of the same date
  (`invest_policy_stmt.pdf`) was re-checked row by row against the app's table.
- O1 resolved — transcription error corrected: the PAFR p. 7 chart prints
  685.6 over FY2021 and 397.1 over FY2022 (label x-coordinates match the axis
  ticks); a text-order read had swapped them. With the fix every step of the
  OPEB cumulative-NII series ties (+452 in the +28.4% year, −288 in the −11.2%
  year, +247.5 vs $248M, +368.4, +472.6); the on-screen disclosure is removed
  and the test now requires the FY2023 step to tie for both entities.
- O2 resolved — source-document inconsistency, reproduced as printed: OPEB IPS
  Table 1 (printed p. 21) prints 6.5 + 2 + 2 + 5 = 15.5 under a 16.5 ½-step
  category; the Allocation view says so and the test lists it as a verified
  source gap.
- Citations now link to the PAFR (page anchors equal printed pages) and to both
  IPS documents: `IPS_T1` → Pension IPS p. 20; new `IPS_OPEB_T1` → OPEB IPS
  p. 21, so OPEB views cite the OPEB document rather than a shared label.
- Verification: Prettier · ESLint · tsc · Vitest 172/172 · production build ·
  Playwright 53/53 · rendered citation links checked in a browser · zero errors.

## 2026-09-06 — Revision 10: live-site audit and improvements

- Audit of the deployed prototype (eswinra.github.io/portfolio-analytics-prototype)
  on desktop, 375/360/320-px phones, and print, plus a code-level review of the
  financial logic, provenance, and accessibility. Record: `docs/product-review.md`
  (“Revision 10 audit — 2026-09-06”); renders under `outputs/renders/audit*/`.
- Citations: the three ACFR deep links opened the wrong pages (printed page n is
  PDF page n + 2 in the FY2025 file); anchors now resolve through `acfrPage()`.
  New `ACFR_RETURNS` source (pp. 112–113, rates of return incl. assumed rate).
- Provenance: the four Overview KPI tiles carry a `reported_public` badge and a
  source line; source lines added to the Overview changes panel, the Policy
  Monitoring compliance table, and the IPS tables; the cumulative-income chart
  is labelled `calculated` (sum of quoted annual figures).
- Published-figure consistency test (`app/src/fixtures/published.test.ts`, 41
  tests): statement identities, tile/flow/statement agreement, mix and IPS sums,
  fee arithmetic, and every derived sentence. It found two transcription
  discrepancies, now disclosed on screen and open for verification against the
  PAFR / OPEB IPS: the OPEB cumulative-NII series steps −$41.0M in FY2023 against
  $248M of NII, and the OPEB Real Assets ½-step sub-rows sum to 15.5% vs the
  category's 16.5%.
- “Exceeds the actuarial assumed rate at every horizon” is now computed against
  the decade-high assumed rate from the ACFR (7.25%/7.00% Pension, 6.00%/6.25%
  OPEB) instead of asserted in prose.
- Workstation: contribution reconciliation is shown on the Reconciliation view
  (arithmetic sum vs chain-linked QTD return, residual vs 10 bps tolerance) and a
  FAIL now blocks the demonstrated publication gate; a proxy's one-day return
  requires the immediately preceding close (`lastDailyReturn`) and the daily
  read-through series no longer books a multi-day move across a missing close to
  one date; the Exceptions caption no longer claims that no reported_public row
  feeds a calculation (the IPS policy-band rows set the ranges the allocation
  checks test); the passing-controls table lists passing controls only; ACFR
  completion rows get a deterministic record id.
- Shell: Workstation views lazy-loaded behind a per-route error boundary (main
  chunk 531 KB → 370 KB; unused `recharts` removed); single-row scrollable nav
  and scroll-shadowed tables on phones; print stylesheet; `theme-color`;
  aria-live outcomes for “Copy board brief” and ACFR completion copy;
  `type="button"` on link-styled buttons.
- Verification: Prettier · ESLint · tsc · Vitest 172/172 (+46) · production
  build · Playwright 53/53 with axe on all ten routes (was two) · zero console
  or page errors.

## 2026-08-13 — Revision 9.1: post-audit follow-ups

- Import confidentiality copy hardened per the second external audit: browser-local
  processing is now stated as a privacy property, not an authorization or security
  control — confidential or non-public data belongs only in an approved private
  environment.
- Sanitized replacement handoff written to `outputs/handoff-2026-08-13-rev9.md`
  (ignored; pinned to commit 3d4bc9a, source-precedence ordered). The four historical
  prompt files were marked “SUPERSEDED — HISTORICAL REFERENCE — DO NOT EXECUTE”
  outside the repository; verified none of them ever entered the repo or its history.

## 2026-08-13 — Revision 9: trust & controls (external-audit tranche)

Owner-approved response to the external audit (11 findings independently verified): one
coherent tranche hardening controls, methodology honesty, delivery safety, and mobile/a11y.
No visual redesign.

- **Entity registry hard gate**: `app/src/fixtures/entityRegistry.ts` maps entity → legal
  fund → policy pack; staging AND apply both run `checkEntityMatch`. A cross-fund file is
  rejected before staging with `E-ENTITY` naming both funds and stating that nothing was
  applied (`E-UNREGISTERED` / `E-TRACKER` for unknown and tracker entities). Switching
  workspace tabs discards any staged preflight; the Import panel now names the active
  workspace. Policy identity is never inferred from entity-name text (`inferPolicyEntity`
  removed).
- **ACFR completion eligibility**: `sectionEligibility` computes open requirements
  (tie-outs, artifacts, Blocked items, independent reviewer, ready-for-sign-off status).
  Leadership sees “Completion unavailable — N requirement(s) open” with a visibly disabled
  action; a section whose recorded status outruns its controls carries a
  “status ahead of controls” tag (the INTRO fixture demonstrates detection); completion
  rows write `reviewed_by`.
- **Methodology fail-closed**: fund-vs-benchmark legs compare `return_method` and
  `gross_net`; a mismatch suppresses the comparison and raises a blocking `METHOD-*`
  exception instead of computing a number.
- **Proxy impact honesty**: context-only series report a modeled impact of 0.0 pp and are
  labeled “(context)”; mapped proxies quantify the coverage loss in percentage points.
- **Publication gate (demonstrated)**: `publishEligible`/`publishBlockers` derive from
  blocking-tier exceptions plus out-of-tolerance reconciliations; the workstation title
  band shows ELIGIBLE / INELIGIBLE with the blocking conditions listed.
- **Source registry and date separation**: typed `SOURCES` registry (ACFR page-anchored
  URLs; deliberately no fabricated PAFR/IPS links) rendered by `SourceLine`; `DateLine`
  separates report date, actuarial valuation date, data-through, and retrieval; TWR
  net-of-fees kickers with the MWR non-comparability and benchmark-lag footnotes; UAAL
  shown in $B alongside thousands; derived tables labeled “calculated from quoted
  figures”.
- **Honest renames**: Risk & Compliance → Policy Monitoring; Holdings & Managers →
  Holdings & Fees; the OPEB funded view is titled “Benefits & prefunding”.
- **Mobile and a11y**: zero page-level horizontal overflow at 320/360/375 across all ten
  routes (charts compress via `--chart-gap` and shrinkable bars; role-row note and grid
  minmax fixes); tables card at ≤640px with data-labels and Status/Tier first; header
  contrast raised; route changes move focus to the view title; scrollable table regions
  are labeled; disabled primary buttons are visibly disabled.
- **Delivery safety**: dev-server `fs.allow` narrowed to the app plus `data/sample`
  (references are never servable); the Pages workflow now gates deploy on lint, format
  check, the test suite, and `npm audit --omit=dev --audit-level=high` before build.
  Repo-settings recommendation (owner action): require reviewers on the `github-pages`
  environment.
- **Verification**: 124 vitest tests (entity gate, ACFR eligibility truth table, method
  fail-closed, publication gate, jsdom component tests for the two gates); new Playwright
  smoke suite — 45 checks across desktop and 320/360/375 — covering per-route overflow,
  axe on Overview and Import, and the three demonstrated controls; screenshot evidence in
  `outputs/` (ignored).

## 2026-08-13 — Revision 8.2: Dashboard | Workstation split (owner-directed)

The app now has two first-class modes, matching the workflow architecture: a place where
the work is populated and a presentation layer that (in the internal version) feeds from it.

- **Mode switch** in the nav bar (Dashboard | Workstation), all URLs stable.
- **Dashboard** (6 tabs): Overview, Performance, Allocation, Funded Status, Risk &
  Compliance, Holdings & Managers — the published-FY2025-figures presentation.
- **Workstation** (4 tabs): Data (import pipeline), Reconciliation, Exceptions, and ACFR
  Workflow — moved out of the presentation nav, where it belonged: it is a production
  tracker, not presentation content. Workstation pages keep the synthetic-data banner, now
  stating the feed relationship: in the internal version the dashboard consumes what the
  workstation publishes; here the dashboard quotes published documents while the
  workstation demonstrates the pipeline.
- Footer restates the same relationship with the four workstation links.
- Verified in the browser across every mode transition; 106 tests, pipeline clean.

## 2026-08-13 — Revision 8.1: team workflow demo restored (Import, Reconciliation, Exceptions)

Owner-approved restoration of the operating half of the team-tool vision, incorporated into
the LACERA design without touching the seven-tab presentation nav.

- **Team workflow demo section**: Import, Reconciliation, and Exceptions return as
  footer-linked views styled on the LACERA system, each carrying a surface-tinted banner
  ("Team workflow demo — synthetic contract data (schema 1.3, V01–V23)") plus its own
  sub-nav, keeping the published/synthetic wall explicit. The title band labels these views
  "Team workflow demo · synthetic DEMOFUND/DEMO-OPEB data".
- **Import**: the full pipeline proof is back — drag-and-drop with preflight, apply/discard,
  downloadable error report, the schema-1.3 Data Dictionary rendered from the validator's
  constants, template downloads, and the first-timer guide. The draft-data banner reappears
  (workflow section only) when imported rows are review_status=draft.
- **Reconciliation**: paired sources with computed variance, tolerance-as-data, and the
  deliberate demo break, restyled in the tag language (breaks render as the navy Blocked
  tag).
- **Exceptions triage**: tier + days-open queue, Team Activity provenance panel, passing
  controls, and the dataset provenance/citations details. Risk & Compliance links to it.
- **Plumbing**: DatasetProvider remounted beside the published-figures context with an
  EntitySync bridge, so the header Pension/OPEB toggle drives the synthetic dataset too;
  ui.tsx regains compatibility helpers (Pill→Tag mapping, fmtPct/fmtMm/fmtSmartReturn,
  ClassBadge).
- Verified end-to-end in the browser: preflight → apply → draft banner → restore; entity
  sync to DEMO-OPEB; 106 tests, lint, typecheck, build clean.

## 2026-08-13 — Revision 8: LACERA redesign (published FY2025 figures, seven views)

Implemented the owner's design handoff (`design_handoff_lacera_portfolio_analytics/`) —
a LACERA-branded presentation layer quoting only published documents.

- **New chrome**: notice bar, LACERA wordmark header with a Pension Plan / OPEB Trust
  segmented control, seven-tab nav with 3px accent underline, accent-800 title band with
  "Copy board brief" on Overview, accent-200 strip, and the mission footer. Single navy
  ramp on white, square-cornered 1px-bordered panels, Mulish throughout — self-hosted via
  @fontsource so the built site still makes zero network requests.
- **Seven views**: Overview (KPIs, FY2016–25 growth bars, allocation strip, returns table,
  FY2025 flows), Performance (returns + grouped bars, three-year changes table, cumulative
  investment income SVG), Allocation (full-width policy bullets with ½-step ticks and
  published-actual diamonds + complete IPS Tables 1–2), Funded Status (funded-ratio bars,
  membership / OPEB enrollment + prefunding story), Risk & Compliance (range-compliance
  table, excess-by-horizon cards, governance notes), Holdings & Managers (largest equity/
  fixed income holdings, management fees), and the ACFR Workflow board restyled on the new
  system while keeping its contract-record plumbing (tracker file + crosswalk).
- **Every displayed figure is a reported_public quotation** from the 2025 PAFR, 2025 ACFR,
  or the IPS documents, with per-panel source citations (config-gated). The OPEB actual mix
  is deliberately not reproduced (published only as a chart) and the views say so.
- **Retired from navigation** (legacy routes redirect): Trends, Exceptions, Recon, Import,
  Methodology — the synthetic daily-workflow story steps back behind the presentation
  layer. The contract engine, validators, fixtures, generators, and all 106 tests remain
  intact and green.
- Bundle: Recharts dropped from the build; Mulish woff2 subsets bundled locally.

## 2026-08-13 — Revision 7.1: ACFR sections own their items; diagram removed (owner feedback)

- **Tie-out items nested under their sections**: the page-level crosswalk (23 tables and
  disclosures) now lives inside its section cards — Investment items under INV; Financial,
  Financial Notes, RSI and SI under FIN; Statistical under STAT. Each card shows
  "tie-out items X / Y complete" beside its artifact progress; Introduction and Actuarial
  state that the investment-data crosswalk has no items for them. The separate crosswalk
  register is gone; the QA checklist (28 controls, cross-section by nature) remains as a
  collapsed register.
- **Viewer-role selector fixed**: normal type size instead of inheriting the KPI-tile scale.
- **Architecture panel removed from Methodology** at the owner's decision — the workflow
  tree stays an internal working reference; the public page keeps its prose boundaries.
- Tests 106/106; lint, typecheck, build clean; verified in the browser.

## 2026-08-13 — Revision 7: full team-tool backlog (contract 1.3 — recon, ACFR board, private markets)

Remainder of the confirmed backlog plus the architecture reference from the internal review.

- **Contract schema 1.3.0** (column set unchanged; 1.0–1.2 files stay valid): `recon_value`
  source-side pairs (V05 key gains source_name for this type; V23 caps a key at two sources),
  `tolerance_definition` (tolerance-as-data, ≥ 0), `acfr_section_status` (V22 enum; one row
  per change — the file is the change log), `acfr_artifact_link` (links + metadata, never
  files), `pm_commitment`/`pm_capital_account` (primitives only). Fixtures 358 → 376 records
  each; new tracker fixture `demo_acfr_status_v1.csv` (24 records, entity DEMO-ACFR).
- **Reconciliation tab** (nav: nine tabs): paired sources with the variance computed on
  screen, tolerance carried as data, owner/review status/aging per pair; the internal-book
  side ties exactly to the workbook's own EMV values and one category pair is a deliberate
  demo break that also lands in Exceptions.
- **ACFR board rebuilt on contract records**: five-section readiness cards (status, draft
  version, owner, due-date aging, artifacts in/expected, full history expander), a
  viewer-role toggle labeled "demonstration only — not access control", and a
  leadership-gated Complete action that copies a ready-to-append CSV row — the file is the
  record, so the demo cannot and does not write state. Recommendation stated on the page:
  the enforceable tracker belongs in the identity-aware internal M365 environment (hybrid).
  Crosswalk/QA registers demoted to an expander.
- **Private-markets monitoring** on Performance: commitment / called / unfunded* /
  distributed / lagged NAV / DPI* / TVPI* per synthetic sleeve (*computed, never imported;
  zero-called ratios render em-dash, never zero).
- **Performance period toggles** (1M / QTD / FYTD / ITD): on-screen chain-link
  reconciliation of the selected window vs the exported figure (0.0 bp TIES on the fixture;
  ITD = FYTD is stated, not hidden).
- **Trends risk lenses** (min-20-observation gates, proxy-estimate labeled): max drawdown
  with peak→trough dates, best/worst day, deviation vs 20-day average, and a date-matched
  rolling correlation matrix. Daily fund-level risk remains deliberately unbuilt.
- **Freshness lines** on every data view (newest as-of + entering actor); **enriched daily
  brief** (policy breaches/near-bound, recon breaks, tiered+aged exceptions, draft count).
- **Architecture diagram on Methodology**: the workflow tree recreated as a native inline
  SVG with code-true vocabulary and LIVE/TARGET chips — every consumption-layer tab is
  live; the AI intake→structure→extract engine and identity-enforced approvals are
  target-state. Authoring template generator added (`tools/make_authoring_template.py`).
- Tests 86 → 106; Excel QA all PASS both entities; every new surface browser-verified.

## 2026-08-13 — Revision 6: team-tool foundation (schema 1.2 provenance, dictionary, triage)

First tranche of the internally-reviewed team-tool backlog (three items confirmed by the
owner; requirements produced by an internal domain review and verified against the code).

- **Schema 1.2 — provenance in the contract**: `entered_by`, `reviewed_by`, `review_status`
  append after `schema_version`; column sets are version-gated so 1.0/1.1 files stay valid
  (all three columns or none — partial headers reject). New rules **V19** (entered_by on
  user-import rows), **V20** (reviewer named on reviewed/published rows), **V21**
  (review_status enum). Any draft row raises a yellow **Draft data** banner and an
  informational exception. New **Team Activity** panel on Exceptions derives per-actor
  entry/review counts from the rows — the file is the audit log; the app stores nothing.
  Both workbooks, fixtures (still 358 records each), and the import example regenerated at
  1.2.0 with synthetic actor labels (`PA-ANALYST-1`, `PA-LEAD-1`); the import example's new
  day is entered by `PA-ANALYST-2` as `draft`, so the demo import now shows the full review
  workflow. Four new invalid samples (V19/V20/V21/partial header). Excel QA: all PASS.
- **In-app Data Dictionary + onboarding (Import)**: every column and enum token rendered
  from the validator's own constants — a typed map makes an undocumented column a compile
  error, and a test pins token lists to the schema. "How to fill the template" first-timer
  guide covers the three Monday-morning failures (whole-number percents/V10, two entities/
  V17, blank-without-missing/V08) with fixes.
- **Exceptions triage**: every issue now carries a **tier** (blocking / warning /
  informational) and **days open** computed from dates inside the file; the queue sorts by
  tier then age (the 4-day stale series now outranks the 1-day missing close).
- **Allocation near-bound rider**: sleeves within 1.0 pp of a policy bound show an amber
  "Near bound" state (early warning, never a breach); the Overview policy tile surfaces
  the count. Threshold is a documented constant until tolerance-as-data arrives with the
  Reconciliation work.
- Tests 72 → 86; typecheck, lint, production build clean; draft-banner path verified
  end-to-end in the browser (preflight → apply → banner → restore).

## 2026-08-06 — Revision 5.5: Policy page removed (owner decision)

- The Policy tab restated IPS tables the PA team already owns, so it no longer occupies a
  navigation slot. Navigation is eight tabs: Overview | Performance | Trends | Allocation |
  Exceptions | ACFR | Import | Methodology.
- The quoted IPS allocation tables (both funds: min/target/max, ½-step, Table-2 benchmarks
  with lags, interpretation notes) move to **Methodology** as collapsed `reported_public`
  audit references — the citations survive for auditors and non-PA audiences without daily
  screen cost. `#/policy` redirects to `#/methodology`; in-app links updated
  (Allocation footnote, Overview proxy detail).
- No data, validator, or calculation changes. Tests 72/72, lint clean, production build OK.

## 2026-08-06 — Revision 5.4: import example, glyph fix, shareable Excel dashboard

- `tools/make_import_example.py`: deterministic day-after workbook + ready-to-upload CSV
  demonstrating the daily append workflow (clears the stale-proxy exception, lifts coverage).
- Fixed σ rendering as Σ in Trends table headers (`text-transform: uppercase` exemption);
  clarified Trends captions (per-bar meaning, sparkline range, full-series scale).
- `tools/make_dashboard_workbook.py`: standalone `Fund_Pulse_Dashboard.xlsx` mirroring the
  web Overview/Trends story for e-mail sharing, with COM-verified recalc and chart fills.

## 2026-08-06 — Revision 5.3: Trends (history-in-the-file)

- New **Trends** view: daily policy-weighted read-through trend (per-day bars with per-day
  coverage in the tooltip), per-proxy windows (1d / 5d trading week / MTD from first close of
  the month / sigma-20 daily volatility) with sparklines, and the fund's latest months plus
  chain-linked rolling 3-month vs benchmark.
- Architecture decision made explicit in the UI: the app saves NOTHING between imports — the
  history lives inside the dataset (the daily workflow appends one day per close, so every
  imported file deepens every window). All windows use present observations only and render
  em-dash when history is insufficient; nothing is imputed.
- New pure module `src/lib/finance/trends.ts` with 8 tests (gap skipping, MTD boundary,
  volatility window, per-day coverage variation). Tests 64 -> 72.


## 2026-08-06 — Revision 5.2: fund-first Overview with charts; self-explaining pulse

- Overview now leads with the FUND, per owner feedback: KPI tiles (FYTD vs benchmark, FYTD
  excess with ahead/trailing context, QTD with excess, policy status) plus two charts — Growth
  of $1 vs benchmark and a new monthly-returns bar chart (validated polarity palette, single
  series). Both follow the Pension/OPEB switch.
- The daily proxy pulse is a compact strip below the charts, and a flat reading now explains
  itself ("Flat — drivers offset: Global Equity +5 bp, Investment Grade Bonds −5 bp"); non-flat
  days name the leading driver. Coverage, data issues, copy-brief and the full proxy detail
  remain one line/click away.


## 2026-08-06 — Revision 5.1: flat navigation, Overview naming (user preference)

- All eight views back as top-level tabs (Overview | Performance | Allocation | Exceptions |
  Policy | ACFR | Import | Methodology) — the More dropdown removed at the owner's request;
  "Pulse" renamed "Overview". Simplified first screen and per-view trimming from revision 5
  unchanged.


## 2026-08-06 — Revision 5: information-architecture simplification (external UX review adopted)

- **New first screen (Pulse)**: four tiles (covered-proxy impact / policy-weight coverage /
  policy status / data issues), today's covered drivers in bp, top needs-review issues, one
  periodic-context line, copy-brief action; proxy math, market-context table and methodology
  behind one expander. Mobile Pulse height 5,061px -> 1,631px; header+nav 413px -> 266px
  (incl. the persistent disclaimer band).
- **Navigation**: Pulse | Performance | Allocation | Exceptions | More (Policy & benchmarks,
  ACFR workflow, Import, Methodology & disclosures) with an accessible disclosure menu; legacy
  routes redirect. Header metadata (schema/fixture/policy pack) moved to Exceptions > Data
  details.
- **Performance** merges the period table (hurdle retained WITH its inline definition), growth
  chart + monthly table, contribution chart (zero-value categories omitted from the chart,
  retained in the accessible detail), and the 5-line reconciliation with full detail expander.
- **Allocation** rendered as policy-range bullet rows (min - target - max, actual marker,
  distance-to-boundary); EMV/dollar over/under behind "Dollar details" (a dollar gap must not
  read as a trade size); "Non-policy exposures" one-liner for Overlays/Other.
- **Exceptions**: root-cause merged in the model (a degraded series + its control = ONE issue;
  "2 issues affecting 2 controls", never four warnings); summary line; passing controls and
  provenance/citations behind expanders (absorbs the former Data-quality view).
- **ACFR**: action queue (blocked/review/in-progress, top 5) with Crosswalk/QA subtabs; the
  full 51-record registers behind "Show the full register" with status filters.
- **Formatting**: fmtSmartReturn — "Flat" under 0.5 bp (kills the negative-zero artifact), bp
  under 25 bp, percent above. Covered-basket return demoted to the Pulse expander (kept, per
  the adopted-with-modification note). Import warning condensed with licensed-data guidance
  behind an inline expander.
- Tests 63 -> 64 (exception root-cause merge). Full pipeline green; browser-verified desktop
  and mobile.


## 2026-08-06 — Revision 4: schema 1.1, OPEB workbook, Policy-page switch fix

- **Policy page now follows the main Pension/OPEB masthead switch** (its separate internal
  toggle removed) — reported by the user.
- **Contract schema 1.1.0**: `policy_target` (explicit `policy_min/target/max/halfstep` per
  category) and `benchmark_definition` (numeric lag months + formula) record types, classified
  `reported_public` with IPS citations (V15 widened to the quotation types). The app builds
  allocation bands from dataset policy records when present (`policySource: "dataset"`),
  falling back to the bundled pack for 1.0.x files.
- **OPEB Excel workbook**: `tools/build_workbook.py --entity OPEB` builds
  `outputs/..._OPEB.xlsx` with per-entity config (seed 20260631, OPEB IPS bands/targets/6.0%
  hurdle, no transfers); `qa_excel.py`/`make_fixtures.py` parameterized the same way. The OPEB
  fixture is now workbook-derived (replacing the engine-only generator, which was removed), and
  both funds share one market-context series via a dedicated market RNG.
- Both fixtures regenerated at 358 records from Excel-QA'd workbooks (Pension audited values
  unchanged: FYTD 12.41%, residual 5.2 bps; OPEB: FYTD 6.34% vs benchmark 8.20%, residual
  2.5 bps). 63 tests green.

## 2026-08-06 — Revision 3: dual-fund tabs (Pension / OPEB)

- **Fund tabs** under the Fund Pulse masthead switch the entire dataset and policy scope:
  Pension (DEMOFUND, Pension IPS pack) vs OPEB (DEMO-OPEB, OPEB IPS pack — bands 35–55% Growth,
  ½-step read-through weights 40/14.5/2, synthetic 6.0% hurdle). Every view, band, exception,
  and the daily brief follow the selected entity; an applied import overrides the active tab
  until reset, and switching tabs returns to that tab's fixture.
- New deterministic OPEB dataset (`data/sample/demo_opeb_export_v1.csv`, 338 records, seed
  20260631) generated by `tools/make_opeb_fixture.py` using the same calculation rules as the
  Pension workbook engine (BOP-weighted monthly, chain-linked, residual disclosed — 2.7 bps
  PASS). Market-context rows are shared with the Pension fixture (entity relabeled); citation
  rows keep their cited public entities. The Excel workbook remains the auditable demonstration
  for the Pension entity (DECISIONS #22).
- Tests 62 → 63 (OPEB fixture contract + policy scoping + internal chain-link consistency).

## 2026-08-06 — Revision 2: external-review adoption, IPS policy pack, Daily Pulse

- Verified and adopted an external code review (all 8 code-level claims reproduced; see chat
  analysis): display rounding tie-out, hash-router skip-link bug, positional chart join,
  entity blending, trusted derived fields, partial totals, V10 over-reach, hard-coded ranges.
- **IPS policy pack**: both public Investment Policy Statements (restated 2024-06-12) encoded
  with explicit min/target/max (Pension Cash 0–3% asymmetry), ½-step targets, benchmark
  formulas + lags, citations, and a source-inconsistency data note (OPEB RAIH sub-class ½-steps
  sum 15.5% vs category 16.5% — flagged, not silently corrected). New Policy view; Allocation
  now uses the real Pension bands with distance-to-boundary.
- **Daily proxy pulse** on Overview: policy-weighted read-through with honest policy-weight
  coverage (40.5% in the demo — Natural Resources proxy deliberately unpriced), covered-basket
  return, exceptions queue with staff-analytics framing, and a generated copy-to-clipboard
  daily brief. Market-pulse CSV template added (`data/sample/market_pulse_template.csv`) for
  the Bloomberg BDH export workflow, with a prominent internal-use/licensing warning.
- **Integrity foundation**: V17 now rejects multi-entity files; date-keyed series joins;
  span-matched excess; derived fields recomputed; partial totals suppressed with an exception;
  missing-flagged values discarded at parse; V10 scoped to return/contribution records.
- **Import preflight**: validate-and-summarize before an explicit Apply; downloadable error
  report; template and invalid-sample downloads.
- **A11y/UX fixes**: skip link (hash-router safe), route-change scroll/focus reset, expandable
  monthly data table (fixes the chart's aria promise), mobile allocation cards, scrollable
  mobile nav, ACFR days-remaining column, contribution rounding-adjustment line with
  unrounded-values footnote.
- Tests: 49 → 62 (read-through, asymmetric bands, entity rejection, discard-on-missing,
  V10 scoping, suppression rules). Full pipeline green.

## 2026-08-04 — Stage 7: Public-release audit

- `docs/public-release-audit.md`: PASS with 3 manual-review warnings (license choice,
  process-meta files, owner/visibility confirmation). Evidence: 78-file tracked inventory with
  `git ls-files`/`git check-ignore`; zero office/PDF files tracked; zero secrets in files and
  full history; zero network calls in the app; minimal-permission workflow; clean-clone
  `npm ci` → 49/49 tests → lint → build all green; no source maps.
- No remote created, nothing pushed; publication commands proposed only, pending explicit
  approval (Prompt 8A/8B).

## 2026-08-04 — Stage 6: PA-team product review

- Full presentation audit of the production build under a simulated Pages subpath
  (`docs/product-review.md`): two-minute read, classification legibility, reconciliation
  tie-out, import rejection E2E, ACFR filter ARIA state, mobile layout — results and evidence
  recorded.
- Fixed M1 (medium): the stale-demo proxy rendered as missing — daily staleness threshold
  corrected to 3 calendar days and strip logic gives stale precedence over missing-at-end;
  the three data states now render distinctly (✓/△/✕). Tests updated; pipeline re-run green.
- Accepted-with-mitigation findings L1–L3 and residuals R1–R2 documented.
- Added `docs/demo-script.md` (timed 5–7 minute walkthrough with Q&A anchors); no separate demo
  route added (smallest-prototype principle).

## 2026-08-04 — Stage 5: Dashboard build

- Built the static web prototype in `app/` (Vite + React 18 + TypeScript strict): Overview,
  Contribution, Allocation, Data quality, ACFR workflow, Import, and Limitations views; Zod
  contract schema + V01–V18 import validator; pure finance modules; two validated charts.
- 49 unit tests (finance math incl. compounding/averaging counter-example, tolerance edges,
  staleness thresholds, period alignment; contract parsing against the valid fixture and all 8
  invalid fixtures plus mutation cases). Format, lint, typecheck, tests and production build all
  pass; built app verified in a browser under a simulated Pages subpath with zero console errors.
- Contract correction found by the app's own validator: V09 originally over-enforced period
  spans and rejected the canonical fixture — scoped to return/contribution record types
  (docs updated).
- Data correction found during browser review: `public_reference` rows were attributed to
  `DEMOFUND`; `entity_id` now names the cited public entity. Workbook, QA and fixtures
  regenerated (`tools/build_workbook.py` r2).
- Added `.github/workflows/pages.yml` (minimal-permission Pages deploy; not executed remotely),
  `README.md`, `docs/architecture.md`.

## 2026-08-04 — Stage 4: Workbook audit and data contract

- Independent audit of the expanded workbook (fresh recomputation from the file's own inputs):
  all calculations tie ≤1e-9; findings and dispositions recorded in `docs/workbook-qa.md`.
- Corrections to the derived workbook: unit→scale metadata mapping on public-reference records;
  `schema_version` column added to `Export_Contract` (now 29 columns). Rebuilt and re-verified;
  no check was weakened or removed.
- Locked the web interface: `docs/data-contract.md`, `docs/data-dictionary.md`,
  `docs/import-validation-rules.md` (18 validation rules with severities).
- Added deterministic synthetic fixtures: `data/sample/demofund_export_v1.csv` (338 records)
  plus 8 named malformed variants under `data/sample/invalid/` and `data/sample/README.md`;
  generated by new `tools/make_fixtures.py`.
- Reference workbook hash re-verified unchanged.

## 2026-08-04 — Stage 3: Excel bridge

- Created `outputs/Portfolio_Analytics_Dashboard_Workbook_Prototype.xlsx` (14 sheets, 338-record
  normalized export table, schema 1.0.0) via deterministic generator `tools/build_workbook.py`
  (seed 20260630).
- Added Excel-COM QA harness `tools/qa_excel.py`: full recalculation, comparison against an
  independent Python recomputation, formula-error scan, per-sheet PDF renders
  (`outputs/renders/`).
- QA result: all computed values match Python expectations (≤1e-9); 10 PASS / 2 deliberate
  WARN / 0 FAIL controls; zero formula errors. Evidence in `docs/workbook-qa.md`.
- Fixed during build: bare-table-name `#NAME?` formulas, export-count COUNTA fragility,
  data-validation `=` prefixes, clipped labels, wrapped-row heights.
- Corrected the starter's `Overview!B10` defect class in the derived trackers by using
  structured references (CHK-10/CHK-11).
- Verified `reference/` starter workbook SHA-256 unchanged
  (`120d466ff8fadf73…c793d32`).
- Documentation: `docs/expanded-workbook-spec.md`, `docs/workbook-methodology.md`,
  `docs/workbook-qa.md`.

## 2026-08-04 — Stage 2: Discovery documentation

- Added `docs/discovery/` (source inventory, workbook assessment, concept and scope,
  architecture options, data principles, risks and open items) and `DECISIONS.md` after the
  four-reviewer pressure test. Key scope changes: Brinson attribution deferred, peer-universe
  data excluded, monthly portfolio granularity, no Alpaca price republication.
