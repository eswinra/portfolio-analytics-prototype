"""Turn Natural Earth's country outlines into SVG paths at build time.

The prototype ships no mapping library and makes no request at run time: this script projects the
outlines once and writes them into a fixture, so the page draws plain `<path>` elements from data
that is reviewable in the repository like every other fixture.

Source   Natural Earth, Admin 0 - Countries, 1:110m (ne_110m_admin_0_countries.geojson)
Provider Natural Earth / nvkelso natural-earth-vector, raw.githubusercontent.com
Licence  public domain (Natural Earth terms of use)
Read     see `asOf` in the generated file; the download is kept under outputs/ and is not committed

Projection: Robinson, the compromise projection used for reference world maps. It is neither equal
area nor conformal, which is the point of using it here: the map is a locator for the countries the
report names, not a device for comparing areas. The slide says so, and the shares are read from the
table beside it.

Antarctica is dropped. It carries no exposure, and keeping it would spend a fifth of the height on
the one land mass the report can never name.

usage: python tools/make_world_paths.py [--tolerance 0.7] [--width 1000]
"""

from __future__ import annotations

import argparse
import json
import math
import pathlib
import urllib.request
from datetime import date

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "outputs" / "data" / "geo" / "ne_110m_admin_0_countries.geojson"
URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
    "master/geojson/ne_110m_admin_0_countries.geojson"
)
OUT = ROOT / "app" / "src" / "fixtures" / "worldMap.data.ts"

# Every country the reports name, across all sixteen extracted vintages. Kept here so the fixture
# carries full-detail outlines for the countries that can be shaded, and so a country that appears
# in a future report fails loudly in the unit test rather than silently going unshaded.
NAMED = {
    "USA": "United States",
    "GBR": "United Kingdom",
    "CAN": "Canada",
    "CHN": "China",
    "JPN": "Japan",
    "TWN": "Taiwan",
    "IND": "India",
    "KOR": "South Korea",
    "BRA": "Brazil",
    "FRA": "France",
    "DEU": "Germany",
    "SAU": "Saudi Arabia",
}

# Robinson's table: for each parallel, the length of that parallel relative to the equator (x) and
# its distance from the equator (y). Values between rows are interpolated linearly.
ROBINSON = [
    (0.0, 1.0000, 0.0000),
    (5.0, 0.9986, 0.0620),
    (10.0, 0.9954, 0.1240),
    (15.0, 0.9900, 0.1860),
    (20.0, 0.9822, 0.2480),
    (25.0, 0.9730, 0.3100),
    (30.0, 0.9600, 0.3720),
    (35.0, 0.9427, 0.4340),
    (40.0, 0.9216, 0.4958),
    (45.0, 0.8962, 0.5571),
    (50.0, 0.8679, 0.6176),
    (55.0, 0.8350, 0.6769),
    (60.0, 0.7986, 0.7346),
    (65.0, 0.7597, 0.7903),
    (70.0, 0.7186, 0.8435),
    (75.0, 0.6732, 0.8936),
    (80.0, 0.6213, 0.9394),
    (85.0, 0.5722, 0.9761),
    (90.0, 0.5322, 1.0000),
]


def robinson(lon: float, lat: float) -> tuple[float, float]:
    a = min(abs(lat), 90.0)
    i = min(int(a // 5), len(ROBINSON) - 2)
    lo, lo_x, lo_y = ROBINSON[i]
    hi, hi_x, hi_y = ROBINSON[i + 1]
    t = 0.0 if hi == lo else (a - lo) / (hi - lo)
    px = lo_x + (hi_x - lo_x) * t
    py = lo_y + (hi_y - lo_y) * t
    x = 0.8487 * px * math.radians(lon)
    y = 1.3523 * py * (1 if lat >= 0 else -1)
    return x, -y  # SVG y grows downward


def rings(geom: dict) -> list[list[tuple[float, float]]]:
    if geom["type"] == "Polygon":
        polys = [geom["coordinates"]]
    elif geom["type"] == "MultiPolygon":
        polys = geom["coordinates"]
    else:
        return []
    # only outer rings: at 1:110m the holes are negligible and cost bytes
    return [p[0] for p in polys if p and len(p[0]) >= 4]


def area(ring: list[tuple[float, float]]) -> float:
    s = 0.0
    for i in range(len(ring)):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % len(ring)]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2


def centroid(ring: list[tuple[float, float]]) -> tuple[float, float]:
    cx = cy = s = 0.0
    for i in range(len(ring)):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % len(ring)]
        cross = x1 * y2 - x2 * y1
        s += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    if s == 0:
        return ring[0]
    return cx / (3 * s), cy / (3 * s)


def simplify(pts: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
    """Douglas-Peucker, iterative so a long coastline cannot exhaust the stack."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        lo, hi = stack.pop()
        if hi <= lo + 1:
            continue
        ax, ay = pts[lo]
        bx, by = pts[hi]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy)
        worst, at = -1.0, -1
        for i in range(lo + 1, hi):
            px, py = pts[i]
            if norm == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                d = abs(dy * px - dx * py + bx * ay - by * ax) / norm
            if d > worst:
                worst, at = d, i
        if worst > tol:
            keep[at] = True
            stack.append((lo, at))
            stack.append((at, hi))
    return [p for p, k in zip(pts, keep) if k]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tolerance", type=float, default=0.7, help="simplification, in viewBox units")
    ap.add_argument("--width", type=float, default=1000.0)
    ap.add_argument("--min-area", type=float, default=1.5, help="rings smaller than this are dropped")
    ap.add_argument("--decimals", type=int, default=0, help="coordinate precision in viewBox units")
    ap.add_argument(
        "--named-tolerance",
        type=float,
        default=0.4,
        help="finer simplification for the countries the reports name, which are what a reader looks at",
    )
    args = ap.parse_args()

    if not SRC.exists():
        SRC.parent.mkdir(parents=True, exist_ok=True)
        print(f"downloading {URL}")
        urllib.request.urlretrieve(URL, SRC)
    with open(SRC, encoding="utf-8") as f:
        world = json.load(f)

    # project everything first, so the viewBox is fitted to what is actually drawn
    projected: list[tuple[str, str, list[list[tuple[float, float]]]]] = []
    for feat in world["features"]:
        props = feat["properties"]
        code = props["ADM0_A3"]
        if code == "ATA":  # Antarctica
            continue
        rs = [[robinson(x, y) for x, y in ring] for ring in rings(feat["geometry"])]
        if rs:
            projected.append((code, props["NAME"], rs))

    xs = [x for _, _, rs in projected for r in rs for x, _ in r]
    ys = [y for _, _, rs in projected for r in rs for _, y in r]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    scale = args.width / (x1 - x0)
    height = round((y1 - y0) * scale, 1)

    def to_view(p: tuple[float, float]) -> tuple[float, float]:
        return (p[0] - x0) * scale, (p[1] - y0) * scale

    out: list[tuple[str, str, str]] = []
    marks: dict[str, tuple[float, float]] = {}
    kept_small: list[str] = []
    dropped = 0
    for code, name, rs in projected:
        named = code in NAMED
        # a named country keeps its small islands: Taiwan and South Korea are the whole point
        floor = 0.05 if named else args.min_area
        parts: list[str] = []
        biggest: tuple[float, list[tuple[float, float]]] | None = None
        for ring in rs:
            v = [to_view(p) for p in ring]
            a = area(v)
            if biggest is None or a > biggest[0]:
                biggest = (a, v)
            if a < floor:
                dropped += 1
                continue
            s = simplify(v, args.named_tolerance if named else args.tolerance)
            if len(s) < 3:
                s = v[:: max(1, len(v) // 8)]
            if len(s) < 3:
                continue
            # rounded to the precision the simplification already implies, and points that
            # collapse onto one another at that precision are dropped rather than repeated
            fmt = f"%.{args.decimals}f"
            pts: list[str] = []
            last = None
            for x, y in s:
                p = (fmt % x, fmt % y)
                if p != last:
                    pts.append(p[0] + " " + p[1])
                    last = p
            if len(pts) < 3:
                continue
            # the area floor is applied again to the rounded ring: a sliver that had area before
            # rounding can collapse to a one-pixel splinter after it, which reads as dirt on the map
            rounded = [(float(p.split(" ")[0]), float(p.split(" ")[1])) for p in pts]
            if area(rounded) < (0.4 if named else floor):
                dropped += 1
                continue
            parts.append("M" + " ".join(pts) + "Z")
        if not parts and biggest is not None:
            # no ring cleared the floor: a country is never dropped from the map altogether, so its
            # largest ring is kept whatever its size. At this width that keeps Luxembourg.
            fmt = f"%.{args.decimals}f"
            pts, last = [], None
            for x, y in simplify(biggest[1], args.named_tolerance):
                p = (fmt % x, fmt % y)
                if p != last:
                    pts.append(p[0] + " " + p[1])
                    last = p
            if len(pts) >= 3:
                parts.append("M" + " ".join(pts) + "Z")
                kept_small.append(code)
        if not parts:
            continue
        out.append((code, name, "".join(parts)))
        if named and biggest is not None:
            cx, cy = centroid(biggest[1])
            marks[code] = (round(cx, 1), round(cy, 1))

    out.sort(key=lambda r: r[0])
    missing = sorted(set(NAMED) - {c for c, _, _ in out})
    if missing:
        raise SystemExit(f"named countries missing from the source: {missing}")

    body = ",\n".join(f"  {{ c: '{c}', n: {json.dumps(n)}, d: '{d}' }}" for c, n, d in out)
    named_ts = ",\n".join(f"  {c}: {json.dumps(NAMED[c])}" for c in sorted(NAMED))
    marks_ts = ",\n".join(f"  {c}: [{marks[c][0]}, {marks[c][1]}]" for c in sorted(marks))
    text = f"""/* GENERATED by tools/make_world_paths.py — do not edit by hand.
 *
 * Country outlines for the geographic exposure map, projected once at build time so the page ships
 * no mapping library and makes no request at run time.
 *
 * Source:   Natural Earth, Admin 0 – Countries, 1:110m
 * Provider: natural-earth-vector (nvkelso), raw.githubusercontent.com
 * Licence:  public domain (Natural Earth terms of use)
 * Read:     {date.today().isoformat()}
 * Projection: Robinson. Not equal area and not conformal — the map locates the countries the
 *             report names; their shares are read from the table beside it, never from area.
 * Simplified with Douglas–Peucker at {args.tolerance} viewBox units and rounded to
 * {args.decimals} decimals; rings under {args.min_area}
 * square units are dropped, except for the countries the reports name, which keep their islands.
 * Antarctica is not included.
 */

export interface WorldShape {{
  /** Natural Earth ADM0_A3 */
  c: string;
  /** Natural Earth NAME, which is not always the name the report prints */
  n: string;
  /** SVG path data in the viewBox below */
  d: string;
}}

export const WORLD_VIEWBOX = '0 0 {args.width:.0f} {height}';

/** The country codes the reports name, with the name each report prints for them. */
export const WORLD_NAMED: Record<string, string> = {{
{named_ts},
}};

/** A point inside each named country, for marking the ones too small to see at this scale. */
export const WORLD_MARKS: Record<string, [number, number]> = {{
{marks_ts},
}};

export const WORLD_SHAPES: WorldShape[] = [
{body},
];
"""
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    kb = len(text.encode("utf-8")) / 1024
    print(f"{len(out)} countries, {dropped} small rings dropped")
    if kept_small:
        print(f"kept below the floor so no country is missing: {', '.join(sorted(kept_small))}")
    print(f"viewBox 0 0 {args.width:.0f} {height} · {kb:.0f} KB -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
