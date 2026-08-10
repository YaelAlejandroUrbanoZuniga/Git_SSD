import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding, faCircleCheck, faBan, faCalendar, faMapMarkerAlt, faHouse,
} from '@fortawesome/free-solid-svg-icons';
import { LoadingState } from '../components/LoadingState';
import { KpiCard } from '../components/KpiCard';
import { getHomeSummary, type HomeSummary } from '../services/homeService';
import { ApiError } from '../services/api.config';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const CARD: React.CSSProperties = {
  backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20,
};

const MONTHS_SHORT = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/**
 * Simplified, ANONYMOUS home for the Guest role. It only ever calls
 * getHomeSummary() — never any supplier-returning service — so no supplier name,
 * folio or company ever reaches this screen. No activity feed, no add button, no
 * actions: it is purely informational.
 */
export function HomeGuestView() {
  const toast = useToast();
  const { user } = useAuth();
  const [data, setData] = useState<HomeSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getHomeSummary()
      .then(summary => { if (!cancelled) { setData(summary); setLoading(false); } })
      .catch(err => {
        if (cancelled) return;
        setLoading(false);
        toast.systemError(err instanceof ApiError ? err.message : 'Could not load the home summary.');
      });
    return () => { cancelled = true; };
  }, [toast]);

  const firstName = user?.displayName?.split(/\s+/)[0] ?? '';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>
            Welcome{firstName ? `, ${firstName}` : ''}
          </h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>
            SSD Tracker Management · Overview
          </p>
        </div>
      </div>

      {loading && <LoadingState entity="Home" icon={faHouse} style={{ padding: 80 }} />}

      {!loading && data && (
        <>
          {/* Stage KPI row — one card per working stage */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(data.stageCounts.length, 1)}, 1fr)`, gap: 16, marginBottom: 24 }}>
            {data.stageCounts.map(sc => (
              <div key={sc.stage} style={CARD}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: sc.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#808285', lineHeight: 1.2 }}>{sc.stage}</span>
                </div>
                <span style={{ fontSize: 30, fontWeight: 700, color: '#000000' }}>{sc.count}</span>
              </div>
            ))}
          </div>

          {/* Totals + Top commodities */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            {/* Totals — 3 cards */}
            <div style={{ flex: '0 0 40%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <KpiCard label="Active" value={data.totalActive} icon={faBuilding} color="#6ABF4B" />
              <KpiCard label="Completed" value={data.totalCompleted} icon={faCircleCheck} color="#6ABF4B" />
              <KpiCard label="Blacklisted" value={data.totalBlacklisted} icon={faBan} color="#000000" />
            </div>

            {/* Top commodities — bars, no supplier names */}
            <div style={{ flex: 1, ...CARD }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 16px' }}>Top Commodities</h2>
              {data.topCommodities.length === 0 ? (
                <p style={{ fontSize: 13, color: '#808285', margin: 0 }}>No data yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {data.topCommodities.map(tc => {
                    const max = data.topCommodities[0]?.count || 1;
                    return (
                      <div key={tc.commodity}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, color: '#000000' }}>{tc.commodity}</span>
                          <span style={{ fontSize: 11, color: '#808285' }}>{tc.count}</span>
                        </div>
                        <div style={{ height: 4, backgroundColor: '#EEEEEE', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(tc.count / max) * 100}%`, backgroundColor: '#02B3E1', borderRadius: 2 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming events — up to 3, informational only (no detail link) */}
          <div style={CARD}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 16px' }}>Upcoming Events</h2>
            {data.upcomingEvents.length === 0 ? (
              <p style={{ fontSize: 13, color: '#808285', margin: 0 }}>No upcoming events.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {data.upcomingEvents.map(evt => {
                  const startDate = new Date(evt.dateStart + 'T00:00:00');
                  return (
                    <div key={evt.id} style={{ display: 'flex', gap: 12, padding: 12, border: '0.5px solid #D1D3D4', borderRadius: 8 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 6, flexShrink: 0, backgroundColor: '#EC4899',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}>
                          {Number.isNaN(startDate.getTime()) ? '—' : MONTHS_SHORT[startDate.getMonth()]}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.2 }}>
                          {Number.isNaN(startDate.getTime()) ? '' : startDate.getDate()}
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#000000', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {evt.name}
                        </p>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#808285', marginTop: 4 }}>
                          <FontAwesomeIcon icon={faCalendar} style={{ fontSize: 9 }} />
                          {evt.dateStart}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#808285', marginTop: 2 }}>
                          <FontAwesomeIcon icon={faMapMarkerAlt} style={{ fontSize: 9 }} />
                          {evt.location}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
