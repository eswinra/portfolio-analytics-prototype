import { CIO_MACRO_SERIES } from '../fixtures/cioMacro.data';
import { CIO_MACRO, longDate, type CioVintage } from '../fixtures/cioMonthly';
import type { SourceRecord } from '../fixtures/sources';

/** Source records for one report's pages, built per vintage — the fixed registry in
 *  fixtures/sources.ts holds documents that do not change with the report on screen.
 *
 *  Shared by every CIO view so they cite the same pages: the Compare view's first draft
 *  hardcoded the Pension Fund's pages, which would have cited the wrong pages for the OPEB
 *  Master Trust. */

/** Source record for one report's pages, built per vintage (the registry holds fixed documents). */
export function cioSource(v: CioVintage, pages: string, firstPage: number | null): SourceRecord {
  if (v.origin === 'file') {
    return {
      id: `CIO_FILE_${v.file}`,
      label: `template file ${v.file} (not published)`,
      doc: 'CIO Monthly template file, read in this browser',
      pageTable: 'as entered in the template',
      asOf: longDate(v.dataThrough),
    };
  }
  const url = v.url && firstPage ? `${v.url}#page=${firstPage}` : null;
  const isFeed = v.url === null && v.pages.flows === 0;
  return {
    id: `CIO_${v.dataThrough}_${pages}`,
    label: isFeed
      ? `imported dataset ${v.file} (${pages})`
      : `CIO Monthly Report (${v.reportLabel}), ${pages}`,
    doc: isFeed
      ? 'Workstation dataset — schema 1.4 cio_monthly rows'
      : 'Chief Investment Officer Monthly Report',
    pageTable: pages,
    asOf: longDate(v.dataThrough),
    ...(url ? { url } : {}),
  };
}

/** The summary and geography pages for one fund in one report. */
export function entityPages(v: CioVintage, key: 'pension' | 'opeb') {
  const [summary, table, hist, geo] = v.pages[key];
  const last = Math.max(table, hist);
  return {
    main: cioSource(v, summary === last ? `p. ${summary}` : `pp. ${summary}–${last}`, summary),
    geo: cioSource(v, `p. ${geo}`, geo),
  };
}

/** Source record for the macro strip's FRED figures, read as of the report's as-of date. */
export function fredMacroSource(v: CioVintage): SourceRecord | null {
  const m = CIO_MACRO[v.reportDate];
  if (!m) return null;
  return {
    id: `FRED_CIO_${m.asOf}`,
    label: `FRED, as known on ${longDate(m.asOf)}`,
    doc: 'Federal Reserve Economic Data, real-time archive (ALFRED): PCEPI, PCEPILFE (BEA); UNRATE, CIVPART (BLS); DFEDTARL, DFEDTARU (Federal Reserve)',
    pageTable: 'observations as FRED showed them on the date given',
    asOf: longDate(m.asOf),
    url: 'https://alfred.stlouisfed.org/',
  };
}

/** Source record for named FRED series as FRED showed them on one date, linked to the first
 *  series' page in the real-time archive — for one figure's provenance record. */
export function fredSeriesSource(ids: string[], asOf: string): SourceRecord {
  const series = ids.map((id) => CIO_MACRO_SERIES.find((s) => s.id === id));
  const providers = [...new Set(series.map((s) => s?.provider ?? 'FRED'))];
  return {
    id: `FRED_${ids.join('_')}_${asOf}`,
    label: `FRED ${ids.join(', ')}, as known on ${longDate(asOf)}`,
    doc: `Federal Reserve Economic Data, real-time archive (ALFRED): ${series
      .map((s, i) => s?.title ?? ids[i])
      .join('; ')} (${providers.join('; ')})`,
    pageTable: 'observations as FRED showed them on the date given',
    asOf: longDate(asOf),
    url: `https://alfred.stlouisfed.org/series?seid=${ids[0] ?? ''}`,
  };
}
