import { Link } from 'react-router-dom';

import { excessTag, Panel, Tag } from '../components/ui';
import { CONFIG } from '../config';
import { HORIZONS, PENSION, publishedFor } from '../fixtures/published';
import { useEntity } from '../lib/entity';

/** Risk & Compliance — range compliance vs the IPS (Pension), excess-by-horizon cards, and
 *  governance/provenance reading notes. Quoted figures only. */

const GOV_NOTES = [
  'The Board of Investments sets strategic asset allocation and investment policy; allocation is recognized as the largest driver of fund performance.',
  'Private-market benchmarks are lagged one to three months (IPS Table 2) — same-period comparisons mix vintages by design.',
  'All returns are net of investment management fees. Actuarial valuations are performed by Milliman; the latest is as of June 30, 2024.',
  'Every figure on these screens is quoted from a published LACERA document — nothing here is a live or operational estimate, and the custodian remains the book of record.',
];

export function RiskView() {
  const { entity } = useEntity();
  const d = publishedFor(entity);
  const P = entity === 'PENSION';
  const nb = CONFIG.nearBoundPp;

  const compRows = PENSION.majors.map(([cat, t, r, , act]) => {
    const lo = t - r;
    const hi = t + r;
    const a = act ?? 0;
    const dm = Math.min(a - lo, hi - a);
    const near = dm <= nb;
    return {
      cat,
      act: `${act}%`,
      t: `${t}%`,
      band: `${lo}–${hi}%`,
      dist: `${dm.toFixed(1)} pp`,
      tag: dm < 0 ? 'Out of range' : near ? 'Near bound' : 'Within range',
      variant: (dm < 0 || near ? 'outline' : 'accent') as 'outline' | 'accent',
    };
  });
  const breaches = compRows.filter((c) => c.tag === 'Out of range').length;
  const nearC = compRows.filter((c) => c.tag === 'Near bound').length;
  const compSummary = breaches
    ? `${breaches} breach(es)`
    : nearC
      ? `${nearC} near bound`
      : '0 breaches';

  return (
    <>
      {P ? (
        <Panel
          kicker={`Policy range compliance — ${compSummary}`}
          title="Actual mix vs IPS ranges, June 30, 2025"
        >
          <div className="table-scroll">
            <table className="table">
              <caption>Actual weights against IPS policy ranges</caption>
              <thead>
                <tr>
                  <th scope="col">Functional category</th>
                  <th scope="col" className="num">
                    Actual
                  </th>
                  <th scope="col" className="num">
                    Target
                  </th>
                  <th scope="col" className="num">
                    IPS range
                  </th>
                  <th scope="col" className="num">
                    To nearer bound
                  </th>
                  <th scope="col" className="num">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {compRows.map((c) => (
                  <tr key={c.cat}>
                    <td>{c.cat}</td>
                    <td className="num" style={{ fontWeight: 500 }}>
                      {c.act}
                    </td>
                    <td className="num">{c.t}</td>
                    <td className="num">{c.band}</td>
                    <td className="num">{c.dist}</td>
                    <td className="num">
                      <Tag variant={c.variant}>{c.tag}</Tag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-note">
            “Near bound” flags a weight within {nb.toFixed(1)} pp of a policy boundary — an early
            warning, not a breach. Range status is a factual report; the IPS defines no mechanical
            trade trigger. Overlays &amp; Hedges and Other Assets (2% combined) carry no policy
            weight and are not range-monitored.
          </p>
        </Panel>
      ) : (
        <Panel kicker="Policy range compliance" title="OPEB Master Trust">
          <div className="muted-note">
            The 2025 PAFR publishes the OPEB Trust's actual mix as a chart (p. 7); category-level
            range status is omitted here pending verified figures from the source document. Policy
            targets and ranges are on the <Link to="/allocation">Allocation</Link> view.
          </div>
        </Panel>
      )}

      <div className="grid-panels mt">
        <Panel kicker="Benchmark tracking" title="Excess vs policy benchmark by horizon">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 14,
              marginTop: 14,
            }}
          >
            {HORIZONS.map((h, i) => {
              const t = excessTag(d.ret.f[i]!, d.ret.b[i]!);
              return (
                <div className="horizon-card" key={h}>
                  <div className="h">{h}</div>
                  <div style={{ margin: '8px 0 4px' }}>
                    <Tag variant={t.variant} big>
                      {t.text}
                    </Tag>
                  </div>
                  <div className="vs">
                    {d.ret.f[i]!.toFixed(1)}% vs {d.ret.b[i]!.toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
          <p className="panel-note">{d.trackNote}</p>
        </Panel>

        <Panel kicker="Reading this data" title="Governance and provenance notes">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {GOV_NOTES.map((note, i) => (
              <div className="gov-note" key={i}>
                <span className="num">0{i + 1}</span>
                <span>{note}</span>
              </div>
            ))}
          </div>
          <p className="panel-note">
            Operational data-quality triage runs in the{' '}
            <Link to="/exceptions">team workflow demo</Link> (synthetic contract data): tiered, aged
            exceptions with provenance and reconciliation checks.
          </p>
        </Panel>
      </div>
    </>
  );
}
