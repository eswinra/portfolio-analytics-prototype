import { useState } from 'react';
import { Link } from 'react-router-dom';

import { ClassBadge, fmtPct, fmtSmartReturn, Pill, SignedPct, statusTone } from '../components/ui';
import { makeDailyBrief } from '../lib/dataset/brief';
import { useDataset } from '../lib/dataset/useDataset';

/**
 * The first screen: what moved, how much of the fund that represents, what needs attention,
 * and whether allocations are within policy. Everything else is one click away.
 */

export function PulseView() {
  const { dataset } = useDataset();
  const { readThrough, exceptions, allocation, periods, meta, marketDate, proxyStrip } = dataset;
  const [copied, setCopied] = useState(false);

  const breaches = allocation.filter((a) => a.rangeStatus === 'out').length;
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
      <h1 className="visually-hidden">Daily proxy pulse</h1>
      <div className="tile-row">
        <div className="tile">
          <div className="tile-label">Covered-proxy impact</div>
          <div className="tile-value">{fmtSmartReturn(readThrough.fundLevelImpact)}</div>
          <div className="tile-sub">
            policy-weighted, {meta.policyEntity === 'OPEB' ? 'OPEB' : 'Pension'} ½-step weights ·{' '}
            <ClassBadge c="proxy_estimate" />
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">Policy-weight coverage</div>
          <div className="tile-value">{fmtPct(readThrough.coverage, 1)}</div>
          <div className="tile-sub">of policy weight has a priced liquid proxy</div>
        </div>
        <div className="tile">
          <div className="tile-label">Policy status</div>
          <div className="tile-value">
            {breaches === 0 ? (
              <Pill tone="good">0 breaches</Pill>
            ) : (
              <Pill tone="bad">
                {breaches} breach{breaches === 1 ? '' : 'es'}
              </Pill>
            )}
          </div>
          <div className="tile-sub">
            vs IPS ranges · <Link to="/allocation">allocation</Link>
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">Data issues</div>
          <div className="tile-value">
            {exceptions.length === 0 ? (
              <Pill tone="good">none</Pill>
            ) : (
              <Pill tone={exceptions.some((e) => e.severity === 'fail') ? 'bad' : 'warn'}>
                {exceptions.length} need review
              </Pill>
            )}
          </div>
          <div className="tile-sub">
            <Link to="/exceptions">exceptions</Link>
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        <section className="panel" aria-labelledby="drivers-h">
          <h2 id="drivers-h">Today's covered drivers</h2>
          <div className="table-scroll">
            <table>
              <caption>
                Fund-level impact per covered policy class, market data through{' '}
                {marketDate ?? 'n/a'}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Policy class</th>
                  <th scope="col" className="num">
                    Impact
                  </th>
                </tr>
              </thead>
              <tbody>
                {readThrough.priced.map((p) => (
                  <tr key={p.classLabel}>
                    <td>{p.classLabel}</td>
                    <td className="num">{fmtSmartReturn(p.impact)}</td>
                  </tr>
                ))}
                {readThrough.unpriced.map((u) => (
                  <tr key={u.classLabel}>
                    <td>{u.classLabel}</td>
                    <td className="num">
                      <span className="footnote">unpriced</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel" aria-labelledby="review-h">
          <h2 id="review-h">Needs review</h2>
          {exceptions.length === 0 ? (
            <p className="footnote">No open issues.</p>
          ) : (
            <ul className="issue-list">
              {exceptions.slice(0, 3).map((e) => (
                <li key={e.id}>
                  <Pill tone={e.severity === 'fail' ? 'bad' : 'warn'}>{e.severity}</Pill>{' '}
                  {e.description}
                </li>
              ))}
            </ul>
          )}
          <p className="panel-note">
            <Link to="/exceptions">View all issues →</Link>
          </p>
        </section>
      </div>

      <p className="pulse-context">
        Periodic context: FYTD <strong>{fmtPct(fytd?.portfolio ?? null)}</strong> vs benchmark{' '}
        {fmtPct(fytd?.benchmark ?? null)} · excess {fmtSmartReturn(fytd?.excess ?? null)} ·{' '}
        <Link to="/performance">view performance details</Link>
      </p>

      <p>
        <button className="linklike" onClick={copyBrief}>
          {copied ? 'Copied ✓' : 'Copy daily brief'}
        </button>
      </p>

      <details className="panel">
        <summary>Proxy detail — coverage math, market context, methodology</summary>
        <p className="footnote" style={{ marginTop: '0.6rem' }}>
          Read-through = Σ(policy ½-step weight × proxy daily return) over covered classes — a proxy
          estimate of the market move, never a portfolio return. Covered-basket return (renormalized
          over covered weight): <SignedPct v={readThrough.coveredBasketReturn} />. Private-market
          classes are excluded; their benchmarks are lagged 1–3 months per IPS Table 2 (
          <Link to="/policy">policy</Link>). Operational estimate until reconciled; the custodian
          remains the official book of record.
        </p>
        <div className="table-scroll">
          <table>
            <caption>
              All synthetic market proxies (context only; mapped rows feed the pulse)
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
      </details>
    </>
  );
}
