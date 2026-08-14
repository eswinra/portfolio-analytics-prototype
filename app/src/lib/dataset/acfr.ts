import type { AcfrStatus, ContractRecord } from '../contract/schema';

/**
 * ACFR section-readiness board (schema 1.3). Built purely from contract records in the ACFR
 * tracker file: the latest acfr_section_status row per section is the current state, the
 * FULL row history is the change log the team asked for (history-in-the-file — no separate
 * log store), and artifact rows carry links + metadata only, never files.
 */

export const ACFR_SECTION_LABELS: Record<string, string> = {
  INTRO: 'Introductory',
  FIN: 'Financial',
  INV: 'Investments',
  ACT: 'Actuarial',
  STAT: 'Statistical',
};
export const ACFR_SECTION_ORDER = ['INTRO', 'FIN', 'INV', 'ACT', 'STAT'] as const;

export interface AcfrStatusChange {
  date: string;
  status: AcfrStatus;
  version: string;
  actor: string;
}

export interface AcfrArtifact {
  title: string;
  version: string;
  received: boolean;
  link: string;
  actor: string;
}

export interface AcfrSection {
  sectionId: string;
  label: string;
  status: AcfrStatus;
  version: string;
  owner: string;
  lastUpdated: string;
  dueDate: string | null;
  /** days from the board's reference date to the due date; negative = overdue */
  daysToDue: number | null;
  artifactsIn: number;
  artifactsExpected: number;
  history: AcfrStatusChange[];
}

export interface AcfrBoard {
  sections: AcfrSection[];
  /** newest as_of anywhere in the tracker file */
  refDate: string | null;
  entityId: string;
}

export function buildAcfrBoard(records: readonly ContractRecord[]): AcfrBoard {
  const statusRows = records.filter((r) => r.record_type === 'acfr_section_status');
  const artifactRows = records.filter((r) => r.record_type === 'acfr_artifact_link');
  const refDate =
    [...statusRows, ...artifactRows]
      .map((r) => r.as_of_date)
      .sort()
      .at(-1) ?? null;

  const sections: AcfrSection[] = [];
  const sectionIds = [...new Set([...statusRows, ...artifactRows].map((r) => r.category_id))].sort(
    (a, b) =>
      ACFR_SECTION_ORDER.indexOf(a as (typeof ACFR_SECTION_ORDER)[number]) -
      ACFR_SECTION_ORDER.indexOf(b as (typeof ACFR_SECTION_ORDER)[number]),
  );

  for (const sectionId of sectionIds) {
    const history: AcfrStatusChange[] = statusRows
      .filter((r) => r.category_id === sectionId)
      .map((r) => ({
        date: r.as_of_date,
        status: r.value as AcfrStatus,
        version: r.page_table,
        actor: r.entered_by,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const latest = history.at(-1);
    const latestRow = statusRows
      .filter((r) => r.category_id === sectionId)
      .sort((a, b) => a.as_of_date.localeCompare(b.as_of_date))
      .at(-1);
    const dueDate = latestRow?.period_end || null;
    const daysToDue =
      dueDate && refDate
        ? Math.round((Date.parse(dueDate) - Date.parse(refDate)) / 86400000)
        : null;
    const artifacts = artifactRows.filter((r) => r.category_id === sectionId);
    sections.push({
      sectionId,
      label: ACFR_SECTION_LABELS[sectionId] ?? sectionId,
      status: latest?.status ?? 'not_started',
      version: latest?.version ?? '',
      owner: latest?.actor ?? '',
      lastUpdated: latest?.date ?? '',
      dueDate,
      daysToDue,
      artifactsIn: artifacts.filter((r) => r.value === 1 && r.quality_status === 'ok').length,
      artifactsExpected: artifacts.length,
      history,
    });
  }
  return {
    sections,
    refDate,
    entityId: statusRows[0]?.entity_id ?? artifactRows[0]?.entity_id ?? 'unknown',
  };
}

export function sectionArtifacts(
  records: readonly ContractRecord[],
  sectionId: string,
): AcfrArtifact[] {
  return records
    .filter((r) => r.record_type === 'acfr_artifact_link' && r.category_id === sectionId)
    .map((r) => ({
      title: r.source_name,
      version: r.page_table,
      received: r.value === 1 && r.quality_status === 'ok',
      link: r.note,
      actor: r.entered_by,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export interface SectionControls {
  itemsTotal: number;
  itemsComplete: number;
  itemsBlocked: number;
  artifactsIn: number;
  artifactsExpected: number;
  /** independent reviewer named and distinct from the section owner */
  reviewerOk: boolean;
}

export interface SectionEligibility {
  eligible: boolean;
  reasons: string[];
  /** the tracker's claimed status outruns its own controls (e.g. complete at 2/5 tie-outs) */
  statusAheadOfControls: boolean;
}

/** Completion eligibility derived from the section's own controls (audit finding 2):
 *  a section can be marked complete only when every requirement clears. */
export function sectionEligibility(
  section: Pick<AcfrSection, 'status'>,
  c: SectionControls,
): SectionEligibility {
  const reasons: string[] = [];
  const itemsOpen = c.itemsTotal - c.itemsComplete;
  if (itemsOpen > 0)
    reasons.push(`${itemsOpen} tie-out item${itemsOpen === 1 ? '' : 's'} not complete`);
  const artOut = c.artifactsExpected - c.artifactsIn;
  if (artOut > 0) reasons.push(`${artOut} artifact${artOut === 1 ? '' : 's'} outstanding`);
  if (c.itemsBlocked > 0)
    reasons.push(`${c.itemsBlocked} item${c.itemsBlocked === 1 ? '' : 's'} Blocked`);
  if (!c.reviewerOk) reasons.push('independent reviewer sign-off missing');
  if (section.status !== 'ready_signoff') reasons.push('section is not Ready for sign-off');
  return {
    eligible: reasons.length === 0,
    reasons,
    statusAheadOfControls: section.status === 'complete' && c.itemsComplete < c.itemsTotal,
  };
}

/** Ready-to-append CSV row marking a section complete — the demo "action": the file is the
 *  record, so completing a section means appending a status row and re-importing. */
export function completeRowCsv(
  board: AcfrBoard,
  section: AcfrSection,
  actor: string,
  reviewer: string,
  nextRecordId: string,
): string {
  const today = board.refDate ?? section.lastUpdated;
  return [
    nextRecordId,
    'acfr_section_status',
    board.entityId,
    'section_status',
    section.sectionId,
    'complete',
    '1',
    'USD',
    '1',
    today,
    '',
    section.dueDate ?? '',
    '',
    'Ad Hoc',
    'synthetic',
    'user_import',
    'ACFR tracker',
    section.version,
    'synthetic generator',
    today,
    'n/a',
    'n/a',
    'n/a',
    'final',
    '',
    '',
    'ok',
    'marked complete via dashboard demo action',
    '1.3.0',
    actor,
    reviewer,
    'published',
  ].join(',');
}
