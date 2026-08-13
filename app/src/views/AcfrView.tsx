import { useMemo, useState } from 'react';

import acfrCsv from '../../../data/sample/demo_acfr_status_v1.csv?raw';
import { Panel, Tag, type TagVariant } from '../components/ui';
import {
  CROSSWALK,
  QA_CONTROLS,
  type CrosswalkItem,
  type WorkStatus,
} from '../fixtures/acfrWorkflow';
import { parseContractCsv } from '../lib/contract/parse';
import type { AcfrStatus } from '../lib/contract/schema';
import { buildAcfrBoard, completeRowCsv, type AcfrSection } from '../lib/dataset/acfr';

/** ACFR Workflow — section readiness board rebuilt on the LACERA design: stat tiles, per-
 *  section cards with a tie-out progress bar and collapsible item tables, and the QA register.
 *  Data stays on the established rails: section state from the contract tracker file
 *  (acfr_section_status records — the file is the record), tie-out items from the app-bundled
 *  crosswalk. Role gating is DEMONSTRATION ONLY — a static site cannot enforce identity. */

type ViewerRole = 'analyst' | 'lead' | 'leadership';

const STATUS_LABEL: Record<AcfrStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  in_review: 'In review',
  ready_signoff: 'Ready for sign-off',
  complete: 'Complete',
};

/** Design tag mapping: Complete = accent tint; Not started = neutral; Blocked = navy fill;
 *  everything in-flight = outline. Handles both board tokens and crosswalk WorkStatus. */
function statusVariant(s: string): TagVariant {
  if (s === 'Complete' || s === 'complete') return 'accent';
  if (s === 'Not Started' || s === 'Not started' || s === 'not_started') return 'neutral';
  if (s === 'Blocked') return 'blocked';
  return 'outline';
}

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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function SectionCard({
  section,
  items,
  refDate,
  role,
  copied,
  onCopyComplete,
}: {
  section: AcfrSection;
  items: CrosswalkItem[];
  refDate: string | null;
  role: ViewerRole;
  copied: boolean;
  onCopyComplete: (s: AcfrSection) => void;
}) {
  const dLeft = (due: string): number | null =>
    refDate ? Math.round((Date.parse(due) - Date.parse(refDate)) / 86400000) : null;
  const done = items.filter((c) => c.status === 'Complete').length;
  const statusTxt = `${STATUS_LABEL[section.status]}${section.version ? ` ${section.version}` : ''}`;

  return (
    <Panel className="acfr-card">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{section.label}</h2>
        <span style={{ fontSize: 11.5, letterSpacing: '0.1em', color: 'var(--muted-65)' }}>
          {section.sectionId}
        </span>
        <span style={{ marginLeft: 'auto' }}>
          <Tag variant={statusVariant(section.status)}>{statusTxt}</Tag>
        </span>
      </div>
      <div className="acfr-meta">
        Owner <strong>{section.owner || '—'}</strong> · updated {section.lastUpdated || '—'} · due{' '}
        {section.dueDate ?? '—'} ({section.dueDate ? dLeft(section.dueDate) : '—'} days left) ·
        artifacts{' '}
        <strong>
          {section.artifactsIn} / {section.artifactsExpected}
        </strong>{' '}
        in · tie-out items{' '}
        <strong>
          {done} / {items.length}
        </strong>{' '}
        complete
      </div>
      <div className="acfr-progress">
        <div
          style={{ width: items.length ? `${((done / items.length) * 100).toFixed(0)}%` : '0%' }}
        />
      </div>
      <details>
        <summary>
          Tie-out items ({items.length}) <span className="hint">— click to expand</span>
        </summary>
        <div className="table-scroll" style={{ marginTop: 10 }}>
          <table className="table">
            <caption>{section.label} tie-out items</caption>
            <thead>
              <tr>
                <th scope="col">Table / disclosure</th>
                <th scope="col" className="num">
                  Due
                </th>
                <th scope="col" className="num">
                  Days left
                </th>
                <th scope="col" className="num">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={`${c.acfrPage}-${c.table}`}>
                  <td>
                    {c.table}
                    <div style={{ fontSize: 11.5, color: 'var(--muted-65)' }}>
                      ACFR p. {c.acfrPage} · {c.fund}
                    </div>
                  </td>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>
                    {c.dueDate}
                  </td>
                  <td className="num">
                    {c.status === 'Complete' ? '—' : (dLeft(c.dueDate) ?? '—')}
                  </td>
                  <td className="num">
                    <Tag variant={statusVariant(c.status)}>{c.status}</Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      {section.status === 'ready_signoff' ? (
        <div style={{ marginTop: 14 }}>
          {role === 'leadership' ? (
            <button type="button" className="btn-primary" onClick={() => onCopyComplete(section)}>
              {copied
                ? 'Row copied ✓ — append to the tracker and re-import'
                : 'Mark complete (copies a CSV row)'}
            </button>
          ) : (
            <span style={{ fontSize: 12.5, color: 'var(--muted-72)' }}>
              Ready for sign-off — switch the viewer role to <strong>leadership</strong> to see the
              demonstration Complete action.
            </span>
          )}
        </div>
      ) : null}
    </Panel>
  );
}

export function AcfrView() {
  const [role, setRole] = useState<ViewerRole>('analyst');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const board = useMemo(() => {
    const res = parseContractCsv(acfrCsv);
    if (!res.ok) {
      throw new Error(
        `Bundled ACFR tracker failed its own contract: ${res.errors[0]?.ruleId} ${res.errors[0]?.message}`,
      );
    }
    return buildAcfrBoard(res.records);
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

  const allItems: CrosswalkItem[] = [...itemsBySection.values()].flat();
  const tiesDone = allItems.filter((c) => c.status === 'Complete').length;
  const complete = board.sections.filter((s) => s.status === 'complete').length;
  const signoff = board.sections.filter((s) => s.status === 'ready_signoff').length;

  let nextDue: string | null = null;
  for (const c of allItems) {
    if (c.status !== 'Complete' && (!nextDue || c.dueDate < nextDue)) nextDue = c.dueDate;
  }
  const nextDueLabel = nextDue
    ? `${MONTHS[+nextDue.slice(5, 7) - 1]} ${+nextDue.slice(8, 10)}, ${nextDue.slice(0, 4)}`
    : '—';
  const nextDueSub =
    nextDue && board.refDate
      ? `${Math.round((Date.parse(nextDue) - Date.parse(board.refDate)) / 86400000)} days out · earliest open tie-out item`
      : '';

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
      setTimeout(() => setCopiedSection(null), 3200);
    } catch {
      setCopiedSection(null);
    }
  }

  return (
    <>
      <div className="muted-note" style={{ margin: '-6px 0 18px', maxWidth: 960, fontSize: 13 }}>
        Section readiness for the ACFR production cycle, through {board.refDate ?? 'n/a'}: the
        latest status row per section is the state, and the full row history is the change log — the
        file is the record. Statuses, dates, owners and links are{' '}
        <strong>illustrative demo values</strong> with synthetic actor labels; the tie-out structure
        follows the published ACFR table of contents.
      </div>

      <div className="grid-kpi">
        <Panel tight kicker="Sections complete">
          <div className="stat-value">
            {complete} / {board.sections.length}
          </div>
          <div className="stat-sub">of the five ACFR sections</div>
        </Panel>
        <Panel tight kicker="Ready for sign-off">
          <div className="stat-value">{signoff}</div>
          <div className="stat-sub">awaiting leadership</div>
        </Panel>
        <Panel tight kicker="Tie-out items complete">
          <div className="stat-value">
            {tiesDone} / {allItems.length}
          </div>
          <div className="stat-sub">across all sections</div>
        </Panel>
        <Panel tight kicker="Next tie-out due">
          <div className="stat-value smaller">{nextDueLabel}</div>
          <div className="stat-sub">{nextDueSub}</div>
        </Panel>
      </div>

      <div className="role-row">
        <label>
          Viewer role
          <select
            className="input"
            style={{ width: 'auto', minWidth: 130 }}
            value={role}
            onChange={(e) => setRole(e.target.value as ViewerRole)}
          >
            <option value="analyst">analyst</option>
            <option value="lead">lead</option>
            <option value="leadership">leadership</option>
          </select>
        </label>
        <div className="note">
          Demonstration only — not access control. A static prototype cannot securely enforce roles:
          only leadership completes a section; the enforceable, identity-aware tracker belongs in
          the internal environment.
        </div>
      </div>

      {board.sections.map((s) => (
        <div className="mt" key={s.sectionId} style={{ marginTop: 20 }}>
          <SectionCard
            section={s}
            items={itemsBySection.get(s.sectionId) ?? []}
            refDate={board.refDate}
            role={role}
            copied={copiedSection === s.sectionId}
            onCopyComplete={copyComplete}
          />
        </div>
      ))}

      <details className="panel" style={{ marginTop: 20, padding: '18px 22px' }}>
        <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
          QA controls register ({QA_CONTROLS.length}) — applies across sections
        </summary>
        <div className="table-scroll" style={{ marginTop: 12 }}>
          <table className="table">
            <caption>QA controls register</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Control</th>
                <th scope="col">Applies to</th>
                <th scope="col">Severity</th>
                <th scope="col" className="num">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {QA_CONTROLS.map((q) => (
                <tr key={q.control}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>{q.category}</td>
                  <td>{q.control}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted-72)' }}>{q.appliesTo}</td>
                  <td>{q.severity}</td>
                  <td className="num">
                    <Tag variant={statusVariant(q.status satisfies WorkStatus)}>{q.status}</Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <div className="source-line" style={{ marginTop: 12 }}>
        Tie-out structure per the 2025 ACFR table of contents; statuses, owners and dates are
        illustrative demonstration values.
      </div>
    </>
  );
}
