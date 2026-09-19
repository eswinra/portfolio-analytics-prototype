import { readFileSync } from 'node:fs';

import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';

import { PACKAGE_COLUMNS, readCioPackage } from './cioPackage';
import { isWorkbookName, workbookToCsv, type SheetChoice } from './workbook';

const bytesOf = (rel: string) => {
  const b = readFileSync(new URL(rel, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
/** a workbook written here, as a browser would receive it */
const xlsxOf = (sheets: Record<string, XLSX.WorkSheet>) => {
  const wb = XLSX.utils.book_new();
  for (const [name, ws] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, ws, name);
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
};
const csvOf = async (bytes: ArrayBuffer, choice: SheetChoice) => {
  const r = await workbookToCsv(bytes, choice);
  if (!r.ok) throw new Error(r.errors.join('\n'));
  return r;
};
const errorsOf = async (bytes: ArrayBuffer, choice: SheetChoice) => {
  const r = await workbookToCsv(bytes, choice);
  if (r.ok) throw new Error('expected the workbook to be refused');
  return r.errors.join('\n');
};

const EXPORT: SheetChoice = { names: ['Export'], headers: PACKAGE_COLUMNS, what: 'the Export tab' };
const DATA: SheetChoice = { names: ['Data'], headers: ['a', 'b', 'c'], what: 'a data sheet' };

describe('CIO template workbook', () => {
  it('reads the example workbook as downloaded into the same report as its CSV export', async () => {
    // the example is saved by Excel (tools/qa_cio_template.py), so its formulas carry values
    const r = await csvOf(
      bytesOf('../../public/templates/CIO_Monthly_Template_Example.xlsx'),
      EXPORT,
    );
    expect(r.sheetName).toBe('Export');
    const sample = readFileSync(
      new URL('../../../data/sample/cio_template_example_aug2026.csv', import.meta.url),
      'utf8',
    );
    const fromWorkbook = readCioPackage(r.csv, 'CIO_Monthly_Template_Example.xlsx');
    const fromCsv = readCioPackage(sample, 'CIO_Monthly_Template_Example.xlsx');
    if (!fromWorkbook.ok) throw new Error(fromWorkbook.errors.join('\n'));
    expect(fromWorkbook).toEqual(fromCsv);
  });

  it('refuses a workbook whose formulas were never calculated, rather than reading blanks', async () => {
    // the blank template as generated (openpyxl): formulas without saved results
    const msg = await errorsOf(bytesOf('../../public/templates/CIO_Monthly_Template.xlsx'), EXPORT);
    expect(msg).toMatch(
      /formulas have not been calculated \(for example cells \w+\d+, .* on "Export"\)\. Open it in Excel, save it/,
    );
  });
});

describe('choosing the sheet', () => {
  const rows = [
    ['a', 'b', 'c'],
    [1, 2, 3],
  ];
  it('takes the named sheet, whatever its case, over a sheet that merely matches', async () => {
    const bytes = xlsxOf({
      Notes: XLSX.utils.aoa_to_sheet(rows),
      DATA: XLSX.utils.aoa_to_sheet([
        ['a', 'b', 'c'],
        [7, 8, 9],
      ]),
    });
    const r = await csvOf(bytes, DATA);
    expect(r.sheetName).toBe('DATA');
    expect(r.csv).toBe('a,b,c\n7,8,9');
  });

  it('otherwise takes the sheet whose first row has the columns', async () => {
    const bytes = xlsxOf({
      Cover: XLSX.utils.aoa_to_sheet([['Title'], ['x']]),
      Sheet2: XLSX.utils.aoa_to_sheet(rows),
    });
    expect((await csvOf(bytes, DATA)).sheetName).toBe('Sheet2');
  });

  it('names the sheets it found when none is the input', async () => {
    const bytes = xlsxOf({
      Cover: XLSX.utils.aoa_to_sheet([['Title']]),
      Other: XLSX.utils.aoa_to_sheet([['a', 'x', 'y']]),
    });
    expect(await errorsOf(bytes, DATA)).toBe(
      'No sheet in this workbook is a data sheet. Its sheets: Cover, Other.',
    );
  });
});

describe('cell values', () => {
  it('takes stored values, not what the cell displays', async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['a', 'b', 'c'],
      [0.0123, 93.9, true],
    ]);
    ws.A2!.z = '0.00%'; // shown as 1.23%
    ws.B2!.z = '#,##0'; // shown as 94
    expect((await csvOf(xlsxOf({ Data: ws }), DATA)).csv).toBe('a,b,c\n0.0123,93.9,TRUE');
  });

  it('writes dates as calendar dates', async () => {
    const ws = XLSX.utils.aoa_to_sheet([['a', 'b', 'c'], []]);
    // 46265 is 2026-08-31 in Excel's date serials; stored as a number with a date format
    ws.A2 = { t: 'n', v: 46265, z: 'm/d/yy' };
    ws.B2 = { t: 'n', v: 46265, z: 'yyyy-mm-dd' };
    ws.C2 = { t: 's', v: '2026-08-31' };
    ws['!ref'] = 'A1:C2';
    expect((await csvOf(xlsxOf({ Data: ws }), DATA)).csv).toBe(
      'a,b,c\n2026-08-31,2026-08-31,2026-08-31',
    );
  });

  it('keeps text intact, quoting where CSV needs it, and drops trailing blank rows', async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['a', 'b', 'c'],
      ['Growth, public', 'said "yes"', ''],
      ['', '', ''],
    ]);
    expect((await csvOf(xlsxOf({ Data: ws }), DATA)).csv).toBe(
      'a,b,c\n"Growth, public","said ""yes""",',
    );
  });

  it('refuses cells showing an Excel error, naming them', async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['a', 'b', 'c'],
      [1, 2, 3],
    ]);
    ws.B2 = { t: 'e', v: 0x07, w: '#DIV/0!' };
    expect(await errorsOf(xlsxOf({ Data: ws }), DATA)).toBe(
      '1 cell on "Data" shows an Excel error: B2 (#DIV/0!). Fix those formulas and save again.',
    );
  });

  it('refuses an empty sheet', async () => {
    const bytes = xlsxOf({ Data: XLSX.utils.aoa_to_sheet([]) });
    expect(await errorsOf(bytes, { names: ['Data'], what: 'a data sheet' })).toMatch(/is empty/);
  });
});

describe('file names', () => {
  it('knows a workbook from a CSV file', () => {
    expect(['a.xlsx', 'B.XLSM', 'c.xls', 'd.xlsb', 'e.ods'].every(isWorkbookName)).toBe(true);
    expect(['a.csv', 'b.txt', 'xlsx'].some(isWorkbookName)).toBe(false);
  });
});
