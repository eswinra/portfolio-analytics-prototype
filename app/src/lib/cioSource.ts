import { longDate, type CioVintage } from '../fixtures/cioMonthly';
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
