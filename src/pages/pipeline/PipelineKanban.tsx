import { useNavigate } from 'react-router-dom';
import { pipelineSuppliers, pipelineStageConfig, PipelineSupplier } from '../../data/pipeline-demo';
import { getDocsBarColor } from '../../utils/pipeline-helpers';

const slaColors: Record<string, string> = { green: '#6ABF4B', amber: '#D4A017', red: '#DC0202' };
const subStatusStyles: Record<string, { bg: string; text: string }> = {
  'Go':               { bg: '#6ABF4B26', text: '#6ABF4B' },
  'No Go':            { bg: '#DC020226', text: '#DC0202' },
  'Under Evaluation': { bg: '#D4A01726', text: '#D4A017' },
  'On Hold':          { bg: '#80828526', text: '#808285' },
};

function SupplierCard({ supplier, stageColor, isLast }: { supplier: PipelineSupplier; stageColor: string; isLast: boolean }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/pipeline/supplier/${supplier.id}`)}
      style={{
        padding: '12px 14px',
        cursor: 'pointer',
        borderLeft: `3px solid ${stageColor}`,
        borderBottom: isLast ? 'none' : '1px solid #EEEEEE',
        borderRadius: isLast ? '0 0 8px 8px' : 0,
        backgroundColor: '#FFFFFF',
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F7F7F7')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
    >
      <div className="flex items-start justify-between" style={{ marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#000000' }}>{supplier.name}</span>
        <span style={{ backgroundColor: stageColor + '26', color: stageColor, fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 3, whiteSpace: 'nowrap' }}>
          {supplier.stage}
        </span>
      </div>
      <p style={{ fontSize: 12, color: '#808285', margin: '0 0 2px' }}>{supplier.commodity}</p>
      <p style={{ fontSize: 12, color: '#808285', margin: '0 0 4px' }}>Días en etapa: {supplier.daysInStage}</p>
      {supplier.subStatus && (
        <div style={{ marginBottom: 6 }}>
          <span style={{
            backgroundColor: subStatusStyles[supplier.subStatus].bg,
            color: subStatusStyles[supplier.subStatus].text,
            fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 3,
          }}>
            {supplier.subStatus}
          </span>
        </div>
      )}
      <div className="flex items-center" style={{ gap: 8 }}>
        <div style={{ flex: 1, backgroundColor: '#EEEEEE', borderRadius: 2, height: 4 }}>
          <div style={{ height: 4, borderRadius: 2, backgroundColor: getDocsBarColor(supplier.docsPercent), width: `${supplier.docsPercent}%` }} />
        </div>
        <span style={{ fontSize: 11, color: '#808285', whiteSpace: 'nowrap' }}>Docs {supplier.docsPercent}%</span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: slaColors[supplier.sla], flexShrink: 0, display: 'inline-block' }} />
      </div>
    </div>
  );
}

export function PipelineKanban() {
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
        <button
          onClick={() => navigate('/pipeline/blacklisted')}
          style={{ padding: '8px 16px', fontSize: 14, fontWeight: 600, borderRadius: 8, border: '1px solid #000000', backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer', transition: 'box-shadow 0.15s ease-out' }}
        >
          Ver Blacklisted
        </button>
      </div>

      {/* Kanban board */}
      <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
        <div className="flex" style={{ gap: 16, minWidth: 'max-content' }}>
          {pipelineStageConfig.map((stage) => {
            const stageSuppliers = getSuppliersByStage(stage.name);
            const displayed = stageSuppliers.slice(0, 3);
            const hasMore = stageSuppliers.length > 3;

            return (
              <div key={stage.name} style={{ width: 240, flexShrink: 0, borderRadius: 10, backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.10)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Column header */}
                <div
                  className="flex items-center justify-between"
                  style={{ padding: '12px 16px', backgroundColor: stage.color, cursor: 'pointer' }}
                  onClick={() => navigate(`/pipeline/stage/${encodeURIComponent(stage.name)}`)}
                >
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#FFFFFF' }}>{stage.name}</span>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#FFFFFF' }}>
                    {stageSuppliers.length}
                  </span>
                </div>

                {/* Column body */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {displayed.map((supplier, idx) => (
                    <SupplierCard
                      key={supplier.id}
                      supplier={supplier}
                      stageColor={stage.color}
                      isLast={!hasMore && idx === displayed.length - 1}
                    />
                  ))}
                  {stageSuppliers.length === 0 && (
                    <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '32px 0', margin: 0 }}>Sin proveedores</p>
                  )}
                </div>

                {/* Footer link */}
                {hasMore && (
                  <button
                    onClick={() => navigate(`/pipeline/stage/${encodeURIComponent(stage.name)}`)}
                    style={{ fontSize: 13, fontWeight: 500, color: '#0084C0', textAlign: 'center', padding: '12px 16px', background: 'none', border: 'none', borderTop: '1px solid #EEEEEE', cursor: 'pointer', width: '100%' }}
                  >
                    Ver todos ({stageSuppliers.length}) →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
