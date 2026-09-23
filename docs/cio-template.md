# CIO Monthly template — building the slides without the published PDF

The CIO Monthly tab can build its panels and slides from a **template file**: the filled Excel
template itself, or the CSV its Export tab writes (both are read the same way). This lets the team prepare and rehearse a month's slides before the
report is published, from their own figures.

**Confidentiality.** Before LACERA publishes a report its figures are confidential. The template
file is read in the browser only: the dashboard never uploads it, never stores it (not in browser
storage, not in the address), and forgets it when the page is closed or reloaded. Keep the workbook
(and any CSV of it) on the team's systems. Do not use the GitHub "CIO report" workflow for them (that
workflow publishes), and do not send them to AI tools. Using real internal figures, even locally,
is for the organization to approve.

## Files

| Path | Role |
|---|---|
| `app/public/templates/CIO_Monthly_Template.xlsx` | The blank template, downloadable from the site (`/templates/…`) |
| `app/public/templates/CIO_Monthly_Template_Example.xlsx` | The same template filled with the latest **public** report, as a worked example |
| `tools/make_cio_template.py` | Builds both workbooks; the example is read from the deck's data block (public figures) |
| `tools/qa_cio_template.py` | Desktop Excel QA: recalculates and saves the example through Excel (so it opens on the dashboard as downloaded), reads the Checks tab, saves the Export tab as CSV UTF-8 |
| `data/sample/cio_template_example_aug2026.csv` | The example's Export tab as Excel saved it; the unit tests rebuild the published report from it |
| `app/src/lib/cioPackage.ts` | Reads and checks a template file; builds the report the tab and slides show |
| `app/src/lib/workbook.ts` | Turns a workbook's Export tab into the same CSV text, in the browser |
| `app/src/lib/cioFile.tsx` | Holds the open file in memory for the page (never stored) |

## Using it

1. Fill the yellow cells on **Report**, **Pension**, **OPEB**, **Markets**, **Macro** and **Items**.
   Percent as printed (0.1 means 0.1%); money in $ millions; leave a cell empty when the report has
   no figure.
2. Open **Checks**: every line should say OK. They are the report's own identities — category
   weights add to 100% (±0.3), category market values add to the total, the 14 histogram bins add
   to 120 months, DM + EM add to 100%, every return has a benchmark for the same period.
3. Save the workbook in Excel (`.xlsx`).
4. On the dashboard's CIO Monthly tab choose **Open a template file** and pick the workbook. The tab and
   the slides show it as "Template file …, not published", with changes against the latest earlier
   published report. The report selector still lists the published reports; **Close file** forgets
   the file.

A CSV works too: open **Export**, then File → Save As → **CSV UTF-8 (Comma delimited)** (Excel
saves only the active tab), and open the CSV.

A file with any problem shows nothing: the tab lists every problem it found (row numbers for rows
it could not read, fund and figure for missing or inconsistent ones) and keeps the published
report on screen.

### Opening the workbook itself

The dashboard reads the workbook's **Export** tab (or, if it was renamed, the tab whose first row is
the seven columns below) and turns it into the CSV text Excel would write, which then goes through
the same checks. What it takes from a cell is the value Excel stored, not what the cell displays.

- **Formulas must have been calculated.** A workbook saved by Excel always is. A file written by
  another program (the blank template exactly as generated, or a script) carries formulas without
  results; it is refused — "the workbook's formulas have not been calculated" — rather than read as
  blanks. Open it in Excel, save, and open it again.
- **Excel errors are refused**, naming the cells (`#DIV/0!`, `#REF!`, `#N/A`…).
- **Dates** are read as calendar dates (YYYY-MM-DD), whatever their display format.
- The reader is [SheetJS](https://sheetjs.com) Community Edition 0.20.3 (Apache-2.0), installed
  from SheetJS's own package with an integrity hash in `app/package-lock.json` and bundled with the
  site. It is fetched from the site itself only when a workbook is opened; the file is never sent
  anywhere. Workbooks up to 10 MB.

## The Monthly run (Workstation › Monthly run)

One month's file taken straight through, on one page, in the browser: the Workstation opens on it.
Five steps, each saying what it did and where its output is.

| Step | What happens | Output |
|---|---|---|
| 1 · File | The workbook (its Export tab) or the CSV is read; or **Use the public example**, the example workbook fetched from the site itself | File, size, tab, rows read, and the time taken |
| 2 · Checked | The template's own identities (below); a file that fails any is not opened, and every problem is listed | — |
| 3 · Reconciled | Three checks against things the file does not control (next section) | What agrees, and a table of every figure to check |
| 4 · On the dashboard | The CIO Monthly tab, the Exception Center and Compare are built from the file | Links, and the Exception Center's one line |
| 5 · Slides and PDF | The report's slides are built from the file | **Print / PDF** on the slides' toolbar, saved by the browser |

The file is the one the CIO Monthly tab opens too (`app/src/lib/cioFile.tsx`, shared), so the run,
the tab, the Exception Center and the slides all show the same file, and closing it anywhere
closes it everywhere. Nothing is uploaded or stored; a browser test records every request the page
makes during a run and finds none but the site's own files.

### Reconciliation (`app/src/lib/reconcile.ts`)

Every check comes from the arithmetic of returns. None uses a threshold chosen by eye.

1. **Within the report.** Some periods are the same period: FYTD in July is the month itself, YTD
   in January is the month itself, and FYTD in June is the year. Each pair is the same number
   printed twice, so it must be equal.
2. **Against the reports before it.** Returns compound. This month's FYTD is the prior report's
   FYTD compounded with this month's return (within one fiscal year), YTD likewise (within one
   calendar year), and three months is the last three one-month returns compounded — for the
   Total Fund and every composite, returns and benchmarks. The only slack is rounding: every figure
   is printed to one decimal, so each can be off by 0.05 pp, and the tolerance is exactly 0.05 pp
   per printed figure in the check (0.15 pp for FYTD and YTD, 0.20 pp for three months).
3. **Against the published report for the same month**, when there is one: 238 figures (market
   value, cash, returns, benchmarks and hurdles by period, every composite's value, weight, target,
   returns and benchmarks, the geographic split and the 120-month distribution) compared one for one.

Across the sixteen published reports the chains hold within 0.13 pp in every case and the
same-period pairs are equal in all 80, so a check outside its tolerance is a keying error, or a
restatement of earlier months that the report would footnote. It is listed to be looked at; nothing
is corrected. A month with no published report has nothing to tie out to — the chains are then the
independent check — and a report after a gap in the series cannot be chained, and says so.

The public example reconciles completely: 20 same-period pairs equal, 60 figures chained from the
July 8, 2026 report within rounding, and all 238 figures equal to the published August 12, 2026
report. Typing Growth's FYTD return 17.5% as 15.7% is caught by all three checks at once, which a
browser test runs.

## Format `cio-template-1`

Seven columns, a header row, one figure per row:

| Column | Meaning |
|---|---|
| `section` | what the row is (below) |
| `entity` | `pension` or `opeb` (blank for report, market, macro, attention rows) |
| `item` | category, index, label or area, by section |
| `measure` | which figure of the item |
| `period` | `1M`, `3M`, `FYTD`, `YTD`, `1Y`, `3Y`, `5Y`, `10Y` for period figures |
| `value` | a plain number: percent as printed, $ millions, counts |
| `text` | dates (YYYY-MM-DD), labels and prose |

A row with neither a value nor text is an empty slot and is skipped.

| Section | Item | Measure | Notes |
|---|---|---|---|
| `report` | `format`, `report_date`, `data_through`, `market_as_of` | — | text; `format` = `cio-template-1`; data through is a month end on or before the report date |
| `fund` | `TOTAL` | `market_value`, `cash`, `growth_of_dollar` | $ millions; growth of $1 optional |
| `performance` | `TOTAL`, `GROWTH`, `CREDIT`, `RAIH`, `RRM` | `return`, `benchmark`, `hurdle` (TOTAL only) | percent by `period`; TOTAL needs 1M, FYTD and 1Y |
| `allocation` | the four categories, `OTHER` | `market_value`, `weight`, `target`, `flow`; `label` (OTHER, text) | OTHER has no target |
| `overlay` | program name | `month_gain`, `since_inception` | $ millions, optional |
| `histogram` | `BIN_00` … `BIN_13` | `count` | the report's bins, ≤ -6 … ≥ 6; must add to 120 |
| `histogram` | `STAT` | `mean`, `saa`, `sd`, `min`, `max`, `latest` | percent |
| `geography` | `DM`, `EM`; `TOTAL` | `share`, `markets`; `markets` | optional; shares add to 100 |
| `country` | country name | `share` | text `dm` or `em`; at most five per group; shown largest first |
| `market` | index name | `group`, `description` (text); `return` (by period) | the market table, in the report's order |
| `macro` | label | `value`, `detail` | text, as the slide shows it |
| `attention` | area | status: `In progress`, `In development`, `For attention`, `Quiet period`, `Completed` | text = the item; value = report page (optional) |

Both funds are required. The format name changes if the columns or sections change, and the
dashboard refuses a file of another format.

### What is refused, besides missing required figures

- **Flows** are all or nothing per fund: every category (and the other line, when there is one)
  or none. Left empty, flows show as "not supplied" — never as a $0M net.
- **Ranges**: weights and policy targets between 0% and 100%, policy targets adding to 100%
  (±0.3); category market values and cash not negative; the total market value positive;
  geography shares between 0% and 100%; market counts whole numbers.
- **The distribution**: bin counts are whole numbers of months, 0 or more, adding to 120; the
  standard deviation is not negative; the mean and the latest month lie between the lowest and
  highest months; the latest month equals the Total Fund 1M return (±0.05) — it is the same
  month — and its bin has at least one month.
- **Dates**: real calendar dates; the report date comes after the date the data runs through
  (a month-only report date, after that month); the market table's date is on or after it.

Every rule holds for all 16 published reports, for both funds.

## Classification

A template file's figures are shown as `calculated` — entered by the team, not quoted from a
public source — and every source line says "template file …, not published". The macro strip
shows what the file carries; FRED figures are for published reports only.

## Regenerate

```bash
python tools/make_cio_template.py
python tools/qa_cio_template.py
cd app && npx vitest run src/lib/cioPackage.test.ts
```

`qa_cio_template.py` needs desktop Excel (Windows). It rewrites the committed sample from the
example workbook; the unit test fails if that sample no longer rebuilds the published report.
