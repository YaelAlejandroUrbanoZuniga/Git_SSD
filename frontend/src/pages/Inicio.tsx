import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding, faTimeline, faCalendarCheck, faBan, 
  faArrowRight, faPlus, faClipboardCheck, faClipboardList,
  faCalendar, faMapMarkerAlt, faCheckCircle, faCircleCheck,
} from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from 'react';
import type { BlacklistedSupplier, CompletedSupplier, TrackerSupplier, ScoutingEvent } from '../types';
import { TRACKER_STAGE_CONFIG } from '../constants/stage-config';
import {
  getBlacklistedSuppliers, getCompletedSuppliers, getTrackerSuppliers,
} from '../services/suppliersService';
import { getScoutingEvents } from '../services/eventsService';
import { ApiError } from '../services/api.config';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { relativeLabel } from '../utils/date-helpers';
import { LoadingState } from '../components/LoadingState';
import { HomeGuestView } from './HomeGuestView';

type ActivityItem = { icon: typeof faArrowRight; color: string; text: string; time: string };

/** All Home derivations in one pass, so the JSX reads pre-computed values. */
function buildHomeData(
  tracker: TrackerSupplier[],
  blacklisted: BlacklistedSupplier[],
  completed: CompletedSupplier[],
  events: ScoutingEvent[],
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

  const intelexSupplier = tracker.find(s => s.stage === 'Intelex Handoff');
  const evalSupplier = tracker.find(s => s.stage === 'Supplier Evaluation');
  const prelimSupplier = tracker.find(s => s.stage === 'Preliminary Evaluation');
  const blacklistedActivity = blacklisted[0];
  const parkingActivity = tracker.filter(s => s.stage === 'Parking Lot').slice(0, 2);

  // Each activity item's timestamp is derived from the real date that object
  // carries from the server (stage entry, completion or rejection) via
  // relativeLabel — never a hardcoded string. Missing dates fall back to 'Recently'.
  const activityItems: ActivityItem[] = [
    ...(intelexSupplier ? [{ icon: faCheckCircle, color: '#6ABF4B', text: `${intelexSupplier.name} · advancing in Intelex Handoff`, time: relativeLabel(intelexSupplier.stageEnteredAt) }] : []),
    ...(completed[0] ? [{ icon: faCircleCheck, color: '#6ABF4B', text: `${completed[0].name} · completed the full SSD tracker`, time: relativeLabel(completed[0].completedDate) }] : []),
    ...(evalSupplier ? [{ icon: faClipboardCheck, color: '#E3650B', text: `${evalSupplier.name} · under Supplier Evaluation`, time: relativeLabel(evalSupplier.stageEnteredAt) }] : []),
    ...(prelimSupplier ? [{ icon: faClipboardList, color: '#02B3E1', text: `${prelimSupplier.name} · entered Preliminary Evaluation`, time: relativeLabel(prelimSupplier.stageEnteredAt) }] : []),
    ...(blacklistedActivity ? [{ icon: faBan, color: '#000000', text: `${blacklistedActivity.name} · rejected and moved to Blacklisted`, time: relativeLabel(blacklistedActivity.rejectionDate) }] : []),
    ...(parkingActivity[0] ? [{ icon: faPlus, color: '#D4A017', text: `${parkingActivity[0].name} · registered in Parking Lot`, time: relativeLabel(parkingActivity[0].stageEnteredAt) }] : []),
    ...(parkingActivity[1] ? [{ icon: faPlus, color: '#D4A017', text: `${parkingActivity[1].name} · registered in Parking Lot`, time: relativeLabel(parkingActivity[1].stageEnteredAt) }] : []),
  ];

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
  };
}

const EMPTY_HOME = buildHomeData([], [], [], []);

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
  const [data, setData] = useState(EMPTY_HOME);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getTrackerSuppliers(), getBlacklistedSuppliers(), getCompletedSuppliers(), getScoutingEvents(),
    ])
      .then(([tracker, blacklisted, completed, events]) => {
        if (!cancelled) setData(buildHomeData(tracker, blacklisted, completed, events));
      })
      .catch(err => {
        if (!cancelled) {
          toast.systemError(err instanceof ApiError ? err.message : 'Could not load the home dashboard.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [toast]);

  // Every KPI, chart and feed here comes from the same four fetches, so the page
  // waits instead of painting a full dashboard of zeros first.
  if (loading) {
    return <LoadingState entity="Home" />;
  }

  const {
    activeSuppliers, inTracker, blacklistedCount, completedCount, upcomingEventsCount,
    eventsThisMonth, stageCounts, totalInTracker, maxStageCount, topCommodities,
    maxCommodityCount, totalCommodities, upcomingEvents, activityItems,
  } = data;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Welcome, Yael</h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>
            Control Panel · SSD Tracker Management
          </p>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#808285', paddingTop: 8 }}>
          <FontAwesomeIcon icon={faCalendar} style={{ fontSize: 12 }} />
          {formatCurrentDate()}
        </span>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
        {/* KPI 1 - Active Suppliers */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#808285' }}>Active Suppliers</span>
            <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#6ABF4B1F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesomeIcon icon={faBuilding} style={{ fontSize: 18, color: '#6ABF4B' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: '#000000' }}>{activeSuppliers}</span>
            <span style={{ fontSize: 11, color: '#808285' }}>{blacklistedCount} blacklisted</span>
          </div>
        </div>

        {/* KPI 2 - Active in Tracker */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#808285' }}>Active in Tracker</span>
            <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#02B3E11F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesomeIcon icon={faTimeline} style={{ fontSize: 18, color: '#02B3E1' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: '#000000' }}>{inTracker}</span>
            <span style={{ fontSize: 11, color: '#808285' }}>{inTracker} active</span>
          </div>
        </div>

        {/* KPI 3 - Events this month */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#808285' }}>Events this month</span>
            <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#6366F11F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesomeIcon icon={faCalendarCheck} style={{ fontSize: 18, color: '#6366F1' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: '#000000' }}>{eventsThisMonth}</span>
            <span style={{ fontSize: 11, color: '#808285' }}>{upcomingEventsCount} upcoming</span>
          </div>
        </div>

        {/* KPI 4 - Blacklisted */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#808285' }}>Blacklisted</span>
            <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#0000001F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesomeIcon icon={faBan} style={{ fontSize: 18, color: '#000000' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: '#000000' }}>{blacklistedCount}</span>
            <span style={{ fontSize: 11, color: '#808285' }}>rejected suppliers</span>
          </div>
        </div>

        {/* KPI 5 - Completed */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#808285' }}>Completed</span>
            <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#6ABF4B1F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 18, color: '#6ABF4B' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: '#000000' }}>{completedCount}</span>
            <span style={{ fontSize: 11, color: '#808285' }}>approved suppliers</span>
          </div>
        </div>
      </div>

      {/* Middle section: 60/40 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {/* Tracker Overview - 60% */}
        <div style={{ flex: '0 0 60%', backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 }}>Tracker Overview</h2>
            <button
              onClick={() => navigate('/tracker')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#0084C0', padding: 0 }}
            >
              View Tracker &rarr;
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {stageCounts.map(stage => (
              <div key={stage.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: '#808285', width: 148, textAlign: 'right', flexShrink: 0 }}>
                  {stage.name}
                </span>
                <div style={{ flex: 1, backgroundColor: '#EEEEEE', borderRadius: 4, height: 20, position: 'relative', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(stage.count / maxStageCount) * 100}%`,
                    backgroundColor: stage.color,
                    borderRadius: 4,
                    minWidth: stage.count > 0 ? 20 : 0,
                    transition: 'width 0.3s',
                  }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#000000', width: 20, textAlign: 'right' }}>
                  {stage.count}
                </span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: '#808285', width: 148, textAlign: 'right', flexShrink: 0 }}>
                Completed
              </span>
              <div style={{ flex: 1, backgroundColor: '#EEEEEE', borderRadius: 4, height: 20, position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(completedCount / maxStageCount) * 100}%`,
                  backgroundColor: '#6ABF4B',
                  borderRadius: 4,
                  minWidth: completedCount > 0 ? 20 : 0,
                  transition: 'width 0.3s',
                }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#000000', width: 20, textAlign: 'right' }}>
                {completedCount}
              </span>
            </div>
          </div>

          <div style={{ marginTop: 16, borderTop: '0.5px solid #D1D3D4', paddingTop: 12 }}>
            <span style={{ fontSize: 12, color: '#808285' }}>Total in active tracker: {totalInTracker} suppliers</span>
          </div>
        </div>

        {/* Recent Activity - 40% */}
        <div style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 16px' }}>Recent Activity</h2>

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
                    <p style={{ fontSize: 11, color: '#808285', margin: '2px 0 0' }}>{item.time}</p>
                  </div>
                </div>
                {i < activityItems.length - 1 && (
                  <div style={{ borderBottom: '0.5px solid #D1D3D4' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom section: 3 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {/* Upcoming Events */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 }}>Upcoming Events</h2>
            <button
              onClick={() => navigate('/events')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#0084C0', padding: 0 }}
            >
              View all &rarr;
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {upcomingEvents.map((evt, i) => {
              const startDate = new Date(evt.dateStart + 'T00:00:00');
              const monthsShort = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
              const statusColor = evt.status === 'Ongoing' ? '#0084C0' : '#EC4899';
              return (
                <div key={evt.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 6, flexShrink: 0,
                      backgroundColor: statusColor,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}>
                        {monthsShort[startDate.getMonth()]}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.2 }}>
                        {startDate.getDate()}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#000000', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {evt.name}
                      </p>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#808285', marginTop: 2 }}>
                        <FontAwesomeIcon icon={faMapMarkerAlt} style={{ fontSize: 9 }} />
                        {evt.location}
                      </span>
                    </div>
                  </div>
                  {i < upcomingEvents.length - 1 && (
                    <div style={{ borderBottom: '0.5px solid #D1D3D4' }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tracker by Stage */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 }}>Tracker by Stage</h2>
            <button
              onClick={() => navigate('/tracker')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#0084C0', padding: 0 }}
            >
              View Tracker &rarr;
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {stageCounts.map((stage, i) => (
              <div key={stage.name}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: stage.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#000000' }}>{stage.name}</span>
                  </span>
                  <span style={{ fontSize: 13, color: '#808285' }}>{stage.count}</span>
                </div>
                {i < stageCounts.length - 1 && (
                  <div style={{ borderBottom: '0.5px solid #D1D3D4' }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Top Commodities */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 16px' }}>Top Commodities</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topCommodities.map(([name, count]) => (
              <div key={name}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: '#000000' }}>{name}</span>
                  <span style={{ fontSize: 11, color: '#808285' }}>{count}</span>
                </div>
                <div style={{ height: 4, backgroundColor: '#EEEEEE', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(count / maxCommodityCount) * 100}%`, backgroundColor: '#02B3E1', borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11, color: '#808285', margin: '16px 0 0' }}>{totalCommodities} distinct commodities in the system</p>
        </div>
      </div>
    </div>
  );
}
