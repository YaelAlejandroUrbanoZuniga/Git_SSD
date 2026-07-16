import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle, faTimesCircle, faExclamationTriangle, faInfoCircle, faTimes,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

// Toast kinds map 1:1 to the UI standard palette + icons (section 9.2).
export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

const KIND_STYLES: Record<ToastKind, { color: string; icon: IconDefinition }> = {
  success: { color: '#6ABF4B', icon: faCheckCircle },
  error:   { color: '#DC0202', icon: faTimesCircle },
  warning: { color: '#D4A017', icon: faExclamationTriangle },
  info:    { color: '#02B3E1', icon: faInfoCircle },
};

// Errors the user can fix stay on screen longer than confirmations.
const DURATION_MS: Record<ToastKind, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 6000,
};

const EXIT_MS = 200; // standard 13.2 — medium duration for toast/modal

interface ToastContextValue {
  /** Confirms exactly what happened, e.g. "Supplier moved to Preliminary Evaluation". */
  success: (title: string, message?: string) => void;
  /**
   * The user did something we can't accept: empty required field, bad format,
   * or a business rule they violated. Rendered as a warning (gold) rather than
   * a hard error (red) because it is actionable — say which field/rule failed
   * and how to fix it.
   */
  validationError: (title: string, message?: string) => void;
  /**
   * A technical failure: network, backend, timeout. Not the user's fault, so
   * the copy must say so and invite a retry. Nothing calls this yet — the
   * frontend has no real API calls (see TODO at the call sites).
   */
  systemError: (message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [closing, setClosing] = useState<number[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setClosing(prev => (prev.includes(id) ? prev : [...prev, id]));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      setClosing(prev => prev.filter(c => c !== id));
    }, EXIT_MS);
  }, []);

  const push = useCallback((kind: ToastKind, title: string, message?: string) => {
    const id = nextId.current++;
    setToasts(prev => [...prev, { id, kind, title, message }]);
    setTimeout(() => dismiss(id), DURATION_MS[kind]);
  }, [dismiss]);

  const value = useMemo<ToastContextValue>(() => ({
    success: (title, message) => push('success', title, message),
    validationError: (title, message) => push('warning', title, message),
    systemError: (message) => push(
      'error',
      'Technical problem — not your data',
      message ?? 'The request could not be completed due to a system error. Nothing was changed. Please try again in a moment.',
    ),
    info: (title, message) => push('info', title, message),
    warning: (title, message) => push('warning', title, message),
    dismiss,
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 10002,
          display: 'flex', flexDirection: 'column', gap: 10,
          pointerEvents: 'none', maxWidth: 380,
        }}
      >
        {toasts.map(t => (
          <ToastItem
            key={t.id}
            toast={t}
            closing={closing.includes(t.id)}
            onDismiss={() => dismiss(t.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, closing, onDismiss }: { toast: Toast; closing: boolean; onDismiss: () => void }) {
  const { color, icon } = KIND_STYLES[toast.kind];

  return (
    <div
      role={toast.kind === 'error' || toast.kind === 'warning' ? 'alert' : 'status'}
      className={`toast-item${closing ? ' is-closing' : ''}`}
      style={{
        pointerEvents: 'auto',
        display: 'flex', alignItems: 'flex-start', gap: 10,
        backgroundColor: '#FFFFFF',
        borderLeft: `4px solid ${color}`,
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.20)',
        padding: '12px 14px',
      }}
    >
      <FontAwesomeIcon icon={icon} style={{ fontSize: 15, color, marginTop: 1, flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.4 }}>
          {toast.title}
        </p>
        {toast.message && (
          <p style={{ fontSize: 12, color: '#808285', margin: '3px 0 0', lineHeight: 1.5 }}>
            {toast.message}
          </p>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}
      >
        <FontAwesomeIcon icon={faTimes} style={{ fontSize: 12, color: '#808285' }} />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside a ToastProvider');
  return ctx;
}
