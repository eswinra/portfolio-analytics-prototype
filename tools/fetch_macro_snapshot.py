"""Fetch the public economic series behind the Economic Context view into a dated snapshot.

The public prototype is a static site, so it cannot call FRED at view time without exposing an
API key in the browser. This tool runs locally, reads the key from the FRED_API_KEY environment
variable or from an ignored `fred_key.txt`, and writes raw observations only:
`app/src/fixtures/macroSnapshot.data.ts`. Every derived figure (year-over-year changes, z-scores,
factors, the regime read, the sensitivity map) is computed on the site by tested TypeScript.

Redistribution: the site is public, so only series whose FRED notes carry no copyright or
redistribution restriction are fetched. The terms are re-checked on EVERY run and the tool aborts
if an allowlisted series gains restriction language — a change in a provider's terms is caught,
not silently republished. Series excluded for their terms are listed in the snapshot with the
reason, so the page can say what it deliberately does not show.

The key is never printed, logged or written; error text is scrubbed of it before display.

Usage:
  set FRED_API_KEY=...            (or place the key in regime-dashboard/fred_key.txt, ignored)
  python tools/fetch_macro_snapshot.py
"""

from __future__ import annotations

import datetime as dt
import json
import os
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "app" / "src" / "fixtures" / "macroSnapshot.data.ts"
# dates only, so the site header can show them without loading the full snapshot
META = ROOT / "app" / "src" / "fixtures" / "macroSnapshot.meta.ts"
KEY_FILES = [ROOT / "regime-dashboard" / "fred_key.txt", ROOT / "fred_key.txt"]
MONTHLY_START = "1994-01-01"  # year-over-year changes need 1994 to score from 1995
RECENT_DAYS = 400  # native daily/weekly history: a year-ago Treasury curve and a 30-day change
PAUSE = 0.55  # FRED allows 120 requests a minute

BLS = "U.S. Bureau of Labor Statistics"
BEA = "U.S. Bureau of Economic Analysis"
FRB = "Board of Governors of the Federal Reserve System"
STL = "Federal Reserve Bank of St. Louis"
CHI = "Federal Reserve Bank of Chicago"
EIA = "U.S. Energy Information Administration"
CEN = "U.S. Census Bureau"
ETA = "U.S. Employment and Training Administration"

# id: (group, short title, original provider)
SERIES: dict[str, tuple[str, str, str]] = {
    "CPIAUCSL": ("inflation", "Headline CPI", BLS),
    "CPILFESL": ("inflation", "Core CPI", BLS),
    "PCEPI": ("inflation", "PCE price index", BEA),
    "PCEPILFE": ("inflation", "Core PCE price index", BEA),
    "PPIACO": ("inflation", "PPI, all commodities", BLS),
    "T5YIE": ("inflation", "5-year breakeven inflation", STL),
    "T10YIE": ("inflation", "10-year breakeven inflation", STL),
    "T5YIFR": ("inflation", "5-year, 5-year forward inflation expectation", STL),
    "CES0500000003": ("inflation", "Average hourly earnings, private", BLS),
    "UNRATE": ("labor", "Unemployment rate", BLS),
    "U6RATE": ("labor", "U-6 underemployment rate", BLS),
    "PAYEMS": ("labor", "Nonfarm payrolls", BLS),
    "IC4WSA": ("labor", "Initial claims, 4-week average", ETA),
    "CIVPART": ("labor", "Labor force participation rate", BLS),
    "JTSJOL": ("labor", "Job openings", BLS),
    "DGS3MO": ("rates", "3-month Treasury", FRB),
    "DGS2": ("rates", "2-year Treasury", FRB),
    "DGS5": ("rates", "5-year Treasury", FRB),
    "DGS10": ("rates", "10-year Treasury", FRB),
    "DGS30": ("rates", "30-year Treasury", FRB),
    "T10Y2Y": ("rates", "10-year minus 2-year", STL),
    "T10Y3M": ("rates", "10-year minus 3-month", STL),
    "DFII10": ("rates", "10-year real yield (TIPS)", FRB),
    "DFF": ("rates", "Federal funds effective rate", FRB),
    "STLFSI4": ("credit", "St. Louis Fed Financial Stress Index", STL),
    "NFCI": ("credit", "Chicago Fed National Financial Conditions Index", CHI),
    "NFCICREDIT": ("credit", "NFCI credit subindex", CHI),
    "NFCIRISK": ("credit", "NFCI risk subindex", CHI),
    "CPFF": ("credit", "3-month commercial paper minus fed funds", STL),
    "DCOILWTICO": ("commodities", "WTI crude oil, Cushing", EIA),
    "DHHNGSP": ("commodities", "Henry Hub natural gas", EIA),
    "PPIIDC": ("commodities", "PPI, industrial commodities", BLS),
    "WPU10": ("commodities", "PPI, metals and metal products", BLS),
    "DTWEXBGS": ("dollar", "Nominal broad U.S. dollar index", FRB),
    "INDPRO": ("growth", "Industrial production", FRB),
    "RSAFS": ("growth", "Retail and food services sales", CEN),
    "HOUST": ("growth", "Housing starts", CEN),
    "TCU": ("growth", "Capacity utilization", FRB),
}

# Considered and deliberately NOT published, with the reason (checked 2026-09-16 against each
# series' FRED notes). The page lists these so a reader knows what is absent and why.
EXCLUDED: dict[str, tuple[str, str]] = {
    "BAMLH0A0HYM2": ("ICE BofA US High Yield OAS", "ICE Data Indices: reproduction in any form is prohibited without prior written permission"),
    "BAMLC0A0CM": ("ICE BofA US Corporate OAS", "ICE Data Indices: reproduction in any form is prohibited without prior written permission"),
    "BAMLH0A3HYC": ("ICE BofA CCC & Lower OAS", "ICE Data Indices: reproduction in any form is prohibited without prior written permission"),
    "BAA10Y": ("Moody's Baa minus 10-year Treasury", "Moody's: proprietary, all rights reserved"),
    "PCOPPUSDM": ("Global price of copper", "International Monetary Fund: copyright, reprinted with permission"),
    "UMCSENT": ("University of Michigan consumer sentiment", "University of Michigan: copyright, reprinted with permission"),
    "USSLIND": ("Leading index for the United States", "Discontinued by the source in 2020"),
}

RESTRICTED = re.compile(
    r"(copyright|©|reprinted with permission|all rights reserved|may not be (used|reproduced)|"
    r"redistribut|prohibited|without (the )?prior written)",
    re.I,
)


def load_key() -> str:
    k = os.environ.get("FRED_API_KEY", "").strip()
    if not k:
        for f in KEY_FILES:
            if f.exists():
                k = f.read_text(encoding="utf-8").strip()
                break
    if not re.fullmatch(r"[a-z0-9]{32}", k):
        raise SystemExit("No valid FRED key: set FRED_API_KEY or place it in regime-dashboard/fred_key.txt")
    return k


KEY = load_key()


def scrub(text: str) -> str:
    return text.replace(KEY, "<key>")


def get(endpoint: str, **params) -> dict:
    q = urllib.parse.urlencode({**params, "api_key": KEY, "file_type": "json"})
    last: Exception | None = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(f"https://api.stlouisfed.org/fred/{endpoint}?{q}", timeout=40) as r:
                data = json.load(r)
            time.sleep(PAUSE)
            return data
        except urllib.error.HTTPError as ex:
            last = ex
            if ex.code == 429 or ex.code >= 500:
                # rate limit or a transient server error: back off and retry
                time.sleep(20 if ex.code == 429 else 5 * (attempt + 1))
                continue
            raise SystemExit(scrub(f"FRED {endpoint} {params.get('series_id')}: HTTP {ex.code}"))
        except (urllib.error.URLError, TimeoutError) as ex:
            last = ex
            time.sleep(3 * (attempt + 1))
    raise SystemExit(scrub(f"FRED {endpoint} {params.get('series_id')}: {type(last).__name__}"))


def num(v: str) -> float | None:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if x == x else None


def main() -> None:
    today = dt.date.today()
    recent_start = (today - dt.timedelta(days=RECENT_DAYS)).isoformat()
    out: dict[str, dict] = {}
    for sid, (group, short, provider) in SERIES.items():
        meta = get("series", series_id=sid)["seriess"][0]
        notes = meta.get("notes") or ""
        hit = RESTRICTED.search(notes)
        if hit:
            raise SystemExit(
                f"ABORT: {sid} notes now contain restriction language ({hit.group(0)!r}). "
                "Review its terms before publishing; move it to EXCLUDED if it may not be republished."
            )
        if meta.get("observation_end", "") < (today - dt.timedelta(days=400)).isoformat():
            raise SystemExit(f"ABORT: {sid} has not been updated since {meta.get('observation_end')} (discontinued?)")

        monthly_raw = get(
            "series/observations", series_id=sid, observation_start=MONTHLY_START,
            frequency="m", aggregation_method="avg",
        )["observations"]
        # key by calendar month and pad: an omitted month must stay a gap, never shift later values
        by_month = {o["date"][:7]: num(o["value"]) for o in monthly_raw}
        start, end = min(by_month), max(by_month)
        months = []
        y, m = int(start[:4]), int(start[5:7])
        while f"{y:04d}-{m:02d}" <= end:
            key = f"{y:04d}-{m:02d}"
            months.append((key, by_month.get(key)))
            y, m = (y + 1, 1) if m == 12 else (y, m + 1)
        values = [None if v is None else round(v, 4) for _, v in months]

        rec: dict = {
            "id": sid,
            "group": group,
            "short": short,
            "title": meta["title"],
            "provider": provider,
            "units": meta["units"],
            "unitsShort": meta["units_short"],
            "frequency": meta["frequency_short"],
            "seasonal": meta["seasonal_adjustment_short"],
            "lastUpdated": meta["last_updated"][:10],
            "monthly": {"start": start, "values": values},
        }
        if meta["frequency_short"] in ("D", "W"):
            native = get("series/observations", series_id=sid, observation_start=recent_start)["observations"]
            recent = []
            for o in native:
                v = num(o["value"])
                recent.append([o["date"], None if v is None else round(v, 4)])
            rec["recent"] = recent
        else:
            present = [(m, v) for m, v in months if v is not None]
            rec["latest"] = [f"{present[-1][0]}-01", present[-1][1]] if present else None
        out[sid] = rec
        latest = rec.get("latest")
        last = rec["recent"][-1][0] if "recent" in rec else (latest[0] if latest else "none")
        print(f"ok  {sid:<14} {rec['frequency']}  monthly {start}..{months[-1][0]}  latest {last}")

    snapshot = {
        "retrieved": today.isoformat(),
        "provider": "Federal Reserve Bank of St. Louis, FRED",
        "termsCheckedOn": today.isoformat(),
        "series": out,
        "excluded": [{"id": k, "title": t, "reason": r} for k, (t, r) in EXCLUDED.items()],
    }
    body = json.dumps(snapshot, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text(
        "import type { MacroSnapshot } from '../lib/macro/types';\n\n"
        "/**\n"
        " * Public economic series from FRED — GENERATED by tools/fetch_macro_snapshot.py. Do not edit\n"
        " * by hand: re-run the tool. Raw observations only (monthly averages since 1994, plus native\n"
        " * daily/weekly observations for the last 400 days); every derived figure is computed by\n"
        " * app/src/lib/macro. Only series whose FRED notes carry no redistribution restriction are\n"
        " * included; the excluded list records what was left out and why.\n"
        " */\n"
        f"export const MACRO_SNAPSHOT: MacroSnapshot = {body};\n",
        encoding="utf-8",
    )
    last_complete = (today.replace(day=1) - dt.timedelta(days=1)).strftime("%Y-%m")
    META.write_text(
        "/** GENERATED by tools/fetch_macro_snapshot.py with the snapshot beside it. The shell header\n"
        " *  reads these dates without loading the full snapshot, which only the Economic Context\n"
        " *  view needs. */\n"
        "export const MACRO_META = {\n"
        f"  retrieved: '{today.isoformat()}',\n"
        "  /** factors use monthly averages through the last complete month before retrieval */\n"
        f"  monthlyThrough: '{last_complete}',\n"
        f"  seriesCount: {len(out)},\n"
        "} as const;\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT.relative_to(ROOT)}: {len(out)} series, retrieved {today.isoformat()}, {len(body) // 1024} KB")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
