import { Fragment } from 'react';

import { DateLine } from '../components/DateLine';
import { ClassBadge, excessTag, Panel, SourceLine, Tag, type TagVariant } from '../components/ui';
import {
  BINS,
  CIO_VINTAGE,
  cioFor,
  MACRO,
  MKT,
  OPS,
  PERIOD_INDEX,
  PERIODS,
  STATUS,
  type OpsStatus,
} from '../fixtures/cioMonthly';
import { useEntity } from '../lib/entity';

/** CIO Monthly — the monthly vintage (CIO Monthly Report, July 8, 2026; data through May 31,
 *  2026) rendered as dashboard panels from the same fixture that feeds the slide deck at /deck/.
 *  Deliberately separate from the fiscal-year tabs: nothing here is combined with FY2025. */

const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`;
const signed = (v: number, dp = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(dp)}`;
const mm = (v: number) => v.toLocaleString('en-US');
const moneyMm = (v: number) => `${v < 0 ? '−' : ''}$${mm(Math.abs(v))}M`;

const STATUS_VARIANT: Record<OpsStatus, TagVariant> = {
  prog: 'accent',
  dev: 'neutral',
  info: 'outline',
  quiet: 'blocked',
};

export function CioMonthlyView() {
  const { entity } = useEntity();
  const P = entity === 'PENSION';
  const e = cioFor(entity);
  const src = P ? 'CIO_PENSION' : 'CIO_OPEB';
  const geoSrc = P ? 'CIO_PENSION_GEO' : 'CIO_OPEB_GEO';
  const { oneMonth, fytd, oneYear } = PERIOD_INDEX;
  const excess = (i: number) => e.total.r[i]! - e.total.b[i]!;

  // proxy attribution, as on the deck's slide 4: (composite return − its benchmark) × month-end
  // weight; the residual carries everything the proxy cannot see (allocation effect, overlays,
  // cash, compounding, beginning-of-period weights) and is shown, never hidden
  const attribution = [fytd, oneYear].map((i) => {
    const rows = e.comps.map((c) => ({
      label: c.short,
      contrib: c.r[i] !== null && c.b[i] !== null ? (c.r[i]! - c.b[i]!) * (c.pct / 100) : null,
    }));
    const explained = rows.reduce((s, r) => s + (r.contrib ?? 0), 0);
    const total = excess(i);
    return { period: PERIODS[i]!, rows, explained, total, residual: total - explained };
  });

  const histMax = Math.max(...e.hist.c);

  return (
    <>
      <DateLine
        report={CIO_VINTAGE.reportDate}
        dataThrough={CIO_VINTAGE.dataThrough}
        retrieved={`the ${CIO_VINTAGE.title} of ${CIO_VINTAGE.reportDate}`}
      />
      <div className="muted-note vintage-note" role="note">
        <strong>Monthly vintage, kept apart from the fiscal-year tabs.</strong> This tab quotes the{' '}
        {CIO_VINTAGE.title} of {CIO_VINTAGE.reportDate}, with data through {CIO_VINTAGE.dataThrough}
        . The fund's market value here is not the June 30, 2025 fiduciary net position on the
        Overview, and monthly periods are not fiscal-year horizons; the two vintages are never
        combined. The same figures drive the <a href="deck/">slide deck</a>.
      </div>

      <div className="grid-kpi">
        <Panel tight kicker="Total fund market value">
          <div className="stat-value">${e.aum.toFixed(1)}B</div>
          <div className="stat-sub">
            ${mm(e.mv)}M · cash and equivalents ${mm(e.cash)}M
          </div>
        </Panel>
        <Panel tight kicker="Net return — 1 month">
          <div className="stat-value">{pct(e.total.r[oneMonth])}</div>
          <div className="stat-sub">
            Policy benchmark {pct(e.total.b[oneMonth])} · {signed(excess(oneMonth))} pp
          </div>
        </Panel>
        <Panel tight kicker="Net return — fiscal year to date">
          <div className="stat-value">{pct(e.total.r[fytd])}</div>
          <div className="stat-sub">
            Benchmark {pct(e.total.b[fytd])} · actuarial hurdle {pct(e.total.h[fytd])}
          </div>
        </Panel>
        <Panel tight kicker="Net return — 1 year">
          <div className="stat-value">{pct(e.total.r[oneYear])}</div>
          <div className="stat-sub">
            Policy benchmark {pct(e.total.b[oneYear])} · {signed(excess(oneYear))} pp
          </div>
        </Panel>
      </div>
      <div className="kpi-provenance">
        <ClassBadge c="reported_public" />
        <span>
          Figures as printed in the CIO Monthly Report ({e.pages}); differences are calculated from
          the printed one-decimal values, so ±0.1 pp rounding is possible.
        </span>
        <SourceLine sources={[src]} />
      </div>

      <div className="grid-panels mt">
        <Panel
          kicker="Net of fees — total fund"
          title="Performance vs. policy benchmark and actuarial hurdle"
          sub={CIO_VINTAGE.periodNote}
        >
          <div
            className="table-scroll"
            role="region"
            aria-label="Performance by period"
            tabIndex={0}
          >
            <table className="table">
              <caption>
                Total fund return, policy benchmark, excess, and actuarial hurdle by period
              </caption>
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  <th scope="col" className="num">
                    Fund
                  </th>
                  <th scope="col" className="num">
                    Benchmark
                  </th>
                  <th scope="col" className="num">
                    Excess
                  </th>
                  <th scope="col" className="num">
                    Hurdle
                  </th>
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((p, i) => {
                  const t = excessTag(e.total.r[i]!, e.total.b[i]!);
                  return (
                    <tr key={p}>
                      <td>{p}</td>
                      <td className="num" style={{ fontWeight: 500 }}>
                        {pct(e.total.r[i])}
                      </td>
                      <td className="num">{pct(e.total.b[i])}</td>
                      <td className="num">
                        <Tag variant={t.variant}>{t.text}</Tag>
                      </td>
                      <td className="num">{pct(e.total.h[i])}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="panel-note">
            Excess = fund − benchmark (calculated). The actuarial hurdle applies at the total-fund
            level only; FYTD equals 1 Y in this report because the fiscal year ends June 30.
          </p>
          <SourceLine sources={[src]} />
        </Panel>

        <Panel
          kicker="Where the benchmark gap came from"
          title="Composite excess × month-end weight"
          sub="Proxy estimate — a pointer to where to look, not a manager value-add figure"
        >
          <div className="kpi-provenance" style={{ marginTop: 0, marginBottom: 8 }}>
            <ClassBadge c="proxy_estimate" />
            <span>
              Contribution = (composite return − its policy benchmark) × May 31 weight. Not the
              report's attribution and not a Brinson decomposition.
            </span>
          </div>
          <div className="table-scroll" role="region" aria-label="Gap attribution" tabIndex={0}>
            <table className="table">
              <caption>Contribution to total-fund excess, percentage points</caption>
              <thead>
                <tr>
                  <th scope="col">Composite</th>
                  {attribution.map((a) => (
                    <th scope="col" className="num" key={a.period}>
                      {a.period}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {e.comps.map((c, ci) => (
                  <tr key={c.k}>
                    <td>{c.short}</td>
                    {attribution.map((a) => {
                      const v = a.rows[ci]!.contrib;
                      return (
                        <td className="num" key={a.period}>
                          {v === null ? '—' : `${signed(v, 2)} pp`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr style={{ fontWeight: 600 }}>
                  <td>Explained by the proxy</td>
                  {attribution.map((a) => (
                    <td className="num" key={a.period}>
                      {signed(a.explained, 2)} pp
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Residual (allocation, overlays, cash, compounding)</td>
                  {attribution.map((a) => (
                    <td className="num" key={a.period}>
                      {signed(a.residual, 2)} pp
                    </td>
                  ))}
                </tr>
                <tr style={{ fontWeight: 600 }}>
                  <td>Total-fund excess (reported fund − benchmark)</td>
                  {attribution.map((a) => (
                    <td className="num" key={a.period}>
                      {signed(a.total, 1)} pp
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="panel-note">
            Beginning-of-period weights, the allocation effect, overlays, cash and compounding are
            all folded into the residual, shown so the reader can see how much the proxy explains.
          </p>
          <SourceLine sources={[src]} />
        </Panel>
      </div>

      <Panel
        className="mt"
        kicker="Composites — May 31, 2026"
        title="Market value, weight vs. 2024 SAA target, and returns vs. benchmark"
      >
        <div className="table-scroll" role="region" aria-label="Composites" tabIndex={0}>
          <table className="table cardable">
            <caption>
              Drift = weight − target (calculated). Return cells show composite / policy benchmark.
            </caption>
            <thead>
              <tr>
                <th scope="col">Composite</th>
                <th scope="col" className="num">
                  Market value ($M)
                </th>
                <th scope="col" className="num">
                  Weight
                </th>
                <th scope="col" className="num">
                  Target
                </th>
                <th scope="col" className="num">
                  Drift
                </th>
                <th scope="col" className="num">
                  1 M
                </th>
                <th scope="col" className="num">
                  FYTD
                </th>
                <th scope="col" className="num">
                  1 Y
                </th>
              </tr>
            </thead>
            <tbody>
              {e.comps.map((c) => (
                <tr key={c.k}>
                  <td data-label="Composite">{c.n}</td>
                  <td className="num" data-label="Market value ($M)">
                    {mm(c.mv)}
                  </td>
                  <td className="num" data-label="Weight" style={{ fontWeight: 500 }}>
                    {c.pct.toFixed(1)}%
                  </td>
                  <td className="num" data-label="Target">
                    {c.tgt.toFixed(1)}%
                  </td>
                  <td className="num" data-label="Drift">
                    {signed(c.pct - c.tgt)} pp
                  </td>
                  {[oneMonth, fytd, oneYear].map((i) => (
                    <td className="num" data-label={PERIODS[i]} key={i}>
                      {pct(c.r[i])} / {pct(c.b[i])}
                    </td>
                  ))}
                </tr>
              ))}
              {e.other ? (
                <tr>
                  <td data-label="Composite">{e.other.n}</td>
                  <td className="num" data-label="Market value ($M)">
                    {mm(e.other.mv)}
                  </td>
                  <td className="num" data-label="Weight">
                    {e.other.pct.toFixed(1)}%
                  </td>
                  <td className="num" data-label="Target">
                    —
                  </td>
                  <td className="num" data-label="Drift">
                    no policy weight
                  </td>
                  <td className="num" data-label="1 M">
                    —
                  </td>
                  <td className="num" data-label="FYTD">
                    —
                  </td>
                  <td className="num" data-label="1 Y">
                    —
                  </td>
                </tr>
              ) : null}
              <tr style={{ fontWeight: 600 }}>
                <td data-label="Composite">{e.name}</td>
                <td className="num" data-label="Market value ($M)">
                  {mm(e.mv)}
                </td>
                <td className="num" data-label="Weight">
                  100.0%
                </td>
                <td className="num" data-label="Target">
                  100.0%
                </td>
                <td className="num" data-label="Drift">
                  —
                </td>
                {[oneMonth, fytd, oneYear].map((i) => (
                  <td className="num" data-label={PERIODS[i]} key={i}>
                    {pct(e.total.r[i])} / {pct(e.total.b[i])}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="panel-note">
          Policy ranges live in the IPS, not the monthly report, so no in/out-of-range judgement is
          drawn here — see the Allocation tab for the ranges. Composites have no 10-year figure in
          the report. Real estate and private equity values are best-available cash-flow-adjusted
          market values.
        </p>
        <SourceLine sources={[src]} />
      </Panel>

      <div className="grid-panels mt">
        <Panel kicker="May 2026 rebalancing activity" title="Flows by composite">
          <div>
            {e.comps.map((c) => (
              <div className="flow-row" key={c.k}>
                <span>{c.short}</span>
                <span className="v">{moneyMm(c.flow)}</span>
              </div>
            ))}
            {e.other ? (
              <div className="flow-row">
                <span>{e.other.n}</span>
                <span className="v">{moneyMm(e.other.flow)}</span>
              </div>
            ) : null}
            <div className="flow-row">
              <span style={{ fontWeight: 600 }}>Net flow</span>
              <span className="v">{moneyMm(e.netflow)}</span>
            </div>
          </div>
          {e.overlays ? (
            <div className="table-scroll" style={{ marginTop: 14 }}>
              <table className="table">
                <caption>Overlay programs — gains, $ millions</caption>
                <thead>
                  <tr>
                    <th scope="col">Program</th>
                    <th scope="col" className="num">
                      May 2026
                    </th>
                    <th scope="col" className="num">
                      Since inception
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {e.overlays.map((o) => (
                    <tr key={o.n}>
                      <td>{o.n}</td>
                      <td className="num">{o.may.toFixed(1)}</td>
                      <td className="num">{o.si.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="panel-note">
            Flows may include capital calls, distributions and cash management, so a flow away from
            target is a prompt for a question, not a finding.
            {P
              ? ' Overlay gains are Total Fund only.'
              : ' The report prints no overlay programs for the OPEB Master Trust.'}
          </p>
          <SourceLine sources={['CIO_FLOWS']} />
        </Panel>

        <Panel
          kicker="Monthly return distribution — last 120 months"
          title="Months by return bin"
          sub="Counts as printed; bin edges as printed"
        >
          <div className="table-scroll" role="region" aria-label="Return distribution" tabIndex={0}>
            <table className="table">
              <caption>
                Number of months in each monthly-return bin (percent); bar length is relative to the
                fullest bin
              </caption>
              <thead>
                <tr>
                  <th scope="col">Bin (%)</th>
                  <th scope="col" className="num">
                    Months
                  </th>
                  <th scope="col">Relative frequency</th>
                </tr>
              </thead>
              <tbody>
                {BINS.map((b, i) => (
                  <tr key={b}>
                    <td>
                      {b}
                      {i === e.hist.latestBin ? (
                        <>
                          {' '}
                          <Tag variant="accent">latest month</Tag>
                        </>
                      ) : null}
                    </td>
                    <td className="num">{e.hist.c[i]}</td>
                    <td className="hist-cell">
                      <div
                        className={`fill${i === e.hist.latestBin ? ' hi' : ''}`}
                        style={{ width: `${((e.hist.c[i]! / histMax) * 100).toFixed(1)}%` }}
                        aria-hidden="true"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-note">
            Mean {pct(e.hist.mean)} · 2024 SAA expected {pct(e.hist.saa)} · standard deviation{' '}
            {pct(e.hist.sd)} · min {pct(e.hist.min)} · max {pct(e.hist.max)} · latest month{' '}
            {pct(e.hist.latest)} (placed by value). The forecast-volatility pages are image-only in
            the PDF and are not reproduced.
          </p>
          <SourceLine sources={[src]} />
        </Panel>
      </div>

      <Panel
        className="mt"
        kicker="Market context — not fund performance"
        title="Index returns by period"
        sub="Index moves explain the environment the benchmarks moved in, not the Fund's result against them"
      >
        <div className="table-scroll" role="region" aria-label="Market context" tabIndex={0}>
          <table className="table">
            <caption>
              Total-return indices as printed in the report (Bloomberg, State Street)
            </caption>
            <thead>
              <tr>
                <th scope="col">Index</th>
                {PERIODS.map((p) => (
                  <th scope="col" className="num" key={p}>
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MKT.map((g) => (
                <Fragment key={g.g}>
                  <tr>
                    <td colSpan={PERIODS.length + 1} style={{ fontWeight: 600 }}>
                      {g.g}
                    </td>
                  </tr>
                  {g.rows.map((row) => (
                    <tr key={row.n}>
                      <td style={{ paddingLeft: 26 }}>
                        {row.n}
                        <div className="footnote">{row.i}</div>
                      </td>
                      {row.v.map((v, i) => (
                        <td className="num" key={PERIODS[i]}>
                          {pct(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="panel-note">
          NCREIF ODCE (net) is the latest available quarter. Kept separate from fund performance by
          design.
        </p>
        <SourceLine sources={['CIO_MARKET']} />
      </Panel>

      <div className="grid-panels mt">
        <Panel kicker="Key macro indicators and themes" title="Macro strip">
          <div>
            {MACRO.map((m) => (
              <div className="flow-row" key={m.l}>
                <span>
                  {m.l}
                  <div className="footnote">{m.s}</div>
                </span>
                <span className="v">{m.v}</span>
              </div>
            ))}
          </div>
          <SourceLine sources={['CIO_MACRO']} />
        </Panel>

        <Panel
          kicker={`Geographic exposure by AUM — ${e.short}`}
          title={`Developed ${e.geo.dm}% · emerging ${e.geo.em}% · ${e.geo.total} markets`}
          sub={`${e.geo.dmN} developed and ${e.geo.emN} emerging markets; the report's top five in each group`}
        >
          <div className="table-scroll" role="region" aria-label="Geographic exposure" tabIndex={0}>
            <table className="table">
              <caption>Top five countries in each market group, percent of AUM</caption>
              <thead>
                <tr>
                  <th scope="col">Country</th>
                  <th scope="col">Group</th>
                  <th scope="col" className="num">
                    % of AUM
                  </th>
                </tr>
              </thead>
              <tbody>
                {e.geo.top.map(([country, share, group]) => (
                  <tr key={country}>
                    <td>{country}</td>
                    <td>{group === 'dm' ? 'Developed' : 'Emerging'}</td>
                    <td className="num">{share.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-note">
            Exposure excludes overlays and hedges and is based on the domicile country of each
            security or asset (MSCI Market Classification Framework); best available holdings-level
            transparency. The remaining markets are not itemized in the report.
          </p>
          <SourceLine sources={[geoSrc]} />
        </Panel>
      </div>

      <Panel
        className="mt"
        kicker="Portfolio, structural and operational items"
        title="Items for attention"
        sub="Statuses as printed; the report gives no dates or owners"
      >
        <div className="table-scroll" role="region" aria-label="Items for attention" tabIndex={0}>
          <table className="table">
            <caption>Key initiatives, personnel searches, manager and consultant updates</caption>
            <thead>
              <tr>
                <th scope="col">Scope</th>
                <th scope="col">Item</th>
                <th scope="col">Status</th>
                <th scope="col" className="num">
                  p.
                </th>
              </tr>
            </thead>
            <tbody>
              {OPS.map((o) => (
                <tr key={`${o.e}|${o.item}`}>
                  <td>{o.e}</td>
                  <td>{o.item}</td>
                  <td>
                    <Tag variant={STATUS_VARIANT[o.st]}>{STATUS[o.st][0]}</Tag>
                  </td>
                  <td className="num">{o.p}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="panel-note">
          “For attention” groups a named manager personnel change and an external search in quiet
          period — an editorial grouping to help the reader, not a report category.
        </p>
        <SourceLine sources={['CIO_OPS']} />
      </Panel>
    </>
  );
}
