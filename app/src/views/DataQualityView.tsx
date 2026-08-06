import { ClassBadge, Panel, Pill, statusTone } from '../components/ui';
import { useDataset } from '../lib/dataset/useDataset';

/** Drill-down: can the numbers on screen be trusted, and where did each dataset come from. */

const CHECK_DESCRIPTIONS: Record<string, string> = {
  'CHK-01': 'Beginning weights sum to 100% every month',
  'CHK-02': 'Contribution residual within tolerance',
  'CHK-03': 'Allocation actual % sums to 100%',
  'CHK-04': 'Policy target weights sum to 100% (both versions)',
  'CHK-05': 'Internal transfers net to zero every month',
  'CHK-06': 'Market strip completeness (missing closes)',
  'CHK-07': 'Market strip freshness (final business day)',
  'CHK-08': 'Benchmark return coverage complete',
  'CHK-09': 'Public reference rows fully sourced',
  'CHK-10': 'Crosswalk item count via structured reference',
  'CHK-11': 'QA control count via structured reference',
  'CHK-12': 'Export record count matches expected',
};

export function DataQualityView() {
  const { dataset, source, importWarnings } = useDataset();
  const { checks, meta, publicReferences } = dataset;

  return (
    <>
      <h1>Data quality &amp; provenance</h1>
      <p className="footnote">
        Dataset: <strong>{meta.entityId}</strong> · as of {meta.asOf} · schema{' '}
        <code>{meta.schemaVersion}</code> · {meta.recordCount} records ·{' '}
        {source === 'fixture' ? 'bundled synthetic fixture' : 'user import (browser memory only)'}
      </p>

      <div className="grid cols-2">
        <Panel
          title="Workbook control results"
          note="Checks travel with the data: they were computed in the analyst workbook and exported as records, so the app shows the same control state an analyst sees in Excel."
        >
          <div className="table-scroll">
            <table>
              <caption>Control results carried in the dataset</caption>
              <thead>
                <tr>
                  <th scope="col">Check</th>
                  <th scope="col">Description</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <code>{c.id}</code>
                    </td>
                    <td>{CHECK_DESCRIPTIONS[c.id] ?? c.note}</td>
                    <td>
                      <Pill tone={statusTone(c.status)}>{c.status}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Classification census"
          note="Every record carries exactly one origin classification. Stale/missing are separate state overlays shown where the data appears."
        >
          <div className="table-scroll">
            <table>
              <caption>Records by classification</caption>
              <thead>
                <tr>
                  <th scope="col">Classification</th>
                  <th scope="col" className="num">
                    Records
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(meta.classificationCounts).map(([c, n]) => (
                  <tr key={c}>
                    <td>
                      <ClassBadge c={c} />
                    </td>
                    <td className="num">{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {importWarnings.length > 0 ? (
            <>
              <h3>Import warnings</h3>
              <ul className="footnote">
                {importWarnings.map((w, i) => (
                  <li key={i}>
                    [{w.ruleId}] {w.message}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Panel>
      </div>

      <Panel
        title="Cited public reference values"
        note="The only reported_public rows in the dataset. Each is quoted for its exact stated period from a public document; none feeds a portfolio calculation."
      >
        <div className="table-scroll">
          <table>
            <caption>reported_public records with citations</caption>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col">Entity</th>
                <th scope="col" className="num">
                  Value
                </th>
                <th scope="col">As of</th>
                <th scope="col">Citation</th>
              </tr>
            </thead>
            <tbody>
              {publicReferences.map((p) => (
                <tr key={p.recordId}>
                  <td>{p.metric}</td>
                  <td>{p.entity}</td>
                  <td className="num">
                    {p.value === null
                      ? '—'
                      : p.unit === '%'
                        ? `${(p.value * 100).toFixed(1)}%`
                        : `${p.value.toLocaleString('en-US')} ${p.unit}`}
                  </td>
                  <td>{p.asOf}</td>
                  <td className="footnote">
                    {p.pageTable} ({p.provider})
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
