/**
 * The CIO report's key macro indicators, rebuilt from FRED for every report.
 *
 * The report prints PCE inflation, the federal funds target range and the unemployment and
 * participation rates on its macro pages (pp. 4 and 6, "Bloomberg, St. Louis Federal Reserve").
 * Those figures are public FRED series, so tools/fetch_cio_macro.py reads them for each report
 * as FRED showed them on the report's as-of date — FRED's real-time archive (ALFRED), not
 * today's revised values — and this module turns the raw levels into the lines the dashboard
 * and the slides show. The figures therefore match what the report could print, and exist for
 * every report rather than the latest only.
 */

/** One observation: its period (the first day of the month for monthly series) and value. */
export interface MacroObs {
  date: string;
  v: number;
}

/** A price index level with the same month a year earlier, for a year-over-year change. */
export type MacroIndex = MacroObs & { yearAgo: MacroObs };

/** What FRED showed for the report's indicators on the report's as-of date. Raw values only, as
 *  written by the fetch tool; every derived figure is computed here. */
export interface CioMacroVintage {
  /** the real-time date the values are read as of: the month end before the report's month */
  asOf: string;
  /** PCE price index (PCEPI), BEA */
  pce: MacroIndex;
  /** PCE excluding food and energy (PCEPILFE), BEA */
  corePce: MacroIndex;
  /** unemployment rate (UNRATE), BLS, % */
  unemployment: MacroObs;
  /** labor force participation rate (CIVPART), BLS, % */
  participation: MacroObs;
  /** federal funds target range (DFEDTARL / DFEDTARU), %, and the day it took effect — null
   *  when it was already in effect at the start of the window the tool reads */
  fed: { low: number; high: number; since: string | null };
  /** Treasury constant maturity yields (DGS3MO … DGS30), %, each as last published on `asOf` */
  curve: Record<CurveKey, MacroObs>;
}

export const CURVE_KEYS = ['m3', 'y2', 'y5', 'y10', 'y30'] as const;
export type CurveKey = (typeof CURVE_KEYS)[number];
export const CURVE_LABELS: Record<CurveKey, string> = {
  m3: '3M',
  y2: '2Y',
  y5: '5Y',
  y10: '10Y',
  y30: '30Y',
};

/** One indicator as the strip shows it: label, value, and the detail line with its source. */
export interface MacroLine {
  l: string;
  v: string;
  s: string;
}

/** Commentary the report prints beside a figure, with its page; the latest report only. */
export interface MacroNotes {
  pce?: string;
  fed?: string;
  labor?: string;
  curve?: string;
}

/** The month end before the report's month — the date the report's macro page reads as of
 *  ('2026-08-12' → '2026-07-31'). Covers that name only the month ('2025-07') work the same. */
export function macroAsOf(reportDate: string): string {
  const y = Number(reportDate.slice(0, 4));
  const m = Number(reportDate.slice(5, 7));
  // day 0 of the report's month is the last day of the month before it
  return new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
}

/** Year-over-year change of a price index, in percent. */
export function yoy(x: MacroIndex): number {
  return (x.v / x.yearAgo.v - 1) * 100;
}

const at = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
const MONTH = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
/** 'June 2026' for an observation dated '2026-06-01'. */
export const macroMonth = (iso: string): string => MONTH.format(at(iso));
const macroDay = (iso: string): string => DAY.format(at(iso));

const withNote = (text: string, note: string | undefined) => (note ? `${text}. ${note}` : text);

/** The three FRED-backed lines, in the order the report prints them. */
export function macroLines(m: CioMacroVintage, notes: MacroNotes = {}): MacroLine[] {
  const laborMonth =
    m.unemployment.date === m.participation.date
      ? macroMonth(m.unemployment.date)
      : `${macroMonth(m.unemployment.date)} / ${macroMonth(m.participation.date)}`;
  const since = m.fed.since
    ? `In effect since ${macroDay(m.fed.since)}`
    : 'In effect six years or more';
  return [
    {
      l: `PCE inflation, ${macroMonth(m.pce.date)}`,
      v: `${yoy(m.pce).toFixed(1)}% y/y`,
      s: withNote(`Core ${yoy(m.corePce).toFixed(1)}% (FRED · BEA)`, notes.pce),
    },
    {
      l: 'Federal funds target range',
      v: `${m.fed.low.toFixed(2)}–${m.fed.high.toFixed(2)}%`,
      s: withNote(`${since} (FRED · Federal Reserve)`, notes.fed),
    },
    {
      l: `Unemployment and participation, ${laborMonth}`,
      v: `${m.unemployment.v.toFixed(1)}% · ${m.participation.v.toFixed(1)}%`,
      s: withNote('Unemployment rate · labor force participation rate (FRED · BLS)', notes.labor),
    },
    {
      l: `Treasury yields, ${macroDay(m.curve.y10.date)}`,
      v: CURVE_KEYS.map((k) => m.curve[k].v.toFixed(1)).join(' · ') + '%',
      s: withNote(
        `${CURVE_KEYS.map((k) => CURVE_LABELS[k]).join(' · ')} constant maturity (FRED · Federal Reserve)`,
        notes.curve,
      ),
    },
  ];
}
