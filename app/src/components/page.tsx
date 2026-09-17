import { useMemo, type ReactNode } from 'react';

import { CONFIG } from '../config';
import type { SourceRecord } from '../fixtures/sources';
import { PageMetaContext, type Classification } from './pageMeta';
import { CLASS_DEFINITIONS } from './ui';

/** Page-level statements, made once instead of beside every panel: the date and vintage line,
 *  the classification that applies unless a figure is marked otherwise, and the sources that
 *  cover the whole page. Panels inside `PageMeta` show only what differs from these. */

const classLabel = (c: string) => c.replace('_', ' ');

export function PageMeta({
  classification,
  sources = [],
  children,
}: {
  classification: Classification;
  sources?: SourceRecord[];
  children: ReactNode;
}) {
  const ids = sources.map((s) => s.id).join('|');
  const value = useMemo(
    () => ({ defaultClass: classification, defaultSourceIds: ids ? ids.split('|') : [] }),
    [classification, ids],
  );
  return <PageMetaContext.Provider value={value}>{children}</PageMetaContext.Provider>;
}

/** One line under the tabs: what these figures are, which vintage, and how they are classified.
 *  The detail — dates kept apart, caveats, the full classification legend — opens on demand. */
export function AboutFigures({
  summary,
  classification,
  alsoUsed = [],
  children,
}: {
  summary: ReactNode;
  classification: Classification;
  /** other classifications that appear on the page, marked where they occur */
  alsoUsed?: Classification[];
  children?: ReactNode;
}) {
  return (
    <details className="about-figures">
      <summary>
        <span className="about-label">About these figures</span>
        <span className="about-summary">
          {summary} · <span className="about-class">{classLabel(classification)}</span> unless
          marked
        </span>
      </summary>
      <div className="about-body">
        {children}
        <dl className="about-legend">
          <div>
            <dt>{classLabel(classification)} (unmarked figures)</dt>
            <dd>{CLASS_DEFINITIONS[classification]}</dd>
          </div>
          {alsoUsed.map((c) => (
            <div key={c}>
              <dt>{classLabel(c)} (marked where used)</dt>
              <dd>{CLASS_DEFINITIONS[c]}</dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}

/** Sources that apply to the whole page, listed once at its foot. */
export function PageSources({ sources }: { sources: SourceRecord[] }) {
  if (!CONFIG.showSources || sources.length === 0) return null;
  return (
    <footer className="page-sources">
      <span className="page-sources-label">Sources for this page</span>
      {sources.map((s, i) => (
        <span key={s.id}>
          {i > 0 ? ' · ' : ''}
          {s.url ? (
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.label}
            </a>
          ) : (
            <span title={`${s.doc} — ${s.pageTable} (as of ${s.asOf})`}>{s.label}</span>
          )}
        </span>
      ))}
    </footer>
  );
}
