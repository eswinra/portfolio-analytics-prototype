import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { PACKAGE_SHEET, readCioPackage, type CioPackage } from './cioPackage';
import { isWorkbookName, MAX_WORKBOOK_BYTES, workbookToCsv, type SheetOrigin } from './workbook';

/** The CIO template file opened on this page. It may carry a report's figures before LACERA
 *  publishes them, so it is held in memory only — never written to browser storage, the URL or
 *  anywhere else — and closing or reloading the page clears it. `loaded` counts openings, so the
 *  slides reload when a new file replaces an open one. */

/** How the open file was read, for the Monthly run: nothing here is the file's content. */
export interface OpenedFrom {
  bytes: number;
  /** the workbook tab read, or null for a CSV */
  sheet: string | null;
  /** read and checked in this many milliseconds */
  ms: number;
  /** the public example bundled with the site, rather than a file from this computer */
  example: boolean;
}

interface CioFileState {
  pkg: CioPackage | null;
  from: OpenedFrom | null;
  loaded: number;
  open: (pkg: CioPackage, from?: OpenedFrom) => void;
  close: () => void;
}

const Ctx = createContext<CioFileState>({
  pkg: null,
  from: null,
  loaded: 0,
  // outside the provider (unit tests of single views) there is no file to open
  open: () => undefined,
  close: () => undefined,
});

export function CioFileProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    pkg: CioPackage | null;
    from: OpenedFrom | null;
    loaded: number;
  }>({ pkg: null, from: null, loaded: 0 });
  const value = useMemo<CioFileState>(
    () => ({
      ...state,
      open: (pkg, from) => setState((s) => ({ pkg, from: from ?? null, loaded: s.loaded + 1 })),
      close: () => setState((s) => ({ pkg: null, from: null, loaded: s.loaded })),
    }),
    [state],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCioFile(): CioFileState {
  return useContext(Ctx);
}

/** The public example: the template filled with the latest published report's figures. */
export const EXAMPLE_FILE = 'CIO_Monthly_Template_Example.xlsx';
export const EXAMPLE_URL = `templates/${EXAMPLE_FILE}`;

export interface OpenErrors {
  name: string;
  errors: string[];
}

/** Opening a template file, the same way wherever it is opened: size limit, workbook or CSV,
 *  the template's own checks, and every problem listed with nothing shown if there is one. */
export function useTemplateOpener() {
  const file = useCioFile();
  const [errors, setErrors] = useState<OpenErrors | null>(null);

  const read = useCallback(
    async (
      name: string,
      bytes: number,
      body: () => Promise<ArrayBuffer | string>,
      example: boolean,
    ): Promise<boolean> => {
      const t0 = performance.now();
      const book = isWorkbookName(name);
      if (bytes > (book ? MAX_WORKBOOK_BYTES : 2_000_000)) {
        setErrors({
          name,
          errors: ['The file is far larger than a CIO template; check that it is the right file.'],
        });
        return false;
      }
      let text: string;
      let sheet: string | null = null;
      let origin: SheetOrigin | undefined;
      const raw = await body();
      if (book) {
        const res = await workbookToCsv(
          typeof raw === 'string' ? new TextEncoder().encode(raw).buffer : raw,
          PACKAGE_SHEET,
        );
        if (!res.ok) {
          setErrors({ name, errors: res.errors });
          return false;
        }
        text = res.csv;
        sheet = res.sheetName;
        origin = res.origin;
      } else {
        text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
      }
      const res = readCioPackage(text, name, origin);
      if (!res.ok) {
        setErrors({ name, errors: res.errors });
        return false;
      }
      setErrors(null);
      file.open(res.pkg, { bytes, sheet, ms: performance.now() - t0, example });
      return true;
    },
    [file],
  );

  const openFile = useCallback(
    (f: File) =>
      read(f.name, f.size, () => (isWorkbookName(f.name) ? f.arrayBuffer() : f.text()), false),
    [read],
  );

  // the example is a file of the site itself, fetched from the same address as the page: nothing
  // goes out, and nothing from this computer is read
  const openExample = useCallback(async () => {
    let buf: ArrayBuffer;
    try {
      const res = await fetch(EXAMPLE_URL);
      // a page served in its place (a "not found" page, an app fallback) is not the workbook
      if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) {
        throw new Error(String(res.status));
      }
      buf = await res.arrayBuffer();
    } catch {
      setErrors({
        name: EXAMPLE_FILE,
        errors: [
          'The example could not be loaded from the site. Check the connection and try again, or download it from the link and open it as a file.',
        ],
      });
      return false;
    }
    return read(EXAMPLE_FILE, buf.byteLength, () => Promise.resolve(buf), true);
  }, [read]);

  return { openFile, openExample, errors, clearErrors: () => setErrors(null) };
}
