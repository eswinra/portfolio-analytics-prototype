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

import { FreshnessLine } from '../components/FreshnessLine';
import { fmtPct, fmtSmartReturn, Panel } from '../components/ui';
import { useDataset } from '../lib/dataset/useDataset';
import {
  bestWorstDay,
  LENS_MIN_OBS,
  maxDrawdown,
  rollingCorrelation,
  smaDeviation,
} from '../lib/finance/trends';

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

  const proxyIds = [...market.keys()].sort();

  return (
    <>
      <h1>Trends</h1>
      <FreshnessLine />
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
            Each bar is one trading day's estimated fund-level impact from the covered liquid
            proxies. Blue = positive, rust = negative. A proxy estimate — never a portfolio return.
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
                <th scope="col">
                  History <span className="footnote">(full series, own scale)</span>
                </th>
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
                  <span style={{ textTransform: 'none' }}>σ</span>20 (daily)
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
        title="Risk lenses — drawdown, extremes, trend deviation (proxy estimates)"
        note={`Each lens requires at least ${LENS_MIN_OBS} present observations and computes only from the imported series — market-proxy behavior, never fund-level risk. Daily fund risk is deliberately not built: proxy coverage cannot support it honestly.`}
      >
        <div className="table-scroll">
          <table>
            <caption>Per-proxy risk lenses over the full imported history</caption>
            <thead>
              <tr>
                <th scope="col">Proxy</th>
                <th scope="col" className="num">
                  Max drawdown
                </th>
                <th scope="col">Peak → trough</th>
                <th scope="col" className="num">
                  Best day
                </th>
                <th scope="col" className="num">
                  Worst day
                </th>
                <th scope="col" className="num">
                  vs 20-day avg
                </th>
              </tr>
            </thead>
            <tbody>
              {proxyIds.map((proxyId) => {
                const points = market.get(proxyId) ?? [];
                const dd = maxDrawdown(points);
                const bw = bestWorstDay(points);
                const dev = smaDeviation(points);
                return (
                  <tr key={proxyId}>
                    <td>
                      <code>{proxyId}</code>
                    </td>
                    <td className="num">{dd === null ? '—' : fmtPct(dd.maxDrawdown)}</td>
                    <td className="footnote">
                      {dd === null ? '—' : `${dd.peakDate} → ${dd.troughDate}`}
                    </td>
                    <td className="num">{bw === null ? '—' : fmtSmartReturn(bw.best.ret)}</td>
                    <td className="num">{bw === null ? '—' : fmtSmartReturn(bw.worst.ret)}</td>
                    <td className="num">{dev === null ? '—' : fmtSmartReturn(dev)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <details>
          <summary className="footnote">
            Rolling {LENS_MIN_OBS}-day correlation between proxies (date-matched returns)
          </summary>
          <div className="table-scroll" style={{ marginTop: '0.6rem' }}>
            <table>
              <caption>
                Pearson correlation of the last {LENS_MIN_OBS} matched daily returns; days where
                either proxy lacks a close are dropped, never imputed
              </caption>
              <thead>
                <tr>
                  <th scope="col">·</th>
                  {proxyIds.map((id) => (
                    <th key={id} scope="col" className="num">
                      <code>{id.replace('DEMO-', '')}</code>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {proxyIds.map((rowId) => (
                  <tr key={rowId}>
                    <td>
                      <code>{rowId.replace('DEMO-', '')}</code>
                    </td>
                    {proxyIds.map((colId) => {
                      if (rowId === colId)
                        return (
                          <td key={colId} className="num footnote">
                            1.00
                          </td>
                        );
                      const c = rollingCorrelation(
                        market.get(rowId) ?? [],
                        market.get(colId) ?? [],
                      );
                      return (
                        <td key={colId} className="num">
                          {c === null ? '—' : c.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Panel>

      <Panel
        title="Total fund monthly trend (all categories)"
        note="Whole-portfolio monthly net returns for the selected fund — Σ(beginning weight × category return) across all six sleeves, never a single section and never averaged. Rolling 3-month figures are chain-linked."
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
