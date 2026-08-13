import { useState } from 'react';
import { Link } from 'react-router-dom';

import { GrowthChart, type GrowthDatum } from '../charts/GrowthChart';
import { MonthlyReturnsChart } from '../charts/MonthlyReturnsChart';
import { ClassBadge, fmtPct, fmtSmartReturn, Pill, SignedPct, statusTone } from '../components/ui';
import { makeDailyBrief } from '../lib/dataset/brief';
import { useDataset } from '../lib/dataset/useDataset';

/**
 * Overview: how is THIS fund doing, at a glance — performance KPIs and two charts first,
 * then a compact daily proxy strip that explains itself (a flat day says why it is flat).
 */

export function PulseView() {
  const { dataset } = useDataset();
  const { readThrough, exceptions, allocation, periods, meta, marketDate, proxyStrip } = dataset;
  const [copied, setCopied] = useState(false);

  const breaches = allocation.filter((a) => a.rangeStatus === 'out').length;
  const nearBound = allocation.filter((a) => a.nearBound).length;
  const fytd = periods.find((p) => p.label.startsWith('Fiscal'));
  const qtd = periods.find((p) => p.label.startsWith('Quarter'));

  const growth: GrowthDatum[] = dataset.joinedMonths.map((m) => ({
    monthEnd: m.monthEnd,
    portfolio: m.portfolioIndex,
    benchmark: m.benchmarkIndex,
  }));
  const monthly = dataset.joinedMonths.map((m) => ({
    monthEnd: m.monthEnd,
    value: m.portfolioReturn,
  }));

  // when the daily read-through nets to ~flat, say why instead of just asserting it
  const impactBp = (readThrough.fundLevelImpact ?? 0) * 10000;
  const isFlat = readThrough.fundLevelImpact !== null && Math.abs(impactBp) < 0.5;
  const topDriver =
    readThrough.priced.length > 0
      ? readThrough.priced.reduce((a, b) => (Math.abs(b.impact) > Math.abs(a.impact) ? b : a))
      : null;
  const flatExplanation =
    isFlat && readThrough.priced.length >= 2
      ? `drivers offset: ${readThrough.priced
          .map((p) => `${p.classLabel} ${fmtSmartReturn(p.impact)}`)
          .join(', ')}`
      : null;

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
      <h1 className="visually-hidden">Overview</h1>
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
          <div className="tile-value">{fmtSmartReturn(fytd?.excess ?? null)}</div>
          <div className="tile-sub">
            {(fytd?.excess ?? 0) >= 0 ? 'ahead of' : 'trailing'} the synthetic policy benchmark
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">Quarter to date</div>
          <div className="tile-value">{fmtPct(qtd?.portfolio ?? null)}</div>
          <div className="tile-sub">
            vs benchmark {fmtPct(qtd?.benchmark ?? null)} · excess{' '}
            {fmtSmartReturn(qtd?.excess ?? null)}
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">Policy status</div>
          <div className="tile-value">
            {breaches > 0 ? (
              <Pill tone="bad">
                {breaches} breach{breaches === 1 ? '' : 'es'}
              </Pill>
            ) : nearBound > 0 ? (
              <Pill tone="warn">{nearBound} near bound</Pill>
            ) : (
              <Pill tone="good">0 breaches</Pill>
            )}
          </div>
          <div className="tile-sub">
            vs IPS ranges{nearBound > 0 && breaches > 0 ? ` · ${nearBound} near bound` : ''} ·{' '}
            <Link to="/allocation">allocation</Link>
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        <section className="panel" aria-labelledby="growth-h">
          <h2 id="growth-h">Growth of $1 vs benchmark</h2>
          <GrowthChart data={growth} />
        </section>
        <section className="panel" aria-labelledby="monthly-h">
          <h2 id="monthly-h">Monthly returns</h2>
          <MonthlyReturnsChart data={monthly} />
        </section>
      </div>

      <section className="panel pulse-strip" aria-labelledby="pulse-h">
        <h2 id="pulse-h">Today's proxy pulse — market data through {marketDate ?? 'n/a'}</h2>
        <div className="pulse-line">
          <span>
            Read-through: <strong>{fmtSmartReturn(readThrough.fundLevelImpact)}</strong>
            {flatExplanation ? <span className="footnote"> ({flatExplanation})</span> : null}
            {!isFlat && topDriver ? (
              <span className="footnote">
                {' '}
                (led by {topDriver.classLabel} {fmtSmartReturn(topDriver.impact)})
              </span>
            ) : null}
          </span>
          <span>
            Coverage: <strong>{fmtPct(readThrough.coverage, 1)}</strong> of policy weight
          </span>
          <span>
            {exceptions.length === 0 ? (
              <Pill tone="good">no data issues</Pill>
            ) : (
              <Pill tone={exceptions.some((e) => e.severity === 'fail') ? 'bad' : 'warn'}>
                {exceptions.length} data issue{exceptions.length === 1 ? '' : 's'}
              </Pill>
            )}{' '}
            <Link to="/exceptions">review →</Link>
          </span>
          <button className="linklike" onClick={copyBrief}>
            {copied ? 'Copied ✓' : 'Copy daily brief'}
          </button>
        </div>
        {exceptions.length > 0 ? (
          <ul className="issue-list">
            {exceptions.slice(0, 2).map((e) => (
              <li key={e.id}>
                <Pill tone={e.severity === 'fail' ? 'bad' : 'warn'}>{e.severity}</Pill>{' '}
                {e.description}
              </li>
            ))}
          </ul>
        ) : null}
        <details>
          <summary className="footnote">
            Proxy detail — per-class impacts, market context, methodology
          </summary>
          <p className="footnote" style={{ marginTop: '0.6rem' }}>
            Read-through = Σ({meta.policyEntity === 'OPEB' ? 'OPEB' : 'Pension'} IPS ½-step weight ×
            proxy daily return) over covered classes — a <ClassBadge c="proxy_estimate" />, never a
            portfolio return. Covered-basket return (renormalized over covered weight):{' '}
            <SignedPct v={readThrough.coveredBasketReturn} />. Private-market classes are excluded;
            their benchmarks are lagged 1–3 months per IPS Table 2 (
            <Link to="/methodology">reference</Link>
            ). Operational estimate until reconciled; the custodian remains the official book of
            record.
          </p>
          <div className="table-scroll">
            <table>
              <caption>Covered classes and impacts</caption>
              <thead>
                <tr>
                  <th scope="col">Policy class</th>
                  <th scope="col" className="num">
                    ½-step weight
                  </th>
                  <th scope="col" className="num">
                    Impact
                  </th>
                </tr>
              </thead>
              <tbody>
                {readThrough.priced.map((p) => (
                  <tr key={p.classLabel}>
                    <td>{p.classLabel}</td>
                    <td className="num">{fmtPct(p.weight, 1)}</td>
                    <td className="num">{fmtSmartReturn(p.impact)}</td>
                  </tr>
                ))}
                {readThrough.unpriced.map((u) => (
                  <tr key={u.classLabel}>
                    <td>{u.classLabel}</td>
                    <td className="num">{fmtPct(u.weight, 1)}</td>
                    <td className="num">
                      <span className="footnote">unpriced</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-scroll">
            <table>
              <caption>All synthetic market proxies (context only)</caption>
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
        </details>
      </section>
    </>
  );
}
