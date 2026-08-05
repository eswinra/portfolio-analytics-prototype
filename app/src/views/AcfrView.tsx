import { useMemo, useState } from 'react';

import { Panel, Pill, statusTone } from '../components/ui';
import { CROSSWALK, QA_CONTROLS, type WorkStatus } from '../fixtures/acfrWorkflow';

/** Drill-down: the ACFR production workflow (crosswalk + QA controls) as a readiness board. */

const STATUSES: (WorkStatus | 'All')[] = [
  'All',
  'Not Started',
  'In Progress',
  'Ready for Review',
  'Complete',
  'Blocked',
];

export function AcfrView() {
  const [filter, setFilter] = useState<WorkStatus | 'All'>('All');

  const items = useMemo(
    () => (filter === 'All' ? CROSSWALK : CROSSWALK.filter((c) => c.status === filter)),
    [filter],
  );
  const controls = useMemo(
    () => (filter === 'All' ? QA_CONTROLS : QA_CONTROLS.filter((c) => c.status === filter)),
    [filter],
  );

  const done = CROSSWALK.filter((c) => c.status === 'Complete').length;
  const qaDone = QA_CONTROLS.filter((c) => c.status === 'Complete').length;
  const blocked =
    CROSSWALK.filter((c) => c.status === 'Blocked').length +
    QA_CONTROLS.filter((c) => c.status === 'Blocked').length;

  return (
    <>
      <h1>ACFR reporting workflow</h1>
      <p className="footnote">
        Structure follows the public ACFR 2025 table of contents (printed page numbers). Statuses,
        due dates and completion figures are <strong>illustrative demo values</strong>; owners are
        deliberately TBD. This board demonstrates the workflow concept from the starter workbook
        with its counting defect fixed.
      </p>

      <div className="tile-row">
        <div className="tile">
          <div className="tile-label">Crosswalk items complete</div>
          <div className="tile-value">
            {done} / {CROSSWALK.length}
          </div>
          <div className="tile-sub">
            {((done / CROSSWALK.length) * 100).toFixed(1)}% — denominator counts data rows only
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">QA controls complete</div>
          <div className="tile-value">
            {qaDone} / {QA_CONTROLS.length}
          </div>
          <div className="tile-sub">{((qaDone / QA_CONTROLS.length) * 100).toFixed(1)}%</div>
        </div>
        <div className="tile">
          <div className="tile-label">Blocked items</div>
          <div className="tile-value">{blocked}</div>
          <div className="tile-sub">need escalation</div>
        </div>
      </div>

      <div role="group" aria-label="Filter by status" style={{ marginBottom: '0.75rem' }}>
        {STATUSES.map((s) => (
          <button
            key={s}
            className="linklike"
            style={{ marginRight: '1rem', fontWeight: filter === s ? 700 : 400 }}
            aria-pressed={filter === s}
            onClick={() => setFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <Panel title={`Investment data crosswalk (${items.length} shown)`}>
        <div className="table-scroll">
          <table>
            <caption>ACFR table → source → tie-out mapping with illustrative statuses</caption>
            <thead>
              <tr>
                <th scope="col">ACFR p.</th>
                <th scope="col">Table / disclosure</th>
                <th scope="col">Fund</th>
                <th scope="col">Authoritative source</th>
                <th scope="col">Tie-out</th>
                <th scope="col">Due</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={`${c.acfrPage}-${c.table}`}>
                  <td className="num">{c.acfrPage}</td>
                  <td>
                    {c.table}
                    <div className="footnote">{c.test}</div>
                  </td>
                  <td>{c.fund}</td>
                  <td>{c.source}</td>
                  <td>{c.tieOut}</td>
                  <td>{c.dueDate}</td>
                  <td>
                    <Pill tone={statusTone(c.status)}>{c.status}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={`QA controls (${controls.length} shown)`}>
        <div className="table-scroll">
          <table>
            <caption>ACFR investment QA checklist with illustrative statuses</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Control</th>
                <th scope="col">Applies to</th>
                <th scope="col">Severity</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {controls.map((c) => (
                <tr key={c.control}>
                  <td>{c.category}</td>
                  <td>{c.control}</td>
                  <td>{c.appliesTo}</td>
                  <td>{c.severity}</td>
                  <td>
                    <Pill tone={statusTone(c.status)}>{c.status}</Pill>
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
