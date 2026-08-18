import { Component, type ErrorInfo, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { BRAND_COLORS } from '../constants/designTokens';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence for the whole router.
 *
 * Two failures used to leave the user staring at a blank page with no toast and
 * no way back:
 *
 *  1. A render-time exception anywhere in a page component. React unmounts the
 *     entire tree when nothing catches it.
 *  2. A lazy chunk that fails to download — the realistic case being a user who
 *     had the tab open across a redeploy, so the hashed chunk names in their
 *     cached `index.html` no longer exist on the server. `App.tsx` gives every
 *     `lazy()` a `.catch` that rethrows a recognisable error, which lands here.
 *
 * Reloading is genuinely the fix for (2) — it refetches `index.html` and the
 * current chunk names — so the recovery button is a hard reload, with a
 * "try again" that only resets the boundary for the transient-render case.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The one deliberate console call in `src/` — no logging service is wired up
    // yet, and without it the stack of a crash that already emptied the screen
    // would be lost entirely. It only ever fires on an actual unhandled error.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleRetry = () => this.setState({ error: null });

  private handleReload = () => window.location.reload();

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isChunkError = isChunkLoadError(error);

    return (
      <div
        role="alert"
        style={{
          minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          style={{
            backgroundColor: BRAND_COLORS.cards, borderRadius: 8,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '48px 32px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
            maxWidth: 520,
          }}
        >
          <div
            style={{
              width: 48, height: 48, borderRadius: '50%', backgroundColor: BRAND_COLORS.background,
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, flexShrink: 0,
            }}
          >
            <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 18, color: BRAND_COLORS.accentRed }} />
          </div>

          <p style={{ fontSize: 15, fontWeight: 700, color: '#000000', margin: '0 0 4px' }}>
            {isChunkError ? 'This page could not be loaded' : 'Something went wrong on this screen'}
          </p>
          <p style={{ fontSize: 13, color: BRAND_COLORS.sidebar, margin: 0, lineHeight: 1.6 }}>
            {isChunkError
              ? 'A newer version of the application was published while this tab was open, so part of it is no longer available. Reloading picks up the new version — nothing you saved was lost.'
              : 'The screen stopped rendering because of an unexpected error. Your data was not changed. Reload to start again; if it keeps happening, report it with the details below.'}
          </p>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: '8px 16px', fontSize: 14, fontWeight: 700, color: BRAND_COLORS.cards,
                backgroundColor: BRAND_COLORS.accentRed, border: 'none', borderRadius: 6, cursor: 'pointer',
              }}
            >
              <FontAwesomeIcon icon={faRotateRight} style={{ fontSize: 12, marginRight: 8 }} />
              Reload the application
            </button>
            {!isChunkError && (
              <button
                onClick={this.handleRetry}
                style={{
                  padding: '8px 16px', fontSize: 14, fontWeight: 700, color: BRAND_COLORS.sidebar,
                  backgroundColor: 'transparent', border: `1px solid ${BRAND_COLORS.sidebar}`,
                  borderRadius: 6, cursor: 'pointer',
                }}
              >
                Try again
              </button>
            )}
          </div>

          <p
            style={{
              fontSize: 11, color: BRAND_COLORS.sidebar, margin: '20px 0 0',
              fontFamily: 'monospace', wordBreak: 'break-word', opacity: 0.8,
            }}
          >
            {error.message}
          </p>
        </div>
      </div>
    );
  }
}

/**
 * A failed dynamic `import()`. Browsers disagree on the wording, so this matches
 * the shapes they actually produce plus the marker `App.tsx` attaches to the
 * error it rethrows from each `lazy()`'s `.catch`.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === 'ChunkLoadError' ||
    /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i
      .test(error.message)
  );
}
