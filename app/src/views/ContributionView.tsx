import { ContributionBars } from '../charts/ContributionBars';
import { catLabel, fmtPct, Panel, Pill, statusTone } from '../components/ui';
import { useDataset } from '../lib/dataset/useDataset';
import type { ContributionEntry } from '../lib/dataset/model';
import type { Reconciliation } from '../lib/finance/contribution';

/** Drill-down: what drove the quarter, with the reconciliation shown, not implied. */

/**
 * Display-only tie-out: the difference between the chain-linked value rounded to the display
 * precision and the sum of the individually rounded lines. Makes the visible column re-total
 * exactly; carries no analytical meaning.
 */
function roundingAdjustment(
  contributions: ContributionEntry[],
  reconciliation: Reconciliation | null,
): number | null {
  if (!reconciliation) return null;
  const r2 = (v: number) => Math.round(v * 10000) / 10000; // 2 display decimals of percent
  const displayedSum =
    contributions.reduce((a, c) => a + r2(c.value), 0) + r2(reconciliation.residual);
  return r2(reconciliation.chainLinked) - displayedSum;
}

export function ContributionView() {
  const { dataset } = useDataset();
  const { contributions, reconciliation, meta } = dataset;

  return (
    <>
      <h1>Contribution — quarter to date</h1>
      <p className="footnote">
        Synthetic DEMOFUND data as of {meta.asOf}. Contribution = beginning-of-month weight ×
        monthly return, summed over the quarter. The compounding residual against the chain-linked
        return is disclosed below and tested against a 10 bp tolerance.
      </p>
      <div className="grid cols-2">
        <Panel title="Contribution by category">
          <ContributionBars data={contributions} />
        </Panel>
        <Panel title="Reconciliation">
          <div className="table-scroll">
            <table>
              <caption>Category contributions reconcile to the displayed total</caption>
              <thead>
                <tr>
                  <th scope="col">Line</th>
                  <th scope="col" className="num">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {contributions.map((c) => (
                  <tr key={c.categoryId}>
                    <td>{catLabel(c.categoryId)}</td>
                    <td className="num">{fmtPct(c.value)}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td>Arithmetic total</td>
                  <td className="num">{fmtPct(reconciliation?.arithmeticTotal ?? null)}</td>
                </tr>
                <tr>
                  <td>Chain-linked QTD return</td>
                  <td className="num">{fmtPct(reconciliation?.chainLinked ?? null)}</td>
                </tr>
                <tr>
                  <td>Compounding residual</td>
                  <td className="num">{fmtPct(reconciliation?.residual ?? null)}</td>
                </tr>
                <tr>
                  <td>Rounding adjustment (display only)</td>
                  <td className="num">
                    {fmtPct(roundingAdjustment(contributions, reconciliation))}
                  </td>
                </tr>
                <tr className="total-row">
                  <td>Displayed lines re-total</td>
                  <td className="num">{fmtPct(reconciliation?.chainLinked ?? null)}</td>
                </tr>
                <tr>
                  <td>Status (tolerance {fmtPct(reconciliation?.tolerance ?? null)})</td>
                  <td className="num">
                    {reconciliation ? (
                      <Pill tone={statusTone(reconciliation.status)}>{reconciliation.status}</Pill>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="panel-note">
            All six categories are included — nothing is excluded by footnote. The residual is the
            arithmetic-vs-geometric compounding difference, not an error; it must simply stay within
            tolerance. Calculations use unrounded values; displayed values are rounded to two
            decimals, and the rounding-adjustment line makes the displayed column tie exactly.
          </p>
        </Panel>
      </div>
    </>
  );
}
