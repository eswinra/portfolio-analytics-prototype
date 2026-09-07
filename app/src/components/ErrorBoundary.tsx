import { Component, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Deliberate error state. A view that throws must not blank the whole shell: the masthead,
 *  navigation, and disclaimer stay in place and the failure is reported in plain language.
 *  App.tsx keys the boundary by route, so moving to another view starts fresh. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <section className="panel error-state" role="alert">
        <h2>This view could not be rendered</h2>
        <p className="panel-sub">
          Something went wrong while drawing this screen. Nothing was changed — figures on the other
          views are unaffected, and any imported dataset still lives only in this browser tab.
        </p>
        <p className="error-message">{error.message || String(error)}</p>
        <p className="panel-note">
          <NavLink to="/">Back to the overview</NavLink>
          {' · '}
          <button type="button" onClick={() => window.location.reload()}>
            Reload the page
          </button>
        </p>
      </section>
    );
  }
}
