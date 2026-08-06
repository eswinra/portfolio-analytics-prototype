import { useState } from 'react';
import { Link } from 'react-router-dom';

import { GrowthChart, type GrowthDatum } from '../charts/GrowthChart';
import { ClassBadge, fmtPct, Panel, Pill, SignedPct, statusTone } from '../components/ui';
import { makeDailyBrief } from '../lib/dataset/brief';
import { useDataset } from '../lib/dataset/useDataset';

/** Headline view: daily proxy pulse first, periodic story second, market strip last. */

export function OverviewView() {
  const { dataset, source } = useDataset();
  const { periods, reconciliation, meta, proxyStrip, checks, readThrough, exceptions, marketDate } =
    dataset;
  const [copied, setCopied] = useState(false);

  const growth: GrowthDatum[] = dataset.joinedMonths.map((m) => ({
    monthEnd: m.monthEnd,
    portfolio: m.portfolioIndex,
    benchmark: m.benchmarkIndex,
  }));

  const passCount = checks.filter((c) => c.status === 'PASS').length;
  const warnCount = checks.filter((c) => c.status === 'WARN').length;
  const failCount = checks.filter((c) => c.status === 'FAIL').length;
  const fytd = periods.find((p) => p.label.startsWith('Fiscal'));

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(makeDailyBrief(dataset));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <section className="panel pulse-hero" aria-labelledby="pulse-h">
        <h2 id="pulse-h">Daily proxy pulse — staff analytics, synthetic demo</h2>
        <p className="footnote">
          Policy-weighted read-through of liquid market proxies using the IPS ½-step weights (cited
          on <Link to="/policy">Policy</Link>). A proxy estimate of the market move's read-through —{' '}
          <strong>never a portfolio return</strong>. Private-market classes are excluded (benchmarks
          lagged 1–3 months per IPS Table 2). Market data through {marketDate ?? 'n/a'}.
        </p>
        <div className="tile-row">
          <div className="tile">
            <div className="tile-label">Fund-level read-through</div>
            <div className="tile-value">
              <SignedPct v={readThrough.fundLevelImpact} />
            </div>
            <div className="tile-sub">
              Σ(policy weight × proxy return), covered classes · <ClassBadge c="proxy_estimate" />
            </div>
          </div>
          <div className="tile">
            <div className="tile-label">Covered-basket return</div>
            <div className="tile-value">
              <SignedPct v={readThrough.coveredBasketReturn} />
            </div>
            <div className="tile-sub">renormalized over covered weight</div>
          </div>
          <div className="tile">
            <div className="tile-label">Policy-weight coverage</div>
            <div className="tile-value">{fmtPct(readThrough.coverage, 1)}</div>
            <div className="tile-sub">
              {readThrough.unpriced.length > 0
                ? `unpriced: ${readThrough.unpriced.map((u) => u.classLabel).join(', ')}`
                : 'all mapped proxies priced'}
            </div>
          </div>
          <div className="tile">
            <div className="tile-label">Exceptions</div>
            <div className="tile-value">{exceptions.length}</div>
            <div className="tile-sub">requiring review (below)</div>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <caption>Covered classes in today's read-through</caption>
            <thead>
              <tr>
                <th scope="col">Policy class</th>
                <th scope="col" className="num">
                  ½-step weight
                </th>
                <th scope="col" className="num">
                  Proxy return
                </th>
                <th scope="col" className="num">
                  Fund-level impact
                </th>
              </tr>
            </thead>
            <tbody>
              {readThrough.priced.map((p) => (
                <tr key={p.classLabel}>
                  <td>{p.classLabel}</td>
                  <td className="num">{fmtPct(p.weight, 1)}</td>
                  <td className="num">
                    <SignedPct v={p.dailyReturn} />
                  </td>
                  <td className="num">
                    <SignedPct v={p.impact} />
                  </td>
                </tr>
              ))}
              {readThrough.unpriced.map((u) => (
                <tr key={u.classLabel}>
                  <td>{u.classLabel}</td>
                  <td className="num">{fmtPct(u.weight, 1)}</td>
                  <td className="num" colSpan={2}>
                    <Pill tone="warn">excluded — unpriced</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="panel-note">
          <button className="linklike" onClick={copyBrief}>
            {copied ? 'Copied ✓' : 'Copy daily brief text'}
          </button>{' '}
          — generates the EOD narrative from these numbers for review before sending. Operational
          estimate until reconciled; the custodian remains the official book of record.
        </p>
      </section>

      {exceptions.length > 0 ? (
        <Panel
          title={`Exceptions requiring review (${exceptions.length})`}
          note="Staff analytics: factual states, not instructions. Out-of-range reports cite the IPS; nothing here recommends a trade."
        >
          <div className="table-scroll">
            <table>
              <caption>Derived from checks, market states, spans, and policy ranges</caption>
              <thead>
                <tr>
                  <th scope="col">Severity</th>
                  <th scope="col">Exception</th>
                  <th scope="col">Impact</th>
                  <th scope="col">Next action</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Pill tone={e.severity === 'fail' ? 'bad' : 'warn'}>{e.severity}</Pill>
                    </td>
                    <td>{e.description}</td>
                    <td className="footnote">{e.impact}</td>
                    <td className="footnote">{e.nextAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

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
          <div className="tile-sub">computed from unrounded values, matched periods</div>
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
          note="TWR-style monthly linking; no annualization below one year. Calculations use unrounded values; displayed values are rounded to 2 decimals."
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
                    <td className="num">
                      {p.spanMismatch ? <Pill tone="bad">span mismatch</Pill> : fmtPct(p.benchmark)}
                    </td>
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
          <details>
            <summary className="footnote">Monthly data table</summary>
            <div className="table-scroll">
              <table>
                <caption>Monthly returns and growth indexes (joined by month-end date)</caption>
                <thead>
                  <tr>
                    <th scope="col">Month end</th>
                    <th scope="col" className="num">
                      Portfolio return
                    </th>
                    <th scope="col" className="num">
                      Benchmark return
                    </th>
                    <th scope="col" className="num">
                      Portfolio index
                    </th>
                    <th scope="col" className="num">
                      Benchmark index
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dataset.joinedMonths.map((m) => (
                    <tr key={m.monthEnd}>
                      <td>{m.monthEnd}</td>
                      <td className="num">{fmtPct(m.portfolioReturn)}</td>
                      <td className="num">{fmtPct(m.benchmarkReturn)}</td>
                      <td className="num">{m.portfolioIndex?.toFixed(4) ?? '—'}</td>
                      <td className="num">{m.benchmarkIndex?.toFixed(4) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Panel>
      </div>

      <section className="panel market-strip" aria-labelledby="mkt-h">
        <h2 id="mkt-h">Market context — synthetic proxies, not portfolio performance</h2>
        <div className="table-scroll">
          <table>
            <caption>
              Final-day proxy moves. These are invented series demonstrating the market strip; only
              the mapped proxies feed the read-through above.
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
