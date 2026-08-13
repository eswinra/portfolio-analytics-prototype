import { useMemo, useState } from 'react';

import acfrCsv from '../../../data/sample/demo_acfr_status_v1.csv?raw';
import { Pill, statusTone } from '../components/ui';
import { CROSSWALK, QA_CONTROLS, type CrosswalkItem } from '../fixtures/acfrWorkflow';
import { parseContractCsv } from '../lib/contract/parse';
import type { AcfrStatus } from '../lib/contract/schema';
import {
  buildAcfrBoard,
  completeRowCsv,
  sectionArtifacts,
  type AcfrBoard,
  type AcfrSection,
} from '../lib/dataset/acfr';

/**
 * ACFR: a section-readiness board built from contract records (acfr_section_status +
 * acfr_artifact_link in their own single-entity tracker file). Latest row per section is the
 * state; the full row history is the change log — the file is the record. Every page-level
 * tie-out item lives under its own section card. Role gating is DEMONSTRATION ONLY: a static
 * public site cannot enforce identity, and says so.
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

/** Crosswalk source-section labels → board section ids (RSI and SI are part of Financial). */
const CROSSWALK_SECTION: Record<string, string> = {
  Introductory: 'INTRO',
  Investment: 'INV',
  Financial: 'FIN',
  'Financial Notes': 'FIN',
  'Required Supplementary Information': 'FIN',
  'Supplementary Information': 'FIN',
  Actuarial: 'ACT',
  Statistical: 'STAT',
};

function daysLeft(dueDate: string, refDate: string | null): number | null {
  if (!refDate) return null;
  const d = Math.round((Date.parse(dueDate) - Date.parse(refDate)) / 86400000);
  return Number.isFinite(d) ? d : null;
}

function SectionCard({
  section,
  board,
  role,
  onCopyComplete,
  copied,
  artifacts,
  items,
}: {
  section: AcfrSection;
  board: AcfrBoard;
  role: ViewerRole;
  onCopyComplete: (s: AcfrSection) => void;
  copied: boolean;
  artifacts: ReturnType<typeof sectionArtifacts>;
  items: CrosswalkItem[];
}) {
  const overdue = section.daysToDue !== null && section.daysToDue < 0;
  const itemsDone = items.filter((c) => c.status === 'Complete').length;
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
        {items.length > 0 ? (
          <>
            {' '}
            · tie-out items <strong>{itemsDone}</strong> / {items.length} complete
          </>
        ) : null}
      </p>

      {items.length > 0 ? (
        <details open>
          <summary>
            <strong>Tie-out items ({items.length})</strong>{' '}
            <span className="footnote">— {itemsDone} complete · click to collapse</span>
          </summary>
          <div className="table-scroll" style={{ marginTop: '0.5rem' }}>
            <table>
              <caption>
                {section.label}: tables and disclosures mapped to sources and tie-outs (illustrative
                statuses)
              </caption>
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
                {items.map((c) => {
                  const dl = daysLeft(c.dueDate, board.refDate);
                  return (
                    <tr key={`${c.acfrPage}-${c.table}`}>
                      <td>
                        {c.table}
                        <div className="footnote">
                          ACFR p.{c.acfrPage} · {c.fund} · {c.source} → {c.tieOut}
                        </div>
                      </td>
                      <td>{c.dueDate}</td>
                      <td className="num">
                        {c.status === 'Complete' || dl === null
                          ? '—'
                          : dl < 0
                            ? `${-dl} overdue`
                            : dl}
                      </td>
                      <td>
                        <Pill tone={statusTone(c.status)}>{c.status}</Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      ) : (
        <p className="footnote" style={{ margin: '0.2rem 0' }}>
          No tie-out items tracked for this section.
        </p>
      )}

      <details>
        <summary className="footnote">
          Status history ({section.history.length}) &amp; artifacts ({section.artifactsExpected})
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

  const { board, records } = useMemo(() => {
    const res = parseContractCsv(acfrCsv);
    if (!res.ok) {
      throw new Error(
        `Bundled ACFR tracker failed its own contract: ${res.errors[0]?.ruleId} ${res.errors[0]?.message}`,
      );
    }
    return { board: buildAcfrBoard(res.records), records: res.records };
  }, []);

  const itemsBySection = useMemo(() => {
    const m = new Map<string, CrosswalkItem[]>();
    for (const c of CROSSWALK) {
      const sectionId = CROSSWALK_SECTION[c.section];
      if (!sectionId) continue;
      const arr = m.get(sectionId) ?? [];
      arr.push(c);
      m.set(sectionId, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return m;
  }, []);

  const complete = board.sections.filter((s) => s.status === 'complete').length;
  const signoff = board.sections.filter((s) => s.status === 'ready_signoff').length;
  const itemsDone = CROSSWALK.filter((c) => c.status === 'Complete').length;

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

  return (
    <>
      <h1>ACFR reporting workflow</h1>
      <p className="footnote">
        Section readiness from contract records (<code>{board.entityId}</code> tracker file, through{' '}
        {board.refDate ?? 'n/a'}): the latest status row per section is the state, and the full row
        history is the change log — the file is the record. Page-level tie-out items sit under their
        sections. Statuses, dates, owners and links are <strong>illustrative demo values</strong>{' '}
        with synthetic actor labels.
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
          <div className="tile-label">Tie-out items complete</div>
          <div className="tile-value">
            {itemsDone} / {CROSSWALK.length}
          </div>
          <div className="tile-sub">across all sections</div>
        </div>
        <div className="tile">
          <div className="tile-label">Viewer role</div>
          <div style={{ margin: '0.3rem 0' }}>
            <select
              aria-label="Viewer role (demonstration only)"
              value={role}
              onChange={(e) => setRole(e.target.value as ViewerRole)}
              style={{ font: 'inherit', fontSize: '0.95rem', padding: '0.25rem 0.4rem' }}
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
          board={board}
          role={role}
          onCopyComplete={copyComplete}
          copied={copiedSection === s.sectionId}
          artifacts={sectionArtifacts(records, s.sectionId)}
          items={itemsBySection.get(s.sectionId) ?? []}
        />
      ))}

      <details className="panel">
        <summary>QA controls register ({QA_CONTROLS.length}) — applies across sections</summary>
        <div className="table-scroll" style={{ marginTop: '0.6rem' }}>
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
              {QA_CONTROLS.map((c) => (
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
      </details>
    </>
  );
}
