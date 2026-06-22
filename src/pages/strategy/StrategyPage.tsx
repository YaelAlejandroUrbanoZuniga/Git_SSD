import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBullseye, faArrowLeft, faChevronRight, faPencil, faTimes, faLayerGroup, faListCheck, faHourglassHalf,
} from '@fortawesome/free-solid-svg-icons';
import type { StrategyEntry, CommodityStrategyRow, PipelineSupplier, SLAStatus } from '../../types';
import { getStrategyEntries, getSuppliersForCommodity } from '../../services/strategyService';
import { pipelineStageConfig } from '../../data/pipeline-demo';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const stageColor: Record<string, string> = Object.fromEntries(
  pipelineStageConfig.map(s => [s.name, s.color])
);

const stageAbbrev: Record<string, string> = {
  'Scouting Event': 'Scout',
  'Parking Lot': 'Park',
  'Preliminary Evaluation': 'Prelim',
  'Supplier Evaluation': 'Sup Eval',
  'Intelex Handoff': 'Intelex',
};

const slaColors: Record<SLAStatus, string> = { green: '#6ABF4B', amber: '#D4A017', red: '#DC0202' };

function computeRow(entry: StrategyEntry): CommodityStrategyRow {
  const suppliers = getSuppliersForCommodity(entry.commodity);
  const stageGroups: Record<string, number[]> = {};
  suppliers.forEach(s => {
    if (!stageGroups[s.stage]) stageGroups[s.stage] = [];
    stageGroups[s.stage].push(s.daysInStage);
  });
  const stages = Object.entries(stageGroups).map(([stageName, days]) => ({
    stageName,
    count: days.length,
    avgDaysInStage: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
  }));
  const total = suppliers.length;
  return {
    commodity: entry.commodity,
    strategyNeeds2026: entry.strategyNeeds['2026'],
    totalInPipeline: total,
    remaining: Math.max(0, entry.strategyNeeds['2026'] - total),
    stages,
  };
}

function RemainingBadge({ remaining }: { remaining: number }) {
  const style =
    remaining === 0
      ? { bg: '#6ABF4B26', text: '#3E8E2E' }
      : remaining === 1
      ? { bg: '#D4A01726', text: '#9A7611' }
      : { bg: '#DC020226', text: '#DC0202' };
  return (
    <span style={{ backgroundColor: style.bg, color: style.text, fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 12, display: 'inline-block', minWidth: 28, textAlign: 'center' }}>
      {remaining}
    </span>
  );
}

function StageBadge({ stageName, count, avgDays }: { stageName: string; count: number; avgDays: number }) {
  const color = stageColor[stageName] ?? '#808285';
  return (
    <span
      title={`${stageName}: ${count} supplier(s), avg ${avgDays} days`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, backgroundColor: `${color}1A`, color, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color }} />
      {stageAbbrev[stageName] ?? stageName} · {count} · {avgDays}d
    </span>
  );
}

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    border: '1px solid #D1D3D4',
    borderRadius: 6,
    padding: '8px 12px',
    fontSize: 14,
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    color: '#000000',
    backgroundColor: '#FFFFFF',
    outline: 'none',
    ...extra,
  };
}

// ─── Add / Edit modal ──────────────────────────────────────────────────────────

interface StrategyModalProps {
  editingEntry: StrategyEntry | null;
  onClose: () => void;
  onSave: (commodity: string, need: number) => void;
}

function StrategyModal({ editingEntry, onClose, onSave }: StrategyModalProps) {
  const [commodity, setCommodity] = useState(editingEntry?.commodity ?? '');
  const [need, setNeed] = useState<string>(
    editingEntry ? String(editingEntry.strategyNeeds['2026']) : ''
  );

  const trimmed = commodity.trim();
  const needNum = Number(need);
  const valid = trimmed.length > 0 && Number.isFinite(needNum) && needNum >= 1;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 480, backgroundColor: '#FFFFFF', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.20)', padding: '28px 32px', position: 'relative' }}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <FontAwesomeIcon icon={faTimes} style={{ fontSize: 16, color: '#808285' }} />
        </button>

        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#000000', margin: '0 0 24px' }}>
          {editingEntry ? 'Edit Commodity Strategy' : 'Add Commodity Strategy'}
        </h2>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 13, color: '#374151', fontWeight: 600, display: 'block', marginBottom: 6 }}>Commodity</label>
          <input
            style={inputStyle()}
            placeholder="e.g. Stampings"
            value={commodity}
            disabled={!!editingEntry}
            onChange={e => setCommodity(e.target.value)}
          />
          {editingEntry && (
            <p style={{ fontSize: 12, color: '#6B7280', margin: '6px 0 0' }}>Commodity name cannot be changed.</p>
          )}
        </div>

        <div style={{ marginBottom: 28 }}>
          <label style={{ fontSize: 13, color: '#374151', fontWeight: 600, display: 'block', marginBottom: 6 }}>Strategy Need 2026</label>
          <input
            type="number"
            min={1}
            style={inputStyle()}
            placeholder="1"
            value={need}
            onChange={e => setNeed(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
          <button
            onClick={onClose}
            style={{ fontSize: 14, fontWeight: 600, color: '#DC0202', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 4px' }}
          >
            Cancel
          </button>
          <button
            disabled={!valid}
            onClick={() => { if (valid) { onSave(trimmed, needNum); onClose(); } }}
            style={{ padding: '9px 20px', fontSize: 14, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: valid ? '#DC0202' : '#E5A5A5', color: '#FFFFFF', cursor: valid ? 'pointer' : 'not-allowed', transition: 'opacity 0.15s' }}
            onMouseEnter={e => { if (valid) e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {editingEntry ? 'Save Changes' : 'Add to Strategy'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── KPI card ───────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, accent }: { icon: typeof faBullseye; label: string; value: number; accent: string }) {
  return (
    <div style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #DC0202', padding: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: `${accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <FontAwesomeIcon icon={icon} style={{ fontSize: 18, color: accent }} />
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#000000', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

// ─── Drilldown view ───────────────────────────────────────────────────────────

function DrilldownView({ row, suppliers, onBack }: { row: CommodityStrategyRow; suppliers: PipelineSupplier[]; onBack: () => void }) {
  const need = row.strategyNeeds2026;
  const total = row.totalInPipeline;
  const ratio = need > 0 ? total / need : 1;
  const barColor = ratio >= 1 ? '#6ABF4B' : ratio >= 0.5 ? '#D4A017' : '#DC0202';
  const barPct = Math.min(100, Math.round(ratio * 100));

  const tdStyle: React.CSSProperties = { padding: '12px 16px', fontSize: 14, color: '#4B5563', verticalAlign: 'middle' };

  return (
    <div>
      <button
        onClick={onBack}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#DC0202', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: 16 }}
      >
        <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 12 }} />
        Back to Strategy Overview
      </button>

      <div className="flex items-center" style={{ justifyContent: 'space-between', marginBottom: 24, gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#000000', margin: 0 }}>
          Strategy Drilldown — {row.commodity}
        </h1>
        <span style={{ backgroundColor: '#DC020214', color: '#DC0202', fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 14, whiteSpace: 'nowrap' }}>
          Need: {need} supplier{need !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left — supplier list */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #DC0202', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px 14px' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#000000', margin: 0 }}>Suppliers in Pipeline ({suppliers.length})</h2>
          </div>
          {suppliers.length === 0 ? (
            <p style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', padding: '32px 24px 40px', margin: 0 }}>
              No suppliers currently in pipeline for this commodity.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Folio', 'Supplier Name', 'Stage', 'Days in Stage', 'Status'].map(col => (
                    <th key={col} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: '#374151', textAlign: 'left', borderBottom: '0.5px solid #D1D3D4', borderTop: '0.5px solid #EEEEEE', whiteSpace: 'nowrap' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s, idx) => {
                  const color = stageColor[s.stage] ?? '#808285';
                  return (
                    <tr key={s.id} style={{ borderBottom: idx === suppliers.length - 1 ? 'none' : '0.5px solid #EEEEEE' }}>
                      <td style={tdStyle}>
                        <Link to={`/pipeline/supplier/${s.id}`} style={{ color: '#0084C0', textDecoration: 'none', fontWeight: 500 }}>
                          {s.folio}
                        </Link>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: '#000000' }}>
                        <Link to={`/pipeline/supplier/${s.id}`} style={{ color: '#000000', textDecoration: 'none' }}>
                          {s.name}
                        </Link>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: `${color}1A`, color, fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color }} />
                          {s.stage}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: slaColors[s.sla], flexShrink: 0 }} />
                          {s.daysInStage}d
                        </span>
                      </td>
                      <td style={tdStyle}>{s.subStatus ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Right — distribution by stage */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #DC0202', padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#000000', margin: '0 0 16px' }}>Distribution by Stage</h2>

          {row.stages.length === 0 ? (
            <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px' }}>No suppliers in any stage yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {row.stages.map(st => {
                const color = stageColor[st.stageName] ?? '#808285';
                return (
                  <div key={st.stageName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: `${color}1A`, color, fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 12 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color }} />
                      {st.stageName}
                    </span>
                    <span style={{ fontSize: 13, color: '#4B5563', whiteSpace: 'nowrap' }}>
                      {st.count} supplier{st.count !== 1 ? 's' : ''} · avg {st.avgDaysInStage}d
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ borderTop: '0.5px solid #EEEEEE', paddingTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Progress vs. Need</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: barColor }}>{total} of {need} needed</span>
            </div>
            <div style={{ backgroundColor: '#EEEEEE', borderRadius: 4, height: 8, overflow: 'hidden' }}>
              <div style={{ height: 8, borderRadius: 4, backgroundColor: barColor, width: `${barPct}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────────

export function StrategyPage() {
  const [entries, setEntries] = useState<StrategyEntry[]>(() => getStrategyEntries());
  const [selectedCommodity, setSelectedCommodity] = useState<string | null>(null);
  const [modalEntry, setModalEntry] = useState<StrategyEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const rows = entries.map(computeRow);

  const totalNeeds = rows.reduce((sum, r) => sum + r.strategyNeeds2026, 0);
  const commoditiesDefined = entries.length;
  const commoditiesRemaining = rows.filter(r => r.remaining > 0).length;

  const openAdd = () => { setModalEntry(null); setModalOpen(true); };
  const openEdit = (entry: StrategyEntry) => { setModalEntry(entry); setModalOpen(true); };

  const handleSave = (commodity: string, need: number) => {
    const today = new Date().toISOString().slice(0, 10);
    if (modalEntry) {
      setEntries(prev => prev.map(e =>
        e.id === modalEntry.id
          ? { ...e, strategyNeeds: { ...e.strategyNeeds, '2026': need }, updatedAt: today }
          : e
      ));
    } else {
      setEntries(prev => [
        ...prev,
        {
          id: 'se-' + Date.now(),
          commodity,
          strategyNeeds: { '2026': need, '2027': null, '2028': null, '2029': null, '2030': null, '2031': null },
          createdBy: 'Yael Urbano',
          updatedAt: today,
        },
      ]);
    }
  };

  // Drilldown view
  if (selectedCommodity) {
    const row = rows.find(r => r.commodity === selectedCommodity);
    if (row) {
      return (
        <DrilldownView
          row={row}
          suppliers={getSuppliersForCommodity(selectedCommodity)}
          onBack={() => setSelectedCommodity(null)}
        />
      );
    }
  }

  const thStyle: React.CSSProperties = { padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#374151', textAlign: 'left', borderBottom: '0.5px solid #D1D3D4', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '14px 16px', fontSize: 14, color: '#4B5563', verticalAlign: 'middle' };

  return (
    <div>
      {/* Header */}
      <div className="flex items-end" style={{ justifyContent: 'space-between', marginBottom: 24, gap: 12 }}>
        <div>
          <nav style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#6B7280', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FontAwesomeIcon icon={faBullseye} style={{ fontSize: 11, color: '#DC0202' }} />
              <span style={{ color: '#000000', fontWeight: 600 }}>Strategy</span>
            </span>
          </nav>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#000000', margin: 0 }}>Commodity Strategy — 2026</h1>
        </div>
        <button
          onClick={openAdd}
          style={{ padding: '9px 18px', fontSize: 14, fontWeight: 700, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'opacity 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          + Add Commodity Strategy
        </button>
      </div>

      {/* KPI row */}
      <div className="flex" style={{ gap: 16, marginBottom: 24 }}>
        <KpiCard icon={faListCheck} label="Total Strategy Needs (2026)" value={totalNeeds} accent="#DC0202" />
        <KpiCard icon={faLayerGroup} label="Commodities Defined" value={commoditiesDefined} accent="#0084C0" />
        <KpiCard icon={faHourglassHalf} label="Commodities Remaining" value={commoditiesRemaining} accent="#D4A017" />
      </div>

      {/* Main table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #DC0202', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 14px' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#000000', margin: 0 }}>Commodity Strategy — 2026 Overview</h2>
        </div>

        {rows.length === 0 ? (
          <p style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', padding: '40px 24px 48px', margin: 0 }}>
            No commodity strategies defined yet. Click "Add Commodity Strategy" to get started.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Commodity</th>
                <th style={thStyle}>Strategy Need (2026)</th>
                <th style={thStyle}>In Pipeline</th>
                <th style={thStyle}>Remaining</th>
                <th style={thStyle}>Stage Breakdown</th>
                <th style={thStyle}>Last Updated</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                <th style={{ ...thStyle, width: 36 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const entry = entries.find(e => e.commodity === row.commodity)!;
                const isLast = idx === rows.length - 1;
                return (
                  <tr
                    key={row.commodity}
                    onClick={() => setSelectedCommodity(row.commodity)}
                    style={{ borderBottom: isLast ? 'none' : '0.5px solid #EEEEEE', cursor: 'pointer', transition: 'background-color 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F9FAFB')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600, color: '#000000' }}>{row.commodity}</td>
                    <td style={tdStyle}>{row.strategyNeeds2026}</td>
                    <td style={tdStyle}>{row.totalInPipeline}</td>
                    <td style={tdStyle}><RemainingBadge remaining={row.remaining} /></td>
                    <td style={tdStyle}>
                      {row.stages.length === 0 ? (
                        <span style={{ fontSize: 12, color: '#9CA3AF' }}>—</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {row.stages.map(st => (
                            <StageBadge key={st.stageName} stageName={st.stageName} count={st.count} avgDays={st.avgDaysInStage} />
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdStyle, color: '#6B7280', fontSize: 13, whiteSpace: 'nowrap' }}>{entry.updatedAt}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button
                        onClick={e => { e.stopPropagation(); openEdit(entry); }}
                        title="Edit strategy"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 4, color: '#6B7280', transition: 'background-color 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F0F0F0')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <FontAwesomeIcon icon={faPencil} style={{ fontSize: 13 }} />
                      </button>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 12, color: '#9CA3AF' }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <StrategyModal
          editingEntry={modalEntry}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
