// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { useUrlParam } from './urlState';

function setup(initial: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => {
      const [value, set] = useUrlParam('cat', 'total');
      const navigate = useNavigate();
      const { search } = useLocation();
      return { value, set, navigate, search };
    },
    { wrapper },
  );
}

describe('a setting kept in the address', () => {
  it('shows the value just set at once, and the address records it', async () => {
    const { result } = setup('/cio?tab=performance');
    expect(result.current.value).toBe('total');
    await act(async () => result.current.set('growth'));
    expect(result.current.value).toBe('growth');
    expect(result.current.search).toContain('cat=growth');
  });

  it('follows a link that leaves the setting out, rather than bringing back the last choice', async () => {
    // found on CIO Monthly: after choosing Growth, a link to the same page without `cat` still
    // showed Growth, because the value set earlier was waiting for the address to match its old
    // value, and the link made it match
    const { result } = setup('/cio?tab=performance');
    await act(async () => result.current.set('growth'));
    expect(result.current.value).toBe('growth');
    await act(async () => result.current.navigate('/cio?tab=positioning'));
    expect(result.current.search).not.toContain('cat=');
    expect(result.current.value).toBe('total');
  });

  it('follows the address when it moves on, and a later choice still shows at once', async () => {
    const { result } = setup('/cio');
    await act(async () => result.current.set('credit'));
    await act(async () => result.current.navigate('/cio?cat=rrm'));
    expect(result.current.value).toBe('rrm');
    await act(async () => result.current.set('growth'));
    expect(result.current.value).toBe('growth');
    await act(async () => result.current.navigate('/cio'));
    expect(result.current.value).toBe('total');
  });
});
