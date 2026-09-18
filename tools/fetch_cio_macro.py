"""Fetch the CIO Monthly Report's key macro indicators from FRED, as known on each report's date.

The report's macro pages (pp. 4 and 6, "Sources: Bloomberg, St. Louis Federal Reserve") print
PCE inflation, the federal funds target range and the unemployment and participation rates.
Those are public FRED series, so instead of typing them in for the latest report only, this
tool reads them for EVERY extracted report — as FRED showed them on the report's as-of date,
from FRED's real-time archive (ALFRED: realtime_start = realtime_end = that date). Today's
values would not do: PCE and payrolls are revised for months, so a figure read today can differ
from the one the report printed.

The as-of date is the month end before the report's month (July 31, 2026 for the August 12,
2026 report). Checked against the August 2026 report: read as of July 31 FRED gives exactly the
printed PCE 3.7% / core 3.3%, unemployment 4.2%, participation 61.5% and range 3.50-3.75%; read
as of the meeting date it gives July's labor figures (4.1% / 61.4%), which the report did not
print. The rule is mirrored by macroAsOf() in app/src/lib/cioMacro.ts, and a unit test fails if
the two disagree.

Writes raw values only to app/src/fixtures/cioMacro.data.ts; the year-over-year change and the
lines on the page are computed by tested TypeScript. The key is read and scrubbed exactly as in
fetch_macro_snapshot.py and is never printed, logged or written. Each series' FRED notes are
checked for redistribution restrictions on every run.

Usage (after tools/extract_cio_report.py has written a new report into cioVintages.data.ts):
  python tools/fetch_cio_macro.py
"""

from __future__ import annotations

import datetime as dt
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import fetch_macro_snapshot as fm  # noqa: E402  (key loading, request and terms helpers)

ROOT = fm.ROOT
VINTAGES = ROOT / "app" / "src" / "fixtures" / "cioVintages.data.ts"
OUT = ROOT / "app" / "src" / "fixtures" / "cioMacro.data.ts"
FED_WINDOW_YEARS = 6  # how far back to look for the day the current target range took effect

SERIES = {
    "PCEPI": ("PCE price index", fm.BEA),
    "PCEPILFE": ("PCE price index excluding food and energy", fm.BEA),
    "UNRATE": ("Unemployment rate", fm.BLS),
    "CIVPART": ("Labor force participation rate", fm.BLS),
    "DFEDTARL": ("Federal funds target range, lower limit", fm.FRB),
    "DFEDTARU": ("Federal funds target range, upper limit", fm.FRB),
}


def as_of(report_date: str) -> str:
    """The month end before the report's month (mirrors macroAsOf in cioMacro.ts)."""
    y, m = int(report_date[:4]), int(report_date[5:7])
    return (dt.date(y, m, 1) - dt.timedelta(days=1)).isoformat()


def observations(sid: str, known_on: str, start: str) -> list[tuple[str, float]]:
    obs = fm.get(
        "series/observations",
        series_id=sid,
        realtime_start=known_on,
        realtime_end=known_on,
        observation_start=start,
    )["observations"]
    out = [(o["date"], fm.num(o["value"])) for o in obs]
    return [(d, v) for d, v in out if v is not None]


def latest(sid: str, known_on: str) -> dict:
    start = (dt.date.fromisoformat(known_on) - dt.timedelta(days=400)).isoformat()
    obs = observations(sid, known_on, start)
    if not obs:
        raise SystemExit(f"{sid}: no observations as known on {known_on}")
    d, v = obs[-1]
    return {"date": d, "v": v}


def index_with_year_ago(sid: str, known_on: str) -> dict:
    start = (dt.date.fromisoformat(known_on) - dt.timedelta(days=800)).isoformat()
    obs = dict(observations(sid, known_on, start))
    d = max(obs)
    year_ago = f"{int(d[:4]) - 1}{d[4:]}"
    if year_ago not in obs:
        raise SystemExit(f"{sid}: no observation for {year_ago} as known on {known_on}")
    return {"date": d, "v": obs[d], "yearAgo": {"date": year_ago, "v": obs[year_ago]}}


def target_range(known_on: str) -> dict:
    start = f"{int(known_on[:4]) - FED_WINDOW_YEARS}-01-01"
    low = observations("DFEDTARL", known_on, start)
    high = observations("DFEDTARU", known_on, start)
    if not low or not high:
        raise SystemExit(f"federal funds target range: no observations as known on {known_on}")
    # the day the current range took effect: the first day of the final unchanged run
    runs = [d for (d, v), (_, prev) in zip(high[1:], high) if v != prev]
    return {"low": low[-1][1], "high": high[-1][1], "since": runs[-1] if runs else None}


def main() -> None:
    reports = re.findall(r"reportDate: '([0-9-]+)'", VINTAGES.read_text(encoding="utf-8"))
    if not reports:
        raise SystemExit(f"no reportDate found in {VINTAGES.relative_to(ROOT)}")

    series_meta = []
    for sid, (title, provider) in SERIES.items():
        notes = fm.get("series", series_id=sid)["seriess"][0].get("notes", "")
        if fm.RESTRICTED.search(notes or ""):
            raise SystemExit(f"{sid}: FRED notes now carry restriction language; review before publishing")
        series_meta.append({"id": sid, "title": title, "provider": provider})

    data = {}
    for rd in reports:
        known_on = as_of(rd)
        data[rd] = {
            "asOf": known_on,
            "pce": index_with_year_ago("PCEPI", known_on),
            "corePce": index_with_year_ago("PCEPILFE", known_on),
            "unemployment": latest("UNRATE", known_on),
            "participation": latest("CIVPART", known_on),
            "fed": target_range(known_on),
        }
        e = data[rd]
        pce = (e["pce"]["v"] / e["pce"]["yearAgo"]["v"] - 1) * 100
        print(f"{rd}: as of {known_on} · PCE {e['pce']['date'][:7]} {pce:.1f}% · "
              f"UNRATE {e['unemployment']['date'][:7]} {e['unemployment']['v']} · "
              f"range {e['fed']['low']:.2f}-{e['fed']['high']:.2f} since {e['fed']['since']}")

    retrieved = dt.date.today().isoformat()
    OUT.write_text(
        "import type { CioMacroVintage } from '../lib/cioMacro';\n\n"
        "/** GENERATED by tools/fetch_cio_macro.py — do not edit; re-run the tool. FRED values for each\n"
        " *  report (keyed by its reportDate) as FRED showed them on the report's as-of date, read from\n"
        " *  FRED's real-time archive (ALFRED). Raw levels only; lib/cioMacro.ts computes the lines. */\n"
        f"export const CIO_MACRO_RETRIEVED = '{retrieved}';\n\n"
        f"export const CIO_MACRO_SERIES = {json.dumps(series_meta, ensure_ascii=False)};\n\n"
        f"export const CIO_MACRO: Record<string, CioMacroVintage> = {json.dumps(data, ensure_ascii=False)};\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"wrote {OUT.relative_to(ROOT)}: {len(data)} reports, retrieved {retrieved}")


if __name__ == "__main__":
    main()
