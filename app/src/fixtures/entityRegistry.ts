import type { PolicyEntity } from './policyPack';

/**
 * Explicit entity → legal fund → policy mapping (audit finding 3). Policy identity is never
 * inferred from entity-name text: an entity is either registered here or its file cannot be
 * applied. Tracker entities are registered but are not importable into a fund workspace.
 */

export interface EntityRecord {
  entityId: string;
  fundLabel: string;
  kind: 'portfolio' | 'tracker';
  policyEntity: PolicyEntity;
  bookLabel: string;
}

export const ENTITY_REGISTRY: Record<string, EntityRecord> = {
  DEMOFUND: {
    entityId: 'DEMOFUND',
    fundLabel: 'Pension Plan (synthetic)',
    kind: 'portfolio',
    policyEntity: 'PENSION',
    bookLabel: 'IBOR (synthetic workbook)',
  },
  'DEMO-OPEB': {
    entityId: 'DEMO-OPEB',
    fundLabel: 'OPEB Trust (synthetic)',
    kind: 'portfolio',
    policyEntity: 'OPEB',
    bookLabel: 'IBOR (synthetic workbook)',
  },
  'DEMO-ACFR': {
    entityId: 'DEMO-ACFR',
    fundLabel: 'ACFR production tracker (synthetic)',
    kind: 'tracker',
    policyEntity: 'PENSION',
    bookLabel: 'n/a',
  },
};

/** The registered portfolio entity for each workspace tab. */
export const WORKSPACE_ENTITY: Record<PolicyEntity, string> = {
  PENSION: 'DEMOFUND',
  OPEB: 'DEMO-OPEB',
};

export interface EntityMatch {
  ok: boolean;
  /** blocking message (E-ENTITY / E-UNREGISTERED / E-TRACKER) when not ok */
  error?: string;
  record?: EntityRecord;
}

/** Hard gate for Apply: the staged file's entity must be the active workspace's registered
 *  portfolio entity. A mismatch names both sides and what would have been replaced. */
export function checkEntityMatch(stagedEntityId: string, active: PolicyEntity): EntityMatch {
  const record = ENTITY_REGISTRY[stagedEntityId];
  const activeId = WORKSPACE_ENTITY[active];
  const activeRecord = ENTITY_REGISTRY[activeId]!;
  if (!record) {
    return {
      ok: false,
      error:
        `E-UNREGISTERED — entity "${stagedEntityId}" is not in the entity registry ` +
        `(fixtures/entityRegistry.ts), so its legal fund and policy cannot be established. ` +
        `Nothing was applied.`,
    };
  }
  if (record.kind === 'tracker') {
    return {
      ok: false,
      record,
      error:
        `E-TRACKER — "${stagedEntityId}" is the ${record.fundLabel}; tracker files are not ` +
        `imported into a fund workspace. Nothing was applied.`,
    };
  }
  if (stagedEntityId !== activeId) {
    return {
      ok: false,
      record,
      error:
        `E-ENTITY — this file describes ${stagedEntityId} (${record.fundLabel}), but the ` +
        `active workspace is ${activeId} (${activeRecord.fundLabel}). Applying would replace ` +
        `the ${activeRecord.fundLabel} dataset with another fund's data. Switch the workspace ` +
        `or stage the matching file. Nothing was applied.`,
    };
  }
  return { ok: true, record };
}
