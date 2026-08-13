import Papa from 'papaparse';

import {
  COLUMNS_V12,
  type ContractRecord,
  PROVENANCE_COLUMNS,
  type RawRecord,
  rawRecordSchema,
  REQUIRED_COLUMNS,
  SCHEMA_MAJOR,
} from './schema';

/** Import validator — implements docs/import-validation-rules.md (V01–V21). */

export interface ImportError {
  ruleId: string;
  severity: 'reject' | 'warn';
  row: number; // 1-based data row (0 = file-level)
  column: string;
  message: string;
  value?: string;
}

export interface ImportResult {
  ok: boolean;
  records: ContractRecord[];
  errors: ImportError[];
  warnings: ImportError[];
}

const MAX_BYTES = 5 * 1024 * 1024; // V18
const MAX_ROWS = 20000; // V18
const PCT_BOUND = 0.6; // V10

const NUMERIC_RECORD_TYPES = new Set([
  'monthly_return',
  'monthly_benchmark_return',
  'period_return',
  'allocation',
  'contribution_qtd',
  'market_close',
  'public_reference',
  'policy_target',
  'benchmark_definition',
]);

/** Record types allowed to carry the reported_public classification (quotations). */
const QUOTE_RECORD_TYPES = new Set(['public_reference', 'policy_target', 'benchmark_definition']);

const PERIOD_SPAN_REQUIRED = new Set([
  'monthly_return',
  'monthly_benchmark_return',
  'period_return',
  'contribution_qtd',
]);

/** Record types subject to the V10 percent-plausibility bound. */
const PCT_BOUND_TYPES = PERIOD_SPAN_REQUIRED;

function err(
  ruleId: string,
  row: number,
  column: string,
  message: string,
  value?: string,
): ImportError {
  return value === undefined
    ? { ruleId, severity: 'reject', row, column, message }
    : { ruleId, severity: 'reject', row, column, message, value };
}

function warn(ruleId: string, row: number, column: string, message: string): ImportError {
  return { ruleId, severity: 'warn', row, column, message };
}

export function parseContractCsv(text: string, fixtureEntityId?: string): ImportResult {
  const errors: ImportError[] = [];
  const warnings: ImportError[] = [];

  if (new Blob([text]).size > MAX_BYTES) {
    return failed([err('V18', 0, '-', 'file exceeds 5 MB limit')]);
  }

  const parsed = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    return failed([
      err('V01', (first?.row ?? 0) + 1, '-', `CSV parse error: ${first?.message ?? 'unknown'}`),
    ]);
  }
  const rows = parsed.data;
  if (rows.length === 0) return failed([err('V01', 0, '-', 'file has no data rows')]);
  if (rows.length > MAX_ROWS) return failed([err('V18', 0, '-', 'file exceeds 20,000 rows')]);

  // V02 columns — version-gated sets: the 29 base columns (schema 1.0/1.1) or the 32-column
  // set including provenance (schema 1.2). A partial provenance header is a rejection: three
  // columns or none, never a guess.
  const cols = parsed.meta.fields ?? [];
  const provPresent = PROVENANCE_COLUMNS.filter((c) => cols.includes(c));
  const isV12File = provPresent.length === PROVENANCE_COLUMNS.length;
  if (provPresent.length > 0 && !isV12File) {
    for (const c of PROVENANCE_COLUMNS)
      if (!cols.includes(c))
        errors.push(err('V02', 0, c, `partial schema-1.2 provenance column set: ${c} missing`));
  }
  const expectedCols = isV12File ? COLUMNS_V12 : REQUIRED_COLUMNS;
  const missingCols = expectedCols.filter((c) => !cols.includes(c));
  for (const c of missingCols) errors.push(err('V02', 0, c, `required column missing: ${c}`));
  for (const c of cols)
    if (!(COLUMNS_V12 as readonly string[]).includes(c))
      warnings.push(warn('V02', 0, c, `unknown column ignored: ${c}`));
  if (errors.length > 0) return failed(errors, warnings);

  const records: ContractRecord[] = [];
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();

  rows.forEach((row, i) => {
    const rowNo = i + 1;
    const res = rawRecordSchema.safeParse(row);
    if (!res.success) {
      for (const issue of res.error.issues) {
        const col = String(issue.path[0] ?? '-');
        const ruleId = col === 'schema_version' ? 'V03' : col === 'review_status' ? 'V21' : 'V06';
        errors.push(err(ruleId, rowNo, col, issue.message, row[col]));
      }
      return;
    }
    const raw: RawRecord = res.data;

    // V03 schema version major
    const major = Number(raw.schema_version.split('.')[0]);
    if (major !== SCHEMA_MAJOR) {
      errors.push(
        err(
          'V03',
          rowNo,
          'schema_version',
          `unsupported schema major version (file ${raw.schema_version}, app ${SCHEMA_MAJOR}.x)`,
          raw.schema_version,
        ),
      );
      return;
    }

    // V02 (row half): declared version must match the header's column set
    const minor = Number(raw.schema_version.split('.')[1] ?? 0);
    if (isV12File && minor < 2) {
      errors.push(
        err(
          'V02',
          rowNo,
          'schema_version',
          `provenance columns present but row declares ${raw.schema_version}; 1.2 columns require schema_version 1.2+`,
          raw.schema_version,
        ),
      );
      return;
    }
    if (!isV12File && minor >= 2) {
      errors.push(
        err(
          'V02',
          rowNo,
          'schema_version',
          `schema_version ${raw.schema_version} declared but provenance columns are absent`,
          raw.schema_version,
        ),
      );
      return;
    }

    // V19 accountability: 1.2 user-import rows must say who entered them
    if (isV12File && raw.source_type === 'user_import' && !(raw.entered_by ?? '').trim()) {
      errors.push(
        err('V19', rowNo, 'entered_by', 'entered_by required on user_import rows (schema 1.2)'),
      );
      return;
    }

    // V20 review integrity: a reviewed/published row must name its reviewer
    const reviewStatus = raw.review_status ?? '';
    if (
      (reviewStatus === 'reviewed' || reviewStatus === 'published') &&
      !(raw.reviewed_by ?? '').trim()
    ) {
      errors.push(
        err('V20', rowNo, 'reviewed_by', `reviewed_by required when review_status=${reviewStatus}`),
      );
      return;
    }

    // V04 unique record_id
    if (seenIds.has(raw.record_id)) {
      errors.push(err('V04', rowNo, 'record_id', `duplicate record_id ${raw.record_id}`));
      return;
    }
    seenIds.add(raw.record_id);

    // V05 natural key
    const key = [
      raw.record_type,
      raw.entity_id,
      raw.metric_id,
      raw.category_id,
      raw.as_of_date,
      raw.period_start,
      raw.period_end,
    ].join('|');
    if (seenKeys.has(key)) {
      errors.push(
        err(
          'V05',
          rowNo,
          '-',
          `duplicate natural key (${raw.record_type}/${raw.metric_id}/${raw.category_id})`,
        ),
      );
      return;
    }
    seenKeys.add(key);

    // V07/V08 value handling
    let value: number | string | null;
    const rawValue = raw.value.trim();
    if (raw.record_type === 'check_result') {
      value = rawValue;
      if (!['PASS', 'WARN', 'FAIL'].includes(rawValue)) {
        errors.push(err('V06', rowNo, 'value', `check status must be PASS/WARN/FAIL`, rawValue));
        return;
      }
    } else if (rawValue === '') {
      if (raw.quality_status !== 'missing') {
        errors.push(err('V08', rowNo, 'value', 'blank value requires quality_status=missing'));
        return;
      }
      value = null;
    } else if (raw.quality_status === 'missing') {
      // A missing flag always wins: the value is discarded so it can never render numerically.
      warnings.push(warn('V08', rowNo, 'value', 'value present but flagged missing — discarded'));
      value = null;
    } else {
      const n = Number(rawValue);
      if (!Number.isFinite(n) && NUMERIC_RECORD_TYPES.has(raw.record_type)) {
        errors.push(err('V07', rowNo, 'value', 'value is not a finite number', rawValue));
        return;
      }
      value = n;
      // V10 percent plausibility — return/contribution records only. Allocation weights and
      // other % levels may legitimately exceed the bound (e.g. a 61% Growth weight).
      if (raw.unit === '%' && PCT_BOUND_TYPES.has(raw.record_type) && Math.abs(n) > PCT_BOUND) {
        errors.push(
          err(
            'V10',
            rowNo,
            'value',
            `percent value ${rawValue} out of bounds (decimals expected: 0.0417 = 4.17%)`,
            rawValue,
          ),
        );
        return;
      }
    }

    // V09 period coherence: ordering is global; presence of start/end is required only
    // for return/contribution records (balance, market and check records may carry a
    // descriptive period_type without a span — see docs/data-contract.md).
    if (raw.period_start && raw.period_end && raw.period_start > raw.period_end) {
      errors.push(err('V09', rowNo, 'period_start', 'period_start after period_end'));
      return;
    }
    if (PERIOD_SPAN_REQUIRED.has(raw.record_type) && (!raw.period_start || !raw.period_end)) {
      errors.push(
        err('V09', rowNo, 'period_type', 'return/contribution record missing period start/end'),
      );
      return;
    }

    // V11 retrieved date sanity
    if (raw.record_type === 'public_reference' && raw.retrieved_date < raw.as_of_date) {
      warnings.push(warn('V11', rowNo, 'retrieved_date', 'retrieved before as-of date'));
    }

    // V15 reported_public confinement (quotation record types only)
    if (raw.classification === 'reported_public' && !QUOTE_RECORD_TYPES.has(raw.record_type)) {
      errors.push(
        err(
          'V15',
          rowNo,
          'classification',
          'reported_public allowed only on public_reference / policy_target / benchmark_definition',
        ),
      );
      return;
    }

    records.push({
      ...raw,
      value,
      entered_by: raw.entered_by ?? '',
      reviewed_by: raw.reviewed_by ?? '',
      review_status: raw.review_status ?? '',
    });
  });

  if (errors.length > 0) return failed(errors, warnings);

  // ---- dataset-level rules ----
  // V13 allocation weights sum to 1 per (entity, as_of)
  const weightSums = new Map<string, number>();
  for (const r of records) {
    if (
      r.record_type === 'allocation' &&
      r.metric_id === 'weight_actual' &&
      typeof r.value === 'number'
    ) {
      const k = `${r.entity_id}|${r.as_of_date}`;
      weightSums.set(k, (weightSums.get(k) ?? 0) + r.value);
    }
  }
  for (const [k, s] of weightSums) {
    if (Math.abs(s - 1) > 1e-4) {
      errors.push(
        err('V13', 0, 'value', `allocation weights for ${k} sum to ${s.toFixed(6)}, not 1`),
      );
    }
  }

  // V14 contribution coherence
  const contrib = records.filter((r) => r.record_type === 'contribution_qtd');
  if (contrib.length > 0) {
    const cats = contrib.filter((r) => r.metric_id === 'contribution');
    const chain = contrib.find((r) => r.metric_id === 'return_chain_linked');
    const residual = contrib.find((r) => r.metric_id === 'residual');
    if (
      chain &&
      residual &&
      typeof chain.value === 'number' &&
      typeof residual.value === 'number'
    ) {
      const sum = cats.reduce((a, r) => a + (typeof r.value === 'number' ? r.value : 0), 0);
      if (Math.abs(sum + residual.value - chain.value) > 1e-4) {
        errors.push(
          err(
            'V14',
            0,
            'value',
            'contribution categories + residual do not reconcile to chain-linked return',
          ),
        );
      }
    }
  }

  // V16 single as_of for allocation records per entity
  const allocAsOf = new Set(
    records
      .filter((r) => r.record_type === 'allocation')
      .map((r) => `${r.entity_id}|${r.as_of_date}`),
  );
  const entities = new Set(
    records.filter((r) => r.record_type === 'allocation').map((r) => r.entity_id),
  );
  if (allocAsOf.size > entities.size) {
    errors.push(err('V16', 0, 'as_of_date', 'allocation records mix multiple as-of dates'));
  }

  // V12 monthly contiguity (warn)
  const monthly = new Map<string, string[]>();
  for (const r of records) {
    if (r.record_type === 'monthly_return' && r.period_end) {
      const k = `${r.entity_id}|${r.category_id}`;
      const arr = monthly.get(k) ?? [];
      arr.push(r.period_end);
      monthly.set(k, arr);
    }
  }
  for (const [k, ends] of monthly) {
    const sorted = [...ends].sort();
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1] as string);
      const cur = new Date(sorted[i] as string);
      const gapDays = (cur.getTime() - prev.getTime()) / 86400000;
      if (gapDays > 45) {
        warnings.push(
          warn('V12', 0, 'period_end', `gap in monthly series ${k} before ${sorted[i]}`),
        );
      }
    }
  }

  // V17 entity discipline (public_reference rows cite real entities by design and are exempt):
  // a file must describe exactly ONE portfolio entity. Multi-entity files are rejected until a
  // genuine fund selector exists — silently blending funds is worse than refusing the file.
  const portfolioEntities = [
    ...new Set(records.filter((r) => r.record_type !== 'public_reference').map((r) => r.entity_id)),
  ];
  if (portfolioEntities.length > 1) {
    errors.push(
      err(
        'V17',
        0,
        'entity_id',
        `file contains ${portfolioEntities.length} portfolio entities (${portfolioEntities.join(', ')}); one entity per file`,
      ),
    );
  } else if (fixtureEntityId && portfolioEntities[0] && portfolioEntities[0] !== fixtureEntityId) {
    warnings.push(
      warn(
        'V17',
        0,
        'entity_id',
        `user-supplied entity "${portfolioEntities[0]}": all labels derive from the file`,
      ),
    );
  }

  if (errors.length > 0) return failed(errors, warnings);
  return { ok: true, records, errors: [], warnings };
}

function failed(errors: ImportError[], warnings: ImportError[] = []): ImportResult {
  return { ok: false, records: [], errors, warnings };
}
