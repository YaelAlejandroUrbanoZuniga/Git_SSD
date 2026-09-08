import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding, faTimeline, faCalendarCheck, faBan,
  faArrowRight, faCalendar, faMapMarkerAlt, faCircleCheck,
  faClockRotateLeft, faChartSimple, faLayerGroup, faGaugeHigh,
  faBinoculars, faCirclePause, faClipboardCheck, faFileContract,
  faHandshake, faCalendarPlus, faCircleInfo, faChevronLeft, faChevronRight,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { useEffect, useRef, useState } from 'react';
import type {
  BlacklistedSupplier, CompletedSupplier, TrackerSupplier, ScoutingEvent, RecentActivityItem,
} from '../types';
import { TRACKER_STAGE_CONFIG, type StageConfigEntry } from '../constants/stage-config';
import {
  getBlacklistedSuppliers, getCompletedSuppliers, getTrackerSuppliers,
} from '../services/suppliersService';
import { getScoutingEvents } from '../services/eventsService';
import { getRecentActivity } from '../services/reportsService';
import { ApiError } from '../services/api.config';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { relativeLabel } from '../utils/date-helpers';
import { slaColors, slaLabels } from '../utils/tracker-helpers';
import { LoadingState } from '../components/LoadingState';
import { PAGE_FETCH_DELAY_MS } from '../components/loadingDelays';
import { KpiCard } from '../components/KpiCard';
import { CardHeader } from '../components/CardHeader';
import { moduleIcons } from '../components/moduleIcons';
import { HomeGuestView } from './HomeGuestView';
import { ACCENT_COLORS, BRAND_COLORS, NEUTRAL_COLORS } from '../constants/designTokens';

type ActivityItem = { icon: typeof faArrowRight; color: string; text: string; time: string };

/** How many rows the "Recent Activity" card actually shows. */
const RECENT_ACTIVITY_LIMIT = 8;

/** `TRACKER_STAGE_CONFIG.icon` (a FontAwesome class name) → the definition the
 *  component renders. Same map `GlobalHeader.tsx`'s `stageStyle` keeps, kept as
 *  its own local copy here since that map is module-private there. */
const stageIconByName: Record<string, IconDefinition> = {
  'fa-binoculars':      faBinoculars,
  'fa-circle-pause':    faCirclePause,
  'fa-clipboard-check': faClipboardCheck,
  'fa-file-contract':   faFileContract,
  'fa-handshake':       faHandshake,
  'fa-circle-check':    faCircleCheck,
  'fa-ban':             faBan,
};

/** Every stage's `{icon, colour}`, keyed by stage name — read straight out of
 *  `TRACKER_STAGE_CONFIG`, so no stage colour is ever typed twice. */
const stageStyle = Object.fromEntries(
  TRACKER_STAGE_CONFIG.map(s => [s.name, {
    icon: stageIconByName[s.icon] ?? faCircleInfo,
    color: s.color,
  }]),
) as Record<StageConfigEntry['name'], { icon: IconDefinition; color: string }>;

/** Same accent `event_created` gets in `GlobalHeader.tsx`'s `categoryStyle`. */
const EVENT_CREATED_STYLE = { icon: faCalendarPlus, color: '#04BF6E' };

function activityFor(item: RecentActivityItem): ActivityItem {
  if (item.type === 'event_created') {
    return {
      icon: EVENT_CREATED_STYLE.icon,
      color: EVENT_CREATED_STYLE.color,
      text: `${item.eventName} · new scouting event registered`,
      time: relativeLabel(item.timestamp),
    };
  }
  const style = stageStyle[item.toStage as StageConfigEntry['name']] ?? { icon: faCircleInfo, color: BRAND_COLORS.sidebar };
  const text = item.fromStage
    ? `${item.supplierName} moved from ${item.fromStage} to ${item.toStage}`
    : `${item.supplierName} entered ${item.toStage}`;
  return { icon: style.icon, color: style.color, text, time: relativeLabel(item.timestamp) };
}

/** All Home derivations in one pass, so the JSX reads pre-computed values. */
function buildHomeData(
  tracker: TrackerSupplier[],
  blacklisted: BlacklistedSupplier[],
  completed: CompletedSupplier[],
  events: ScoutingEvent[],
  recentActivity: RecentActivityItem[],
) {
  const allSuppliers = [...tracker, ...blacklisted, ...completed];

  const stageCounts = TRACKER_STAGE_CONFIG
    .filter(cfg => cfg.name !== 'Blacklisted' && cfg.name !== 'Completed')
    .map(cfg => ({
      name: cfg.name,
      color: cfg.color,
      count: tracker.filter(s => s.stage === cfg.name).length,
    }));

  const commodityCounts: Record<string, number> = {};
  allSuppliers.forEach(s => { commodityCounts[s.commodity] = (commodityCounts[s.commodity] || 0) + 1; });
  const topCommodities = Object.entries(commodityCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const upcomingEvents = events
    .filter(e => e.status === 'Upcoming' || e.status === 'Ongoing')
    .sort((a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime())
    .slice(0, 3);

  const activityItems: ActivityItem[] = recentActivity.map(activityFor);

  // globalSla is the full-cycle SLA — meaningful for every active supplier,
  // unlike the per-stage `sla` field which only has a real threshold for
  // Parking Lot / Preliminary Evaluation. null means the supplier hasn't yet
  // reached Parking Lot, so it gets its own neutral bucket rather than being
  // folded into 'green' or dropped.
  const slaBuckets = [
    { key: 'green' as const, label: slaLabels.green, color: slaColors.green, count: tracker.filter(s => s.globalSla === 'green').length },
    { key: 'yellow' as const, label: slaLabels.yellow, color: slaColors.yellow, count: tracker.filter(s => s.globalSla === 'yellow').length },
    { key: 'red' as const, label: slaLabels.red, color: slaColors.red, count: tracker.filter(s => s.globalSla === 'red').length },
    { key: 'none' as const, label: 'Not started', color: NEUTRAL_COLORS.border, count: tracker.filter(s => s.globalSla === null).length },
  ];

  // Carousel candidates for the SLA Overview card: most-overdue red suppliers
  // first, then yellow ones filling any remaining slots — never green/null.
  // Computed once here (not on every render/navigation) since the tracker
  // snapshot only reflects reality as of this page load.
  const byDaysDesc = (a: TrackerSupplier, b: TrackerSupplier) => (b.daysSinceParkingLot ?? 0) - (a.daysSinceParkingLot ?? 0);
  const criticalSuppliers = [
    ...tracker.filter(s => s.globalSla === 'red').sort(byDaysDesc),
    ...tracker.filter(s => s.globalSla === 'yellow').sort(byDaysDesc),
  ].slice(0, 10);

  return {
    activeSuppliers: allSuppliers.length,
    inTracker: tracker.length,
    blacklistedCount: blacklisted.length,
    completedCount: completed.length,
    upcomingEventsCount: events.filter(e => e.status === 'Upcoming').length,
    eventsThisMonth: events.filter(e => e.status === 'Upcoming' || e.status === 'Ongoing').length,
    stageCounts,
    totalInTracker: stageCounts.reduce((a, s) => a + s.count, 0),
    maxStageCount: Math.max(1, ...stageCounts.map(s => s.count)),
    topCommodities,
    maxCommodityCount: topCommodities[0]?.[1] || 1,
    totalCommodities: Object.keys(commodityCounts).length,
    upcomingEvents,
    activityItems,
    slaBuckets,
    maxSlaCount: Math.max(1, ...slaBuckets.map(b => b.count)),
    criticalSuppliers,
  };
}

/** Meaning of each SLA bucket, in terms of `globalSla`'s own day thresholds
 *  (not the per-stage `sla` thresholds, which don't apply to this card). These
 *  numbers must be kept in sync with `GLOBAL_THRESHOLDS` (`{ yellow: 75, red: 90 }`)
 *  in `backend/src/domain/sla.ts` if that ever changes. */
const slaLegendBlurbs: Record<'green' | 'yellow' | 'red' | 'none', string> = {
  green: 'Within 75 days of entering Parking Lot.',
  yellow: '75–89 days since entering Parking Lot.',
  red: '90+ days since entering Parking Lot.',
  none: "Hasn't reached Parking Lot yet — the global clock hasn't started.",
};

// ── Critical suppliers stack (SLA Overview card) ───────────────────────
// The card width is no longer a fixed pixel constant — it's derived from the
// stack container's own measured width (see `criticalStackWidth` state in
// HomeFullView, fed by a ResizeObserver) so the stack shrinks gracefully
// instead of overflowing when the container gets narrower than the old fixed
// span (288 * 0.92 * 2 ≈ 530px) — which happens at ordinary zoomed-out
// browser states, not just extreme ones. `CRITICAL_STACK_CARD_WIDTH_FRACTION`
// (~0.36) reproduces the previous 288px width at the container size that
// sizing was originally tuned against (a 60%-of-row SLA Overview card at
// default zoom), while `_MIN`/`_MAX` bound it so the layout never collapses
// too small to read nor balloons on very wide screens. `overflow: hidden` on
// the container is kept as a hard safety net for extreme cases only — normal
// sizing should keep the side cards fully visible without ever relying on it.
const CRITICAL_STACK_CARD_WIDTH_FRACTION = 0.36;
const CRITICAL_STACK_MIN_CARD_WIDTH = 200;
const CRITICAL_STACK_MAX_CARD_WIDTH = 320;
const CRITICAL_STACK_CARD_WIDTH_DEFAULT = 288; // used only before the first ResizeObserver measurement
// Side scale/offset are chosen so the center card's edge (at cardWidth*0.5
// from center, since its own scale is 1) never overlaps the adjacent side
// card's inner edge (at cardWidth*(OFFSET - SCALE/2) from center) — these two
// fractions are dimensionless ratios of cardWidth, so the gap they produce
// (OFFSET - SCALE/2 - 0.5 = 0.02, i.e. ~2% of cardWidth) holds at every card
// width the responsive sizing can produce (MIN..MAX above), not just the
// default. At the previous 0.9/0.92 pair that gap was negative (-0.03), which
// is what made the center card's border visually cross the side card's
// border instead of cleanly overlapping it with a peek. The side cards'
// *outer* edge (OFFSET + SCALE/2 = 1.37*cardWidth) is unchanged from before,
// so the existing container-fit margin (tuned previously against the
// ResizeObserver's ~0.36 width fraction) is preserved.
const CRITICAL_STACK_SIDE_SCALE = 0.85;
const CRITICAL_STACK_SIDE_OFFSET = 0.945; // fraction of card width
// Used as a `minHeight` safety net on the stack container, not a fixed
// height — the container sizes via `flex: 1` to fill whatever vertical
// space the "Critical Suppliers" card has left, so this only guards
// against the column collapsing to an unusably short height.
const CRITICAL_STACK_HEIGHT = 92;

/** One critical-supplier card, reused for the center (active) layer and the
 *  two peeking side layers — only position/scale/z-index/background differ
 *  between them, never the content or the stage border. Side layers use the
 *  same opaque `BRAND_COLORS.cards` surface as every other card in the app
 *  (never the center layer's tint) so the center card reads as one opaque
 *  card genuinely in front of another, not as transparency.
 *
 *  `transform`/`box-shadow` are transitioned (0.2s, matching this app's
 *  existing 0.12s-0.3s transition language — see Sidebar/Dashboard/
 *  FilterPanel/GlobalHeader) so that when a caller keeps the same React key
 *  across a re-render (see the three call sites below, keyed by supplier id)
 *  the position/scale swap between slots animates instead of jumping. z-index
 *  itself can't be transitioned — the swap there is instant, which reads fine
 *  because the transform motion carries all the visible weight. */
function CriticalSupplierLayer({ supplier, width, offsetPx, scale, zIndex, tinted, onClick }: {
  supplier: TrackerSupplier; width: number; offsetPx: number; scale: number; zIndex: number; tinted: boolean; onClick: () => void;
}) {
  const style = stageStyle[supplier.stage];
  const slaKey = supplier.globalSla as 'red' | 'yellow';
  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute', top: '50%', left: '50%', width,
        transform: `translate(-50%, -50%) translateX(${offsetPx}px) scale(${scale})`,
        transition: 'transform 0.2s ease-out, box-shadow 0.2s ease-out',
        zIndex, cursor: 'pointer', borderRadius: 8, padding: 40,
        backgroundColor: tinted ? `${style.color}14` : BRAND_COLORS.cards,
        border: `2px solid ${style.color}`,
        boxShadow: tinted ? '0 2px 8px rgba(0,0,0,0.15)' : '0 1px 4px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
            backgroundColor: `${style.color}26`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FontAwesomeIcon icon={style.icon} style={{ fontSize: 10, color: style.color }} />
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#000000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {supplier.name}
          </span>
        </span>
        <span
          className={slaKey === 'red' ? 'ssd-critical-badge-blink' : undefined}
          style={{
            fontSize: 10, fontWeight: 700, color: '#FFFFFF', padding: '2px 8px', borderRadius: 10, flexShrink: 0,
            backgroundColor: slaColors[slaKey],
          }}
        >
          {slaLabels[slaKey]}
        </span>
      </div>
      <p style={{ fontSize: 11, color: NEUTRAL_COLORS.textDark, margin: '0 0 6px' }}>
        Folio {supplier.folio} · {supplier.commodity}
      </p>
      <p style={{ fontSize: 11, color: NEUTRAL_COLORS.textDark, margin: 0 }}>
        {supplier.stage} · {supplier.daysSinceParkingLot ?? 0} days in the global cycle
      </p>
    </div>
  );
}

const EMPTY_HOME = buildHomeData([], [], [], [], []);

function formatCurrentDate(): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const now = new Date();
  return `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
}

/** Dispatches to the anonymous Guest view or the full dashboard by role. */
export function Inicio() {
  const { user } = useAuth();
  if (user?.role === 'Guest') return <HomeGuestView />;
  return <HomeFullView />;
}

function HomeFullView() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0];
  const [data, setData] = useState(EMPTY_HOME);
  const [loading, setLoading] = useState(true);
  const [criticalIndex, setCriticalIndex] = useState(0);
  const criticalStackRef = useRef<HTMLDivElement>(null);
  const [criticalStackWidth, setCriticalStackWidth] = useState(0);

  // Measures the stack's actual rendered width so card sizing can adapt to
  // it instead of relying on a fixed pixel constant that can exceed the
  // container at narrower effective viewport widths (browser zoom-out, a
  // narrower monitor). See the CRITICAL_STACK_CARD_WIDTH_* constants above.
  useEffect(() => {
    const el = criticalStackRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) setCriticalStackWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getTrackerSuppliers(), getBlacklistedSuppliers(), getCompletedSuppliers(), getScoutingEvents(),
      getRecentActivity(RECENT_ACTIVITY_LIMIT),
    ])
      .then(([tracker, blacklisted, completed, events, recentActivity]) => {
        if (!cancelled) {
          setData(buildHomeData(tracker, blacklisted, completed, events, recentActivity));
          setCriticalIndex(0);
        }
      })
      .catch(err => {
        if (!cancelled) {
          toast.systemError(err instanceof ApiError ? err.message : 'Could not load the home dashboard.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [toast]);

  // Every KPI, chart and feed here comes from the same five fetches, so the page
  // waits instead of painting a full dashboard of zeros first.
  if (loading) {
    return <LoadingState entity="Home" icon={moduleIcons.home} fill delayMs={PAGE_FETCH_DELAY_MS} />;
  }

  const {
    activeSuppliers, inTracker, blacklistedCount, completedCount, upcomingEventsCount,
    eventsThisMonth, stageCounts, topCommodities,
    maxCommodityCount, totalCommodities, upcomingEvents, activityItems,
    slaBuckets, maxSlaCount, criticalSuppliers,
  } = data;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>{firstName ? `Welcome, ${firstName}` : 'Welcome'}</h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: BRAND_COLORS.sidebar, margin: '4px 0 0' }}>
            Control Panel · SSD Tracker Management
          </p>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: BRAND_COLORS.sidebar, paddingTop: 8 }}>
          <FontAwesomeIcon icon={faCalendar} style={{ fontSize: 12 }} />
          {formatCurrentDate()}
        </span>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard label="Active Suppliers" value={activeSuppliers} icon={faBuilding} color={ACCENT_COLORS.purple} sub={`${blacklistedCount} blacklisted`} />
        <KpiCard label="Active in Tracker" value={inTracker} icon={faTimeline} color="#02B3E1" sub={`${completedCount} completed to date`} />
        <KpiCard label="Events this month" value={eventsThisMonth} icon={faCalendarCheck} color={ACCENT_COLORS.info} sub={`${upcomingEventsCount} upcoming`} />
        <KpiCard label="Blacklisted" value={blacklistedCount} icon={faBan} color="#000000" sub="rejected suppliers" />
        <KpiCard label="Completed" value={completedCount} icon={faCircleCheck} color="#6ABF4B" sub="approved suppliers" />
      </div>

      {/* Middle section: 60/40 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {/* SLA Overview + Critical Suppliers - 60%, stacked. Two cards
            instead of one so each gets its own header/icon, while the column
            they share keeps the same 60% slot and overall height the single
            card previously occupied: "SLA Overview" sizes to its natural
            content height and "Critical Suppliers" takes the rest via
            `flex: 1`, same pattern the stack itself already used internally.
            The row's `align-items: stretch` default still sets this column's
            total height equal to "Recent Activity" (flex: 1, 40%) below, so
            the bottom KPI/grid rows are not affected by the split. */}
        <div style={{ flex: '0 0 60%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* SLA Overview */}
          <div style={{
            backgroundColor: BRAND_COLORS.cards, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20,
          }}>
            <CardHeader
              icon={faGaugeHigh}
              iconColor={BRAND_COLORS.accentRed}
              title="SLA Overview"
              action={{ label: 'View Tracker →', onClick: () => navigate('/tracker') }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {slaBuckets.map(bucket => (
                <div key={bucket.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: BRAND_COLORS.sidebar, width: 148, textAlign: 'right', flexShrink: 0 }}>
                    {bucket.label}
                  </span>
                  <div style={{ flex: 1, backgroundColor: BRAND_COLORS.background, borderRadius: 4, height: 20, position: 'relative', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${(bucket.count / maxSlaCount) * 100}%`,
                      backgroundColor: bucket.color,
                      borderRadius: 4,
                      minWidth: bucket.count > 0 ? 20 : 0,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#000000', width: 20, textAlign: 'right' }}>
                    {bucket.count}
                  </span>
                </div>
              ))}
            </div>

            {/* Legend — what puts a supplier in each bucket, no day thresholds
                stated (those live only in backend/src/domain/sla.ts). */}
            <div style={{
              marginTop: 16, borderTop: `1px solid ${NEUTRAL_COLORS.border}`, paddingTop: 12,
              display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
            }}>
              {slaBuckets.map(bucket => (
                <div key={bucket.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: bucket.color, flexShrink: 0, marginTop: 3 }} />
                  <span style={{ fontSize: 11, color: BRAND_COLORS.sidebar, lineHeight: 1.4 }}>
                    <strong style={{ color: '#000000', fontWeight: 700 }}>{bucket.label}:</strong> {slaLegendBlurbs[bucket.key]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Critical Suppliers — up to 10 red/yellow suppliers, computed
              once when the page's data loads. Circular navigation: the
              center card is the active supplier, with the previous/next
              suppliers peeking out on either side (uncropped, just scaled
              down and layered behind via z-index). `flex: 1` on this card
              lets it absorb whatever height the column has left after "SLA
              Overview" above, so the pair together still reads the same
              total height as "Recent Activity" alongside them. */}
          <div style={{
            backgroundColor: BRAND_COLORS.cards, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20,
            flex: 1, display: 'flex', flexDirection: 'column',
          }}>
            <CardHeader
              icon={faTriangleExclamation}
              iconColor={BRAND_COLORS.accentRed}
              title="Critical Suppliers"
            />
            {/* Scoped pulse animation for the "Overdue" badge, following the
                same local-<style>-block + prefers-reduced-motion pattern as
                LoadingState.tsx's spinner — no animation library involved.
                Slower/gentler (1.8s, opacity 1 -> 0.6) than that 1.1s spin
                since this sits passively on a dashboard rather than signaling
                a transient wait. */}
            <style>{`
              .ssd-critical-badge-blink { animation: ssd-critical-badge-pulse 1.8s ease-in-out infinite; }
              @keyframes ssd-critical-badge-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
              }
              @media (prefers-reduced-motion: reduce) {
                .ssd-critical-badge-blink { animation: none; }
              }
            `}</style>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: criticalSuppliers.length === 0 ? 'center' : 'flex-start' }}>
            {criticalSuppliers.length === 0 ? (
              <div style={{ textAlign: 'center' }}>
                <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 18, color: slaColors.green, marginBottom: 6 }} />
                <p style={{ fontSize: 12, color: BRAND_COLORS.sidebar, margin: 0 }}>All correct — suppliers on track, nothing critical to flag.</p>
              </div>
            ) : (() => {
              const total = criticalSuppliers.length;
              const prevIndex = (criticalIndex - 1 + total) % total;
              const nextIndex = (criticalIndex + 1) % total;
              // Responsive card width: a bounded fraction of the container's
              // actual measured width (see criticalStackWidth above), falling
              // back to the previously-tuned fixed width before the first
              // ResizeObserver measurement lands.
              const cardWidth = criticalStackWidth > 0
                ? Math.min(CRITICAL_STACK_MAX_CARD_WIDTH, Math.max(CRITICAL_STACK_MIN_CARD_WIDTH, criticalStackWidth * CRITICAL_STACK_CARD_WIDTH_FRACTION))
                : CRITICAL_STACK_CARD_WIDTH_DEFAULT;
              const sideOffsetPx = cardWidth * CRITICAL_STACK_SIDE_OFFSET;
              // Side slots only collide on the same supplier when there are
              // exactly 2 critical suppliers (prevIndex === nextIndex); a
              // disambiguating suffix avoids a duplicate React key there. In
              // every other case the plain supplier id is kept as the key so
              // that navigating re-parents the same DOM node across slots
              // (center -> prev, next -> center) and the transform transition
              // above actually animates instead of popping — see
              // CriticalSupplierLayer's docblock.
              const sameSideSupplier = prevIndex === nextIndex;
              const prevKey = sameSideSupplier ? `${criticalSuppliers[prevIndex].id}-prev` : criticalSuppliers[prevIndex].id;
              const nextKey = sameSideSupplier ? `${criticalSuppliers[nextIndex].id}-next` : criticalSuppliers[nextIndex].id;
              return (
                <>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setCriticalIndex(i => (i - 1 + total) % total)}
                      style={{
                        width: 34, height: 34, flexShrink: 0, borderRadius: '50%', border: 'none',
                        backgroundColor: BRAND_COLORS.background, color: BRAND_COLORS.sidebar,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      }}
                    >
                      <FontAwesomeIcon icon={faChevronLeft} style={{ fontSize: 15 }} />
                    </button>

                    <div ref={criticalStackRef} style={{ position: 'relative', flex: 1, alignSelf: 'stretch', minHeight: CRITICAL_STACK_HEIGHT, overflow: 'hidden' }}>
                      {total > 1 && (
                        <CriticalSupplierLayer
                          key={prevKey}
                          supplier={criticalSuppliers[prevIndex]}
                          width={cardWidth}
                          offsetPx={-sideOffsetPx}
                          scale={CRITICAL_STACK_SIDE_SCALE}
                          zIndex={1}
                          tinted={false}
                          onClick={() => setCriticalIndex(prevIndex)}
                        />
                      )}
                      <CriticalSupplierLayer
                        key={criticalSuppliers[criticalIndex].id}
                        supplier={criticalSuppliers[criticalIndex]}
                        width={cardWidth}
                        offsetPx={0}
                        scale={1}
                        zIndex={3}
                        tinted={false}
                        onClick={() => navigate(`/tracker/supplier/${criticalSuppliers[criticalIndex].id}`)}
                      />
                      {total > 1 && (
                        <CriticalSupplierLayer
                          key={nextKey}
                          supplier={criticalSuppliers[nextIndex]}
                          width={cardWidth}
                          offsetPx={sideOffsetPx}
                          scale={CRITICAL_STACK_SIDE_SCALE}
                          zIndex={1}
                          tinted={false}
                          onClick={() => setCriticalIndex(nextIndex)}
                        />
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setCriticalIndex(i => (i + 1) % total)}
                      style={{
                        width: 34, height: 34, flexShrink: 0, borderRadius: '50%', border: 'none',
                        backgroundColor: BRAND_COLORS.background, color: BRAND_COLORS.sidebar,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      }}
                    >
                      <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 15 }} />
                    </button>
                  </div>
                </>
              );
            })()}
            </div>
          </div>
        </div>

        {/* Recent Activity - 40% */}
        <div style={{ flex: 1, backgroundColor: BRAND_COLORS.cards, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
          <CardHeader icon={faClockRotateLeft} iconColor={ACCENT_COLORS.purple} title="Recent Activity" />

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {activityItems.map((item, i) => (
              <div key={i}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0' }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    backgroundColor: item.color + '1F',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <FontAwesomeIcon icon={item.icon} style={{ fontSize: 10, color: item.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, color: '#000000', margin: 0 }}>{item.text}</p>
                    <p style={{ fontSize: 11, color: BRAND_COLORS.sidebar, margin: '2px 0 0' }}>{item.time}</p>
                  </div>
                </div>
                {i < activityItems.length - 1 && (
                  <div style={{ borderBottom: `1px solid ${NEUTRAL_COLORS.border}` }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom section: 3 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {/* Upcoming Events */}
        <div style={{ backgroundColor: BRAND_COLORS.cards, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
          <CardHeader
            icon={faCalendar}
            iconColor={ACCENT_COLORS.pink}
            title="Upcoming Events"
            action={{ label: 'View all →', onClick: () => navigate('/events') }}
          />

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {upcomingEvents.map((evt, i) => {
              const startDate = new Date(evt.dateStart + 'T00:00:00');
              const monthsShort = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
              const statusColor = evt.status === 'Ongoing' ? ACCENT_COLORS.info : ACCENT_COLORS.pink;
              return (
                <div key={evt.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 6, flexShrink: 0,
                      backgroundColor: statusColor,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: BRAND_COLORS.cards, lineHeight: 1 }}>
                        {monthsShort[startDate.getMonth()]}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: BRAND_COLORS.cards, lineHeight: 1.2 }}>
                        {startDate.getDate()}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#000000', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {evt.name}
                      </p>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: BRAND_COLORS.sidebar, marginTop: 2 }}>
                        <FontAwesomeIcon icon={faMapMarkerAlt} style={{ fontSize: 9 }} />
                        {evt.location}
                      </span>
                    </div>
                  </div>
                  {i < upcomingEvents.length - 1 && (
                    <div style={{ borderBottom: `1px solid ${NEUTRAL_COLORS.border}` }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tracker by Stage */}
        <div style={{ backgroundColor: BRAND_COLORS.cards, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
          <CardHeader
            icon={faChartSimple}
            iconColor={ACCENT_COLORS.info}
            title="Tracker by Stage"
            action={{ label: 'View Tracker →', onClick: () => navigate('/tracker') }}
          />

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {stageCounts.map((stage, i) => (
              <div key={stage.name}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: stage.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#000000' }}>{stage.name}</span>
                  </span>
                  <span style={{ fontSize: 13, color: BRAND_COLORS.sidebar }}>{stage.count}</span>
                </div>
                {i < stageCounts.length - 1 && (
                  <div style={{ borderBottom: `1px solid ${NEUTRAL_COLORS.border}` }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Top Commodities */}
        <div style={{ backgroundColor: BRAND_COLORS.cards, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
          <CardHeader icon={faLayerGroup} iconColor="#D4A017" title="Top Commodities" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topCommodities.map(([name, count]) => (
              <div key={name}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: '#000000' }}>{name}</span>
                  <span style={{ fontSize: 11, color: BRAND_COLORS.sidebar }}>{count}</span>
                </div>
                <div style={{ height: 4, backgroundColor: BRAND_COLORS.background, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(count / maxCommodityCount) * 100}%`, backgroundColor: '#02B3E1', borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11, color: BRAND_COLORS.sidebar, margin: '16px 0 0' }}>{totalCommodities} distinct commodities in the system</p>
        </div>
      </div>
    </div>
  );
}
