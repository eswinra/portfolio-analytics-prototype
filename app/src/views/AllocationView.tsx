import { Link } from 'react-router-dom';

import { catLabel, fmtMm, fmtPct, Panel, Pill } from '../components/ui';
import { policyFor } from '../fixtures/policyPack';
import { useDataset } from '../lib/dataset/useDataset';
import { weightsSumOk, type AllocationStatus } from '../lib/finance/allocation';

/**
 * Allocation as policy-range bullets: min ── target ── max with the actual marker and
 * distance-to-boundary. Dollar figures live behind an expander so an over/under amount is
 * never mistaken for a recommended trade size.
 */

function BulletRow({ a }: { a: AllocationStatus }) {
  if (a.bandMin === null || a.bandMax === null || a.actualWeight === null) return null;
  // scale positions across the band with 20% padding either side
  const pad = (a.bandMax - a.bandMin) * 0.2;
  const lo = a.bandMin - pad;
  const hi = a.bandMax + pad;
  const pos = (v: number) => `${Math.min(Math.max(((v - lo) / (hi - lo)) * 100, 0), 100)}%`;
  const nearUpper =
    a.boundaryDistance !== null && a.bandMax - a.actualWeight <= a.actualWeight - a.bandMin;
  return (
    <div className="bullet-row">
      <div className="bullet-head">
        <strong>{catLabel(a.categoryId)}</strong>
        <span className="num">
          actual {fmtPct(a.actualWeight)} · target{' '}
          {a.targetWeight === null ? '—' : fmtPct(a.targetWeight, 1)}
        </span>
      </div>
      <div className="bullet-track" aria-hidden="true">
        <div
          className="bullet-band"
          style={{ left: pos(a.bandMin), width: `calc(${pos(a.bandMax)} - ${pos(a.bandMin)})` }}
        />
        {a.targetWeight !== null ? (
          <div className="bullet-target" style={{ left: pos(a.targetWeight) }} />
        ) : null}
        <div
          className={`bullet-actual ${a.rangeStatus === 'out' ? 'out' : ''}`}
          style={{ left: pos(a.actualWeight) }}
        />
        <span className="bullet-min">{fmtPct(a.bandMin, 0)}</span>
        <span className="bullet-max">{fmtPct(a.bandMax, 0)}</span>
      </div>
      <div className="bullet-caption">
        {a.rangeStatus === 'out' ? (
          <Pill tone="bad">Out of range</Pill>
        ) : a.nearBound ? (
          <Pill tone="warn">Near bound</Pill>
        ) : (
          <Pill tone="good">Within range</Pill>
        )}{' '}
        {a.boundaryDistance !== null ? (
          <span className="footnote">
            {(Math.abs(a.boundaryDistance) * 100).toFixed(2)} pp{' '}
            {a.boundaryDistance < 0
              ? 'outside the band'
              : `to ${nearUpper ? 'upper' : 'lower'} boundary`}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function AllocationView() {
  const { dataset } = useDataset();
  const { allocation, totalEmvMm, emvIncomplete, meta } = dataset;
  const pack = policyFor(meta.policyEntity);
  const sumOk = weightsSumOk(allocation);

  const policyRows = allocation.filter((a) => a.bandMin !== null && a.bandMax !== null);
  const nonPolicy = allocation.filter((a) => a.bandMin === null || a.bandMax === null);
  const nonPolicyWeight = nonPolicy.reduce((s, a) => s + (a.actualWeight ?? 0), 0);

  return (
    <>
      <h1>Allocation vs policy</h1>
      <p className="footnote">
        Synthetic {meta.entityId} data as of {meta.asOf}, measured against the {pack.entityLabel}{' '}
        IPS bands ({pack.version}; quoted tables under <Link to="/methodology">Methodology</Link>).
        Range status is a factual report — the IPS defines no mechanical trade trigger.
        {!sumOk ? ' WARNING: actual weights do not sum to 100% — inspect the imported file.' : ''}
      </p>

      <Panel title="Policy ranges">
        {policyRows.map((a) => (
          <BulletRow key={a.categoryId} a={a} />
        ))}
        <p className="panel-note">
          Non-policy exposures (Overlays &amp; Hedges, Other Asset): {fmtPct(nonPolicyWeight)} — 0%
          policy weight, not range-monitored. “Near bound” = within 1.0 pp of a policy boundary — an
          early warning, not a breach.
        </p>
      </Panel>

      <details className="panel">
        <summary>Dollar details — EMV and over/under amounts</summary>
        <p className="footnote" style={{ marginTop: '0.6rem' }}>
          {emvIncomplete
            ? 'A sleeve market value is missing: the total and dollar gaps are suppressed rather than computed from a partial sum.'
            : `Total ${fmtMm(totalEmvMm)} $mm (synthetic). Dollar over/under is descriptive staff analytics, not a recommended trade amount.`}
        </p>
        <div className="table-scroll">
          <table className="cardable">
            <caption>EMV and dollar over/under per category</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col" className="num">
                  EMV ($mm)
                </th>
                <th scope="col" className="num">
                  Over/under
                </th>
                <th scope="col" className="num">
                  Over/under ($mm)
                </th>
              </tr>
            </thead>
            <tbody>
              {allocation.map((a) => (
                <tr key={a.categoryId}>
                  <td data-label="Category">{catLabel(a.categoryId)}</td>
                  <td className="num" data-label="EMV ($mm)">
                    {fmtMm(a.emvMm)}
                  </td>
                  <td className="num" data-label="Over/under">
                    {a.overUnderPct === null ? '—' : fmtPct(a.overUnderPct)}
                  </td>
                  <td className="num" data-label="Over/under ($mm)">
                    {a.overUnderMm === null ? '—' : fmtMm(a.overUnderMm)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="footnote">
        Policy source: {pack.sourceDoc}, {pack.sourcePages}
        {dataset.policySource === 'dataset'
          ? ' — bands read from the dataset’s policy_target records (schema 1.1).'
          : ' — bundled policy pack.'}{' '}
        Confirm the governing policy version (long-term vs ½-step) before any compliance statement.
      </p>
    </>
  );
}
