import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import type { ReactNode } from 'react';
import { useModalTransition } from '../hooks/useModalTransition';
import { MODAL_PANEL_BASE, MODAL_BODY_PADDING } from './modalPanelStyle';
import { ModalHeader } from './ModalHeader';

interface Props {
  title: string;
  message: ReactNode;
  /** Label of the primary action, e.g. "Save changes", "Delete". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Primary button colour. Defaults to the Nexteer action red. */
  confirmColor?: string;
  /** Blocks the primary action while the caller still needs input. */
  confirmDisabled?: boolean;
  /** Extra content between the message and the buttons (e.g. a reason field). */
  children?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Standard 6.6 confirmation modal: warning icon + message + secondary Cancel +
 * primary action. Used before any action that changes data.
 */
export function ConfirmDialog({
  title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  confirmColor = '#DC0202', confirmDisabled = false, children, onCancel, onConfirm,
}: Props) {
  const { requestClose, overlayClass, panelClass } = useModalTransition(onCancel);

  return (
    <div
      onClick={requestClose}
      className={overlayClass}
      style={{ position: 'fixed', inset: 0, zIndex: 10001, backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={panelClass}
        role="dialog"
        aria-modal="true"
        style={{ ...MODAL_PANEL_BASE, width: 420 }}
      >
        <ModalHeader title={title} accentColor={confirmColor} onClose={requestClose} />

        <div style={{ padding: MODAL_BODY_PADDING }}>
          {/* The warning cue moves out of the header band and sits inline with
              the message, so "this needs attention" isn't lost. */}
          <div style={{ display: 'flex', gap: 12, margin: '0 0 20px' }}>
            <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 18, color: confirmColor, flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, color: '#808285', lineHeight: 1.6 }}>{message}</div>
          </div>

          {children}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: children ? 20 : 0 }}>
            <button
              onClick={requestClose}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer' }}
            >
              {cancelLabel}
            </button>
            <button
              onClick={() => { if (!confirmDisabled) onConfirm(); }}
              disabled={confirmDisabled}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: confirmColor, color: '#FFFFFF', cursor: confirmDisabled ? 'not-allowed' : 'pointer', opacity: confirmDisabled ? 0.45 : 1 }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
