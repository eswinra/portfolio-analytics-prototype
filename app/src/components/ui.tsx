import { Children, Fragment, isValidElement, type ReactNode } from 'react';

import { CONFIG } from '../config';
import { PanelMenu } from './PanelMenu';
import { usePageMeta } from './pageMeta';
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

/** Per-panel source citation from the source registry, gated by CONFIG.showSources. It renders
 *  as a small "Source" chip that opens the full citation, so a page is not lined with repeated
 *  fine print. Sources the page lists once at its foot (`PageMeta`) are left out here, and a
 *  panel whose only source is page-wide shows no chip. Registry entries with a stable public URL
 *  render as links; the rest render as document + page text (no fabricated links). */
export function SourceLine({
  sources,
  records,
  children,
}: {
  sources?: SourceId[];
  /** source records built at render time (e.g. one per CIO Monthly vintage) */
  records?: SourceRecord[];
  children?: ReactNode;
}) {
  const { defaultSourceIds } = usePageMeta();
  if (!CONFIG.showSources) return null;
  const list: SourceRecord[] = [
    ...(sources ?? []).map((id) => SOURCES[id]),
    ...(records ?? []),
  ].filter((s) => !defaultSourceIds.includes(s.id));
  if (list.length === 0 && children === undefined) return null;
  const name = list.length
    ? `Source: ${list.map((s) => s.label).join('; ')}`
    : 'Source for this panel';
  return (
    <details className="src-chip">
      <summary aria-label={name} title={list.map((s) => s.label).join(' · ')}>
        Source{list.length > 1 ? ` (${list.length})` : ''}
      </summary>
      <div className="src-pop">
        {list.length > 0
          ? list.map((s) => (
              <div key={s.id} className="src-item">
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.label}
                  </a>
                ) : (
                  <strong>{s.label}</strong>
                )}
                <span>
                  {s.doc} — {s.pageTable} · as of {s.asOf}
                </span>
              </div>
            ))
          : children}
      </div>
    </details>
  );
}

/** Components that belong in a panel's footer row (citation chips, slide links) rather than in
 *  its body; `Panel` gathers them into one line with the method toggle. */
export const PANEL_FOOT = Symbol('panelFoot');
type FootMarked = { [PANEL_FOOT]?: true };
const isFoot = (node: ReactNode) =>
  isValidElement(node) &&
  typeof node.type === 'function' &&
  (node.type as unknown as FootMarked)[PANEL_FOOT] === true;

(SourceLine as unknown as FootMarked)[PANEL_FOOT] = true;

export function Panel({
  id,
  kicker,
  title,
  sub,
  note,
  method,
  tight,
  className,
  children,
}: {
  /** anchor for in-page jump links and "copy link to this panel" */
  id?: string;
  kicker?: ReactNode;
  title?: ReactNode;
  sub?: ReactNode;
  /** one visible takeaway sentence under the content */
  note?: ReactNode;
  /** how the figures are calculated and their caveats — collapsed until asked for */
  method?: ReactNode;
  tight?: boolean;
  className?: string;
  children: ReactNode;
}) {
  // header: a titled panel shows the title and at most one muted line (label · subtitle);
  // an untitled tile keeps its label on top
  const meta = [kicker, sub].filter((m) => m !== undefined && m !== null && m !== '');
  const all = Children.toArray(children);
  const foot = all.filter(isFoot);
  const body = all.filter((c) => !isFoot(c));
  return (
    <section
      id={id}
      className={`panel${tight ? ' panel-tight' : ''}${className ? ` ${className}` : ''}`}
    >
      {title === undefined ? (
        kicker !== undefined ? (
          <Kicker>{kicker}</Kicker>
        ) : null
      ) : (
        <div className="panel-head">
          {sub === undefined && kicker !== undefined ? <Kicker>{kicker}</Kicker> : null}
          <h2>{title}</h2>
          {sub !== undefined ? (
            <div className="panel-meta">
              {meta.map((m, i) => (
                <Fragment key={i}>
                  {i > 0 ? ' · ' : ''}
                  {m}
                </Fragment>
              ))}
            </div>
          ) : null}
        </div>
      )}
      {body}
      {note !== undefined ? <p className="panel-note">{note}</p> : null}
      {foot.length > 0 || method !== undefined ? (
        <div className="panel-foot">
          {foot}
          {method !== undefined ? (
            <details className="method">
              <summary>How this is calculated</summary>
              <div className="method-body">{method}</div>
            </details>
          ) : null}
        </div>
      ) : null}
      {tight ? null : <PanelMenu panelId={id} />}
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

/** What each classification promises — shown as a tooltip wherever a badge appears. */
export const CLASS_DEFINITIONS: Record<string, string> = {
  reported_public: 'Reproduced from a cited public document for the exact stated period.',
  synthetic: 'Generated demonstration data; not a real figure.',
  proxy_estimate: 'An estimate built from proxies; not a reported or official figure.',
  calculated: 'Derived from the figures shown, by the formula stated beside it.',
  stale: 'Older than the freshness threshold for its frequency.',
  missing: 'Not present in the data for the stated period.',
};

/** Classification badge. Inside a page that states a default classification, a figure with that
 *  classification is covered by the page statement and shows no badge; anything else is marked. */
export function ClassBadge({ c, always }: { c: string; always?: boolean }) {
  const { defaultClass } = usePageMeta();
  if (!always && defaultClass === c) return null;
  const def = CLASS_DEFINITIONS[c];
  const label = c.replace('_', ' ');
  return <Tag variant="neutral">{def ? <abbr title={def}>{label}</abbr> : label}</Tag>;
}

/** Signed change against a stated comparison — direction as a glyph AND a sign, never colour
 *  alone. `up` says which direction is drawn as an increase; nothing here judges good or bad. */
export function ChangeChip({
  delta,
  unit,
  dp = 1,
  title,
}: {
  delta: number | null | undefined;
  unit: string;
  dp?: number;
  title?: string;
}) {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return null;
  const flat = Math.abs(delta) < Math.pow(10, -dp) / 2;
  const glyph = flat ? '=' : delta > 0 ? '▲' : '▼';
  const text = `${flat ? '' : delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(dp)} ${unit}`;
  return (
    <span className={`chip-change${flat ? '' : delta > 0 ? ' up' : ' down'}`} title={title}>
      <span aria-hidden="true">{glyph}</span> {text}
    </span>
  );
}
