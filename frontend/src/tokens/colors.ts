/**
 * ============================================================================
 * COLORS — Nexteer UI Kit v7
 * ============================================================================
 * UI_STANDARD.md §3 explains every group below. Short version:
 *
 *   core       6 brand colors. FIXED. Changed only when the system belongs to
 *              another brand — then all six change together, once, here.
 *   neutral    Functional greys. FIXED. Not brand colors, but each one has a
 *              single job; without them every screen picks its own grey.
 *   semantic   Feedback + link colors. FIXED across systems, so a user who
 *              learned "amber = something I can fix" in one app reads it the
 *              same way in the next one.
 *   overlay    Veils and white-on-color layers. FIXED (structural).
 *   reference  Accents the SSD Tracker reference implementation chose. FREE:
 *              replace, remove or extend per system. The only rule is REUSE —
 *              once a color owns a role, every element with that role uses the
 *              same hex. Never a "similar" shade.
 *
 * Tints are never picked by eye. They are derived from the same hex with an
 * alpha suffix — see `alpha` below:  backgroundColor: color + alpha.soft
 * ============================================================================
 */

export const colors = {
  /** The six brand colors. Never lightened, darkened or swapped per screen. */
  core: {
    /** Brand red (identity). Global header, login identity panel, sidebar
     *  collapse button, EmptyState action hover. */
    header: '#AA0202',
    /** Action red. Primary button, count badges, active sidebar marker,
     *  active tab underline, current pagination page, LoadingState ring,
     *  focus outline, required asterisk, invalid input border, side panel band. */
    action: '#DC0202',
    /** Structure grey. Sidebar background AND every secondary text in the
     *  system: subtitles, labels, helper text, secondary table cells, times. */
    structure: '#808285',
    /** Canvas. Background of every screen. Never white: white is the surface. */
    canvas: '#EEEEEE',
    /** Surface. Every card, modal, panel, table, dropdown and toast. Also the
     *  text color on header, sidebar and colored bands. */
    surface: '#FFFFFF',
    /** Primary text. Titles, values, primary table cell, input text. */
    text: '#000000',
  },

  /** Functional greys. Rule of thumb: lighter = further back. Not interchangeable. */
  neutral: {
    /** Input / select / secondary button border, inactive sort arrow, modal footer divider. */
    border: '#D1D3D4',
    /** Search bar border, table row separator, dropdown/popover border, panel dividers. */
    borderSoft: '#E0E0E0',
    /** Table header and odd (zebra) rows ONLY. Also secondary-button hover and disabled input background. */
    tableHeader: '#F7F7F7',
    /** Hover of a list row, menu item, in-panel tab. (Table rows hover to `core.canvas`.) */
    hoverRow: '#F5F5F5',
    /** Hover of a clickable cell inside a matrix (PivotTable). */
    hoverCell: '#EFEFEF',
    /** Divider between items INSIDE a card (InfoField inline rows, lists in a card). */
    dividerInner: '#F0F0F0',
    /** Sunken zone inside a panel: note composer, dropzone, expanded detail row. */
    sunken: '#FAFAFA',
    /** Sidebar user block — one step darker than the sidebar so it separates without a line. */
    userBlock: '#6B7280',
    /** Text of a read notification and of a disabled input. */
    muted: '#9CA3AF',
    /** Labels and helper text INSIDE the login card only (login has its own scale). */
    loginText: '#484848',
    /** LoadingState ring track. */
    loadingTrack: '#F3D6D6',
    scrollTrack: '#F1F1F1',
    scrollThumb: '#C1C1C1',
    scrollThumbHover: '#A1A1A1',
  },

  /** Cross-system meaning. Toasts, validation, links, deltas. */
  semantic: {
    /** Done, confirmed, positive delta, "Excel" export icon. */
    success: '#6ABF4B',
    /** Informational, in progress. */
    info: '#02B3E1',
    /** Something the user can fix: validation errors, permission warnings, at-risk. */
    warning: '#D4A017',
    /** Technical failure, overdue, negative delta. Same hex as `core.action` on purpose. */
    error: '#DC0202',
    /** Internal link, breadcrumb level, text action inside a card, table action icon. */
    link: '#0084C0',
    /** Link that leaves the system. Always underlined. */
    linkExternal: '#02B3E1',
  },

  /** Veils and translucent layers. */
  overlay: {
    /** Behind a centered modal (with backdropFilter: blur(4px)). */
    modal: 'rgba(0,0,0,0.3)',
    /** Behind a side panel (with backdropFilter: blur(4px)). Lighter: a panel does not block. */
    sidePanel: 'rgba(0,0,0,0.15)',
    /** White layers on a colored band (DetailHero, ModalHeader). */
    onColorButton: 'rgba(255,255,255,0.14)',
    onColorButtonHover: 'rgba(255,255,255,0.24)',
    onColorBorder: 'rgba(255,255,255,0.35)',
    onColorChip: 'rgba(255,255,255,0.22)',
    onColorDivider: 'rgba(255,255,255,0.25)',
    /** Text on a colored band / dark background. */
    onColorTextStrong: 'rgba(255,255,255,0.85)',
    onColorText: 'rgba(255,255,255,0.80)',
    onColorTextSoft: 'rgba(255,255,255,0.75)',
    onColorTextFaint: 'rgba(255,255,255,0.70)',
    /** Sidebar nav item hover. */
    sidebarHover: 'rgba(255,255,255,0.08)',
  },

  /**
   * REFERENCE — free. What SSD Tracker chose for its own roles. Keep, replace or
   * delete. If you add one, document it as "role: …, only destination: …".
   */
  reference: {
    /** Strong warning / attention (SSD: Preliminary Evaluation stage, MRL module). */
    orange: '#E3650B',
    /** Module accent (SSD: Events module). */
    green: '#04BF6E',
    /** Module accent (SSD: Strategy module). */
    purple: '#C026D3',
    /** Module accent (SSD: calendar markers). */
    pink: '#EC4899',
    /** Neutral tag inside a note or comment. */
    neutralTag: '#475569',
    /** Terminal / archived / lowest privilege. */
    archived: '#6B7280',
  },
} as const;

/**
 * Hex alpha suffixes. The ONLY way to get a lighter version of a color.
 *   color + alpha.hover     ~8%  — hover background of a text button
 *   color + alpha.soft      ~12% — icon circle background, selected row
 *   color + alpha.tint      ~15% — badge / chip background, active filter trigger
 */
export const alpha = {
  hover: '14',
  soft: '1F',
  tint: '26',
} as const;

/** Shorthand used across components. */
export const tint = (hex: string, level: keyof typeof alpha) => `${hex}${alpha[level]}`;
