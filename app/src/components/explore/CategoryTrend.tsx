import { monthYear } from '../../fixtures/cioMonthly';
import type { Band, CioHistory, SeriesKey } from '../../lib/cioHistory';
import { moneyM, pct1, shortMonth, signed1 } from './format';

const W = 640;
const PAD_L = 44;
const PAD_R = 8;

/** A tick step of 1, 2 or 5 × 10ⁿ giving about `intervals` intervals. */
function niceStep(span: number, intervals: number): number {
  const raw = span / intervals || 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

function yScale(
  values: number[],
  top: number,
  bottom: number,
  includeZero: boolean,
  intervals = 4,
) {
  let lo = Math.min(...values, ...(includeZero ? [0] : []));
  let hi = Math.max(...values, ...(includeZero ? [0] : []));
  if (hi === lo) {
    hi += 1;
    lo -= 1;
  }
  const step = niceStep(hi - lo, intervals);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const y = (v: number) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return { y, ticks };
}

/** One category across the reports: its monthly return against its benchmark, and its weight
 *  against the policy target and range (the fund's market value for the Total Fund). The bars
 *  are a pointer convenience; the month grid above and the figures table below are the
 *  keyboard and exact routes to the same numbers.
 *
 *  `show` picks the part a tab needs: Explore shows both; Performance the returns, where the
 *  question is whether a gap to benchmark was one month or most months; Positioning the weight,
 *  where the question is whether it has been moving toward a bound. */
export function CategoryTrend({
  history,
  cat,
  current,
  band,
  onSelectMonth,
  show = 'both',
}: {
  history: CioHistory;
  cat: SeriesKey;
  current: number;
  band: Band | null;
  onSelectMonth: (monthEnd: string) => void;
  show?: 'both' | 'return' | 'weight';
}) {
  const showReturn = show !== 'weight';
  const showWeight = show !== 'return';
  const { months, reports } = history;
  const s = history.series[cat];
  const label = history.labels[cat];
  const n = months.length;
  const step = (W - PAD_L - PAD_R) / n;
  const xMid = (i: number) => PAD_L + step * (i + 0.5);
  const bw = Math.max(4, step * 0.56);
  // month labels: the report on screen and the last month always, then every third month
  // where it has room (at least two columns from a label already placed)
  const ticksEvery = n > 12 ? 3 : 1;
  const labelled = new Set([n - 1, ...(current >= 0 ? [current] : [])]);
  for (let i = 0; i < n; i += ticksEvery) {
    if ([...labelled].every((j) => Math.abs(i - j) >= 2)) labelled.add(i);
  }
  const showX = (i: number) => labelled.has(i);

  // chart 1: return and benchmark, % as printed
  const H1 = 170;
  const r1 = yScale(
    s.flatMap((p) => [p.r, p.b]).filter((v): v is number => v !== null),
    10,
    H1 - 22,
    true,
  );
  // chart 2: weight against target and range, or the fund's market value
  const H2 = 130;
  const isTotal = cat === 'total';
  const line2 = s.map((p) => (isTotal ? (p.mv === null ? null : p.mv / 1000) : p.weight));
  const tgt2 = s.map((p) => (isTotal ? null : p.target));
  const r2 = yScale(
    [...line2, ...tgt2, ...(band && !isTotal ? [band.min, band.max] : [])].filter(
      (v): v is number => v !== null,
    ),
    8,
    H2 - 22,
    false,
    3,
  );
  const path = (vals: (number | null)[], y: (v: number) => number) => {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? ' L' : ' M'} ${xMid(i).toFixed(1)} ${y(v).toFixed(1)}`;
      pen = true;
    });
    return d.trim();
  };

  // the nearest the weight came to either bound of the range, across the reports
  let nearest: { i: number; dist: number; bound: 'lower' | 'upper' } | null = null;
  if (band && !isTotal) {
    for (let i = 0; i < s.length; i++) {
      const w = s[i]!.weight;
      if (w === null) continue;
      const lower = w - band.min;
      const upper = band.max - w;
      const dist = Math.min(lower, upper);
      if (nearest === null || dist < nearest.dist) {
        nearest = { i, dist, bound: lower <= upper ? 'lower' : 'upper' };
      }
    }
  }
  const weighed = s.filter((p) => p.weight !== null).map((p) => p.weight!);

  const dataCols = (showReturn ? 3 : 0) + (showWeight ? (isTotal ? 1 : 3) : 0);
  const withBoth = s.filter((p) => p.r !== null && p.b !== null);
  const beat = withBoth.filter((p) => p.r! > p.b!).length;
  const at = current >= 0 ? current : n - 1;
  const now = s[at]!;
  const firstMv = s.find((p) => p.mv !== null);
  const firstIdx = firstMv ? s.indexOf(firstMv) : -1;

  // one sentence per part on show, joined, so no part leaves a stray space for another
  const lede = [
    showReturn
      ? `${isTotal ? 'The Total Fund' : label} beat its benchmark in ${beat} of ${withBoth.length} months.`
      : '',
    !showWeight
      ? ''
      : isTotal
        ? firstMv && now.mv !== null
          ? `Its market value — which moves with contributions and benefit payments as well as returns — went from ${moneyM(firstMv.mv!)} (${monthYear(months[firstIdx]!)}) to ${moneyM(now.mv)} (${monthYear(months[at]!)}).`
          : ''
        : now.weight !== null && now.target !== null
          ? `In ${monthYear(months[at]!)} it was ${pct1(now.weight)} of the fund against a ${pct1(now.target)} target${
              band ? ` (policy range ${band.min}–${band.max}%)` : ''
            }.`
          : '',
    showWeight && !isTotal && weighed.length > 1 && nearest !== null
      ? `Across ${weighed.length} reports its weight ran from ${pct1(Math.min(...weighed))} to ${pct1(Math.max(...weighed))}; the nearest it came to a bound was ${nearest.dist.toFixed(1)} pp from the ${nearest.bound} bound, in ${monthYear(months[nearest.i]!)}.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const selBand = (h: number) =>
    at >= 0 ? (
      <rect
        className="x-sel-band"
        x={PAD_L + step * at}
        y={0}
        width={step}
        height={h - 18}
        aria-hidden="true"
      />
    ) : null;
  const xLabels = (h: number) =>
    months.map((m, i) =>
      showX(i) ? (
        <text key={m} className="x-axis" x={xMid(i)} y={h - 4} textAnchor="middle">
          {shortMonth(m)}
        </text>
      ) : null,
    );
  const gaps = (h: number) =>
    months.map((m, i) =>
      reports[i] ? null : (
        <line key={m} className="x-gapline" x1={xMid(i)} x2={xMid(i)} y1={4} y2={h - 22}>
          <title>No report carries {monthYear(m)}</title>
        </line>
      ),
    );

  return (
    <div className="x-trend">
      <p className="x-lede">{lede}</p>

      {showReturn ? (
        <>
          <svg
            className="x-chart"
            viewBox={`0 0 ${W} ${H1}`}
            role="img"
            aria-label={`${label}: one-month return and benchmark by month, % as printed; the figures table below lists them`}
          >
            {selBand(H1)}
            {r1.ticks.map((t) => (
              <g key={t}>
                <line
                  className={t === 0 ? 'x-zero' : 'x-grid-line'}
                  x1={PAD_L}
                  x2={W - PAD_R}
                  y1={r1.y(t)}
                  y2={r1.y(t)}
                />
                <text className="x-axis" x={PAD_L - 6} y={r1.y(t) + 4} textAnchor="end">
                  {`${t < 0 ? '−' : ''}${Math.abs(t)}%`}
                </text>
              </g>
            ))}
            {gaps(H1)}
            {s.map((p, i) =>
              p.r === null ? null : (
                <g key={months[i]} className="x-hit" onClick={() => onSelectMonth(months[i]!)}>
                  <title>
                    {monthYear(months[i]!)}: {signed1(p.r)}% against a benchmark of {signed1(p.b)}%
                  </title>
                  <rect
                    className={`x-bar ${p.r >= 0 ? 'pos' : 'neg'}${i === at ? ' sel' : ''}`}
                    x={xMid(i) - bw / 2}
                    width={bw}
                    y={Math.min(r1.y(p.r), r1.y(0))}
                    height={Math.max(1, Math.abs(r1.y(p.r) - r1.y(0)))}
                  />
                  {p.b !== null ? (
                    <line
                      className="x-bench"
                      x1={xMid(i) - bw / 2 - 3}
                      x2={xMid(i) + bw / 2 + 3}
                      y1={r1.y(p.b)}
                      y2={r1.y(p.b)}
                    />
                  ) : null}
                </g>
              ),
            )}
            {xLabels(H1)}
          </svg>
          <div className="x-legend" aria-hidden="true">
            <span className="x-key bar" /> Return <span className="x-key bench" /> Benchmark{' '}
            <span className="x-key gap" /> No report that month
          </div>
        </>
      ) : null}

      {showWeight ? (
        <>
          <svg
            className="x-chart"
            viewBox={`0 0 ${W} ${H2}`}
            role="img"
            aria-label={
              isTotal
                ? 'Total Fund market value by month, $ billions'
                : `${label}: weight against policy target by month, % of the fund`
            }
          >
            {selBand(H2)}
            {band && !isTotal ? (
              <rect
                className="x-range"
                x={PAD_L}
                width={W - PAD_L - PAD_R}
                y={r2.y(band.max)}
                height={r2.y(band.min) - r2.y(band.max)}
              />
            ) : null}
            {r2.ticks.map((t) => (
              <g key={t}>
                <line className="x-grid-line" x1={PAD_L} x2={W - PAD_R} y1={r2.y(t)} y2={r2.y(t)} />
                <text className="x-axis" x={PAD_L - 6} y={r2.y(t) + 4} textAnchor="end">
                  {isTotal ? `$${t}B` : `${t}%`}
                </text>
              </g>
            ))}
            {gaps(H2)}
            {isTotal ? null : <path className="x-target" d={path(tgt2, r2.y)} />}
            <path className="x-line" d={path(line2, r2.y)} />
            {line2.map((v, i) =>
              v === null ? null : (
                <circle
                  key={months[i]}
                  className={`x-dot${i === at ? ' sel' : ''}`}
                  cx={xMid(i)}
                  cy={r2.y(v)}
                  r={i === at ? 4 : 2.5}
                />
              ),
            )}
            {xLabels(H2)}
          </svg>
          <div className="x-legend" aria-hidden="true">
            {isTotal ? (
              <>
                <span className="x-key line" /> Market value
              </>
            ) : (
              <>
                <span className="x-key line" /> Weight <span className="x-key target" /> Target
                {band ? (
                  <>
                    {' '}
                    <span className="x-key range" /> Policy range
                  </>
                ) : null}
              </>
            )}
          </div>
        </>
      ) : null}

      <details className="x-figures">
        <summary>Figures by month</summary>
        <div className="table-scroll" role="region" aria-label={`${label} by month`} tabIndex={0}>
          <table className="table">
            <caption>
              {[
                showReturn
                  ? `${label}: one-month return and benchmark as printed, excess calculated (pp)`
                  : `${label}:`,
                showWeight ? (isTotal ? 'market value' : 'weight and target') : '',
              ]
                .filter(Boolean)
                .join(showReturn ? ', ' : ' ')}
            </caption>
            <thead>
              <tr>
                <th scope="col">Month</th>
                {showReturn ? (
                  <>
                    <th scope="col" className="num">
                      Return
                    </th>
                    <th scope="col" className="num">
                      Benchmark
                    </th>
                    <th scope="col" className="num">
                      Excess
                    </th>
                  </>
                ) : null}
                {isTotal || !showWeight ? null : (
                  <>
                    <th scope="col" className="num">
                      Weight
                    </th>
                    <th scope="col" className="num">
                      Target
                    </th>
                  </>
                )}
                {showWeight ? (
                  <th scope="col" className="num">
                    Market value
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {s.map((p, i) => (
                <tr key={months[i]} className={i === at ? 'trend-current' : undefined}>
                  <td>{monthYear(months[i]!)}</td>
                  {reports[i] ? (
                    <>
                      {showReturn ? (
                        <>
                          <td className="num">{pct1(p.r)}</td>
                          <td className="num">{pct1(p.b)}</td>
                          <td className="num">
                            {p.r === null || p.b === null ? '—' : `${signed1(p.r - p.b)} pp`}
                          </td>
                        </>
                      ) : null}
                      {isTotal || !showWeight ? null : (
                        <>
                          <td className="num">{pct1(p.weight)}</td>
                          <td className="num">{pct1(p.target)}</td>
                        </>
                      )}
                      {showWeight ? (
                        <td className="num">{p.mv === null ? '—' : moneyM(p.mv)}</td>
                      ) : null}
                    </>
                  ) : (
                    <td colSpan={dataCols}>No report carries this month</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
