import { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding, faCalendar, faMapMarkerAlt, faInbox, faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { LoadingState } from '../components/LoadingState';
import { PAGE_FETCH_DELAY_MS } from '../components/loadingDelays';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { CardHeader } from '../components/CardHeader';
import { KpiCard } from '../components/KpiCard';
import { EmptyState } from '../components/EmptyState';
import { moduleIcons } from '../components/moduleIcons';
import { getHomeSummary, type HomeSummary } from '../services/homeService';
import { ApiError } from '../services/api.config';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { STAGE_ICONS } from '../constants/stage-icons';
import { formatDate, MONTHS_SHORT, parseServerDate } from '../utils/date-helpers';
import { colors } from '../tokens/colors';
import { type, iconSize } from '../tokens/typography';
import { radius, gap, grids, heights, scale } from '../tokens/spacing';

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
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);

  const loadSummary = useCallback(() => {
    setLoading(true);
    setError(false);
    getHomeSummary()
      .then(summary => {
        if (!mountedRef.current) return;
        setData(summary);
        setLoading(false);
      })
      .catch(err => {
        if (!mountedRef.current) return;
        setLoading(false);
        setError(true);
        toast.systemError(err instanceof ApiError ? err.message : 'Could not load the home summary.');
      });
  }, [toast]);

  useEffect(() => {
    mountedRef.current = true;
    loadSummary();
    return () => { mountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firstName = user?.displayName?.split(/\s+/)[0] ?? '';

  return (
    <div>
      <PageHeader
        title={`Welcome${firstName ? `, ${firstName}` : ''}`}
        subtitle={data ? `${data.totalActive} active suppliers in the pipeline` : undefined}
      />

      {loading && (
        <LoadingState message="Loading Home…" icon={moduleIcons.home} fill delayMs={PAGE_FETCH_DELAY_MS} />
      )}

      {!loading && error && (
        <EmptyState
          icon={faTriangleExclamation}
          iconColor={colors.semantic.error}
          title="Could not load the home summary"
          description="Something went wrong while loading this page. Nothing on it is current."
          action={{ label: 'Try again', onClick: loadSummary }}
        />
      )}

      {!loading && !error && data && (
        <>
          {/* Per-stage KPI row. Fixed column count, not grids.kpiRow's auto-fit:
              auto-fit would wrap 5 stages as 4+1 instead of an even row. One KPI
              per stage is a deliberate deviation from the standard's generic
              "max 4, auto-fit" screen-KPI-row rule (UI_STANDARD.md §6.5). */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${data.stageCounts.length}, minmax(0, 1fr))`,
              gap: gap.kpiCards,
              marginBottom: gap.screenBlocks,
            }}
          >
            {data.stageCounts.map(sc => (
              <KpiCard
                key={sc.stage}
                label={sc.stage}
                value={sc.count}
                color={sc.color}
                icon={STAGE_ICONS[sc.stage]?.icon ?? faBuilding}
              />
            ))}
          </div>

          {/* Active / Completed / Blacklisted row */}
          <div style={{ display: 'grid', gridTemplateColumns: grids.kpiRow, gap: gap.kpiCards, marginBottom: gap.screenBlocks }}>
            <KpiCard label="Active" value={data.totalActive} icon={faBuilding} color={colors.reference.purple} />
            <KpiCard
              label="Completed"
              value={data.totalCompleted}
              icon={STAGE_ICONS.Completed?.icon ?? faBuilding}
              color={STAGE_ICONS.Completed?.color ?? colors.semantic.success}
            />
            <KpiCard
              label="Blacklisted"
              value={data.totalBlacklisted}
              icon={STAGE_ICONS.Blacklisted?.icon ?? faBuilding}
              color={STAGE_ICONS.Blacklisted?.color ?? colors.core.text}
            />
          </div>

          {/* Top Commodities / Upcoming Events — equal-height section cards */}
          <div style={{ display: 'grid', gridTemplateColumns: grids.formTwoColumns, gap: gap.cards }}>
            <Card size="section" style={{ display: 'flex', flexDirection: 'column' }}>
              <CardHeader icon={faBuilding} iconColor={colors.semantic.info} title="Top Commodities" />
              {data.topCommodities.length === 0 ? (
                <EmptyState
                  variant="inline"
                  icon={faInbox}
                  title="No data yet"
                  description="Commodity counts will appear here once suppliers are in the tracker."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: scale[2] /* 12 */ }}>
                  {data.topCommodities.map(tc => {
                    const max = data.topCommodities[0]?.count || 1;
                    return (
                      <div key={tc.commodity}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: gap.labelControl }}>
                          <span style={type.body}>{tc.commodity}</span>
                          <span style={type.kpiSubtext}>{tc.count}</span>
                        </div>
                        <div style={{ height: heights.commodityBar, backgroundColor: colors.core.canvas, borderRadius: heights.commodityBar / 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(tc.count / max) * 100}%`, backgroundColor: colors.semantic.info, borderRadius: heights.commodityBar / 2 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card size="section" style={{ display: 'flex', flexDirection: 'column' }}>
              <CardHeader icon={faCalendar} iconColor={colors.reference.pink} title="Upcoming Events" />
              {data.upcomingEvents.length === 0 ? (
                <EmptyState
                  variant="inline"
                  icon={faCalendar}
                  title="No upcoming events"
                  description="Scheduled events will appear here as they're added."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: scale[2] /* 12 */ }}>
                  {data.upcomingEvents.map(evt => {
                    const startDate = parseServerDate(evt.dateStart);
                    return (
                      <div
                        key={evt.id}
                        style={{ display: 'flex', gap: scale[2] /* 12 */, padding: scale[2] /* 12 */, border: `1px solid ${colors.neutral.border}`, borderRadius: radius.card }}
                      >
                        <div
                          style={{
                            width: heights.dateTile, height: heights.dateTile, borderRadius: radius.input, flexShrink: 0,
                            backgroundColor: colors.reference.pink,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {/* 9/14px, below the 11px floor: the same documented exception §4.3
                              grants CountBadge — a numeral this small is read by position inside
                              a calendar tile, not as prose. */}
                          <span style={{ fontSize: 9, fontWeight: 700, color: colors.core.surface, lineHeight: 1 }}>
                            {startDate ? MONTHS_SHORT[startDate.getMonth()].toUpperCase() : '—'}
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: colors.core.surface, lineHeight: 1.2 }}>
                            {startDate ? startDate.getDate() : ''}
                          </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ ...type.cellPrimary, margin: 0 }}>{evt.name}</p>
                          <span style={{ ...type.kpiSubtext, display: 'flex', alignItems: 'center', gap: gap.labelControl, marginTop: gap.labelControl }}>
                            <FontAwesomeIcon icon={faCalendar} style={{ fontSize: iconSize.compactControl }} />
                            {formatDate(evt.dateStart)}
                          </span>
                          <span style={{ ...type.kpiSubtext, display: 'flex', alignItems: 'center', gap: gap.labelControl, marginTop: gap.labelControl }}>
                            <FontAwesomeIcon icon={faMapMarkerAlt} style={{ fontSize: iconSize.compactControl }} />
                            {evt.location}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
