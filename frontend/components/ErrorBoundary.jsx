import React from 'react';
import { ShieldAlert } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    let readable = 'An unexpected error occurred while rendering this view.';
    if (error?.message) {
      try {
        const parsed = JSON.parse(error.message);
        if (parsed?.error) {
          readable = `Permission or data access error: ${parsed.error}`;
        } else {
          readable = error.message;
        }
      } catch {
        readable = error.message;
      }
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="ambient-canvas"
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: '1.5rem',
          }}
        >
          <div className="ambient-backdrop" aria-hidden="true" />
          <div className="ambient-scrim" aria-hidden="true" />
          <section
            className="glass-panel"
            role="alert"
            style={{
              maxWidth: '520px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.9rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--status-rejected)' }}>
              <ShieldAlert size={22} aria-hidden="true" />
              <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Something went wrong</h1>
            </div>
            <p style={{ color: 'var(--ink-secondary)', fontSize: '0.92rem', margin: 0 }}>
              {this.state.message}
            </p>
            <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.25rem' }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={this.handleReload}>
                Reload Page
              </button>
              <a href="/" className="btn btn-glass btn-sm">
                Return Home
              </a>
            </div>
          </section>
        </div>
      );
    }

    return this.props.children;
  }
}
