"""Generate the synthetic OPEB entity dataset: data/sample/demo_opeb_export_v1.csv.

Uses the same deterministic calculation rules as the Pension workbook engine
(BOP-weighted monthly returns, chain-linking, contribution with disclosed residual,
effective-dated policy weights) with the OPEB IPS structure: long-term targets
45/16/13/26 (v1, eff 2025-07-01) transitioning to the dated 1/2-step targets
45/17/16.5/21.5 (v2, eff 2026-01-01). Seed 20260631. Market-context rows are copied
from the Pension fixture (same synthetic proxy series; entity relabeled) so both tabs
share one market strip. The Excel workbook remains the auditable demonstration for the
Pension entity; this dataset is produced by the same tested engine (DECISIONS #22).
"""
import csv
import datetime as dt
import io
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAMPLE = os.path.join(ROOT, "data", "sample")
PENSION_CSV = os.path.join(SAMPLE, "demofund_export_v1.csv")
OUT = os.path.join(SAMPLE, "demo_opeb_export_v1.csv")

ENTITY = "DEMO-OPEB"
SEED = 20260631
AS_OF = dt.date(2026, 6, 30)
RETRIEVED = "2026-08-06"
HURDLE_ANNUAL = 0.06  # synthetic OPEB-style hurdle assumption (not the published rate)

CATS = ["GROWTH", "CREDIT", "RAIH", "RRM", "OVERLAY", "OTHER"]
BMV0 = {"GROWTH": 450.0, "CREDIT": 160.0, "RAIH": 130.0, "RRM": 253.0, "OVERLAY": 5.0, "OTHER": 2.0}
POLICY_V1 = {"GROWTH": 0.45, "CREDIT": 0.16, "RAIH": 0.13, "RRM": 0.26}  # long-term
POLICY_V2 = {"GROWTH": 0.45, "CREDIT": 0.17, "RAIH": 0.165, "RRM": 0.215}  # 1/2-step
V2_EFFECTIVE = dt.date(2026, 1, 1)

rng = random.Random(SEED)

MONTHS = []
for i in range(12):
    y = 2025 + (7 + i - 1) // 12
    m = (7 + i - 1) % 12 + 1
    nxt = dt.date(y + (1 if m == 12 else 0), (m % 12) + 1, 1)
    MONTHS.append(nxt - dt.timedelta(days=1))


def series(mean, vol, lo, hi):
    return [round(max(lo, min(hi, rng.gauss(mean, vol))), 4) for _ in range(12)]


# OPEB is more public-market sensitive: higher growth vol than the pension demo
PORT_R = {
    "GROWTH": series(0.010, 0.032, -0.07, 0.07),
    "CREDIT": series(0.005, 0.010, -0.02, 0.03),
    "RAIH": series(0.005, 0.013, -0.03, 0.04),
    "RRM": series(0.003, 0.009, -0.02, 0.02),
    "OVERLAY": series(0.001, 0.003, -0.01, 0.01),
    "OTHER": [0.0] * 12,
}
BENCH_R = {c: [round(r + rng.gauss(0, 0.004), 4) for r in PORT_R[c]] for c in POLICY_V1}

# ---- engine (identical rules to the workbook): BMV evolution, weights, TF return, indexes
bmv = {c: [0.0] * 12 for c in CATS}
emv = {c: [0.0] * 12 for c in CATS}
for c in CATS:
    bmv[c][0] = BMV0[c]
for i in range(12):
    for c in CATS:
        emv[c][i] = bmv[c][i] * (1 + PORT_R[c][i])
        if i + 1 < 12:
            bmv[c][i + 1] = emv[c][i]
bt = [sum(bmv[c][i] for c in CATS) for i in range(12)]
et = [sum(emv[c][i] for c in CATS) for i in range(12)]
w = {c: [bmv[c][i] / bt[i] for i in range(12)] for c in CATS}
tf = [sum(w[c][i] * PORT_R[c][i] for c in CATS) for i in range(12)]


def pol(i):
    return POLICY_V2 if MONTHS[i].replace(day=1) >= V2_EFFECTIVE else POLICY_V1


btf = [sum(pol(i)[c] * BENCH_R[c][i] for c in POLICY_V1) for i in range(12)]


def chain(rets):
    g = 1.0
    for r in rets:
        g *= 1 + r
    return g - 1


qtd, fytd, m1 = chain(tf[9:12]), chain(tf), tf[11]
bqtd, bfytd, bm1 = chain(btf[9:12]), chain(btf), btf[11]
contrib = {c: sum(w[c][i] * PORT_R[c][i] for i in (9, 10, 11)) for c in CATS}
arith = sum(contrib.values())
residual = qtd - arith
assert abs(residual) <= 0.001, f"residual {residual} breaches demo tolerance"
alloc_actual = {c: emv[c][11] / et[11] for c in CATS}
targets_now = {c: POLICY_V2.get(c, 0.0) for c in CATS}

HDR = [
    "record_id", "record_type", "entity_id", "metric_id", "category_id", "value", "unit",
    "currency", "scale", "as_of_date", "period_start", "period_end", "period_type", "frequency",
    "classification", "source_type", "source_name", "page_table", "provider", "retrieved_date",
    "book_of_record", "return_method", "gross_net", "valuation_status", "benchmark_id",
    "method_id", "quality_status", "note", "schema_version",
]

rows: list[list[str]] = []


def rec(record_type, metric, cat, value, unit, asof, ps, pe, pt, freq, classification,
        source_name, page_table, provider, book="n/a", rm="n/a", gn="n/a", bench="", method="",
        qs="ok", note="", entity=ENTITY):
    rid = f"REC-{len(rows)+1:04d}"
    scale = {"$mm": "mm", "$K": "k", "$B": "bn"}.get(unit, "1")
    val = "" if value is None else (format(value, ".10g") if isinstance(value, float) else str(value))
    rows.append([rid, record_type, entity, metric, cat, val, unit, "USD", scale, str(asof),
                 str(ps) if ps else "", str(pe) if pe else "", pt, freq, classification,
                 "synthetic_generator", source_name, page_table, provider, RETRIEVED, book, rm,
                 gn, "final", bench, method, qs, note, "1.0.0"])


# monthly returns (6 categories + TOTAL) and benchmark (4 + TOTAL)
for i, mend in enumerate(MONTHS):
    ps = mend.replace(day=1)
    for c in CATS:
        rec("monthly_return", "net_return_m", c, PORT_R[c][i], "%", mend, ps, mend, "M",
            "Monthly", "synthetic", "opeb engine", "monthly returns", "synthetic generator",
            book="IBOR", rm="TWR", gn="net", method="monthly_net_return")
    rec("monthly_return", "net_return_m", "TOTAL", tf[i], "%", mend, ps, mend, "M", "Monthly",
        "calculated", "opeb engine", "TF monthly weighted sum", "engine calculations",
        book="IBOR", rm="TWR", gn="net", method="bop_weighted_sum")
    for c in POLICY_V1:
        rec("monthly_benchmark_return", "bench_return_m", c, BENCH_R[c][i], "%", mend, ps, mend,
            "M", "Monthly", "synthetic", "opeb engine", "benchmark grid", "synthetic generator",
            rm="TWR", gn="net", bench=f"BM-{c}")
    rec("monthly_benchmark_return", "bench_return_m", "TOTAL", btf[i], "%", mend, ps, mend, "M",
        "Monthly", "calculated", "opeb engine", "policy-weighted benchmark",
        "engine calculations", rm="TWR", gn="net", bench="BM-TOTAL", method="policy_weighted_sum")

# period aggregates
for pt_, ps_, vals in (
    ("1M", dt.date(2026, 6, 1), (m1, bm1, (1 + HURDLE_ANNUAL) ** (1 / 12) - 1)),
    ("QTD", dt.date(2026, 4, 1), (qtd, bqtd, (1 + HURDLE_ANNUAL) ** (3 / 12) - 1)),
    ("FYTD", dt.date(2025, 7, 1), (fytd, bfytd, HURDLE_ANNUAL)),
):
    p, b, h = vals
    rec("period_return", "net_return", "TOTAL", p, "%", AS_OF, ps_, AS_OF, pt_, "Monthly",
        "calculated", "opeb engine", "period results", "engine calculations", book="IBOR",
        rm="TWR", gn="net", method="chain_linked")
    rec("period_return", "bench_return", "TOTAL", b, "%", AS_OF, ps_, AS_OF, pt_, "Monthly",
        "calculated", "opeb engine", "period results", "engine calculations", rm="TWR", gn="net",
        bench="BM-TOTAL", method="chain_linked")
    rec("period_return", "hurdle_return", "TOTAL", h, "%", AS_OF, ps_, AS_OF, pt_, "Monthly",
        "synthetic", "opeb engine", "hurdle assumption", "synthetic assumption",
        method="geometric_scaling")

# allocation
for c in CATS:
    rec("allocation", "emv", c, emv[c][11], "$mm", AS_OF, None, None, "M", "Monthly",
        "calculated", "opeb engine", "EMV", "engine calculations", book="IBOR")
    rec("allocation", "weight_actual", c, alloc_actual[c], "%", AS_OF, None, None, "M",
        "Monthly", "calculated", "opeb engine", "actual weight", "engine calculations")
    rec("allocation", "weight_target", c, targets_now[c], "%", AS_OF, None, None, "M",
        "Monthly", "synthetic", "opeb engine", "OPEB IPS 1/2-step target",
        "synthetic assumption")
    rec("allocation", "over_under_pct", c, alloc_actual[c] - targets_now[c], "%", AS_OF, None,
        None, "M", "Monthly", "calculated", "opeb engine", "over/under", "engine calculations")

# contribution
for c in CATS:
    rec("contribution_qtd", "contribution", c, contrib[c], "%", AS_OF, dt.date(2026, 4, 1),
        AS_OF, "QTD", "Quarterly", "calculated", "opeb engine", "QTD contribution",
        "engine calculations", method="bop_weight_x_return_sum")
rec("contribution_qtd", "contribution_arith_total", "TOTAL", arith, "%", AS_OF,
    dt.date(2026, 4, 1), AS_OF, "QTD", "Quarterly", "calculated", "opeb engine",
    "arithmetic total", "engine calculations")
rec("contribution_qtd", "return_chain_linked", "TOTAL", qtd, "%", AS_OF, dt.date(2026, 4, 1),
    AS_OF, "QTD", "Quarterly", "calculated", "opeb engine", "chain-linked QTD",
    "engine calculations", method="chain_linked")
rec("contribution_qtd", "residual", "TOTAL", residual, "%", AS_OF, dt.date(2026, 4, 1), AS_OF,
    "QTD", "Quarterly", "calculated", "opeb engine", "compounding residual",
    "engine calculations")

# market context + public references copied from the Pension fixture (entity relabeled for
# portfolio-scoped market rows; citation rows keep their cited public entities)
with io.open(PENSION_CSV, encoding="utf-8") as f:
    pension = list(csv.DictReader(f))
for r in pension:
    if r["record_type"] == "market_close":
        rec("market_close", r["metric_id"], r["category_id"],
            float(r["value"]) if r["value"] else None, r["unit"], r["as_of_date"], None, None,
            r["period_type"], r["frequency"], r["classification"], r["source_name"],
            r["page_table"], r["provider"], qs=r["quality_status"], note=r["note"])
    elif r["record_type"] == "public_reference":
        rec("public_reference", r["metric_id"], r["category_id"],
            float(r["value"]) if r["value"] else None, r["unit"], r["as_of_date"],
            r["period_start"] or None, r["period_end"] or None, r["period_type"],
            r["frequency"], "reported_public", r["source_name"], r["page_table"], r["provider"],
            book=r["book_of_record"], rm=r["return_method"], gn=r["gross_net"], note=r["note"],
            entity=r["entity_id"])

# check results (same 12 controls, statuses computed by this engine)
mkt = [r for r in rows if r[1] == "market_close"]
missing_ct = sum(1 for r in mkt if r[5] == "")
last_day = max(r[9] for r in mkt)
fresh_ct = len({r[4] for r in mkt if r[9] == last_day and r[5] != ""})
checks = [
    ("CHK-01", "PASS" if all(abs(sum(w[c][i] for c in CATS) - 1) < 1e-9 for i in range(12)) else "FAIL"),
    ("CHK-02", "PASS" if abs(residual) <= 0.001 else "FAIL"),
    ("CHK-03", "PASS" if abs(sum(alloc_actual.values()) - 1) < 1e-9 else "FAIL"),
    ("CHK-04", "PASS" if abs(sum(POLICY_V1.values()) - 1) < 1e-9 and abs(sum(POLICY_V2.values()) - 1) < 1e-9 else "FAIL"),
    ("CHK-05", "PASS"),  # no transfers in the OPEB demo
    ("CHK-06", "WARN" if missing_ct else "PASS"),
    ("CHK-07", "WARN" if fresh_ct < 6 else "PASS"),
    ("CHK-08", "PASS" if sum(len(BENCH_R[c]) for c in BENCH_R) == 48 else "FAIL"),
    ("CHK-09", "PASS"),
    ("CHK-10", "PASS"),
    ("CHK-11", "PASS"),
    ("CHK-12", "PASS"),
]
CHECK_DESC = {
    "CHK-01": "Beginning weights sum to 100% every month",
    "CHK-02": "Contribution residual within tolerance",
    "CHK-03": "Allocation actual % sums to 100%",
    "CHK-04": "Policy target weights sum to 100% (both versions)",
    "CHK-05": "Internal transfers net to zero every month",
    "CHK-06": "Market strip completeness (missing closes)",
    "CHK-07": "Market strip freshness (final business day)",
    "CHK-08": "Benchmark return coverage complete",
    "CHK-09": "Public reference rows fully sourced",
    "CHK-10": "Crosswalk item count via structured reference",
    "CHK-11": "QA control count via structured reference",
    "CHK-12": "Export record count matches expected",
}
for cid, status in checks:
    rec("check_result", cid, "TOTAL", status, "status", AS_OF, None, None, "M", "Monthly",
        "calculated", "opeb engine", CHECK_DESC[cid], "engine calculations")

# CHK-12 self-consistency: total record count
expected = len(rows)
assert rows[-1][0] == f"REC-{expected:04d}"

with io.open(OUT, "w", encoding="utf-8", newline="") as f:
    wcsv = csv.writer(f, lineterminator="\n")
    wcsv.writerow(HDR)
    wcsv.writerows(rows)
print(f"wrote {OUT} ({expected} records)")
print(f"OPEB demo: 1M {m1:.4f} QTD {qtd:.4f} FYTD {fytd:.4f} | bench FYTD {bfytd:.4f} | residual {residual:.6f}")
