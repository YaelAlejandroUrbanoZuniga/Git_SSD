import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding, faColumns, faPercent, faBan,
  faDownload, faCheck, faChevronDown,
} from '@fortawesome/free-solid-svg-icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, Area, AreaChart,
} from 'recharts';
import { pipelineSuppliers, blacklistedSuppliers, completedSuppliers, pipelineStageConfig } from '../data/pipeline-demo';
import { scoutingEvents } from '../data/events-demo';

const allSuppliers = [...pipelineSuppliers, ...blacklistedSuppliers, ...completedSuppliers];
const totalSuppliers = allSuppliers.length;
const inPipelineActive = pipelineSuppliers.length;

const stageData = [...pipelineStageConfig, { name: 'Blacklisted' as const, color: '#DC0202' }].map(cfg => ({
  name: cfg.name,
  count: cfg.name === 'Blacklisted'
    ? blacklistedSuppliers.length
    : pipelineSuppliers.filter(s => s.stage === cfg.name).length,
  color: cfg.color,
}));

const commodityColors = ['#02B3E1', '#6366F1', '#D4A017', '#6ABF4B', '#E3650B', '#0891B2', '#6B7280'];
const commodityCounts: Record<string, number> = {};
allSuppliers.forEach(s => { commodityCounts[s.commodity] = (commodityCounts[s.commodity] || 0) + 1; });
const commodityData = Object.entries(commodityCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([name, value], i) => ({ name, value, color: commodityColors[i % commodityColors.length] }));

const monthlyData = [
  { month: 'Jan', suppliers: 3 },
  { month: 'Feb', suppliers: 5 },
  { month: 'Mar', suppliers: 7 },
  { month: 'Apr', suppliers: 5 },
  { month: 'May', suppliers: 8 },
  { month: 'Jun', suppliers: pipelineSuppliers.length },
];

const countryCounts: Record<string, number> = {};
allSuppliers.forEach(s => { countryCounts[s.country] = (countryCounts[s.country] || 0) + 1; });
const countryData = Object.entries(countryCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6)
  .map(([name, count]) => ({ name, count }));

const eventStatusData = [
  { name: 'Upcoming', value: scoutingEvents.filter(e => e.status === 'Upcoming').length, color: '#02B3E1' },
  { name: 'Ongoing', value: scoutingEvents.filter(e => e.status === 'Ongoing').length, color: '#6ABF4B' },
  { name: 'Completed', value: scoutingEvents.filter(e => e.status === 'Completed').length, color: '#6B7280' },
];

const completedEvents = scoutingEvents.filter(e => e.status === 'Completed');
const conversionData = completedEvents.map(evt => {
  const evaluated = evt.supplierEntries.length;
  const included = evt.supplierEntries.filter(e => e.result === 'Included').length;
  const abbrevName = evt.name.length > 20 ? evt.name.slice(0, 18) + '...' : evt.name;
  return { name: abbrevName, evaluated, included, pct: evaluated > 0 ? Math.round((included / evaluated) * 100) : 0 };
});

const buyers = [...new Set(pipelineSuppliers.map(s => s.buyer))];
const buyerData = buyers.map(buyer => {
  const suppliersByBuyer = pipelineSuppliers.filter(s => s.buyer === buyer);
  const count = suppliersByBuyer.length;
  const stages = suppliersByBuyer.map(s => s.stage);
  const stageOrder = pipelineStageConfig.map(c => c.name);
  const avgStageIdx = Math.round(stages.reduce((a, st) => a + stageOrder.indexOf(st), 0) / count);
  const avgStage = stageOrder[avgStageIdx] || stageOrder[0] || '—';
  return { buyer, count, avgStage };
});

const allCommodities = [...new Set(allSuppliers.map(s => s.commodity))].sort();
const allStages = pipelineStageConfig.map(s => s.name);

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      backgroundColor: '#FFFFFF', borderRadius: 8, padding: '12px 20px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <FontAwesomeIcon icon={faCheck} style={{ color: '#6ABF4B', fontSize: 14 }} />
      <span style={{ fontSize: 13, color: '#000000' }}>{message}</span>
    </div>
  );
}

function ChartTypeSelector({ options, active, onChange }: { options: string[]; active: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 0, borderRadius: 4, overflow: 'hidden' }}>
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            padding: '4px 10px', fontSize: 11, fontWeight: 500, border: 'none', cursor: 'pointer',
            backgroundColor: active === opt ? '#DC0202' : '#EEEEEE',
            color: active === opt ? '#FFFFFF' : '#808285',
            transition: 'all 0.15s',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function DownloadBtn({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
    >
      <FontAwesomeIcon icon={faDownload} style={{ fontSize: 12, color: hovered ? '#0084C0' : '#808285', transition: 'color 0.15s' }} />
    </button>
  );
}

function FilterDropdown({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <label style={{ fontSize: 12, color: '#808285', marginRight: 6 }}>{label}:</label>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            fontSize: 12, padding: '5px 24px 5px 8px', borderRadius: 4,
            border: '1px solid #D1D3D4', backgroundColor: '#FFFFFF', color: '#000000',
            appearance: 'none', cursor: 'pointer', minWidth: 120,
          }}
        >
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <FontAwesomeIcon icon={faChevronDown} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: '#808285', pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

export function Dashboard() {
  const [toast, setToast] = useState<string | null>(null);
  const [filterPeriod, setFilterPeriod] = useState('All time');
  const [filterCommodity, setFilterCommodity] = useState('All');
  const [filterStage, setFilterStage] = useState('All');
  const [animKey, setAnimKey] = useState(0);

  const [chartAType, setChartAType] = useState('Bar');
  const [chartBType, setChartBType] = useState('Donut');
  const [chartCType, setChartCType] = useState('Area');
  const [chartEType, setChartEType] = useState('Bar');

  function showToast(msg: string) { setToast(msg); }

  function handleFilterChange(setter: (v: string) => void) {
    return (v: string) => {
      setter(v);
      setAnimKey(k => k + 1);
    };
  }

  function resetFilters() {
    setFilterPeriod('All time');
    setFilterCommodity('All');
    setFilterStage('All');
    setAnimKey(k => k + 1);
  }

  const totalBuyerSuppliers = buyerData.reduce((a, b) => a + b.count, 0);

  return (
    <div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Visuals</h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>Business Intelligence · SSD Pipeline</p>
        </div>
        <button
          onClick={() => showToast('Report exported as PDF')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', fontSize: 13, fontWeight: 600,
            border: '1px solid #D1D3D4', borderRadius: 6,
            backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer',
            transition: 'box-shadow 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.13)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
        >
          <FontAwesomeIcon icon={faDownload} style={{ fontSize: 12 }} />
          Export report
        </button>
      </div>

      {/* Global Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <FilterDropdown label="Period" value={filterPeriod} onChange={handleFilterChange(setFilterPeriod)} options={['Last 30 days', 'Last 3 months', 'Last 6 months', 'All time']} />
        <FilterDropdown label="Commodity" value={filterCommodity} onChange={handleFilterChange(setFilterCommodity)} options={['All', ...allCommodities]} />
        <FilterDropdown label="Stage" value={filterStage} onChange={handleFilterChange(setFilterStage)} options={['All', ...allStages]} />
        <button
          onClick={resetFilters}
          style={{ fontSize: 12, color: '#808285', border: '1px solid #D1D3D4', borderRadius: 4, padding: '5px 10px', backgroundColor: '#FFFFFF', cursor: 'pointer' }}
        >
          Reset filters
        </button>
      </div>

      {/* Animated wrapper */}
      <div key={animKey} style={{ animation: 'fadeIn 200ms ease-out' }}>
        {/* KPIs - 4 cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KpiCard icon={faBuilding} color="#02B3E1" label="Total Suppliers" value={totalSuppliers} sub="registered in the system" />
          <KpiCard icon={faColumns} color="#6ABF4B" label="Active Pipeline" value={inPipelineActive} sub="in active process" />
          <KpiCard icon={faBan} color="#DC0202" label="Blacklisted" value={blacklistedSuppliers.length} sub="rejected suppliers" />
          <KpiCard icon={faPercent} color="#6366F1" label="Conversion Rate" value="10.5%" sub="event → Parking Lot" />
        </div>

        {/* Section 2 - Pipeline & Commodity */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {/* Chart A - Suppliers por Etapa - 60% */}
          <div style={{ flex: '0 0 60%', backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 }}>Suppliers by Stage</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ChartTypeSelector options={['Bar', 'Line']} active={chartAType} onChange={setChartAType} />
                <DownloadBtn onClick={() => showToast('Chart exported')} />
              </div>
            </div>
            {chartAType === 'Bar' ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stageData} layout="vertical" margin={{ left: 10, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" horizontal={true} vertical={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {stageData.map(s => <Cell key={s.name} fill={s.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={monthlyData} margin={{ left: 10, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="suppliers" stroke="#DC0202" fill="#DC0202" fillOpacity={0.1} strokeWidth={2} dot={{ fill: '#DC0202', r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Chart B - Distribución por Commodity - 40% */}
          <div style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 }}>Distribution by Commodity</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ChartTypeSelector options={['Donut', 'Bar']} active={chartBType} onChange={setChartBType} />
                <DownloadBtn onClick={() => showToast('Chart exported')} />
              </div>
            </div>
            {chartBType === 'Donut' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <ResponsiveContainer width="55%" height={220}>
                  <PieChart>
                    <Pie data={commodityData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                      {commodityData.map(d => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip />
                    <text x="50%" y="48%" textAnchor="middle" style={{ fontSize: 22, fontWeight: 700, fill: '#000000' }}>{totalSuppliers}</text>
                    <text x="50%" y="58%" textAnchor="middle" style={{ fontSize: 11, fill: '#808285' }}>suppliers</text>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {commodityData.slice(0, 6).map(d => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: '#000000', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
                      <span style={{ fontSize: 11, color: '#808285' }}>{d.value}</span>
                      <span style={{ fontSize: 10, color: '#808285' }}>{Math.round((d.value / totalSuppliers) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={commodityData.slice(0, 7)} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {commodityData.slice(0, 7).map(d => <Cell key={d.name} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Section 3 - Tendencia temporal (full width) */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 }}>Suppliers onboarded per month</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ChartTypeSelector options={['Area', 'Line', 'Bar']} active={chartCType} onChange={setChartCType} />
              <DownloadBtn onClick={() => showToast('Chart exported')} />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            {chartCType === 'Bar' ? (
              <BarChart data={monthlyData} margin={{ left: 10, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 15]} />
                <Tooltip />
                <Bar dataKey="suppliers" fill="#DC0202" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : chartCType === 'Line' ? (
              <LineChart data={monthlyData} margin={{ left: 10, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 15]} />
                <Tooltip />
                <Line type="monotone" dataKey="suppliers" stroke="#DC0202" strokeWidth={2} dot={{ fill: '#DC0202', r: 4 }} />
              </LineChart>
            ) : (
              <AreaChart data={monthlyData} margin={{ left: 10, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 15]} />
                <Tooltip />
                <Area type="monotone" dataKey="suppliers" stroke="#DC0202" fill="#DC0202" fillOpacity={0.12} strokeWidth={2} dot={{ fill: '#DC0202', r: 4 }} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Section 4 - Geographic Distribution (full width) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 24 }}>
          {/* Chart E - Suppliers by Country */}
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 }}>Geographic Distribution</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ChartTypeSelector options={['Bar', 'Table']} active={chartEType} onChange={setChartEType} />
                <DownloadBtn onClick={() => showToast('Chart exported')} />
              </div>
            </div>
            {chartEType === 'Bar' ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={countryData} layout="vertical" margin={{ left: 10, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" horizontal={true} vertical={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0084C0" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ overflow: 'hidden', borderRadius: 6, border: '1px solid #E0E0E0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F7F7F7' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#333333' }}>Country</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600, color: '#333333' }}>Suppliers</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600, color: '#333333' }}>% of total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countryData.map((row, i) => (
                      <tr key={row.name} style={{ backgroundColor: i % 2 === 1 ? '#F7F7F7' : '#FFFFFF' }}>
                        <td style={{ padding: '8px 12px', color: '#000000' }}>{row.name}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: '#333333' }}>{row.count}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: '#808285' }}>{Math.round((row.count / totalSuppliers) * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Section 5 - Events & Conversion (40/60) */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {/* Events por Status - 40% */}
          <div style={{ flex: '0 0 40%', backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 }}>Events by Status</h2>
              <DownloadBtn onClick={() => showToast('Chart exported')} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ResponsiveContainer width="55%" height={180}>
                <PieChart>
                  <Pie data={eventStatusData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                    {eventStatusData.map(d => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {eventStatusData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: d.color }} />
                    <span style={{ fontSize: 12, color: '#000000', flex: 1 }}>{d.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#000000' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Conversion por evento - 60% */}
          <div style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 }}>Conversion rate per event</h2>
              <DownloadBtn onClick={() => showToast('Chart exported')} />
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={conversionData} margin={{ left: 0, right: 8, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEEEEE" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="evaluated" name="Evaluated" fill="#808285" radius={[3, 3, 0, 0]} />
                <Bar dataKey="included" name="Included" fill="#6ABF4B" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Section 6 - Tabla Resumen por Buyer */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 16px' }}>Summary by Buyer</h2>
          <div style={{ overflow: 'hidden', borderRadius: 6, border: '1px solid #E0E0E0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ backgroundColor: '#F7F7F7', borderBottom: '1px solid #E0E0E0' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600, color: '#333333' }}>Buyer</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 600, color: '#333333' }}>Suppliers</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 600, color: '#333333' }}>Avg. Stage</th>
                </tr>
              </thead>
              <tbody>
                {buyerData.map((row, i) => (
                  <tr key={row.buyer} style={{ backgroundColor: i % 2 === 1 ? '#F7F7F7' : '#FFFFFF', borderBottom: '1px solid #F0F0F0' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#000000' }}>{row.buyer}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#333333' }}>{row.count}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#333333' }}>{row.avgStage}</td>
                  </tr>
                ))}
                {/* Total row */}
                <tr style={{ backgroundColor: '#F7F7F7', borderTop: '2px solid #E0E0E0' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#000000' }}>Total / Average</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#000000' }}>{totalBuyerSuppliers}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: '#808285' }}>—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CSS animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function KpiCard({ icon, color, label, value, sub }: { icon: any; color: string; label: string; value: number | string; sub: string }) {
  return (
    <div style={{ backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#808285' }}>{label}</span>
        <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: color + '1F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FontAwesomeIcon icon={icon} style={{ fontSize: 16, color }} />
        </div>
      </div>
      <span style={{ fontSize: 30, fontWeight: 700, color: '#000000', display: 'block' }}>{value}</span>
      <span style={{ fontSize: 11, color: '#808285', marginTop: 4, display: 'block' }}>{sub}</span>
    </div>
  );
}
