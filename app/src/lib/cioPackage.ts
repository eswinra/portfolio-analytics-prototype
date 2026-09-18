import Papa from 'papaparse';

import {
  CIO_LATEST,
  longDate,
  STATUS,
  type CioComposite,
  type CioEntity,
  type CioMarketGroup,
  type CioVintage,
  type OpsStatus,
} from '../fixtures/cioMonthly';
import type { MacroLine } from './cioMacro';
import { CIO_PERIOD_TOKENS } from './contract/schema';
import { histBinOf } from './dataset/cioFeed';

/**
 * The CIO Monthly template file: a whole report (both funds, market table, geography, macro
 * strip and items for attention) as the CSV the Excel template's Export tab writes, so the slides
 * can be built before — or without — the published PDF. Read in the browser only; nothing is
 * uploaded or kept. The file is checked in full before anything is shown: every problem is
 * listed, and a file with any problem shows nothing (no partial report).
 *
 * Columns: section, entity, item, measure, period, value, text (docs/cio-template.md). Percent
 * figures are in percent as printed (0.1 = 0.1%); money is in $ millions.
 */

export const PACKAGE_COLUMNS = [
  'section',
  'entity',
  'item',
  'measure',
  'period',
  'value',
  'text',
] as const;
export const PACKAGE_FORMAT = 'cio-template-1';

export interface CioOpsItem {
  e: string;
  item: string;
  st: OpsStatus;
  p: number;
}

export interface CioPackage {
  fileName: string;
  /** the report as a vintage (origin 'file'), rendered by the same panels and slides */
  vintage: CioVintage;
  macro: MacroLine[];
  ops: CioOpsItem[];
  rowCount: number;
}

export type PackageResult = { ok: true; pkg: CioPackage } | { ok: false; errors: string[] };

type Fund = 'pension' | 'opeb';
const FUNDS: Fund[] = ['pension', 'opeb'];
const FUND_NAME: Record<Fund, string> = { pension: 'Pension Fund', opeb: 'OPEB Trust' };
const CATEGORIES = ['GROWTH', 'CREDIT', 'RAIH', 'RRM'] as const;
const CATEGORY_KEY: Record<(typeof CATEGORIES)[number], CioComposite['k']> = {
  GROWTH: 'growth',
  CREDIT: 'credit',
  RAIH: 'ra',
  RRM: 'rrm',
};
const PERIODS: readonly string[] = CIO_PERIOD_TOKENS;
const STAT_KEYS = ['mean', 'saa', 'sd', 'min', 'max', 'latest'] as const;
const STATUS_BY_LABEL: Record<string, OpsStatus> = Object.fromEntries(
  (Object.keys(STATUS) as OpsStatus[]).flatMap((k) => [
    [k, k],
    [STATUS[k][0].toLowerCase(), k],
  ]),
);

interface Row {
  n: number;
  section: string;
  entity: string;
  item: string;
  measure: string;
  period: string;
  value: number | null;
  text: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;
const isMonthEnd = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const next = new Date(d.getTime() + 86_400_000);
  return !Number.isNaN(d.getTime()) && next.getUTCDate() === 1;
};

/** Reads and checks a template file. `fileName` is only used for labels. */
export function readCioPackage(text: string, fileName: string): PackageResult {
  // a byte-order mark from Excel's "CSV UTF-8" is dropped; U+FFFD means characters were lost
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (clean.includes(String.fromCharCode(0xfffd))) {
    return fail([
      'Some characters were lost when the file was saved. In Excel, save the Export tab as "CSV UTF-8 (Comma delimited)".',
    ]);
  }
  const parsed = Papa.parse<string[]>(clean, { skipEmptyLines: 'greedy' });
  const [header, ...body] = parsed.data;
  const head = (header ?? []).map((h) => h.trim().toLowerCase());
  if (head.slice(0, PACKAGE_COLUMNS.length).join(',') !== PACKAGE_COLUMNS.join(',')) {
    return fail([
      `This is not a CIO template export: the first row should be ${PACKAGE_COLUMNS.join(', ')}. In Excel, save the template's Export tab (not another tab) as CSV.`,
    ]);
  }

  const errors: string[] = [];
  const rows: Row[] = [];
  body.forEach((cells, i) => {
    const n = i + 2;
    const cell = (k: number) => (cells[k] ?? '').trim();
    const rawValue = cell(5);
    const textCell = cell(6);
    if (!cell(0)) return;
    // an empty slot in the template: no value and no text
    if (rawValue === '' && textCell === '') return;
    let value: number | null = null;
    if (rawValue !== '') {
      if (rawValue.includes('%')) {
        errors.push(
          `Row ${n}: "${rawValue}" — values must be plain numbers (0.1 for 0.1%). Keep the Export tab's cells unformatted.`,
        );
        return;
      }
      const v = Number(rawValue.replace(/,/g, ''));
      if (!Number.isFinite(v)) {
        errors.push(`Row ${n}: "${rawValue}" is not a number.`);
        return;
      }
      value = v;
    }
    rows.push({
      n,
      section: cell(0).toLowerCase(),
      entity: cell(1).toLowerCase(),
      item: cell(2),
      measure: cell(3).toLowerCase(),
      period: cell(4).toUpperCase(),
      value,
      text: textCell,
    });
  });

  const seen = new Set<string>();
  const once = (r: Row, key: string) => {
    if (seen.has(key)) {
      errors.push(`Row ${r.n}: the same figure appears twice (${key.replace(/\|+/g, ' ')}).`);
      return false;
    }
    seen.add(key);
    return true;
  };
  const needValue = (r: Row) => {
    if (r.value === null)
      errors.push(`Row ${r.n}: ${r.section} ${r.item} ${r.measure} has no value.`);
    return r.value !== null;
  };
  const needFund = (r: Row): Fund | null => {
    if (r.entity === 'pension' || r.entity === 'opeb') return r.entity;
    errors.push(`Row ${r.n}: entity must be pension or opeb, not "${r.entity}".`);
    return null;
  };

  // --- collect, section by section ---
  const report: Record<string, string> = {};
  const fund = { pension: {} as Record<string, number>, opeb: {} as Record<string, number> };
  const perf = { pension: new Map<string, number>(), opeb: new Map<string, number>() };
  const alloc = { pension: new Map<string, number>(), opeb: new Map<string, number>() };
  const otherLabel: Partial<Record<Fund, string>> = {};
  type Overlay = { may?: number; si?: number };
  const overlays = { pension: new Map<string, Overlay>(), opeb: new Map<string, Overlay>() };
  const bins = { pension: new Map<number, number>(), opeb: new Map<number, number>() };
  const stats = { pension: new Map<string, number>(), opeb: new Map<string, number>() };
  const geo = { pension: new Map<string, number>(), opeb: new Map<string, number>() };
  const countries: Record<Fund, [string, number, 'dm' | 'em'][]> = { pension: [], opeb: [] };
  const market = new Map<string, { g?: string; i?: string; v: (number | null)[] }>();
  const macro = new Map<string, { v?: string; s?: string }>();
  const ops: CioOpsItem[] = [];

  for (const r of rows) {
    switch (r.section) {
      case 'report': {
        const known = ['format', 'report_date', 'data_through', 'market_as_of'];
        const it = r.item.toLowerCase();
        if (!known.includes(it)) {
          errors.push(`Row ${r.n}: report item "${r.item}" is not one of ${known.join(', ')}.`);
        } else if (once(r, `report|${it}`)) report[it] = r.text;
        break;
      }
      case 'fund': {
        const f = needFund(r);
        const known = ['market_value', 'cash', 'growth_of_dollar'];
        if (!f) break;
        if (r.item.toUpperCase() !== 'TOTAL' || !known.includes(r.measure)) {
          errors.push(`Row ${r.n}: fund rows are TOTAL with ${known.join(', ')}.`);
        } else if (needValue(r) && once(r, `fund|${f}|${r.measure}`)) fund[f][r.measure] = r.value!;
        break;
      }
      case 'performance': {
        const f = needFund(r);
        if (!f) break;
        const cat = r.item.toUpperCase();
        if (cat !== 'TOTAL' && !(CATEGORIES as readonly string[]).includes(cat)) {
          errors.push(
            `Row ${r.n}: "${r.item}" is not TOTAL or a category (${CATEGORIES.join(', ')}).`,
          );
        } else if (!['return', 'benchmark', 'hurdle'].includes(r.measure)) {
          errors.push(`Row ${r.n}: measure must be return, benchmark or hurdle.`);
        } else if (r.measure === 'hurdle' && cat !== 'TOTAL') {
          errors.push(`Row ${r.n}: the actuarial hurdle applies to TOTAL only.`);
        } else if (!PERIODS.includes(r.period)) {
          errors.push(`Row ${r.n}: period "${r.period}" is not one of ${PERIODS.join(', ')}.`);
        } else if (needValue(r) && once(r, `perf|${f}|${cat}|${r.measure}|${r.period}`)) {
          perf[f].set(`${cat}|${r.measure}|${r.period}`, r.value!);
        }
        break;
      }
      case 'allocation': {
        const f = needFund(r);
        if (!f) break;
        const cat = r.item.toUpperCase();
        const isCat = (CATEGORIES as readonly string[]).includes(cat);
        if (!isCat && cat !== 'OTHER') {
          errors.push(`Row ${r.n}: "${r.item}" is not a category or OTHER.`);
        } else if (cat === 'OTHER' && r.measure === 'label') {
          if (once(r, `alloc|${f}|OTHER|label`)) otherLabel[f] = r.text;
        } else if (!['market_value', 'weight', 'target', 'flow'].includes(r.measure)) {
          errors.push(`Row ${r.n}: measure must be market_value, weight, target or flow.`);
        } else if (cat === 'OTHER' && r.measure === 'target') {
          errors.push(`Row ${r.n}: OTHER has no policy target.`);
        } else if (needValue(r) && once(r, `alloc|${f}|${cat}|${r.measure}`)) {
          alloc[f].set(`${cat}|${r.measure}`, r.value!);
        }
        break;
      }
      case 'overlay': {
        const f = needFund(r);
        if (!f) break;
        if (!r.item) errors.push(`Row ${r.n}: an overlay row needs the program name in item.`);
        else if (!['month_gain', 'since_inception'].includes(r.measure)) {
          errors.push(`Row ${r.n}: overlay measure must be month_gain or since_inception.`);
        } else if (needValue(r) && once(r, `overlay|${f}|${r.item}|${r.measure}`)) {
          const o = overlays[f].get(r.item) ?? {};
          if (r.measure === 'month_gain') o.may = r.value!;
          else o.si = r.value!;
          overlays[f].set(r.item, o);
        }
        break;
      }
      case 'histogram': {
        const f = needFund(r);
        if (!f) break;
        const bin = /^BIN_(\d{2})$/.exec(r.item.toUpperCase());
        if (bin && r.measure === 'count' && Number(bin[1]) <= 13) {
          if (needValue(r) && once(r, `hist|${f}|${r.item}`)) bins[f].set(Number(bin[1]), r.value!);
        } else if (
          r.item.toUpperCase() === 'STAT' &&
          (STAT_KEYS as readonly string[]).includes(r.measure)
        ) {
          if (needValue(r) && once(r, `hist|${f}|stat|${r.measure}`))
            stats[f].set(r.measure, r.value!);
        } else {
          errors.push(
            `Row ${r.n}: histogram rows are BIN_00 … BIN_13 with count, or STAT with ${STAT_KEYS.join(', ')}.`,
          );
        }
        break;
      }
      case 'geography': {
        const f = needFund(r);
        if (!f) break;
        const it = r.item.toUpperCase();
        const ok =
          ((it === 'DM' || it === 'EM') && (r.measure === 'share' || r.measure === 'markets')) ||
          (it === 'TOTAL' && r.measure === 'markets');
        if (!ok)
          errors.push(`Row ${r.n}: geography rows are DM/EM share or markets, or TOTAL markets.`);
        else if (needValue(r) && once(r, `geo|${f}|${it}|${r.measure}`)) {
          geo[f].set(`${it}|${r.measure}`, r.value!);
        }
        break;
      }
      case 'country': {
        const f = needFund(r);
        if (!f) break;
        const group = r.text.toLowerCase();
        if (!r.item || r.measure !== 'share' || (group !== 'dm' && group !== 'em')) {
          errors.push(
            `Row ${r.n}: country rows need the country in item, share, and dm or em in text.`,
          );
        } else if (needValue(r) && once(r, `country|${f}|${r.item}`)) {
          countries[f].push([r.item, r.value!, group]);
        }
        break;
      }
      case 'market': {
        if (!r.item) {
          errors.push(`Row ${r.n}: a market row needs the index name in item.`);
          break;
        }
        const m = market.get(r.item) ?? { v: PERIODS.map(() => null) };
        if (r.measure === 'group' || r.measure === 'description') {
          if (once(r, `market|${r.item}|${r.measure}`)) {
            if (r.measure === 'group') m.g = r.text;
            else m.i = r.text;
          }
        } else if (r.measure === 'return' && PERIODS.includes(r.period)) {
          if (needValue(r) && once(r, `market|${r.item}|${r.period}`)) {
            m.v[PERIODS.indexOf(r.period)] = r.value;
          }
        } else {
          errors.push(`Row ${r.n}: market rows are group, description, or return with a period.`);
        }
        market.set(r.item, m);
        break;
      }
      case 'macro': {
        if (!r.item || (r.measure !== 'value' && r.measure !== 'detail')) {
          errors.push(`Row ${r.n}: macro rows need the label in item and measure value or detail.`);
        } else if (once(r, `macro|${r.item}|${r.measure}`)) {
          const m = macro.get(r.item) ?? {};
          if (r.measure === 'value') m.v = r.text;
          else m.s = r.text;
          macro.set(r.item, m);
        }
        break;
      }
      case 'attention': {
        const st = STATUS_BY_LABEL[r.measure];
        if (!r.item || !r.text) {
          errors.push(
            `Row ${r.n}: an item for attention needs its area in item and the item in text.`,
          );
        } else if (!st) {
          errors.push(
            `Row ${r.n}: status "${r.measure}" is not one of ${(Object.keys(STATUS) as OpsStatus[]).map((k) => STATUS[k][0]).join(', ')}.`,
          );
        } else {
          ops.push({ e: r.item, item: r.text, st, p: r.value ?? 0 });
        }
        break;
      }
      default:
        errors.push(`Row ${r.n}: section "${r.section}" is not recognized.`);
    }
  }

  // --- the report's dates ---
  if (report.format !== PACKAGE_FORMAT) {
    errors.push(
      `The file's format is "${report.format ?? 'missing'}", expected ${PACKAGE_FORMAT}. Use the current template.`,
    );
  }
  const reportDate = report.report_date ?? '';
  const through = report.data_through ?? '';
  const marketAsOf = report.market_as_of ?? '';
  if (!ISO_DAY.test(reportDate) && !ISO_MONTH.test(reportDate)) {
    errors.push(`The report date must be YYYY-MM-DD (found "${reportDate}").`);
  }
  if (!ISO_DAY.test(through) || !isMonthEnd(through)) {
    errors.push(`"Data through" must be a month-end date, YYYY-MM-DD (found "${through}").`);
  } else if (reportDate && reportDate.slice(0, 7) < through.slice(0, 7)) {
    errors.push('The report date is earlier than the date its data runs through.');
  }
  if (marketAsOf && (!ISO_DAY.test(marketAsOf) || marketAsOf < through)) {
    errors.push(`The market table's as-of date must be YYYY-MM-DD, on or after "data through".`);
  }
  if (market.size && !marketAsOf)
    errors.push('The market table needs its as-of date (market_as_of).');

  // --- each fund: required figures and the report's own identities ---
  const ENT = {} as Record<Fund, CioEntity>;
  for (const f of FUNDS) {
    const name = FUND_NAME[f];
    const p = perf[f];
    const a = alloc[f];
    const mv = fund[f].market_value;
    const cash = fund[f].cash;
    if (mv === undefined) errors.push(`${name}: the total market value is missing.`);
    if (cash === undefined) errors.push(`${name}: cash and equivalents are missing.`);
    for (const period of ['1M', 'FYTD', '1Y']) {
      for (const m of ['return', 'benchmark']) {
        if (!p.has(`TOTAL|${m}|${period}`))
          errors.push(`${name}: the Total Fund ${m} for ${period} is missing.`);
      }
    }
    for (const cat of ['TOTAL', ...CATEGORIES]) {
      for (const period of PERIODS) {
        const hasR = p.has(`${cat}|return|${period}`);
        const hasB = p.has(`${cat}|benchmark|${period}`);
        if (hasR !== hasB) {
          errors.push(
            `${name}: ${cat} ${period} has a ${hasR ? 'return but no benchmark' : 'benchmark but no return'}.`,
          );
        }
      }
    }
    for (const cat of CATEGORIES) {
      for (const m of ['market_value', 'weight', 'target']) {
        if (!a.has(`${cat}|${m}`))
          errors.push(`${name}: ${cat} ${m.replace('_', ' ')} is missing.`);
      }
    }
    const wSum = [...CATEGORIES, 'OTHER'].reduce((s, c) => s + (a.get(`${c}|weight`) ?? 0), 0);
    if (Math.abs(wSum - 100) > 0.3 + 1e-9) {
      errors.push(`${name}: the weights add to ${wSum.toFixed(1)}%, not 100% (allowed ±0.3).`);
    }
    const mvSum = [...CATEGORIES, 'OTHER'].reduce(
      (s, c) => s + (a.get(`${c}|market_value`) ?? 0),
      0,
    );
    if (mv !== undefined && Math.abs(mvSum - mv) > Math.max(2, mv * 0.003)) {
      errors.push(
        `${name}: the category market values add to $${Math.round(mvSum).toLocaleString('en-US')} mm, not the total $${Math.round(mv).toLocaleString('en-US')} mm.`,
      );
    }
    const counts = Array.from({ length: 14 }, (_, i) => bins[f].get(i));
    if (counts.some((c) => c === undefined)) {
      errors.push(`${name}: the return distribution needs all 14 bin counts (BIN_00 … BIN_13).`);
    } else {
      const months = counts.reduce<number>((s, c) => s + (c ?? 0), 0);
      if (months !== 120)
        errors.push(`${name}: the 14 bin counts add to ${months}, not 120 months.`);
    }
    for (const k of STAT_KEYS) {
      if (!stats[f].has(k)) errors.push(`${name}: the distribution statistic "${k}" is missing.`);
    }
    const g = geo[f];
    const cs = countries[f];
    if (g.size || cs.length) {
      const dm = g.get('DM|share');
      const em = g.get('EM|share');
      if (dm === undefined || em === undefined)
        errors.push(`${name}: geography needs both DM and EM shares.`);
      else if (Math.abs(dm + em - 100) > 0.2 + 1e-9) {
        errors.push(`${name}: DM and EM shares add to ${(dm + em).toFixed(1)}%, not 100%.`);
      }
      for (const grp of ['dm', 'em'] as const) {
        if (cs.filter((c) => c[2] === grp).length > 5)
          errors.push(`${name}: at most five ${grp.toUpperCase()} countries.`);
      }
    }

    const series = (cat: string, m: string) =>
      PERIODS.map((period) => p.get(`${cat}|${m}|${period}`) ?? null);
    const latestComps = CIO_LATEST.ENT[f].comps;
    const comps: CioComposite[] = CATEGORIES.map((cat) => {
      const k = CATEGORY_KEY[cat];
      const ref = latestComps.find((c) => c.k === k);
      return {
        k,
        n: ref?.n ?? cat,
        short: ref?.short ?? cat,
        mv: a.get(`${cat}|market_value`) ?? 0,
        pct: a.get(`${cat}|weight`) ?? 0,
        tgt: a.get(`${cat}|target`) ?? 0,
        flow: a.get(`${cat}|flow`) ?? 0,
        r: series(cat, 'return'),
        b: series(cat, 'benchmark'),
      };
    });
    const otherMv = a.get('OTHER|market_value');
    const other =
      otherMv === undefined
        ? null
        : {
            n: otherLabel[f] || CIO_LATEST.ENT[f].other?.n || 'Other',
            mv: otherMv,
            pct: a.get('OTHER|weight') ?? 0,
            flow: a.get('OTHER|flow') ?? 0,
          };
    const ov = [...overlays[f].entries()].map(([n, o]) => ({ n, may: o.may ?? 0, si: o.si ?? 0 }));
    const latestPct = stats[f].get('latest') ?? p.get('TOTAL|return|1M') ?? 0;
    const dmN = geo[f].get('DM|markets') ?? 0;
    const emN = geo[f].get('EM|markets') ?? 0;
    ENT[f] = {
      name: CIO_LATEST.ENT[f].name,
      short: CIO_LATEST.ENT[f].short,
      aum: Math.round((mv ?? 0) / 100) / 10,
      mv: mv ?? 0,
      cash: cash ?? 0,
      god: fund[f].growth_of_dollar ?? null,
      pages: 'template file',
      total: {
        r: series('TOTAL', 'return'),
        b: series('TOTAL', 'benchmark'),
        h: series('TOTAL', 'hurdle'),
      },
      comps,
      other,
      netflow: comps.reduce((s, c) => s + c.flow, 0) + (other?.flow ?? 0),
      overlays: ov.length ? ov : null,
      hist: {
        c: counts.map((c) => c ?? 0),
        mean: stats[f].get('mean') ?? 0,
        saa: stats[f].get('saa') ?? 0,
        sd: stats[f].get('sd') ?? 0,
        min: stats[f].get('min') ?? 0,
        max: stats[f].get('max') ?? 0,
        latest: latestPct,
        latestBin: histBinOf(latestPct),
      },
      geo: {
        dm: geo[f].get('DM|share') ?? 0,
        em: geo[f].get('EM|share') ?? 0,
        dmN,
        emN,
        total: geo[f].get('TOTAL|markets') ?? dmN + emN,
        page: 0,
        // the report lists its top countries by share, largest first, across both groups
        top: [...cs].sort((x, y) => y[1] - x[1]),
      },
    };
  }

  // --- market table, macro strip ---
  const groups: CioMarketGroup[] = [];
  for (const [n, m] of market) {
    if (!m.g) {
      errors.push(`Market index "${n}" needs its group (for example Global equity).`);
      continue;
    }
    let grp = groups.find((x) => x.g === m.g);
    if (!grp) groups.push((grp = { g: m.g, rows: [] }));
    grp.rows.push({ n, i: m.i ?? '', v: m.v });
  }
  const macroLines: MacroLine[] = [];
  for (const [l, m] of macro) {
    if (!m.v) errors.push(`Macro line "${l}" needs its value.`);
    else macroLines.push({ l, v: m.v, s: m.s ?? '' });
  }

  if (errors.length) return fail(errors);
  const vintage: CioVintage = {
    reportDate,
    reportLabel: longDate(reportDate),
    dataThrough: through,
    marketAsOf: marketAsOf || null,
    file: fileName,
    url: null,
    pages: { market: null, flows: 0, pension: [0, 0, 0, 0], opeb: [0, 0, 0, 0] },
    ENT: { pension: ENT.pension, opeb: ENT.opeb },
    MKT: groups.length ? groups : null,
    origin: 'file',
  };
  return { ok: true, pkg: { fileName, vintage, macro: macroLines, ops, rowCount: rows.length } };
}

function fail(errors: string[]): PackageResult {
  return { ok: false, errors };
}
