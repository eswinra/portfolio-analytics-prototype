import { useMemo, useState } from 'react';

import { Panel, Pill, statusTone } from '../components/ui';
import { CROSSWALK, QA_CONTROLS, type WorkStatus } from '../fixtures/acfrWorkflow';

/** ACFR workflow: an action queue first; the full 51-record registers on request. */

const STATUSES: (WorkStatus | 'All')[] = [
  'All',
  'Not Started',
  'In Progress',
  'Ready for Review',
  'Complete',
  'Blocked',
];

const ACTION_ORDER: Record<WorkStatus, number> = {
  Blocked: 0,
  'Ready for Review': 1,
  'In Progress': 2,
  'Not Started': 3,
  Complete: 4,
};

/** Days from the viewer's local date to the illustrative due date; '—' once complete. */
function daysLeft(dueDate: string, status: WorkStatus): string {
  if (status === 'Complete') return '—';
  const days = Math.ceil((Date.parse(dueDate) - Date.now()) / 86400000);
  return days < 0 ? `${-days} overdue` : String(days);
}

export function AcfrView() {
  const [tab, setTab] = useState<'crosswalk' | 'qa'>('crosswalk');
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<WorkStatus | 'All'>('All');

  const done = CROSSWALK.filter((c) => c.status === 'Complete').length;
  const qaDone = QA_CONTROLS.filter((c) => c.status === 'Complete').length;
  const blocked =
    CROSSWALK.filter((c) => c.status === 'Blocked').length +
    QA_CONTROLS.filter((c) => c.status === 'Blocked').length;

  const actionQueue = useMemo(
    () =>
      [...CROSSWALK]
        .filter((c) => c.status !== 'Complete' && c.status !== 'Not Started')
        .sort(
          (a, b) =>
            ACTION_ORDER[a.status] - ACTION_ORDER[b.status] || a.dueDate.localeCompare(b.dueDate),
        )
        .slice(0, 5),
    [],
  );
  const qaQueue = useMemo(
    () =>
      [...QA_CONTROLS]
        .filter((c) => c.status !== 'Complete' && c.status !== 'Not Started')
        .sort((a, b) => ACTION_ORDER[a.status] - ACTION_ORDER[b.status])
        .slice(0, 5),
    [],
  );

  const items = useMemo(
    () => (filter === 'All' ? CROSSWALK : CROSSWALK.filter((c) => c.status === filter)),
    [filter],
  );
  const controls = useMemo(
    () => (filter === 'All' ? QA_CONTROLS : QA_CONTROLS.filter((c) => c.status === filter)),
    [filter],
  );

  return (
    <>
      <h1>ACFR reporting workflow</h1>
      <p className="footnote">
        Structure follows the public ACFR 2025 table of contents; statuses, due dates and completion
        figures are <strong>illustrative demo values</strong>; owners TBD.
      </p>

      <div className="tile-row">
        <div className="tile">
          <div className="tile-label">Blocked</div>
          <div className="tile-value">{blocked}</div>
          <div className="tile-sub">need escalation</div>
        </div>
        <div className="tile">
          <div className="tile-label">Crosswalk complete</div>
          <div className="tile-value">
            {done} / {CROSSWALK.length}
          </div>
          <div className="tile-sub">{((done / CROSSWALK.length) * 100).toFixed(1)}%</div>
        </div>
        <div className="tile">
          <div className="tile-label">QA controls complete</div>
          <div className="tile-value">
            {qaDone} / {QA_CONTROLS.length}
          </div>
          <div className="tile-sub">{((qaDone / QA_CONTROLS.length) * 100).toFixed(1)}%</div>
        </div>
      </div>

      <div role="group" aria-label="Register" style={{ marginBottom: '0.75rem' }}>
        <button
          className="linklike"
          style={{ marginRight: '1rem', fontWeight: tab === 'crosswalk' ? 700 : 400 }}
          aria-pressed={tab === 'crosswalk'}
          onClick={() => setTab('crosswalk')}
        >
          Crosswalk ({CROSSWALK.length})
        </button>
        <button
          className="linklike"
          style={{ fontWeight: tab === 'qa' ? 700 : 400 }}
          aria-pressed={tab === 'qa'}
          onClick={() => setTab('qa')}
        >
          QA controls ({QA_CONTROLS.length})
        </button>
      </div>

      {!showAll ? (
        <Panel
          title="Action queue — blocked, in review, in progress"
          note="The five most actionable records. Not-started and completed items live in the full register."
        >
          {tab === 'crosswalk' ? (
            <div className="table-scroll">
              <table>
                <caption>Crosswalk items needing attention (illustrative)</caption>
                <thead>
                  <tr>
                    <th scope="col">Table / disclosure</th>
                    <th scope="col">Due</th>
                    <th scope="col" className="num">
                      Days left
                    </th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {actionQueue.map((c) => (
                    <tr key={`${c.acfrPage}-${c.table}`}>
                      <td>
                        {c.table}
                        <div className="footnote">
                          ACFR p.{c.acfrPage} · {c.source}
                        </div>
                      </td>
                      <td>{c.dueDate}</td>
                      <td className="num">{daysLeft(c.dueDate, c.status)}</td>
                      <td>
                        <Pill tone={statusTone(c.status)}>{c.status}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <caption>QA controls needing attention (illustrative)</caption>
                <thead>
                  <tr>
                    <th scope="col">Control</th>
                    <th scope="col">Severity</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {qaQueue.map((c) => (
                    <tr key={c.control}>
                      <td>
                        {c.control}
                        <div className="footnote">{c.appliesTo}</div>
                      </td>
                      <td>{c.severity}</td>
                      <td>
                        <Pill tone={statusTone(c.status)}>{c.status}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="panel-note">
            <button className="linklike" onClick={() => setShowAll(true)}>
              Show the full register ({tab === 'crosswalk' ? CROSSWALK.length : QA_CONTROLS.length}{' '}
              records)
            </button>
          </p>
        </Panel>
      ) : (
        <>
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
            <button className="linklike" onClick={() => setShowAll(false)}>
              Back to action queue
            </button>
          </div>

          {tab === 'crosswalk' ? (
            <Panel title={`Investment data crosswalk (${items.length} shown)`}>
              <div className="table-scroll">
                <table>
                  <caption>
                    ACFR table → source → tie-out mapping with illustrative statuses
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">ACFR p.</th>
                      <th scope="col">Table / disclosure</th>
                      <th scope="col">Fund</th>
                      <th scope="col">Authoritative source</th>
                      <th scope="col">Tie-out</th>
                      <th scope="col">Due</th>
                      <th scope="col" className="num">
                        Days left
                      </th>
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
                        <td className="num">{daysLeft(c.dueDate, c.status)}</td>
                        <td>
                          <Pill tone={statusTone(c.status)}>{c.status}</Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : (
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
          )}
        </>
      )}
    </>
  );
}
