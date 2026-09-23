import { PERIODS, PERIOD_INDEX, type CioEntity, type CompositeKey } from '../fixtures/cioMonthly';
import { policyFor } from '../fixtures/policyPack';
import type { EntityId } from '../fixtures/published';
import { CATEGORY_KEYS, SERIES_KEYS, type Band, type SeriesKey } from './cioHistory';

/** One selection, followed across CIO Monthly's Performance, Positioning and Explore sub-tabs.
 *
 *  A category — the Total Fund or one composite — chosen on any of the three is carried in the
 *  address (`cat`) and followed on the others: the Performance tab shows its monthly return
 *  against its benchmark in every report, the Positioning tab its weight against the target and
 *  the IPS range, and Explore both. A period chosen in the Performance table is the second period
 *  of the attribution beside it (`attr`). Selection only ever chooses what is shown; it never
 *  filters a figure out of a total. */

/** A category from the address; anything else is the Total Fund. */
export function parseSeriesKey(raw: string): SeriesKey {
  return (SERIES_KEYS as readonly string[]).includes(raw) ? (raw as SeriesKey) : 'total';
}

/** IPS Table 1 functional categories, by the report's composite keys. */
const POLICY_CLASS: Record<CompositeKey, string> = {
  growth: 'GROWTH',
  credit: 'CREDIT',
  ra: 'RAIH',
  rrm: 'RRM',
};

const pctOf = (decimal: number) => Math.round(decimal * 1000) / 10;

/** The policy range of each category, % of the fund, from the fund's IPS (explicit min/max).
 *  The Composites table and the provenance drawer read the same ranges from the published IPS
 *  table (`ipsRange`); a test holds the two together. */
export function bandsFor(entity: EntityId): Partial<Record<CompositeKey, Band>> {
  const pack = policyFor(entity);
  const out: Partial<Record<CompositeKey, Band>> = {};
  for (const k of CATEGORY_KEYS) {
    const b = pack.bands.find((x) => x.classId === POLICY_CLASS[k] && x.parent === undefined);
    if (b) out[k] = { min: pctOf(b.min), max: pctOf(b.max) };
  }
  return out;
}

/** The composite furthest from its target this month — what Positioning shows until the reader
 *  chooses, because a weight history of the Total Fund (always 100%) would say nothing. Ties go
 *  to the report's own order. */
export function furthestFromTarget(e: CioEntity): CompositeKey {
  let best = e.comps[0]!;
  for (const c of e.comps) {
    if (Math.abs(c.pct - c.tgt) > Math.abs(best.pct - best.tgt)) best = c;
  }
  return best.k;
}

/** Periods that can be the attribution's second period: every period but FYTD, which the
 *  attribution always shows. */
export const ATTR_PERIODS: readonly number[] = PERIODS.map((_, i) => i).filter(
  (i) => i !== PERIOD_INDEX.fytd,
);
