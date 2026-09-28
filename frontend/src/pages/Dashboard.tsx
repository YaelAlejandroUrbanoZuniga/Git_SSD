import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding, faColumns, faDownload, faChevronDown, faChevronUp, faChevronRight, faInbox,
  faFileExcel, faFilePdf, faSpinner,
  faFilter, faChartPie, faGlobe, faCalendarDay, faChartLine, faUsers, faBullseye,
} from '@fortawesome/free-solid-svg-icons';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import type { BlacklistedSupplier, CompletedSupplier, StrategyEntry, TrackerSupplier, ScoutingEvent } from '../types';
import { TRACKER_STAGE_CONFIG } from '../constants/stage-config';
import { COMMODITIES } from '../constants/catalogs';
import {
  getBlacklistedSuppliers, getCompletedSuppliers, getTrackerSuppliers,
} from '../services/suppliersService';
import { getScoutingEvents } from '../services/eventsService';
import { getStrategyEntries } from '../services/strategyService';
import { ApiError } from '../services/api.config';
import { useToast } from '../context/ToastContext';
import { LoadingState } from '../components/LoadingState';
import { PAGE_FETCH_DELAY_MS } from '../components/loadingDelays';
import { KpiCard } from '../components/KpiCard';
import { CardHeader } from '../components/CardHeader';
import { moduleIcons } from '../components/moduleIcons';
import {
  REPORT_SECTIONS, describeScope,
  type ChartSectionKey, type ChartSnapshot, type ReportChartImages, type ReportFilter, type ReportPeriod,
  type ReportSectionKey, type ReportSupplier, type SectionScope, type VisualsReport,
} from '../utils/visualsReport';
import { exportVisualsExcel, exportVisualsSectionExcel } from '../utils/visualsReportExcel';
import { exportVisualsPdf, exportVisualsSectionPdf } from '../utils/visualsReportPdf';
import { ACCENT_COLORS, BRAND_COLORS, NEUTRAL_COLORS } from '../constants/designTokens';
import { buyerLabel, matchesUnassignable, optionsWithUnassigned } from '../utils/tracker-helpers';
import { isAchievedSupplier, strategyNeed2026 } from '../utils/strategy-helpers';
import { FilterPanel } from '../components/FilterPanel';
import { FilterField } from '../components/FilterField';
import { CatalogSelect } from '../components/CatalogSelect';

// Only the Chart.js pieces the charts below actually draw (horizontal/vertical
// bars and doughnuts, plus hover tooltips). Registering the whole catalog
// (`chart.js/auto`) would pull in every controller and scale this page never
// renders and undo the bundle saving that motivated the migration. Legends are
// HTML, so the Legend plugin is not registered.
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip);

// Shared axis pieces, so every chart below draws the same dashed grid and tick
// scale. Note that in Chart.js v4 the dash pattern of the *grid lines* lives on
// `border.dash`, not on `grid` — `grid` only carries their colour.
const GRID_LINE = { color: BRAND_COLORS.background };
const GRID_HIDDEN = { display: false };
const GRID_DASH = { dash: [3, 3] };
const tick = (size: number) => ({ font: { size } });
// Count axes never show fractional ticks.
const countTick = (size: number) => ({ ...tick(size), precision: 0 });

// Grow-then-scroll bar lists (country, commodity-as-bars, conversion): the
// canvas gets `rows * rowPx + BAR_LIST_AXIS_PX` of height so every category
// keeps a readable row, and the wrapper caps the visible height and scrolls.
const BAR_LIST_ROW_PX = 24;
const BAR_LIST_AXIS_PX = 32;
const BAR_LIST_MAX_PX = 300;
const barListHeight = (rows: number, rowPx = BAR_LIST_ROW_PX) => rows * rowPx + BAR_LIST_AXIS_PX;

// Structural type for the react-chartjs-2 ref callback below — every Chart.js
// instance (Bar/Doughnut alike) exposes these members: `options`/`resize` are
// all the zoom fix needs, the rest is what `captureChart` reads for the PDF
// export. This avoids importing chart.js's generic `Chart<TType, TData, TLabel>`
// type just to hold a ref.
type ChartLike = {
  options: { devicePixelRatio?: number; indexAxis?: string };
  resize: () => void;
  update: (mode?: 'none') => void;
  stop: () => void;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  chartArea: { left: number; right: number; top: number; bottom: number };
  scales: Record<string, { getPixelForValue: (value: number) => number } | undefined>;
  data: { labels?: unknown[] };
};

/**
 * Pin every mounted chart's cached `devicePixelRatio` to the live ratio and
 * rebuild the backing store of any whose canvas no longer matches it; returns
 * the ratio applied. See `Dashboard` below for why the option has to be
 * overwritten rather than left to Chart.js's own (cached) resolution.
 *
 * Safe to call redundantly: when a canvas already matches, `retinaScale()`
 * reports no change and `_resize` returns without re-rendering. The assignment
 * itself is durable — Chart.js's options proxy writes through to
 * `config.options`, which `Chart#update()` rebuilds its resolver from, so a
 * later data or options update cannot restore the scriptable default.
 */
function syncChartsToDpr(charts: (ChartLike | null)[]) {
  const dpr = window.devicePixelRatio;
  charts.forEach(chart => {
    if (!chart) return;
    chart.options.devicePixelRatio = dpr;
    chart.resize();
  });
  return dpr;
}

/** Device pixels per CSS pixel for exported chart images — sharp in print at any page zoom. */
const EXPORT_DPR = 3;

/** Each chart position's slot in `chartRefs` — what the exports capture from. */
const CHART_SLOTS: Record<ChartSectionKey, number> = {
  stages: 0, commodities: 1, countries: 2, eventStatus: 3, conversion: 4, strategy: 5,
};

/**
 * Re-renders one live chart at `EXPORT_DPR` and copies it onto an opaque white
 * canvas (the on-screen canvas is transparent), so the PDF gets the exact
 * colours and layout on screen at print resolution. For a horizontal bar list
 * it also records the y midpoints between categories, where the PDF may split
 * a chart taller than a page without cutting through a bar.
 *
 * Leaves the chart pinned to `EXPORT_DPR`: the caller re-pins every chart to
 * the live ratio once all snapshots are taken (`syncChartsToDpr`).
 */
function captureChart(chart: ChartLike | null, centerLabel?: { value: string; caption: string }): ChartSnapshot | null {
  if (!chart) return null;
  // Finish any running animation first, so the render below is synchronous
  // and shows final values rather than a mid-transition frame.
  chart.stop();
  chart.options.devicePixelRatio = EXPORT_DPR;
  chart.resize();
  chart.update('none');

  const source = chart.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = BRAND_COLORS.cards;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0);

  let cuts: number[] = [];
  const yScale = chart.scales.y;
  if (chart.options.indexAxis === 'y' && yScale) {
    const centers = (chart.data.labels ?? []).map((_, i) => yScale.getPixelForValue(i));
    cuts = centers.slice(1).map((c, i) => (centers[i] + c) / 2);
  }
  const { left, right, top, bottom } = chart.chartArea;
  return {
    canvas,
    cssWidth: chart.width,
    cssHeight: chart.height,
    scale: source.width / chart.width,
    cuts,
    centerLabel: centerLabel && { ...centerLabel, x: (left + right) / 2, y: (top + bottom) / 2 },
  };
}

// ── Period filter ────────────────────────────────────────────────────────────

type PeriodKey = 'thisYear' | 'last30' | 'last3m' | 'last6m' | 'prevYear' | 'custom';

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'thisYear', label: 'This year' },
  { key: 'last30', label: 'Last 30 days' },
  { key: 'last3m', label: 'Last 3 months' },
  { key: 'last6m', label: 'Last 6 months' },
  { key: 'prevYear', label: 'Previous year' },
  { key: 'custom', label: 'Custom range' },
];

/** Inclusive range of local calendar days, both ends as 'YYYY-MM-DD'. */
interface DateRange { from: string; to: string }

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;
const HAS_FOUR_DIGIT_YEAR = /\b\d{4}\b/;

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Same calendar day `months` back, clamped to the target month's last day (31 Mar − 1 → 28/29 Feb). */
function monthsBefore(d: Date, months: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() - months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), lastDay));
}

/**
 * Normalises a stored date string (the columns are free-text NVARCHAR(30)) to a
 * 'YYYY-MM-DD' key, or null when it isn't a real date. A leading ISO date is
 * taken as-is — including the date part of an ISO timestamp, so no timezone
 * shift can move it to the neighbouring day — and rejected if it rolls over
 * (e.g. '2026-02-31'). Anything else must carry a four-digit year before it is
 * handed to `Date.parse`, which otherwise accepts junk like '1' or 'TBC 2'.
 */
function parseDateKey(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  const iso = ISO_DATE_PREFIX.exec(text);
  if (iso) {
    const [, y, m, d] = iso;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return date.getMonth() === Number(m) - 1 && date.getDate() === Number(d) ? `${y}-${m}-${d}` : null;
  }
  if (!HAS_FOUR_DIGIT_YEAR.test(text)) return null;
  const time = Date.parse(text);
  return Number.isNaN(time) ? null : toDateKey(new Date(time));
}

/** '2026-01-01' → '1 Jan 2026'. */
function formatDateKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/**
 * The active range for a period, evaluated against `today` on every render so
 * "This year" rolls over on 1 Jan without a reload. Returns null for an
 * incomplete or inverted custom range, which the page treats as "no data"
 * rather than keeping the previous period's numbers.
 */
function resolvePeriod(period: PeriodKey, customFrom: string, customTo: string, today: Date): DateRange | null {
  const to = toDateKey(today);
  const year = today.getFullYear();
  switch (period) {
    case 'thisYear': return { from: `${year}-01-01`, to };
    case 'last30': return { from: toDateKey(new Date(year, today.getMonth(), today.getDate() - 30)), to };
    case 'last3m': return { from: toDateKey(monthsBefore(today, 3)), to };
    case 'last6m': return { from: toDateKey(monthsBefore(today, 6)), to };
    case 'prevYear': return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
    case 'custom': {
      const from = parseDateKey(customFrom);
      const until = parseDateKey(customTo);
      return from && until && from <= until ? { from, to: until } : null;
    }
  }
}

/** Items whose date falls inside `range`, plus how many had no usable date at all. */
function filterByDate<T>(items: T[], getDate: (item: T) => string | null | undefined, range: DateRange | null) {
  const inRange: T[] = [];
  let undated = 0;
  for (const item of items) {
    const key = parseDateKey(getDate(item));
    if (key === null) undated++;
    else if (range && key >= range.from && key <= range.to) inRange.push(item);
  }
  return { inRange, undated };
}

// ── Derivations ──────────────────────────────────────────────────────────────

/**
 * N distinct colours for N categories. Hues step by the golden angle, which
 * never lands on a hue it already used, and the lightness cycles through three
 * bands so hue neighbours also differ in value. The hue wheel skips 225–255°,
 * the indigo band the visual standard bans (see `constants/designTokens.ts`).
 */
function categoricalPalette(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const h = (193 + i * 137.508) % 330;
    const hue = h < 225 ? h : h + 30;
    return `hsl(${hue.toFixed(1)}, 70%, ${[42, 55, 34][i % 3]}%)`;
  });
}

function countBy<T>(items: T[], key: (item: T) => string): [string, number][] {
  const counts: Record<string, number> = {};
  items.forEach(item => { const k = key(item); counts[k] = (counts[k] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

interface DashboardSource {
  tracker: TrackerSupplier[];
  blacklisted: BlacklistedSupplier[];
  completed: CompletedSupplier[];
  events: ScoutingEvent[];
}

const EMPTY_SOURCE: DashboardSource = { tracker: [], blacklisted: [], completed: [], events: [] };

/** An in-period supplier with the stage it is counted under on Visuals. */
interface StagedSupplier { s: TrackerSupplier; stage: string }

/**
 * The global Period pass — the only derivation every card shares. Suppliers
 * are filtered by `onboardingDate`, events by `dateStart`; the KPIs, the
 * undated note and the report's supplier list read this directly, and each
 * card's `derive*` function below narrows these in-period sets further by that
 * card's own filters. A card filter therefore never widens the period, and no
 * card's filters reach another card. `period` is carried along only so each
 * card can describe its own scope (`describeScope`) in the exports.
 */
function buildPeriodData(source: DashboardSource, range: DateRange | null, period: ReportPeriod) {
  const byOnboarding = (s: TrackerSupplier) => s.onboardingDate;
  const tracker = filterByDate(source.tracker, byOnboarding, range);
  const blacklisted = filterByDate(source.blacklisted, byOnboarding, range);
  const completed = filterByDate(source.completed, byOnboarding, range);
  const events = filterByDate(source.events, e => e.dateStart, range);

  const activeTracker = tracker.inRange;
  const suppliers: StagedSupplier[] = [
    ...activeTracker.map(s => ({ s, stage: s.stage as string })),
    ...blacklisted.inRange.map(s => ({ s, stage: 'Blacklisted' })),
    ...completed.inRange.map(s => ({ s, stage: 'Completed' })),
  ];

  // The in-period suppliers of each stage, in `TRACKER_STAGE_CONFIG` order.
  // "Suppliers by Stage" and "Summary by Buyer" both read these buckets, so
  // their per-stage totals tie out whenever their card filters agree.
  const stageBuckets = TRACKER_STAGE_CONFIG.map(cfg => ({
    cfg,
    suppliers: cfg.name === 'Blacklisted'
      ? blacklisted.inRange
      : cfg.name === 'Completed'
      ? completed.inRange
      : activeTracker.filter(s => s.stage === cfg.name),
  }));

  // Colours are assigned once, by the unfiltered in-period ranking, so a
  // commodity keeps its colour while the commodity card is being filtered.
  const commodityRanking = countBy(suppliers, x => x.s.commodity);
  const palette = categoricalPalette(commodityRanking.length);
  const commodityColors = new Map(commodityRanking.map(([name], i) => [name, palette[i]]));

  // `EventSupplierEntry.supplierId` is the supplier's id (FK to T_Supplier), so
  // an event reaches its suppliers' commodities through this lookup. It is
  // built from every fetched supplier, not only in-period ones: a supplier's
  // commodity doesn't depend on when it was onboarded, and the event is the
  // thing the period applies to on the event cards.
  const commodityBySupplierId = new Map(
    [...source.tracker, ...source.blacklisted, ...source.completed].map(s => [s.id, s.commodity]),
  );

  return {
    period, suppliers, stageBuckets, commodityColors, commodityBySupplierId,
    activeTracker, events: events.inRange,
    excludedSuppliers: tracker.undated + blacklisted.undated + completed.undated,
    excludedEvents: events.undated,
  };
}

type PeriodData = ReturnType<typeof buildPeriodData>;

// ── Per-card filters ─────────────────────────────────────────────────────────
// Each card owns one `CardFilters` value holding only the keys it offers; ''
// (or a missing key) means "not filtered". They are independent React state,
// so filtering one card never changes another card's numbers.

type CardFilterKey = 'stage' | 'commodity' | 'buyer';
type CardFilters = Partial<Record<CardFilterKey, string>>;

const activeFilterCount = (f: CardFilters) => Object.values(f).filter(Boolean).length;

/** Display order and label of each filter key in an export's filter sentence. */
const CARD_FILTER_LABELS: [CardFilterKey, string][] = [['stage', 'Stage'], ['commodity', 'Commodity'], ['buyer', 'Buyer']];

/**
 * A card's derived data plus its `SectionScope` — the same filter state that
 * narrowed `rows`, as structured data and as the sentence the exports print.
 */
interface CardSection<T> { rows: T; scope: SectionScope }

function cardSection<T>(p: PeriodData, f: CardFilters, rows: T, note?: string): CardSection<T> {
  const filters: ReportFilter[] = CARD_FILTER_LABELS
    .filter(([key]) => f[key])
    .map(([key, label]) => ({ label, value: f[key] as string }));
  return { rows, scope: describeScope(p.period, filters, note) };
}

/** Buyer goes through `matchesUnassignable`, so its "Unassigned" option matches blank buyers. */
function matchesSupplier({ s, stage }: StagedSupplier, f: CardFilters): boolean {
  return (!f.stage || stage === f.stage)
    && (!f.commodity || s.commodity === f.commodity)
    && (!f.buyer || matchesUnassignable(s.buyer, f.buyer));
}

function deriveStageData(p: PeriodData, f: CardFilters) {
  return cardSection(p, f, p.stageBuckets.map(({ cfg, suppliers }) => ({
    name: cfg.name,
    count: suppliers.filter(s => matchesSupplier({ s, stage: cfg.name }, f)).length,
    color: cfg.color,
  })));
}

function deriveCommodityData(p: PeriodData, f: CardFilters) {
  return cardSection(p, f, countBy(p.suppliers.filter(x => matchesSupplier(x, f)), x => x.s.commodity)
    .map(([name, value]) => ({ name, value, color: p.commodityColors.get(name) ?? BRAND_COLORS.sidebar })));
}

function deriveCountryData(p: PeriodData, f: CardFilters) {
  return cardSection(p, f, countBy(p.suppliers.filter(x => matchesSupplier(x, f)), x => x.s.country)
    .map(([name, count]) => ({ name, count })));
}

/**
 * An event's supplier entries, narrowed to the suppliers carrying
 * `f.commodity` (all of them when unset). An entry whose supplier isn't among
 * the fetched lists has no known commodity, so it matches no commodity filter.
 */
function eventEntries(evt: ScoutingEvent, p: PeriodData, f: CardFilters) {
  return f.commodity
    ? evt.supplierEntries.filter(en => p.commodityBySupplierId.get(en.supplierId) === f.commodity)
    : evt.supplierEntries;
}

/** With a commodity set, an event counts when at least one of its suppliers carries it. */
function deriveEventStatusData(p: PeriodData, f: CardFilters) {
  const evts = f.commodity ? p.events.filter(e => eventEntries(e, p, f).length > 0) : p.events;
  return cardSection(p, f, [
    { name: 'Upcoming', value: evts.filter(e => e.status === 'Upcoming').length, color: '#EC4899' },
    { name: 'Ongoing', value: evts.filter(e => e.status === 'Ongoing').length, color: ACCENT_COLORS.info },
    { name: 'Completed', value: evts.filter(e => e.status === 'Completed').length, color: '#6ABF4B' },
    { name: 'Canceled', value: evts.filter(e => e.status === 'Canceled').length, color: '#000000' },
  ]);
}

/**
 * Every non-canceled event that evaluated at least one supplier — an Ongoing
 * event's partial funnel is still real data. With a commodity set, each
 * event's funnel counts only that commodity's suppliers, and an event that
 * evaluated none of them drops out.
 */
function deriveConversionData(p: PeriodData, f: CardFilters) {
  return cardSection(p, f, p.events
    .filter(e => e.status !== 'Canceled')
    .map(evt => {
      const entries = eventEntries(evt, p, f);
      const evaluated = entries.length;
      const included = entries.filter(e => e.result === 'Included').length;
      return { name: evt.name, evaluated, included, pct: evaluated > 0 ? Math.round((included / evaluated) * 100) : 0 };
    })
    .filter(c => c.evaluated > 0));
}

/** Same buckets as `deriveStageData` — just bucketed by buyer within each stage instead of collapsed to a count. */
function deriveBuyerStageGroups(p: PeriodData, f: CardFilters) {
  return cardSection(p, f, p.stageBuckets.map(({ cfg, suppliers }) => {
    const matching = suppliers.filter(s => matchesSupplier({ s, stage: cfg.name }, f));
    const counts: Record<string, number> = {};
    matching.forEach(s => {
      const buyer = buyerLabel(s);
      counts[buyer] = (counts[buyer] || 0) + 1;
    });
    const rows = Object.entries(counts)
      .map(([buyer, count]) => ({ buyer, count }))
      .sort((a, b) => b.count - a.count || a.buyer.localeCompare(b.buyer));
    return { stage: cfg.name, color: cfg.color, total: matching.length, rows };
  }));
}

/** The exports' caveat for the Strategy card — its on-screen caption, minus "above". */
const STRATEGY_PERIOD_NOTE = '"Need 2026" is the fixed strategy target and does not change with the Period; '
  + 'only "Achieved" is narrowed to suppliers onboarded in the selected period.';

/**
 * Per-commodity 2026 strategy need vs. suppliers achieved, using the exact
 * same `strategyNeed2026`/`isAchievedSupplier` rules StrategyPage uses so the
 * two pages can never disagree on these numbers. "Need" is the fixed 2026
 * target and ignores the period entirely (it isn't a dated event); only
 * "Achieved" is narrowed to the in-period suppliers, same as every other card
 * on this page. A commodity is dropped when it has neither a need nor
 * anything achieved — showing an empty 0/0 pair would just be noise. Sorted
 * by remaining gap (need − achieved) descending, the same priority order
 * `RemainingBadge` communicates on Strategy.
 */
function deriveStrategyProgressData(p: PeriodData, entries: StrategyEntry[]) {
  const achievedByCommodity: Record<string, number> = {};
  p.suppliers.forEach(({ s, stage }) => {
    if (isAchievedSupplier(stage, s.intelex_l2Real)) {
      achievedByCommodity[s.commodity] = (achievedByCommodity[s.commodity] || 0) + 1;
    }
  });
  const rows = COMMODITIES
    .map(commodity => {
      const need = strategyNeed2026(entries.find(e => e.commodity === commodity));
      const achieved = achievedByCommodity[commodity] ?? 0;
      return { commodity, need, achieved, gap: need - achieved };
    })
    .filter(r => r.need > 0 || r.achieved > 0)
    .sort((a, b) => b.gap - a.gap || a.commodity.localeCompare(b.commodity));
  return cardSection(p, {}, rows, STRATEGY_PERIOD_NOTE);
}

/**
 * The raw in-period list behind "Total Suppliers" (one row per supplier, so its
 * length always equals the KPI), for the report's "Suppliers" sheet. Period
 * only — like the KPIs, it describes the whole system, not any one card.
 */
function deriveSupplierRows(p: PeriodData): CardSection<ReportSupplier[]> {
  const stageOrder = (stage: string) => {
    const i = TRACKER_STAGE_CONFIG.findIndex(cfg => cfg.name === stage);
    return i === -1 ? TRACKER_STAGE_CONFIG.length : i;
  };
  return cardSection(p, {}, p.suppliers
    .map(({ s, stage }) => ({
      folio: s.folio, name: s.name, stage, commodity: s.commodity, country: s.country,
      buyer: buyerLabel(s), onboardingDate: parseDateKey(s.onboardingDate) ?? '',
    }))
    .sort((a, b) => stageOrder(a.stage) - stageOrder(b.stage) || a.name.localeCompare(b.name)));
}

/**
 * Filter options, built from the in-period sets (not from any card's filtered
 * view) with the same conventions as the tracker pages: sorted distinct
 * commodities, `optionsWithUnassigned` for buyers, stages in pipeline order.
 */
function buildFilterOptions(p: PeriodData) {
  const eventCommodities = p.events.flatMap(e => e.supplierEntries
    .map(en => p.commodityBySupplierId.get(en.supplierId))
    .filter(c => c !== undefined));
  return {
    stages: TRACKER_STAGE_CONFIG.map(cfg => cfg.name),
    commodities: [...new Set(p.suppliers.map(x => x.s.commodity))].sort(),
    buyers: optionsWithUnassigned(p.suppliers.map(x => x.s.buyer)),
    eventCommodities: [...new Set(eventCommodities)].sort(),
  };
}

const pctOf = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);
const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ── Presentational helpers ───────────────────────────────────────────────────

type ExportFormat = 'xlsx' | 'pdf';

const EXPORT_OPTIONS: { format: ExportFormat; label: string; icon: typeof faFileExcel; color: string }[] = [
  { format: 'xlsx', label: 'Excel (.xlsx)', icon: faFileExcel, color: '#6ABF4B' },
  { format: 'pdf', label: 'PDF (.pdf)', icon: faFilePdf, color: BRAND_COLORS.accentRed },
];

/** Which download is being built: the whole report, or one card. */
type ExportTarget = 'report' | ReportSectionKey;

/**
 * An Excel/PDF download menu, in two forms: the header "Export report" button,
 * or — `compact` — an icon-only trigger at the height of the card filter
 * trigger, for one card's download. Closes on a pick, an outside click or
 * Escape. While this menu's file is being built (`busy`) its trigger shows a
 * spinner; while any other download runs (`locked`) it ignores clicks, so
 * only one export is ever in flight. `caption` (a card's filter sentence) is
 * shown at the top of the compact menu, so the user sees exactly what the
 * file will state before picking a format.
 */
function ExportMenu({ disabled, busy, locked = false, onExport, compact = false, label = 'Export report', caption, disabledTitle }: {
  disabled: boolean;
  busy: ExportFormat | null;
  locked?: boolean;
  onExport: (format: ExportFormat) => void;
  compact?: boolean;
  label?: string;
  caption?: string;
  disabledTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const inactive = disabled || locked || busy !== null;
  const icon = <FontAwesomeIcon icon={busy ? faSpinner : faDownload} spin={busy !== null} style={{ fontSize: compact ? 10 : 12 }} />;
  return (
    // The tooltip sits on the wrapper: a disabled <button> fires no pointer
    // events, so some browsers never show its own `title`.
    <div ref={rootRef} style={{ position: 'relative' }} title={disabled ? disabledTitle : compact ? label : undefined}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={inactive}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={compact ? label : undefined}
        style={{
          display: 'flex', alignItems: 'center',
          ...(compact
            ? { height: 22, padding: '0 8px', borderRadius: 4, color: BRAND_COLORS.sidebar }
            : { gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 6, color: '#000000' }),
          border: `1px solid ${NEUTRAL_COLORS.border}`,
          backgroundColor: BRAND_COLORS.cards,
          cursor: disabled ? 'not-allowed' : busy || locked ? 'progress' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'box-shadow 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.13)')}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
      >
        {icon}
        {!compact && (
          <>
            {busy ? 'Exporting…' : label}
            <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 9, color: BRAND_COLORS.sidebar, marginLeft: 2 }} />
          </>
        )}
      </button>
      {open && !inactive && (
        <div role="menu" aria-label={label} style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 20, minWidth: 180,
          width: caption ? 260 : undefined,
          backgroundColor: BRAND_COLORS.cards, border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)', padding: 4,
        }}>
          {caption && (
            <p style={{
              margin: 0, padding: '6px 12px 8px', fontSize: 11, lineHeight: 1.4, color: BRAND_COLORS.sidebar,
              borderBottom: `1px solid ${NEUTRAL_COLORS.borderLight}`, marginBottom: 4,
            }}>
              {caption}
            </p>
          )}
          {EXPORT_OPTIONS.map((opt, i) => (
            <button
              key={opt.format}
              role="menuitem"
              autoFocus={i === 0}
              onClick={() => { setOpen(false); onExport(opt.format); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '8px 12px', fontSize: 13, color: '#000000', textAlign: 'left',
                border: 'none', borderRadius: 4, backgroundColor: 'transparent', cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = NEUTRAL_COLORS.panelBg)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              onFocus={e => (e.currentTarget.style.backgroundColor = NEUTRAL_COLORS.panelBg)}
              onBlur={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <FontAwesomeIcon icon={opt.icon} style={{ fontSize: 14, color: opt.color, width: 14 }} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChartTypeSelector({ options, active, onChange }: { options: string[]; active: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 0, borderRadius: 4, overflow: 'hidden' }}>
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            padding: '4px 10px', fontSize: 11, fontWeight: 500, border: 'none', cursor: 'pointer',
            backgroundColor: active === opt ? BRAND_COLORS.accentRed : BRAND_COLORS.background,
            color: active === opt ? BRAND_COLORS.cards : BRAND_COLORS.sidebar,
            transition: 'all 0.15s',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

/**
 * Stand-in for a chart whose dataset is empty for the selected period — or,
 * when `filtered`, for the card's own filters on top of it.
 */
function ChartEmpty({ height, filtered = false }: { height: number; filtered?: boolean }) {
  return (
    <div style={{
      height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
      color: BRAND_COLORS.sidebar,
    }}>
      <FontAwesomeIcon icon={faInbox} style={{ fontSize: 18 }} />
      <span style={{ fontSize: 12 }}>{filtered ? 'No data matches these filters' : 'No data for this period'}</span>
    </div>
  );
}

interface CardFilterField { key: CardFilterKey; label: string; options: readonly string[]; placeholder: string }

/**
 * One card's own filters: the shared `FilterPanel` (compact trigger, so it fits
 * beside a `ChartTypeSelector` or legend) holding a `FilterField`-wrapped
 * `CatalogSelect` per field — the same composition as the tracker pages.
 * "Clear all" resets only this card's value.
 */
function CardFilterPanel({ fields, value, onChange }: {
  fields: CardFilterField[];
  value: CardFilters;
  onChange: (next: CardFilters) => void;
}) {
  return (
    <FilterPanel compact activeCount={activeFilterCount(value)} onClearAll={() => onChange({})} panelWidth={fields.length > 1 ? 320 : 220}>
      {fields.map(field => (
        <FilterField key={field.key} label={field.label}>
          <CatalogSelect
            value={value[field.key] ?? ''}
            onChange={v => onChange({ ...value, [field.key]: v })}
            options={field.options}
            placeholder={field.placeholder}
          />
        </FilterField>
      ))}
    </FilterPanel>
  );
}

/** Caps a grow-with-rows chart or table at `BAR_LIST_MAX_PX` and scrolls the rest. */
function ScrollBox({ children }: { children: React.ReactNode }) {
  return <div style={{ maxHeight: BAR_LIST_MAX_PX, overflowY: 'auto', overflowX: 'hidden' }}>{children}</div>;
}

const inputStyle: React.CSSProperties = {
  fontSize: 12, padding: '4px 8px', borderRadius: 4,
  border: `1px solid ${NEUTRAL_COLORS.border}`, backgroundColor: BRAND_COLORS.cards, color: '#000000',
};

const cardStyle: React.CSSProperties = {
  minWidth: 0, backgroundColor: BRAND_COLORS.cards, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24,
};
// The header row wraps only as a fallback (a very narrow card): the controls
// group then drops below the title, still right-aligned by its auto margin.
const cardHeaderStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: 8,
};
// Right-hand side of a card header: chart-type toggle / legend, then the card's
// filter trigger. Its `marginBottom` mirrors `CardHeader`'s own, so the two
// margin boxes centre alike and the controls line up with the title text.
const cardControlsStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', marginBottom: 16,
};

export function Dashboard() {
  const navigate = useNavigate();
  const uiToast = useToast();
  const [source, setSource] = useState(EMPTY_SOURCE);
  // Strategy needs are not period-scoped (see "Strategy: Need vs. Achieved by
  // Commodity" below), so they're kept separate from `source` rather than
  // folded into `buildPeriodData`, which only ever narrows by date.
  const [strategyEntries, setStrategyEntries] = useState<StrategyEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getTrackerSuppliers(), getBlacklistedSuppliers(), getCompletedSuppliers(), getScoutingEvents(),
      getStrategyEntries(),
    ])
      .then(([tracker, blacklisted, completed, events, entries]) => {
        if (!cancelled) {
          setSource({ tracker, blacklisted, completed, events });
          setStrategyEntries(entries);
        }
      })
      .catch(err => {
        if (!cancelled) {
          uiToast.systemError(err instanceof ApiError ? err.message : 'Could not load the dashboard data.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uiToast]);

  const [exporting, setExporting] = useState<{ target: ExportTarget; format: ExportFormat } | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('thisYear');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [chartBType, setChartBType] = useState('Donut');
  const [chartEType, setChartEType] = useState('Bar');

  // One independent filter value per card (see "Per-card filters" above).
  const [stageFilters, setStageFilters] = useState<CardFilters>({});
  const [commodityFilters, setCommodityFilters] = useState<CardFilters>({});
  const [countryFilters, setCountryFilters] = useState<CardFilters>({});
  const [eventStatusFilters, setEventStatusFilters] = useState<CardFilters>({});
  const [conversionFilters, setConversionFilters] = useState<CardFilters>({});
  const [buyerFilters, setBuyerFilters] = useState<CardFilters>({});

  // Recomputed on every render from the raw fetch and the live range — never
  // cached per period — so the page cannot show another period's numbers.
  // Period first, then each card's own filters on that in-period set.
  const range = resolvePeriod(period, customFrom, customTo, new Date());
  const periodLabel = PERIOD_OPTIONS.find(o => o.key === period)?.label ?? period;
  const rangeDisplay = range ? `${formatDateKey(range.from)} – ${formatDateKey(range.to)}` : 'invalid range';
  const periodData = buildPeriodData(source, range, { label: periodLabel, display: rangeDisplay });
  const { excludedSuppliers, excludedEvents } = periodData;
  const totalSuppliers = periodData.suppliers.length;
  const inTrackerActive = periodData.activeTracker.length;
  // Each card's rows plus its `scope` (filters + sentence), which only the
  // exports read; the render uses the rows.
  const { rows: supplierRows, scope: supplierScope } = deriveSupplierRows(periodData);
  const { rows: stageData, scope: stageScope } = deriveStageData(periodData, stageFilters);
  const { rows: commodityData, scope: commodityScope } = deriveCommodityData(periodData, commodityFilters);
  const { rows: countryData, scope: countryScope } = deriveCountryData(periodData, countryFilters);
  const { rows: eventStatusData, scope: eventStatusScope } = deriveEventStatusData(periodData, eventStatusFilters);
  const { rows: conversionData, scope: conversionScope } = deriveConversionData(periodData, conversionFilters);
  const { rows: buyerStageGroups, scope: buyerScope } = deriveBuyerStageGroups(periodData, buyerFilters);
  const { rows: strategyProgressData, scope: strategyScope } = deriveStrategyProgressData(periodData, strategyEntries);
  // Share denominators of the two share cards: their own filtered totals, so
  // the donut centre and every percentage describe what the card shows.
  const commodityTotal = commodityData.reduce((a, d) => a + d.value, 0);
  const countryTotal = countryData.reduce((a, d) => a + d.count, 0);

  const filterOptions = buildFilterOptions(periodData);
  const stageField: CardFilterField = { key: 'stage', label: 'Stage', options: filterOptions.stages, placeholder: 'All stages' };
  const commodityField: CardFilterField = { key: 'commodity', label: 'Commodity', options: filterOptions.commodities, placeholder: 'All commodities' };
  const buyerField: CardFilterField = { key: 'buyer', label: 'Buyer', options: filterOptions.buyers, placeholder: 'All buyers' };
  const eventCommodityField: CardFilterField = { ...commodityField, options: filterOptions.eventCommodities };

  const [expandedBuyerStages, setExpandedBuyerStages] = useState<Set<string>>(new Set());
  const toggleBuyerStage = (stage: string) => setExpandedBuyerStages(prev => {
    const next = new Set(prev);
    if (next.has(stage)) next.delete(stage); else next.add(stage);
    return next;
  });
  function navigateToBuyer(stage: string, buyer: string) {
    const query = `?buyer=${encodeURIComponent(buyer)}`;
    if (stage === 'Completed') navigate(`/tracker/completed${query}`);
    else if (stage === 'Blacklisted') navigate(`/tracker/blacklisted${query}`);
    else navigate(`/tracker/stage/${encodeURIComponent(stage)}${query}`);
  }

  // One ref slot per chart *position* (stage / commodity / country / events /
  // conversion / strategy progress), not per JSX block — a toggle group's
  // alternates (e.g. the commodity Donut vs Bar) never mount at once, so they
  // share a slot; whichever is currently on screen ends up in it.
  const chartRefs = useRef<(ChartLike | null)[]>([]);
  // The ratio every mounted chart is currently pinned to. Shared by the two
  // paths that can change it — a chart mounting, and the ratio itself changing
  // — so neither can skip work believing the other already covered it.
  const appliedDpr = useRef(window.devicePixelRatio);

  function chartRef(idx: number) {
    return (instance: ChartLike | null | undefined) => {
      chartRefs.current[idx] = instance ?? null;
      // The *initial* half of the DPR fix (the effect below is the other half,
      // and only ever corrects a later *change*). Without this, nothing asserted
      // the ratio a chart was born with: a chart constructed while the browser
      // was already at 110%, or one whose canvas was measured before layout
      // settled, came out blurry and stayed that way — there was no change left
      // to detect, only a wrong initial state.
      //
      // This is the exact moment to do it: react-chartjs-2 invokes the forwarded
      // ref from inside its own `renderChart`, immediately after `new Chart(…)`
      // returns, so the instance is fully built and the ref fires on every path
      // that constructs one (first mount, a type toggle destroying and rebuilding
      // a slot, a chart coming back from its empty state after a period change)
      // and on no other render. It is a manual call rather than a React-managed
      // DOM ref, so a fresh closure per render does not cause spurious
      // re-attachments.
      //
      // Every chart is re-pinned, not just this one, which keeps the invariant
      // whole: after any mount, all slots and `appliedDpr` agree with the live
      // ratio. That matters for the guard in `syncDevicePixelRatio` — if a late
      // mount left `appliedDpr` behind, zooming *back* to the recorded value
      // would be dismissed as "no change" and leave the charts blurry.
      if (instance) appliedDpr.current = syncChartsToDpr(chartRefs.current);
    };
  }

  useEffect(() => {
    // Browser zoom (Ctrl +/-) changes `window.devicePixelRatio`. A canvas whose
    // backing store is not rebuilt at the new ratio draws blurry and can spill
    // past its card, because its pixel size still belongs to the previous zoom.
    //
    // The root cause is NOT the resize trigger — it is that `resize()` alone
    // cannot fix it. `Chart#_resize` reads
    // `options.devicePixelRatio || platform.getDevicePixelRatio()`, and
    // `devicePixelRatio` defaults to a *scriptable* that returns the live ratio.
    // Chart.js resolves scriptables once and caches the result, so
    // `options.devicePixelRatio` is frozen at whatever the ratio was when the
    // chart was constructed. Being a truthy number it then shadows the live
    // platform getter forever: `retinaScale()` is handed the stale ratio, finds
    // the canvas already matches it, returns false, and `_resize` bails before
    // re-rendering. Verified against chart.js 4.5.1 by driving a real Chromium
    // at deviceScaleFactor 1 -> 2: plain `resize()` leaves canvas.width at the
    // old value, whereas refreshing this option first makes it follow the ratio.
    //
    // So the fix is to overwrite the cached ratio before resizing. Assigning a
    // concrete number also makes this the single source of truth for DPR — the
    // stale-cache path that produced the bug can no longer be consulted.
    //
    // Trigger: `matchMedia('(resolution: Ndppx)')` reports exactly when the
    // ratio leaves N, which is the precise signal; window 'resize' is kept
    // alongside it because a real zoom also relayouts the viewport and not every
    // browser fires both. That is not a double resize — `syncDevicePixelRatio`
    // returns early unless the ratio actually changed (the same guard Chart.js
    // uses internally), so whichever trigger arrives second does no work.
    //
    // The baseline it compares against is `appliedDpr`, not a local captured
    // here: this effect runs once, on mount, while the charts are still behind
    // the `loading` gate, so a value captured at that point would describe a
    // moment when `chartRefs.current` was empty. The ref callback owns the
    // initial pinning and keeps `appliedDpr` current for both paths.
    let query: MediaQueryList | null = null;

    function syncDevicePixelRatio() {
      if (window.devicePixelRatio === appliedDpr.current) return;
      appliedDpr.current = syncChartsToDpr(chartRefs.current);
    }
    function onDprChange() {
      syncDevicePixelRatio();
      reArm();
    }
    function reArm() {
      // One-shot: a query only reports leaving the ratio it was built for, so
      // each change re-arms against the ratio we just landed on.
      query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      query.addEventListener('change', onDprChange, { once: true });
    }

    reArm();
    window.addEventListener('resize', syncDevicePixelRatio);
    return () => {
      query?.removeEventListener('change', onDprChange);
      window.removeEventListener('resize', syncDevicePixelRatio);
    };
  }, []);

  function handlePeriodChange(next: PeriodKey) {
    // Seed a first custom range with whatever was on screen, so switching to
    // Custom starts from the current numbers instead of an empty range.
    if (next === 'custom' && range && !customFrom && !customTo) {
      setCustomFrom(range.from);
      setCustomTo(range.to);
    }
    setPeriod(next);
  }

  const hasStageData = stageData.some(s => s.count > 0);
  const hasCommodityData = commodityData.length > 0;
  const hasCountryData = countryData.length > 0;
  const hasEventStatusData = eventStatusData.some(d => d.value > 0);
  const hasConversionData = conversionData.length > 0;
  const hasBuyerData = buyerStageGroups.some(g => g.total > 0);
  const hasStrategyProgressData = strategyProgressData.length > 0;
  const hasAnyReportData = hasStageData || hasCommodityData || hasCountryData || hasStrategyProgressData
    || hasEventStatusData || hasConversionData || hasBuyerData;
  const hasSectionData: Record<ReportSectionKey, boolean> = {
    stages: hasStageData, commodities: hasCommodityData, countries: hasCountryData, strategy: hasStrategyProgressData,
    eventStatus: hasEventStatusData, conversion: hasConversionData, buyerGroups: hasBuyerData,
  };
  const sectionScopes: Record<ReportSectionKey, SectionScope> = {
    stages: stageScope, commodities: commodityScope, countries: countryScope, strategy: strategyScope,
    eventStatus: eventStatusScope, conversion: conversionScope, buyerGroups: buyerScope,
  };

  const excludedNote = [
    excludedSuppliers > 0 ? plural(excludedSuppliers, 'supplier') : null,
    excludedEvents > 0 ? plural(excludedEvents, 'event') : null,
  ].filter(Boolean).join(' and ');
  const excludedSentence = excludedNote
    ? `${excludedNote} without a valid date ${excludedSuppliers + excludedEvents === 1 ? 'is' : 'are'} not counted in any period.`
    : null;

  /**
   * Everything below is the render's own period- and card-filtered data, so
   * every file matches the screen exactly — nothing is re-fetched or
   * re-derived. A single-card download uses this same object and picks its
   * section out, so it can never disagree with the full report either.
   */
  function buildReport(validRange: DateRange): VisualsReport {
    return {
      periodLabel,
      range: { ...validRange, display: rangeDisplay },
      generatedAt: new Date(),
      kpis: { totalSuppliers, activeTracker: inTrackerActive },
      excludedNote: excludedSentence,
      stages: stageData,
      commodities: commodityData,
      countries: countryData,
      strategy: strategyProgressData,
      eventStatus: eventStatusData,
      conversion: conversionData,
      buyerGroups: buyerStageGroups,
      suppliers: supplierRows,
      scopes: { ...sectionScopes, suppliers: supplierScope },
    };
  }

  /**
   * Snapshot of one chart position for the PDF; null when it isn't mounted
   * (empty, or Geography in Table mode). Leaves the chart pinned to
   * `EXPORT_DPR` — the caller re-pins with `syncChartsToDpr` afterwards.
   */
  function captureSection(section: ChartSectionKey): ChartSnapshot | null {
    // Only the commodity Donut has the HTML centre total the PDF must redraw.
    const centerLabel = section === 'commodities' && chartBType === 'Donut'
      ? { value: String(commodityTotal), caption: 'suppliers' }
      : undefined;
    return captureChart(chartRefs.current[CHART_SLOTS[section]] ?? null, centerLabel);
  }

  /**
   * Captures the given chart positions synchronously, before any await, so
   * the images are of the charts exactly as they are on screen now, then
   * re-pins every chart to the live ratio whatever happened.
   */
  function captureCharts<T>(capture: () => T): T {
    try {
      return capture();
    } finally {
      appliedDpr.current = syncChartsToDpr(chartRefs.current);
    }
  }

  /**
   * `build` is called synchronously, before the first await — so a PDF's chart
   * capture inside it still sees the charts as they are on screen — and inside
   * the try, so a capture failure reaches the error toast too.
   */
  async function runExport(target: ExportTarget, format: ExportFormat, build: () => Promise<string>) {
    setExporting({ target, format });
    try {
      const filename = await build();
      uiToast.success(target === 'report' ? 'Report downloaded' : 'Chart downloaded', filename);
    } catch {
      uiToast.systemError(`Could not generate the ${target === 'report' ? 'report' : 'download'}. Please try again.`);
    } finally {
      setExporting(null);
    }
  }

  function handleExport(format: ExportFormat) {
    if (!range || exporting) return;
    const report = buildReport(range);
    void runExport('report', format, () => {
      if (format === 'xlsx') return exportVisualsExcel(report);
      const charts = captureCharts<ReportChartImages>(() => ({
        stages: captureSection('stages'),
        commodities: captureSection('commodities'),
        countries: captureSection('countries'),
        strategy: captureSection('strategy'),
        eventStatus: captureSection('eventStatus'),
        conversion: captureSection('conversion'),
      }));
      return exportVisualsPdf(report, charts);
    });
  }

  function handleSectionExport(section: ReportSectionKey, format: ExportFormat) {
    if (!range || exporting) return;
    const report = buildReport(range);
    void runExport(section, format, () => {
      if (format === 'xlsx') return exportVisualsSectionExcel(report, section);
      // Summary by Buyer is a table on screen, so its PDF is the table alone.
      const chart = section === 'buyerGroups' ? null : captureCharts(() => captureSection(section));
      return exportVisualsSectionPdf(report, section, chart);
    });
  }

  /** The download control of one card, next to its filter trigger. */
  function cardExport(section: ReportSectionKey) {
    const busy = exporting?.target === section ? exporting.format : null;
    return (
      <ExportMenu
        compact
        label={`Download "${REPORT_SECTIONS[section].title}"`}
        caption={sectionScopes[section].summary}
        disabled={!hasSectionData[section] || !range}
        disabledTitle={range ? 'No data to download for this card' : 'Pick a valid period to download'}
        busy={busy}
        locked={exporting !== null && busy === null}
        onExport={format => handleSectionExport(section, format)}
      />
    );
  }

  // Every chart is derived from the same four fetches, so the page waits rather
  // than animating empty charts that then jump to real data.
  if (loading) {
    return <LoadingState entity="Visuals" icon={moduleIcons.visuals} fill delayMs={PAGE_FETCH_DELAY_MS} />;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Visuals</h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: BRAND_COLORS.sidebar, margin: '4px 0 0' }}>Business Intelligence · SSD Tracker</p>
        </div>
        <ExportMenu
          disabled={!hasAnyReportData || !range}
          disabledTitle="No data to export for this period"
          busy={exporting?.target === 'report' ? exporting.format : null}
          locked={exporting !== null && exporting.target !== 'report'}
          onExport={handleExport}
        />
      </div>

      {/* Period filter */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: BRAND_COLORS.sidebar }}>
            Period:
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <select
                value={period}
                onChange={e => handlePeriodChange(e.target.value as PeriodKey)}
                style={{ ...inputStyle, padding: '5px 24px 5px 8px', appearance: 'none', cursor: 'pointer', minWidth: 140 }}
              >
                {PERIOD_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              <FontAwesomeIcon icon={faChevronDown} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: BRAND_COLORS.sidebar, pointerEvents: 'none' }} />
            </span>
          </label>
          {period === 'custom' && (
            <>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: BRAND_COLORS.sidebar }}>
                From
                <input type="date" value={customFrom} max={customTo || undefined} onChange={e => setCustomFrom(e.target.value)} style={inputStyle} />
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: BRAND_COLORS.sidebar }}>
                To
                <input type="date" value={customTo} min={customFrom || undefined} onChange={e => setCustomTo(e.target.value)} style={inputStyle} />
              </label>
            </>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: range ? NEUTRAL_COLORS.textDark : BRAND_COLORS.accentRed }}>
            {range
              ? `${formatDateKey(range.from)} – ${formatDateKey(range.to)}`
              : 'Pick a start date on or before the end date'}
          </span>
        </div>
        {excludedSentence && (
          <p style={{ fontSize: 11, color: BRAND_COLORS.sidebar, margin: '6px 0 0' }}>{excludedSentence}</p>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard icon={faBuilding} color="#02B3E1" label="Total Suppliers" value={totalSuppliers} sub="onboarded in the period" />
        <KpiCard icon={faColumns} color={ACCENT_COLORS.purple} label="Active Tracker" value={inTrackerActive} sub="in active process" />
      </div>

      {/* Section 2 - Tracker & Commodity */}
      {/* Every card below carries `minWidth: 0` (via `cardStyle`). A flex item
          (and a `1fr` grid track) defaults to `min-width: auto`, i.e. it refuses
          to shrink below its content's min-content width — and a Chart.js canvas
          contributes its *current* pixel width to that, so a card holding one
          can never give the width back once it has grown. That floor is what
          pushed these cards past the right edge instead of compressing them like
          the rest of the page. `minWidth: 0` removes it, letting the card follow
          its flex basis and Chart.js's ResizeObserver shrink the canvas after. */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {/* Chart A - Suppliers by Stage - 60% */}
        <div style={{ ...cardStyle, flex: '0 0 60%' }}>
          <div style={cardHeaderStyle}>
            <CardHeader icon={faFilter} iconColor={BRAND_COLORS.accentRed} title={REPORT_SECTIONS.stages.title} />
            <div style={cardControlsStyle}>
              <CardFilterPanel fields={[commodityField]} value={stageFilters} onChange={setStageFilters} />
              {cardExport('stages')}
            </div>
          </div>
          {hasStageData ? (
            <div style={{ width: '100%', height: 300 }}>
              <Bar
                ref={chartRef(CHART_SLOTS.stages)}
                data={{
                  labels: stageData.map(s => s.name),
                  datasets: [{
                    label: 'Suppliers',
                    data: stageData.map(s => s.count),
                    backgroundColor: stageData.map(s => s.color),
                    borderRadius: 4,
                  }],
                }}
                options={{
                  indexAxis: 'y',
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    x: { ticks: countTick(11), grid: GRID_HIDDEN, border: GRID_DASH },
                    y: { ticks: tick(11), grid: GRID_LINE, border: GRID_DASH },
                  },
                }}
              />
            </div>
          ) : <ChartEmpty height={300} filtered={activeFilterCount(stageFilters) > 0} />}
        </div>

        {/* Chart B - Distribution by Commodity - 40% */}
        <div style={{ ...cardStyle, flex: 1 }}>
          <div style={cardHeaderStyle}>
            <CardHeader icon={faChartPie} iconColor={ACCENT_COLORS.purple} title={REPORT_SECTIONS.commodities.title} />
            <div style={cardControlsStyle}>
              <ChartTypeSelector options={['Donut', 'Bar']} active={chartBType} onChange={setChartBType} />
              <CardFilterPanel fields={[stageField, buyerField]} value={commodityFilters} onChange={setCommodityFilters} />
              {cardExport('commodities')}
            </div>
          </div>
          {!hasCommodityData ? <ChartEmpty height={300} filtered={activeFilterCount(commodityFilters) > 0} /> : chartBType === 'Donut' ? (
            <>
              {/* The chart is a canvas, so the donut's centre label has to be an
                  HTML overlay rather than a node inside the drawing.
                  `pointerEvents: none` keeps the slice tooltips reachable. */}
              <div style={{ position: 'relative', width: '100%', height: 170 }}>
                <Doughnut
                  ref={chartRef(CHART_SLOTS.commodities)}
                  data={{
                    labels: commodityData.map(d => d.name),
                    datasets: [{
                      label: 'Suppliers',
                      data: commodityData.map(d => d.value),
                      backgroundColor: commodityData.map(d => d.color),
                      borderWidth: 0,
                      spacing: 2,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    // Pinned in px rather than left to fill the box, so the ring
                    // keeps its size above the legend at any card width.
                    radius: 80,
                    cutout: 50,
                  }}
                />
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: '#000000' }}>{commodityTotal}</span>
                  <span style={{ fontSize: 11, color: BRAND_COLORS.sidebar }}>suppliers</span>
                </div>
              </div>
              {/* Every commodity, two per row, scrolling past ~6 rows. The
                  `minmax(0, 1fr)` tracks are what let the name spans shrink and
                  ellipsize instead of widening the card; the full name stays in
                  the `title` tooltip. */}
              <div style={{
                marginTop: 16, maxHeight: 120, overflowY: 'auto',
                display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 16, rowGap: 6,
              }}>
                {commodityData.map(d => (
                  <div key={d.name} title={`${d.name}: ${d.value}`} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: '#000000', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
                    <span style={{ fontSize: 11, color: NEUTRAL_COLORS.textDark }}>{d.value}</span>
                    <span style={{ fontSize: 10, color: BRAND_COLORS.sidebar, minWidth: 28, textAlign: 'right' }}>{pctOf(d.value, commodityTotal)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <ScrollBox>
              <div style={{ width: '100%', height: barListHeight(commodityData.length) }}>
                <Bar
                  ref={chartRef(CHART_SLOTS.commodities)}
                  data={{
                    labels: commodityData.map(d => d.name),
                    datasets: [{
                      label: 'Suppliers',
                      data: commodityData.map(d => d.value),
                      backgroundColor: commodityData.map(d => d.color),
                      borderRadius: 4,
                    }],
                  }}
                  options={{
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: { ticks: countTick(11), grid: GRID_LINE, border: GRID_DASH },
                      y: {
                        ticks: { ...tick(11), autoSkip: false, callback: (_v, i) => `${truncate(commodityData[i].name, 24)} · ${commodityData[i].value}` },
                        grid: GRID_HIDDEN,
                        border: GRID_DASH,
                      },
                    },
                  }}
                />
              </div>
            </ScrollBox>
          )}
        </div>
      </div>

      {/* Section 3 - Geographic Distribution (full width) */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <div style={cardHeaderStyle}>
          <CardHeader icon={faGlobe} iconColor={NEUTRAL_COLORS.textDark} title={REPORT_SECTIONS.countries.title} />
          <div style={cardControlsStyle}>
            <ChartTypeSelector options={['Bar', 'Table']} active={chartEType} onChange={setChartEType} />
            <CardFilterPanel fields={[stageField, commodityField, buyerField]} value={countryFilters} onChange={setCountryFilters} />
            {cardExport('countries')}
          </div>
        </div>
        {!hasCountryData ? <ChartEmpty height={220} filtered={activeFilterCount(countryFilters) > 0} /> : chartEType === 'Bar' ? (
          <ScrollBox>
            <div style={{ width: '100%', height: barListHeight(countryData.length) }}>
              <Bar
                ref={chartRef(CHART_SLOTS.countries)}
                data={{
                  labels: countryData.map(c => c.name),
                  datasets: [{
                    label: 'Suppliers',
                    data: countryData.map(c => c.count),
                    backgroundColor: ACCENT_COLORS.info,
                    borderRadius: 4,
                  }],
                }}
                options={{
                  indexAxis: 'y',
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    x: { ticks: countTick(11), grid: GRID_LINE, border: GRID_DASH },
                    y: {
                      ticks: { ...tick(11), autoSkip: false, callback: (_v, i) => `${countryData[i].name} · ${countryData[i].count}` },
                      grid: GRID_HIDDEN,
                      border: GRID_DASH,
                    },
                  },
                }}
              />
            </div>
          </ScrollBox>
        ) : (
          <div style={{ borderRadius: 6, border: `1px solid ${NEUTRAL_COLORS.borderLight}`, overflow: 'hidden' }}>
            <ScrollBox>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {(['Country', 'Suppliers', '% of total'] as const).map(h => (
                      <th key={h} style={{
                        position: 'sticky', top: 0, backgroundColor: NEUTRAL_COLORS.panelBg,
                        textAlign: h === 'Country' ? 'left' : 'center', padding: '8px 12px', fontWeight: 600, color: NEUTRAL_COLORS.textDark,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {countryData.map((row, i) => (
                    <tr key={row.name} style={{ backgroundColor: i % 2 === 1 ? NEUTRAL_COLORS.panelBg : BRAND_COLORS.cards }}>
                      <td style={{ padding: '8px 12px', color: '#000000' }}>{row.name}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: NEUTRAL_COLORS.textDark }}>{row.count}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: BRAND_COLORS.sidebar }}>{pctOf(row.count, countryTotal)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollBox>
          </div>
        )}
      </div>

      {/* Section 4 - Strategy: Need vs. Achieved by Commodity (full width) */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <div style={cardHeaderStyle}>
          <CardHeader icon={faBullseye} iconColor={BRAND_COLORS.accentRed} title={REPORT_SECTIONS.strategy.title} />
          <div style={{ ...cardControlsStyle, gap: 12 }}>
            {[{ label: 'Need 2026', color: BRAND_COLORS.sidebar }, { label: 'Achieved', color: '#6ABF4B' }].map(s => (
              <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: NEUTRAL_COLORS.textDark }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: s.color }} />
                {s.label}
              </span>
            ))}
            {cardExport('strategy')}
          </div>
        </div>
        <p style={{ fontSize: 11, color: BRAND_COLORS.sidebar, margin: '-8px 0 16px' }}>
          "Need 2026" is the fixed strategy target and does not change with the Period filter above; only "Achieved" is narrowed to suppliers onboarded in the selected period.
        </p>
        {!hasStrategyProgressData ? <ChartEmpty height={220} /> : (
          <ScrollBox>
            <div style={{ width: '100%', height: barListHeight(strategyProgressData.length, 32) }}>
              <Bar
                ref={chartRef(CHART_SLOTS.strategy)}
                data={{
                  labels: strategyProgressData.map(r => r.commodity),
                  datasets: [
                    {
                      label: 'Need 2026',
                      data: strategyProgressData.map(r => r.need),
                      backgroundColor: BRAND_COLORS.sidebar,
                      borderRadius: 3,
                    },
                    {
                      label: 'Achieved',
                      data: strategyProgressData.map(r => r.achieved),
                      backgroundColor: '#6ABF4B',
                      borderRadius: 3,
                    },
                  ],
                }}
                options={{
                  indexAxis: 'y',
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    x: { ticks: countTick(11), grid: GRID_LINE, border: GRID_DASH },
                    y: {
                      ticks: { ...tick(11), autoSkip: false, callback: (_v, i) => `${truncate(strategyProgressData[i].commodity, 24)} · ${strategyProgressData[i].achieved}/${strategyProgressData[i].need}` },
                      grid: GRID_HIDDEN,
                      border: GRID_DASH,
                    },
                  },
                }}
              />
            </div>
          </ScrollBox>
        )}
      </div>

      {/* Section 5 - Events & Conversion (40/60) */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {/* Events by Status - 40% */}
        <div style={{ ...cardStyle, flex: '0 0 40%' }}>
          <div style={cardHeaderStyle}>
            <CardHeader icon={faCalendarDay} iconColor={BRAND_COLORS.userBlock} title={REPORT_SECTIONS.eventStatus.title} />
            <div style={cardControlsStyle}>
              <CardFilterPanel fields={[eventCommodityField]} value={eventStatusFilters} onChange={setEventStatusFilters} />
              {cardExport('eventStatus')}
            </div>
          </div>
          {hasEventStatusData ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: '55%', minWidth: 0, height: 180 }}>
                <Doughnut
                  ref={chartRef(CHART_SLOTS.eventStatus)}
                  data={{
                    labels: eventStatusData.map(d => d.name),
                    datasets: [{
                      label: 'Events',
                      data: eventStatusData.map(d => d.value),
                      backgroundColor: eventStatusData.map(d => d.color),
                      borderWidth: 0,
                      spacing: 3,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    radius: 65,
                    cutout: 40,
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {eventStatusData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: d.color }} />
                    <span style={{ fontSize: 12, color: '#000000', flex: 1 }}>{d.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#000000' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <ChartEmpty height={180} filtered={activeFilterCount(eventStatusFilters) > 0} />}
        </div>

        {/* Conversion per event - 60% */}
        <div style={{ ...cardStyle, flex: 1 }}>
          <div style={cardHeaderStyle}>
            <CardHeader icon={faChartLine} iconColor={ACCENT_COLORS.info} title={REPORT_SECTIONS.conversion.title} />
            {/* HTML legend: it stays put while the bar list scrolls below it. */}
            <div style={{ ...cardControlsStyle, gap: 12 }}>
              {[{ label: 'Evaluated', color: BRAND_COLORS.sidebar }, { label: 'Included', color: '#6ABF4B' }].map(s => (
                <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: NEUTRAL_COLORS.textDark }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: s.color }} />
                  {s.label}
                </span>
              ))}
              <CardFilterPanel fields={[eventCommodityField]} value={conversionFilters} onChange={setConversionFilters} />
              {cardExport('conversion')}
            </div>
          </div>
          {hasConversionData ? (
            <ScrollBox>
              <div style={{ width: '100%', height: barListHeight(conversionData.length, 32) }}>
                <Bar
                  ref={chartRef(CHART_SLOTS.conversion)}
                  data={{
                    labels: conversionData.map(c => c.name),
                    datasets: [
                      {
                        label: 'Evaluated',
                        data: conversionData.map(c => c.evaluated),
                        backgroundColor: BRAND_COLORS.sidebar,
                        borderRadius: 3,
                      },
                      {
                        label: 'Included',
                        data: conversionData.map(c => c.included),
                        backgroundColor: '#6ABF4B',
                        borderRadius: 3,
                      },
                    ],
                  }}
                  options={{
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      tooltip: {
                        // The title is the raw label, i.e. the full event name.
                        callbacks: {
                          footer: items => {
                            const c = conversionData[items[0].dataIndex];
                            return `Conversion: ${c.pct}% (${c.included}/${c.evaluated})`;
                          },
                        },
                      },
                    },
                    scales: {
                      x: { ticks: countTick(11), grid: GRID_LINE, border: GRID_DASH },
                      y: {
                        ticks: { ...tick(11), autoSkip: false, callback: (_v, i) => `${truncate(conversionData[i].name, 28)} · ${conversionData[i].pct}%` },
                        grid: GRID_HIDDEN,
                        border: GRID_DASH,
                      },
                    },
                  }}
                />
              </div>
            </ScrollBox>
          ) : <ChartEmpty height={180} filtered={activeFilterCount(conversionFilters) > 0} />}
        </div>
      </div>

      {/* Section 6 - Summary by Buyer */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <CardHeader icon={faUsers} iconColor={ACCENT_COLORS.pink} title={REPORT_SECTIONS.buyerGroups.title} />
          <div style={cardControlsStyle}>
            <CardFilterPanel fields={[commodityField]} value={buyerFilters} onChange={setBuyerFilters} />
            {cardExport('buyerGroups')}
          </div>
        </div>
        {hasBuyerData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {buyerStageGroups.map(group => {
              const isEmpty = group.total === 0;
              // A stage a filter just emptied collapses rather than showing an empty body.
              const isExpanded = !isEmpty && expandedBuyerStages.has(group.stage);
              return (
                <div key={group.stage} style={{ borderRadius: 6, overflow: 'hidden', border: `1px solid ${NEUTRAL_COLORS.borderLight}` }}>
                  <button
                    onClick={() => !isEmpty && toggleBuyerStage(group.stage)}
                    disabled={isEmpty}
                    className="flex items-center justify-between"
                    style={{
                      width: '100%', gap: 10, padding: '10px 14px', border: 'none',
                      backgroundColor: isEmpty ? NEUTRAL_COLORS.panelBg : `${group.color}14`,
                      cursor: isEmpty ? 'default' : 'pointer', opacity: isEmpty ? 0.55 : 1,
                    }}
                  >
                    <span className="flex items-center" style={{ gap: 8, minWidth: 0 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: group.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#000000' }}>{group.stage}</span>
                    </span>
                    <span className="flex items-center" style={{ gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: NEUTRAL_COLORS.textDark }}>
                        {plural(group.total, 'supplier')}
                      </span>
                      {!isEmpty && (
                        <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} style={{ fontSize: 11, color: BRAND_COLORS.sidebar }} />
                      )}
                    </span>
                  </button>
                  <div
                    aria-hidden={!isExpanded}
                    style={{
                      maxHeight: isExpanded ? 2000 : 0, overflow: 'hidden',
                      opacity: isExpanded ? 1 : 0, transition: 'max-height 0.3s ease-in-out, opacity 0.2s ease-in-out',
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                      {group.rows.map(row => (
                        <div
                          key={row.buyer}
                          role="button"
                          tabIndex={0}
                          onClick={() => navigateToBuyer(group.stage, row.buyer)}
                          onKeyDown={e => { if (e.key === 'Enter') navigateToBuyer(group.stage, row.buyer); }}
                          className="flex items-center justify-between"
                          style={{
                            gap: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer',
                            borderTop: `1px solid ${NEUTRAL_COLORS.borderLight}`, transition: 'background-color 0.1s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = NEUTRAL_COLORS.panelBg)}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <span style={{ color: '#000000', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.buyer}</span>
                          <span className="flex items-center" style={{ gap: 6, flexShrink: 0 }}>
                            <span style={{ color: NEUTRAL_COLORS.textDark, fontWeight: 600 }}>{row.count}</span>
                            <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 9, color: BRAND_COLORS.sidebar }} />
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between" style={{
                      padding: '8px 14px', fontSize: 12, fontWeight: 700, color: '#000000',
                      backgroundColor: NEUTRAL_COLORS.panelBg, borderTop: `1px solid ${NEUTRAL_COLORS.borderLight}`,
                    }}>
                      <span>Total</span>
                      <span>{group.total}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: BRAND_COLORS.sidebar, textAlign: 'center', padding: '16px 12px', margin: 0 }}>
            {activeFilterCount(buyerFilters) > 0 ? 'No suppliers match these filters' : 'No suppliers onboarded in this period'}
          </p>
        )}
      </div>
    </div>
  );
}
