import { describe, expect, it } from 'vitest';

import { checkEntityMatch } from './entityRegistry';

/** Cross-entity Apply must be impossible (audit finding 3). */

describe('checkEntityMatch', () => {
  it('passes the matching workspace', () => {
    expect(checkEntityMatch('DEMOFUND', 'PENSION').ok).toBe(true);
    expect(checkEntityMatch('DEMO-OPEB', 'OPEB').ok).toBe(true);
  });

  it('hard-blocks a cross-fund file and names both datasets', () => {
    const m = checkEntityMatch('DEMOFUND', 'OPEB');
    expect(m.ok).toBe(false);
    expect(m.error).toContain('E-ENTITY');
    expect(m.error).toContain('DEMOFUND');
    expect(m.error).toContain('DEMO-OPEB');
    expect(m.error).toContain('Nothing was applied');
  });

  it('hard-blocks unregistered entities — no name-based policy inference', () => {
    const m = checkEntityMatch('OTHERFUND', 'PENSION');
    expect(m.ok).toBe(false);
    expect(m.error).toContain('E-UNREGISTERED');
    // the old behavior would have inferred OPEB policy from a name like this:
    const sneaky = checkEntityMatch('MY-OPEB-FUND', 'OPEB');
    expect(sneaky.ok).toBe(false);
    expect(sneaky.error).toContain('E-UNREGISTERED');
  });

  it('blocks tracker files from fund workspaces', () => {
    const m = checkEntityMatch('DEMO-ACFR', 'PENSION');
    expect(m.ok).toBe(false);
    expect(m.error).toContain('E-TRACKER');
  });
});
