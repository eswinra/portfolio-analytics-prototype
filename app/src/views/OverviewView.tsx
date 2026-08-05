import { Link } from 'react-router-dom';

import { GrowthChart, type GrowthDatum } from '../charts/GrowthChart';
import { ClassBadge, fmtPct, Panel, Pill, SignedPct, statusTone } from '../components/ui';
import { useDataset } from '../lib/dataset/useDataset';

/** Headline view: the two-minute read. Everything else is a drill-down. */

export function OverviewView() {
  const { dataset, source } = useDataset();
  const { periods, reconciliation, meta, proxyStrip, checks } = dataset;

  const growth: GrowthDatum[] = dataset.growthPortfolio.map((p, i) => ({
    monthEnd: p.monthEnd,
    portfolio: p.index,
    benchmark: dataset.growthBenchmark[i]?.index ?? null,
  }));

  const passCount = checks.filter((c) => c.status === 'PASS').length;
  const warnCount = checks.filter((c) => c.status === 'WARN').length;
  const failCount = checks.filter((c) => c.status === 'FAIL').length;
  const fytd = periods.find((p) => p.label.startsWith('Fiscal'));

  return (
    <>
      <div className="tile-row">
        <div className="tile">
          <div className="tile-label">Fiscal YTD return (net)</div>
          <div className="tile-value">{fmtPct(fytd?.portfolio ?? null)}</div>
          <div className="tile-sub">
            vs benchmark {fmtPct(fytd?.benchmark ?? null)} · <ClassBadge c="synthetic" />
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">Excess vs benchmark (FYTD)</div>
          <div className="tile-value">
            <SignedPct v={fytd?.excess ?? null} />
          </div>
          <div className="tile-sub">synthetic policy benchmark, matched periods</div>
        </div>
        <div className="tile">
          <div className="tile-label">Contribution reconciliation</div>
          <div className="tile-value">
            {reconciliation ? (
              <Pill tone={statusTone(reconciliation.status)}>{reconciliation.status}</Pill>
            ) : (
              '—'
            )}
          </div>
          <div className="tile-sub">
            residual {fmtPct(reconciliation?.residual ?? null)} · tolerance{' '}
            {fmtPct(reconciliation?.tolerance ?? null)}
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">Data checks</div>
          <div className="tile-value">
            {passCount} / {warnCount} / {failCount}
          </div>
          <div className="tile-sub">
            pass / warn / fail · <Link to="/data-quality">detail</Link>
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        <Panel
          title="Illustrative performance (net of fees, synthetic)"
          note="TWR-style monthly linking; no annualization below one year. Periods end on the as-of date."
        >
          <div className="table-scroll">
            <table>
              <caption>
                DEMOFUND vs synthetic policy benchmark and hurdle, periods ended {meta.asOf}
              </caption>
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
                    Hurdle
                  </th>
                  <th scope="col" className="num">
                    Excess
                  </th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.label}>
                    <td>
                      {p.label}
                      <div className="footnote">
                        {p.periodStart} → {p.periodEnd}
                      </div>
                    </td>
                    <td className="num">{fmtPct(p.portfolio)}</td>
                    <td className="num">{fmtPct(p.benchmark)}</td>
                    <td className="num">{fmtPct(p.hurdle)}</td>
                    <td className="num">
                      <SignedPct v={p.excess} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Growth of $1 (demo fiscal year)">
          <GrowthChart data={growth} />
        </Panel>
      </div>

      <section className="panel market-strip" aria-labelledby="mkt-h">
        <h2 id="mkt-h">Market context — synthetic proxies, not portfolio performance</h2>
        <div className="table-scroll">
          <table>
            <caption>
              Final-day proxy moves. These are invented series demonstrating the market strip; they
              feed no portfolio calculation.
            </caption>
            <thead>
              <tr>
                <th scope="col">Proxy</th>
                <th scope="col">Read-through</th>
                <th scope="col" className="num">
                  Last daily return
                </th>
                <th scope="col">State</th>
              </tr>
            </thead>
            <tbody>
              {proxyStrip.map((p) => (
                <tr key={p.proxyId}>
                  <td>
                    <code>{p.proxyId}</code>
                  </td>
                  <td>{p.category}</td>
                  <td className="num">
                    <SignedPct v={p.state === 'current' ? p.lastReturn : null} />
                  </td>
                  <td>
                    <Pill tone={statusTone(p.state)}>{p.state}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="panel-note">
          Two proxies are deliberately degraded (one missing final close, one stale) to show how
          data states surface. Source:{' '}
          {source === 'fixture' ? 'bundled synthetic fixture' : 'user import'}.
        </p>
      </section>
    </>
  );
}
