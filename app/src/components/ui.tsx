import type { ReactNode } from 'react';

import { CONFIG } from '../config';
import { SOURCES, type SourceId, type SourceRecord } from '../fixtures/sources';
import { CATEGORY_LABELS } from '../lib/contract/schema';

/** Shared presentational pieces for the LACERA design system (design handoff):
 *  square-cornered panels, kickers, status tags, source citations. */

export type TagVariant = 'accent' | 'neutral' | 'outline' | 'blocked';

export function Tag({
  variant,
  big,
  children,
}: {
  variant: TagVariant;
  big?: boolean;
  children: ReactNode;
}) {
  return <span className={`tag tag-${variant}${big ? ' tag-big' : ''}`}>{children}</span>;
}

export function Kicker({ children }: { children: ReactNode }) {
  return <div className="kicker">{children}</div>;
}

/** Per-panel source citation from the source registry, gated by CONFIG.showSources.
 *  Registry entries with a stable public URL render as links; the rest render as
 *  document + page text (no fabricated links). */
export function SourceLine({ sources, children }: { sources?: SourceId[]; children?: ReactNode }) {
  if (!CONFIG.showSources) return null;
  return (
    <div className="source-line">
      Source:{' '}
      {sources
        ? sources.map((id, i) => {
            const s: SourceRecord = SOURCES[id];
            return (
              <span key={id}>
                {i > 0 ? ' · ' : ''}
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.label}
                  </a>
                ) : (
                  <span title={`${s.doc} — ${s.pageTable} (as of ${s.asOf})`}>{s.label}</span>
                )}
              </span>
            );
          })
        : children}
    </div>
  );
}

export function Panel({
  kicker,
  title,
  sub,
  note,
  tight,
  className,
  children,
}: {
  kicker?: ReactNode;
  title?: ReactNode;
  sub?: ReactNode;
  note?: ReactNode;
  tight?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`panel${tight ? ' panel-tight' : ''}${className ? ` ${className}` : ''}`}>
      {kicker !== undefined ? <Kicker>{kicker}</Kicker> : null}
      {title !== undefined ? <h2 className={sub !== undefined ? 'snug' : ''}>{title}</h2> : null}
      {sub !== undefined ? <div className="panel-sub">{sub}</div> : null}
      {children}
      {note !== undefined ? <p className="panel-note">{note}</p> : null}
    </section>
  );
}

/** Absolute value with US thousands separators. */
export function n(v: number): string {
  return Math.abs(v).toLocaleString('en-US');
}

/** Accounting format: negatives in parentheses. */
export function money(v: number): string {
  return v < 0 ? `(${n(v)})` : n(v);
}

/** Excess-return tag content + variant: +x.x pp / −x.x pp / Met benchmark. */
export function excessTag(fund: number, bench: number): { text: string; variant: TagVariant } {
  const x = +(fund - bench).toFixed(1);
  if (x === 0) return { text: 'Met benchmark', variant: 'neutral' };
  return {
    text: `${x > 0 ? '+' : '−'}${Math.abs(x).toFixed(1)} pp`,
    variant: x > 0 ? 'accent' : 'outline',
  };
}

/* ---- workflow-demo compatibility (synthetic contract views) ------------------------- */

export function fmtPct(v: number | null | undefined, dp = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(dp)}%`;
}

/** "Flat" under half a bp, whole basis points below 25 bp, signed percent above. */
export function fmtSmartReturn(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const bp = v * 10000;
  if (Math.abs(bp) < 0.5) return 'Flat';
  if (Math.abs(bp) < 25) return `${bp > 0 ? '+' : '−'}${Math.round(Math.abs(bp))} bp`;
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(2)}%`;
}

export function fmtMm(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}

export function catLabel(id: string): string {
  return CATEGORY_LABELS[id] ?? id;
}

export type PillTone = 'good' | 'warn' | 'bad' | 'neutral';

const TONE_TO_VARIANT: Record<PillTone, TagVariant> = {
  good: 'accent',
  warn: 'outline',
  bad: 'blocked',
  neutral: 'neutral',
};

/** Status pill from the workflow views, rendered in the design system's tag language. */
export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return <Tag variant={TONE_TO_VARIANT[tone]}>{children}</Tag>;
}

export function statusTone(status: string): PillTone {
  switch (status) {
    case 'PASS':
    case 'within':
    case 'current':
      return 'good';
    case 'WARN':
    case 'stale':
      return 'warn';
    case 'FAIL':
    case 'out':
    case 'missing':
      return 'bad';
    default:
      return 'neutral';
  }
}

export function ClassBadge({ c }: { c: string }) {
  return <Tag variant="neutral">{c.replace('_', ' ')}</Tag>;
}
