# Demo Script — five to seven minutes, conference-room screen

Audience: Portfolio Analytics team. Setup: production build at any static URL (or
`npm run preview` in `app/`), Overview loaded, browser at 100% zoom.

## 0:00 — Frame it (Overview stays on screen)

> "Everything you'll see is synthetic — the banner never leaves the screen. The question this
> prototype answers is the one we ask every review: **how did the fund perform, what drove it,
> and can we trust the data on the screen?** What's real here is the *method*, not the numbers."

Point at the four tiles left to right: illustrative FYTD vs benchmark, excess, the
reconciliation status, and the data-check roll-up. **Talking point:** the reconciliation tile is
a first-class citizen next to performance — trust travels with the number.

## 0:45 — Periods and the chart

Point at the period table: every row carries its exact start → end dates; FYTD is labeled
"= 1Y" because the demo year closes June 30 — no silent annualization anywhere. The growth
chart: solid = portfolio, dashed = benchmark, both direct-labeled; benchmark is built from
effective-dated policy weights — the policy changed January 1 and the math follows it.

## 1:30 — Market context strip (bottom of Overview)

> "Market context is deliberately quarantined below the rule line — proxies never masquerade as
> portfolio performance. And look at the last two rows: one proxy is *missing* its latest close,
> one has gone *stale*. The prototype treats data health as something you see, not something you
> discover later."

## 2:15 — Contribution (navigate)

The chart shows what drove the quarter; the table beside it shows the part most dashboards
hide: arithmetic total 4.11%, chain-linked return 4.17%, compounding residual 0.05%,
**PASS against a visible 10 bp tolerance**. All six categories included — nothing excluded by
footnote. **Talking point:** contribution uses valid beginning-of-month weights; totals are
never averaged.

## 3:15 — Allocation (navigate)

Actual vs the policy version effective on the as-of date, over/under in % and $mm, range status
per category. Overlays and Other are shown but honestly labeled "no policy weight."

## 4:00 — Data quality (navigate)

> "The checks you saw as a tile come from the analyst workbook itself — they were computed in
> Excel and exported *as data*, so the analyst and this screen can never disagree."

Show the classification census, then the cited-public table: eight quoted values, each with a
page-level citation and the real entity named — and none of them feeds any calculation.

## 4:45 — Import (navigate)

Drag in one of the `data/sample/invalid/` files: instant row-level rejection, nothing changes.
> "Import is all-or-nothing, processed entirely in the browser — a file never leaves this
> machine. The same eighteen rules gate our own bundled data."

If time allows, import `demofund_export_v1.csv` to show acceptance.

## 5:30 — ACFR workflow (navigate)

The starter workbook's crosswalk, grown up: page → authoritative source → tie-out → test, with
readiness KPIs whose denominators are now provably correct, and a Blocked filter for
escalations. Statuses are illustrative.

## 6:00 — Limitations (navigate) and close

> "The Limitations page is part of the product. To make this real we would need the authorized
> inputs listed here — custodial positions, flows, benchmark licenses, the official performance
> book. What we've proven today is the *shape*: an auditable workbook and a dashboard sharing
> one validated contract, with classification and reconciliation built in from the first cell."

## Q&A anchors

- Excel stays the analyst's tool: the workbook is the system of record; the app is a view.
- "Could this show real data tomorrow?" — Only via the authorized-inputs list on the
  Limitations page; the schema already carries book-of-record, method, and lag fields.
- "Why no attribution/peer ranks?" — Synthetic data can't make them reconcile credibly /
  licensed data; both are on the future-state list, not quietly faked.
