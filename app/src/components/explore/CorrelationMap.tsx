import { monthYear } from '../../fixtures/cioMonthly';
import {
  CATEGORY_KEYS,
  correlation,
  MIN_CORRELATION_MONTHS,
  rangeIncludesZero,
  type CioHistory,
  type Correlation,
} from '../../lib/cioHistory';
import type { CompositeKey } from '../../fixtures/cioMonthly';
import { r2, signed1 } from './format';

export type Pair = [CompositeKey, CompositeKey];

/** `growth-credit` ⇄ a pair of different categories, or null. */
export function parsePair(s: string): Pair | null {
  const [a, b] = s.split('-');
  const ok = (k: string | undefined): k is CompositeKey =>
    k !== undefined && (CATEGORY_KEYS as readonly string[]).includes(k);
  return ok(a) && ok(b) && a !== b ? [a, b] : null;
}

function corrTone(c: Correlation): string {
  if (c.r === null) return ' x-corr-none';
  if (rangeIncludesZero(c)) return ' x-corr-weak';
  const a = Math.abs(c.r);
  return ` x-${c.r > 0 ? 'pos' : 'neg'}-${a >= 0.6 ? 3 : a >= 0.3 ? 2 : 1}`;
}

/** What one correlation says, in words, with its range and the number of months behind it. */
export function correlationSentence(la: string, lb: string, c: Correlation): string {
  if (c.r === null) {
    return `${la} and ${lb}: ${c.n} months with both figures — fewer than the ${MIN_CORRELATION_MONTHS} needed to show a correlation.`;
  }
  const head = `${la} and ${lb}: correlation ${r2(c.r)} over ${c.n} months (approximate 95% range ${r2(c.lo)} to ${r2(c.hi)}).`;
  if (rangeIncludesZero(c)) {
    return `${head} The range includes zero, so these months cannot tell a relation from none.`;
  }
  return `${head} In these months they tended to move ${c.r > 0 ? 'together' : 'in opposite directions'}.`;
}

/** Pairwise correlation of the categories' one-month returns (lower triangle: each pair once),
 *  and the months behind the selected pair as a scatter — the few points a figure rests on. */
export function CorrelationMap({
  history,
  pair,
  current,
  onSelectPair,
}: {
  history: CioHistory;
  pair: Pair;
  current: number;
  onSelectPair: (p: Pair) => void;
}) {
  const { labels, series, months } = history;
  const ret = (k: CompositeKey) => series[k].map((p) => p.r);
  const corr = (a: CompositeKey, b: CompositeKey) => correlation(ret(a), ret(b));
  const rows = CATEGORY_KEYS.slice(1);
  const cols = CATEGORY_KEYS.slice(0, -1);
  const [pa, pb] = pair;
  const sel = corr(pa, pb);
  const same = (a: CompositeKey, b: CompositeKey) =>
    (a === pa && b === pb) || (a === pb && b === pa);

  // scatter of the selected pair: x = first category's month, y = the second's
  const pts = months
    .map((m, i) => ({ m, i, x: series[pa][i]!.r, y: series[pb][i]!.r }))
    .filter(
      (p): p is { m: string; i: number; x: number; y: number } => p.x !== null && p.y !== null,
    );
  const S = 240;
  const P = 34;
  const ext = Math.max(1, ...pts.flatMap((p) => [Math.abs(p.x), Math.abs(p.y)]));
  const lim = Math.ceil(ext);
  const sx = (v: number) => P + ((v + lim) / (2 * lim)) * (S - P - 8);
  const sy = (v: number) => S - P - ((v + lim) / (2 * lim)) * (S - P - 8);

  return (
    <div className="x-corr">
      <div className="table-scroll" role="region" aria-label="Correlation matrix" tabIndex={0}>
        <table className="table x-corr-table">
          <caption>
            Correlation of one-month returns, pair by pair. Choose a pair to see its months.
          </caption>
          <thead>
            <tr>
              <td />
              {cols.map((c) => (
                <th scope="col" key={c} className="num">
                  {labels[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r}>
                <th scope="row">{labels[r]}</th>
                {cols.map((c, ci) => {
                  if (ci > ri) return <td key={c} aria-hidden="true" />;
                  const x = corr(c, r);
                  return (
                    <td key={c} className={`num x-corr-cell${corrTone(x)}`}>
                      <button
                        type="button"
                        aria-pressed={same(c, r)}
                        aria-label={correlationSentence(labels[c], labels[r], x)}
                        onClick={() => onSelectPair([c, r])}
                      >
                        <span className="x-corr-r">{r2(x.r)}</span>
                        <span className="x-corr-n">
                          {x.r === null ? `${x.n} months` : `n ${x.n}`}
                          {rangeIncludesZero(x) ? ' · spans 0' : ''}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="x-lede">{correlationSentence(labels[pa], labels[pb], sel)}</p>

      <svg
        className="x-scatter"
        viewBox={`0 0 ${S} ${S}`}
        role="img"
        aria-label={`${labels[pa]} against ${labels[pb]}, one-month returns, one point per month (${pts.length} months)`}
      >
        <line className="x-zero" x1={sx(0)} x2={sx(0)} y1={8} y2={S - P} />
        <line className="x-zero" x1={P} x2={S - 8} y1={sy(0)} y2={sy(0)} />
        <rect className="x-frame" x={P} y={8} width={S - P - 8} height={S - P - 8} />
        {[-lim, lim].map((t) => (
          <g key={t}>
            <text className="x-axis" x={sx(t)} y={S - P + 14} textAnchor="middle">
              {`${t < 0 ? '−' : ''}${Math.abs(t)}%`}
            </text>
            <text className="x-axis" x={P - 4} y={sy(t) + (t < 0 ? -3 : 9)} textAnchor="end">
              {`${t < 0 ? '−' : ''}${Math.abs(t)}%`}
            </text>
          </g>
        ))}
        <text className="x-axis x-axis-title" x={(P + S) / 2} y={S - 4} textAnchor="middle">
          {labels[pa]}
        </text>
        <text
          className="x-axis x-axis-title"
          x={10}
          y={(S - P) / 2}
          textAnchor="middle"
          transform={`rotate(-90 10 ${(S - P) / 2})`}
        >
          {labels[pb]}
        </text>
        {pts.map((p) => (
          <circle
            key={p.m}
            className={`x-pt${p.i === current ? ' sel' : ''}`}
            cx={sx(p.x)}
            cy={sy(p.y)}
            r={p.i === current ? 5.5 : 4}
          >
            <title>
              {monthYear(p.m)}: {labels[pa]} {signed1(p.x)}%, {labels[pb]} {signed1(p.y)}%
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
