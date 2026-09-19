import Papa from 'papaparse';
import type { CellObject, WorkBook, WorkSheet } from 'xlsx';

/**
 * Spreadsheets opened in the browser. A workbook is turned into the same CSV text a person would
 * get by saving one sheet as CSV, and that text goes through the reader that already checks CSV
 * files (the CIO template reader, the contract validator) — there is one path for the data, not
 * two. Nothing is uploaded: SheetJS is part of the site's own bundle (installed from its official
 * package with an integrity hash, not loaded from a CDN), and it loads only when a workbook is
 * opened.
 *
 * The sheet is found by name, or else by its column names; rows above the column-name row (a
 * title block, say) are left out. Values are taken as stored, not as displayed: a cell formatted 1.23% is 0.0123, a date is its
 * calendar date (YYYY-MM-DD). A workbook whose formulas were never calculated (saved by a tool
 * other than Excel) and cells showing an Excel error are refused with the reason, never read as
 * blanks.
 */

export const SPREADSHEET_ACCEPT = '.csv,text/csv,.xlsx,.xlsm,.xlsb,.xls,.ods';
export const MAX_WORKBOOK_BYTES = 10_000_000;
export const isWorkbookName = (name: string): boolean => /\.(xlsx|xlsm|xlsb|xls|ods)$/i.test(name);

export interface SheetChoice {
  /** the sheet that is the input, by name (case-insensitive), in order of preference */
  names: readonly string[];
  /** the input's column names: the row carrying at least `minMatch` of them (all, by default)
   *  within a sheet's first rows is its header, and otherwise picks the sheet */
  headers?: readonly string[];
  minMatch?: number;
  /** what the sheet is, for messages ("the template's Export tab") */
  what: string;
}

export type WorkbookCsv =
  { ok: true; csv: string; sheetName: string } | { ok: false; errors: string[] };

type Xlsx = typeof import('xlsx');

/** Reads a workbook's bytes and returns the chosen sheet as CSV text, or why it cannot. */
export async function workbookToCsv(bytes: ArrayBuffer, choice: SheetChoice): Promise<WorkbookCsv> {
  let XLSX: Xlsx;
  try {
    XLSX = await import('xlsx');
  } catch {
    return fail([
      'The workbook reader did not load (is the connection down?). Reload the page and try again, or save the sheet as CSV and open that.',
    ]);
  }
  let wb: WorkBook;
  try {
    wb = XLSX.read(new Uint8Array(bytes), {
      type: 'array',
      // formulas and stubs are read so a formula with no saved value can be recognised
      cellFormula: true,
      sheetStubs: true,
      cellNF: true,
      cellHTML: false,
      cellStyles: false,
      bookVBA: false,
    });
  } catch {
    return fail([
      'The file could not be read as a workbook. Save it from Excel as .xlsx and try again.',
    ]);
  }
  return sheetToCsv(XLSX, wb, choice);
}

/** The chosen sheet of an already-read workbook as CSV text (exported for tests). */
export function sheetToCsv(XLSX: Xlsx, wb: WorkBook, choice: SheetChoice): WorkbookCsv {
  const picked = pickSheet(XLSX, wb, choice);
  if (!picked) {
    return fail([
      `No sheet in this workbook is ${choice.what}. Its sheets: ${wb.SheetNames.join(', ') || 'none'}.`,
    ]);
  }
  const { name, headerRow } = picked;
  const ws = wb.Sheets[name]!;
  const ref = ws['!ref'];
  if (!ref) return fail([`The sheet "${name}" is empty.`]);
  const range = XLSX.utils.decode_range(ref);
  const uncalculated: string[] = [];
  const errorCells: string[] = [];
  const rows: string[][] = [];
  for (let r = headerRow ?? range.s.r; r <= range.e.r; r++) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      row.push(cellText(XLSX, ws[addr] as CellObject | undefined, addr, uncalculated, errorCells));
    }
    rows.push(row);
  }
  if (uncalculated.length) {
    return fail([
      `The workbook's formulas have not been calculated (for example cells ${uncalculated.slice(0, 3).join(', ')} on "${name}"). Open it in Excel, save it, and open the saved file here.`,
    ]);
  }
  if (errorCells.length) {
    return fail([
      `${errorCells.length === 1 ? '1 cell' : `${errorCells.length} cells`} on "${name}" ${errorCells.length === 1 ? 'shows' : 'show'} an Excel error: ${errorCells.slice(0, 5).join(', ')}${errorCells.length > 5 ? ', …' : ''}. Fix those formulas and save again.`,
    ]);
  }
  while (rows.length && rows[rows.length - 1]!.every((v) => v === '')) rows.pop();
  if (!rows.length) return fail([`The sheet "${name}" is empty.`]);
  return { ok: true, csv: Papa.unparse(rows, { newline: '\n' }), sheetName: name };
}

/** how far down a sheet the column-name row is looked for */
const HEADER_SEARCH_ROWS = 20;

/** The sheet, and its column-name row when `headers` are given and found (else its first row:
 *  the reader behind this one then says what the first row should be). */
function pickSheet(
  XLSX: Xlsx,
  wb: WorkBook,
  choice: SheetChoice,
): { name: string; headerRow: number | null } | null {
  const header = (n: string) =>
    choice.headers?.length ? headerRowOf(XLSX, wb.Sheets[n], choice) : null;
  for (const want of choice.names) {
    const hit = wb.SheetNames.find((n) => n.trim().toLowerCase() === want.toLowerCase());
    if (hit) return { name: hit, headerRow: header(hit)?.row ?? null };
  }
  let best: { name: string; headerRow: number; score: number } | null = null;
  for (const n of wb.SheetNames) {
    const h = header(n);
    if (h && (!best || h.score > best.score)) best = { name: n, headerRow: h.row, score: h.score };
  }
  return best && { name: best.name, headerRow: best.headerRow };
}

/** the first row, among a sheet's first rows, carrying the most of the wanted column names */
function headerRowOf(
  XLSX: Xlsx,
  ws: WorkSheet | undefined,
  choice: SheetChoice,
): { row: number; score: number } | null {
  const ref = ws?.['!ref'];
  if (!ws || !ref || !choice.headers) return null;
  const wanted = new Set(choice.headers.map((h) => h.toLowerCase()));
  const need = choice.minMatch ?? choice.headers.length;
  const range = XLSX.utils.decode_range(ref);
  let best: { row: number; score: number } | null = null;
  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + HEADER_SEARCH_ROWS - 1); r++) {
    let score = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })] as CellObject | undefined;
      if (cell?.t === 's' && wanted.has(String(cell.v).trim().toLowerCase())) score++;
    }
    if (score >= need && (!best || score > best.score)) best = { row: r, score };
  }
  return best;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function cellText(
  XLSX: Xlsx,
  cell: CellObject | undefined,
  addr: string,
  uncalculated: string[],
  errorCells: string[],
): string {
  if (!cell) return '';
  // a formula whose result Excel never saved: its value is unknown, not blank
  if (cell.t === 'z') {
    if (cell.f !== undefined) uncalculated.push(addr);
    return '';
  }
  switch (cell.t) {
    case 'e':
      errorCells.push(`${addr} (${cell.w ?? 'error'})`);
      return '';
    case 'b':
      return cell.v ? 'TRUE' : 'FALSE';
    case 'n': {
      const v = cell.v as number;
      // a date is its calendar date; any other number is its stored value, not its display
      if (cell.z !== undefined && XLSX.SSF.is_date(cell.z)) {
        const d = XLSX.SSF.parse_date_code(v);
        if (d) return `${d.y}-${pad2(d.m)}-${pad2(d.d)}`;
      }
      return Number.isFinite(v) ? String(v) : '';
    }
    case 'd': {
      const d = cell.v as Date;
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }
    default:
      return cell.v === undefined || cell.v === null ? '' : String(cell.v);
  }
}

function fail(errors: string[]): WorkbookCsv {
  return { ok: false, errors };
}
