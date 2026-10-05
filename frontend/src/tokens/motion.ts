/**
 * ============================================================================
 * MOTION — Nexteer UI Kit v7
 * ============================================================================
 * Three durations, two curves, a closed set of animation classes. Every
 * @keyframes lives in styles/global.css and is switched off under
 * `prefers-reduced-motion` there. No component declares its own <style> block
 * with keyframes.
 * ============================================================================
 */

export const duration = {
  /** Hover background, color change, icon swap. */
  fast: 120,
  /** Hover shadow — the one exception: a shadow at 120ms reads as a jump. */
  shadow: 150,
  /** Modal/toast/veil in-out, page fade. */
  medium: 200,
  /** Sidebar collapse/expand and the <main> shift that follows it. */
  slow: 300,
} as const;

export const easing = {
  enter: 'ease-out',
  exit: 'ease-in',
  /** Only for infinite loops: LoadingState spin. */
  loop: 'linear',
} as const;

/** Ready-made transitions for `style`. */
export const transitions = {
  background: `background-color ${duration.fast}ms ${easing.enter}`,
  color: `color ${duration.fast}ms ${easing.enter}`,
  backgroundAndColor: `background-color ${duration.fast}ms ${easing.enter}, color ${duration.fast}ms ${easing.enter}`,
  shadow: `box-shadow ${duration.shadow}ms ${easing.enter}`,
  sidebar: `width ${duration.slow}ms ${easing.enter}`,
  mainShift: `margin-left ${duration.slow}ms ${easing.enter}`,
} as const;

/** Animation classes defined in styles/global.css. Applied with className. */
export const animationClass = {
  modalOverlay: 'modal-overlay',
  modalPanel: 'modal-panel',
  toast: 'toast-item',
  pageFade: 'page-fade',
  /** Add to any element that is leaving (modal, toast). */
  closing: 'is-closing',
  loadingRing: 'loading-ring',
  /** Gentle opacity pulse for something that needs attention (e.g. an "Overdue" badge). */
  attentionPulse: 'attention-pulse',
} as const;

/** How long a closing modal/toast stays mounted. MUST match `.is-closing` in global.css. */
export const EXIT_MS = duration.medium;

/**
 * Loading delays — a cascade, not three random numbers (UI_STANDARD.md §6.16).
 * A loader that appears for 80ms is a flicker, not feedback.
 */
export const loadingDelay = {
  /** Suspense fallback of a lazy route. */
  route: 350,
  /** A page's own initial fetch — sits on top of the route fallback, so a
   *  navigation never shows two spinners back to back. */
  pageFetch: 100,
  /** A section reloading inside a page that is already visible. Default. */
  section: 400,
} as const;
