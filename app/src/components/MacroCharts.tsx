import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { ChartTip, Reveal, useActiveIndex } from './ChartKit';
import { useTween } from '../lib/motion';

/** Charts for the Economic Context tab, drawn as plain SVG like the rest of the site: no chart
 *  library, gaps where a value is missing, and a text or table equivalent beside every chart so
 *  the figure can be read without the picture. Hover or the arrow keys read a point; the history
 *  chart zooms to a dragged range; lines move to new values instead of jumping. */

const MINUS = '−';

/** Signed number with a true minus sign; values that round to zero carry no sign. */
export function signed(x: number, dp: number): string {
  const r = Math.abs(x) < Math.pow(10, -dp) / 2 ? 0 : x;
  return `${r > 0 ? '+' : r < 0 ? MINUS : ''}${Math.abs(r).toFixed(dp)}`;
}

/** Number with a true minus sign and no plus sign. */
export function num(x: number, dp: number): string {
  const r = Math.abs(x) < Math.pow(10, -dp) / 2 ? 0 : x;
  return `${r < 0 ? MINUS : ''}${Math.abs(r).toLocaleString('en-US', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })}`;
}

/** Diverging bar for a z-score; decorative — the number is printed beside it. Its width moves
 *  when the value changes (CSS transition), so a scenario or a fund switch is visible. */
export function ZBar({ z, max = 2.5 }: { z: number | null; max?: number }) {
  if (z === null) return null;
  const w = (Math.min(Math.abs(z), max) / max) * 50;
  return (
    <span className="zbar" aria-hidden="true">
      <span className="zbar-mid" />
      <span
        className={`zbar-fill ${z >= 0 ? 'pos' : 'neg'}`}
        style={{ left: z >= 0 ? '50%' : `${50 - w}%`, width: `${w}%` }}
      />
    </span>
  );
}

function linePath(
  values: (number | null)[],
  x: (i: number) => number,
  y: (v: number) => number,
): string {
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) {
      pen = false;
      return;
    }
    d += `${pen ? ' L' : ' M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
    pen = true;
  });
  return d.trim();
}

/** Five-year line, decorative (the table row carries the numbers). */
export function MiniSpark({ values, zeroLine }: { values: (number | null)[]; zeroLine?: boolean }) {
  const W = 120;
  const H = 28;
  const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (present.length < 2) return null;
  let lo = Math.min(...present);
  let hi = Math.max(...present);
  if (zeroLine) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  const span = hi - lo || 1;
  const x = (i: number) => 2 + (i * (W - 4)) / Math.max(values.length - 1, 1);
  const y = (v: number) => H - 3 - ((v - lo) / span) * (H - 6);
  const lastIdx = values.map((v, i) => (v === null ? -1 : i)).reduce((a, b) => Math.max(a, b), -1);
  return (
    <svg
      className="mini-spark"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {zeroLine && lo < 0 && hi > 0 ? (
        <line className="spark-zero" x1={0} x2={W} y1={y(0)} y2={y(0)} />
      ) : null}
      <path className="spark-line draw" pathLength={1} d={linePath(values, x, y)} />
      {lastIdx >= 0 ? (
        <circle className="spark-dot" cx={x(lastIdx)} cy={y(values[lastIdx]!)} r={2.2} />
      ) : null}
    </svg>
  );
}

/** Width of the chart's container, so the SVG is drawn at 1:1 and its text stays at the stated
 *  size on a phone and on a conference-room screen alike. */
function useContainerWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Rounded tick step for a value span. */
function niceStep(span: number, target = 4): number {
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / mag;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
}

export interface LineSeries {
  label: string;
  values: (number | null)[];
  variant?: 'primary' | 'secondary' | 'tertiary';
}

/** Line chart with a value axis and labelled x positions. `band` shades a value range (the
 *  near-norm band on a z-score chart). With `zoomable`, dragging across the plot zooms to that
 *  range; "Reset zoom" (or Escape) returns. Parents pass a `key` that changes with the data so a
 *  zoom never outlives the series it was drawn on. */
export function LineChart({
  series,
  xTicks,
  xCount,
  unit,
  ariaLabel,
  band,
  height = 230,
  points,
  zoomable,
  pointLabel,
  format,
}: {
  series: LineSeries[];
  /** [position index, label] */
  xTicks: [number, string][];
  xCount: number;
  unit: string;
  ariaLabel: string;
  band?: [number, number] | undefined;
  height?: number;
  /** draw a marker on every value (short categorical series such as a yield curve) */
  points?: boolean;
  zoomable?: boolean;
  /** tooltip heading for a position */
  pointLabel?: (i: number) => string;
  /** tooltip value format */
  format?: (v: number) => string;
}) {
  const [ref, measured] = useContainerWidth(640);
  const [zoom, setZoom] = useState<[number, number] | null>(null);
  const [brush, setBrush] = useState<[number, number] | null>(null);
  const from = zoom ? zoom[0] : 0;
  const to = zoom ? zoom[1] : xCount - 1;
  const count = to - from + 1;
  const visible = series.map((s) => ({ ...s, values: s.values.slice(from, to + 1) }));
  const flat = visible.flatMap((s) => s.values);
  const tweenedFlat = useTween(flat);
  const tweened = visible.map((s, k) => ({
    ...s,
    values: tweenedFlat.slice(k * count, (k + 1) * count),
  }));
  const tip = useActiveIndex(count);

  const W = Math.max(280, measured);
  const H = height;
  const L = 52;
  const R = 14;
  const T = 12;
  const B = 28;
  const present = flat.filter((v): v is number => v !== null && Number.isFinite(v));
  if (present.length === 0) {
    return (
      <div ref={ref} className="line-chart-wrap">
        <p className="footnote">No values in this range.</p>
      </div>
    );
  }
  let lo = Math.min(...present, ...(band ?? []));
  let hi = Math.max(...present, ...(band ?? []));
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const step = niceStep(hi - lo);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  const x = (i: number) => L + (count > 1 ? (i * (W - L - R)) / (count - 1) : (W - L - R) / 2);
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const tickDp = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  const indexAt = (ev: ReactPointerEvent<SVGSVGElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    const k = count > 1 ? Math.round(((px - L) / (W - L - R)) * (count - 1)) : 0;
    return Math.max(0, Math.min(count - 1, k));
  };
  const a = tip.active;
  const fmt = format ?? ((v: number) => num(v, 2));
  const visibleTicks = xTicks
    .filter(([i]) => i >= from && i <= to)
    .map(([i, label]) => [i - from, label] as [number, string]);

  return (
    <div ref={ref} className="line-chart-wrap">
      {zoomable ? (
        <div className="zoom-bar">
          {zoom ? (
            <button type="button" className="btn-outline btn-small" onClick={() => setZoom(null)}>
              Reset zoom
            </button>
          ) : (
            <span className="footnote">Drag across the chart to zoom</span>
          )}
        </div>
      ) : null}
      <Reveal className="chart-wrap">
        <svg
          className={`line-chart${zoomable ? ' zoomable' : ''}`}
          viewBox={`0 0 ${W} ${H}`}
          height={H}
          role="img"
          aria-label={`${ariaLabel} Use the arrow keys to read each point.`}
          {...tip.keyProps}
          onKeyDown={(ev) => {
            if (ev.key === 'Escape' && zoom) setZoom(null);
            tip.keyProps.onKeyDown(ev);
          }}
          onPointerDown={(ev) => {
            if (!zoomable || ev.button !== 0) return;
            const k = indexAt(ev);
            setBrush([k, k]);
            ev.currentTarget.setPointerCapture(ev.pointerId);
          }}
          onPointerMove={(ev) => {
            const k = indexAt(ev);
            tip.setActive(k);
            if (brush) setBrush([brush[0], k]);
          }}
          onPointerUp={() => {
            if (brush && Math.abs(brush[1] - brush[0]) >= 2) {
              const lo2 = Math.min(brush[0], brush[1]) + from;
              const hi2 = Math.max(brush[0], brush[1]) + from;
              setZoom([lo2, hi2]);
              tip.setActive(null);
            }
            setBrush(null);
          }}
          onPointerLeave={() => {
            if (!brush) tip.setActive(null);
          }}
        >
          {band ? (
            <rect
              className="lc-band"
              x={L}
              width={W - L - R}
              y={y(Math.min(band[1], hi))}
              height={Math.max(0, y(Math.max(band[0], lo)) - y(Math.min(band[1], hi)))}
            />
          ) : null}
          {ticks.map((t) => (
            <g key={t}>
              <line
                className={t === 0 ? 'lc-zero' : 'lc-grid'}
                x1={L}
                x2={W - R}
                y1={y(t)}
                y2={y(t)}
              />
              <text className="lc-tick" x={L - 6} y={y(t) + 3.5} textAnchor="end">
                {num(t, tickDp)}
              </text>
            </g>
          ))}
          <text className="lc-unit" x={4} y={T + 2}>
            {unit}
          </text>
          {visibleTicks.map(([i, label]) => (
            <text key={`${i}-${label}`} className="lc-tick" x={x(i)} y={H - 8} textAnchor="middle">
              {label}
            </text>
          ))}
          {brush ? (
            <rect
              className="lc-brush"
              x={x(Math.min(brush[0], brush[1]))}
              width={Math.abs(x(brush[1]) - x(brush[0]))}
              y={T}
              height={H - T - B}
            />
          ) : null}
          {tweened.map((s, si) => (
            <g key={s.label} className={`lc-series lc-${s.variant ?? 'primary'}`}>
              <path d={linePath(s.values, x, y)} className="draw" pathLength={1} />
              {points
                ? s.values.map((v, i) =>
                    v === null ? null : (
                      <circle key={i} cx={x(i)} cy={y(v)} r={si === 0 ? 3.2 : 2.6} />
                    ),
                  )
                : null}
            </g>
          ))}
          {a !== null ? (
            <g className="lc-active">
              <line className="crosshair" x1={x(a)} x2={x(a)} y1={T} y2={H - B} />
              {visible.map((s) => {
                const v = s.values[a];
                return v === null || v === undefined ? null : (
                  <circle
                    key={s.label}
                    className={`lc-dot lc-${s.variant ?? 'primary'}`}
                    cx={x(a)}
                    cy={y(v)}
                    r={4}
                  />
                );
              })}
            </g>
          ) : null}
        </svg>
        {a !== null ? (
          <ChartTip left={`${((x(a) / W) * 100).toFixed(1)}%`} flip={x(a) > W / 2}>
            <strong>{pointLabel ? pointLabel(a + from) : String(a + from)}</strong>
            {visible.map((s) => {
              const v = s.values[a];
              return (
                <span key={s.label}>
                  {visible.length > 1 ? `${s.label}: ` : ''}
                  {v === null || v === undefined ? 'not published' : `${fmt(v)} ${unit}`}
                </span>
              );
            })}
          </ChartTip>
        ) : null}
      </Reveal>
    </div>
  );
}

/** Growth (x) against inflation (y), both as z-scores, with the 12-month path. The shaded cross
 *  is the near-norm band in which no quadrant is named. Hover or the arrow keys read a month. */
export function QuadrantChart({
  trail,
  near,
  ariaLabel,
  labels,
}: {
  trail: { g: number; i: number; label: string }[];
  near: number;
  ariaLabel: string;
  labels: { ne: string; nw: string; se: string; sw: string };
}) {
  const S = 300;
  const P = 26;
  // the domain fits the path (at least ±1.5 σ, at most ±3 σ) so a year of small moves is visible;
  // readings beyond ±3 σ are pinned to the frame
  const reach = Math.max(0, ...trail.flatMap((p) => [Math.abs(p.g), Math.abs(p.i)]));
  const max = Math.min(3, Math.max(1.5, Math.ceil((reach + 0.25) * 2) / 2));
  const clamp = (v: number) => Math.max(-max, Math.min(max, v));
  const ticks = [-Math.floor(max), Math.floor(max)].filter((t) => t !== 0);
  const px = (g: number) => P + ((clamp(g) + max) / (2 * max)) * (S - 2 * P);
  const py = (i: number) => P + ((max - clamp(i)) / (2 * max)) * (S - 2 * P);
  const last = trail[trail.length - 1];
  const first = trail[0];
  const tip = useActiveIndex(trail.length);
  const on = tip.active === null ? null : trail[tip.active];
  return (
    <Reveal className="chart-wrap">
      <svg
        className="quad-chart"
        viewBox={`0 0 ${S} ${S}`}
        role="img"
        aria-label={`${ariaLabel} Use the arrow keys to read each month.`}
        {...tip.keyProps}
        onPointerLeave={() => tip.setActive(null)}
      >
        <rect className="quad-frame" x={P} y={P} width={S - 2 * P} height={S - 2 * P} />
        <rect
          className="quad-band"
          x={px(-near)}
          y={P}
          width={px(near) - px(-near)}
          height={S - 2 * P}
        />
        <rect
          className="quad-band"
          x={P}
          y={py(near)}
          width={S - 2 * P}
          height={py(-near) - py(near)}
        />
        <line className="quad-axis" x1={px(0)} x2={px(0)} y1={P} y2={S - P} />
        <line className="quad-axis" x1={P} x2={S - P} y1={py(0)} y2={py(0)} />
        {ticks.map((t) => (
          <g key={t}>
            <text className="quad-tick" x={px(t)} y={py(0) + 12} textAnchor="middle">
              {signed(t, 0)}
            </text>
            <text className="quad-tick" x={px(0) - 4} y={py(t) + 3.5} textAnchor="end">
              {signed(t, 0)}
            </text>
          </g>
        ))}
        <text className="quad-label" x={S - P - 6} y={P + 14} textAnchor="end">
          {labels.ne}
        </text>
        <text className="quad-label" x={P + 6} y={P + 14}>
          {labels.nw}
        </text>
        <text className="quad-label" x={S - P - 6} y={S - P - 8} textAnchor="end">
          {labels.se}
        </text>
        <text className="quad-label" x={P + 6} y={S - P - 8}>
          {labels.sw}
        </text>
        <text className="quad-axis-label" x={S / 2} y={S - 6} textAnchor="middle">
          Growth z →
        </text>
        <text
          className="quad-axis-label"
          x={10}
          y={S / 2}
          textAnchor="middle"
          transform={`rotate(-90 10 ${S / 2})`}
        >
          Inflation z →
        </text>
        <polyline
          className="quad-trail draw"
          pathLength={1}
          points={trail.map((p) => `${px(p.g)},${py(p.i)}`).join(' ')}
        />
        {trail.map((p, k) => (
          <circle
            key={p.label}
            className={`quad-dot${tip.active === k ? ' on' : ''}`}
            cx={px(p.g)}
            cy={py(p.i)}
            r={tip.active === k ? 6 : k === trail.length - 1 ? 5.5 : 2.6}
            style={{ opacity: k === trail.length - 1 ? 1 : 0.35 + (0.5 * k) / trail.length }}
            onPointerEnter={() => tip.setActive(k)}
          />
        ))}
        {first && trail.length > 1 ? (
          <text className="quad-point-label" x={px(first.g) + 6} y={py(first.i) + 12}>
            {first.label}
          </text>
        ) : null}
        {last ? (
          <text className="quad-point-label strong" x={px(last.g) + 8} y={py(last.i) - 8}>
            {last.label}
          </text>
        ) : null}
      </svg>
      {on ? (
        <ChartTip
          left={`${((px(on.g) / S) * 100).toFixed(1)}%`}
          top={`${((py(on.i) / S) * 100 - 30).toFixed(1)}%`}
          flip={px(on.g) > S / 2}
        >
          <strong>{on.label}</strong>
          <span>Growth {signed(on.g, 2)} σ</span>
          <span>Inflation {signed(on.i, 2)} σ</span>
        </ChartTip>
      ) : null}
    </Reveal>
  );
}
