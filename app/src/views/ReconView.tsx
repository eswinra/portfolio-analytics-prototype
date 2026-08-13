import { FreshnessLine } from '../components/FreshnessLine';
import { fmtMm, Panel, Tag, type TagVariant } from '../components/ui';
import { useDataset } from '../lib/dataset/useDataset';
import type { ReconStatus } from '../lib/finance/recon';

/** Reconciliation (team workflow demo): paired values from two sources with the variance
 *  COMPUTED on screen and the threshold carried as data (tolerance_definition records).
 *  The custodian remains the official book of record throughout. Synthetic contract data. */

const STATUS_VARIANT: Record<ReconStatus, TagVariant> = {
  within: 'accent',
  outside: 'blocked',
  incomplete: 'outline',
  no_tolerance: 'neutral',
};

const STATUS_LABEL: Record<ReconStatus, string> = {
  within: 'Within tolerance',
  outside: 'Outside tolerance',
  incomplete: 'Awaiting side',
  no_tolerance: 'No tolerance defined',
};

export function ReconView() {
  const { dataset } = useDataset();
  const { recons, meta } = dataset;
  const breaks = recons.filter((p) => p.status === 'outside').length;

  return (
    <>
      <FreshnessLine />
      <p className="footnote" style={{ margin: '6px 0 18px' }}>
        Synthetic {meta.entityId} data. Each pair joins two <code>recon_value</code> rows on
        (metric, category, as-of); the variance is <strong>computed here, never imported</strong>,
        and the tolerance travels with the data (<code>tolerance_definition</code> records). A break
        is a factual report to investigate at the source — the custodian remains the official book
        of record.
      </p>

      {recons.length === 0 ? (
        <Panel kicker="Reconciliation" title="No reconciliation records">
          <p className="footnote">
            This dataset carries no <code>recon_value</code> rows. Schema 1.3 files add them; see
            the Data Dictionary on the Import view.
          </p>
        </Panel>
      ) : (
        <Panel
          kicker="Paired source checks — tolerance-as-data"
          title={`Paired checks (${recons.length}) — ${breaks === 0 ? 'all within tolerance' : `${breaks} outside tolerance`}`}
          note="Sides are synthetic demo inputs; the internal-book side ties to the workbook's own EMV values, and one category pair is a deliberate demonstration break. Tolerances are absolute $mm thresholds defined in the data."
        >
          <div className="table-scroll">
            <table className="table">
              <caption>
                Sorted breaks-first. Age is days from the pair's as-of to the dataset reference
                date, computed from dates inside the file.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th scope="col">Category</th>
                  <th scope="col" className="num">
                    Side A
                  </th>
                  <th scope="col" className="num">
                    Side B
                  </th>
                  <th scope="col" className="num">
                    Variance
                  </th>
                  <th scope="col" className="num">
                    Tolerance
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">Owner</th>
                  <th scope="col" className="num">
                    Age
                  </th>
                </tr>
              </thead>
              <tbody>
                {recons.map((p) => {
                  const [a, b] = p.sides;
                  return (
                    <tr key={`${p.metricId}|${p.categoryId}|${p.asOf}`}>
                      <td>
                        <code>{p.metricId}</code>
                        <div className="footnote">{p.asOf}</div>
                      </td>
                      <td>{p.categoryId || '—'}</td>
                      <td className="num">
                        {a ? fmtMm(a.value) : '—'}
                        <div className="footnote">{a?.source ?? ''}</div>
                      </td>
                      <td className="num">
                        {b ? fmtMm(b.value) : '—'}
                        <div className="footnote">{b?.source ?? 'missing side'}</div>
                      </td>
                      <td className="num">
                        {p.variance === null ? '—' : `${p.variance.toFixed(2)} ${p.unit}`}
                      </td>
                      <td className="num">
                        {p.toleranceAbs === null ? '—' : `${p.toleranceAbs.toFixed(2)} ${p.unit}`}
                      </td>
                      <td>
                        <Tag variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Tag>
                      </td>
                      <td>
                        <code>{a?.enteredBy || '—'}</code>
                        <div className="footnote">{a?.reviewStatus ?? ''}</div>
                      </td>
                      <td className="num">{p.ageDays === null ? '—' : `${p.ageDays} d`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
