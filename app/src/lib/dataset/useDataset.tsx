import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import fixtureCsv from '../../../../data/sample/demofund_export_v1.csv?raw';
import { parseContractCsv, type ImportError } from '../contract/parse';
import { buildDataset, type Dataset } from './model';

/** Dataset state: bundled fixture by default; a valid user import replaces it (memory only). */

export const FIXTURE_ENTITY = 'DEMOFUND';

interface DatasetState {
  dataset: Dataset;
  source: 'fixture' | 'import';
  importWarnings: ImportError[];
  lastRejection: ImportError[] | null;
  importCsvText: (text: string) => { ok: boolean; errors: ImportError[] };
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
  const [lastRejection, setLastRejection] = useState<ImportError[] | null>(null);

  const importCsvText = useCallback((text: string) => {
    const res = parseContractCsv(text, FIXTURE_ENTITY);
    if (!res.ok) {
      setLastRejection(res.errors);
      return { ok: false as const, errors: res.errors };
    }
    setDataset(buildDataset(res.records, 'user_import'));
    setSource('import');
    setImportWarnings(res.warnings);
    setLastRejection(null);
    return { ok: true as const, errors: [] };
  }, []);

  const resetToFixture = useCallback(() => {
    setDataset(fixture);
    setSource('fixture');
    setImportWarnings([]);
    setLastRejection(null);
  }, [fixture]);

  const value = useMemo(
    () => ({ dataset, source, importWarnings, lastRejection, importCsvText, resetToFixture }),
    [dataset, source, importWarnings, lastRejection, importCsvText, resetToFixture],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDataset(): DatasetState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDataset outside DatasetProvider');
  return v;
}
