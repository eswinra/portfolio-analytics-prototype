import { n, Panel, SourceLine } from '../components/ui';
import { PENSION_EQUITY, publishedFor } from '../fixtures/published';
import { useEntity } from '../lib/entity';

/** Holdings & Managers — largest equity/fixed income holdings and investment management fees
 *  by asset class, quoted from the 2025 ACFR (pp. 114–116). */

export function HoldingsView() {
  const { entity } = useEntity();
  const d = publishedFor(entity);
  const P = entity === 'PENSION';

  return (
    <>
      <div className="grid-panels">
        {P ? (
          <Panel
            kicker="Largest equity holdings — Pension Plan"
            title="June 30, 2025 · fair value in $ thousands"
          >
            <div className="table-scroll">
              <table className="table">
                <caption>Ten largest equity holdings</caption>
                <thead>
                  <tr>
                    <th scope="col" className="num">
                      Shares
                    </th>
                    <th scope="col">Description</th>
                    <th scope="col" className="num">
                      Fair value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PENSION_EQUITY.map(([sh, name, fv]) => (
                    <tr key={name}>
                      <td className="num" style={{ color: 'var(--muted-72)' }}>
                        {sh}
                      </td>
                      <td>{name}</td>
                      <td className="num" style={{ fontWeight: 500 }}>
                        {fv}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="panel-note">
              The ten largest positions total $5.5 billion — about 6.4% of the $86.2 billion fund.
              Reflects the global equity exposure of assets held in custody; a complete list of
              holdings is available on request from LACERA.
            </p>
            <SourceLine>2025 ACFR, p. 114</SourceLine>
          </Panel>
        ) : (
          <Panel kicker="Largest equity holdings — OPEB Master Trust" title="June 30, 2025">
            <div className="muted-note">
              The ACFR lists the OPEB Master Trust's largest equity holdings on p. 114; they are not
              reproduced in this prototype. Fixed income holdings and management fees for the Trust
              appear at right and below.
            </div>
          </Panel>
        )}

        <Panel
          kicker={`Largest fixed income holdings — ${d.label}`}
          title="June 30, 2025 · fair value in $ thousands"
        >
          <div className="table-scroll">
            <table className="table">
              <caption>Five largest fixed income holdings</caption>
              <thead>
                <tr>
                  <th scope="col" className="num">
                    Par
                  </th>
                  <th scope="col">Description</th>
                  <th scope="col" className="num">
                    Fair value
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.fi.map(([par, name, fv]) => (
                  <tr key={name}>
                    <td className="num" style={{ color: 'var(--muted-72)' }}>
                      {par}
                    </td>
                    <td>{name}</td>
                    <td className="num" style={{ fontWeight: 500 }}>
                      {fv}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-note">
            Top five of the ten published. Reflects fixed income exposure of assets held in custody.
          </p>
          <SourceLine>2025 ACFR, p. 115</SourceLine>
        </Panel>
      </div>

      <Panel
        className="mt"
        kicker={`Investment management fees — ${d.label}`}
        title="Fiscal years ended June 30 · $ thousands"
      >
        <div className="table-scroll">
          <table className="table">
            <caption>Investment management fees by asset class</caption>
            <thead>
              <tr>
                <th scope="col">Asset class</th>
                <th scope="col" className="num">
                  FY2025
                </th>
                <th scope="col" className="num">
                  FY2024
                </th>
                <th scope="col" className="num">
                  Change
                </th>
              </tr>
            </thead>
            <tbody>
              {d.fees.map(([cls, a, b, total]) => {
                const delta = a - b;
                return (
                  <tr key={cls}>
                    <td style={{ fontWeight: total ? 600 : 400 }}>{cls}</td>
                    <td className="num" style={{ fontWeight: total ? 600 : 400 }}>
                      {n(a)}
                    </td>
                    <td className="num">{n(b)}</td>
                    <td className="num" style={{ color: 'var(--muted-72)' }}>
                      {delta >= 0 ? '+' : '−'}
                      {n(delta)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 12.5, marginTop: 12, fontWeight: 600, color: 'var(--accent-800)' }}>
          {d.feeNote}
        </div>
        <p className="panel-note" style={{ marginTop: 8 }}>
          Differences from expenses reported in the Statement of Changes in Fiduciary Net Position
          are due to incentive fees, carry allocations, and operating expenses.
        </p>
        <SourceLine>2025 ACFR, p. 116</SourceLine>
      </Panel>
    </>
  );
}
