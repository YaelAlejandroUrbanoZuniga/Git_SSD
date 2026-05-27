import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding, faColumns, faCalendar, faExclamationCircle,
  faArrowRight, faPlus, faCheck, faTriangleExclamation, faFile,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { pipelineStages, recentActivity } from '../data/demo';

interface KPI {
  label: string;
  value: number;
  icon: IconDefinition;
  iconColor: string;
  badge?: boolean;
}

const kpis: KPI[] = [
  { label: 'Suppliers Activos', value: 47,  icon: faBuilding,        iconColor: '#6ABF4B' },
  { label: 'En Pipeline',       value: 23,  icon: faColumns,         iconColor: '#02B3E1' },
  { label: 'Eventos este mes',  value: 5,   icon: faCalendar,        iconColor: '#6366F1' },
  { label: 'SLAs vencidos',     value: 2,   icon: faExclamationCircle, iconColor: '#DC0202', badge: true },
];

const activityIconMap: Record<string, IconDefinition> = {
  'fa-arrow-right':          faArrowRight,
  'fa-plus':                 faPlus,
  'fa-check':                faCheck,
  'fa-exclamation-triangle': faTriangleExclamation,
  'fa-file':                 faFile,
};

export function Inicio() {
  const totalSuppliers = pipelineStages.reduce((acc, s) => acc + s.count, 0);

  return (
    <div>
      {/* Page header */}
      <div className="flex items-end justify-between" style={{ marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Inicio</h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', marginTop: 4, margin: '4px 0 0' }}>
            Panel de control del pipeline de proveedores
          </p>
        </div>
        <button
          className="btn-primary"
          style={{
            backgroundColor: '#DC0202', color: '#FFFFFF',
            fontWeight: 700, fontSize: 14,
            padding: '8px 16px', borderRadius: 8,
            border: 'none', cursor: 'pointer',
            transition: 'box-shadow 0.15s ease-out',
          }}
        >
          + Nuevo Supplier
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 32 }}>
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white card-hover"
            style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}
          >
            <div className="flex items-start justify-between" style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#808285', margin: 0 }}>{kpi.label}</p>
              {/* Circular icon container */}
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 42, height: 42,
                  borderRadius: '50%',
                  backgroundColor: kpi.iconColor + '21',  /* ~13% opacity */
                }}
              >
                <FontAwesomeIcon icon={kpi.icon} style={{ fontSize: 20, color: kpi.iconColor }} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <span style={{ fontSize: 32, fontWeight: 700, color: '#000000', lineHeight: 1 }}>
                {kpi.value}
              </span>
              {kpi.badge && (
                <span
                  style={{
                    backgroundColor: '#DC020226',
                    color: '#DC0202',
                    fontSize: 11, fontWeight: 500,
                    padding: '3px 7px', borderRadius: 4,
                    marginBottom: 4,
                  }}
                >
                  Urgente
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline overview + Recent activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
        <div
          className="bg-white card-hover"
          style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}
        >
          <h2 style={{ fontWeight: 700, fontSize: 15, margin: '0 0 20px' }}>Pipeline Overview</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pipelineStages.map((stage) => (
              <div key={stage.name} className="flex items-center" style={{ gap: 12 }}>
                <span style={{ fontSize: 12, color: '#808285', width: 148, textAlign: 'right', flexShrink: 0 }}>
                  {stage.name}
                </span>
                <div
                  className="flex-1 overflow-hidden"
                  style={{ backgroundColor: '#EEEEEE', borderRadius: 6, height: 24 }}
                >
                  <div
                    className="h-full flex items-center px-3"
                    style={{
                      width: `${Math.max((stage.count / totalSuppliers) * 100, 8)}%`,
                      backgroundColor: stage.color,
                      borderRadius: 6,
                      transition: 'width 0.3s',
                    }}
                  >
                    <span style={{ color: '#FFF', fontSize: 11, fontWeight: 600 }}>{stage.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="bg-white card-hover"
          style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}
        >
          <h2 style={{ fontWeight: 700, fontSize: 15, margin: '0 0 20px' }}>Actividad Reciente</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {recentActivity.map((item, i) => {
              const icon = activityIconMap[item.icon] ?? faArrowRight;
              return (
                <div key={i} className="flex items-start" style={{ gap: 12 }}>
                  <div
                    className="flex items-center justify-center shrink-0"
                    style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#EEEEEE' }}
                  >
                    <FontAwesomeIcon icon={icon} style={{ fontSize: 11, color: '#808285' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, color: '#000000', margin: '0 0 2px' }}>{item.text}</p>
                    <p style={{ fontSize: 12, color: '#808285', margin: 0 }}>{item.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
