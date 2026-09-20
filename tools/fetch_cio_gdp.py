"""Rebuild each CIO Monthly Report's Quarterly Real GDP Growth chart from FRED's real-time archive.

The chart is a picture in the PDF apart from its bar labels, and the figures are BEA's, so they are
a public FRED series (A191RL1Q225SBEA, real GDP percent change from the preceding quarter at an
annual rate). The obvious approach — read FRED as of the month end before the report, the rule the
same page's inflation and labour figures follow — reproduces only eight of the fifteen charts.

The reason is not that the rule is wrong for those figures. It is that this chart is not redrawn
every month: the September, October, November and December 2025 reports all print the chart exactly
as FRED stood on July 31, 2025, revisions and all. A single read-date rule cannot reproduce a
chart that is sometimes five months old.

So the vintage is identified rather than assumed. For each report the printed bar labels are read
off the page, and FRED's archive is searched backwards from the report's own as-of date for the
month end whose vintage reproduces every one of them. Thirteen or fourteen figures matching to a
tenth is not something that happens by accident, so a match identifies the vintage; the latest
matching month end is recorded, and where that is earlier than the report's as-of date, the report's
chart was carrying older data than the rest of its macro page and the prototype says so.

Writes app/src/fixtures/cioGdp.data.ts. The printed labels are written alongside the FRED values so
a unit test can check the two still agree without a network call.

Usage (after the report PDFs are in outputs/data/public_docs/cio):
  python tools/fetch_cio_gdp.py
"""

from __future__ import annotations

import datetime as dt
import json
import pathlib
import re
import sys
from collections import Counter

import pdfplumber

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import fetch_macro_snapshot as fm  # noqa: E402  (key loading, request and terms helpers)

ROOT = fm.ROOT
VINTAGES = ROOT / "app" / "src" / "fixtures" / "cioVintages.data.ts"
PDFS = ROOT / "outputs" / "data" / "public_docs" / "cio"
OUT = ROOT / "app" / "src" / "fixtures" / "cioGdp.data.ts"

SID = "A191RL1Q225SBEA"
TITLE = re.compile(r"Quarterly Real (?:U\.S\. )?GDP Growth")
LABEL = re.compile(r"-?\d+\.\d%")
SEARCH_MONTHS = 24  # how far back to look for the vintage a chart was drawn from


def as_of(report_date: str) -> str:
    """The month end before the report's month (mirrors macroAsOf in cioMacro.ts)."""
    y, m = int(report_date[:4]), int(report_date[5:7])
    return (dt.date(y, m, 1) - dt.timedelta(days=1)).isoformat()


def month_end_before(iso: str, back: int) -> str:
    y, m = int(iso[:4]), int(iso[5:7])
    m -= back
    y += (m - 1) // 12
    m = (m - 1) % 12 + 1
    return (dt.date(y + (m // 12), m % 12 + 1, 1) - dt.timedelta(days=1)).isoformat()


def quarter(date_str: str) -> str:
    y, m = int(date_str[:4]), int(date_str[5:7])
    return f"{y}Q{(m - 1) // 3 + 1}"


def printed_bars(pdf_path: pathlib.Path) -> list[float] | None:
    """The chart's bar labels, oldest to newest.

    The page holds three more charts, so the labels are separated by geometry rather than by a
    bounding box that would have to be re-tuned for every layout the report has used:

      * a y-axis is a column of labels stacked at one x, while a bar label stands alone at its own
        x, so any x position that occurs more than once is an axis and is dropped;
      * the bars are evenly spaced, so the longest run of labels at a consistent pitch is the
        chart and anything else on the page is not.
    """
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            if not TITLE.search(page.extract_text() or ""):
                continue
            words = page.extract_words()
            title = next(w for w in words if w["text"] == "Quarterly")
            hits = [
                w
                for w in words
                if w["top"] > title["top"]
                and w["top"] < page.height * 0.58
                and LABEL.fullmatch(w["text"])
            ]
            columns = Counter(round(w["x0"]) for w in hits)
            bars = sorted((w for w in hits if columns[round(w["x0"])] == 1), key=lambda w: w["x0"])
            if len(bars) > 2:
                gaps = [round(b["x0"] - a["x0"], 1) for a, b in zip(bars, bars[1:])]
                pitch = sorted(gaps)[len(gaps) // 2]
                best: list = [bars[0]]
                run: list = [bars[0]]
                for gap, bar in zip(gaps, bars[1:]):
                    if abs(gap - pitch) < pitch * 0.25:
                        run.append(bar)
                    else:
                        best = run if len(run) > len(best) else best
                        run = [bar]
                bars = run if len(run) > len(best) else best
            return [float(w["text"].rstrip("%")) for w in bars] or None
    return None


_cache: dict[str, list[tuple[str, float]]] = {}


def series_as_of(known_on: str) -> list[tuple[str, float]]:
    if known_on not in _cache:
        obs = fm.get(
            "series/observations",
            series_id=SID,
            realtime_start=known_on,
            realtime_end=known_on,
            observation_start="2015-01-01",
        )["observations"]
        _cache[known_on] = [
            (quarter(o["date"]), fm.num(o["value"]))
            for o in obs
            if fm.num(o["value"]) is not None
        ]
    return _cache[known_on]


def identify(printed: list[float], report_date: str) -> tuple[str, list[tuple[str, float]]] | None:
    """The latest month end at or before the report's as-of date whose FRED vintage prints these
    bars. Returns the date and the quarters it covers, or None if no vintage reproduces them."""
    start = as_of(report_date)
    for back in range(SEARCH_MONTHS):
        known_on = month_end_before(start, back)
        tail = series_as_of(known_on)[-len(printed) :]
        if len(tail) != len(printed):
            continue
        if all(abs(v - p) < 0.051 for (_, v), p in zip(tail, printed)):
            return known_on, tail
    return None


def main() -> None:
    text = VINTAGES.read_text(encoding="utf-8")
    reports = re.findall(r"reportDate: '([0-9-]+)'", text)
    files = re.findall(r"file: '([^']+)'", text)
    if len(files) != len(reports):
        raise SystemExit("every report needs a file: the GDP chart is read from its PDF")

    notes = fm.get("series", series_id=SID)["seriess"][0].get("notes", "")
    if fm.RESTRICTED.search(notes or ""):
        raise SystemExit(f"{SID}: FRED notes now carry restriction language; review before publishing")

    out: dict[str, dict] = {}
    missing: list[str] = []
    for report_date, name in zip(reports, files):
        path = PDFS / name
        if not path.exists():
            missing.append(f"{report_date}: {name} not downloaded")
            continue
        printed = printed_bars(path)
        if not printed:
            missing.append(f"{report_date}: no GDP chart found in {name}")
            continue
        found = identify(printed, report_date)
        if not found:
            missing.append(
                f"{report_date}: no FRED vintage in {SEARCH_MONTHS} months reproduces the "
                f"{len(printed)} printed bars"
            )
            continue
        known_on, tail = found
        stale = known_on != as_of(report_date)
        out[report_date] = {
            "asOf": known_on,
            "reportAsOf": as_of(report_date),
            "stale": stale,
            "quarters": [{"q": q, "v": v} for q, v in tail],
            "printed": printed,
        }
        flag = "  (older than the rest of its macro page)" if stale else ""
        print(f"{report_date}: {len(printed)} bars, FRED as of {known_on}{flag}")

    if missing:
        print("\nnot carried:")
        for line in missing:
            print("  " + line)

    body = ",\n".join(f"  '{rd}': {json.dumps(v)}" for rd, v in sorted(out.items()))
    header = f"""/* GENERATED by tools/fetch_cio_gdp.py — do not edit by hand.
 *
 * The Quarterly Real GDP Growth chart on each report's Key Macro Indicators page, rebuilt from
 * FRED's real-time archive (ALFRED) rather than typed.
 *
 * Series:   {SID} — real GDP, percent change from preceding period, seasonally adjusted annual rate
 * Provider: {fm.BEA}, via FRED (Federal Reserve Bank of St. Louis)
 * Licence:  public data; the report cites "Bloomberg, St. Louis Federal Reserve"
 *
 * `asOf` is the vintage the report's chart was drawn from, IDENTIFIED rather than assumed: FRED's
 * archive is searched backwards from the report's own as-of date for the month end that reproduces
 * every printed bar. This chart is not redrawn every month — four consecutive reports in late 2025
 * print it exactly as FRED stood on July 31, 2025 — so no single read-date rule reproduces it.
 * `stale` is true where the identified vintage is older than `reportAsOf`, which is the date the
 * rest of that macro page follows; the prototype says so on the page rather than implying the
 * chart is current.
 *
 * `printed` is what the page prints, read off the PDF, so a unit test can check the FRED values
 * still agree with it without a network call.
 */

export interface CioGdpVintage {{
  /** the FRED vintage this chart was drawn from */
  asOf: string;
  /** the date the rest of the report's macro page follows */
  reportAsOf: string;
  /** the chart is older than the rest of its macro page */
  stale: boolean;
  quarters: {{ q: string; v: number }}[];
  /** the bar labels as printed on the page, oldest first */
  printed: number[];
}}

export const CIO_GDP: Record<string, CioGdpVintage> = {{
{body},
}};
"""
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(header)
    stale = sum(1 for v in out.values() if v["stale"])
    print(f"\n{len(out)} reports written ({stale} carrying an older vintage) -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
