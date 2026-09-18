import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { CioPackage } from './cioPackage';

/** The CIO template file opened on this page. It may carry a report's figures before LACERA
 *  publishes them, so it is held in memory only — never written to browser storage, the URL or
 *  anywhere else — and closing or reloading the page clears it. `loaded` counts openings, so the
 *  slides reload when a new file replaces an open one. */
interface CioFileState {
  pkg: CioPackage | null;
  loaded: number;
  open: (pkg: CioPackage) => void;
  close: () => void;
}

const Ctx = createContext<CioFileState>({
  pkg: null,
  loaded: 0,
  // outside the provider (unit tests of single views) there is no file to open
  open: () => undefined,
  close: () => undefined,
});

export function CioFileProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ pkg: CioPackage | null; loaded: number }>({
    pkg: null,
    loaded: 0,
  });
  const value = useMemo<CioFileState>(
    () => ({
      ...state,
      open: (pkg) => setState((s) => ({ pkg, loaded: s.loaded + 1 })),
      close: () => setState((s) => ({ pkg: null, loaded: s.loaded })),
    }),
    [state],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCioFile(): CioFileState {
  return useContext(Ctx);
}
