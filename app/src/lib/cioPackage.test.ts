import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CIO_LATEST, MACRO, OPS, type CioEntity } from '../fixtures/cioMonthly';
import { deckDataFor } from './deckFeed';
import { readCioPackage, type PackageResult } from './cioPackage';

/** The committed sample is the Export tab of the filled example workbook, saved by desktop Excel
 *  as "CSV UTF-8" (tools/qa_cio_template.py) — the file a person really produces. Built back,
 *  it must be the published report it was filled from. */
const SAMPLE = readFileSync(
  new URL('../../../data/sample/cio_template_example_aug2026.csv', import.meta.url),
  'utf8',
);

const ok = (r: PackageResult) => {
  if (!r.ok) throw new Error(r.errors.join('\n'));
  return r.pkg;
};
const errorsOf = (text: string) => {
  const r = readCioPackage(text, 'test.csv');
  if (r.ok) throw new Error('expected the file to be refused');
  return r.errors.join('\n');
};
/** the sample with one line replaced (by its start) or removed */
const edit = (startsWith: string, next: string | null) => {
  const lines = SAMPLE.split(/\r?\n/);
  const i = lines.findIndex((l) => l.startsWith(startsWith));
  if (i < 0) throw new Error(`no line starts with ${startsWith}`);
  if (next === null) lines.splice(i, 1);
  else lines[i] = next;
  return lines.join('\r\n');
};
/** a published entity without the labels a template cannot know (report pages) */
const comparable = (e: CioEntity) => ({ ...e, pages: '', geo: { ...e.geo, page: 0 } });

describe('CIO template file', () => {
  it('rebuilds the published report it was filled from, both funds', () => {
    const pkg = ok(readCioPackage(SAMPLE, 'cio_template_example_aug2026.csv'));
    const v = pkg.vintage;
    expect(v.origin).toBe('file');
    expect([v.reportDate, v.dataThrough, v.marketAsOf]).toEqual([
      CIO_LATEST.reportDate,
      CIO_LATEST.dataThrough,
      CIO_LATEST.marketAsOf,
    ]);
    for (const f of ['pension', 'opeb'] as const) {
      expect(comparable(v.ENT[f])).toEqual(comparable(CIO_LATEST.ENT[f]));
    }
    expect(v.MKT).toEqual(CIO_LATEST.MKT);
    expect(pkg.macro).toEqual(MACRO);
    expect(pkg.ops).toEqual(OPS);
  });

  it('feeds the slides the same figures as the published deck, marked as a local file', () => {
    const pkg = ok(readCioPackage(SAMPLE, 'my export.csv'));
    const fromFile = deckDataFor(pkg.vintage, { pkg });
    const published = deckDataFor(CIO_LATEST);
    expect(fromFile.MACRO).toEqual(published.MACRO);
    expect(fromFile.OPS).toEqual(published.OPS);
    expect(fromFile.MKT).toEqual(published.MKT);
    expect(fromFile.ENT.pension.total).toEqual(published.ENT.pension.total);
    expect(fromFile.VINTAGE.local).toEqual({
      kind: 'template file',
      name: 'my export.csv',
      cls: 'calculated',
    });
    expect(fromFile.VINTAGE.macroLabel).toBeUndefined();
    expect(fromFile.VINTAGE.single).toBeUndefined();
  });

  it('reads the file without Excel’s byte-order mark and with LF line ends', () => {
    ok(
      readCioPackage(
        SAMPLE.replace(String.fromCharCode(0xfeff), '').replace(/\r\n/g, '\n'),
        'x.csv',
      ),
    );
  });

  it('refuses a file that is not the Export tab', () => {
    expect(errorsOf('Report,,\nReport (meeting) date,,2026-08-12\n')).toMatch(/Export tab/);
  });

  it('refuses a file whose characters were lost in saving (not CSV UTF-8)', () => {
    expect(
      errorsOf(SAMPLE.replace('3.50–3.75%', `3.50${String.fromCharCode(0xfffd)}3.75%`)),
    ).toMatch(/CSV UTF-8/);
  });

  it('refuses values formatted as percentages', () => {
    expect(
      errorsOf(
        edit('performance,pension,TOTAL,return,1M,', 'performance,pension,TOTAL,return,1M,0.1%,'),
      ),
    ).toMatch(/plain numbers/);
  });

  it('checks the report’s own identities, fund by fund', () => {
    expect(
      errorsOf(
        edit('allocation,pension,GROWTH,weight,', 'allocation,pension,GROWTH,weight,,50.6,'),
      ),
    ).toMatch(/Pension Fund: the weights add to 102\.0%/);
    expect(
      errorsOf(
        edit('allocation,opeb,CREDIT,market_value,', 'allocation,opeb,CREDIT,market_value,,1,'),
      ),
    ).toMatch(/OPEB Trust: the category market values add to/);
    expect(
      errorsOf(edit('histogram,pension,BIN_07,count,', 'histogram,pension,BIN_07,count,,1,')),
    ).toMatch(/bin counts add to \d+, not 120 months/);
  });

  it('lists every missing required figure instead of showing a partial report', () => {
    const text = errorsOf(
      edit('performance,opeb,TOTAL,benchmark,FYTD,', null).replace(
        /^fund,pension,TOTAL,cash,.*$/m,
        '',
      ),
    );
    expect(text).toMatch(/OPEB Trust: the Total Fund benchmark for FYTD is missing/);
    expect(text).toMatch(/OPEB Trust: TOTAL FYTD has a return but no benchmark/);
    expect(text).toMatch(/Pension Fund: cash and equivalents are missing/);
  });

  it('names the row for unknown sections, entities, statuses and duplicates', () => {
    const extra = (line: string) => `${SAMPLE.trimEnd()}\r\n${line}\r\n`;
    expect(errorsOf(extra('forecast,pension,TOTAL,return,1M,5,'))).toMatch(
      /Row 560: section "forecast" is not recognized/,
    );
    expect(errorsOf(extra('fund,retiree,TOTAL,cash,,1,'))).toMatch(
      /entity must be pension or opeb/,
    );
    expect(errorsOf(extra('attention,,Total Fund,Someday,,,A new item'))).toMatch(
      /status "someday"/,
    );
    expect(errorsOf(extra('fund,pension,TOTAL,cash,,1,'))).toMatch(/appears twice/);
  });

  it('checks the dates: data through is a month end on or before the report date', () => {
    expect(errorsOf(edit('report,,data_through,', 'report,,data_through,,,,2026-06-29'))).toMatch(
      /month-end/,
    );
    expect(errorsOf(edit('report,,report_date,', 'report,,report_date,,,,2026-05-12'))).toMatch(
      /must come after the date its data runs through/,
    );
    expect(errorsOf(edit('report,,format,', 'report,,format,,,,cio-template-0'))).toMatch(
      /current template/,
    );
  });
});

/** Audit 2026-09-18: missing figures stay missing; values the report's definitions rule out are
 *  refused, with the whole file. */
describe('CIO template file: absent and impossible values', () => {
  const without = (re: RegExp) =>
    SAMPLE.split(/\r?\n/)
      .filter((l) => !re.test(l))
      .join('\r\n');

  it('flows left empty are "not supplied", never a $0M net', () => {
    const pkg = ok(readCioPackage(without(/^allocation,(pension|opeb),[^,]+,flow,/), 'x.csv'));
    for (const f of ['pension', 'opeb'] as const) {
      const e = pkg.vintage.ENT[f];
      expect(e.netflow).toBeNull();
      for (const c of e.comps) expect(c.flow).toBeNull();
      expect(e.other?.flow ?? null).toBeNull();
    }
  });

  it('refuses flows given for some lines only', () => {
    expect(errorsOf(without(/^allocation,pension,RRM,flow,/))).toMatch(
      /Pension Fund: flows are given for some lines but not RRM/,
    );
  });

  it('refuses the audit cases: counts, dispersion, latest month, target, dates', () => {
    expect(
      errorsOf(
        edit('histogram,pension,BIN_00,', 'histogram,pension,BIN_00,count,,-1.5,').replace(
          /^histogram,pension,BIN_01,.*$/m,
          'histogram,pension,BIN_01,count,,2.5,',
        ),
      ),
    ).toMatch(/BIN_00 must be a whole number of months, 0 or more/);
    expect(errorsOf(edit('histogram,pension,STAT,sd,', 'histogram,pension,STAT,sd,,-2,'))).toMatch(
      /standard deviation cannot be negative/,
    );
    expect(
      errorsOf(edit('histogram,pension,STAT,latest,', 'histogram,pension,STAT,latest,,20,')),
    ).toMatch(/latest month must lie between|not the Total Fund 1M return/);
    expect(
      errorsOf(edit('allocation,pension,GROWTH,target,', 'allocation,pension,GROWTH,target,,480,')),
    ).toMatch(/GROWTH policy target must be between 0% and 100%/);
    expect(errorsOf(edit('report,,report_date,', 'report,,report_date,,,,2026-06-01'))).toMatch(
      /report date \(2026-06-01\) must come after the date its data runs through \(2026-06-30\)/,
    );
    expect(errorsOf(edit('report,,report_date,', 'report,,report_date,,,,2026-02-30'))).toMatch(
      /must be a real date/,
    );
  });

  it('refuses a latest month that disagrees with the same month’s fund return', () => {
    // inside min..max, but not the Total Fund 1M return (0.1%)
    expect(
      errorsOf(edit('histogram,pension,STAT,latest,', 'histogram,pension,STAT,latest,,0.8,')),
    ).toMatch(/latest month \(0\.8%\) is not the Total Fund 1M return \(0\.1%\)/);
  });
});
