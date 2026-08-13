import { useState } from 'react';

import { GrowthChart, type GrowthDatum } from '../charts/GrowthChart';
import { ContributionBars } from '../charts/ContributionBars';
import { FreshnessLine } from '../components/FreshnessLine';
import { catLabel, fmtMm, fmtPct, fmtSmartReturn, Panel, Pill, statusTone } from '../components/ui';
import { useDataset } from '../lib/dataset/useDataset';
import type { ContributionEntry, PeriodTriple } from '../lib/dataset/model';
import type { Reconciliation } from '../lib/finance/contribution';

/** Performance: periods, growth, and contribution with its reconciliation — one page. */

type SpanKey = '1M' | 'QTD' | 'FYTD' | 'ITD';
const SPAN_LABEL: Record<SpanKey, string> = {
  '1M': '1 month',
  QTD: 'Quarter to date',
  FYTD: 'Fiscal YTD (= 1Y)',
  ITD: 'Fiscal YTD (= 1Y)', // demo history begins 2025-07-01, so ITD ≡ FYTD
};

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
  const { periods, contributions, reconciliation, meta, pmSleeves } = dataset;
  const [span, setSpan] = useState<SpanKey>('QTD');

  const growth: GrowthDatum[] = dataset.joinedMonths.map((m) => ({
    monthEnd: m.monthEnd,
    portfolio: m.portfolioIndex,
    benchmark: m.benchmarkIndex,
  }));
  const arithDisplayed = contributions.reduce((a, c) => a + Math.round(c.value * 10000) / 10000, 0);
  const nonZero = contributions.filter((c) => c.value !== 0);

  // on-screen span reconciliation: chain the monthly TOTAL series over the selected window and
  // tie it to the exported period_return figure — the tie-out is visible, not asserted
  const target: PeriodTriple | undefined = periods.find((p) => p.label === SPAN_LABEL[span]);
  const spanMonths = target
    ? dataset.joinedMonths.filter(
        (m) => m.monthEnd >= target.periodStart && m.monthEnd <= target.periodEnd,
      )
    : [];
  const spanComplete = spanMonths.length > 0 && spanMonths.every((m) => m.portfolioReturn !== null);
  const chained = spanComplete
    ? spanMonths.reduce((g, m) => g * (1 + (m.portfolioReturn as number)), 1) - 1
    : null;
  const diffBp =
    chained !== null && target?.portfolio != null ? (chained - target.portfolio) * 10000 : null;

  return (
    <>
      <h1>Performance</h1>
      <FreshnessLine />
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
          <div role="group" aria-label="Reconcile a period" style={{ marginTop: '0.6rem' }}>
            {(['1M', 'QTD', 'FYTD', 'ITD'] as SpanKey[]).map((k) => (
              <button
                key={k}
                className="linklike"
                style={{ marginRight: '0.9rem', fontWeight: span === k ? 700 : 400 }}
                aria-pressed={span === k}
                onClick={() => setSpan(k)}
              >
                {k}
              </button>
            ))}
            <span className="footnote">
              {chained !== null && target?.portfolio != null && diffBp !== null ? (
                <>
                  chain-linked from the monthly series: <strong>{fmtPct(chained)}</strong> ·
                  exported: {fmtPct(target.portfolio)} · difference{' '}
                  {Math.abs(diffBp) < 0.05 ? '0.0' : Math.abs(diffBp).toFixed(1)} bp{' '}
                  <Pill tone={Math.abs(diffBp) <= 1 ? 'good' : 'warn'}>
                    {Math.abs(diffBp) <= 1 ? 'TIES' : 'CHECK'}
                  </Pill>
                  {span === 'ITD' ? ' · ITD = FYTD (demo history begins 2025-07-01)' : ''}
                </>
              ) : (
                'monthly series incomplete for this window — reconciliation suppressed'
              )}
            </span>
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

      {pmSleeves.length > 0 ? (
        <Panel
          title="Private markets — capital account monitoring (synthetic sleeve)"
          note="Files carry only the primitives; unfunded, DPI and TVPI are computed on screen — never imported. NAV valuations are lagged and say so; a ratio with zero called capital shows an em-dash, never a zero."
        >
          <div className="table-scroll">
            <table>
              <caption>
                Commitment, calls, distributions and lagged NAV per sleeve, with computed ratios
              </caption>
              <thead>
                <tr>
                  <th scope="col">Sleeve</th>
                  <th scope="col" className="num">
                    Commitment
                  </th>
                  <th scope="col" className="num">
                    Called
                  </th>
                  <th scope="col" className="num">
                    Unfunded*
                  </th>
                  <th scope="col" className="num">
                    Distributed
                  </th>
                  <th scope="col" className="num">
                    NAV
                  </th>
                  <th scope="col" className="num">
                    DPI*
                  </th>
                  <th scope="col" className="num">
                    TVPI*
                  </th>
                  <th scope="col">Valuation</th>
                </tr>
              </thead>
              <tbody>
                {pmSleeves.map((s) => (
                  <tr key={s.sleeveId}>
                    <td>
                      <code>{s.sleeveId}</code>
                    </td>
                    <td className="num">{fmtMm(s.commitmentMm)}</td>
                    <td className="num">{fmtMm(s.calledMm)}</td>
                    <td className="num">{fmtMm(s.unfundedMm)}</td>
                    <td className="num">{fmtMm(s.distributedMm)}</td>
                    <td className="num">{fmtMm(s.navMm)}</td>
                    <td className="num">{s.dpi === null ? '—' : `${s.dpi.toFixed(2)}x`}</td>
                    <td className="num">{s.tvpi === null ? '—' : `${s.tvpi.toFixed(2)}x`}</td>
                    <td>
                      <Pill tone={s.valuationStatus === 'final' ? 'good' : 'warn'}>
                        {s.valuationStatus}
                      </Pill>
                      <div className="footnote">{s.lagNote}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-note">
            * computed: unfunded = commitment − called; DPI = distributed ÷ called; TVPI =
            (distributed + NAV) ÷ called. All figures $mm, synthetic.
          </p>
        </Panel>
      ) : null}
    </>
  );
}
