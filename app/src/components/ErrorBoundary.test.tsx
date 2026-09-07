// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('synthetic render failure');
}

describe('ErrorBoundary (deliberate error state)', () => {
  afterEach(cleanup);

  it('renders a plain-language error panel instead of blanking the shell', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <HashRouter>
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      </HashRouter>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/could not be rendered/)).toBeTruthy();
    expect(screen.getByText('synthetic render failure')).toBeTruthy();
    expect(screen.getByRole('link', { name: /back to the overview/i })).toBeTruthy();
    spy.mockRestore();
  });

  it('passes children through when nothing throws', () => {
    render(
      <HashRouter>
        <ErrorBoundary>
          <p>rendered fine</p>
        </ErrorBoundary>
      </HashRouter>,
    );
    expect(screen.getByText('rendered fine')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
