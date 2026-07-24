import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInbox, faArrowRight, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { CatalogSelect } from '../components/CatalogSelect';
import { LoadingState } from '../components/LoadingState';
import { getStageColor } from '../utils/tracker-helpers';
import {
  getWeeklyReport, getLatestWeeklyReport, getReportCommodities,
  type WeeklyReport, type ReportCommodity, type StageSnapshotRow,
} from '../services/reportsService';
import { ApiError } from '../services/api.config';
import { useToast } from '../context/ToastContext';

// Order the 5 working stages for the comparison table; unknown stages sort last.
const STAGE_ORDER = [
  'Scouting Event', 'Parking Lot', 'Preliminary Evaluation', 'Supplier Evaluation', 'Intelex Handoff',
];
const stageRank = (name: string) => {
  const i = STAGE_ORDER.indexOf(name);
  return i === -1 ? STAGE_ORDER.length : i;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-07-18' → '18 Jul 2026'. */
function formatDay(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateISO;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** ISO instant → '21 Jul, 2:45 PM' (viewer's local time). */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid #D1D3D4', borderRadius: 6,
  fontSize: 13, color: '#000000', outline: 'none', backgroundColor: '#FFFFFF',
};
const cardStyle: React.CSSProperties = {
  backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
};
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 18, fontWeight: 700, color: '#000000', margin: '0 0 12px',
};

/** Today and today − 7 days as 'YYYY-MM-DD' (matches the backend's latest range). */
function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 7);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <FontAwesomeIcon icon={faInbox} style={{ fontSize: 40, color: '#D1D3D4', marginBottom: 12 }} />
      <p style={{ fontSize: 15, fontWeight: 700, color: '#000000', margin: '0 0 4px' }}>{title}</p>
      <p style={{ fontSize: 13, color: '#808285', margin: 0 }}>{description}</p>
    </div>
  );
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

// ── Comparison table ───────────────────────────────────────────────────────
interface CompareRow {
  commodityName: string;
  stageName: string;
  from: number;
  to: number;
}

function buildComparison(snapFrom: StageSnapshotRow[], snapTo: StageSnapshotRow[]): CompareRow[] {
  const map = new Map<string, CompareRow>();
  const touch = (r: StageSnapshotRow) => {
    const key = `${r.commodityName}::${r.stageName}`;
    let row = map.get(key);
    if (!row) { row = { commodityName: r.commodityName, stageName: r.stageName, from: 0, to: 0 }; map.set(key, row); }
    return row;
  };
  for (const r of snapFrom) touch(r).from = r.count;
  for (const r of snapTo) touch(r).to = r.count;
  return [...map.values()].sort(
    (a, b) => a.commodityName.localeCompare(b.commodityName) || stageRank(a.stageName) - stageRank(b.stageName),
  );
}

function DeltaCell({ from, to }: { from: number; to: number }) {
  const delta = to - from;
  const color = delta > 0 ? '#6ABF4B' : delta < 0 ? '#DC0202' : '#808285';
  const label = delta > 0 ? `+${delta}` : String(delta);
  return <span style={{ fontWeight: 700, color }}>{label}</span>;
}

function ComparisonTable({ report }: { report: WeeklyReport }) {
  const rows = useMemo(() => buildComparison(report.snapshotFrom, report.snapshotTo), [report]);

  if (rows.length === 0) {
    return <EmptyState title="No active suppliers in range" description="No commodity had active suppliers on either date." />;
  }

  const th: React.CSSProperties = { textAlign: 'left', padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000', backgroundColor: '#F7F7F7' };
  const thNum: React.CSSProperties = { ...th, textAlign: 'center' };
  const td: React.CSSProperties = { padding: '10px 16px', fontSize: 13, color: '#000000' };
  const tdNum: React.CSSProperties = { ...td, textAlign: 'center', color: '#808285' };

  // Group consecutive rows by commodity so each commodity gets one header row.
  let lastCommodity = '';
  return (
    <div style={{ ...cardStyle, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Stage</th>
              <th style={thNum}>{formatDay(report.from)}</th>
              <th style={thNum}>{formatDay(report.to)}</th>
              <th style={thNum}>Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const newGroup = r.commodityName !== lastCommodity;
              lastCommodity = r.commodityName;
              return (
                <Fragment key={`${r.commodityName}-${r.stageName}`}>
                  {newGroup && (
                    <tr>
                      <td colSpan={4} style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#000000', backgroundColor: '#F0F0F0', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        {r.commodityName}
                      </td>
                    </tr>
                  )}
                  <tr style={{ backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                    <td style={td}><StageBadge stage={r.stageName} /></td>
                    <td style={tdNum}>{r.from}</td>
                    <td style={tdNum}>{r.to}</td>
                    <td style={{ ...tdNum }}><DeltaCell from={r.from} to={r.to} /></td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Movements ────────────────────────────────────────────────────────────────
function MovementsList({ report }: { report: WeeklyReport }) {
  if (report.movements.length === 0) {
    return <EmptyState title="No stage movements" description="No supplier changed stage in this period." />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {report.movements.map((m, i) => (
        <div key={`${m.supplierId}-${m.date}-${i}`} style={{ ...cardStyle, padding: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: m.note ? 10 : 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#000000' }}>{m.supplierName}</span>
            <span style={{ fontSize: 12, color: '#808285' }}>{m.commodityName}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <StageBadge stage={m.fromStage} />
              <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 10, color: '#808285' }} />
              <StageBadge stage={m.toStage} />
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#808285' }}>
              {formatDay(m.date)} · {m.user}
            </span>
          </div>
          {m.note && (
            <p style={{ fontSize: 13, color: '#000000', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.note}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Notes ────────────────────────────────────────────────────────────────────
function NotesList({ report }: { report: WeeklyReport }) {
  if (report.notes.length === 0) {
    return <EmptyState title="No notes in this period" description="No comments were written between these dates." />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {report.notes.map(n => (
        <div key={n.id} style={{ ...cardStyle, padding: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#000000' }}>{n.supplierName}</span>
            <span style={{ fontSize: 12, color: '#808285' }}>{n.commodityName}</span>
            <StageBadge stage={n.stage} />
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#808285' }}>
              {n.author} · {formatDateTime(n.createdAt)}
            </span>
          </div>
          <p style={{ fontSize: 13, color: '#000000', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.text}</p>
        </div>
      ))}
    </div>
  );
}

export function Reports() {
  const toast = useToast();
  const initial = useMemo(defaultRange, []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [commodities, setCommodities] = useState<ReportCommodity[]>([]);
  const [commodityName, setCommodityName] = useState('');
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);

  const commodityId = useMemo(
    () => (commodityName ? commodities.find(c => c.name === commodityName)?.id : undefined),
    [commodityName, commodities],
  );

  // Commodity catalog for the filter (once).
  useEffect(() => {
    let cancelled = false;
    getReportCommodities()
      .then(list => { if (!cancelled) setCommodities(list); })
      .catch(() => { /* the filter just stays empty if the catalog can't load */ });
    return () => { cancelled = true; };
  }, []);

  const runRange = useCallback((f: string, t: string, cid?: number) => {
    if (f > t) {
      toast.validationError('Invalid range', 'The "from" date must be on or before the "to" date.');
      return;
    }
    setLoading(true);
    getWeeklyReport(f, t, cid)
      .then(setReport)
      .catch(err => toast.systemError(err instanceof ApiError ? err.message : 'Could not load the report.'))
      .finally(() => setLoading(false));
  }, [toast]);

  const runLatest = useCallback((cid?: number) => {
    setLoading(true);
    getLatestWeeklyReport(cid)
      .then(r => { setReport(r); setFrom(r.from); setTo(r.to); })
      .catch(err => toast.systemError(err instanceof ApiError ? err.message : 'Could not load the report.'))
      .finally(() => setLoading(false));
  }, [toast]);

  // Initial load — the last 7 days.
  useEffect(() => { runLatest(); }, [runLatest]);

  const handleCommodityChange = (name: string) => {
    setCommodityName(name);
    const cid = name ? commodities.find(c => c.name === name)?.id : undefined;
    runRange(from, to, cid);
  };

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
          onClick={() => runRange(from, to, commodityId)}
          style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, backgroundColor: '#DC0202', color: '#FFFFFF', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Generate
        </button>
        <button
          onClick={() => runLatest(commodityId)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, backgroundColor: '#FFFFFF', color: '#000000', border: '1px solid #D1D3D4', borderRadius: 6, cursor: 'pointer' }}
        >
          <FontAwesomeIcon icon={faRotateRight} style={{ fontSize: 11 }} /> Last 7 days
        </button>
        <div style={{ marginLeft: 'auto', minWidth: 220 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#808285', marginBottom: 4 }}>Commodity</label>
          <CatalogSelect
            value={commodityName}
            onChange={handleCommodityChange}
            options={commodities.map(c => c.name)}
            placeholder="All commodities"
          />
        </div>
      </div>

      {loading || !report ? (
        <LoadingState entity="Report" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Comparison */}
          <section>
            <h2 style={sectionTitleStyle}>Suppliers per stage</h2>
            <p style={{ fontSize: 13, color: '#808285', margin: '-8px 0 12px' }}>
              Active suppliers on {formatDay(report.from)} vs {formatDay(report.to)}, by commodity and stage.
            </p>
            <ComparisonTable report={report} />
          </section>

          {/* Movements */}
          <section>
            <h2 style={sectionTitleStyle}>Stage movements</h2>
            <p style={{ fontSize: 13, color: '#808285', margin: '-8px 0 12px' }}>
              Every stage change in the period, with the note explaining why.
            </p>
            <MovementsList report={report} />
          </section>

          {/* Notes */}
          <section>
            <h2 style={sectionTitleStyle}>Notes written</h2>
            <p style={{ fontSize: 13, color: '#808285', margin: '-8px 0 12px' }}>
              Comments added in the period — who wrote them and when.
            </p>
            <NotesList report={report} />
          </section>
        </div>
      )}
    </div>
  );
}
