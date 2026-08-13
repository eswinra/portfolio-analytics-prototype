import type { ReactNode } from 'react';

import { CONFIG } from '../config';

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

/** Per-panel source citation, gated by CONFIG.showSources. */
export function SourceLine({ children }: { children: ReactNode }) {
  if (!CONFIG.showSources) return null;
  return <div className="source-line">Source: {children}</div>;
}

export function Panel({
  kicker,
  title,
  sub,
  tight,
  className,
  children,
}: {
  kicker?: ReactNode;
  title?: ReactNode;
  sub?: ReactNode;
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
