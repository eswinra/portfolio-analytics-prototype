import { describe, expect, it } from 'vitest';

import { COLUMN_DOCS, DICTIONARY_COLUMNS } from './dictionary';
import {
  BOOKS,
  CLASSIFICATIONS,
  COLUMNS_V12,
  FREQUENCIES,
  GROSS_NET,
  PERIOD_TYPES,
  QUALITY_STATUSES,
  RECORD_TYPES,
  RETURN_METHODS,
  REVIEW_STATUSES,
  SOURCE_TYPES,
} from './schema';

/** The dictionary must cover the contract exactly — no drift from the validator source. */

describe('data dictionary', () => {
  it('documents every contract column with a non-empty description', () => {
    expect(DICTIONARY_COLUMNS).toEqual(COLUMNS_V12);
    for (const col of COLUMNS_V12) {
      expect(COLUMN_DOCS[col], col).toBeDefined();
      expect(COLUMN_DOCS[col].desc.length, col).toBeGreaterThan(10);
    }
  });

  it('enum columns list exactly the schema tokens', () => {
    expect(COLUMN_DOCS.record_type.enumTokens).toEqual(RECORD_TYPES);
    expect(COLUMN_DOCS.classification.enumTokens).toEqual(CLASSIFICATIONS);
    expect(COLUMN_DOCS.period_type.enumTokens).toEqual(PERIOD_TYPES);
    expect(COLUMN_DOCS.frequency.enumTokens).toEqual(FREQUENCIES);
    expect(COLUMN_DOCS.quality_status.enumTokens).toEqual(QUALITY_STATUSES);
    expect(COLUMN_DOCS.book_of_record.enumTokens).toEqual(BOOKS);
    expect(COLUMN_DOCS.return_method.enumTokens).toEqual(RETURN_METHODS);
    expect(COLUMN_DOCS.gross_net.enumTokens).toEqual(GROSS_NET);
    expect(COLUMN_DOCS.source_type.enumTokens).toEqual(SOURCE_TYPES);
    expect(COLUMN_DOCS.review_status.enumTokens).toEqual(REVIEW_STATUSES);
  });

  it('non-enum columns do not claim token lists', () => {
    const enumCols = new Set(COLUMNS_V12.filter((c) => COLUMN_DOCS[c].enumTokens !== undefined));
    expect(enumCols).toEqual(
      new Set([
        'record_type',
        'classification',
        'period_type',
        'frequency',
        'quality_status',
        'book_of_record',
        'return_method',
        'gross_net',
        'source_type',
        'review_status',
      ]),
    );
  });
});
