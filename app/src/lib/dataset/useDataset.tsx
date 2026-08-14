import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import opebCsv from '../../../../data/sample/demo_opeb_export_v1.csv?raw';
import pensionCsv from '../../../../data/sample/demofund_export_v1.csv?raw';
import { checkEntityMatch, ENTITY_REGISTRY } from '../../fixtures/entityRegistry';
import type { PolicyEntity } from '../../fixtures/policyPack';
import { parseContractCsv, type ImportError } from '../contract/parse';
import { buildDataset, type Dataset } from './model';

/**
 * Dataset state: two bundled fixtures (Pension-shaped DEMOFUND and DEMO-OPEB), switched by the
 * masthead tabs. Imports go through a PREFLIGHT stage and, once applied, replace the active
 * tab's dataset until reset. Every calculation is scoped to the selected entity's policy pack.
 */

export const FIXTURE_ENTITY = 'DEMOFUND';

export interface PreflightResult {
  fileName: string;
  rowsScanned: number;
  entityId: string;
  errors: ImportError[];
  warnings: ImportError[];
  ok: boolean;
}

interface DatasetState {
  dataset: Dataset;
  source: 'fixture' | 'import';
  entityTab: PolicyEntity;
  setEntityTab: (e: PolicyEntity) => void;
  importWarnings: ImportError[];
  preflight: PreflightResult | null;
  stageCsvText: (text: string, fileName: string) => PreflightResult;
  applyStaged: () => boolean;
  discardStaged: () => void;
  resetToFixture: () => void;
}

const Ctx = createContext<DatasetState | null>(null);

function loadFixture(csv: string, policyEntity: PolicyEntity): Dataset {
  const res = parseContractCsv(csv);
  if (!res.ok) {
    // Bundled fixtures are validated in CI; failing loudly here is correct.
    throw new Error(
      `Bundled ${policyEntity} fixture failed its own contract: ${res.errors[0]?.ruleId} ${res.errors[0]?.message}`,
    );
  }
  return buildDataset(res.records, 'workbook', policyEntity);
}

/** Blocking import error from the entity registry gate (E-ENTITY / E-UNREGISTERED / E-TRACKER). */
function entityGateError(message: string): ImportError {
  return {
    ruleId: message.slice(0, message.indexOf(' ')),
    severity: 'reject',
    row: 0,
    column: 'entity_id',
    message,
  };
}

export function DatasetProvider({ children }: { children: ReactNode }) {
  const fixtures = useMemo(
    () => ({
      PENSION: loadFixture(pensionCsv, 'PENSION'),
      OPEB: loadFixture(opebCsv, 'OPEB'),
    }),
    [],
  );
  const [entityTab, setEntityTabState] = useState<PolicyEntity>('PENSION');
  const [imported, setImported] = useState<Dataset | null>(null);
  const [importWarnings, setImportWarnings] = useState<ImportError[]>([]);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [stagedText, setStagedText] = useState<string | null>(null);

  const dataset = imported ?? fixtures[entityTab];
  const source: 'fixture' | 'import' = imported ? 'import' : 'fixture';

  const setEntityTab = useCallback((e: PolicyEntity) => {
    // switching tabs always returns to that tab's bundled fixture — and clears any staged
    // preflight, so a file gated against one workspace can never apply into another
    setImported(null);
    setImportWarnings([]);
    setPreflight(null);
    setStagedText(null);
    setEntityTabState(e);
  }, []);

  const stageCsvText = useCallback(
    (text: string, fileName: string): PreflightResult => {
      const res = parseContractCsv(text);
      const rowsScanned = Math.max(text.trim().split('\n').length - 1, 0);
      const entityId =
        res.records.find((r) => r.record_type !== 'public_reference')?.entity_id ?? 'unknown';
      // entity registry gate: a file/workspace mismatch is a HARD block, never a warning
      let errors = res.errors;
      let ok = res.ok;
      if (res.ok) {
        const match = checkEntityMatch(entityId, entityTab);
        if (!match.ok && match.error) {
          errors = [entityGateError(match.error)];
          ok = false;
        }
      }
      const result: PreflightResult = {
        fileName,
        rowsScanned,
        entityId,
        errors,
        warnings: res.warnings,
        ok,
      };
      setPreflight(result);
      setStagedText(ok ? text : null);
      return result;
    },
    [entityTab],
  );

  const applyStaged = useCallback((): boolean => {
    if (!stagedText || !preflight?.ok) return false;
    const res = parseContractCsv(stagedText);
    if (!res.ok) return false;
    const entityId =
      res.records.find((r) => r.record_type !== 'public_reference')?.entity_id ?? 'unknown';
    const match = checkEntityMatch(entityId, entityTab);
    if (!match.ok) return false; // defense in depth: the gate also ran at staging
    const policyEntity = ENTITY_REGISTRY[entityId]?.policyEntity ?? entityTab;
    setImported(buildDataset(res.records, 'user_import', policyEntity));
    setImportWarnings(res.warnings);
    setPreflight(null);
    setStagedText(null);
    return true;
  }, [stagedText, preflight, entityTab]);

  const discardStaged = useCallback(() => {
    setPreflight(null);
    setStagedText(null);
  }, []);

  const resetToFixture = useCallback(() => {
    setImported(null);
    setImportWarnings([]);
    setPreflight(null);
    setStagedText(null);
  }, []);

  const value = useMemo(
    () => ({
      dataset,
      source,
      entityTab,
      setEntityTab,
      importWarnings,
      preflight,
      stageCsvText,
      applyStaged,
      discardStaged,
      resetToFixture,
    }),
    [
      dataset,
      source,
      entityTab,
      setEntityTab,
      importWarnings,
      preflight,
      stageCsvText,
      applyStaged,
      discardStaged,
      resetToFixture,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDataset(): DatasetState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDataset outside DatasetProvider');
  return v;
}
