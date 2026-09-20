import {
  WORLD_MARKS,
  WORLD_NAMED,
  WORLD_SHAPES,
  WORLD_VIEWBOX,
  type WorldShape,
} from '../fixtures/worldMap.data';

/** The geographic exposure map: which country a report's printed name refers to, which class a
 *  share falls in, and where the rank badges sit once they have been pushed off one another.
 *
 *  All of it is pure and tested. The deck at public/deck/index.html is a self-contained file and
 *  cannot import this, so it carries its own copy of the same rules; the unit tests check the two
 *  agree on the things that would show — the class breaks and their labels. */

/** Class breaks, in percent of AUM. A continuous ramp is wrong for this data: the shares run from
 *  about 76% down to 0.4%, so a linear scale paints one country black and nine of them the same
 *  near-white. The breaks are printed in the legend, so a shade is never left to be guessed. */
export const SHARE_BREAKS = [1, 2, 10] as const;

export const BREAK_LABELS = ['under 1%', '1–2%', '2–10%', '10% and over'] as const;

/** 0–3: which class a share falls in. */
export function shareBand(share: number): number {
  return SHARE_BREAKS.filter((b) => share >= b).length;
}

const CODE_FOR_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(WORLD_NAMED).map(([code, name]) => [name, code]),
);

/** The country code for a name as the report prints it, or null when the map has no outline for
 *  it. Null is a real answer, not a failure: a report can name a country the 1:110m source does
 *  not carry, and the caller says so on the page rather than dropping it silently. */
export function codeForCountry(name: string): string | null {
  return CODE_FOR_NAME[name] ?? null;
}

export interface Badge {
  code: string;
  /** rank in the report's list, 1-based — the same number the table shows */
  rank: number;
  name: string;
  share: number;
  group: 'dm' | 'em';
  x: number;
  y: number;
}

export interface MapModel {
  viewBox: string;
  shapes: (WorldShape & { band: number | null; group: 'dm' | 'em' | null })[];
  badges: Badge[];
  /** names the report printed that the map has no outline for */
  unplaced: string[];
}

const BADGE_R = 9;

/** Pushes overlapping badges apart along the line between them, then clamps them into the frame.
 *  Japan, South Korea and Taiwan sit within a badge's width of one another at this scale, so
 *  without this the three of them read as one. Bounded passes, so no arrangement can hang it. */
export function spreadBadges<T extends { x: number; y: number }>(
  points: T[],
  r = BADGE_R,
  frame?: { w: number; h: number },
): T[] {
  const out = points.map((p) => ({ ...p }));
  const want = r * 2 + 1.5;
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i]!;
        const b = out[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= want) continue;
        if (d === 0) {
          dx = 1;
          dy = 0;
          d = 1;
        }
        const push = (want - d) / 2;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  if (frame) {
    for (const p of out) {
      p.x = Math.min(frame.w - r, Math.max(r, p.x));
      p.y = Math.min(frame.h - r, Math.max(r, p.y));
    }
  }
  return out.map((p) => ({ ...p, x: round(p.x), y: round(p.y) }));
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** The whole map for one report's country list: every outline with the class it falls in (null
 *  where the report does not name it, which is missing and not zero), and the rank badges. */
export function mapModel(top: readonly (readonly [string, number, 'dm' | 'em'])[]): MapModel {
  const named = new Map<
    string,
    { rank: number; name: string; share: number; group: 'dm' | 'em' }
  >();
  const unplaced: string[] = [];
  top.forEach(([name, share, group], i) => {
    const code = codeForCountry(name);
    if (code) named.set(code, { rank: i + 1, name, share, group });
    else unplaced.push(name);
  });

  const [, , w, h] = WORLD_VIEWBOX.split(' ').map(Number) as [number, number, number, number];
  const placed = [...named.entries()]
    .filter(([code]) => WORLD_MARKS[code])
    .map(([code, hit]) => ({
      code,
      rank: hit.rank,
      name: hit.name,
      share: hit.share,
      group: hit.group,
      x: WORLD_MARKS[code]![0],
      y: WORLD_MARKS[code]![1],
    }));

  return {
    viewBox: WORLD_VIEWBOX,
    shapes: WORLD_SHAPES.map((s) => {
      const hit = named.get(s.c);
      return { ...s, band: hit ? shareBand(hit.share) : null, group: hit ? hit.group : null };
    }),
    badges: spreadBadges(placed, BADGE_R, { w, h }),
    unplaced,
  };
}

/** The text a screen reader is given in place of the map, and the caption under it. Both say the
 *  same thing the page says: the report names ten countries and the rest are not broken out. */
export function mapAltText(model: MapModel, fund: string): string {
  const named = model.badges
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((b) => `${b.name} ${b.share.toFixed(1)}%`)
    .join(', ');
  const rest = model.shapes.length - model.badges.length;
  return (
    `World map of ${fund} exposure by country of domicile. ${named}. ` +
    `The other ${rest} countries drawn are not broken out in the report, which is missing rather ` +
    `than zero. The same figures are in the table below.`
  );
}

export { BADGE_R, WORLD_VIEWBOX };
