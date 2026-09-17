import { useActiveIndex, ChartTip, Reveal } from './ChartKit';
import { longDate, PERIOD_INDEX, type CioEntity, type CioVintage } from '../fixtures/cioMonthly';
import { useTween } from '../lib/motion';

/** Small multiples over the report series: the shape of the history, with the table one click
 *  away as the accessible and precise version. Every chart is drawn from the same reported
 *  values the table lists; nothing is smoothed, and a report that does not print a period leaves
 *  a gap in the line rather than a straight segment through it. Two series share one vertical
 *  scale and the same horizontal positions, so the comparison is a comparison.
 *
 *  Interaction: hover or arrow keys read a report's values; a click opens that report; a vertical
 *  rule marks the report on screen. Lines move to the other fund's values when the fund changes. */

const W = 260;
const H = 74;
const PAD = 4;

interface Point {
  x: number;
  y: number;
  gap: boolean;
}

/** Vertical scale over every series drawn in one chart. */
function makeScale(series: (number | null)[][]) {
  const present = series.flat().filter((v): v is number => v !== null && Number.isFinite(v));
  const lo = present.length ? Math.min(...present) : 0;
  const hi = present.length ? Math.max(...present) : 1;
  const span = hi - lo || 1;
  const n = Math.max(...series.map((s) => s.length), 1);
  const step = n > 1 ? (W - PAD * 2) / (n - 1) : 0;
  const xOf = (i: number) => PAD + i * step;
  const yOf = (v: number) => H - PAD - ((v - lo) / span) * (H - PAD * 2);
  const place = (values: (number | null)[]): Point[] =>
    values.map((v, i) => ({ x: xOf(i), y: v === null ? 0 : yOf(v), gap: v === null }));
  const zero = lo <= 0 && hi >= 0 ? yOf(0) : null;
  return { place, lo, hi, zero, xOf };
}

/** Path with breaks where the series has no value. */
function path(pts: Point[]): string {
  let d = '';
  let pen = false;
  for (const p of pts) {
    if (p.gap) {
      pen = false;
      continue;
    }
    d += `${pen ? ' L' : ' M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    pen = true;
  }
  return d.trim();
}

const fmt = (v: number | null | undefined, unit: string) =>
  v === null || v === undefined
    ? 'not printed'
    : `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}${unit}`;

function Spark({
  title,
  sub,
  values,
  label,
  bars,
  overlay,
  names,
  unit,
  overlayName,
  valueName = 'Fund',
  current,
  onSelect,
}: {
  title: string;
  sub: string;
  values: (number | null)[];
  label: string;
  bars?: boolean;
  /** second series drawn dashed (e.g. the policy benchmark), on the same scale and x positions */
  overlay?: (number | null)[];
  names: string[];
  unit: string;
  overlayName?: string;
  /** name of the solid series in the tooltip when an overlay is drawn */
  valueName?: string;
  current: number;
  onSelect?: (i: number) => void;
}) {
  const tweened = useTween(values);
  const tweenedOverlay = useTween(overlay ?? []);
  const { place, lo, hi, zero, xOf } = makeScale(overlay ? [values, overlay] : [values]);
  const mine = place(tweened);
  const theirs = overlay ? place(tweenedOverlay) : null;
  const last = [...mine].reverse().find((p) => !p.gap);
  const baseline = zero ?? H - PAD;
  const { active, setActive, keyProps } = useActiveIndex(values.length);
  const pick = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect();
    const k = Math.round(((clientX - r.left) / r.width) * (values.length - 1));
    return Math.max(0, Math.min(values.length - 1, k));
  };
  return (
    <figure className="spark">
      <figcaption>
        <strong>{title}</strong>
        <span>{sub}</span>
      </figcaption>
      <Reveal className="spark-wrap">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${label}. Use the arrow keys to read each report${onSelect ? ', Enter to open it' : ''}.`}
          preserveAspectRatio="none"
          onPointerMove={(ev) => setActive(pick(ev.clientX, ev.currentTarget))}
          onPointerLeave={() => setActive(null)}
          onClick={(ev) => onSelect?.(pick(ev.clientX, ev.currentTarget))}
          {...keyProps}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter' && active !== null && onSelect) {
              onSelect(active);
              return;
            }
            keyProps.onKeyDown(ev);
          }}
          className={onSelect ? 'selectable' : undefined}
        >
          {zero !== null ? (
            <line x1={PAD} x2={W - PAD} y1={zero} y2={zero} className="spark-zero" />
          ) : null}
          {current >= 0 ? (
            <line x1={xOf(current)} x2={xOf(current)} y1={0} y2={H} className="spark-current" />
          ) : null}
          {bars
            ? mine.map((p, i) =>
                p.gap ? null : (
                  <rect
                    key={i}
                    x={p.x - 3}
                    width={6}
                    y={Math.min(p.y, baseline)}
                    height={Math.max(1, Math.abs(baseline - p.y))}
                    className={`spark-bar${(values[i] ?? 0) < 0 ? ' neg' : ''}`}
                  />
                ),
              )
            : null}
          {theirs ? (
            <path d={path(theirs)} className="spark-line bench draw" pathLength={1} />
          ) : null}
          {bars ? null : <path d={path(mine)} className="spark-line draw" pathLength={1} />}
          {last && !bars ? <circle cx={last.x} cy={last.y} r={2.5} className="spark-dot" /> : null}
          {active !== null ? (
            <line x1={xOf(active)} x2={xOf(active)} y1={0} y2={H} className="crosshair" />
          ) : null}
        </svg>
        {active !== null ? (
          <ChartTip
            left={`${((xOf(active) / W) * 100).toFixed(1)}%`}
            top={-6}
            flip={active > values.length / 2}
          >
            <strong>{names[active]}</strong>
            <span>
              {overlayName ? `${valueName} ` : ''}
              {fmt(values[active], unit)}
            </span>
            {overlay && overlayName ? (
              <span>
                {overlayName} {fmt(overlay[active], unit)}
              </span>
            ) : null}
          </ChartTip>
        ) : null}
      </Reveal>
      <div className="spark-scale">
        <span>{lo.toFixed(1)}</span>
        <span>{hi.toFixed(1)}</span>
      </div>
    </figure>
  );
}

export function TrendSparks({
  vintages,
  entityOf,
  current = -1,
  onSelect,
}: {
  vintages: readonly CioVintage[];
  entityOf: (v: CioVintage) => CioEntity;
  /** index of the report on screen, marked in every chart */
  current?: number;
  onSelect?: (index: number) => void;
}) {
  const { oneMonth, fytd } = PERIOD_INDEX;
  const ents = vintages.map(entityOf);
  const first = ents[0];
  const last = ents[ents.length - 1];
  if (!first || !last) return null;
  const span = `${vintages.length} reports`;
  const names = vintages.map((v) => `Data through ${longDate(v.dataThrough)}`);
  const common = { names, current, ...(onSelect ? { onSelect } : {}) };
  return (
    <div className="spark-grid">
      <Spark
        title="Market value"
        sub="$ billions"
        unit=" $B"
        values={ents.map((e) => e.aum)}
        label={`Total fund market value across ${span}, ${first.aum.toFixed(1)} to ${last.aum.toFixed(1)} $ billions`}
        {...common}
      />
      <Spark
        title="Monthly return"
        sub="% net, by report month"
        unit="%"
        bars
        values={ents.map((e) => e.total.r[oneMonth] ?? null)}
        label={`Monthly net return across ${span}; bars above and below zero`}
        {...common}
      />
      <Spark
        title="Fiscal year to date"
        sub="% net — fund (solid) vs benchmark (dashed)"
        unit="%"
        overlayName="Benchmark"
        values={ents.map((e) => e.total.r[fytd] ?? null)}
        overlay={ents.map((e) => e.total.b[fytd] ?? null)}
        label={`Fiscal-year-to-date return against the policy benchmark across ${span}`}
        {...common}
      />
      <Spark
        title="Growth weight vs target"
        sub="% of fund — weight (solid) vs 2024 SAA target (dashed)"
        unit="%"
        overlayName="Target"
        valueName="Weight"
        values={ents.map((e) => e.comps[0]?.pct ?? null)}
        overlay={ents.map((e) => e.comps[0]?.tgt ?? null)}
        label={`Growth composite weight against its policy target across ${span}`}
        {...common}
      />
    </div>
  );
}
