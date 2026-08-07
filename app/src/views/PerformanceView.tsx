import { GrowthChart, type GrowthDatum } from '../charts/GrowthChart';
import { ContributionBars } from '../charts/ContributionBars';
import { catLabel, fmtPct, fmtSmartReturn, Panel, Pill, statusTone } from '../components/ui';
import { useDataset } from '../lib/dataset/useDataset';
import type { ContributionEntry } from '../lib/dataset/model';
import type { Reconciliation } from '../lib/finance/contribution';

/** Performance: periods, growth, and contribution with its reconciliation — one page. */

/** Display-only tie-out (see the full-detail expander for the derivation). */
function roundingAdjustment(
  contributions: ContributionEntry[],
  reconciliation: Reconciliation | null,
): number | null {
  if (!reconciliation) return null;
  const r2 = (v: number) => Math.round(v * 10000) / 10000;
  const displayedSum =
    contributions.reduce((a, c) => a + r2(c.value), 0) + r2(reconciliation.residual);
  return r2(reconciliation.chainLinked) - displayedSum;
}

export function PerformanceView() {
  const { dataset } = useDataset();
  const { periods, contributions, reconciliation, meta } = dataset;

  const growth: GrowthDatum[] = dataset.joinedMonths.map((m) => ({
    monthEnd: m.monthEnd,
    portfolio: m.portfolioIndex,
    benchmark: m.benchmarkIndex,
  }));
  const arithDisplayed = contributions.reduce((a, c) => a + Math.round(c.value * 10000) / 10000, 0);
  const nonZero = contributions.filter((c) => c.value !== 0);

  return (
    <>
      <h1>Performance</h1>
      <p className="footnote">
        Synthetic {meta.entityId} data as of {meta.asOf}. Net-of-fees TWR-style monthly linking; no
        annualization below one year. Calculations use unrounded values; displays are rounded.
      </p>

      <div className="grid cols-2">
        <Panel
          title="Periods"
          note="Hurdle is a synthetic actuarial-style assumption (Pension 6.75% / OPEB 6.0% annual, geometrically scaled) — not the published actuarial rate."
        >
          <div className="table-scroll">
            <table>
              <caption>
                {meta.entityId} vs synthetic policy benchmark and hurdle, periods ended {meta.asOf}
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
                    <td className="num">{fmtSmartReturn(p.excess)}</td>
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
                      Portfolio
                    </th>
                    <th scope="col" className="num">
                      Benchmark
                    </th>
                    <th scope="col" className="num">
                      Port. index
                    </th>
                    <th scope="col" className="num">
                      Bench. index
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

      <div className="grid cols-2">
        <Panel
          title="Contribution — quarter to date"
          note="Beginning-of-month weight × monthly return, summed over the quarter. Zero-contribution categories are omitted from the chart and listed in the detail below."
        >
          <ContributionBars data={nonZero} />
        </Panel>

        <Panel title="Reconciliation">
          <div className="table-scroll">
            <table>
              <caption>Contribution ties to the chain-linked return (10 bp tolerance)</caption>
              <tbody>
                <tr>
                  <td>Displayed contributions</td>
                  <td className="num">{fmtPct(arithDisplayed)}</td>
                </tr>
                <tr>
                  <td>Compounding effect</td>
                  <td className="num">{fmtPct(reconciliation?.residual ?? null)}</td>
                </tr>
                <tr>
                  <td>Rounding adjustment</td>
                  <td className="num">
                    {fmtPct(roundingAdjustment(contributions, reconciliation))}
                  </td>
                </tr>
                <tr className="total-row">
                  <td>Chain-linked QTD return</td>
                  <td className="num">{fmtPct(reconciliation?.chainLinked ?? null)}</td>
                </tr>
                <tr>
                  <td>Status</td>
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
          <details>
            <summary className="footnote">Full reconciliation detail (all categories)</summary>
            <div className="table-scroll">
              <table>
                <caption>Per-category QTD contribution, including zero lines</caption>
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col" className="num">
                      Contribution
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
                    <td>Arithmetic total (unrounded)</td>
                    <td className="num">{fmtPct(reconciliation?.arithmeticTotal ?? null)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="panel-note">
              All categories are included — nothing is excluded by footnote. The compounding effect
              is the arithmetic-vs-geometric difference, not an error; the rounding adjustment makes
              the displayed column tie exactly.
            </p>
          </details>
        </Panel>
      </div>
    </>
  );
}
