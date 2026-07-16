import { useCallback, useEffect, useState } from 'react';

// Standard 13.2 — medium duration for modal/toast. Must match the animation
// durations declared for .modal-overlay / .modal-panel in index.css.
const EXIT_MS = 200;

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * Keeps a modal mounted long enough to play its exit animation.
 *
 * Call `requestClose` wherever `onClose` used to be called, and spread
 * `overlayClass` / `panelClass` onto the overlay and panel elements.
 * Honours prefers-reduced-motion (standard 13.3) by unmounting immediately.
 */
export function useModalTransition(onClose: () => void) {
  const [closing, setClosing] = useState(false);

  const requestClose = useCallback(() => setClosing(true), []);

  useEffect(() => {
    if (!closing) return;
    if (prefersReducedMotion()) {
      onClose();
      return;
    }
    const t = setTimeout(onClose, EXIT_MS);
    return () => clearTimeout(t);
  }, [closing, onClose]);

  return {
    closing,
    requestClose,
    overlayClass: `modal-overlay${closing ? ' is-closing' : ''}`,
    panelClass: `modal-panel${closing ? ' is-closing' : ''}`,
  };
}
