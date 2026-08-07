# Presenter Walkthrough — Fund Pulse prototype

A read-along script for presenting the dashboard to the Portfolio Analytics team.
Full path is about ten minutes; the **short path** (Overview → Import → close) is about
three. Numbers quoted below are what the bundled synthetic dataset shows as of the
Revision 5.5 deploy — if you import a file during the demo, later screens will reflect it.

---

## Before the meeting (2-minute checklist)

- Open **https://eswinra.github.io/portfolio-analytics-prototype/** — it is a static page;
  nothing to install, nothing to log into.
- Confirm the **Pension** tab is active and the as-of date reads **2026-06-30**.
- Have **`daily_import_example.csv`** on the presenting machine for the import demo
  (regenerate any time with `python tools/make_import_example.py`; it lands in `outputs/`).
- Optional: one file from `data/sample/invalid/` to show a rejection.
- Browser at 100% zoom; the walkthrough assumes a conference-room screen.

**The one rule:** never call any number on screen "our performance." Every figure is
synthetic and labeled as such. What is real is the *method* — and the two IPS documents
the policy checks quote from.

---

## 0:00 — Opening frame (stay on Overview)

> "Everything on this screen is synthetic — the gray banner at the top never goes away.
> This is a prototype of a **daily end-of-day pulse** for our team: how is the fund doing,
> what moved today, and can we trust the data behind the screen. The numbers are fake;
> the math, the policy checks, and the audit trail are real."

Point at the masthead: **Pension / OPEB** switch on the left, **as-of date** on the right.
Every view follows that switch — two funds, two IPS policies, one market.

---

## 0:45 — Overview: the two-minute executive read

Walk the four tiles left to right (Pension):

- **Fiscal YTD 12.41% vs benchmark 12.57%** — net return against a benchmark built from
  effective-dated policy weights, not a made-up line.
- **Excess −16 bp** — the tile says "trailing," in words, so nobody has to do the sign math.
- **Quarter to date 4.17% vs 4.33%.**
- **Policy status: 0 breaches** against the real IPS ranges.

Below the tiles, two charts: **Growth of $1** (solid = portfolio, dashed = benchmark) and
**monthly returns**. Then the strip that motivates the whole prototype:

> "This is **today's proxy pulse** — market data through June 30. It reads **Flat**, and
> instead of just asserting that, it explains it: Global Equity contributed +5 bp, bonds
> −5 bp — they offset. Coverage says these liquid proxies represent **40.5% of policy
> weight** — we never pretend to price the private markets daily. And it's flagging **two
> data issues** rather than hiding them: an oil proxy missing its final close, and a stale
> currency series."

**Talking point:** the read-through is Σ(IPS ½-step weight × proxy daily return). It is
labeled a *proxy estimate* everywhere. It is an operational heads-up, never performance —
the custodian remains the book of record.

Click **Copy daily brief**: the same story as plain text, ready for the EOD email or Teams
post.

---

## 2:00 — The fund switch (one click, big point)

Click **OPEB** in the masthead.

> "Same app, same math, different governing policy. OPEB reads FYTD **6.34% vs 8.20%**,
> and today's pulse is **−1 bp, led by Investment Grade Bonds** — a different answer
> because the OPEB IPS weights bonds differently. Coverage is **54.5%** here for the same
> reason. Both funds see the same market; only the policy lens changes."

Click back to **Pension** before moving on.

---

## 3:00 — Performance: the number that proves itself

Navigate to **Performance**.

- Period table: every row shows its exact start and end dates. Fiscal YTD is labeled
  "= 1Y" because the demo year closes June 30 — nothing is silently annualized.
- The **hurdle** column is a synthetic actuarial-style assumption (6.75% Pension / 6.0%
  OPEB), stated as such — not the published actuarial rate.
- Contribution chart: the quarter was **led by Growth at 3.67%**, with Risk Reduction
  slightly negative.

Open the **Reconciliation** panel and slow down — this is the credibility moment:

> "Contribution ties out on screen: displayed contributions **4.11%**, compounding effect
> **0.05%**, rounding adjustment **0.01%**, chain-linked QTD return **4.17%** — **PASS**
> within a visible 10 bp tolerance. Most dashboards hide this line. We show it because a
> contribution chart that doesn't reconcile to the total is decoration, not analysis."

**Talking point:** totals are never an average of returns; contribution uses valid
beginning-of-month weights.

---

## 4:30 — Trends: the file is the record

Navigate to **Trends**. Read the opening sentence on screen out loud — it is the
architecture:

> "The app saves nothing between imports. Every trend here is computed from the history
> *inside the imported file* — right now, 22 daily observations per proxy. Our daily
> workflow appends one row per close, so every window on this page deepens automatically
> as the file grows. No hidden database, nothing to back up, nothing to disagree with the
> file we emailed."

- **Daily read-through trend**: each bar is one trading day's estimated fund-level impact;
  hover shows that day's coverage.
- **Per-proxy windows**: 1-day, 5-day, month-to-date, and σ20 — a 20-day daily volatility.
  Sparklines show the full series on each proxy's own scale.
- Windows with insufficient history show an em-dash. Nothing is imputed.

---

## 5:30 — Allocation: ranges as the IPS actually writes them

Navigate to **Allocation**.

> "Each category is a bullet: the band is the IPS min-to-max, the tick is target, the dot
> is where we are, with distance-to-boundary in points. Bands are stored as explicit
> min/target/max because the IPS is asymmetric — Pension Cash is a 1% target with +2/−1,
> so 0–3%. A tool that assumes symmetric bands gets that wrong."

- Dollar amounts sit behind an expander, deliberately — an over/under dollar figure should
  never be mistaken for a recommended trade.
- Overlays and Other are listed with 0% policy weight, honestly out of scope for range
  checks.

---

## 6:30 — Exceptions: the queue, not a scavenger hunt

Navigate to **Exceptions**.

> "The two issues from the Overview strip live here as **root-cause items** — the degraded
> series and the control that caught it are one issue, not two rows to chase. Each names
> its workbook control (CHK-06, CHK-07), what is affected, and what still works."

---

## 7:00 — Import: the daily workflow, live (the demo moment)

Navigate to **Import**. Drag in **`daily_import_example.csv`**.

> "This file is yesterday's file plus one new close — July 1. Import runs **entirely in
> this browser**; the file never leaves the machine. Eighteen validation rules run first,
> and we get a preflight diff before anything is applied."

Apply it, then return to **Overview**:

> "One import: the new trading day is on every chart, **both data issues cleared** because
> the missing and stale series caught up, and coverage moved from 40.5% to **43.5%**.
> That's the entire daily routine — export from the terminal into the template, drop the
> file, read the pulse, send the brief."

If asked about bad files: drag in one from `data/sample/invalid/` — row-level rejection,
nothing changes. Import is all-or-nothing.

**Licensing note (say it before anyone asks):** Bloomberg exports are internal-use data.
They stay on our machines — imported locally, never uploaded anywhere, never baked into
this public site. The public site ships synthetic data only.

---

## 8:30 — ACFR: the reporting season board

Navigate to **ACFR** (brief).

> "The ACFR crosswalk as a working queue: 23 crosswalk items, 28 QA controls, two blocked
> items surfaced for escalation, due dates with days-remaining. Statuses here are
> illustrative — the structure follows the public ACFR table of contents."

---

## 9:00 — Methodology, and the close

Navigate to **Methodology**.

> "The honesty page is part of the product: what this is, what it deliberately does not
> show — no real positions, no daily total-fund return, no attribution that synthetic data
> can't make reconcile — and what an authorized internal version would need. At the bottom,
> the quoted IPS allocation tables for both funds sit as collapsed references, page-cited,
> so anyone can verify where the Allocation bands come from. You own the IPS; this page
> just shows its work."

Close:

> "What we've proven is the shape: an auditable Excel workbook and a dashboard sharing one
> validated data contract, a daily pulse that explains itself, and every number classified
> — synthetic, proxy, calculated, or quoted public. If the team wants this for real, the
> path is the authorized-inputs list on this page, not more prototype."

---

## Q&A anchors

- **"Is any of this real?"** — Two things: the quoted IPS tables (page-cited, labeled
  `reported_public`, excluded from every calculation) and the method. All portfolio values
  are synthetic.
- **"Could this show real data tomorrow?"** — The import path works today with the
  Bloomberg-export template, internally. A *real* fund view needs the authorized inputs on
  the Methodology page — custodian positions, flows, fees, benchmark licenses — and would
  reconcile to the official performance book, which this never replaces.
- **"Why is coverage only ~40%?"** — Only liquid proxies with daily closes count; private
  markets are excluded rather than faked. Mapping three more liquid proxies (TIPS, long
  Treasury, T-bills) would lift it to roughly half — that's a mapping decision, not a
  build.
- **"Where's the daily fund return?"** — Deliberately absent. A daily total-fund return
  requires validated holdings, flows, prices, FX, and overlays. The read-through is a
  policy-weighted market estimate and is labeled that way every time it appears.
- **"Why no attribution or peer ranks?"** — Synthetic data can't make Brinson reconcile
  credibly, and peer universes are licensed. Both are on the future-state list, not
  quietly faked.
- **"What happens to files we upload?"** — Parsed in the browser, kept in memory for the
  session, sent nowhere. Refresh and it's gone.
- **"Excel or dashboard?"** — Both, by design: the workbook is the auditable system of
  record; the app is a validated view of its export. There's also a standalone
  `Fund_Pulse_Dashboard.xlsx` for sharing the same story by email.
