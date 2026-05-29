import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faChevronDown, faEye, faArrowUp, faArrowDown, faSearchMinus } from '@fortawesome/free-solid-svg-icons';
import { pipelineSuppliers, blacklistedSuppliers, pipelineStageConfig, PipelineSupplier } from '../../data/pipeline-demo';
import { getDocsBarColor } from '../../utils/pipeline-helpers';
import { AddSupplierModal } from './AddSupplierModal';

type SortField = 'name' | 'folio' | 'commodity' | 'stage' | 'country' | 'buyer' | 'daysInStage' | 'sla' | 'docsPercent';
type SortDir = 'asc' | 'desc' | null;

const stageColors: Record<string, string> = {
  'Scouting Event': '#02B3E1',
  'B2B': '#6366F1',
  'Parking Lot': '#D4A017',
  'Preliminary Evaluation': '#E3650B',
  'RFQ': '#6ABF4B',
  'Investigation Record': '#0084C0',
  'Blacklisted': '#DC0202',
};

const slaLabels: Record<string, string> = { green: 'OK', amber: 'At Risk', red: 'Overdue' };
const slaColors: Record<string, string> = { green: '#6ABF4B', amber: '#D4A017', red: '#DC0202' };

function getAllSuppliers(): (PipelineSupplier & { isBlacklisted?: boolean })[] {
  const bl = blacklistedSuppliers.map(s => ({ ...s, stage: 'Blacklisted' as PipelineSupplier['stage'], isBlacklisted: true }));
  return [...pipelineSuppliers, ...bl];
}

export function SuppliersList() {
  const navigate = useNavigate();
  const tableRef = useRef<HTMLDivElement>(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [commodityFilter, setCommodityFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('');
  const [slaFilter, setSlaFilter] = useState('');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  const allSuppliers = useMemo(() => getAllSuppliers(), []);

  const uniqueCommodities = useMemo(() => [...new Set(allSuppliers.map(s => s.commodity))].sort(), [allSuppliers]);
  const uniqueCountries = useMemo(() => [...new Set(allSuppliers.map(s => s.country))].sort(), [allSuppliers]);
  const uniqueBuyers = useMemo(() => [...new Set(allSuppliers.map(s => s.buyer))].sort(), [allSuppliers]);
  const stageOptions = [...pipelineStageConfig.map(s => s.name), 'Blacklisted'];

  const activeFilterCount = [stageFilter, commodityFilter, countryFilter, buyerFilter, slaFilter].filter(Boolean).length;

  const filtered = useMemo(() => {
    let result = allSuppliers;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.folio.toLowerCase().includes(q) ||
        s.commodity.toLowerCase().includes(q) ||
        s.productType.toLowerCase().includes(q) ||
        s.buyer.toLowerCase().includes(q) ||
        s.country.toLowerCase().includes(q)
      );
    }
    if (stageFilter) result = result.filter(s => (s.isBlacklisted ? 'Blacklisted' : s.stage) === stageFilter);
    if (commodityFilter) result = result.filter(s => s.commodity === commodityFilter);
    if (countryFilter) result = result.filter(s => s.country === countryFilter);
    if (buyerFilter) result = result.filter(s => s.buyer === buyerFilter);
    if (slaFilter) {
      const slaMap: Record<string, string> = { 'OK': 'green', 'At Risk': 'amber', 'Overdue': 'red' };
      result = result.filter(s => s.sla === slaMap[slaFilter]);
    }
    return result;
  }, [allSuppliers, search, stageFilter, commodityFilter, countryFilter, buyerFilter, slaFilter]);

  const sorted = useMemo(() => {
    if (!sortField || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      switch (sortField) {
        case 'name': aVal = a.name; bVal = b.name; break;
        case 'folio': aVal = a.folio; bVal = b.folio; break;
        case 'commodity': aVal = a.commodity; bVal = b.commodity; break;
        case 'stage': aVal = a.isBlacklisted ? 'Blacklisted' : a.stage; bVal = b.isBlacklisted ? 'Blacklisted' : b.stage; break;
        case 'country': aVal = a.country; bVal = b.country; break;
        case 'buyer': aVal = a.buyer; bVal = b.buyer; break;
        case 'daysInStage': aVal = a.daysInStage; bVal = b.daysInStage; break;
        case 'sla': aVal = a.sla; bVal = b.sla; break;
        case 'docsPercent': aVal = a.docsPercent; bVal = b.docsPercent; break;
      }
      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal as string);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * perPage, safePage * perPage);
  const startIdx = (safePage - 1) * perPage + 1;
  const endIdx = Math.min(safePage * perPage, sorted.length);

  function handleSort(field: SortField) {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortField(null); setSortDir(null); }
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function clearFilters() {
    setSearch('');
    setStageFilter('');
    setCommodityFilter('');
    setCountryFilter('');
    setBuyerFilter('');
    setSlaFilter('');
    setPage(1);
  }

  function changePage(p: number) {
    setPage(p);
    tableRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  const columns: { label: string; field: SortField; width?: string }[] = [
    { label: 'Supplier Name', field: 'name' },
    { label: 'Folio', field: 'folio' },
    { label: 'Commodity', field: 'commodity' },
    { label: 'Current Stage', field: 'stage' },
    { label: 'País', field: 'country' },
    { label: 'Buyer', field: 'buyer' },
    { label: 'Days in Stage', field: 'daysInStage', width: '100px' },
    { label: 'SLA', field: 'sla', width: '90px' },
    { label: 'Docs %', field: 'docsPercent', width: '130px' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Suppliers</h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>
            {allSuppliers.length} proveedores registrados
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{ backgroundColor: '#DC0202', color: '#FFFFFF', fontWeight: 700, fontSize: 14, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'box-shadow 0.15s ease-out' }}
        >
          + Agregar Supplier
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center flex-wrap" style={{ gap: 12, marginBottom: 24 }}>
        <div className="relative" style={{ flex: '1 1 0', maxWidth: '50%' }}>
          <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#808285', fontSize: 14 }} />
          <input
            type="text"
            placeholder="Buscar proveedor, folio, commodity..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 8, paddingBottom: 8, border: '1px solid #E0E0E0', borderRadius: 6, fontSize: 13, color: '#000000', backgroundColor: '#FFFFFF', outline: 'none' }}
          />
        </div>

        <FilterDropdown label="Stage" value={stageFilter} options={stageOptions} onChange={v => { setStageFilter(v); setPage(1); }} />
        <FilterDropdown label="Commodity" value={commodityFilter} options={uniqueCommodities} onChange={v => { setCommodityFilter(v); setPage(1); }} />
        <FilterDropdown label="País" value={countryFilter} options={uniqueCountries} onChange={v => { setCountryFilter(v); setPage(1); }} />
        <FilterDropdown label="Buyer" value={buyerFilter} options={uniqueBuyers} onChange={v => { setBuyerFilter(v); setPage(1); }} />
        <FilterDropdown label="SLA" value={slaFilter} options={['OK', 'At Risk', 'Overdue']} onChange={v => { setSlaFilter(v); setPage(1); }} />

        {activeFilterCount > 0 && (
          <>
            <span style={{ backgroundColor: '#DC020226', color: '#DC0202', fontSize: 11, fontWeight: 500, padding: '4px 8px', borderRadius: 3 }}>
              {activeFilterCount} filtro{activeFilterCount > 1 ? 's' : ''} activo{activeFilterCount > 1 ? 's' : ''}
            </span>
            <button
              onClick={clearFilters}
              style={{ fontSize: 13, fontWeight: 500, color: '#808285', background: 'none', border: '1px solid #E0E0E0', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#000000')}
              onMouseLeave={e => (e.currentTarget.style.color = '#808285')}
            >
              Limpiar filtros
            </button>
          </>
        )}
      </div>

      {/* Table */}
      <div ref={tableRef}>
        {sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <FontAwesomeIcon icon={faSearchMinus} style={{ fontSize: 48, color: '#D1D3D4', marginBottom: 16 }} />
            <p style={{ fontSize: 16, fontWeight: 700, color: '#000000', margin: '0 0 4px' }}>No se encontraron proveedores</p>
            <p style={{ fontSize: 13, color: '#808285', margin: '0 0 16px' }}>Intenta con otros filtros o términos de búsqueda</p>
            <button
              onClick={clearFilters}
              style={{ fontSize: 13, fontWeight: 500, color: '#000000', background: 'none', border: '1px solid #E0E0E0', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <>
            <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {columns.map(col => (
                      <th
                        key={col.field}
                        onClick={() => handleSort(col.field)}
                        style={{
                          textAlign: 'left', padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000',
                          backgroundColor: sortField === col.field ? '#EEEEEE' : '#F7F7F7',
                          cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
                          width: col.width,
                        }}
                      >
                        <span className="flex items-center" style={{ gap: 4 }}>
                          {col.label}
                          {sortField === col.field && sortDir === 'asc' && <FontAwesomeIcon icon={faArrowUp} style={{ fontSize: 10, color: '#000000' }} />}
                          {sortField === col.field && sortDir === 'desc' && <FontAwesomeIcon icon={faArrowDown} style={{ fontSize: 10, color: '#000000' }} />}
                          {sortField !== col.field && <FontAwesomeIcon icon={faArrowUp} style={{ fontSize: 10, color: '#D1D3D4' }} />}
                        </span>
                      </th>
                    ))}
                    <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000', backgroundColor: '#F7F7F7', width: '60px' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((supplier, i) => {
                    const displayStage = supplier.isBlacklisted ? 'Blacklisted' : supplier.stage;
                    const color = stageColors[displayStage] ?? '#808285';
                    const slaColor = slaColors[supplier.sla];
                    const slaLabel = slaLabels[supplier.sla];

                    return (
                      <tr
                        key={supplier.id}
                        onClick={() => navigate(`/suppliers/supplier/${supplier.id}`)}
                        style={{
                          borderBottom: '0.5px solid #D1D3D4',
                          backgroundColor: i % 2 === 1 ? '#F7F7F7' : '#FFFFFF',
                          cursor: 'pointer',
                          transition: 'background-color 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#EEEEEE')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 1 ? '#F7F7F7' : '#FFFFFF')}
                      >
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000' }}>{supplier.name}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#808285' }}>{supplier.folio}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{supplier.commodity}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ backgroundColor: color + '26', color, fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 3 }}>
                            {displayStage}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{supplier.country}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{supplier.buyer}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{supplier.daysInStage}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ backgroundColor: slaColor + '26', color: slaColor, fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 3 }}>
                            {slaLabel}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div className="flex items-center" style={{ gap: 6 }}>
                            <div style={{ width: 80, backgroundColor: '#EEEEEE', borderRadius: 2, height: 4 }}>
                              <div style={{ height: 4, borderRadius: 2, backgroundColor: getDocsBarColor(supplier.docsPercent), width: `${supplier.docsPercent}%` }} />
                            </div>
                            <span style={{ fontSize: 11, color: '#808285' }}>{supplier.docsPercent}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => navigate(`/suppliers/supplier/${supplier.id}`)}
                            title="Ver detalle"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                          >
                            <FontAwesomeIcon icon={faEye} style={{ fontSize: 14, color: '#0084C0' }} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between" style={{ marginTop: 16 }}>
              <div className="flex items-center" style={{ gap: 12 }}>
                <span style={{ fontSize: 12, color: '#808285' }}>
                  Mostrando {startIdx}–{endIdx} de {sorted.length} proveedores
                </span>
                <select
                  value={perPage}
                  onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
                  style={{ padding: '4px 8px', border: '1px solid #E0E0E0', borderRadius: 4, fontSize: 12, color: '#000000', backgroundColor: '#FFFFFF', cursor: 'pointer' }}
                >
                  <option value={15}>15 / página</option>
                  <option value={25}>25 / página</option>
                  <option value={50}>50 / página</option>
                </select>
              </div>

              <div className="flex items-center" style={{ gap: 4 }}>
                <button
                  onClick={() => safePage > 1 && changePage(safePage - 1)}
                  style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', fontSize: 13, color: safePage <= 1 ? '#D1D3D4' : '#808285', cursor: safePage <= 1 ? 'not-allowed' : 'pointer', borderRadius: 4 }}
                >
                  &lt;
                </button>
                {getPageNumbers(safePage, totalPages).map((p, i) =>
                  p === '...' ? (
                    <span key={`dots-${i}`} style={{ width: 28, textAlign: 'center', fontSize: 12, color: '#808285' }}>...</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => changePage(p as number)}
                      style={{
                        width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer',
                        backgroundColor: safePage === p ? '#DC0202' : 'transparent',
                        color: safePage === p ? '#FFFFFF' : '#808285',
                        fontWeight: safePage === p ? 700 : 400,
                      }}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  onClick={() => safePage < totalPages && changePage(safePage + 1)}
                  style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', fontSize: 13, color: safePage >= totalPages ? '#D1D3D4' : '#808285', cursor: safePage >= totalPages ? 'not-allowed' : 'pointer', borderRadius: 4 }}
                >
                  &gt;
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {showModal && <AddSupplierModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

function FilterDropdown({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="relative" style={{ display: 'inline-block' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          appearance: 'none', padding: '8px 32px 8px 12px', border: '1px solid #E0E0E0', borderRadius: 8,
          fontSize: 13, color: value ? '#000000' : '#808285', backgroundColor: '#FFFFFF', cursor: 'pointer', outline: 'none',
        }}
      >
        <option value="">{label}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <FontAwesomeIcon icon={faChevronDown} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#808285', pointerEvents: 'none' }} />
    </div>
  );
}

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | string)[] = [1];
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}
