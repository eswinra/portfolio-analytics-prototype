/** Shape of the generated FRED snapshot (app/src/fixtures/macroSnapshot.data.ts). */

export type MacroGroup =
  'inflation' | 'labor' | 'rates' | 'credit' | 'commodities' | 'dollar' | 'growth';

export interface MacroSeriesRaw {
  id: string;
  group: MacroGroup;
  short: string;
  title: string;
  /** original provider; FRED redistributes it */
  provider: string;
  units: string;
  unitsShort: string;
  /** native frequency: D, W, M */
  frequency: string;
  seasonal: string;
  lastUpdated: string;
  /** monthly averages of the native series, oldest first; null = no observation that month */
  monthly: { start: string; values: (number | null)[] };
  /** native daily/weekly observations for the last ~400 days (D and W series only) */
  recent?: [date: string, value: number | null][];
  /** latest native observation (monthly series only) */
  latest?: [date: string, value: number | null] | null;
}

export interface MacroSnapshot {
  retrieved: string;
  provider: string;
  termsCheckedOn: string;
  series: Record<string, MacroSeriesRaw>;
  excluded: { id: string; title: string; reason: string }[];
}
