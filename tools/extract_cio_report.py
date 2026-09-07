"""Extract the CIO Monthly Report figures used by the prototype from the public PDF.

Reads by word coordinates (never by text order) the pages the dashboard's CIO Monthly tab and
the slide deck quote: p. 5 market table, pp. 8-9 Total Fund, p. 11 geography, pp. 13-14 OPEB
Master Trust, p. 16 OPEB geography, p. 18 flows and overlays. Every report is validated
against the identities the report itself prints (weights sum to 100, composites sum to the
fund, one count per histogram bin summing to the month count, flows net to the printed net,
five countries per group) and is REJECTED when any check fails - a report that cannot be read
cleanly is left out with the reason, never patched by hand.

Usage:
  python tools/extract_cio_report.py <pdf> [<pdf> ...] --out outputs/data/cio_vintages.json
  python tools/extract_cio_report.py --emit-ts app/src/fixtures/cioVintages.data.ts <json>

Editorial content (notable items, key initiatives, personnel) is not extracted; it stays a
hand-maintained part of the fixture for the latest report only.
"""

from __future__ import annotations

import argparse
import calendar
import json
import re
import sys
from pathlib import Path

import fitz  # pymupdf

MONTHS = {m: i for i, m in enumerate(calendar.month_name) if m}
NUM = re.compile(r"^\(?-?\$?[\d,]*\.?\d+\)?%?$")
PERIODS = ["1 M", "3 M", "FYTD", "YTD", "1 Y", "3 Y", "5 Y", "10 Y"]
BINS = [
    "≤ -6", "-6 to -5", "-5 to -4", "-4 to -3", "-3 to -2", "-2 to -1", "-1 to 0",
    "0 to 1", "1 to 2", "2 to 3", "3 to 4", "4 to 5", "5 to 6", "≥ 6",
]
COMPOSITES = [
    ("growth", "Growth", "Growth"),
    ("credit", "Credit", "Credit"),
    ("ra", "Real Assets & Inflation Hedges", "Real Assets & IH"),
    ("rrm", "Risk Reduction & Mitigation", "Risk Reduction & Mit."),
]
MKT_TEMPLATE = [
    ("Reference portfolio", [("60:40", "60:40 Equity:Bond", "60% MSCI ACWI IMI / 40% Bloomberg U.S. Aggregate")]),
    ("Global equity", [
        ("U.S. Large Cap", "U.S. Large Cap", "S&P 500 Total Return"),
        ("U.S. Small Cap", "U.S. Small Cap", "Russell 2000 Total Return"),
        ("Non-U.S. All Cap", "Non-U.S. All Cap", "MSCI ACWI ex-U.S. IMI Total Return"),
        ("Emerging Markets", "Emerging Markets", "MSCI Emerging Markets Total Return"),
    ]),
    ("Private equity", [("Private Equity Buyout", "Private Equity Buyout", "Thomson Reuters PE Buyout Index")]),
    ("Fixed income", [
        ("U.S. Corporate High Yield", "U.S. Corporate High Yield", "Bloomberg U.S. Corporate High Yield Total Return"),
        ("U.S. Long Term Treasury", "U.S. Long-Term Treasuries", "Bloomberg Long Term U.S. Treasury Total Return"),
        ("Developed Markets Leveraged", "DM Leveraged Loans", "Credit Suisse Leveraged Loan Total Return"),
    ]),
    ("Real assets & inflation hedges", [
        ("Natural Resources", "Natural Resources", "S&P Global Natural Resources Total Return"),
        ("Global Infrastructure", "Global Infrastructure", "Dow Jones Brookfield Global Infrastructure Composite"),
        ("Treasury Inflation-Protected", "TIPS 0–5 Years", "Bloomberg U.S. Treasury TIPS 0–5 Years Total Return"),
        ("Real Estate", "Real Estate (ODCE, net)¹", "NCREIF Fund Index – ODCE (Net), latest available quarter"),
    ]),
]


class Reject(Exception):
    pass


def num(tok: str) -> float:
    neg = tok.startswith("(") or tok.startswith("-") or tok.startswith("-$")
    v = float(tok.replace("(", "").replace(")", "").replace("$", "").replace(",", "").replace("%", "").replace("-", ""))
    return -v if neg else v


def words(page):
    return [(round(w[0], 1), round(w[1], 1), round(w[2], 1), w[4]) for w in page.get_text("words")]


def lines(ws, tol=3.5):
    """Cluster words into lines by y; returns list of (y, [(x0, x1, text)...]) sorted by y then x."""
    out = []
    for x0, y0, x1, t in sorted(ws, key=lambda w: (w[1], w[0])):
        if out and abs(out[-1][0] - y0) <= tol:
            out[-1][1].append((x0, x1, t))
        else:
            out.append([y0, [(x0, x1, t)]])
    return [(y, sorted(ts)) for y, ts in out]


def month_end(month: str, year: int) -> str:
    m = MONTHS[month]
    return f"{year:04d}-{m:02d}-{calendar.monthrange(year, m)[1]:02d}"


def cover_date(t1: str) -> tuple[str, str]:
    """Meeting date from the cover ('July 8th, 2026') or, on older covers, the month alone."""
    m = re.search(r"([A-Z][a-z]+) (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})", t1)
    if m and m.group(1) in MONTHS:
        return f"{int(m.group(3)):04d}-{MONTHS[m.group(1)]:02d}-{int(m.group(2)):02d}", f"{m.group(1)} {int(m.group(2))}, {m.group(3)}"
    for name, idx in MONTHS.items():
        mm = re.search(name + r"\s+(\d{4})", t1)
        if mm:
            return f"{int(mm.group(1)):04d}-{idx:02d}", f"{name} {mm.group(1)}"
    raise Reject("cover: no report month")


def parse_meta(doc):
    t1 = doc[0].get_text()
    report_iso, report_label = cover_date(t1)
    m = None
    for pg in doc:
        m = re.search(r"Performance Summary as of ([A-Z][a-z]+) (\d{4})", pg.get_text())
        if m:
            break
    if not m:
        raise Reject("no 'Performance Summary as of <Month> <Year>' page")
    data_through = month_end(m.group(1), int(m.group(2)))
    t5 = doc[4].get_text()
    m = re.search(r"As of ([A-Z][a-z]+) (\d{1,2}), (\d{4})", t5)
    market_asof = f"{int(m.group(3)):04d}-{MONTHS[m.group(1)]:02d}-{int(m.group(2)):02d}" if m else None
    return report_iso, report_label, data_through, market_asof


def parse_summary(page, entity: str):
    ws = words(page)
    aum = [t for _, _, _, t in ws if re.fullmatch(r"\$\d+\.\dB", t)]
    if len(aum) != 1:
        raise Reject(f"{entity} summary: AUM token {aum}")
    ls = lines(ws)
    # 'Monthly Return (net)' header -> value a line or two below, in the header's x span
    hdr = next(((y, ts) for y, ts in ls if any(t == "Monthly" for _, _, t in ts) and any(t.startswith("Return") for _, _, t in ts)), None)
    if not hdr:
        raise Reject(f"{entity} summary: no Monthly Return header")
    hx = [x0 for x0, _, t in hdr[1] if t in ("Monthly", "Return", "(net)")]
    lo, hi = min(hx) - 5, max(hx) + 60
    cands = [(y, t) for y, ts in ls if hdr[0] < y < hdr[0] + 50 for x0, _, t in ts if lo <= x0 <= hi and re.fullmatch(r"-?\d+\.\d", t)]
    if not cands:
        raise Reject(f"{entity} summary: no monthly return value")
    monthly = num(cands[0][1])
    god = [num(t) for _, ts in ls if hdr[0] <= _ < hdr[0] + 50 for x0, _, t in ts if x0 > 440 and re.fullmatch(r"\$\d\.\d\d", t)]
    cash = None
    for y, ts in ls:
        cash_hdr = [x0 for x0, _, t in ts if t == "Cash"]
        if cash_hdr and any(t.startswith("(in") or t.startswith("Equivalents") for _, _, t in ts) and 380 <= cash_hdr[0] <= 560:
            below = [(yy, t) for yy, tt in ls if y < yy < y + 60 for x0, _, t in tt if 380 <= x0 <= 560 and re.fullmatch(r"\$?[\d,]+", t)]
            if below:
                cash = num(below[0][1])
    if cash is None:
        raise Reject(f"{entity} summary: no cash equivalents value")
    return {"aum": num(aum[0].rstrip("B")), "monthly": monthly, "god": god[0] if god else None, "cash": cash}


def parse_table(page, entity: str):
    ws = words(page)
    ls = lines(ws)
    total_label = "Total Fund" if entity == "pension" else "OPEB Master Trust"
    rows = {}
    # column anchors from the header row: "($ mm)", "% of", "Target", then the eight period
    # labels ("1 Month" ... "10 Year"); numeric cells are assigned to the nearest anchor, so a
    # blank cell (no OPEB 10-year figure before mid-2026) stays None instead of shifting the row
    hdr = next((ts for y, ts in ls if any(t == "Target" for _, _, t in ts) and any(t == "FYTD" for _, _, t in ts)), None)
    if hdr is None:
        raise Reject(f"{entity} table: no header row")
    def hx(pred):
        xs = [(x0, x1) for x0, x1, t in hdr if pred(t)]
        return (xs[0][0] + xs[-1][1]) / 2 if xs else None
    mm_x = hx(lambda t: t == "mm)")
    tgt_x = hx(lambda t: t == "Target")
    if mm_x is None or tgt_x is None:
        raise Reject(f"{entity} table: header anchors {mm_x, tgt_x}")
    # the "% of" label sits on the line above; the column is midway between the neighbours
    pct_x = (mm_x + tgt_x) / 2
    per: dict[str, float] = {}
    toks = list(hdr)
    for i, (x0, x1, t) in enumerate(toks):
        if t in ("1", "3", "5", "10") and i + 1 < len(toks) and toks[i + 1][2] in ("Month", "Year"):
            per[f"{t} {toks[i + 1][2][0]}"] = (x0 + toks[i + 1][1]) / 2
        elif t in ("FYTD", "YTD"):
            per[t] = (x0 + x1) / 2
    if len(per) < 6:
        raise Reject(f"{entity} table: {len(per)} period columns in header")
    # anchors aligned to PERIODS; a period the report does not print stays None throughout
    anchors = [mm_x + 8, pct_x + 8, tgt_x + 12] + [per[p] + 8 if p in per else None for p in PERIODS]
    for y, ts in ls:
        text_toks = [t for x0, _, t in ts if x0 < 200 and not NUM.match(t)]
        nums = [(x0, x1, t) for x0, x1, t in ts if x0 >= 200 and NUM.match(t)]
        if not text_toks or not nums:
            continue
        rows[" ".join(text_toks)] = nums

    def assign(nums):
        cells: list[float | None] = [None] * 11
        for x0, x1, t in nums:
            c = (x0 + x1) / 2
            j = min((k for k in range(11) if anchors[k] is not None), key=lambda k: abs(anchors[k] - c))
            cells[j] = num(t)
        return cells

    def find(pred):
        for label, nums in rows.items():
            if pred(label):
                return assign(nums)
        return None

    is_bench = lambda l: "Benchmark" in l
    is_hurdle = lambda l: "Hurdle" in l
    total = find(lambda l: l.startswith(total_label) and not is_bench(l) and not is_hurdle(l))
    tb = find(lambda l: l.startswith(total_label) and is_bench(l))
    th = find(lambda l: l.startswith(total_label.split()[0]) and is_hurdle(l) or (entity == "opeb" and l.startswith("OPEB") and is_hurdle(l)))
    if total is None or tb is None or th is None:
        raise Reject(f"{entity} table: total/benchmark/hurdle rows missing")
    keymap = {
        "growth": (lambda l: "Growth" in l),
        "credit": (lambda l: "Credit" in l),
        "ra": (lambda l: "Real Assets" in l or l.replace("OPEB ", "").startswith("RA")),
        "rrm": (lambda l: "Risk Reduction" in l or l.replace("OPEB ", "").startswith("RR")),
    }
    comps = []
    for k, name, short in COMPOSITES:
        comp = find(lambda l, f=keymap[k]: f(l) and not is_bench(l))
        bench = find(lambda l, f=keymap[k]: f(l) and is_bench(l))
        if comp is None or bench is None:
            raise Reject(f"{entity} table: composite {k} rows missing")
        comps.append({
            "k": k, "n": (name if entity == "pension" else f"OPEB {name}"), "short": short,
            "mv": comp[0], "pct": comp[1], "tgt": comp[2],
            "r": comp[3:], "b": bench[3:],
        })
    other = []
    for label, nums in rows.items():
        if any(s in label for s in ("Overlays", "Other Asset", "Cash")) and "Benchmark" not in label and not label.startswith(total_label):
            cells = assign(nums)
            other.append({"label": label, "mv": cells[0], "pct": cells[1]})
    return {
        "mv": total[0], "total": {"r": total[3:], "b": tb[3:], "h": th[3:]},
        "comps": comps, "other_rows": other,
    }


def parse_hist(page, entity: str, latest: float):
    ws = words(page)
    ls = lines(ws)
    bin_row = next((y for y, ts in ls if any(t == "≤" for _, _, t in ts)), None)
    if bin_row is None:
        raise Reject(f"{entity} hist: no bin row")
    months = None
    for y, ts in ls:
        t = " ".join(x[2] for x in ts)
        m = re.search(r"# of months:\s*(\d+)", t)
        if m:
            months = int(m.group(1))
    # one integer label per bar; integers that sit in a sentence ("2024 SAA", "# of months: 120")
    # have a word within 45 px on their line and are not bar labels
    def standalone(x0, y0):
        return not any(abs(yy - y0) <= 3 and abs(xx - x0) <= 45 and not NUM.match(t) for xx, yy, _, t in ws if (xx, yy) != (x0, y0))
    labels = sorted((x0, x1, int(t)) for x0, y0, x1, t in ws if bin_row - 110 <= y0 <= bin_row - 6 and x0 < 900 and re.fullmatch(r"\d+", t) and standalone(x0, y0))
    # bin centres from the bin-label row: group its tokens by gaps wider than 12 px
    row_toks = sorted((x0, x1) for x0, y0, x1, t in ws if abs(y0 - bin_row) <= 4)
    groups: list[list[tuple[float, float]]] = []
    for x0, x1 in row_toks:
        if groups and x0 - groups[-1][-1][1] <= 12:
            groups[-1].append((x0, x1))
        else:
            groups.append([(x0, x1)])
    centres = [(g[0][0] + g[-1][1]) / 2 for g in groups]
    if len(centres) != 14:
        raise Reject(f"{entity} hist: {len(centres)} bin labels, expected 14")
    c = [0] * 14
    for x0, x1, n in labels:
        j = min(range(14), key=lambda k: abs(centres[k] - (x0 + x1) / 2))
        if c[j]:
            raise Reject(f"{entity} hist: two count labels over bin {j}")
        c[j] = n
    if months is None or sum(c) != months:
        raise Reject(f"{entity} hist: counts sum {sum(c)} vs months {months}")
    stats = []
    for key in ("Mean", "2024", "Standard", "Minimum", "Maximum"):
        ly = [y0 for x0, y0, _, t in ws if x0 > 780 and t == key]
        if not ly:
            raise Reject(f"{entity} hist: no '{key}' label")
        val = [num(t) for x0, y0, _, t in ws if x0 > 870 and abs(y0 - ly[0]) <= 8 and NUM.match(t)]
        if len(val) != 1:
            raise Reject(f"{entity} hist: {len(val)} values for '{key}'")
        stats.append(val[0])
    mean, saa, sd, mn, mx = stats
    edges = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6]
    latest_bin = 0 if latest <= -6 else 13 if latest >= 6 else next(i + 1 for i in range(len(edges) - 1) if edges[i] <= latest < edges[i + 1])
    return {"c": c, "mean": mean, "saa": saa, "sd": sd, "min": mn, "max": mx, "latest": latest, "latestBin": latest_bin, "months": months}


def parse_geo(page, entity: str):
    ws = words(page)
    ls = lines(ws)
    pcts = [(x0, num(t)) for x0, y0, _, t in ws if 250 <= x0 <= 720 and 255 <= y0 <= 305 and re.fullmatch(r"\d+%", t)]
    if len(pcts) != 2:
        raise Reject(f"{entity} geo: DM/EM pie labels {pcts}")
    dm = max(pcts, key=lambda p: p[1])[1]
    em = min(pcts, key=lambda p: p[1])[1]
    ints = [(x0, y0, int(t)) for x0, y0, _, t in ws if 120 <= y0 <= 165 and re.fullmatch(r"\d+", t)]
    if len(ints) != 3:
        raise Reject(f"{entity} geo: market counts {ints}")
    ints.sort()
    dmN, total, emN = ints[0][2], ints[1][2], ints[2][2]
    top = []
    for y, ts in ls:
        if not (275 <= y <= 380):
            continue
        for side, lo, hi, grp in (("L", 90, 200, "dm"), ("R", 765, 870, "em")):
            names = [t for x0, _, t in ts if lo <= x0 < lo + 90 and not t.endswith("%")]
            val = [t for x0, _, t in ts if lo + 85 <= x0 <= hi and t.endswith("%")]
            if names and val:
                top.append((y, side, " ".join(names), num(val[0]), grp))
    dm_rows = [t for t in top if t[1] == "L"]
    em_rows = [t for t in top if t[1] == "R"]
    if len(dm_rows) != 5 or len(em_rows) != 5:
        raise Reject(f"{entity} geo: top lists {len(dm_rows)}/{len(em_rows)}")
    return {"dm": dm, "em": em, "dmN": dmN, "emN": emN, "total": total, "page": page.number + 1,
            # the report's two top-five lists merged by weight, as the deck displays them
            "top": [[n, v, g] for _, _, n, v, g in sorted(dm_rows + em_rows, key=lambda t: -t[3])]}


def parse_flows(page):
    ws = words(page)
    ls = lines(ws)
    toks = [(xx, y0, num(t)) for xx, y0, _, t in ws if 100 <= y0 <= 335 and re.fullmatch(r"-?\$[\d,]+", t)]
    # axis tick labels share one x column (four or more of them); bar labels do not
    axis = [x for x in {round(x) for x, _, _ in toks} if sum(abs(xx - x) <= 4 for xx, _, _ in toks) >= 4]
    bars = sorted((x, v) for x, _, v in toks if not any(abs(x - a) <= 10 for a in axis))
    pen = [v for x, v in bars if x < 480]
    ope = [v for x, v in bars if x >= 480]
    overlays = []
    for y, ts in ls:
        label = " ".join(t for x0, _, t in ts if x0 < 250 and not NUM.match(t))
        vals = [num(t) for x0, _, t in ts if x0 >= 250 and NUM.match(t)]
        if label in ("Currency Hedge", "Cash / Rebalance Overlay") and len(vals) == 2:
            overlays.append({"n": label.replace("Currency Hedge", "Currency hedge").replace("Cash / Rebalance Overlay", "Cash / rebalance overlay"), "may": vals[0], "si": vals[1]})
    return pen, ope, overlays


def parse_market(page):
    ws = words(page)
    ls = lines(ws)
    hdr = next((ts for y, ts in ls if any(t == "Sub-Category" for _, _, t in ts) and any(t == "Index" for _, _, t in ts)), None)
    if hdr is None:
        raise Reject("market: no Sub-Category / Index header")
    sub_x = next(x0 for x0, _, t in hdr if t == "Sub-Category") - 6
    idx_x = next(x0 for x0, _, t in hdr if t == "Index") - 6
    per = []
    toks = list(hdr)
    for i, (x0, x1, t) in enumerate(toks):
        if t in ("1", "3", "5", "10") and i + 1 < len(toks) and toks[i + 1][2] in ("M", "Y"):
            per.append((x0 + toks[i + 1][1]) / 2)
        elif t in ("FYTD", "YTD"):
            per.append((x0 + x1) / 2)
    if len(per) != 8:
        raise Reject(f"market: {len(per)} period columns in header")
    val_x = per[0] - 30
    def assign(ts):
        cells: list[float | None] = [None] * 8
        for x0, x1, t in ts:
            if x0 >= val_x and NUM.match(t):
                c = (x0 + x1) / 2
                cells[min(range(8), key=lambda k: abs(per[k] + 6 - c))] = num(t)
        return cells
    value_lines = [(y, assign(ts)) for y, ts in ls]
    value_lines = [(y, v) for y, v in value_lines if sum(x is not None for x in v) >= 6]
    out = []
    for group, rows in MKT_TEMPLATE:
        g = {"g": group, "rows": []}
        for key, label, index in rows:
            hit = None
            for y, ts in ls:
                sub = " ".join(t for x0, _, t in ts if sub_x <= x0 < idx_x)
                if sub.startswith(key):
                    hit = y
                    break
            if hit is None:
                raise Reject(f"market: row '{key}' not found")
            vals = min(value_lines, key=lambda yv: abs(yv[0] - hit))
            if abs(vals[0] - hit) > 8:
                raise Reject(f"market: no value line near '{key}'")
            g["rows"].append({"n": label, "i": index, "v": vals[1]})
        out.append(g)
    return out


def extract(pdf: Path, url: str | None):
    doc = fitz.open(pdf)
    if len(doc) < 18:
        raise Reject(f"{len(doc)} pages")
    report_iso, report_label, data_through, market_asof = parse_meta(doc)
    texts = [pg.get_text() for pg in doc]

    def find_page(*needles, opeb: bool | None = None, skip=()):
        for i, t in enumerate(texts):
            if i in skip or not all(n in t for n in needles):
                continue
            if opeb is True and "OPEB" not in t:
                continue
            if opeb is False and "OPEB" in t:
                continue
            return i
        raise Reject(f"no page with {needles} (opeb={opeb})")

    # the market table is machine-readable from 2026 on; earlier reports carry it differently and
    # the vintage is kept without it (the tab says so) rather than rejected
    try:
        p_market = find_page("Sub-Category")
    except Reject:
        p_market = None
    p_flows = find_page("Rebalancing Activity")
    ents = {}
    pages_used = {}
    for entity in ("pension", "opeb"):
        opeb = entity == "opeb"
        p_sum = find_page("Performance Summary", "Monthly Return", opeb=opeb)
        try:
            p_tab = find_page("Actuarial Hurdle", "Target", opeb=opeb)
        except Reject:
            raise Reject(f"{entity}: performance table not machine-readable (rendered as an image)")
        p_hist = find_page("# of months", opeb=opeb)
        p_geo = find_page("Geographic Exposure", opeb=opeb)
        pages_used[entity] = (p_sum + 1, p_tab + 1, p_hist + 1, p_geo + 1)
        s = parse_summary(doc[p_sum], entity)
        t = parse_table(doc[p_tab], entity)
        h = parse_hist(doc[p_hist], entity, s["monthly"])
        g = parse_geo(doc[p_geo], entity)
        # identities
        wsum = sum(c["pct"] for c in t["comps"]) + sum(o["pct"] for o in t["other_rows"])
        msum = sum(c["mv"] for c in t["comps"]) + sum(o["mv"] for o in t["other_rows"])
        gap = t["mv"] - msum
        if abs(gap) > 2:
            # accepted only when the printed weights leave the same gap (within rounding)
            # a small unitemized line (cash) the report totals but does not list; anything larger
            # than 0.3% of the fund is a reading error, not a residual
            if gap < 0 or gap / t["mv"] * 100 > 0.3:
                raise Reject(f"{entity}: composites {msum} vs total {t['mv']} (weights {wsum:.1f})")
            t["other_rows"].append({"label": "Not itemized (report total less listed composites)", "mv": gap, "pct": round(max(0.0, 100 - wsum), 1)})
            wsum = max(wsum, 100.0)
        if abs(wsum - 100) > 0.25:
            raise Reject(f"{entity}: weights sum {wsum:.2f}")
        if abs(t["mv"] / 1000 - s["aum"]) > 0.06:
            raise Reject(f"{entity}: AUM {s['aum']} vs table {t['mv']}")
        if abs(t["total"]["r"][0] - s["monthly"]) > 0.051:
            raise Reject(f"{entity}: monthly {s['monthly']} vs table 1M {t['total']['r'][0]}")
        other = None
        other_rows = [o for o in t["other_rows"] if o["mv"]]
        if other_rows:
            other = {"n": " + ".join(o["label"] for o in other_rows), "mv": sum(o["mv"] for o in other_rows), "pct": round(sum(o["pct"] for o in other_rows), 1)}
        ents[entity] = {
            "name": "LACERA Pension Fund" if entity == "pension" else "OPEB Master Trust",
            "short": "Pension Fund" if entity == "pension" else "OPEB Master Trust",
            "aum": s["aum"], "mv": t["mv"], "cash": s["cash"], "god": s["god"],
            "pages": (lambda a, b: f"pp. {a}–{b}" if b > a else f"p. {a}")(pages_used[entity][0], max(pages_used[entity][1], pages_used[entity][2])),
            "total": t["total"], "comps": t["comps"], "other": other, "netflow": None, "overlays": None,
            "hist": h, "geo": g,
        }
    pen, ope, overlays = parse_flows(doc[p_flows])
    if len(pen) == 6 and abs(sum(pen[:5]) - pen[5]) <= 1:
        for c, v in zip(ents["pension"]["comps"], pen[:4]):
            c["flow"] = v
        if ents["pension"]["other"]:
            ents["pension"]["other"]["flow"] = pen[4]
        ents["pension"]["netflow"] = pen[5]
    else:
        raise Reject(f"flows: pension chart labels {pen}")
    if len(ope) == 5 and abs(sum(ope[:4]) - ope[4]) <= 1:
        for c, v in zip(ents["opeb"]["comps"], ope[:4]):
            c["flow"] = v
        ents["opeb"]["netflow"] = ope[4]
    elif len(ope) == 6 and abs(sum(ope[:5]) - ope[5]) <= 1:
        for c, v in zip(ents["opeb"]["comps"], ope[:4]):
            c["flow"] = v
        if ents["opeb"]["other"]:
            ents["opeb"]["other"]["flow"] = ope[4]
        ents["opeb"]["netflow"] = ope[5]
    else:
        raise Reject(f"flows: OPEB chart labels {ope}")
    ents["pension"]["overlays"] = overlays or None
    for e in ents.values():
        e["hist"].pop("months", None)
        if e["other"] is not None:
            e["other"].setdefault("flow", 0)
    return {
        "reportDate": report_iso, "reportLabel": report_label, "dataThrough": data_through,
        "marketAsOf": market_asof, "file": pdf.name, "url": url,
        "pages": {"market": (p_market + 1) if p_market is not None else None, "flows": p_flows + 1, "pension": pages_used["pension"], "opeb": pages_used["opeb"]},
        "ENT": ents, "MKT": parse_market(doc[p_market]) if p_market is not None else None,
    }


URL_BASE = "https://www.lacera.gov/sites/default/files/assets/documents/financials/cio_report/"
URL_PATHS = {
    "CIO-Monthly-Report-Aug-2026.pdf": "", "CIO-Monthly-Report-July-2026.pdf": "", "CIO-Monthly-Report-June-2026.pdf": "",
    "CIO-Monthly-Report-May-2026.pdf": "2026/", "CIO-Monthly-Report-April-2026.pdf": "", "CIO-Monthly-Report-March-2026.pdf": "2026/",
    "CIO-Monthly-Report-February-2026.pdf": "2026/", "CIO-Monthly-Report-January-2026.pdf": "2026/", "CIO-Monthly-Report-December-2025.pdf": "",
    "CIO-Monthly-Report-November-2025.pdf": "", "CIO-Monthly-Report-October-2025.pdf": "2025/", "CIO-Monthly-Report-September-2025.pdf": "2025/",
    "CIO-Monthly-Report-August-2025.pdf": "2025/", "CIO-Monthly-Report-July-2025.pdf": "2025/", "CIO-Monthly-Report-June-2025.pdf": "",
    "CIO-Monthly-Report-May-2025.pdf": "", "CIO-Monthly-Report-April-2025.pdf": "",
}


def emit_ts(vintages: list[dict], out: Path):
    body = json.dumps(vintages, ensure_ascii=False, indent=2)
    out.write_text(
        "import type { CioVintage } from './cioMonthly';\n\n"
        "/**\n * CIO Monthly Report vintages, oldest first — GENERATED by tools/extract_cio_report.py from the\n"
        " * public PDFs (word coordinates, validated against the report's own identities). Do not edit by\n"
        " * hand: re-run the extractor. Every value is reported_public from the pages named per entity.\n */\n"
        f"export const CIO_VINTAGES: CioVintage[] = {body};\n",
        encoding="utf-8",
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdfs", nargs="*")
    ap.add_argument("--out", type=Path)
    ap.add_argument("--emit-ts", type=Path)
    ap.add_argument("--from-json", type=Path)
    a = ap.parse_args()
    if a.emit_ts:
        vint = json.loads(a.from_json.read_text(encoding="utf-8"))
        if isinstance(vint, dict):
            vint = vint["vintages"]
        emit_ts(vint, a.emit_ts)
        print(f"wrote {a.emit_ts} ({len(vint)} vintages)")
        return
    ok, rejected = [], []
    for p in a.pdfs:
        pdf = Path(p)
        url = (URL_BASE + URL_PATHS[pdf.name] + pdf.name) if pdf.name in URL_PATHS else None
        try:
            v = extract(pdf, url)
            ok.append(v)
            print(f"OK       {pdf.name}: report {v['reportDate']} data through {v['dataThrough']} AUM {v['ENT']['pension']['aum']}B / {v['ENT']['opeb']['aum']}B")
        except Reject as ex:
            rejected.append((pdf.name, str(ex)))
            print(f"REJECTED {pdf.name}: {ex}")
        except Exception as ex:  # noqa: BLE001 - report and continue
            rejected.append((pdf.name, f"{type(ex).__name__}: {ex}"))
            print(f"ERROR    {pdf.name}: {type(ex).__name__}: {ex}")
    ok.sort(key=lambda v: v["dataThrough"])
    if a.out:
        a.out.parent.mkdir(parents=True, exist_ok=True)
        a.out.write_text(json.dumps({"vintages": ok, "rejected": rejected}, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"wrote {a.out}: {len(ok)} accepted, {len(rejected)} rejected")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
