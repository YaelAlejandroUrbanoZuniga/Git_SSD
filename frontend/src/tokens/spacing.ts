/**
 * ============================================================================
 * SPACING, SHADOWS, RADII, WIDTHS — Nexteer UI Kit v7
 * ============================================================================
 * Every padding, gap and margin is a multiple of 4. The two structural
 * exceptions are documented where they live (sidebar item `15px`, toast `14px`).
 * ============================================================================
 */

export const scale = [4, 8, 12, 16, 20, 24, 28, 32, 48, 64] as const;

/** Padding by container type. One value per type — never per screen. */
export const padding = {
  /** Compact card: KPI, info card in a grid, list card. */
  card: 20,
  /** KPI card: 16 on the left because the 4px accent stripe already takes 4. */
  kpiCard: '20px 20px 20px 16px',
  /** Section card: a card that holds a form section, a chart or a read-only
   *  block of a detail screen. More content → more air. */
  sectionCard: 24,
  emptyState: '48px 24px',
  /** Inline empty/error state inside an existing card or chart. */
  emptyInline: '24px 16px',
  modalBody: '28px 32px',
  modalHeader: '20px 32px',
  /** Band of a side panel (narrower than a modal: 300–420px). */
  panelHeader: '16px 20px',
  /** Rows and toolbars inside a side panel share the band's 20px sides. */
  panelRow: '14px 20px',
  panelToolbar: '12px 20px',
  panelFooter: '8px 12px',
  tableHeaderCell: '12px 16px',
  tableCell: '12px 16px',
  notificationRow: '14px 16px',
  menuItem: '10px 16px',
  buttonPrimary: '8px 16px',
  buttonSecondary: '8px 16px',
  buttonText: '6px 10px',
  /** Button on a colored band (DetailHero). */
  buttonOnColor: '8px 14px',
  input: '8px 12px',
  filterTrigger: '8px 12px',
  popover: 16,
  detailHero: '20px 32px',
  toast: '12px 14px', // 14 horizontal: structural, aligns the 15px icon with the 13px title
  tooltip: 12,
  sidebarItem: '15px 15px', // 15: structural, gives a 48px item with an 18px icon
  sidebarUser: '12px 16px',
} as const;

/**
 * Gaps by context. The rule that generates all of them: the gap grows with the
 * semantic independence of the elements. An icon and its label are ONE thing
 * (6). Two buttons are TWO things (8). Two blocks of a screen are two regions (24).
 */
export const gap = {
  iconTextButton: 6,
  iconTextTitle: 8,
  iconTextSidebar: 10, // compensates the fixed 40px icon box
  iconTextMenu: 12,
  iconTextNotice: 10, // toast and notification row
  labelControl: 4,
  chips: 6,
  buttons: 8,
  modalFooterButtons: 12, // Cancel and Confirm must be hard to confuse
  formFields: 16,
  formColumns: 12,
  filterFields: 12,
  toolbar: 12, // search bar + filter trigger
  /** Between cards of any grid (content cards, chart cards, KPI cards). */
  cards: 16,
  kpiCards: 16,
  sectionCardsStack: 16, // stacked section cards inside a tab
  screenBlocks: 24,
  toasts: 10,
} as const;

/** Shadows — progressive: more interaction, more shadow. Always black + alpha. */
export const shadows = {
  card: '0 1px 4px rgba(0,0,0,0.08)',
  selectable: '0 2px 6px rgba(0,0,0,0.10)',
  cardHover: '0 4px 12px rgba(0,0,0,0.13)',
  buttonHover: '0 6px 16px rgba(0,0,0,0.18)',
  /** Modal, dropdown, popover, tooltip, toast, login card. */
  dropdown: '0 8px 24px rgba(0,0,0,0.20)',
  sidePanel: '-4px 0 24px rgba(0,0,0,0.20)',
  floatingButton: '0 2px 6px rgba(0,0,0,0.28)',
} as const;

/** Border radius — one value per component TYPE. */
export const radius = {
  card: 8,
  table: 8,
  /** Primary button in a toolbar / page header (reads as a floating object). */
  buttonPrimary: 8,
  /** Primary button inside a modal (aligns with the modal's 6px inputs). */
  buttonModal: 6,
  buttonSecondary: 6,
  buttonText: 4,
  buttonOnColor: 8,
  input: 6,
  badge: 4,
  /** The ONLY pill shape in the system: a numeric count badge attached to a trigger. */
  countBadge: 999,
  pagination: 4,
  segmented: 4,
  compactControl: 4,
  popover: 10,
  dropdown: 8,
  tooltip: 8,
  toast: 8,
  modal: 12,
  loginCard: 12,
  circle: '50%',
} as const;

/** Fixed widths of floating elements. */
export const widths = {
  modalConfirm: 420,
  modalForm: 560,
  /** The only extra modal width: 2-column form or a table inside. Wider → it is a screen. */
  modalFormWide: 720,
  filterPopover: 320,
  /** Filter popover with a single field (chart card). */
  filterPopoverSingle: 220,
  sidePanelFull: 380,
  sidePanelHangingMin: 300,
  sidePanelHangingMax: 420,
  tooltip: 320,
  tooltipMaxHeight: 240,
  toast: 380,
  dropdownMin: 180,
  /** Dropdown that shows a caption above its items (ExportMenu with filter summary). */
  dropdownWithCaption: 260,
  emptyStateText: 360,
  loginCard: 550,
} as const;

/** Heights of fixed controls. */
export const heights = {
  /** Compact control in a card header (chart filter / export trigger). */
  compactControl: 22,
  /** SegmentedControl `md` (sub-views inside a tab). */
  segmentedMedium: 32,
  paginationButton: 28,
  countBadge: 16,
  sidebarCollapseButton: 30,
  avatar: 32,
  kpiCircle: 48,
  stateCircle: 48,
  notificationCircle: 28,
  noteAvatar: 28,
  /** Upcoming Events date tile (Home Guest). Only destination: HomeGuestView's event date badge. */
  dateTile: 40,
  /** Top Commodities progress-bar meter (Home Guest). Only destination: HomeGuestView's commodity bars. */
  commodityBar: 4,
} as const;

/** Standard multi-column grids. */
export const grids = {
  kpiRow: 'repeat(auto-fit, minmax(220px, 1fr))',
  cards: 'repeat(auto-fit, minmax(320px, 1fr))',
  /** Dashboards: charts two per row — a chart card needs ~500px for header controls + axis labels. */
  chartCards: 'repeat(2, minmax(0, 1fr))',
  filterFields: 'repeat(auto-fit, minmax(140px, 1fr))',
  formTwoColumns: '1fr 1fr',
} as const;
