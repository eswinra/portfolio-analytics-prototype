# CIO Monthly template — building the slides without the published PDF

The CIO Monthly tab can build its panels and slides from a **template file**: a CSV that the Excel
template's Export tab writes. This lets the team prepare and rehearse a month's slides before the
report is published, from their own figures.

**Confidentiality.** Before LACERA publishes a report its figures are confidential. The template
file is read in the browser only: the dashboard never uploads it, never stores it (not in browser
storage, not in the address), and forgets it when the page is closed or reloaded. Keep the workbook
and its CSV on the team's systems. Do not use the GitHub "CIO report" workflow for them (that
workflow publishes), and do not send them to AI tools. Using real internal figures, even locally,
is for the organization to approve.

## Files

| Path | Role |
|---|---|
| `app/public/templates/CIO_Monthly_Template.xlsx` | The blank template, downloadable from the site (`/templates/…`) |
| `app/public/templates/CIO_Monthly_Template_Example.xlsx` | The same template filled with the latest **public** report, as a worked example |
| `tools/make_cio_template.py` | Builds both workbooks; the example is read from the deck's data block (public figures) |
| `tools/qa_cio_template.py` | Desktop Excel QA: recalculates, reads the Checks tab, saves the Export tab as CSV UTF-8 |
| `data/sample/cio_template_example_aug2026.csv` | The example's Export tab as Excel saved it; the unit tests rebuild the published report from it |
| `app/src/lib/cioPackage.ts` | Reads and checks a template file; builds the report the tab and slides show |
| `app/src/lib/cioFile.tsx` | Holds the open file in memory for the page (never stored) |

## Using it

1. Fill the yellow cells on **Report**, **Pension**, **OPEB**, **Markets**, **Macro** and **Items**.
   Percent as printed (0.1 means 0.1%); money in $ millions; leave a cell empty when the report has
   no figure.
2. Open **Checks**: every line should say OK. They are the report's own identities — category
   weights add to 100% (±0.3), category market values add to the total, the 14 histogram bins add
   to 120 months, DM + EM add to 100%, every return has a benchmark for the same period.
3. Open **Export**, then File → Save As → **CSV UTF-8 (Comma delimited)**. Excel saves only the
   active tab.
4. On the dashboard's CIO Monthly tab choose **Open a template file** and pick the CSV. The tab and
   the slides show it as "Template file …, not published", with changes against the latest earlier
   published report. The report selector still lists the published reports; **Close file** forgets
   the file.

A file with any problem shows nothing: the tab lists every problem it found (row numbers for rows
it could not read, fund and figure for missing or inconsistent ones) and keeps the published
report on screen.

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
