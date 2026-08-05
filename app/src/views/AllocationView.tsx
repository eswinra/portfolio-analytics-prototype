import { catLabel, fmtMm, fmtPct, Panel, Pill, SignedPct, statusTone } from '../components/ui';
import { useDataset } from '../lib/dataset/useDataset';
import { weightsSumOk } from '../lib/finance/allocation';

/** Drill-down: actual vs effective-dated policy targets, in a compact table (clearer than a chart). */

export function AllocationView() {
  const { dataset } = useDataset();
  const { allocation, totalEmvMm, meta } = dataset;
  const sumOk = weightsSumOk(allocation);

  return (
    <>
      <h1>Allocation vs policy</h1>
      <p className="footnote">
        Synthetic DEMOFUND data as of {meta.asOf}. Targets come from the policy version effective on
        the as-of date; ranges are the demo policy half-widths. Overlays and Other Asset carry no
        policy weight.
      </p>
      <Panel
        title={`Actual vs target (total ${fmtMm(totalEmvMm)} $mm, synthetic)`}
        note={
          sumOk
            ? 'Actual weights sum to 100.0% (checked at import and at display).'
            : 'WARNING: actual weights do not sum to 100% — inspect the imported file.'
        }
      >
        <div className="table-scroll">
          <table>
            <caption>Allocation vs effective-dated policy targets</caption>
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
                <th scope="col">Range</th>
              </tr>
            </thead>
            <tbody>
              {allocation.map((a) => (
                <tr key={a.categoryId}>
                  <td>{catLabel(a.categoryId)}</td>
                  <td className="num">{fmtMm(a.emvMm)}</td>
                  <td className="num">{fmtPct(a.actualWeight)}</td>
                  <td className="num">
                    {a.targetWeight === null ? '—' : fmtPct(a.targetWeight, 1)}
                  </td>
                  <td className="num">
                    <SignedPct v={a.overUnderPct} />
                  </td>
                  <td className="num">{a.overUnderMm === null ? '—' : fmtMm(a.overUnderMm)}</td>
                  <td>
                    {a.rangeStatus === 'n/a' ? (
                      <span className="footnote">no policy weight</span>
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
    </>
  );
}
