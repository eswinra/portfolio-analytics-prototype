import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import fixtureCsv from '../../../../data/sample/demofund_export_v1.csv?raw';
import { parseContractCsv, type ImportError } from '../contract/parse';
import { buildDataset, type Dataset } from './model';

/**
 * Dataset state: bundled fixture by default. Imports go through a PREFLIGHT stage — the file
 * is validated and summarized, and nothing is applied until the user explicitly confirms.
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
  importWarnings: ImportError[];
  preflight: PreflightResult | null;
  stageCsvText: (text: string, fileName: string) => PreflightResult;
  applyStaged: () => boolean;
  discardStaged: () => void;
  resetToFixture: () => void;
}

const Ctx = createContext<DatasetState | null>(null);

function loadFixture(): Dataset {
  const res = parseContractCsv(fixtureCsv);
  if (!res.ok) {
    // The bundled fixture is validated in CI; failing loudly here is correct.
    throw new Error(
      `Bundled fixture failed its own contract: ${res.errors[0]?.ruleId} ${res.errors[0]?.message}`,
    );
  }
  return buildDataset(res.records, 'workbook');
}

export function DatasetProvider({ children }: { children: ReactNode }) {
  const fixture = useMemo(loadFixture, []);
  const [dataset, setDataset] = useState<Dataset>(fixture);
  const [source, setSource] = useState<'fixture' | 'import'>('fixture');
  const [importWarnings, setImportWarnings] = useState<ImportError[]>([]);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [stagedText, setStagedText] = useState<string | null>(null);

  const stageCsvText = useCallback((text: string, fileName: string): PreflightResult => {
    const res = parseContractCsv(text, FIXTURE_ENTITY);
    const rowsScanned = Math.max(text.trim().split('\n').length - 1, 0);
    const entityId =
      res.records.find((r) => r.record_type !== 'public_reference')?.entity_id ?? 'unknown';
    const result: PreflightResult = {
      fileName,
      rowsScanned,
      entityId,
      errors: res.errors,
      warnings: res.warnings,
      ok: res.ok,
    };
    setPreflight(result);
    setStagedText(res.ok ? text : null);
    return result;
  }, []);

  const applyStaged = useCallback((): boolean => {
    if (!stagedText || !preflight?.ok) return false;
    const res = parseContractCsv(stagedText, FIXTURE_ENTITY);
    if (!res.ok) return false;
    setDataset(buildDataset(res.records, 'user_import'));
    setSource('import');
    setImportWarnings(res.warnings);
    setPreflight(null);
    setStagedText(null);
    return true;
  }, [stagedText, preflight]);

  const discardStaged = useCallback(() => {
    setPreflight(null);
    setStagedText(null);
  }, []);

  const resetToFixture = useCallback(() => {
    setDataset(fixture);
    setSource('fixture');
    setImportWarnings([]);
    setPreflight(null);
    setStagedText(null);
  }, [fixture]);

  const value = useMemo(
    () => ({
      dataset,
      source,
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
