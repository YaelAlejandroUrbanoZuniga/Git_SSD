import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding, faColumns, faDownload, faChevronDown, faChevronUp, faChevronRight, faInbox,
  faFileExcel, faFilePdf, faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import type { BlacklistedSupplier, CompletedSupplier, TrackerSupplier, ScoutingEvent } from '../types';
import { TRACKER_STAGE_CONFIG } from '../constants/stage-config';
import {
  getBlacklistedSuppliers, getCompletedSuppliers, getTrackerSuppliers,
} from '../services/suppliersService';
import { getScoutingEvents } from '../services/eventsService';
import { ApiError } from '../services/api.config';
import { useToast } from '../context/ToastContext';
import { LoadingState } from '../components/LoadingState';
import { PAGE_FETCH_DELAY_MS } from '../components/loadingDelays';
import { KpiCard } from '../components/KpiCard';
import { moduleIcons } from '../components/moduleIcons';
import type { ChartSnapshot, ReportChartImages, ReportSupplier, VisualsReport } from '../utils/visualsReport';
import { exportVisualsExcel } from '../utils/visualsReportExcel';
import { exportVisualsPdf } from '../utils/visualsReportPdf';
import { ACCENT_COLORS, BRAND_COLORS, NEUTRAL_COLORS } from '../constants/designTokens';

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

/**
 * All Visuals derivations in one pass, so the JSX reads pre-computed arrays.
 * The range is applied first — suppliers by `onboardingDate`, events by
 * `dateStart` — and every figure below is built from the filtered sets only.
 */
function buildDashboardData(source: DashboardSource, range: DateRange | null) {
  const byOnboarding = (s: TrackerSupplier) => s.onboardingDate;
  const tracker = filterByDate(source.tracker, byOnboarding, range);
  const blacklisted = filterByDate(source.blacklisted, byOnboarding, range);
  const completed = filterByDate(source.completed, byOnboarding, range);
  const events = filterByDate(source.events, e => e.dateStart, range);

  const activeTracker = tracker.inRange;
  const evts = events.inRange;
  const allSuppliers = [...activeTracker, ...blacklisted.inRange, ...completed.inRange];

  // The in-period suppliers of each stage, in `TRACKER_STAGE_CONFIG` order.
  // "Suppliers by Stage" and "Summary by Buyer" both read these buckets, so
  // their per-stage totals always tie out for the same period.
  const stageBuckets = TRACKER_STAGE_CONFIG.map(cfg => ({
    cfg,
    suppliers: cfg.name === 'Blacklisted'
      ? blacklisted.inRange
      : cfg.name === 'Completed'
      ? completed.inRange
      : activeTracker.filter(s => s.stage === cfg.name),
  }));

  const stageData = stageBuckets.map(({ cfg, suppliers }) => ({ name: cfg.name, count: suppliers.length, color: cfg.color }));

  const commodityCounts = countBy(allSuppliers, s => s.commodity);
  const commodityPalette = categoricalPalette(commodityCounts.length);
  const commodityData = commodityCounts.map(([name, value], i) => ({ name, value, color: commodityPalette[i] }));

  const countryData = countBy(allSuppliers, s => s.country).map(([name, count]) => ({ name, count }));

  const eventStatusData = [
    { name: 'Upcoming', value: evts.filter(e => e.status === 'Upcoming').length, color: '#EC4899' },
    { name: 'Ongoing', value: evts.filter(e => e.status === 'Ongoing').length, color: ACCENT_COLORS.info },
    { name: 'Completed', value: evts.filter(e => e.status === 'Completed').length, color: '#6ABF4B' },
    { name: 'Canceled', value: evts.filter(e => e.status === 'Canceled').length, color: '#000000' },
  ];

  // Every non-canceled event that evaluated at least one supplier — an Ongoing
  // event's partial funnel is still real data.
  const conversionData = evts
    .filter(e => e.status !== 'Canceled' && e.supplierEntries.length > 0)
    .map(evt => {
      const evaluated = evt.supplierEntries.length;
      const included = evt.supplierEntries.filter(e => e.result === 'Included').length;
      return { name: evt.name, evaluated, included, pct: Math.round((included / evaluated) * 100) };
    });

  // Same buckets as `stageData` — just bucketed by buyer within each stage
  // instead of collapsed to a single count.
  const buyerStageGroups = stageBuckets.map(({ cfg, suppliers }) => {
    const counts: Record<string, number> = {};
    suppliers.forEach(s => {
      const buyer = buyerLabel(s);
      counts[buyer] = (counts[buyer] || 0) + 1;
    });
    const rows = Object.entries(counts)
      .map(([buyer, count]) => ({ buyer, count }))
      .sort((a, b) => b.count - a.count || a.buyer.localeCompare(b.buyer));
    return { stage: cfg.name, color: cfg.color, total: suppliers.length, rows };
  });

  // The raw in-period list behind "Total Suppliers" (one row per supplier, so
  // its length always equals the KPI), for the report's "Suppliers" sheet.
  const stageOrder = (stage: string) => {
    const i = TRACKER_STAGE_CONFIG.findIndex(cfg => cfg.name === stage);
    return i === -1 ? TRACKER_STAGE_CONFIG.length : i;
  };
  const toRow = (s: TrackerSupplier, stage: string): ReportSupplier => ({
    folio: s.folio, name: s.name, stage, commodity: s.commodity, country: s.country,
    buyer: buyerLabel(s), onboardingDate: parseDateKey(s.onboardingDate) ?? '',
  });
  const supplierRows = [
    ...activeTracker.map(s => toRow(s, s.stage)),
    ...blacklisted.inRange.map(s => toRow(s, 'Blacklisted')),
    ...completed.inRange.map(s => toRow(s, 'Completed')),
  ].sort((a, b) => stageOrder(a.stage) - stageOrder(b.stage) || a.name.localeCompare(b.name));

  return {
    totalSuppliers: allSuppliers.length,
    inTrackerActive: activeTracker.length,
    excludedSuppliers: tracker.undated + blacklisted.undated + completed.undated,
    excludedEvents: events.undated,
    stageData, commodityData, countryData, eventStatusData, conversionData, buyerStageGroups, supplierRows,
  };
}

/** A supplier's buyer, or the 'Unassigned' display bucket when it has none. */
function buyerLabel(s: TrackerSupplier): string {
  return s.buyer?.trim() ? s.buyer : 'Unassigned';
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

/**
 * The header "Export report" button and its two-format menu. Closes on a pick,
 * an outside click or Escape; while a file is being built the button shows a
 * spinner and ignores further picks.
 */
function ExportMenu({ disabled, busy, onExport }: {
  disabled: boolean;
  busy: ExportFormat | null;
  onExport: (format: ExportFormat) => void;
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

  const inactive = disabled || busy !== null;
  return (
    // The tooltip sits on the wrapper: a disabled <button> fires no pointer
    // events, so some browsers never show its own `title`.
    <div ref={rootRef} style={{ position: 'relative' }} title={disabled ? 'No data to export for this period' : undefined}>
      <button
        ref={buttonRef}
        onClick={() => setOpen(o => !o)}
        disabled={inactive}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 16px', fontSize: 13, fontWeight: 600,
          border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6,
          backgroundColor: BRAND_COLORS.cards, color: '#000000',
          cursor: disabled ? 'not-allowed' : busy ? 'progress' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'box-shadow 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.13)')}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
      >
        <FontAwesomeIcon icon={busy ? faSpinner : faDownload} spin={busy !== null} style={{ fontSize: 12 }} />
        {busy ? 'Exporting…' : 'Export report'}
        <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 9, color: BRAND_COLORS.sidebar, marginLeft: 2 }} />
      </button>
      {open && !inactive && (
        <div role="menu" style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 20, minWidth: 180,
          backgroundColor: BRAND_COLORS.cards, border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)', padding: 4,
        }}>
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

/** Stand-in for a chart whose dataset is empty for the selected period. */
function ChartEmpty({ height }: { height: number }) {
  return (
    <div style={{
      height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
      color: BRAND_COLORS.sidebar,
    }}>
      <FontAwesomeIcon icon={faInbox} style={{ fontSize: 18 }} />
      <span style={{ fontSize: 12 }}>No data for this period</span>
    </div>
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
const cardHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 16 };
const cardTitleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 };

export function Dashboard() {
  const navigate = useNavigate();
  const uiToast = useToast();
  const [source, setSource] = useState(EMPTY_SOURCE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getTrackerSuppliers(), getBlacklistedSuppliers(), getCompletedSuppliers(), getScoutingEvents(),
    ])
      .then(([tracker, blacklisted, completed, events]) => {
        if (!cancelled) setSource({ tracker, blacklisted, completed, events });
      })
      .catch(err => {
        if (!cancelled) {
          uiToast.systemError(err instanceof ApiError ? err.message : 'Could not load the dashboard data.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uiToast]);

  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('thisYear');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [chartBType, setChartBType] = useState('Donut');
  const [chartEType, setChartEType] = useState('Bar');

  // Recomputed on every render from the raw fetch and the live range — never
  // cached per period — so the page cannot show another period's numbers.
  const range = resolvePeriod(period, customFrom, customTo, new Date());
  const {
    totalSuppliers, inTrackerActive, excludedSuppliers, excludedEvents,
    stageData, commodityData, countryData, eventStatusData, conversionData, buyerStageGroups, supplierRows,
  } = buildDashboardData(source, range);

  const [expandedBuyerStages, setExpandedBuyerStages] = useState<Set<string>>(new Set());
  const toggleBuyerStage = (stage: string) => setExpandedBuyerStages(prev => {
    const next = new Set(prev);
    if (next.has(stage)) next.delete(stage); else next.add(stage);
    return next;
  });
  function navigateToBuyer(stage: string, buyer: string) {
    // "Unassigned" is a display bucket, not a real filter value — a `?buyer=`
    // for it would ask the tracker page to match suppliers whose buyer is
    // literally the string "Unassigned", hiding the very rows this represents.
    const query = buyer === 'Unassigned' ? '' : `?buyer=${encodeURIComponent(buyer)}`;
    if (stage === 'Completed') navigate(`/tracker/completed${query}`);
    else if (stage === 'Blacklisted') navigate(`/tracker/blacklisted${query}`);
    else navigate(`/tracker/stage/${encodeURIComponent(stage)}${query}`);
  }

  // One ref slot per chart *position* (stage / commodity / country / events /
  // conversion), not per JSX block — a toggle group's alternates (e.g. the
  // commodity Donut vs Bar) never mount at once, so they share a slot;
  // whichever is currently on screen ends up in it.
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
  const hasAnyReportData = hasStageData || hasCommodityData || hasCountryData
    || hasEventStatusData || hasConversionData || hasBuyerData;

  const excludedNote = [
    excludedSuppliers > 0 ? plural(excludedSuppliers, 'supplier') : null,
    excludedEvents > 0 ? plural(excludedEvents, 'event') : null,
  ].filter(Boolean).join(' and ');
  const excludedSentence = excludedNote
    ? `${excludedNote} without a valid date ${excludedSuppliers + excludedEvents === 1 ? 'is' : 'are'} not counted in any period.`
    : null;

  async function handleExport(format: ExportFormat) {
    if (!range || exporting) return;
    // Everything below is the render's own period-filtered data, so both files
    // match the screen exactly — nothing is re-fetched or re-derived.
    const report: VisualsReport = {
      periodLabel: PERIOD_OPTIONS.find(o => o.key === period)?.label ?? period,
      range: { ...range, display: `${formatDateKey(range.from)} – ${formatDateKey(range.to)}` },
      generatedAt: new Date(),
      kpis: { totalSuppliers, activeTracker: inTrackerActive },
      excludedNote: excludedSentence,
      stages: stageData,
      commodities: commodityData,
      countries: countryData,
      eventStatus: eventStatusData,
      conversion: conversionData,
      buyerGroups: buyerStageGroups,
      suppliers: supplierRows,
    };
    setExporting(format);
    try {
      let filename: string;
      if (format === 'xlsx') {
        filename = await exportVisualsExcel(report);
      } else {
        // Captured synchronously, before any await, so the images are of the
        // charts exactly as they are on screen now.
        const [stage, commodity, country, eventStatus, conversion] = chartRefs.current;
        let charts: ReportChartImages;
        try {
          charts = {
            stage: captureChart(stage),
            // Only the Donut has the HTML centre total the PDF must redraw.
            commodity: captureChart(commodity, chartBType === 'Donut'
              ? { value: String(totalSuppliers), caption: 'suppliers' }
              : undefined),
            country: captureChart(country),
            eventStatus: captureChart(eventStatus),
            conversion: captureChart(conversion),
          };
        } finally {
          appliedDpr.current = syncChartsToDpr(chartRefs.current);
        }
        filename = await exportVisualsPdf(report, charts);
      }
      uiToast.success('Report downloaded', filename);
    } catch {
      uiToast.systemError('Could not generate the report. Please try again.');
    } finally {
      setExporting(null);
    }
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
        <ExportMenu disabled={!hasAnyReportData || !range} busy={exporting} onExport={handleExport} />
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
            <h2 style={cardTitleStyle}>Suppliers by Stage</h2>
          </div>
          {hasStageData ? (
            <div style={{ width: '100%', height: 300 }}>
              <Bar
                ref={chartRef(0)}
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
          ) : <ChartEmpty height={300} />}
        </div>

        {/* Chart B - Distribution by Commodity - 40% */}
        <div style={{ ...cardStyle, flex: 1 }}>
          <div style={cardHeaderStyle}>
            <h2 style={cardTitleStyle}>Distribution by Commodity</h2>
            <ChartTypeSelector options={['Donut', 'Bar']} active={chartBType} onChange={setChartBType} />
          </div>
          {!hasCommodityData ? <ChartEmpty height={300} /> : chartBType === 'Donut' ? (
            <>
              {/* The chart is a canvas, so the donut's centre label has to be an
                  HTML overlay rather than a node inside the drawing.
                  `pointerEvents: none` keeps the slice tooltips reachable. */}
              <div style={{ position: 'relative', width: '100%', height: 170 }}>
                <Doughnut
                  ref={chartRef(1)}
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
                  <span style={{ fontSize: 22, fontWeight: 700, color: '#000000' }}>{totalSuppliers}</span>
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
                    <span style={{ fontSize: 10, color: BRAND_COLORS.sidebar, minWidth: 28, textAlign: 'right' }}>{pctOf(d.value, totalSuppliers)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <ScrollBox>
              <div style={{ width: '100%', height: barListHeight(commodityData.length) }}>
                <Bar
                  ref={chartRef(1)}
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
          <h2 style={cardTitleStyle}>Geographic Distribution</h2>
          <ChartTypeSelector options={['Bar', 'Table']} active={chartEType} onChange={setChartEType} />
        </div>
        {!hasCountryData ? <ChartEmpty height={220} /> : chartEType === 'Bar' ? (
          <ScrollBox>
            <div style={{ width: '100%', height: barListHeight(countryData.length) }}>
              <Bar
                ref={chartRef(2)}
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
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: BRAND_COLORS.sidebar }}>{pctOf(row.count, totalSuppliers)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollBox>
          </div>
        )}
      </div>

      {/* Section 4 - Events & Conversion (40/60) */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {/* Events by Status - 40% */}
        <div style={{ ...cardStyle, flex: '0 0 40%' }}>
          <div style={cardHeaderStyle}>
            <h2 style={cardTitleStyle}>Events by Status</h2>
          </div>
          {hasEventStatusData ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: '55%', minWidth: 0, height: 180 }}>
                <Doughnut
                  ref={chartRef(3)}
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
          ) : <ChartEmpty height={180} />}
        </div>

        {/* Conversion per event - 60% */}
        <div style={{ ...cardStyle, flex: 1 }}>
          <div style={cardHeaderStyle}>
            <h2 style={cardTitleStyle}>Conversion rate per event</h2>
            {/* HTML legend: it stays put while the bar list scrolls below it. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {[{ label: 'Evaluated', color: BRAND_COLORS.sidebar }, { label: 'Included', color: '#6ABF4B' }].map(s => (
                <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: NEUTRAL_COLORS.textDark }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: s.color }} />
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          {hasConversionData ? (
            <ScrollBox>
              <div style={{ width: '100%', height: barListHeight(conversionData.length, 32) }}>
                <Bar
                  ref={chartRef(4)}
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
          ) : <ChartEmpty height={180} />}
        </div>
      </div>

      {/* Section 5 - Summary by Buyer */}
      <div style={cardStyle}>
        <h2 style={{ ...cardTitleStyle, marginBottom: 16 }}>Summary by Buyer</h2>
        {hasBuyerData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {buyerStageGroups.map(group => {
              const isExpanded = expandedBuyerStages.has(group.stage);
              const isEmpty = group.total === 0;
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
                          title={row.buyer === 'Unassigned' ? 'Unassigned suppliers open unfiltered — no buyer filter is applied' : undefined}
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
            No suppliers onboarded in this period
          </p>
        )}
      </div>
    </div>
  );
}
