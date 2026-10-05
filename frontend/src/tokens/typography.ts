import type { CSSProperties } from 'react';
import { colors } from './colors';

/**
 * ============================================================================
 * TYPOGRAPHY — Nexteer UI Kit v7
 * ============================================================================
 * One family: Inter, applied with the universal selector in styles/global.css.
 * Hierarchy is built with size, weight and color — never with a second font.
 *
 * Every entry is a ready-to-spread style object with ONE destination:
 *     <h1 style={{ ...type.pageTitle, margin: 0 }}>Suppliers</h1>
 *
 * If a new text does not fit any entry, use the closest one. Do not invent an
 * in-between size. Allowed weights: 400, 500, 600, 700, 800.
 * Nothing the user must read goes below 11px (UI_STANDARD.md §4.3).
 * ============================================================================
 */

export const fontFamily = "'Inter', sans-serif";

/** The system's text sizes. 11 sizes in total (login's 55 included). */
export const fontSizes = [11, 12, 13, 14, 15, 16, 20, 28, 30, 32, 55] as const;

const t = (s: CSSProperties) => s;
const { core, neutral, overlay, semantic } = colors;

export const type = {
  // ── Screen ────────────────────────────────────────────────────────────
  pageTitle:      t({ fontSize: 32, fontWeight: 700, color: core.text, lineHeight: 1.1 }),
  /** Always a fact ("128 suppliers registered"), never a slogan. */
  pageSubtitle:   t({ fontSize: 16, fontWeight: 400, color: core.structure }),
  /** Title of a card or a block inside a screen. */
  sectionTitle:   t({ fontSize: 14, fontWeight: 700, color: core.text }),
  /** Small uppercase label: stacked read-only field label, chip on a colored
   *  band, tooltip title, table-group caption. */
  overline:       t({ fontSize: 11, fontWeight: 700, color: core.structure, letterSpacing: '0.05em', textTransform: 'uppercase' }),
  /** Plain body copy inside a card. */
  body:           t({ fontSize: 13, fontWeight: 400, color: core.text, lineHeight: 1.5 }),
  /** Secondary body copy / descriptions. */
  bodySecondary:  t({ fontSize: 13, fontWeight: 400, color: core.structure, lineHeight: 1.5 }),
  /** Captions, timestamps, "Showing 1–15 of 80". */
  caption:        t({ fontSize: 12, fontWeight: 400, color: core.structure }),

  // ── Detail hero (colored band on a detail screen) ─────────────────────
  heroTitle:      t({ fontSize: 28, fontWeight: 800, color: core.surface, letterSpacing: '-0.02em' }),
  heroMeta:       t({ fontSize: 13, fontWeight: 400, color: overlay.onColorTextSoft }),

  // ── KPI ───────────────────────────────────────────────────────────────
  kpiLabel:       t({ fontSize: 14, fontWeight: 500, color: core.structure }),
  kpiValue:       t({ fontSize: 30, fontWeight: 700, color: core.text }),
  kpiSubtext:     t({ fontSize: 11, fontWeight: 400, color: core.structure }),

  // ── Tables ────────────────────────────────────────────────────────────
  tableHeader:    t({ fontSize: 13, fontWeight: 700, color: core.text }),
  cellPrimary:    t({ fontSize: 13, fontWeight: 700, color: core.text }),
  cellSecondary:  t({ fontSize: 13, fontWeight: 400, color: core.structure }),
  cellNumeric:    t({ fontSize: 13, fontWeight: 600, color: core.text }),
  /** Folio, code, id inside a row. */
  cellMeta:       t({ fontSize: 12, fontWeight: 400, color: core.structure }),
  /** +n / −n next to a number. Color by sign (success / error). */
  delta:          t({ fontSize: 12, fontWeight: 700 }),

  // ── Navigation ────────────────────────────────────────────────────────
  sidebarItem:    t({ fontSize: 16, fontWeight: 500 }),
  sidebarUser:    t({ fontSize: 15, fontWeight: 600, color: core.surface }),
  sidebarRole:    t({ fontSize: 12, fontWeight: 400, color: overlay.onColorTextFaint }),
  menuItem:       t({ fontSize: 13, fontWeight: 400, color: core.text }),
  tab:            t({ fontSize: 14, fontWeight: 400, color: core.structure }),
  tabActive:      t({ fontSize: 14, fontWeight: 700, color: core.text }),
  /** Tabs inside a side panel (Unread / All). */
  panelTab:       t({ fontSize: 13, fontWeight: 600 }),
  breadcrumb:     t({ fontSize: 12, fontWeight: 500, color: semantic.link }),
  breadcrumbCurrent: t({ fontSize: 12, fontWeight: 600, color: core.text }),

  // ── Modals and panels ─────────────────────────────────────────────────
  modalTitle:     t({ fontSize: 20, fontWeight: 700, color: core.surface, letterSpacing: '-0.01em' }),
  modalSubtitle:  t({ fontSize: 13, fontWeight: 400, color: overlay.onColorTextSoft }),
  modalBody:      t({ fontSize: 13, fontWeight: 400, color: core.structure, lineHeight: 1.6 }),
  panelTitle:     t({ fontSize: 15, fontWeight: 700, color: core.surface }),

  // ── States, notifications, toasts ─────────────────────────────────────
  stateTitle:       t({ fontSize: 15, fontWeight: 700, color: core.text }),
  stateDescription: t({ fontSize: 13, fontWeight: 400, color: core.structure }),
  notificationText: t({ fontSize: 13, fontWeight: 600, color: core.text, lineHeight: 1.4 }),
  notificationTime: t({ fontSize: 12, fontWeight: 400, color: core.structure }),
  toastTitle:     t({ fontSize: 13, fontWeight: 700, color: core.text, lineHeight: 1.4 }),
  toastMessage:   t({ fontSize: 12, fontWeight: 400, color: core.structure, lineHeight: 1.5 }),

  // ── Buttons and links ─────────────────────────────────────────────────
  buttonPrimary:  t({ fontSize: 14, fontWeight: 700 }),
  /** Primary button inside a modal footer. */
  buttonModal:    t({ fontSize: 13, fontWeight: 700 }),
  buttonSecondary: t({ fontSize: 13, fontWeight: 600 }),
  linkInternal:   t({ fontSize: 13, fontWeight: 500, color: semantic.link }),
  linkExternal:   t({ fontSize: 13, fontWeight: 400, color: semantic.linkExternal, textDecoration: 'underline' }),

  // ── Forms ─────────────────────────────────────────────────────────────
  input:          t({ fontSize: 13, fontWeight: 400, color: core.text }),
  formLabel:      t({ fontSize: 13, fontWeight: 400, color: core.structure }),
  formHint:       t({ fontSize: 11, fontWeight: 400, color: core.structure, lineHeight: 1.4 }),
  formError:      t({ fontSize: 12, fontWeight: 400, color: core.action }),
  badge:          t({ fontSize: 11, fontWeight: 500 }),

  // ── Charts ────────────────────────────────────────────────────────────
  chartLegend:    t({ fontSize: 12, fontWeight: 400, color: core.text }),
  /** Segmented control inside a chart card header. */
  segmentedSmall: t({ fontSize: 11, fontWeight: 500 }),
  segmented:      t({ fontSize: 13, fontWeight: 500 }),

  // ── Login (the only screen with its own scale) ────────────────────────
  loginCategory:  t({ fontSize: 13, fontWeight: 600, color: overlay.onColorTextStrong, letterSpacing: '0.08em', textTransform: 'uppercase' }),
  loginTitle:     t({ fontSize: 55, fontWeight: 800, color: core.surface, lineHeight: 1.15, letterSpacing: '-0.02em' }),
  loginDescription: t({ fontSize: 16, fontWeight: 400, color: overlay.onColorText, lineHeight: 1.6 }),
  loginWelcome:   t({ fontSize: 30, fontWeight: 700, color: core.text }),
  loginSubtitle:  t({ fontSize: 15, fontWeight: 400, color: neutral.loginText }),
  loginLabel:     t({ fontSize: 16, fontWeight: 500, color: neutral.loginText }),
  loginInput:     t({ fontSize: 15, fontWeight: 400, color: core.text }),
  loginButton:    t({ fontSize: 16, fontWeight: 700, color: core.surface }),

  /** System name as text in the header, only when there is no logo image. */
  headerWordmark: t({ fontSize: 20, fontWeight: 700, color: core.surface, letterSpacing: '0.12em' }),
} as const;

/**
 * Icon sizes (px) by context. Icons are not text, so they have their own scale.
 */
export const iconSize = {
  sidebar: 18,
  headerBell: 23,
  /** Icon inside a primary/secondary button. */
  button: 12,
  /** Icon inside a compact (22px) control: chart-card filter / export trigger. */
  compactControl: 10,
  kpiCircle: 20,
  notificationCircle: 13,
  sectionTitle: 14,
  emptyState: 18,
  /** Decorative icon of an empty side panel. */
  decorative: 40,
  tableSort: 10,
  tableAction: 14,
  modalClose: 16,
  toastClose: 12,
  toastKind: 15,
  menuItem: 13,
  loadingRing: 22,
  loginField: 15,
} as const;
