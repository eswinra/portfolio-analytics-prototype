import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Link } from 'react-router-dom';

import { fmtPct, fmtSmartReturn, Panel } from '../components/ui';
import { useDataset } from '../lib/dataset/useDataset';

/**
 * Trends: lenses over the history INSIDE the dataset — the file is the record. Every window
 * states its own sufficiency; nothing is imputed, and the app remembers nothing between
 * imports by design.
 */

const POSITIVE = '#3a6ea5';
const NEGATIVE = '#b4562a';

function Sparkline({ points }: { points: { close: number | null }[] }) {
  const vals = points.map((p) => p.close).filter((v): v is number => v !== null);
  if (vals.length < 2) return <span className="footnote">—</span>;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const step = 100 / (vals.length - 1);
  const d = vals.map(
    (v, k) => `${(k * step).toFixed(1)},${(24 - ((v - min) / span) * 22).toFixed(1)}`,
  );
  return (
    <svg viewBox="0 0 100 26" className="sparkline" aria-hidden="true">
      <polyline points={d.join(' ')} fill="none" stroke={POSITIVE} strokeWidth="1.6" />
    </svg>
  );
}

function dayLabel(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function TrendsView() {
  const { dataset } = useDataset();
  const { market, proxyTrends, readThroughDays, meta, joinedMonths } = dataset;

  const maxObs = Math.max(0, ...[...proxyTrends.values()].map((t) => t.observations));
  const last3 = joinedMonths.slice(-3);
  const roll3 =
    last3.length === 3 && last3.every((m) => m.portfolioReturn !== null)
      ? last3.reduce((g, m) => g * (1 + m.portfolioReturn!), 1) - 1
      : null;
  const roll3Bench =
    last3.length === 3 && last3.every((m) => m.benchmarkReturn !== null)
      ? last3.reduce((g, m) => g * (1 + m.benchmarkReturn!), 1) - 1
      : null;

  return (
    <>
      <h1>Trends</h1>
      <p className="footnote">
        Every trend below is computed from the history <em>inside</em> the active dataset — the file
        is the record; the app keeps nothing between imports by design. This dataset carries{' '}
        {maxObs} market observations per proxy. Import a longer daily series (the workbook workflow
        appends one day per close) and every window below deepens automatically.
      </p>

      <Panel
        title="Daily read-through trend"
        note="Σ(policy ½-step weight × proxy daily return) per day. Coverage varies by day — days where a proxy is unpriced exclude it (never imputed as zero); hover shows each day's coverage."
      >
        <figure
          style={{ margin: 0 }}
          role="img"
          aria-label={`Daily policy-weighted read-through over ${readThroughDays.length} days. Latest ${readThroughDays.length ? fmtSmartReturn(readThroughDays[readThroughDays.length - 1]!.impact) : 'n/a'}.`}
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={readThroughDays} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <XAxis
                dataKey="date"
                tickFormatter={dayLabel}
                tick={{ fontSize: 11, fill: '#5d6b76' }}
                tickLine={false}
                axisLine={{ stroke: '#d8d2c4' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v: number) => fmtPct(v, 2)}
                tick={{ fontSize: 11, fill: '#5d6b76' }}
                tickLine={false}
                axisLine={false}
                width={54}
              />
              <ReferenceLine y={0} stroke="#5d6b76" />
              <Tooltip
                formatter={(v: number | string, name: string) => [
                  typeof v === 'number'
                    ? name === 'coverage'
                      ? fmtPct(v, 1)
                      : fmtSmartReturn(v)
                    : v,
                  name === 'coverage' ? 'coverage' : 'read-through',
                ]}
                labelFormatter={(l) => `Day ${l}`}
                contentStyle={{ fontSize: 12, borderColor: '#d8d2c4', background: '#fff' }}
              />
              <Bar dataKey="impact" isAnimationActive={false} barSize={10} radius={[3, 3, 0, 0]}>
                {readThroughDays.map((d) => (
                  <Cell key={d.date} fill={d.impact >= 0 ? POSITIVE : NEGATIVE} />
                ))}
              </Bar>
              {/* coverage rides along in the tooltip payload */}
              <Bar dataKey="coverage" hide />
            </BarChart>
          </ResponsiveContainer>
          <figcaption className="footnote">
            Blue = positive, rust = negative day. A proxy estimate of the market read-through —
            never a portfolio return.
          </figcaption>
        </figure>
      </Panel>

      <Panel
        title="Proxy trend windows"
        note="Windows use present observations only: 1d = last vs previous close; 5d = one trading week; MTD = from the first close of the latest month (needs ≥2 observations in the month); σ20 = standard deviation of the last 20 daily returns (not annualized). '—' means the imported history is too short for that window — never a guess."
      >
        <div className="table-scroll">
          <table>
            <caption>Per-proxy trends computed from the imported series</caption>
            <thead>
              <tr>
                <th scope="col">Proxy</th>
                <th scope="col">History</th>
                <th scope="col" className="num">
                  Obs
                </th>
                <th scope="col" className="num">
                  1d
                </th>
                <th scope="col" className="num">
                  5d
                </th>
                <th scope="col" className="num">
                  MTD
                </th>
                <th scope="col" className="num">
                  σ20 (daily)
                </th>
              </tr>
            </thead>
            <tbody>
              {[...proxyTrends.entries()].map(([proxyId, t]) => (
                <tr key={proxyId}>
                  <td>
                    <code>{proxyId}</code>
                    <div className="footnote">through {t.lastDate ?? 'n/a'}</div>
                  </td>
                  <td>
                    <Sparkline points={market.get(proxyId) ?? []} />
                  </td>
                  <td className="num">{t.observations}</td>
                  <td className="num">{t.d1 === null ? '—' : fmtSmartReturn(t.d1)}</td>
                  <td className="num">{t.d5 === null ? '—' : fmtSmartReturn(t.d5)}</td>
                  <td className="num">{t.mtd === null ? '—' : fmtSmartReturn(t.mtd)}</td>
                  <td className="num">{t.vol20 === null ? '—' : fmtPct(t.vol20)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Fund monthly trend"
        note="From the dataset's monthly series (synthetic). Rolling 3-month figures are chain-linked, never averaged."
      >
        <div className="table-scroll">
          <table>
            <caption>Latest months and rolling 3-month, {meta.entityId}</caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col" className="num">
                  Portfolio
                </th>
                <th scope="col" className="num">
                  Benchmark
                </th>
                <th scope="col" className="num">
                  Excess
                </th>
              </tr>
            </thead>
            <tbody>
              {last3.map((m) => (
                <tr key={m.monthEnd}>
                  <td>{m.monthEnd}</td>
                  <td className="num">{fmtPct(m.portfolioReturn)}</td>
                  <td className="num">{fmtPct(m.benchmarkReturn)}</td>
                  <td className="num">
                    {m.portfolioReturn !== null && m.benchmarkReturn !== null
                      ? fmtSmartReturn(m.portfolioReturn - m.benchmarkReturn)
                      : '—'}
                  </td>
                </tr>
              ))}
              <tr className="total-row">
                <td>Rolling 3-month (chain-linked)</td>
                <td className="num">{roll3 === null ? '—' : fmtPct(roll3)}</td>
                <td className="num">{roll3Bench === null ? '—' : fmtPct(roll3Bench)}</td>
                <td className="num">
                  {roll3 !== null && roll3Bench !== null ? fmtSmartReturn(roll3 - roll3Bench) : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="panel-note">
          Full monthly history and reconciliation live on <Link to="/performance">Performance</Link>
          .
        </p>
      </Panel>
    </>
  );
}
