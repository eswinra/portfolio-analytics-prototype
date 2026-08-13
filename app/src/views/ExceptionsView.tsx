import { FreshnessLine } from '../components/FreshnessLine';
import { ClassBadge, Panel, Pill, statusTone, Tag, type TagVariant } from '../components/ui';
import { policyFor } from '../fixtures/policyPack';
import { useDataset } from '../lib/dataset/useDataset';

/** Exceptions & data quality (team workflow demo): tiered, aged triage queue with the Team
 *  Activity provenance panel and the workbook control registers. Synthetic contract data. */

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

const TIER_VARIANT: Record<string, TagVariant> = {
  blocking: 'blocked',
  warning: 'outline',
  informational: 'neutral',
};

export function ExceptionsView() {
  const { dataset, source, importWarnings } = useDataset();
  const { exceptions, checks, meta, publicReferences, teamActivity } = dataset;

  const blocking = exceptions.filter((e) => e.tier === 'blocking').length;
  const warning = exceptions.filter((e) => e.tier === 'warning').length;
  const info = exceptions.filter((e) => e.tier === 'informational').length;
  const passing = checks.filter((c) => c.status === 'PASS');
  const pack = policyFor(meta.policyEntity);

  return (
    <>
      <FreshnessLine />
      <p className="footnote" style={{ margin: '6px 0 18px' }}>
        {blocking} blocking · {warning} warning · {info} informational · {passing.length} controls
        passed. Sorted by tier, then days open. Staff analytics: factual states, never instructions.
      </p>

      {exceptions.length === 0 ? (
        <Panel kicker="Triage queue" title="No open issues">
          <p className="footnote">Every control passed and all market series are current.</p>
        </Panel>
      ) : (
        <Panel
          kicker="Triage queue — sorted by tier, then age"
          title={`Open issues (${exceptions.length})`}
        >
          <div className="table-scroll">
            <table className="table">
              <caption>
                Root-cause merged: a degraded series and its control are one issue. Age is computed
                from dates inside the file — no clock survives an import.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Tier</th>
                  <th scope="col" className="num">
                    Age
                  </th>
                  <th scope="col">Issue</th>
                  <th scope="col">Impact</th>
                  <th scope="col">Next action</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Tag variant={TIER_VARIANT[e.tier] ?? 'neutral'}>{e.tier}</Tag>
                    </td>
                    <td className="num">
                      {e.ageDays === null ? '—' : `${e.ageDays} day${e.ageDays === 1 ? '' : 's'}`}
                    </td>
                    <td>{e.description}</td>
                    <td className="issue-impact">{e.impact}</td>
                    <td className="issue-impact">{e.nextAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {teamActivity.length > 0 ? (
        <details className="panel mt" style={{ marginTop: 22 }}>
          <summary>Team activity — who entered and reviewed this dataset</summary>
          <p className="footnote" style={{ marginTop: 10 }}>
            Derived entirely from the dataset's provenance columns (schema 1.2+) — the file is the
            audit log; the app stores nothing. Bundled fixtures carry synthetic actor labels, never
            real names.
          </p>
          <div className="table-scroll">
            <table className="table">
              <caption>Per-actor row counts and latest as-of date</caption>
              <thead>
                <tr>
                  <th scope="col">Actor</th>
                  <th scope="col" className="num">
                    Rows entered
                  </th>
                  <th scope="col" className="num">
                    Rows reviewed
                  </th>
                  <th scope="col">Latest as-of</th>
                </tr>
              </thead>
              <tbody>
                {teamActivity.map((t) => (
                  <tr key={t.actor}>
                    <td>
                      <code>{t.actor}</code>
                    </td>
                    <td className="num">{t.enteredRows}</td>
                    <td className="num">{t.reviewedRows}</td>
                    <td>{t.latestAsOf}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}

      <details className="panel" style={{ marginTop: 22 }}>
        <summary>Show {passing.length} passing controls</summary>
        <div className="table-scroll" style={{ marginTop: 10 }}>
          <table className="table">
            <caption>
              Workbook control results travel with the dataset — the app shows the same state an
              analyst sees in Excel
            </caption>
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
      </details>

      <details className="panel" style={{ marginTop: 22 }}>
        <summary>Data details — provenance, classification, citations</summary>
        <div className="table-scroll" style={{ marginTop: 10 }}>
          <table className="table">
            <caption>Active dataset</caption>
            <tbody>
              <tr>
                <td>Entity</td>
                <td className="num">{meta.entityId}</td>
              </tr>
              <tr>
                <td>Source</td>
                <td className="num">
                  {source === 'fixture'
                    ? 'bundled synthetic fixture'
                    : 'user import (browser memory)'}
                </td>
              </tr>
              <tr>
                <td>Contract schema</td>
                <td className="num">{meta.schemaVersion}</td>
              </tr>
              <tr>
                <td>Records</td>
                <td className="num">{meta.recordCount}</td>
              </tr>
              <tr>
                <td>Policy scope</td>
                <td className="num">
                  {pack.entityLabel} (
                  {dataset.policySource === 'dataset'
                    ? 'bands from dataset policy records'
                    : 'bundled pack'}
                  )
                </td>
              </tr>
              <tr>
                <td>Classification census</td>
                <td className="num">
                  {Object.entries(meta.classificationCounts)
                    .map(([c, count]) => `${c} ${count}`)
                    .join(' · ')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="footnote" style={{ marginTop: 10 }}>
          Origin classifications: <ClassBadge c="reported_public" /> <ClassBadge c="synthetic" />{' '}
          <ClassBadge c="proxy_estimate" /> <ClassBadge c="calculated" /> — stale/missing are state
          overlays shown where the data appears.
        </p>
        {importWarnings.length > 0 ? (
          <>
            <h3 style={{ fontSize: 14, margin: '10px 0 4px' }}>Import warnings</h3>
            <ul className="footnote">
              {importWarnings.map((w, i) => (
                <li key={i}>
                  [{w.ruleId}] {w.message}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <div className="table-scroll">
          <table className="table">
            <caption>
              Cited public reference values — the only reported_public value rows in the synthetic
              dataset; none feeds a portfolio calculation
            </caption>
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
      </details>
    </>
  );
}
