import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding, faColumns, faBan, faCircleCheck,
  faDownload, faCheck, faChevronDown,
} from '@fortawesome/free-solid-svg-icons';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, ArcElement, Filler, Tooltip, Legend,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import type { BlacklistedSupplier, CompletedSupplier, TrackerSupplier, ScoutingEvent } from '../types';
import { TRACKER_STAGE_CONFIG } from '../constants/stage-config';
import {
  getBlacklistedSuppliers, getCompletedSuppliers, getTrackerSuppliers,
} from '../services/suppliersService';
import { getScoutingEvents } from '../services/eventsService';
import { ApiError } from '../services/api.config';
import { useToast } from '../context/ToastContext';
import { LoadingState } from '../components/LoadingState';
import { KpiCard } from '../components/KpiCard';
import { moduleIcons } from '../components/moduleIcons';
import { downloadCsv, downloadMultiSectionCsv, todayStamp } from '../utils/exportCsv';
import { ACCENT_COLORS, BRAND_COLORS, NEUTRAL_COLORS } from '../constants/designTokens';

// Only the Chart.js pieces the six charts below actually draw. Registering the
// whole catalog (`chart.js/auto`) would pull in every controller and scale this
// page never renders and undo the bundle saving that motivated the migration.
ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement,
  Filler, Tooltip, Legend,
);

const commodityColors = ['#02B3E1', ACCENT_COLORS.purple, '#D4A017', '#6ABF4B', '#E3650B', '#0891B2', BRAND_COLORS.userBlock];
const EMPTY_DASHBOARD = buildDashboardData([], [], [], []);

// Shared axis pieces, so every chart below draws the same dashed grid and tick
// scale. Note that in Chart.js v4 the dash pattern of the *grid lines* lives on
// `border.dash`, not on `grid` — `grid` only carries their colour.
const GRID_LINE = { color: BRAND_COLORS.background };
const GRID_HIDDEN = { display: false };
const GRID_DASH = { dash: [3, 3] };
const tick = (size: number) => ({ font: { size } });

// Structural type for the react-chartjs-2 ref callback below — every Chart.js
// instance (Bar/Line/Doughnut alike) exposes .resize(), which is all the
// window-resize fix needs, so this avoids importing chart.js's generic
// `Chart<TType, TData, TLabel>` type just to hold a ref.
type ChartLike = { resize: () => void };

/** All Visuals derivations in one pass, so the JSX reads pre-computed arrays. */
function buildDashboardData(
  tracker: TrackerSupplier[],
  blacklisted: BlacklistedSupplier[],
  completed: CompletedSupplier[],
  events: ScoutingEvent[],
) {
  const allSuppliers = [...tracker, ...blacklisted, ...completed];

  const stageData = TRACKER_STAGE_CONFIG.map(cfg => ({
    name: cfg.name,
    count: cfg.name === 'Blacklisted'
      ? blacklisted.length
      : cfg.name === 'Completed'
      ? completed.length
      : tracker.filter(s => s.stage === cfg.name).length,
    color: cfg.color,
  }));

  const commodityCounts: Record<string, number> = {};
  allSuppliers.forEach(s => { commodityCounts[s.commodity] = (commodityCounts[s.commodity] || 0) + 1; });
  const commodityData = Object.entries(commodityCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, color: commodityColors[i % commodityColors.length] }));

  // Real onboardings per month: group every supplier by the 'YYYY-MM' of its
  // onboardingDate, then emit the last 6 natural months ending in the current
  // one. Months with no onboardings show 0 — nothing is invented.
  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const onboardingsByMonth: Record<string, number> = {};
  allSuppliers.forEach(s => {
    // onboardingDate is a 'YYYY-MM-DD' string; skip blanks/non-dates like 'TBC'.
    if (s.onboardingDate && s.onboardingDate.length >= 7) {
      const key = s.onboardingDate.slice(0, 7);
      onboardingsByMonth[key] = (onboardingsByMonth[key] || 0) + 1;
    }
  });
  const nowMonth = new Date();
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(nowMonth.getFullYear(), nowMonth.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { month: monthNamesShort[d.getMonth()], suppliers: onboardingsByMonth[key] || 0 };
  });

  const countryCounts: Record<string, number> = {};
  allSuppliers.forEach(s => { countryCounts[s.country] = (countryCounts[s.country] || 0) + 1; });
  const countryData = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  const eventStatusData = [
    { name: 'Upcoming', value: events.filter(e => e.status === 'Upcoming').length, color: '#EC4899' },
    { name: 'Ongoing', value: events.filter(e => e.status === 'Ongoing').length, color: ACCENT_COLORS.info },
    { name: 'Completed', value: events.filter(e => e.status === 'Completed').length, color: '#6ABF4B' },
    { name: 'Canceled', value: events.filter(e => e.status === 'Canceled').length, color: '#000000' },
  ];

  const conversionData = events.filter(e => e.status === 'Completed').map(evt => {
    const evaluated = evt.supplierEntries.length;
    const included = evt.supplierEntries.filter(e => e.result === 'Included').length;
    const abbrevName = evt.name.length > 20 ? evt.name.slice(0, 18) + '...' : evt.name;
    return { name: abbrevName, evaluated, included, pct: evaluated > 0 ? Math.round((included / evaluated) * 100) : 0 };
  });

  const buyers = [...new Set(tracker.map(s => s.buyer))];
  const stageOrder = TRACKER_STAGE_CONFIG.map(c => c.name);
  const buyerData = buyers.map(buyer => {
    const suppliersByBuyer = tracker.filter(s => s.buyer === buyer);
    const count = suppliersByBuyer.length;
    const avgStageIdx = Math.round(suppliersByBuyer.reduce((a, s) => a + stageOrder.indexOf(s.stage), 0) / count);
    const avgStage = stageOrder[avgStageIdx] || stageOrder[0] || '—';
    return { buyer, count, avgStage };
  });

  return {
    totalSuppliers: allSuppliers.length,
    inTrackerActive: tracker.length,
    blacklistedCount: blacklisted.length,
    completedCount: completed.length,
    stageData, commodityData, monthlyData, countryData, eventStatusData, conversionData, buyerData,
    allCommodities: [...new Set(allSuppliers.map(s => s.commodity))].sort(),
    allStages: TRACKER_STAGE_CONFIG.map(s => s.name),
  };
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      backgroundColor: BRAND_COLORS.cards, borderRadius: 8, padding: '12px 20px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <FontAwesomeIcon icon={faCheck} style={{ color: '#6ABF4B', fontSize: 14 }} />
      <span style={{ fontSize: 13, color: '#000000' }}>{message}</span>
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

function DownloadBtn({ onClick, disabled, title }: { onClick: () => void; disabled?: boolean; title?: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? (title ?? 'No data to export') : 'Download CSV'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', padding: 4, opacity: disabled ? 0.4 : 1 }}
    >
      <FontAwesomeIcon icon={faDownload} style={{ fontSize: 12, color: !disabled && hovered ? ACCENT_COLORS.info : BRAND_COLORS.sidebar, transition: 'color 0.15s' }} />
    </button>
  );
}

function FilterDropdown({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <label style={{ fontSize: 12, color: BRAND_COLORS.sidebar, marginRight: 6 }}>{label}:</label>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            fontSize: 12, padding: '5px 24px 5px 8px', borderRadius: 4,
            border: `1px solid ${NEUTRAL_COLORS.border}`, backgroundColor: BRAND_COLORS.cards, color: '#000000',
            appearance: 'none', cursor: 'pointer', minWidth: 120,
          }}
        >
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <FontAwesomeIcon icon={faChevronDown} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: BRAND_COLORS.sidebar, pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

export function Dashboard() {
  const uiToast = useToast();
  const [data, setData] = useState(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getTrackerSuppliers(), getBlacklistedSuppliers(), getCompletedSuppliers(), getScoutingEvents(),
    ])
      .then(([tracker, blacklisted, completed, events]) => {
        if (!cancelled) setData(buildDashboardData(tracker, blacklisted, completed, events));
      })
      .catch(err => {
        if (!cancelled) {
          uiToast.systemError(err instanceof ApiError ? err.message : 'Could not load the dashboard data.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uiToast]);

  const {
    totalSuppliers, inTrackerActive, blacklistedCount, completedCount,
    stageData, commodityData, monthlyData, countryData, eventStatusData, conversionData, buyerData,
    allCommodities, allStages,
  } = data;

  const [toast, setToast] = useState<string | null>(null);
  const [filterPeriod, setFilterPeriod] = useState('All time');
  const [filterCommodity, setFilterCommodity] = useState('All');
  const [filterStage, setFilterStage] = useState('All');
  const [animKey, setAnimKey] = useState(0);

  const [chartAType, setChartAType] = useState('Bar');
  const [chartBType, setChartBType] = useState('Donut');
  const [chartCType, setChartCType] = useState('Area');
  const [chartEType, setChartEType] = useState('Bar');

  // One ref slot per chart *position* (A/B/C/E-bar/events/conversion), not per
  // JSX block — a toggle group's alternates (e.g. Chart A's Bar vs Line) never
  // mount at once, so they share a slot; whichever is currently on screen ends
  // up in it.
  const chartRefs = useRef<(ChartLike | null)[]>([]);
  function chartRef(idx: number) {
    return (instance: ChartLike | null | undefined) => { chartRefs.current[idx] = instance ?? null; };
  }

  useEffect(() => {
    // Chart.js v4.5.1 (current, latest 4.x) already tries to handle browser
    // zoom itself: it listens for window 'resize' and compares
    // window.devicePixelRatio to catch a zoom step (which changes DPR without
    // necessarily resizing the container a per-chart ResizeObserver watches).
    // In practice that internal heuristic doesn't always fire reliably, and a
    // chart's canvas backing store is then left at the previous zoom's pixel
    // size — it overflows its card. There's no public option that makes this
    // more reliable, so this is a plain, debounced fallback: on any window
    // resize (zoom included), force every currently-mounted chart to
    // re-measure itself against its container via the imperative .resize()
    // react-chartjs-2 exposes on its ref, rather than trust the internal
    // detection alone.
    let debounce: ReturnType<typeof setTimeout>;
    function handleWindowResize() {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        chartRefs.current.forEach(chart => chart?.resize());
      }, 150);
    }
    window.addEventListener('resize', handleWindowResize);
    return () => {
      clearTimeout(debounce);
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);

  function showToast(msg: string) { setToast(msg); }

  function exportChartCsv(filename: string, rows: Record<string, unknown>[]) {
    const ok = downloadCsv(filename, rows);
    showToast(ok ? `Downloaded ${filename}` : 'No data available to export');
  }

  function handleFilterChange(setter: (v: string) => void) {
    return (v: string) => {
      setter(v);
      setAnimKey(k => k + 1);
    };
  }

  function resetFilters() {
    setFilterPeriod('All time');
    setFilterCommodity('All');
    setFilterStage('All');
    setAnimKey(k => k + 1);
  }

  const totalBuyerSuppliers = buyerData.reduce((a, b) => a + b.count, 0);

  const hasStageData = stageData.some(s => s.count > 0);
  const hasMonthlyData = monthlyData.some(m => m.suppliers > 0);
  const hasCommodityData = commodityData.length > 0;
  const hasCountryData = countryData.length > 0;
  const hasEventStatusData = eventStatusData.some(d => d.value > 0);
  const hasConversionData = conversionData.length > 0;
  const hasBuyerData = buyerData.length > 0;
  const hasAnyReportData = hasStageData || hasMonthlyData || hasCommodityData || hasCountryData
    || hasEventStatusData || hasConversionData || hasBuyerData;

  // Every chart and filter option is derived from the same four fetches, so the
  // page waits rather than animating empty charts that then jump to real data.
  if (loading) {
    return <LoadingState entity="Visuals" icon={moduleIcons.visuals} fill />;
  }

  return (
    <div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Visuals</h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: BRAND_COLORS.sidebar, margin: '4px 0 0' }}>Business Intelligence · SSD Tracker</p>
        </div>
        <button
          onClick={() => {
            const filename = `ssd-visuals-report-${todayStamp()}.csv`;
            const ok = downloadMultiSectionCsv(filename, [
              { title: 'Suppliers by Stage', rows: stageData.map(({ name, count }) => ({ name, count })) },
              { title: 'Distribution by Commodity', rows: commodityData.map(({ name, value }) => ({ name, value })) },
              { title: 'Suppliers Onboarded per Month', rows: monthlyData },
              { title: 'Geographic Distribution', rows: countryData },
              { title: 'Events by Status', rows: eventStatusData.map(({ name, value }) => ({ name, value })) },
              { title: 'Conversion Rate per Event', rows: conversionData },
              { title: 'Summary by Buyer', rows: buyerData },
            ]);
            showToast(ok ? `Downloaded ${filename}` : 'No data available to export');
          }}
          disabled={!hasAnyReportData}
          title={hasAnyReportData ? 'Download CSV report' : 'No data to export'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', fontSize: 13, fontWeight: 600,
            border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6,
            backgroundColor: BRAND_COLORS.cards, color: '#000000',
            cursor: hasAnyReportData ? 'pointer' : 'not-allowed',
            opacity: hasAnyReportData ? 1 : 0.5,
            transition: 'box-shadow 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.13)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
        >
          <FontAwesomeIcon icon={faDownload} style={{ fontSize: 12 }} />
          Export report
        </button>
      </div>

      {/* Global Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <FilterDropdown label="Period" value={filterPeriod} onChange={handleFilterChange(setFilterPeriod)} options={['Last 30 days', 'Last 3 months', 'Last 6 months', 'All time']} />
        <FilterDropdown label="Commodity" value={filterCommodity} onChange={handleFilterChange(setFilterCommodity)} options={['All', ...allCommodities]} />
        <FilterDropdown label="Stage" value={filterStage} onChange={handleFilterChange(setFilterStage)} options={['All', ...allStages]} />
        <button
          onClick={resetFilters}
          style={{ fontSize: 12, color: BRAND_COLORS.sidebar, border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 4, padding: '5px 10px', backgroundColor: BRAND_COLORS.cards, cursor: 'pointer' }}
        >
          Reset filters
        </button>
      </div>

      {/* Animated wrapper */}
      <div key={animKey} style={{ animation: 'fadeIn 200ms ease-out' }}>
        {/* KPIs - 4 cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KpiCard icon={faBuilding} color="#02B3E1" label="Total Suppliers" value={totalSuppliers} sub="registered in the system" />
          <KpiCard icon={faColumns} color="#6ABF4B" label="Active Tracker" value={inTrackerActive} sub="in active process" />
          <KpiCard icon={faBan} color="#000000" label="Blacklisted" value={blacklistedCount} sub="rejected suppliers" />
          <KpiCard icon={faCircleCheck} color="#6ABF4B" label="Completed" value={completedCount} sub="full cycle completed" />
        </div>

        {/* Section 2 - Tracker & Commodity */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {/* Chart A - Suppliers por Etapa - 60% */}
          <div style={{ flex: '0 0 60%', backgroundColor: BRAND_COLORS.cards, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 }}>Suppliers by Stage</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ChartTypeSelector options={['Bar', 'Line']} active={chartAType} onChange={setChartAType} />
                <DownloadBtn
                  disabled={chartAType === 'Bar' ? !hasStageData : !hasMonthlyData}
                  onClick={() => chartAType === 'Bar'
                    ? exportChartCsv(`ssd-visuals-suppliers-by-stage-${todayStamp()}.csv`, stageData.map(({ name, count }) => ({ name, count })))
                    : exportChartCsv(`ssd-visuals-suppliers-by-month-${todayStamp()}.csv`, monthlyData)}
                />
              </div>
            </div>
            {chartAType === 'Bar' ? (
              <div style={{ width: '100%', height: 260 }}>
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
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { ticks: tick(11), grid: GRID_HIDDEN, border: GRID_DASH },
                      y: { ticks: tick(11), grid: GRID_LINE, border: GRID_DASH },
                    },
                  }}
                />
              </div>
            ) : (
              <div style={{ width: '100%', height: 260 }}>
                <Line
                  ref={chartRef(0)}
                  data={{
                    labels: monthlyData.map(m => m.month),
                    datasets: [{
                      label: 'Suppliers',
                      data: monthlyData.map(m => m.suppliers),
                      borderColor: BRAND_COLORS.accentRed,
                      backgroundColor: `${BRAND_COLORS.accentRed}1A`,
                      borderWidth: 2,
                      fill: true,
                      // No cubicInterpolationMode/tension: straight segments between
                      // points. `tension` is a no-op once `cubicInterpolationMode:
                      // 'monotone'` is set (Chart.js only reads it on the *other*
                      // spline branch) — plain segments are the actual fix, since a
                      // rounded peak can visually read as exceeding the data even
                      // though its curve mathematically never does. A straight line
                      // through the real points can't overshoot at all.
                      pointRadius: 3,
                      pointBackgroundColor: BRAND_COLORS.accentRed,
                      pointBorderColor: BRAND_COLORS.accentRed,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { ticks: tick(11), grid: GRID_LINE, border: GRID_DASH },
                      y: { ticks: tick(11), grid: GRID_LINE, border: GRID_DASH },
                    },
                  }}
                />
              </div>
            )}
          </div>

          {/* Chart B - Distribución por Commodity - 40% */}
          <div style={{ flex: 1, backgroundColor: BRAND_COLORS.cards, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 }}>Distribution by Commodity</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ChartTypeSelector options={['Donut', 'Bar']} active={chartBType} onChange={setChartBType} />
                <DownloadBtn
                  disabled={!hasCommodityData}
                  onClick={() => exportChartCsv(`ssd-visuals-commodity-breakdown-${todayStamp()}.csv`, commodityData.map(({ name, value }) => ({ name, value })))}
                />
              </div>
            </div>
            {chartBType === 'Donut' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* The chart is a canvas, so the donut's centre label has to be an
                    HTML overlay rather than a node inside the drawing.
                    `pointerEvents: none` keeps the slice tooltips reachable. */}
                <div style={{ position: 'relative', width: '55%', height: 220 }}>
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
                      // keeps its size next to the legend column at any card width.
                      radius: 80,
                      cutout: 50,
                      plugins: { legend: { display: false } },
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
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {commodityData.slice(0, 6).map(d => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: '#000000', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
                      <span style={{ fontSize: 11, color: BRAND_COLORS.sidebar }}>{d.value}</span>
                      <span style={{ fontSize: 10, color: BRAND_COLORS.sidebar }}>{Math.round((d.value / totalSuppliers) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ width: '100%', height: 220 }}>
                <Bar
                  ref={chartRef(1)}
                  data={{
                    labels: commodityData.slice(0, 7).map(d => d.name),
                    datasets: [{
                      label: 'Suppliers',
                      data: commodityData.slice(0, 7).map(d => d.value),
                      backgroundColor: commodityData.slice(0, 7).map(d => d.color),
                      borderRadius: 4,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: {
                        ticks: { ...tick(9), autoSkip: false, maxRotation: 20, minRotation: 20 },
                        grid: GRID_HIDDEN,
                        border: GRID_DASH,
                      },
                      y: { ticks: tick(11), grid: GRID_LINE, border: GRID_DASH },
                    },
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Section 3 - Tendencia temporal (full width) */}
        <div style={{ backgroundColor: BRAND_COLORS.cards, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 }}>Suppliers onboarded per month</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ChartTypeSelector options={['Area', 'Line', 'Bar']} active={chartCType} onChange={setChartCType} />
              <DownloadBtn
                disabled={!hasMonthlyData}
                onClick={() => exportChartCsv(`ssd-visuals-onboarding-trend-${todayStamp()}.csv`, monthlyData)}
              />
            </div>
          </div>
          <div style={{ width: '100%', height: 220 }}>
            {chartCType === 'Bar' ? (
              <Bar
                ref={chartRef(2)}
                data={{
                  labels: monthlyData.map(m => m.month),
                  datasets: [{
                    label: 'Suppliers',
                    data: monthlyData.map(m => m.suppliers),
                    backgroundColor: BRAND_COLORS.accentRed,
                    borderRadius: 4,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { ticks: tick(12), grid: GRID_HIDDEN, border: GRID_DASH },
                    y: { min: 0, max: 15, ticks: tick(12), grid: GRID_LINE, border: GRID_DASH },
                  },
                }}
              />
            ) : (
              <Line
                ref={chartRef(2)}
                data={{
                  labels: monthlyData.map(m => m.month),
                  datasets: [{
                    label: 'Suppliers',
                    data: monthlyData.map(m => m.suppliers),
                    borderColor: BRAND_COLORS.accentRed,
                    backgroundColor: `${BRAND_COLORS.accentRed}1F`,
                    borderWidth: 2,
                    fill: chartCType === 'Area',
                    // See the Chart A Line dataset above for why this has no
                    // cubicInterpolationMode/tension — same fix, same reason.
                    pointRadius: 4,
                    pointBackgroundColor: BRAND_COLORS.accentRed,
                    pointBorderColor: BRAND_COLORS.accentRed,
                  }],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { ticks: tick(12), grid: GRID_LINE, border: GRID_DASH },
                    y: { min: 0, max: 15, ticks: tick(12), grid: GRID_LINE, border: GRID_DASH },
                  },
                }}
              />
            )}
          </div>
        </div>

        {/* Section 4 - Geographic Distribution (full width) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 24 }}>
          {/* Chart E - Suppliers by Country */}
          <div style={{ backgroundColor: BRAND_COLORS.cards, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 }}>Geographic Distribution</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ChartTypeSelector options={['Bar', 'Table']} active={chartEType} onChange={setChartEType} />
                <DownloadBtn
                  disabled={!hasCountryData}
                  onClick={() => exportChartCsv(`ssd-visuals-geographic-distribution-${todayStamp()}.csv`, countryData)}
                />
              </div>
            </div>
            {chartEType === 'Bar' ? (
              <div style={{ width: '100%', height: 220 }}>
                <Bar
                  ref={chartRef(3)}
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
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { ticks: tick(11), grid: GRID_HIDDEN, border: GRID_DASH },
                      y: { ticks: tick(11), grid: GRID_LINE, border: GRID_DASH },
                    },
                  }}
                />
              </div>
            ) : (
              <div style={{ overflow: 'hidden', borderRadius: 6, border: `1px solid ${NEUTRAL_COLORS.borderLight}` }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ backgroundColor: NEUTRAL_COLORS.panelBg }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: NEUTRAL_COLORS.textDark }}>Country</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600, color: NEUTRAL_COLORS.textDark }}>Suppliers</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600, color: NEUTRAL_COLORS.textDark }}>% of total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countryData.map((row, i) => (
                      <tr key={row.name} style={{ backgroundColor: i % 2 === 1 ? NEUTRAL_COLORS.panelBg : BRAND_COLORS.cards }}>
                        <td style={{ padding: '8px 12px', color: '#000000' }}>{row.name}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: NEUTRAL_COLORS.textDark }}>{row.count}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: BRAND_COLORS.sidebar }}>{Math.round((row.count / totalSuppliers) * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Section 5 - Events & Conversion (40/60) */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {/* Events por Status - 40% */}
          <div style={{ flex: '0 0 40%', backgroundColor: BRAND_COLORS.cards, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 }}>Events by Status</h2>
              <DownloadBtn
                disabled={!hasEventStatusData}
                onClick={() => exportChartCsv(`ssd-visuals-events-by-status-${todayStamp()}.csv`, eventStatusData.map(({ name, value }) => ({ name, value })))}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: '55%', height: 180 }}>
                <Doughnut
                  ref={chartRef(4)}
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
                    plugins: { legend: { display: false } },
                  }}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {eventStatusData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: d.color }} />
                    <span style={{ fontSize: 12, color: '#000000', flex: 1 }}>{d.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#000000' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Conversion por evento - 60% */}
          <div style={{ flex: 1, backgroundColor: BRAND_COLORS.cards, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 }}>Conversion rate per event</h2>
              <DownloadBtn
                disabled={!hasConversionData}
                onClick={() => exportChartCsv(`ssd-visuals-conversion-by-event-${todayStamp()}.csv`, conversionData)}
              />
            </div>
            <div style={{ width: '100%', height: 220 }}>
              <Bar
                ref={chartRef(5)}
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
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { font: { size: 11 }, boxWidth: 12, boxHeight: 12 },
                    },
                  },
                  scales: {
                    x: {
                      ticks: { ...tick(9), autoSkip: false, maxRotation: 15, minRotation: 15 },
                      grid: GRID_HIDDEN,
                      border: GRID_DASH,
                    },
                    y: { ticks: tick(11), grid: GRID_LINE, border: GRID_DASH },
                  },
                }}
              />
            </div>
          </div>
        </div>

        {/* Section 6 - Tabla Resumen por Buyer */}
        <div style={{ backgroundColor: BRAND_COLORS.cards, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 16px' }}>Summary by Buyer</h2>
          <div style={{ overflow: 'hidden', borderRadius: 6, border: `1px solid ${NEUTRAL_COLORS.borderLight}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ backgroundColor: NEUTRAL_COLORS.panelBg, borderBottom: `1px solid ${NEUTRAL_COLORS.borderLight}` }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600, color: NEUTRAL_COLORS.textDark }}>Buyer</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 600, color: NEUTRAL_COLORS.textDark }}>Suppliers</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 600, color: NEUTRAL_COLORS.textDark }}>Avg. Stage</th>
                </tr>
              </thead>
              <tbody>
                {buyerData.map((row, i) => (
                  <tr key={row.buyer} style={{ backgroundColor: i % 2 === 1 ? NEUTRAL_COLORS.panelBg : BRAND_COLORS.cards, borderBottom: '1px solid #F0F0F0' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#000000' }}>{row.buyer}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: NEUTRAL_COLORS.textDark }}>{row.count}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: NEUTRAL_COLORS.textDark }}>{row.avgStage}</td>
                  </tr>
                ))}
                {/* Total row */}
                <tr style={{ backgroundColor: NEUTRAL_COLORS.panelBg, borderTop: `2px solid ${NEUTRAL_COLORS.borderLight}` }}>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#000000' }}>Total / Average</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#000000' }}>{totalBuyerSuppliers}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: BRAND_COLORS.sidebar }}>—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CSS animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
