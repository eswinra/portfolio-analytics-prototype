import { readFileSync } from 'node:fs';

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';

import {
  formulaInputs,
  formulaResult,
  PACKAGE_COLUMNS,
  PACKAGE_SHEET,
  readCioPackage,
  traceKey,
  type CioPackage,
} from './cioPackage';
import { contextFigureIds, resolveFigure } from './provenance';
import { reconcile } from './reconcile';
import { workbookToCsv } from './workbook';

const SAMPLE = readFileSync(
  new URL('../../../data/sample/cio_template_example_aug2026.csv', import.meta.url),
  'utf8',
);
// Excel saves CSV with Windows line endings: a blank line inserted into it must use the same
const EOL = SAMPLE.includes('\r\n') ? '\r\n' : '\n';
const bytesOf = (rel: string) => {
  const b = readFileSync(new URL(rel, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

async function openWorkbook(bytes: ArrayBuffer, name: string): Promise<CioPackage> {
  const r = await workbookToCsv(bytes, PACKAGE_SHEET);
  if (!r.ok) throw new Error(r.errors.join('\n'));
  const p = readCioPackage(r.csv, name, r.origin);
  if (!p.ok) throw new Error(p.errors.join('\n'));
  return p.pkg;
}

describe('the cells a formula reads', () => {
  it('finds the input cells, once each, and leaves out ranges and same-tab references', () => {
    expect(formulaInputs('IF(Pension!E12="","",Pension!E12)')).toEqual(['Pension!E12']);
    expect(
      formulaInputs(
        'IF(Report!C5="","",YEAR(Report!C5)&"-"&TEXT(MONTH(Report!C5),"00")&"-"&TEXT(DAY(Report!C5),"00"))',
      ),
    ).toEqual(['Report!C5']);
    expect(formulaInputs("'Pension inputs'!$B$3*2")).toEqual(["'Pension inputs'!B3"]);
    expect(formulaInputs('Pension!C4+OPEB!C4')).toEqual(['Pension!C4', 'OPEB!C4']);
    expect(formulaInputs('SUM(Pension!A1:A3)')).toEqual([]);
    expect(formulaInputs('A1+B2')).toEqual([]);
  });

  it('names the one cell a formula returns, and none when it works a value out', () => {
    expect(formulaResult('IF(Pension!E12="","",Pension!E12)')).toBe('Pension!E12');
    // a row with a label is guarded on both cells, and returns the value
    expect(formulaResult('IF(OR(Pension!B63="",Pension!C63=""),"",Pension!C63)')).toBe(
      'Pension!C63',
    );
    expect(formulaResult("'Pension inputs'!$B$3")).toBe("'Pension inputs'!B3");
    // a date built from its parts is worked out, not typed in one cell
    expect(
      formulaResult('IF(Report!C5="","",YEAR(Report!C5)&"-"&TEXT(MONTH(Report!C5),"00"))'),
    ).toBeNull();
    expect(formulaResult('Pension!C4+OPEB!C4')).toBeNull();
  });
});

describe('the public example workbook, traced to the cell', () => {
  it('traces a figure to its Export row and the input cell it was typed in', async () => {
    const pkg = await openWorkbook(
      bytesOf('../../public/templates/CIO_Monthly_Template_Example.xlsx'),
      'CIO_Monthly_Template_Example.xlsx',
    );
    // checked against the workbook itself (openpyxl): Export!F35 = IF(Pension!E12="","",Pension!E12)
    expect(pkg.trace[traceKey('performance', 'pension', 'GROWTH', 'return', 'FYTD')]).toEqual({
      row: 35,
      sheet: 'Export',
      cell: 'F35',
      input: 'Pension!E12',
      reads: ['Pension!E12'],
    });
    expect(pkg.trace[traceKey('fund', 'opeb', 'TOTAL', 'cash')]).toEqual({
      row: 161,
      sheet: 'Export',
      cell: 'F161',
      input: 'OPEB!C5',
      reads: ['OPEB!C5'],
    });
    // a row with a label reads the label too, and returns the value
    expect(pkg.trace[traceKey('country', 'pension', 'United States', 'share')]).toMatchObject({
      input: 'Pension!C63',
      reads: ['Pension!B63', 'Pension!C63'],
    });
    // a date is carried in the text column, worked out from the date typed on the Report tab
    const through = pkg.trace[traceKey('report', '', 'data_through', '')]!;
    expect(through).toMatchObject({ row: 4, cell: 'G4', reads: ['Report!C5'] });
    expect(through.input).toBeUndefined();
    // the same trace reaches the report the dashboard shows
    expect(pkg.vintage.trace).toBe(pkg.trace);
  });

  it('traces every figure it read', async () => {
    const pkg = await openWorkbook(
      bytesOf('../../public/templates/CIO_Monthly_Template_Example.xlsx'),
      'CIO_Monthly_Template_Example.xlsx',
    );
    const traced = Object.values(pkg.trace);
    // every row but the items for attention, which are a list rather than figures
    const figures = sampleRows(SAMPLE)
      .slice(1)
      .filter((r) => r[0] !== 'attention' && (r[5] !== '' || r[6] !== '')).length;
    expect(traced).toHaveLength(figures);
    // every figure but the format marker (typed into the Export tab itself) reads an input cell
    expect(traced.filter((t) => t.reads?.length)).toHaveLength(figures - 1);
    expect(pkg.trace[traceKey('report', '', 'format', '')]!.reads).toBeUndefined();
    // and every one has the cell it was typed in, but the three dates, which are worked out
    expect(traced.filter((t) => t.input)).toHaveLength(figures - 4);
    // the input is always one of the cells read
    for (const t of traced) if (t.input) expect(t.reads).toContain(t.input);
  });
});

describe('row numbers are the rows a person sees', () => {
  // blank rows used to be dropped before counting, so every row after one was numbered too low
  it('in a CSV with blank lines, an error names the line it is on', () => {
    const lines = SAMPLE.split(EOL);
    const at = lines.findIndex((l) => l.startsWith('performance,pension,TOTAL,return,1M,'));
    const bad = [...lines];
    bad.splice(at, 0, '', '');
    bad[at + 2] = bad[at + 2]!.replace(',0.1,', ',0.1%,');
    const r = readCioPackage(bad.join(EOL), 'blank_lines.csv');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toContain(`Row ${at + 3}:`);
  });

  it('in a CSV with blank lines, the trace names the line too', () => {
    const lines = SAMPLE.split(EOL);
    const at = lines.findIndex((l) => l.startsWith('fund,pension,TOTAL,cash,'));
    const withBlank = [...lines.slice(0, at), '', ...lines.slice(at)];
    const r = readCioPackage(withBlank.join(EOL), 'blank_line.csv');
    if (!r.ok) throw new Error(r.errors.join('\n'));
    expect(r.pkg.trace[traceKey('fund', 'pension', 'TOTAL', 'cash')]).toEqual({
      row: at + 2,
      sheet: null,
    });
  });

  it('in a workbook with a title above the columns and a blank row, the trace names the sheet row', async () => {
    const rows = sampleRows(SAMPLE);
    const at = rows.findIndex((r) => r[0] === 'fund' && r[1] === 'pension' && r[3] === 'cash');
    // two title rows above the header, and a blank row just before the cash row
    const aoa: (string | number)[][] = [
      ['CIO template export'],
      [],
      ...rows.slice(0, at),
      [],
      ...rows.slice(at),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Export');
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const pkg = await openWorkbook(bytes, 'titled.xlsx');
    // header on sheet row 3; the cash row is `at` rows below it, plus the blank row
    expect(pkg.trace[traceKey('fund', 'pension', 'TOTAL', 'cash')]).toEqual({
      row: 3 + at + 1,
      sheet: 'Export',
      cell: `F${3 + at + 1}`,
    });
  });
});

/** the sample's rows as cells, numbers kept as numbers so a written workbook stores values */
function sampleRows(csv: string): (string | number)[][] {
  const parsed = Papa.parse<string[]>(csv.replace(/^\uFEFF/, ''), { skipEmptyLines: true });
  return parsed.data.map((cells) =>
    PACKAGE_COLUMNS.map((_, i) => {
      const c = cells[i] ?? '';
      return i === 5 && c !== '' && Number.isFinite(Number(c)) ? Number(c) : c;
    }),
  );
}

describe('reconciliation points at the row to fix', () => {
  it('every figure it flags is found in the file', () => {
    // Growth's FYTD return, 17.5%, typed as 15.7%
    const lines = SAMPLE.split(EOL);
    const at = lines.findIndex((l) => l.startsWith('performance,pension,GROWTH,return,FYTD,'));
    const cells = lines[at]!.split(',');
    cells[5] = '15.7';
    lines[at] = cells.join(',');
    const p = readCioPackage(lines.join(EOL), 'June.csv');
    if (!p.ok) throw new Error(p.errors.join('\n'));
    const r = reconcile(p.pkg.vintage);
    const keys = [
      ...r.within.failed.map((c) => c.key),
      ...r.chained.failed.map((c) => c.key),
      ...r.tieOut.differences.map((d) => d.key),
    ];
    expect(keys).toHaveLength(3);
    // all three are the one mistyped figure, on its own line of the CSV
    for (const k of keys) expect(p.pkg.trace[k!]).toEqual({ row: at + 1, sheet: null });
  });
});

describe('the provenance drawer, for a figure from a template file', () => {
  it('says which cell it was typed in, and cites that cell', async () => {
    const pkg = await openWorkbook(
      bytesOf('../../public/templates/CIO_Monthly_Template_Example.xlsx'),
      'CIO_Monthly_Template_Example.xlsx',
    );
    const ctx = { vintage: pkg.vintage, base: 'calculated' as const };
    const r = resolveFigure('pension.growth.r.FYTD', ctx);
    if (!r.ok) throw new Error(r.reason);
    expect(r.fig.read[0]).toBe(
      'Typed in Pension!E12 of CIO_Monthly_Template_Example.xlsx, and read from its Export tab, cell F35 (row 35).',
    );
    expect(r.fig.sources[0]!.pageTable).toBe('Pension!E12 → Export!F35');

    // a calculated figure cites each of its inputs' cells
    const x = resolveFigure('pension.x.FYTD', ctx);
    if (!x.ok) throw new Error(x.reason);
    expect(x.fig.sources.map((s) => s.pageTable)).toEqual([
      expect.stringMatching(/^Pension!\w+ → Export!F\d+$/),
      expect.stringMatching(/^Pension!\w+ → Export!F\d+$/),
    ]);

    // shown in other units than the file carries, and it says so
    const aum = resolveFigure('pension.aum', ctx);
    if (!aum.ok) throw new Error(aum.reason);
    expect(aum.fig.read[0]).toContain('The file carries it in $ millions');
  });

  it('traces the market table and the macro strip to their cells, as the team’s own', async () => {
    const pkg = await openWorkbook(
      bytesOf('../../public/templates/CIO_Monthly_Template_Example.xlsx'),
      'CIO_Monthly_Template_Example.xlsx',
    );
    const ctx = { vintage: pkg.vintage, base: 'calculated' as const, macro: pkg.macro };
    const ids = contextFigureIds(pkg.vintage, pkg.macro);
    expect(ids.filter((id) => !resolveFigure(id, ctx).ok)).toEqual([]);

    const m = resolveFigure('market.us-large-cap.FYTD', ctx);
    if (!m.ok) throw new Error(m.reason);
    expect(m.fig.report).toBe('Template file CIO_Monthly_Template_Example.xlsx, not published');
    expect(m.fig.sources[0]!.pageTable).toMatch(/^Markets!\w+ → Export!F\d+$/);

    // the file's strip is typed text: it is cited by its cell and dated by nothing but its label
    const pce = resolveFigure('macro.pce', ctx);
    if (!pce.ok) throw new Error(pce.reason);
    expect(pce.fig.display).toBe(pkg.macro.find((l) => l.l.startsWith('PCE'))!.v);
    expect(pce.fig.sources[0]!.pageTable).toMatch(/^Macro!\w+ → Export!G\d+$/);
    expect(pce.fig.formula).toBeUndefined();
    expect(pce.fig.when.kind).toBe('undated');
  });

  it('from a CSV, names the row and says the cell is not recorded', () => {
    const p = readCioPackage(SAMPLE, 'June.csv');
    if (!p.ok) throw new Error(p.errors.join('\n'));
    const r = resolveFigure('pension.growth.r.FYTD', {
      vintage: p.pkg.vintage,
      base: 'calculated',
    });
    if (!r.ok) throw new Error(r.reason);
    expect(r.fig.read[0]).toMatch(
      /^Read from row 35 of June\.csv\. A CSV does not record which cell/,
    );
  });
});
