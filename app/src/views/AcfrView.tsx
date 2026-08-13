import { useMemo, useState } from 'react';

import acfrCsv from '../../../data/sample/demo_acfr_status_v1.csv?raw';
import { Panel, Pill, statusTone } from '../components/ui';
import { CROSSWALK, QA_CONTROLS, type WorkStatus } from '../fixtures/acfrWorkflow';
import { parseContractCsv } from '../lib/contract/parse';
import type { AcfrStatus } from '../lib/contract/schema';
import {
  buildAcfrBoard,
  completeRowCsv,
  sectionArtifacts,
  type AcfrSection,
} from '../lib/dataset/acfr';

/**
 * ACFR: a section-readiness board built from contract records (acfr_section_status +
 * acfr_artifact_link in their own single-entity tracker file). Latest row per section is the
 * state; the full row history is the change log — the file is the record. Role gating here is
 * DEMONSTRATION ONLY: a static public site cannot enforce identity, and says so; the
 * enforceable tracker belongs in an identity-aware internal environment.
 */

type ViewerRole = 'analyst' | 'lead' | 'leadership';

const STATUS_LABEL: Record<AcfrStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  in_review: 'In review',
  ready_signoff: 'Ready for sign-off',
  complete: 'Complete',
};

const STATUS_TONE: Record<AcfrStatus, 'good' | 'warn' | 'bad' | 'neutral'> = {
  not_started: 'neutral',
  in_progress: 'warn',
  in_review: 'warn',
  ready_signoff: 'warn',
  complete: 'good',
};

const OLD_STATUSES: (WorkStatus | 'All')[] = [
  'All',
  'Not Started',
  'In Progress',
  'Ready for Review',
  'Complete',
  'Blocked',
];

function SectionCard({
  section,
  role,
  onCopyComplete,
  copied,
  artifacts,
}: {
  section: AcfrSection;
  role: ViewerRole;
  onCopyComplete: (s: AcfrSection) => void;
  copied: boolean;
  artifacts: ReturnType<typeof sectionArtifacts>;
}) {
  const overdue = section.daysToDue !== null && section.daysToDue < 0;
  return (
    <section className="panel" aria-label={`${section.label} section status`}>
      <div className="bullet-head">
        <strong>
          {section.label} <span className="footnote">({section.sectionId})</span>
        </strong>
        <Pill tone={STATUS_TONE[section.status]}>
          {STATUS_LABEL[section.status]}
          {section.version ? ` ${section.version}` : ''}
        </Pill>
      </div>
      <p className="footnote" style={{ margin: '0.35rem 0' }}>
        Owner <code>{section.owner || '—'}</code> · updated {section.lastUpdated || '—'} · due{' '}
        {section.dueDate ?? '—'}
        {section.daysToDue !== null ? (
          <>
            {' '}
            (
            {overdue ? (
              <strong>{-section.daysToDue} days overdue</strong>
            ) : (
              `${section.daysToDue} days left`
            )}
            )
          </>
        ) : null}{' '}
        · artifacts <strong>{section.artifactsIn}</strong> / {section.artifactsExpected} in
      </p>
      <details>
        <summary className="footnote">
          History ({section.history.length}) &amp; artifacts ({section.artifactsExpected})
        </summary>
        <ul className="footnote" style={{ marginTop: '0.4rem' }}>
          {section.history.map((h) => (
            <li key={`${h.date}-${h.status}`}>
              {h.date}: {STATUS_LABEL[h.status]}
              {h.version ? ` (${h.version})` : ''} — <code>{h.actor}</code>
            </li>
          ))}
        </ul>
        <ul className="footnote">
          {artifacts.map((a) => (
            <li key={a.title}>
              {a.received ? '✓' : '○'} {a.title}
              {a.version ? ` (${a.version})` : ''}
              {a.received ? '' : ' — outstanding'}
            </li>
          ))}
        </ul>
        <p className="footnote">
          Artifacts are links + metadata only — real files never live on this public site.
        </p>
      </details>
      {section.status === 'ready_signoff' ? (
        role === 'leadership' ? (
          <p style={{ marginBottom: 0 }}>
            <button className="linklike" onClick={() => onCopyComplete(section)}>
              {copied
                ? 'Row copied ✓ — append to the tracker CSV and re-import'
                : 'Mark complete (copies a CSV row)'}
            </button>
          </p>
        ) : (
          <p className="footnote" style={{ marginBottom: 0 }}>
            Ready for sign-off — switch the viewer role to <em>leadership</em> to see the
            demonstration Complete action.
          </p>
        )
      ) : null}
    </section>
  );
}

export function AcfrView() {
  const [role, setRole] = useState<ViewerRole>('analyst');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [tab, setTab] = useState<'crosswalk' | 'qa'>('crosswalk');
  const [filter, setFilter] = useState<WorkStatus | 'All'>('All');

  const { board, records } = useMemo(() => {
    const res = parseContractCsv(acfrCsv);
    if (!res.ok) {
      throw new Error(
        `Bundled ACFR tracker failed its own contract: ${res.errors[0]?.ruleId} ${res.errors[0]?.message}`,
      );
    }
    return { board: buildAcfrBoard(res.records), records: res.records };
  }, []);

  const complete = board.sections.filter((s) => s.status === 'complete').length;
  const signoff = board.sections.filter((s) => s.status === 'ready_signoff').length;
  const artifactsIn = board.sections.reduce((a, s) => a + s.artifactsIn, 0);
  const artifactsAll = board.sections.reduce((a, s) => a + s.artifactsExpected, 0);

  async function copyComplete(section: AcfrSection) {
    const rowCsv = completeRowCsv(
      board,
      section,
      'PA-LEAD-1',
      `ACF-${9000 + Math.floor(Math.random() * 999)}`,
    );
    try {
      await navigator.clipboard.writeText(rowCsv);
      setCopiedSection(section.sectionId);
      setTimeout(() => setCopiedSection(null), 4000);
    } catch {
      setCopiedSection(null);
    }
  }

  const items = filter === 'All' ? CROSSWALK : CROSSWALK.filter((c) => c.status === filter);
  const controls = filter === 'All' ? QA_CONTROLS : QA_CONTROLS.filter((c) => c.status === filter);

  return (
    <>
      <h1>ACFR reporting workflow</h1>
      <p className="footnote">
        Section readiness from contract records (<code>{board.entityId}</code> tracker file, through{' '}
        {board.refDate ?? 'n/a'}): the latest status row per section is the state, and the full row
        history is the change log — the file is the record. Statuses, dates, owners and links are{' '}
        <strong>illustrative demo values</strong> with synthetic actor labels.
      </p>

      <div className="tile-row">
        <div className="tile">
          <div className="tile-label">Sections complete</div>
          <div className="tile-value">
            {complete} / {board.sections.length}
          </div>
          <div className="tile-sub">of the five ACFR sections</div>
        </div>
        <div className="tile">
          <div className="tile-label">Ready for sign-off</div>
          <div className="tile-value">{signoff}</div>
          <div className="tile-sub">awaiting leadership</div>
        </div>
        <div className="tile">
          <div className="tile-label">Artifacts in</div>
          <div className="tile-value">
            {artifactsIn} / {artifactsAll}
          </div>
          <div className="tile-sub">links + metadata, never files</div>
        </div>
        <div className="tile">
          <div className="tile-label">Viewer role</div>
          <div className="tile-value">
            <select
              aria-label="Viewer role (demonstration only)"
              value={role}
              onChange={(e) => setRole(e.target.value as ViewerRole)}
              style={{ font: 'inherit', padding: '0.15rem 0.3rem' }}
            >
              <option value="analyst">analyst</option>
              <option value="lead">lead</option>
              <option value="leadership">leadership</option>
            </select>
          </div>
          <div className="tile-sub">demonstration only — not access control</div>
        </div>
      </div>

      <p className="footnote">
        A static public site cannot securely enforce roles: this toggle demonstrates the intended
        workflow (only leadership completes a section). The enforceable, identity-aware tracker
        belongs in the internal M365 environment; this board demonstrates the concept against the
        same one-contract data model.
      </p>

      {board.sections.map((s) => (
        <SectionCard
          key={s.sectionId}
          section={s}
          role={role}
          onCopyComplete={copyComplete}
          copied={copiedSection === s.sectionId}
          artifacts={sectionArtifacts(records, s.sectionId)}
        />
      ))}

      <details className="panel">
        <summary>Illustrative crosswalk &amp; QA registers (app-bundled detail)</summary>
        <p className="footnote" style={{ marginTop: '0.6rem' }}>
          The page-level crosswalk (23 items) and QA checklist (28 controls) retained from the
          earlier revision — statuses illustrative; structure follows the public ACFR 2025 table of
          contents.
        </p>
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
          <span style={{ marginLeft: '1.2rem' }} className="footnote">
            filter:{' '}
            {OLD_STATUSES.map((s) => (
              <button
                key={s}
                className="linklike"
                style={{ marginRight: '0.7rem', fontWeight: filter === s ? 700 : 400 }}
                aria-pressed={filter === s}
                onClick={() => setFilter(s)}
              >
                {s}
              </button>
            ))}
          </span>
        </div>
        {tab === 'crosswalk' ? (
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
      </details>
    </>
  );
}
