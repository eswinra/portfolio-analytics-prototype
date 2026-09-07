import { PERIOD_INDEX, type CioEntity, type CioVintage } from '../fixtures/cioMonthly';

/** Small multiples over the report series: the shape of the history, with the table one click
 *  away as the accessible and precise version. Every chart is drawn from the same reported
 *  values the table lists; nothing is smoothed, and a report that does not print a period leaves
 *  a gap in the line rather than a straight segment through it. Two series share one vertical
 *  scale and the same horizontal positions, so the comparison is a comparison. */

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
  const place = (values: (number | null)[]): Point[] =>
    values.map((v, i) => ({
      x: PAD + i * step,
      y: v === null ? 0 : H - PAD - ((v - lo) / span) * (H - PAD * 2),
      gap: v === null,
    }));
  const zero = lo <= 0 && hi >= 0 ? H - PAD - ((0 - lo) / span) * (H - PAD * 2) : null;
  return { place, lo, hi, zero };
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

function Spark({
  title,
  sub,
  values,
  label,
  bars,
  overlay,
}: {
  title: string;
  sub: string;
  values: (number | null)[];
  label: string;
  bars?: boolean;
  /** second series drawn dashed (e.g. the policy benchmark), on the same scale and x positions */
  overlay?: (number | null)[];
}) {
  const { place, lo, hi, zero } = makeScale(overlay ? [values, overlay] : [values]);
  const mine = place(values);
  const theirs = overlay ? place(overlay) : null;
  const last = [...mine].reverse().find((p) => !p.gap);
  const baseline = zero ?? H - PAD;
  return (
    <figure className="spark">
      <figcaption>
        <strong>{title}</strong>
        <span>{sub}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="none">
        {zero !== null ? (
          <line x1={PAD} x2={W - PAD} y1={zero} y2={zero} className="spark-zero" />
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
        {theirs ? <path d={path(theirs)} className="spark-line bench" /> : null}
        {bars ? null : <path d={path(mine)} className="spark-line" />}
        {last && !bars ? <circle cx={last.x} cy={last.y} r={2.5} className="spark-dot" /> : null}
      </svg>
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
}: {
  vintages: readonly CioVintage[];
  entityOf: (v: CioVintage) => CioEntity;
}) {
  const { oneMonth, fytd } = PERIOD_INDEX;
  const ents = vintages.map(entityOf);
  const first = ents[0];
  const last = ents[ents.length - 1];
  if (!first || !last) return null;
  const span = `${vintages.length} reports`;
  return (
    <div className="spark-grid">
      <Spark
        title="Market value"
        sub="$ billions"
        values={ents.map((e) => e.aum)}
        label={`Total fund market value across ${span}, ${first.aum.toFixed(1)} to ${last.aum.toFixed(1)} $ billions`}
      />
      <Spark
        title="Monthly return"
        sub="% net, by report month"
        bars
        values={ents.map((e) => e.total.r[oneMonth] ?? null)}
        label={`Monthly net return across ${span}; bars above and below zero`}
      />
      <Spark
        title="Fiscal year to date"
        sub="% net — fund (solid) vs benchmark (dashed)"
        values={ents.map((e) => e.total.r[fytd] ?? null)}
        overlay={ents.map((e) => e.total.b[fytd] ?? null)}
        label={`Fiscal-year-to-date return against the policy benchmark across ${span}`}
      />
      <Spark
        title="Growth weight vs target"
        sub="% of fund — weight (solid) vs 2024 SAA target (dashed)"
        values={ents.map((e) => e.comps[0]?.pct ?? null)}
        overlay={ents.map((e) => e.comps[0]?.tgt ?? null)}
        label={`Growth composite weight against its policy target across ${span}`}
      />
    </div>
  );
}
