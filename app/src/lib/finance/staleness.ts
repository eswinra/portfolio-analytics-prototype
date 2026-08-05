/** Data-state derivation: stale/missing overlays (docs/data-dictionary.md). */

export type DataState = 'current' | 'stale' | 'missing';

/** Staleness thresholds in calendar days by declared frequency. */
export const STALE_DAYS: Record<string, number> = {
  Daily: 3, // Friday close viewed Monday (3 days) is current; anything older is stale
  Monthly: 45,
  Quarterly: 135,
  Annual: 450,
  'Ad Hoc': Number.POSITIVE_INFINITY,
};

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86400000);
}

/**
 * Derive the data state of a record relative to the dataset's reference date
 * (usually the dataset as-of). Missing wins over stale.
 */
export function dataState(
  valueMissing: boolean,
  recordAsOf: string,
  referenceDate: string,
  frequency: string,
): DataState {
  if (valueMissing) return 'missing';
  const limit = STALE_DAYS[frequency] ?? Number.POSITIVE_INFINITY;
  return daysBetween(recordAsOf, referenceDate) > limit ? 'stale' : 'current';
}
