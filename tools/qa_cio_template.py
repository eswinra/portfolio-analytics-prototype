"""QA the CIO Monthly template in desktop Excel (Windows): recalculate, read the Checks tab, and
save the Export tab as "CSV UTF-8" — exactly what a person does — so the dashboard's reader is
tested on a file Excel really wrote.

  example workbook -> recalculated and saved by Excel in place, so its formulas carry their values
                      and the file opens on the dashboard as downloaded (app/src/lib/workbook.test.ts)
                   -> Checks all OK -> data/sample/cio_template_example_<mon><yyyy>.csv (committed;
                      app/src/lib/cioPackage.test.ts rebuilds the published report from it)
  blank template   -> left as generated (formulas not yet calculated — the dashboard says so)
                   -> Checks not OK (nothing entered) -> outputs/cio_template/blank_export.csv

Usage: python tools/qa_cio_template.py   (after tools/make_cio_template.py)
"""

from __future__ import annotations

import pathlib
import sys

import win32com.client as win32

ROOT = pathlib.Path(__file__).resolve().parents[1]
TEMPLATES = ROOT / "app" / "public" / "templates"
XL_CSV_UTF8 = 62
XL_WORKBOOK = 51


def report_month(xl, book: pathlib.Path) -> str:
    """'aug2026' from the example's report date (Report!C4), for the sample's file name."""
    wb = xl.Workbooks.Open(str(book), ReadOnly=True)
    try:
        d = wb.Worksheets("Report").Range("C4").Value
        return f"{d.strftime('%b').lower()}{d.year}"
    finally:
        wb.Close(SaveChanges=False)


def resave(xl, book: pathlib.Path) -> None:
    """Recalculate and save the workbook through Excel, opening on the Start tab. openpyxl writes
    formulas without results; a workbook Excel has saved carries them."""
    wb = xl.Workbooks.Open(str(book))
    try:
        xl.CalculateFull()
        wb.Worksheets("Start").Activate()
        wb.Worksheets("Start").Range("A1").Select()
        wb.SaveAs(str(book), FileFormat=XL_WORKBOOK)
    finally:
        wb.Close(SaveChanges=False)


def run(xl, book: pathlib.Path, csv: pathlib.Path) -> list[tuple[str, str]]:
    wb = xl.Workbooks.Open(str(book), ReadOnly=True)
    try:
        xl.CalculateFull()
        ws = wb.Worksheets("Checks")
        results, r = [], 5
        while ws.Cells(r, 1).Value:
            results.append((str(ws.Cells(r, 1).Value), str(ws.Cells(r, 3).Value)))
            r += 1
        overall = str(ws.Cells(r + 1, 3).Value)
        results.append(("All checks", overall))
        csv.parent.mkdir(parents=True, exist_ok=True)
        if csv.exists():
            csv.unlink()
        wb.Worksheets("Export").Activate()
        wb.SaveAs(str(csv), FileFormat=XL_CSV_UTF8)
        return results
    finally:
        wb.Close(SaveChanges=False)


def main() -> int:
    example = TEMPLATES / "CIO_Monthly_Template_Example.xlsx"
    xl = win32.DispatchEx("Excel.Application")
    xl.Visible = False
    xl.DisplayAlerts = False
    failed = False
    try:
        resave(xl, example)
        print(f"example: recalculated and saved by Excel ({example.stat().st_size:,} bytes)")
        sample = ROOT / "data" / "sample" / f"cio_template_example_{report_month(xl, example)}.csv"
        res = run(xl, example, sample)
        bad = [label for label, result in res if result != "OK"]
        print(f"example: {len(res) - 1} checks, {'all OK' if not bad else 'NOT OK: ' + '; '.join(bad)}")
        print(f"  wrote {sample.relative_to(ROOT)} ({sample.stat().st_size:,} bytes)")
        failed |= bool(bad)
        res = run(xl, TEMPLATES / "CIO_Monthly_Template.xlsx", ROOT / "outputs" / "cio_template" / "blank_export.csv")
        ok = [label for label, result in res if result == "OK"]
        print(f"blank: overall {res[-1][1]} (expected CHECK); OK where nothing is required: {len(ok)}")
        failed |= res[-1][1] == "OK"
    finally:
        xl.Quit()
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
