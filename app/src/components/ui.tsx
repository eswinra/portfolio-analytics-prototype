import type { ReactNode } from 'react';

import { CATEGORY_LABELS } from '../lib/contract/schema';

/** Small shared presentational pieces. Status is always icon + text + color, never color alone. */

export function fmtPct(v: number | null | undefined, dp = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(dp)}%`;
}

/**
 * Small-return formatter: "Flat" under half a bp (kills the −0.00% artifact), whole basis
 * points below 10 bp, signed percent above. For daily proxy impacts and excess figures.
 */
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

export function ClassBadge({ c }: { c: string }) {
  return <span className={`badge ${c}`}>{c.replace('_', ' ')}</span>;
}

type PillTone = 'good' | 'warn' | 'bad' | 'neutral';

const PILL_ICON: Record<PillTone, string> = {
  good: '✓',
  warn: '△',
  bad: '✕',
  neutral: '·',
};

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span className={`pill ${tone}`}>
      <span aria-hidden="true">{PILL_ICON[tone]}</span>
      {children}
    </span>
  );
}

export function statusTone(status: string): PillTone {
  switch (status) {
    case 'PASS':
    case 'Complete':
    case 'within':
    case 'current':
      return 'good';
    case 'WARN':
    case 'In Progress':
    case 'Ready for Review':
    case 'stale':
      return 'warn';
    case 'FAIL':
    case 'Blocked':
    case 'out':
    case 'missing':
      return 'bad';
    default:
      return 'neutral';
  }
}

export function SignedPct({ v }: { v: number | null }) {
  if (v === null) return <span>—</span>;
  const cls = v > 0 ? 'pos' : v < 0 ? 'neg' : '';
  const sign = v > 0 ? '+' : '';
  return (
    <span className={cls}>
      {sign}
      {fmtPct(v)}
    </span>
  );
}

export function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
      {note ? <p className="panel-note">{note}</p> : null}
    </section>
  );
}
