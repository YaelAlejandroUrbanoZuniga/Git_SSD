/**
 * ============================================================================
 * LAYOUT GEOMETRY + Z-INDEX — Nexteer UI Kit v7
 * ============================================================================
 * Anything positioned relative to the header, the sidebar or the content area
 * imports from here. Writing one of these numbers by hand is a defect: a copied
 * number always drifts, and the drift shows up as a few pixels of hidden
 * content that nobody reports and everybody notices.
 * ============================================================================
 */

/** Fixed global header height. 55, not 44: at 44 the side-panel veil covered
 *  11px of the header. Do not "fix" it back. */
export const HEADER_HEIGHT = 55;

export const SIDEBAR_WIDTH = 240;
/** 60 — not 56, not 64. <main>'s marginLeft reads this same constant. */
export const SIDEBAR_WIDTH_COLLAPSED = 60;

/** <main> padding. TOP includes the header because the header is fixed. */
export const MAIN_PADDING_TOP = HEADER_HEIGHT + 32; // 87
export const MAIN_PADDING_X = 32;
export const MAIN_PADDING_BOTTOM = 32;

/** Visible height of the content area (LoadingState `fill`, full-height layouts). */
export const CONTENT_HEIGHT_CSS = `calc(100vh - ${MAIN_PADDING_TOP}px - ${MAIN_PADDING_BOTTOM}px)`;

/** Height of a full side panel (hangs from the header down to the bottom). */
export const SIDE_PANEL_FULL_HEIGHT_CSS = `calc(100vh - ${HEADER_HEIGHT}px)`;
/** Height of a hanging side panel (notifications). */
export const SIDE_PANEL_HANGING_HEIGHT = '75vh';
/** Width of a hanging side panel, clamped by widths.sidePanelHanging{Min,Max}. */
export const SIDE_PANEL_HANGING_WIDTH = '25vw';

/** Centered-modal height cap. The band stays fixed; only the body scrolls. */
export const MODAL_MAX_HEIGHT = '85vh';

/** Desktop application. No phone/tablet breakpoints; supports browser zoom and 1280px laptops. */
export const MIN_APP_WIDTH = 1280;

/** Max height of a grow-with-rows chart or list inside a card before it scrolls. */
export const CARD_SCROLL_MAX_HEIGHT = 300;

/** Closed z-index scale. Never invent a level, never use 9999. */
export const zIndex = {
  sidebar: 30,
  /** Popover/dropdown inside the content (filter popover, export menu, row menu). */
  dropdown: 50,
  header: 50,
  /** User menu hanging from the sidebar (must clear the sidebar itself). */
  sidebarMenu: 50,
  sidePanelVeil: 98,
  sidePanel: 99,
  loadingFullScreen: 200,
  tooltip: 300,
  /** Centered modal + its veil. */
  modal: 10001,
  /** Above modals on purpose: an error must be visible even with a modal open. */
  toast: 10002,
} as const;
