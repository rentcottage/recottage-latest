import { Component, type ErrorInfo, type ReactNode } from 'react';
import { translateStatic } from '../../lib/i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * App-wide error boundary. Without this, any render-time throw unmounts the whole
 * tree to a blank white screen. This catches the throw and shows a recoverable,
 * on-brand fallback with a reload action instead.
 *
 * Uses inline styles so the fallback renders even if the crash left the stylesheet
 * or surrounding layout in a bad state. It sits *outside* the I18nProvider (so it
 * can catch crashes from within it), so it can't use the `useTranslation` hook —
 * it reads the persisted language directly via `translateStatic`.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] caught render error:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          backgroundColor: '#ffffff',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <div style={{ maxWidth: '360px', textAlign: 'center' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 20px',
              borderRadius: '9999px',
              backgroundColor: '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
            }}
          >
            ⚠️
          </div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
            {translateStatic('errorBoundary.title')}
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.5, margin: '0 0 20px' }}>
            {translateStatic('errorBoundary.description')}
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              backgroundColor: '#ef4444',
              color: '#ffffff',
              border: 'none',
              padding: '12px 28px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {translateStatic('errorBoundary.reload')}
          </button>
        </div>
      </div>
    );
  }
}
