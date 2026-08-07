import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInbox, faArrowRight, faRotateRight, faChartColumn } from '@fortawesome/free-solid-svg-icons';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import { TRACKER_STAGE_CONFIG, TERMINAL_STAGE_CONFIG } from '../constants/stage-config';
import { getStageColor } from '../utils/tracker-helpers';
import {
  getWeeklyReport, getLatestWeeklyReport,
  type WeeklyReport, type ReportMovement, type ReportNote,
} from '../services/reportsService';
import { ApiError } from '../services/api.config';
import { useToast } from '../context/ToastContext';

/**
 * The matrix columns: the 5 *working* stages, in the canonical order of
 * `TRACKER_STAGE_CONFIG`. Completed and Blacklisted are exits from the board
 * rather than columns on it, so they are excluded (they are exactly the
 * entries `TERMINAL_STAGE_CONFIG` describes).
 */
const TERMINAL_STAGE_NAMES = new Set<string>(TERMINAL_STAGE_CONFIG.map(s => s.name));
const MATRIX_STAGES: string[] = TRACKER_STAGE_CONFIG
  .filter(s => !TERMINAL_STAGE_NAMES.has(s.name))
  .map(s => s.name);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-07-18' → '18 Jul 2026'. */
function formatDay(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateISO;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** ISO instant → '2:45 PM' (viewer's local time). */
function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid #D1D3D4', borderRadius: 6,
  fontSize: 13, color: '#000000', outline: 'none', backgroundColor: '#FFFFFF',
};
const cardStyle: React.CSSProperties = {
  backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
};
const sectionSubtitleStyle: React.CSSProperties = {
  fontSize: 13, color: '#808285', margin: '0 0 12px',
};

/** Today and today − 7 days as 'YYYY-MM-DD' (matches the backend's latest range). */
function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 7);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

function StageBadge({ stage }: { stage: string | null }) {
  if (!stage) {
    return <span style={{ fontSize: 12, fontWeight: 600, color: '#808285' }}>New</span>;
  }
  const color = getStageColor(stage);
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color, padding: '2px 8px', borderRadius: 4, backgroundColor: color + '15', whiteSpace: 'nowrap' }}>
      {stage}
    </span>
  );
}

// ── Suppliers-per-stage matrix ───────────────────────────────────────────────

interface MatrixCell { from: number; to: number }

interface Matrix {
  commodities: string[];
  cell: (commodity: string, stage: string) => MatrixCell;
}

/**
 * Commodity × stage counts, from both snapshots at once: `to` is the count on
 * the report's "to" date, `from` the count on the "from" date, so every cell
 * carries its own delta.
 */
function buildMatrix(report: WeeklyReport): Matrix {
  const key = (c: string, s: string) => `${c}::${s}`;
  const commodities = new Set<string>();
  const cells = new Map<string, MatrixCell>();
  const touch = (c: string, s: string) => {
    let cell = cells.get(key(c, s));
    if (!cell) { cell = { from: 0, to: 0 }; cells.set(key(c, s), cell); }
    return cell;
  };
  for (const r of report.snapshotFrom) { commodities.add(r.commodityName); touch(r.commodityName, r.stageName).from = r.count; }
  for (const r of report.snapshotTo) { commodities.add(r.commodityName); touch(r.commodityName, r.stageName).to = r.count; }
  return {
    commodities: [...commodities].sort((a, b) => a.localeCompare(b)),
    cell: (c, s) => cells.get(key(c, s)) ?? { from: 0, to: 0 },
  };
}

/** `+n` green / `-n` red; nothing at all when the delta is zero. */
function Delta({ value }: { value: number }) {
  if (value === 0) return null;
  return (
    <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 700, color: value > 0 ? '#6ABF4B' : '#DC0202' }}>
      {value > 0 ? `+${value}` : String(value)}
    </span>
  );
}

const TOOLTIP_WIDTH = 320;
const TOOLTIP_MAX_HEIGHT = 240;

interface TooltipState {
  title: string;
  movements: ReportMovement[];
  left: number;
  /** Distance from the viewport top (`below`) or bottom (`above`) in px. */
  offset: number;
  above: boolean;
}

function SuppliersPerStageMatrix({ report }: { report: WeeklyReport }) {
  const navigate = useNavigate();
  const matrix = useMemo(() => buildMatrix(report), [report]);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const hideTimer = useRef<number | null>(null);

  const cancelHide = useCallback(() => {
    if (hideTimer.current !== null) { window.clearTimeout(hideTimer.current); hideTimer.current = null; }
  }, []);
  // A short grace period so the pointer can travel from the cell onto the
  // panel (and scroll it) without the panel disappearing under it.
  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimer.current = window.setTimeout(() => setTooltip(null), 140);
  }, [cancelHide]);
  useEffect(() => cancelHide, [cancelHide]);

  const rowTotals = useMemo(() => {
    const totals = new Map<string, MatrixCell>();
    for (const c of matrix.commodities) {
      const t: MatrixCell = { from: 0, to: 0 };
      for (const s of MATRIX_STAGES) { const cell = matrix.cell(c, s); t.from += cell.from; t.to += cell.to; }
      totals.set(c, t);
    }
    return totals;
  }, [matrix]);

  const columnTotals = useMemo(() => {
    const totals = new Map<string, MatrixCell>();
    const grand: MatrixCell = { from: 0, to: 0 };
    for (const s of MATRIX_STAGES) {
      const t: MatrixCell = { from: 0, to: 0 };
      for (const c of matrix.commodities) { const cell = matrix.cell(c, s); t.from += cell.from; t.to += cell.to; }
      totals.set(s, t);
      grand.from += t.from; grand.to += t.to;
    }
    return { totals, grand };
  }, [matrix]);

  if (matrix.commodities.length === 0) {
    return <EmptyState icon={faInbox} title="No active suppliers in range" description="No commodity had active suppliers on either date." />;
  }

  const th: React.CSSProperties = { textAlign: 'left', padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000', backgroundColor: '#F7F7F7' };
  const thNum: React.CSSProperties = { ...th, textAlign: 'center', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '10px 16px', fontSize: 13, color: '#000000' };
  const tdNum: React.CSSProperties = { ...td, textAlign: 'center', whiteSpace: 'nowrap' };
  const totalsBorder: React.CSSProperties = { borderTop: '2px solid #D1D3D4' };

  /** Every movement that explains a change in this commodity/stage cell. */
  const movementsFor = (commodity: string, stage: string) =>
    report.movements.filter(m => m.commodityName === commodity && (m.fromStage === stage || m.toStage === stage));

  const openTooltip = (e: React.MouseEvent<HTMLElement>, commodity: string, stage: string, delta: number) => {
    cancelHide();
    setHoveredCell(`${commodity}::${stage}`);
    if (delta === 0) { setTooltip(null); return; }
    const movements = movementsFor(commodity, stage);
    if (movements.length === 0) { setTooltip(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    // Clamp horizontally so the panel never spills past the right edge, and
    // flip it above the cell when there is not enough room below.
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - TOOLTIP_WIDTH - 12));
    const above = rect.bottom + TOOLTIP_MAX_HEIGHT + 16 > window.innerHeight && rect.top > TOOLTIP_MAX_HEIGHT;
    setTooltip({
      title: `${commodity} · ${stage}`,
      movements,
      left,
      offset: above ? window.innerHeight - rect.top + 4 : rect.bottom + 4,
      above,
    });
  };

  const closeCell = () => { setHoveredCell(null); scheduleHide(); };

  const renderCell = (commodity: string, stage: string) => {
    const { from, to } = matrix.cell(commodity, stage);
    const delta = to - from;
    const cellKey = `${commodity}::${stage}`;
    const clickable = to > 0;
    const hovered = hoveredCell === cellKey;
    return (
      <td
        key={stage}
        onMouseEnter={e => openTooltip(e, commodity, stage, delta)}
        onMouseLeave={closeCell}
        onClick={clickable
          ? () => navigate(`/tracker/stage/${encodeURIComponent(stage)}?commodity=${encodeURIComponent(commodity)}`)
          : undefined}
        style={{
          ...tdNum,
          cursor: clickable ? 'pointer' : 'default',
          backgroundColor: hovered && clickable ? '#EFEFEF' : 'transparent',
          transition: 'background-color 0.12s',
        }}
      >
        <span style={{ fontWeight: 600, color: to > 0 ? '#000000' : '#808285' }}>{to}</span>
        <Delta value={delta} />
      </td>
    );
  };

  const totalCell = (t: MatrixCell, bold: boolean) => (
    <>
      <span style={{ fontWeight: bold ? 800 : 700, color: '#000000' }}>{t.to}</span>
      <Delta value={t.to - t.from} />
    </>
  );

  return (
    <>
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Commodity</th>
                {MATRIX_STAGES.map(s => (
                  <th key={s} style={thNum}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: getStageColor(s), flexShrink: 0 }} />
                      {s}
                    </span>
                  </th>
                ))}
                <th style={thNum}>Total</th>
              </tr>
            </thead>
            <tbody>
              {matrix.commodities.map((commodity, i) => (
                <tr key={commodity} style={{ backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{commodity}</td>
                  {MATRIX_STAGES.map(stage => renderCell(commodity, stage))}
                  <td style={tdNum}>{totalCell(rowTotals.get(commodity) ?? { from: 0, to: 0 }, false)}</td>
                </tr>
              ))}
              {/* Totals — the border goes on the cells, not the <tr>, so it
                  actually paints under borderCollapse. */}
              <tr style={{ backgroundColor: '#FFFFFF' }}>
                <td style={{ ...td, ...totalsBorder, fontWeight: 800 }}>Total</td>
                {MATRIX_STAGES.map(stage => (
                  <td key={stage} style={{ ...tdNum, ...totalsBorder }}>{totalCell(columnTotals.totals.get(stage) ?? { from: 0, to: 0 }, true)}</td>
                ))}
                <td style={{ ...tdNum, ...totalsBorder }}>{totalCell(columnTotals.grand, true)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {tooltip && (
        <div
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
          style={{
            position: 'fixed',
            left: tooltip.left,
            ...(tooltip.above ? { bottom: tooltip.offset } : { top: tooltip.offset }),
            width: TOOLTIP_WIDTH,
            maxHeight: TOOLTIP_MAX_HEIGHT,
            overflowY: 'auto',
            backgroundColor: '#FFFFFF',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.20)',
            padding: 12,
            zIndex: 300,
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 700, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px' }}>
            {tooltip.title}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tooltip.movements.map((m, i) => (
              <div key={`${m.supplierId}-${m.date}-${i}`}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#000000' }}>{m.supplierName}</span>
                  <span style={{ fontSize: 11, color: '#808285', whiteSpace: 'nowrap' }}>{formatDay(m.date)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                  <StageBadge stage={m.fromStage} />
                  <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 9, color: '#808285' }} />
                  <StageBadge stage={m.toStage} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Day-grouped activity lists ───────────────────────────────────────────────

/** Groups entries by day key, keeping the order the API returned them in. */
function groupByDay<T>(items: T[], dayOf: (item: T) => string): Array<{ day: string; items: T[] }> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const day = dayOf(item);
    const bucket = groups.get(day);
    if (bucket) bucket.push(item); else groups.set(day, [item]);
  }
  return [...groups.entries()].map(([day, entries]) => ({ day, items: entries }));
}

function DayGroup({ day, children }: { day: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px' }}>
        {formatDay(day)}
      </p>
      <div style={{ ...cardStyle, overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

function EntryRow({ first, children }: { first: boolean; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '12px 16px',
        borderTop: first ? 'none' : '1px solid #E0E0E0',
        backgroundColor: hovered ? '#FAFAFA' : '#FFFFFF',
        transition: 'background-color 0.12s',
      }}
    >
      {children}
    </div>
  );
}

const entryHeaderStyle: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
};
const supplierNameStyle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: '#000000' };
const metaStyle: React.CSSProperties = { fontSize: 12, color: '#808285' };
const entryTextStyle: React.CSSProperties = {
  fontSize: 13, color: '#000000', margin: '6px 0 0', lineHeight: 1.5, whiteSpace: 'pre-wrap',
};

function MovementsList({ movements }: { movements: ReportMovement[] }) {
  const groups = useMemo(() => groupByDay(movements, m => m.date), [movements]);
  if (movements.length === 0) {
    return <EmptyState icon={faInbox} title="No stage movements" description="No supplier changed stage in this period." />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {groups.map(group => (
        <DayGroup key={group.day} day={group.day}>
          {group.items.map((m, i) => (
            <EntryRow key={`${m.supplierId}-${m.date}-${i}`} first={i === 0}>
              <div style={entryHeaderStyle}>
                <span style={supplierNameStyle}>{m.supplierName}</span>
                <span style={metaStyle}>{m.commodityName}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <StageBadge stage={m.fromStage} />
                  <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 10, color: '#808285' }} />
                  <StageBadge stage={m.toStage} />
                </span>
                <span style={{ ...metaStyle, marginLeft: 'auto' }}>{m.user}</span>
              </div>
              {m.note && <p style={entryTextStyle}>{m.note}</p>}
            </EntryRow>
          ))}
        </DayGroup>
      ))}
    </div>
  );
}

function NotesList({ notes }: { notes: ReportNote[] }) {
  const groups = useMemo(() => groupByDay(notes, n => n.date), [notes]);
  if (notes.length === 0) {
    return <EmptyState icon={faInbox} title="No notes in this period" description="No comments were written between these dates." />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {groups.map(group => (
        <DayGroup key={group.day} day={group.day}>
          {group.items.map((n, i) => (
            <EntryRow key={n.id} first={i === 0}>
              <div style={entryHeaderStyle}>
                <span style={supplierNameStyle}>{n.supplierName}</span>
                <span style={metaStyle}>{n.commodityName}</span>
                <StageBadge stage={n.stage} />
                <span style={{ ...metaStyle, marginLeft: 'auto' }}>{n.author} · {formatTime(n.createdAt)}</span>
              </div>
              <p style={entryTextStyle}>{n.text}</p>
            </EntryRow>
          ))}
        </DayGroup>
      ))}
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

type TabKey = 'matrix' | 'movements' | 'notes';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'matrix', label: 'Suppliers per stage' },
  { key: 'movements', label: 'Stage movements' },
  { key: 'notes', label: 'Notes written' },
];

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 2px',
        fontSize: 13,
        fontWeight: 600,
        color: active ? '#DC0202' : hovered ? '#000000' : '#808285',
        background: 'none',
        border: 'none',
        borderBottom: `2px solid ${active ? '#DC0202' : 'transparent'}`,
        marginBottom: -1,
        cursor: 'pointer',
        transition: 'color 0.15s, border-color 0.15s',
      }}
    >
      {label}
    </button>
  );
}

export function Reports() {
  const toast = useToast();
  const initial = useMemo(defaultRange, []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('matrix');

  const runRange = useCallback((f: string, t: string) => {
    if (f > t) {
      toast.validationError('Invalid range', 'The "from" date must be on or before the "to" date.');
      return;
    }
    setLoading(true);
    getWeeklyReport(f, t)
      .then(setReport)
      .catch(err => toast.systemError(err instanceof ApiError ? err.message : 'Could not load the report.'))
      .finally(() => setLoading(false));
  }, [toast]);

  const runLatest = useCallback(() => {
    setLoading(true);
    getLatestWeeklyReport()
      .then(r => { setReport(r); setFrom(r.from); setTo(r.to); })
      .catch(err => toast.systemError(err instanceof ApiError ? err.message : 'Could not load the report.'))
      .finally(() => setLoading(false));
  }, [toast]);

  // Initial load — the last 7 days.
  useEffect(() => { runLatest(); }, [runLatest]);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Reports</h1>
        <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>
          Week-over-week pipeline movement by commodity
        </p>
      </div>

      {/* Controls */}
      <div style={{ ...cardStyle, padding: 16, marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#808285', marginBottom: 4 }}>From</label>
          <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#808285', marginBottom: 4 }}>To</label>
          <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} style={inputStyle} />
        </div>
        <button
          onClick={() => runRange(from, to)}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, backgroundColor: '#DC0202', color: '#FFFFFF', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Generate
        </button>
        <button
          onClick={() => runLatest()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, backgroundColor: '#FFFFFF', color: '#000000', border: '1px solid #D1D3D4', borderRadius: 6, cursor: 'pointer' }}
        >
          <FontAwesomeIcon icon={faRotateRight} style={{ fontSize: 11 }} /> Last 7 days
        </button>
      </div>

      {loading || !report ? (
        <LoadingState entity="Report" icon={faChartColumn} />
      ) : (
        <>
          {/* Tab bar — only the active tab's section is rendered. */}
          <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid #E0E0E0', marginBottom: 20 }}>
            {TABS.map(t => (
              <TabButton key={t.key} label={t.label} active={tab === t.key} onClick={() => setTab(t.key)} />
            ))}
          </div>

          {tab === 'matrix' && (
            <section>
              <p style={sectionSubtitleStyle}>
                Active suppliers per commodity and stage on {formatDay(report.to)}, with the change since {formatDay(report.from)}.
                Click a cell to open that stage filtered to the commodity.
              </p>
              <SuppliersPerStageMatrix report={report} />
            </section>
          )}

          {tab === 'movements' && (
            <section>
              <p style={sectionSubtitleStyle}>
                Every stage change in the period, with the note explaining why.
              </p>
              <MovementsList movements={report.movements} />
            </section>
          )}

          {tab === 'notes' && (
            <section>
              <p style={sectionSubtitleStyle}>
                Comments added in the period — who wrote them and when.
              </p>
              <NotesList notes={report.notes} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
