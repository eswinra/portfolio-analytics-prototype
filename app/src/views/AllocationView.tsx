import { Link } from 'react-router-dom';

import { catLabel, fmtMm, fmtPct, Panel, Pill, SignedPct, statusTone } from '../components/ui';
import { policyFor } from '../fixtures/policyPack';
import { useDataset } from '../lib/dataset/useDataset';
import { weightsSumOk } from '../lib/finance/allocation';

/** Drill-down: actual vs policy with real IPS bands, boundary distance, and suppression rules. */

export function AllocationView() {
  const { dataset } = useDataset();
  const { allocation, totalEmvMm, emvIncomplete, meta } = dataset;
  const pack = policyFor(meta.policyEntity);
  const sumOk = weightsSumOk(allocation);

  return (
    <>
      <h1>Allocation vs policy</h1>
      <p className="footnote">
        Synthetic {meta.entityId} data as of {meta.asOf}, measured against the range structure of
        the public {pack.entityLabel} IPS ({pack.version};{' '}
        <Link to="/policy">full policy tables</Link>). Over/under is recomputed as actual − target;
        imported derived fields are never trusted. Range status is a factual report — the IPS
        defines no mechanical trade trigger, so nothing here is a rebalancing instruction.
      </p>
      <Panel
        title={`Actual vs target (total ${emvIncomplete ? 'suppressed — sleeve missing' : `${fmtMm(totalEmvMm)} $mm`}, synthetic)`}
        note={
          (sumOk
            ? 'Actual weights sum to 100.0% (checked at import and at display). '
            : 'WARNING: actual weights do not sum to 100% — inspect the imported file. ') +
          (emvIncomplete
            ? 'A sleeve market value is missing, so the total and dollar gaps are suppressed rather than computed from a partial sum.'
            : '')
        }
      >
        <div className="table-scroll">
          <table className="cardable">
            <caption>
              Allocation vs IPS policy bands (explicit min/max; Cash-style asymmetry supported)
            </caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col" className="num">
                  EMV ($mm)
                </th>
                <th scope="col" className="num">
                  Actual
                </th>
                <th scope="col" className="num">
                  Target
                </th>
                <th scope="col" className="num">
                  Over/under
                </th>
                <th scope="col" className="num">
                  Over/under ($mm)
                </th>
                <th scope="col">Policy band</th>
                <th scope="col" className="num">
                  To boundary
                </th>
                <th scope="col">Range</th>
              </tr>
            </thead>
            <tbody>
              {allocation.map((a) => (
                <tr key={a.categoryId}>
                  <td data-label="Category">{catLabel(a.categoryId)}</td>
                  <td className="num" data-label="EMV ($mm)">
                    {fmtMm(a.emvMm)}
                  </td>
                  <td className="num" data-label="Actual">
                    {fmtPct(a.actualWeight)}
                  </td>
                  <td className="num" data-label="Target">
                    {a.targetWeight === null ? '—' : fmtPct(a.targetWeight, 1)}
                  </td>
                  <td className="num" data-label="Over/under">
                    <SignedPct v={a.overUnderPct} />
                  </td>
                  <td className="num" data-label="Over/under ($mm)">
                    {a.overUnderMm === null ? '—' : fmtMm(a.overUnderMm)}
                  </td>
                  <td data-label="Policy band">
                    {a.bandMin === null || a.bandMax === null ? (
                      <span className="footnote">no policy weight</span>
                    ) : (
                      `${fmtPct(a.bandMin, 0)} – ${fmtPct(a.bandMax, 0)}`
                    )}
                  </td>
                  <td className="num" data-label="To boundary">
                    {a.boundaryDistance === null ? '—' : fmtPct(a.boundaryDistance, 1)}
                  </td>
                  <td data-label="Range">
                    {a.rangeStatus === 'n/a' ? (
                      <span className="footnote">n/a</span>
                    ) : (
                      <Pill tone={statusTone(a.rangeStatus)}>
                        {a.rangeStatus === 'within' ? 'within range' : 'out of range'}
                      </Pill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <p className="footnote">
        Policy source: {pack.sourceDoc}, {pack.sourcePages}. Near-boundary distance is staff
        analytics, not a policy limit. Confirm the governing policy version (long-term vs ½-step)
        before any compliance statement.
      </p>
    </>
  );
}
