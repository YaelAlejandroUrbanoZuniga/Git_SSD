import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding, faColumns, faCalendarCheck, faExclamationTriangle,
  faArrowRight, faFileSignature, faClock, faExclamation, faPlus,
  faCalendar, faMapMarkerAlt, faCheckCircle,
} from '@fortawesome/free-solid-svg-icons';
import { pipelineSuppliers, blacklistedSuppliers, pipelineStageConfig } from '../data/pipeline-demo';
import { scoutingEvents } from '../data/events-demo';

const stageColors: Record<string, string> = Object.fromEntries(
  pipelineStageConfig.map(s => [s.name, s.color])
);

const allSuppliers = [...pipelineSuppliers, ...blacklistedSuppliers];
const activeSuppliers = allSuppliers.length;
const inPipeline = pipelineSuppliers.length;
const upcomingEventsCount = scoutingEvents.filter(e => e.status === 'Upcoming').length;
const eventsThisMonth = scoutingEvents.filter(e => e.status === 'Upcoming' || e.status === 'Ongoing').length;
const overdueSuppliers = pipelineSuppliers.filter(s => s.sla === 'red');
const overdueSLAs = overdueSuppliers.length;

const stageCounts = pipelineStageConfig.map(cfg => ({
  name: cfg.name,
  color: cfg.color,
  count: pipelineSuppliers.filter(s => s.stage === cfg.name).length,
}));
const totalInPipeline = stageCounts.reduce((a, s) => a + s.count, 0);
const maxStageCount = Math.max(...stageCounts.map(s => s.count));

const atRiskSuppliers = pipelineSuppliers.filter(s => s.sla === 'amber' || s.sla === 'red').slice(0, 4);

const commodityCounts: Record<string, number> = {};
allSuppliers.forEach(s => {
  commodityCounts[s.commodity] = (commodityCounts[s.commodity] || 0) + 1;
});
const topCommodities = Object.entries(commodityCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);
const maxCommodityCount = topCommodities[0]?.[1] || 1;
const totalCommodities = Object.keys(commodityCounts).length;

const upcomingEvents = scoutingEvents
  .filter(e => e.status === 'Upcoming' || e.status === 'Ongoing')
  .sort((a, b) => new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime())
  .slice(0, 3);

const redActivity = pipelineSuppliers.filter(s => s.sla === 'red');
const amberActivity = pipelineSuppliers.filter(s => s.sla === 'amber');
const greenActivity = pipelineSuppliers.filter(s => s.sla === 'green');

type ActivityItem = { icon: typeof faArrowRight; color: string; text: string; time: string };

const activityItems: ActivityItem[] = [
  ...(redActivity[0] ? [{ icon: faExclamation, color: '#DC0202', text: `${redActivity[0].name} · SLA overdue in ${redActivity[0].stage}`, time: '2h ago' }] : []),
  ...(amberActivity[0] ? [{ icon: faClock, color: '#D4A017', text: `${amberActivity[0].name} · SLA at risk in ${amberActivity[0].stage}`, time: '5h ago' }] : []),
  ...(greenActivity[0] ? [{ icon: faCheckCircle, color: '#6ABF4B', text: `${greenActivity[0].name} is in ${greenActivity[0].stage}`, time: '8h ago' }] : []),
  ...(amberActivity[1] ? [{ icon: faClock, color: '#D4A017', text: `${amberActivity[1].name} · SLA at risk in ${amberActivity[1].stage}`, time: '1d ago' }] : []),
  ...(greenActivity[1] ? [{ icon: faFileSignature, color: '#6ABF4B', text: `${greenActivity[1].name} is in ${greenActivity[1].stage}`, time: '1d ago' }] : []),
  ...(pipelineSuppliers[0] ? [{ icon: faPlus, color: '#02B3E1', text: `${pipelineSuppliers[0].name} registered as new supplier`, time: '2d ago' }] : []),
];

function formatCurrentDate(): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const now = new Date(2026, 5, 1);
  return `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
}

export function Inicio() {
  const navigate = useNavigate();

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Welcome, Yael</h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>
            Control panel · SSD Pipeline Management
          </p>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#808285', paddingTop: 8 }}>
          <FontAwesomeIcon icon={faCalendar} style={{ fontSize: 12 }} />
          {formatCurrentDate()}
        </span>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
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
            <span style={{ fontSize: 11, color: '#808285' }}>{blacklistedSuppliers.length} blacklisted</span>
          </div>
        </div>

        {/* KPI 2 - Active in Pipeline */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#808285' }}>Active in Pipeline</span>
            <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#02B3E11F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesomeIcon icon={faColumns} style={{ fontSize: 18, color: '#02B3E1' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: '#000000' }}>{inPipeline}</span>
            <span style={{ fontSize: 11, color: '#808285' }}>{inPipeline} active</span>
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

        {/* KPI 4 - Overdue SLAs */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#808285' }}>Overdue SLAs</span>
            <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#DC02021F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: 18, color: '#DC0202' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: '#000000' }}>{overdueSLAs}</span>
            {overdueSLAs > 0 && (
              <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 4, backgroundColor: '#DC020226', color: '#DC0202' }}>
                Urgent
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Middle section: 60/40 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {/* Pipeline Overview - 60% */}
        <div style={{ flex: '0 0 60%', backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 }}>Pipeline Overview</h2>
            <button
              onClick={() => navigate('/pipeline')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#0084C0', padding: 0 }}
            >
              View Pipeline &rarr;
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
          </div>

          <div style={{ marginTop: 16, borderTop: '0.5px solid #D1D3D4', paddingTop: 12 }}>
            <span style={{ fontSize: 12, color: '#808285' }}>Total in active pipeline: {totalInPipeline} suppliers</span>
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
              const statusColor = evt.status === 'Ongoing' ? '#6ABF4B' : '#02B3E1';
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

        {/* SLA en Riesgo */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20, borderLeft: '3px solid #D4A017' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 16px' }}>SLA at Risk</h2>

          {atRiskSuppliers.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 0' }}>
              <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: 16, color: '#6ABF4B' }} />
              <span style={{ fontSize: 13, color: '#808285' }}>No SLAs at risk</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {atRiskSuppliers.map((supplier, i) => {
                const slaLabel = supplier.sla === 'red' ? 'Overdue' : 'At Risk';
                const slaColor = supplier.sla === 'red' ? '#DC0202' : '#D4A017';
                const stageColor = stageColors[supplier.stage] || '#808285';
                return (
                  <div key={supplier.id}>
                    <div
                      onClick={() => navigate(`/suppliers/supplier/${supplier.id}`)}
                      style={{ padding: '8px 0', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#000000' }}>{supplier.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, backgroundColor: slaColor + '1F', color: slaColor }}>
                          {slaLabel}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 500, padding: '1px 6px', borderRadius: 3, backgroundColor: stageColor + '1F', color: stageColor }}>
                          {supplier.stage}
                        </span>
                        <span style={{ fontSize: 11, color: '#808285' }}>{supplier.daysInStage}d in stage</span>
                      </div>
                    </div>
                    {i < atRiskSuppliers.length - 1 && (
                      <div style={{ borderBottom: '0.5px solid #D1D3D4' }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
