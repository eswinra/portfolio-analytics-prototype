import { useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';

import { useInView } from '../lib/motion';

/** Shared chart interaction: draw-in on first view, a pointer/keyboard-driven active index with
 *  a tooltip, and clickable legend keys. Every chart that uses these also shows its numbers as
 *  text or in a table, so the tooltip is a convenience, never the only way to read a value. */

/** Wraps a chart so its bars grow and lines draw the first time it scrolls into view (CSS in
 *  styles.css, `.reveal`); under reduced motion the chart simply renders complete. */
export function Reveal({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref);
  return (
    <div
      ref={ref}
      className={`reveal${seen ? ' in' : ''}${className ? ` ${className}` : ''}`}
      style={style}
    >
      {children}
    </div>
  );
}

/** Active point of an indexed chart: set by the pointer, or by ←/→/Home/End while the chart has
 *  keyboard focus (one tab stop per chart). */
export function useActiveIndex(count: number) {
  const [active, setActive] = useState<number | null>(null);
  const keyProps = {
    tabIndex: 0,
    onFocus: () => setActive((a) => (a === null ? count - 1 : a)),
    onBlur: () => setActive(null),
    onKeyDown: (ev: KeyboardEvent) => {
      const last = count - 1;
      const cur = active ?? last;
      const next =
        ev.key === 'ArrowRight'
          ? Math.min(last, cur + 1)
          : ev.key === 'ArrowLeft'
            ? Math.max(0, cur - 1)
            : ev.key === 'Home'
              ? 0
              : ev.key === 'End'
                ? last
                : ev.key === 'Escape'
                  ? null
                  : undefined;
      if (next === undefined) return;
      ev.preventDefault();
      setActive(next);
    },
  };
  return { active, setActive, keyProps };
}

/** Tooltip positioned inside a `position: relative` chart wrapper. `left` is a CSS length (a
 *  percentage for fluid charts); the tip flips left of the point past the midline. */
export function ChartTip({
  left,
  top = 0,
  flip,
  children,
}: {
  left: string;
  top?: number | string;
  flip?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`chart-tip${flip ? ' flip' : ''}`}
      style={{ left, top }}
      role="status"
      aria-live="polite"
    >
      {children}
    </div>
  );
}

/** A legend key that shows or hides its series. */
export function LegendToggle({
  on,
  onToggle,
  swatch,
  children,
}: {
  on: boolean;
  onToggle: () => void;
  swatch: CSSProperties;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`legend-toggle${on ? '' : ' off'}`}
      aria-pressed={on}
      onClick={onToggle}
    >
      <span className="sw" style={swatch} aria-hidden="true" />
      {children}
    </button>
  );
}
