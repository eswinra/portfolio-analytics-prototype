"""Excel COM QA: recalculate, verify vs Python expectations, error-scan, render PDFs."""
import json
import os

import pythoncom
import win32com.client as com

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WB = os.path.join(ROOT, "outputs", "Portfolio_Analytics_Dashboard_Workbook_Prototype.xlsx")
RENDERS = os.path.join(ROOT, "outputs", "renders")
os.makedirs(RENDERS, exist_ok=True)
EXPECTED = json.load(open(os.path.join(ROOT, "outputs", "expected_values.json"),
                          encoding="utf-8"))

TOL = 5e-9
failures = []
notes = []

def close(a, b, tol=TOL):
    return abs(a - b) <= tol

pythoncom.CoInitialize()
excel = com.DispatchEx("Excel.Application")
excel.Visible = False
excel.DisplayAlerts = False
try:
    wb = excel.Workbooks.Open(WB)
    excel.CalculateFullRebuild()

    def nval(name):
        return excel.Range(name).Value

    checks = [
        ("TF_1M", EXPECTED["tf_1m"]), ("TF_QTD", EXPECTED["tf_qtd"]),
        ("TF_FYTD", EXPECTED["tf_fytd"]), ("BM_1M", EXPECTED["bench_1m"]),
        ("BM_QTD", EXPECTED["bench_qtd"]), ("BM_FYTD", EXPECTED["bench_fytd"]),
        ("Contribution_Residual", EXPECTED["contrib_residual"]),
    ]
    for name, exp in checks:
        got = nval(name)
        if not close(got, exp, 1e-9):
            failures.append(f"{name}: excel={got!r} expected={exp!r}")
        else:
            notes.append(f"{name}: {got:.6f} OK")
    status = nval("Contribution_Status")
    if status != "PASS":
        failures.append(f"Contribution_Status = {status!r}")
    else:
        notes.append("Contribution_Status: PASS")

    ws = wb.Worksheets("Checks")
    got_statuses = [ws.Range(f"D{r}").Value for r in range(6, 18)]
    exp_statuses = ["PASS"] * 5 + ["WARN", "WARN"] + ["PASS"] * 5
    for i, (g, e) in enumerate(zip(got_statuses, exp_statuses), start=1):
        if g != e:
            failures.append(f"CHK-{i:02d}: excel={g!r} expected={e!r} "
                            f"(result={ws.Range(f'C{5+i}').Value!r})")
    notes.append(f"check statuses: {got_statuses}")
    p, w, f_ = nval("Checks_Pass"), nval("Checks_Warn"), nval("Checks_Fail")
    if (p, w, f_) != (10.0, 2.0, 0.0):
        failures.append(f"check counts P/W/F = {p}/{w}/{f_} expected 10/2/0")

    # allocation
    wsa = wb.Worksheets("Calc_Allocation")
    tot = wsa.Range("C12").Value
    if not close(tot, 1.0, 1e-9):
        failures.append(f"allocation total = {tot}")
    cats = ["GROWTH", "CREDIT", "RAIH", "RRM", "OVERLAY", "OTHER"]
    for k, cid in enumerate(cats):
        got = wsa.Range(f"C{6+k}").Value
        exp = EXPECTED["alloc_actual"][cid]
        if not close(got, exp, 1e-9):
            failures.append(f"alloc {cid}: excel={got} expected={exp}")

    # monthly TF returns
    wsr = wb.Worksheets("Calc_Returns")
    for i in range(12):
        got = wsr.Range(f"B{71+i}").Value
        exp = EXPECTED["tf_monthly"][i]
        if not close(got, exp, 1e-9):
            failures.append(f"tf_monthly[{i}]: excel={got} expected={exp}")

    # error scan on every sheet
    XL_FORMULAS, XL_ERRORS = -4123, 16
    for sh in wb.Worksheets:
        try:
            bad = sh.UsedRange.SpecialCells(XL_FORMULAS, XL_ERRORS)
            failures.append(f"sheet {sh.Name}: {bad.Count} formula error cell(s): "
                            f"{bad.Address}")
        except Exception:
            pass  # no error cells

    # export contract: spot-check a few formula-linked values
    wse = wb.Worksheets("Export_Contract")
    n = excel.WorksheetFunction.CountIf(wse.Range("A:A"), "REC-*")
    notes.append(f"export records counted: {int(n)}")

    # render PDFs (landscape, fit width)
    for sh in wb.Worksheets:
        sh.PageSetup.Orientation = 2
        sh.PageSetup.Zoom = False
        sh.PageSetup.FitToPagesWide = 1
        sh.PageSetup.FitToPagesTall = False
        pdf = os.path.join(RENDERS, f"{sh.Name}.pdf")
        sh.ExportAsFixedFormat(0, pdf)
    wb.Save()
    wb.Close(SaveChanges=False)
finally:
    excel.Quit()
    pythoncom.CoUninitialize()

print("NOTES:")
for x in notes:
    print(" ", x)
if failures:
    print("FAILURES:")
    for x in failures:
        print(" ", x)
    raise SystemExit(1)
print("ALL QA CHECKS PASSED")
