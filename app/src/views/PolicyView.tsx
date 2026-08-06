import { ClassBadge, fmtPct, Panel } from '../components/ui';
import { policyFor } from '../fixtures/policyPack';
import { useDataset } from '../lib/dataset/useDataset';

/**
 * IPS policy reference: explicit min/target/max bands, ½-step targets, benchmarks with lags.
 * The fund shown follows the MAIN masthead Pension/OPEB switch — no separate toggle here.
 */

export function PolicyView() {
  const { dataset } = useDataset();
  const entity = policyFor(dataset.meta.policyEntity);
  const policyRecordCount = dataset.policyRecordCount;

  return (
    <>
      <h1>IPS policy reference — {entity.entityLabel}</h1>
      <p className="footnote">
        Quoted from the public LACERA Investment Policy Statements (
        <ClassBadge c="reported_public" /> — the only non-synthetic content in this app besides the
        cited values on Data quality). Bands are stored as explicit minimum / target / maximum
        because the source uses asymmetric ranges — Pension Cash is 1% with +2/−1, i.e. 0–3%. Switch
        funds with the Pension/OPEB tabs in the header.
      </p>
      {policyRecordCount > 0 ? (
        <p className="footnote">
          The active dataset carries <strong>{policyRecordCount}</strong> category-level{' '}
          <code>policy_target</code> records (contract schema 1.1) — the allocation bands on this
          fund's views come from the dataset, cross-checked against the bundled pack below.
        </p>
      ) : null}

      <Panel
        title={`${entity.entityLabel} — approved asset allocation`}
        note={`${entity.policyName}, ${entity.version}. Source: ${entity.sourceDoc}, ${entity.sourcePages}. ½-step transition targets effective ${entity.halfStepEffective}.`}
      >
        <div className="table-scroll">
          <table>
            <caption>
              Long-term targets with explicit min/max bands, plus dated ½-step transition targets
            </caption>
            <thead>
              <tr>
                <th scope="col">Asset class</th>
                <th scope="col" className="num">
                  Min
                </th>
                <th scope="col" className="num">
                  Target
                </th>
                <th scope="col" className="num">
                  Max
                </th>
                <th scope="col" className="num">
                  ½-step {entity.halfStepEffective}
                </th>
                <th scope="col">Benchmark (Table 2)</th>
                <th scope="col" className="num">
                  Lag
                </th>
              </tr>
            </thead>
            <tbody>
              {entity.bands.map((band) => (
                <tr key={band.classId} className={band.parent === undefined ? 'total-row' : ''}>
                  <td style={band.parent !== undefined ? { paddingLeft: '1.6rem' } : undefined}>
                    {band.label}
                  </td>
                  <td className="num">{fmtPct(band.min, 0)}</td>
                  <td className="num">{fmtPct(band.target, 0)}</td>
                  <td className="num">{fmtPct(band.max, 0)}</td>
                  <td className="num">{fmtPct(band.halfStepTarget, 1)}</td>
                  <td className="footnote">{band.benchmark}</td>
                  <td className="num">
                    {band.benchmarkLagMonths > 0 ? `${band.benchmarkLagMonths} mo` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Source and interpretation notes">
        <ul className="footnote">
          {entity.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
          <li>
            Lagged benchmarks mean current private-market values must never be compared with
            unlagged public indexes; the lag is stored as structured metadata, not prose.
          </li>
          <li>
            The IPS requires allocation monitoring and rebalancing but defines no mechanical trade
            trigger, cure period, or warning level — range status here is a factual report, and
            near-boundary flags are staff analytics, not policy limits.
          </li>
        </ul>
      </Panel>
    </>
  );
}
