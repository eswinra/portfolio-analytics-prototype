import { Reveal } from '../components/ChartKit';
import { AboutFigures, PageMeta } from '../components/page';
import { Panel, SourceLine } from '../components/ui';
import {
  OPEB_ENROLLMENT,
  OPEB_STORY,
  PENSION_FUNDED,
  PENSION_FUNDED_DELTAS,
  PENSION_MEMBERSHIP,
} from '../fixtures/published';
import { useEntity } from '../lib/entity';

/** Funded Status — Pension: funded-ratio bars (70–100% scale) + membership; OPEB: healthcare
 *  enrollment + the prefunding story. Quoted from the 2025 PAFR. */

/** UAAL restated in billions so the $-thousands source figures cannot be misread. */
const UAAL_BILLIONS = ['$18.14B', '$18.24B', '$17.61B'];

export function FundedView() {
  const { entity } = useEntity();

  if (entity === 'PENSION') {
    return (
      <PageMeta classification="reported_public">
        <AboutFigures
          summary="Fiscal year ended June 30, 2025 (2025 PAFR) · actuarial valuation June 30, 2024 (Milliman)"
          classification="reported_public"
        >
          <p>
            The report date and the valuation date are different facts: funded ratios come from the
            actuarial valuations, dated a year before the financial statements they are printed
            with.
          </p>
        </AboutFigures>
        <div className="grid-panels">
          <Panel
            id="funded-ratio"
            kicker="Funded ratio and UAAL — last three actuarial valuations"
            title="Percentage of future pension liabilities covered by assets"
            note="The funded ratio rose 1.0 pp at the June 30, 2024 valuation, primarily on investment gains and additional employer contributions toward unfunded liabilities."
            method={
              <p>
                Bars run on a 70–100% scale. UAAL is restated in billions beside the printed
                $-thousands figure. Valuations by Milliman, LACERA&apos;s independent consulting
                actuary.
              </p>
            }
          >
            <Reveal style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
              {PENSION_FUNDED.map(([date, ratio, uaal], i) => (
                <div key={date}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      fontSize: 13,
                      marginBottom: 4,
                    }}
                  >
                    <span>Valuation {date}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 19,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {ratio.toFixed(1)}%
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-600)' }}>
                        {PENSION_FUNDED_DELTAS[i]}
                      </span>
                    </span>
                  </div>
                  <div className="funded-bar">
                    <div
                      className="fill"
                      style={{ width: `${(((ratio - 70) / 30) * 100).toFixed(1)}%` }}
                    />
                    <div className="end-mark" />
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: 'var(--muted-68)',
                      marginTop: 4,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    UAAL {UAAL_BILLIONS[i]} ({uaal} thousand)
                  </div>
                </div>
              ))}
            </Reveal>
            <SourceLine sources={['PAFR_PENSION']} />
          </Panel>

          <Panel
            id="funded-members"
            kicker="Membership"
            title="As of June 30"
            note="Active membership grew by 1,797 and retirees by 1,923 over the prior fiscal year."
            method={
              <p>
                Members work for L.A. County, the L.A. Superior Court, and four outside districts.
              </p>
            }
          >
            <div
              className="table-scroll"
              role="region"
              aria-label="Membership, three fiscal years"
              tabIndex={0}
            >
              <table className="table">
                <caption>Membership, three fiscal years</caption>
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="visually-hidden">Line item</span>
                    </th>
                    <th scope="col" className="num">
                      2025
                    </th>
                    <th scope="col" className="num">
                      2024
                    </th>
                    <th scope="col" className="num">
                      2023
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PENSION_MEMBERSHIP.map(([label, a, b, c, bold]) => (
                    <tr key={label}>
                      <td style={{ fontWeight: bold ? 600 : 400 }}>{label}</td>
                      <td className="num" style={{ fontWeight: bold ? 600 : 400 }}>
                        {a}
                      </td>
                      <td className="num">{b}</td>
                      <td className="num">{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SourceLine sources={['PAFR_PENSION']} />
          </Panel>
        </div>
      </PageMeta>
    );
  }

  return (
    <PageMeta classification="reported_public">
      <AboutFigures
        summary="Fiscal year ended June 30, 2025 — 2025 PAFR"
        classification="reported_public"
      />
      <div className="grid-panels">
        <Panel
          id="funded-enrollment"
          kicker="Retiree healthcare benefits — enrollment"
          title="As of June 30"
          method={
            <p>
              The County subsidy starts at 40% of the lesser of the benchmark plan rate or the
              actual premium, with at least 10 years of eligible service credit. Employers pay
              healthcare premium subsidies on a pay-as-you-go basis.
            </p>
          }
        >
          <div
            className="table-scroll"
            role="region"
            aria-label="Healthcare enrollment, three fiscal years"
            tabIndex={0}
          >
            <table className="table">
              <caption>Healthcare enrollment, three fiscal years</caption>
              <thead>
                <tr>
                  <th scope="col">Coverage</th>
                  <th scope="col" className="num">
                    2025
                  </th>
                  <th scope="col" className="num">
                    2024
                  </th>
                  <th scope="col" className="num">
                    2023
                  </th>
                </tr>
              </thead>
              <tbody>
                {OPEB_ENROLLMENT.map(([label, a, b, c]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td className="num" style={{ fontWeight: 500 }}>
                      {a}
                    </td>
                    <td className="num">{b}</td>
                    <td className="num">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SourceLine sources={['PAFR_OPEB_ENROLL']} />
        </Panel>

        <Panel
          id="funded-prefunding"
          kicker="Prefunding the OPEB Trust"
          title="Established 2012"
          note="Growth has been driven by prefunding contributions and investment gains net of expenses."
        >
          <div>
            {OPEB_STORY.map(([label, v, bold]) => (
              <div className="flow-row" key={label}>
                <span style={{ fontWeight: bold ? 600 : 400 }}>{label}</span>
                <span className="v">{v}</span>
              </div>
            ))}
          </div>
          <SourceLine sources={['PAFR_OPEB']} />
        </Panel>
      </div>
    </PageMeta>
  );
}
