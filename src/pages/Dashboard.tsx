import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBuilding, faColumns, faCalendar, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { pipelineStages } from '../data/demo';

interface KPI {
  label: string;
  value: number;
  icon: IconDefinition;
  iconColor: string;
}

const kpis: KPI[] = [
  { label: 'Suppliers Activos', value: 47, icon: faBuilding,         iconColor: '#6ABF4B' },
  { label: 'En Pipeline',       value: 23, icon: faColumns,          iconColor: '#02B3E1' },
  { label: 'Eventos este mes',  value: 5,  icon: faCalendar,         iconColor: '#6366F1' },
  { label: 'SLAs vencidos',     value: 2,  icon: faExclamationCircle, iconColor: '#DC0202' },
];

const kanbanColors: Record<string, string> = {
  'Identified':             '#6B7280',
  'Scouting Event':         '#02B3E1',
  'B2B':                    '#6366F1',
  'Parking Lot':            '#D4A017',
  'Preliminary Evaluation': '#E3650B',
  'RFQ':                    '#6ABF4B',
  'Blacklisted':            '#DC0202',
};

const categoryData = [
  { name: 'Auto Parts',   value: 32, color: '#DC0202' },
  { name: 'Electronics',  value: 24, color: '#02B3E1' },
  { name: 'Steel',        value: 18, color: '#808285' },
  { name: 'Other',        value: 26, color: '#6ABF4B' },
];

const monthlyData = [
  { month: 'Jan', suppliers: 3 },
  { month: 'Feb', suppliers: 7 },
  { month: 'Mar', suppliers: 5 },
  { month: 'Apr', suppliers: 9 },
  { month: 'May', suppliers: 12 },
];

export function Dashboard() {
  return (
    <div>
      <div className="flex items-end justify-between" style={{ marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Dashboard</h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>Business Intelligence</p>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 32 }}>
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white card-hover"
            style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}
          >
            <div className="flex items-start justify-between" style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#808285', margin: 0 }}>{kpi.label}</p>
              <div
                className="flex items-center justify-center shrink-0"
                style={{ width: 42, height: 42, borderRadius: '50%', backgroundColor: kpi.iconColor + '21' }}
              >
                <FontAwesomeIcon icon={kpi.icon} style={{ fontSize: 20, color: kpi.iconColor }} />
              </div>
            </div>
            <span style={{ fontSize: 32, fontWeight: 700, color: '#000000' }}>{kpi.value}</span>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
          <h2 style={{ fontWeight: 700, fontSize: 14, margin: '0 0 16px' }}>Suppliers por Etapa</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={pipelineStages} layout="vertical" margin={{ left: 10, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={130} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {pipelineStages.map((stage) => (
                  <Cell key={stage.name} fill={kanbanColors[stage.name] ?? stage.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
          <h2 style={{ fontWeight: 700, fontSize: 14, margin: '0 0 16px' }}>Suppliers por Categoría</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={categoryData} cx="50%" cy="50%"
                innerRadius={55} outerRadius={90}
                paddingAngle={3} dataKey="value"
                label={({ name, value }) => `${name} ${value}%`}
                labelLine={false}
              >
                {categoryData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart row 2 */}
      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24, marginBottom: 32 }}>
        <h2 style={{ fontWeight: 700, fontSize: 14, margin: '0 0 16px' }}>Suppliers incorporados por mes</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={monthlyData} margin={{ left: 10, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="suppliers" stroke="#DC0202" strokeWidth={2} dot={{ fill: '#DC0202', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Actions */}
      <div className="flex" style={{ gap: 8 }}>
        {['Exportar', 'Personalizar vista'].map(label => (
          <button
            key={label}
            className="btn-secondary"
            style={{
              padding: '8px 16px', fontSize: 14, fontWeight: 600,
              borderRadius: 8, border: '1px solid #000000',
              backgroundColor: '#FFFFFF', color: '#000000',
              cursor: 'pointer', transition: 'box-shadow 0.15s ease-out',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
