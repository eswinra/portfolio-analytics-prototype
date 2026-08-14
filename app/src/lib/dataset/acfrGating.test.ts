import { describe, expect, it } from 'vitest';

import { sectionEligibility } from './acfr';

/** Completion must be impossible until every prerequisite clears (audit finding 2). */

const CLEAN = {
  itemsTotal: 6,
  itemsComplete: 6,
  itemsBlocked: 0,
  artifactsIn: 2,
  artifactsExpected: 2,
  reviewerOk: true,
};

describe('sectionEligibility', () => {
  it('is eligible only when everything clears on a ready_signoff section', () => {
    const e = sectionEligibility({ status: 'ready_signoff' }, CLEAN);
    expect(e.eligible).toBe(true);
    expect(e.reasons).toHaveLength(0);
  });

  it('open tie-outs block completion', () => {
    const e = sectionEligibility({ status: 'ready_signoff' }, { ...CLEAN, itemsComplete: 4 });
    expect(e.eligible).toBe(false);
    expect(e.reasons.join(' ')).toContain('2 tie-out items not complete');
  });

  it('outstanding artifacts block completion', () => {
    const e = sectionEligibility({ status: 'ready_signoff' }, { ...CLEAN, artifactsIn: 1 });
    expect(e.eligible).toBe(false);
    expect(e.reasons.join(' ')).toContain('1 artifact outstanding');
  });

  it('blocked items block completion', () => {
    const e = sectionEligibility({ status: 'ready_signoff' }, { ...CLEAN, itemsBlocked: 1 });
    expect(e.eligible).toBe(false);
    expect(e.reasons.join(' ')).toContain('1 item Blocked');
  });

  it('a missing independent reviewer blocks completion', () => {
    const e = sectionEligibility({ status: 'ready_signoff' }, { ...CLEAN, reviewerOk: false });
    expect(e.eligible).toBe(false);
    expect(e.reasons.join(' ')).toContain('independent reviewer sign-off missing');
  });

  it('a non-ready section is never eligible', () => {
    const e = sectionEligibility({ status: 'in_review' }, CLEAN);
    expect(e.eligible).toBe(false);
  });

  it('the live STAT fixture shape (0/6, one Blocked) is ineligible with every reason listed', () => {
    const e = sectionEligibility(
      { status: 'ready_signoff' },
      {
        itemsTotal: 6,
        itemsComplete: 0,
        itemsBlocked: 1,
        artifactsIn: 2,
        artifactsExpected: 2,
        reviewerOk: false,
      },
    );
    expect(e.eligible).toBe(false);
    expect(e.reasons).toHaveLength(3);
  });

  it('flags a claimed Complete that outruns its tie-outs', () => {
    const e = sectionEligibility(
      { status: 'complete' },
      { ...CLEAN, itemsComplete: 2, itemsTotal: 5 },
    );
    expect(e.statusAheadOfControls).toBe(true);
  });
});
