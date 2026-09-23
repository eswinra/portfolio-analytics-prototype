/** The site's views and sub-tabs, in one place: the shell's navigation, the views' sub-tab bars
 *  and the saved-view names (lib/savedViews.ts) all read them, so a renamed tab cannot leave a
 *  saved view describing a tab that no longer exists. Plain data; no React. */

export type ViewEntry = [path: string, label: string, bandTitle: string];

/** Dashboard mode — the published-figures presentation layer (2025 PAFR/ACFR, IPS, CIO Monthly). */
export const DASHBOARD_VIEWS: ViewEntry[] = [
  ['/', 'Overview', 'Total fund overview'],
  ['/exceptions', 'Exceptions', 'Exception Center'],
  ['/performance', 'Performance', 'Performance vs policy benchmark'],
  ['/allocation', 'Allocation', 'Asset allocation vs policy'],
  ['/funded', 'Funded Status', 'Funded status and membership'],
  ['/risk', 'Policy Monitoring', 'Policy monitoring'],
  ['/holdings', 'Holdings & Fees', 'Holdings & fees'],
  ['/cio', 'CIO Monthly', 'CIO Monthly Report'],
  ['/macro', 'Economy', 'Economic context'],
];

/** Workstation mode — where the work is populated: the synthetic contract-data pipeline
 *  (Data/Import, Reconciliation, Data quality) and the ACFR production tracker. In the internal
 *  version the dashboard consumes what the workstation publishes; on this public prototype the
 *  dashboard quotes published documents while the workstation demonstrates the pipeline. */
export const WORKSTATION_VIEWS: ViewEntry[] = [
  // a month's CIO template file straight through to the slides (public example included)
  ['/run', 'Monthly run', 'Monthly run'],
  ['/import', 'Data', 'Import a dataset'],
  ['/recon', 'Reconciliation', 'Reconciliation'],
  ['/data-quality', 'Data quality', 'Data quality'],
  ['/acfr', 'ACFR Workflow', 'ACFR reporting workflow'],
];

/** CIO Monthly sub-tabs: the report's slides first — opening the tab shows the deck inside the
 *  dashboard — then a one-screen summary and the detail, one click each. */
export const CIO_TABS: [key: string, label: string][] = [
  ['slides', 'Slides'],
  ['summary', 'Summary'],
  ['performance', 'Performance'],
  ['positioning', 'Positioning'],
  ['markets', 'Markets & items'],
  ['explore', 'Explore'],
  ['compare', 'Compare'],
];

/** Economy sub-tabs. */
export const MACRO_TABS: [key: string, label: string][] = [
  ['summary', 'Summary'],
  ['factors', 'Factors & lens'],
  ['indicators', 'Indicators'],
  ['sources', 'Sources & method'],
];
