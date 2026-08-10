/**
 * Shared layout numbers. Single source of truth for the fixed header's
 * height and the <main> content area it dictates — every fixed-position
 * element that hangs below the header (sidebar, notification panel, notes
 * panel, toast stack) and every consumer of the content area's real size
 * (LoadingState's `fill` mode) reads from here instead of a hand-copied
 * number.
 */
export const HEADER_HEIGHT = 55;

/** <main>'s own padding (App.tsx). Pulled out so anything that needs the
 *  exact visible content height — e.g. LoadingState's `fill` mode — can
 *  compute `100vh - MAIN_PADDING_TOP - MAIN_PADDING_BOTTOM` without
 *  duplicating these numbers. */
export const MAIN_PADDING_TOP = HEADER_HEIGHT + 32;
export const MAIN_PADDING_X = 32;
export const MAIN_PADDING_BOTTOM = 32;

/** Notification panel's max width (GlobalHeader.tsx). Shared so the toast
 *  stack can reserve space to its left and never render underneath it. */
export const NOTIFICATION_PANEL_MAX_WIDTH = 420;
