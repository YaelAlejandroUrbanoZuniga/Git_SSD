import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faChevronDown, faPlus } from '@fortawesome/free-solid-svg-icons';
import { pipelineSuppliers, pipelineStageConfig, PipelineSupplier } from '../../data/pipeline-demo';

const slaColors: Record<string, string> = { green: '#6ABF4B', amber: '#D4A017', red: '#DC0202' };
const subStatusStyles: Record<string, { bg: string; text: string }> = {
  'Go':               { bg: '#6ABF4B26', text: '#6ABF4B' },
  'No Go':            { bg: '#DC020226', text: '#DC0202' },
  'Under Evaluation': { bg: '#D4A01726', text: '#D4A017' },
  'On Hold':          { bg: '#80828526', text: '#808285' },
};

function SupplierCard({ supplier }: { supplier: PipelineSupplier }) {
  const navigate = useNavigate();
  const stageColor = pipelineStageConfig.find(s => s.name === supplier.stage)?.color ?? '#808285';

  return (
    <div
      onClick={() => navigate(`/pipeline/supplier/${supplier.id}`)}
      className="bg-white"
      style={{
        borderRadius: 8, padding: 16, cursor: 'pointer',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        transition: 'box-shadow 0.15s ease-out',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)')}
    >
      {/* Line 1: name + stage badge */}
      <div className="flex items-start justify-between" style={{ marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#000000' }}>{supplier.name}</span>
        <span style={{ backgroundColor: stageColor + '26', color: stageColor, fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 3, whiteSpace: 'nowrap' }}>
          {supplier.stage}
        </span>
      </div>
      {/* Line 2: commodity */}
      <p style={{ fontSize: 13, color: '#808285', margin: '0 0 4px' }}>{supplier.commodity}</p>
      {/* Line 3: days */}
      <p style={{ fontSize: 12, color: '#808285', margin: '0 0 6px' }}>Días en etapa: {supplier.daysInStage}</p>
      {/* Line 4: sub-status (only Parking Lot) */}
      {supplier.subStatus && (
        <div style={{ marginBottom: 8 }}>
          <span style={{
            backgroundColor: subStatusStyles[supplier.subStatus].bg,
            color: subStatusStyles[supplier.subStatus].text,
            fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 3,
          }}>
            {supplier.subStatus}
          </span>
        </div>
      )}
      {/* Line 5-6: docs bar + SLA dot */}
      <div className="flex items-center" style={{ gap: 8 }}>
        <div style={{ flex: 1, backgroundColor: '#EEEEEE', borderRadius: 2, height: 4 }}>
          <div style={{ height: 4, borderRadius: 2, backgroundColor: '#DC0202', width: `${supplier.docsPercent}%` }} />
        </div>
        <span style={{ fontSize: 11, color: '#808285', whiteSpace: 'nowrap' }}>Docs {supplier.docsPercent}%</span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: slaColors[supplier.sla], flexShrink: 0, display: 'inline-block' }} />
      </div>
    </div>
  );
}

export function PipelineKanban() {
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const getSuppliersByStage = (stageName: string) =>
    pipelineSuppliers.filter(s => s.stage === stageName);

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Pipeline</h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>
            Kanban de seguimiento de proveedores
          </p>
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          <button
            onClick={() => navigate('/pipeline/blacklisted')}
            style={{ padding: '8px 16px', fontSize: 14, fontWeight: 600, borderRadius: 8, border: '1px solid #000000', backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer', transition: 'box-shadow 0.15s ease-out' }}
          >
            Ver Blacklisted
          </button>
          <button
            className="btn-primary"
            style={{ backgroundColor: '#DC0202', color: '#FFFFFF', fontWeight: 700, fontSize: 14, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'box-shadow 0.15s ease-out', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <FontAwesomeIcon icon={faPlus} style={{ fontSize: 12 }} />
            Agregar proveedor
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center" style={{ gap: 12, marginBottom: 24 }}>
        <div className="relative" style={{ flex: '1 1 0', maxWidth: 320 }}>
          <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#808285', fontSize: 14 }} />
          <input
            type="text" placeholder="Buscar proveedor..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 8, paddingBottom: 8, border: '1px solid #E0E0E0', borderRadius: 6, fontSize: 13, color: '#000000', backgroundColor: '#FFFFFF', outline: 'none' }}
          />
        </div>
        {['Stage', 'Commodity', 'SLA Status'].map(f => (
          <button key={f} className="flex items-center" style={{ gap: 6, padding: '8px 12px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, color: '#000000', backgroundColor: '#FFFFFF', cursor: 'pointer', transition: 'background-color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F5F5F5')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
          >
            {f}
            <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 10, color: '#808285' }} />
          </button>
        ))}
      </div>

      {/* Kanban board */}
      <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
        <div className="flex" style={{ gap: 16, minWidth: 'max-content' }}>
          {pipelineStageConfig.map((stage) => {
            const stageSuppliers = getSuppliersByStage(stage.name);
            const displayed = stageSuppliers.slice(0, 3);

            return (
              <div key={stage.name} style={{ width: 270, flexShrink: 0 }}>
                {/* Column header — clickeable */}
                <div
                  className="flex items-center"
                  style={{ gap: 8, marginBottom: 12, padding: '0 2px', cursor: 'pointer' }}
                  onClick={() => navigate(`/pipeline/stage/${encodeURIComponent(stage.name)}`)}
                >
                  <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: stage.color, flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ fontWeight: 500, fontSize: 13, color: '#000000', flex: 1 }}>{stage.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#808285', backgroundColor: '#EEEEEE', padding: '2px 8px', borderRadius: 99 }}>
                    {stageSuppliers.length}
                  </span>
                </div>

                {/* Column body */}
                <div style={{ backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 8, padding: 8, minHeight: 200, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {displayed.map(supplier => (
                    <SupplierCard key={supplier.id} supplier={supplier} />
                  ))}
                  {stageSuppliers.length > 3 && (
                    <button
                      onClick={() => navigate(`/pipeline/stage/${encodeURIComponent(stage.name)}`)}
                      style={{ fontSize: 12, fontWeight: 500, color: '#0084C0', textAlign: 'center', padding: '6px 0', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Ver todos ({stageSuppliers.length}) →
                    </button>
                  )}
                  {stageSuppliers.length === 0 && (
                    <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '32px 0', margin: 0 }}>Sin proveedores</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
