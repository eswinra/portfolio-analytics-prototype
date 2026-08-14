// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DatasetProvider, useDataset, type PreflightResult } from '../lib/dataset/useDataset';
import { AcfrView } from './AcfrView';

const SAMPLE = join(__dirname, '..', '..', '..', 'data', 'sample');
const pensionCsv = readFileSync(join(SAMPLE, 'demofund_export_v1.csv'), 'utf-8');

describe('cross-entity import gate (audit finding 3)', () => {
  it('hard-blocks a Pension file staged under the OPEB workspace', () => {
    const { result } = renderHook(() => useDataset(), { wrapper: DatasetProvider });
    act(() => result.current.setEntityTab('OPEB'));
    let preflight: PreflightResult | undefined;
    act(() => {
      preflight = result.current.stageCsvText(pensionCsv, 'pension.csv');
    });
    expect(preflight!.ok).toBe(false);
    expect(preflight!.errors[0]?.ruleId).toBe('E-ENTITY');
    expect(preflight!.errors[0]?.message).toContain('DEMOFUND');
    expect(preflight!.errors[0]?.message).toContain('DEMO-OPEB');
    let applied = true;
    act(() => {
      applied = result.current.applyStaged();
    });
    expect(applied).toBe(false);
    expect(result.current.source).toBe('fixture');
  });

  it('accepts the matching workspace and clears staging on a tab switch', () => {
    const { result } = renderHook(() => useDataset(), { wrapper: DatasetProvider });
    let preflight: PreflightResult | undefined;
    act(() => {
      preflight = result.current.stageCsvText(pensionCsv, 'pension.csv');
    });
    expect(preflight!.ok).toBe(true);
    // switching workspaces discards the staged file — it can never apply across funds
    act(() => result.current.setEntityTab('OPEB'));
    expect(result.current.preflight).toBeNull();
    let applied = true;
    act(() => {
      applied = result.current.applyStaged();
    });
    expect(applied).toBe(false);
  });
});

describe('ACFR completion gate (audit finding 2)', () => {
  it('leadership sees a disabled action with the open requirements listed', () => {
    render(<AcfrView />);
    const select = screen.getByLabelText(/viewer role/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'leadership' } });
    // STAT is ready_signoff with 0/6 tie-outs and one Blocked item
    expect(screen.getByText(/Completion unavailable/)).toBeTruthy();
    expect(screen.getByText(/tie-out items not complete/)).toBeTruthy();
    expect(screen.getByText(/item Blocked/)).toBeTruthy();
    const btn = screen.getByRole('button', { name: /Mark complete/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('flags sections whose claimed status outruns their controls', () => {
    render(<AcfrView />);
    // INTRO is recorded complete with 2/5 tie-outs complete
    expect(screen.getAllByText(/status ahead of controls/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/claim outruns its controls/).length).toBeGreaterThan(0);
  });
});
