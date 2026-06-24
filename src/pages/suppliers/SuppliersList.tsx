import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMagnifyingGlass, faChevronDown, faEye, faArrowUp, faArrowDown, faSearchMinus,
  faClipboard, faPlus,
} from '@fortawesome/free-solid-svg-icons';
import { pipelineSuppliers, blacklistedSuppliers, completedSuppliers, pipelineStageConfig } from '../../data/pipeline-demo';
import type { PipelineSupplier } from '../../types';
import { AddSupplierModal } from './AddSupplierModal';
import { AddSupplierRouterModal } from '../pipeline/AddSupplierRouterModal';

type SortField = 'name' | 'folio' | 'commodity' | 'stage' | 'country' | 'buyer' | 'daysInStage';
type SortDir = 'asc' | 'desc' | null;

const stageColors: Record<string, string> = {
  'Scouting Event': '#02B3E1',
  'B2B': '#6366F1',
  'Parking Lot': '#D4A017',
  'Preliminary Evaluation': '#E3650B',
  'Supplier Evaluation': '#6ABF4B',
  'Intelex Handoff': '#0084C0',
  'Blacklisted': '#DC0202',
  'Completed': '#6ABF4B',
};

function getAllSuppliers(): (PipelineSupplier & { isBlacklisted?: boolean; isCompleted?: boolean })[] {
  const bl = blacklistedSuppliers.map(s => ({ ...s, stage: 'Blacklisted' as PipelineSupplier['stage'], isBlacklisted: true }));
  const co = completedSuppliers.map(s => ({ ...s, isCompleted: true }));
  return [...pipelineSuppliers, ...bl, ...co];
}

export function SuppliersList() {
  const navigate = useNavigate();
  const tableRef = useRef<HTMLDivElement>(null);
  const [showFormsModal, setShowFormsModal] = useState(false);
  const [showAddRouterModal, setShowAddRouterModal] = useState(false);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  const allSuppliers = useMemo(() => getAllSuppliers(), []);

  const uniqueCountries = useMemo(() => [...new Set(allSuppliers.map(s => s.country))].sort(), [allSuppliers]);
  const uniqueBuyers = useMemo(() => [...new Set(allSuppliers.map(s => s.buyer))].sort(), [allSuppliers]);
  const stageOptions = [...pipelineStageConfig.map(s => s.name), 'Blacklisted', 'Completed'];

  const activeFilterCount = [stageFilter, countryFilter, buyerFilter].filter(Boolean).length;

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
    if (stageFilter) result = result.filter(s => {
      const displayStage = s.isBlacklisted ? 'Blacklisted' : s.isCompleted ? 'Completed' : s.stage;
      return displayStage === stageFilter;
    });
    if (countryFilter) result = result.filter(s => s.country === countryFilter);
    if (buyerFilter) result = result.filter(s => s.buyer === buyerFilter);
    return result;
  }, [allSuppliers, search, stageFilter, countryFilter, buyerFilter]);

  const sorted = useMemo(() => {
    if (!sortField || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      switch (sortField) {
        case 'name': aVal = a.name; bVal = b.name; break;
        case 'folio': aVal = a.folio; bVal = b.folio; break;
        case 'commodity': aVal = a.commodity; bVal = b.commodity; break;
        case 'stage':
          aVal = a.isBlacklisted ? 'Blacklisted' : (a as any).isCompleted ? 'Completed' : a.stage;
          bVal = b.isBlacklisted ? 'Blacklisted' : (b as any).isCompleted ? 'Completed' : b.stage;
          break;
        case 'country': aVal = a.country; bVal = b.country; break;
        case 'buyer': aVal = a.buyer; bVal = b.buyer; break;
        case 'daysInStage': aVal = a.daysInStage; bVal = b.daysInStage; break;
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
    setCountryFilter('');
    setBuyerFilter('');
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
    { label: 'Country', field: 'country' },
    { label: 'Buyer', field: 'buyer' },
    { label: 'Days in Stage', field: 'daysInStage', width: '100px' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Suppliers</h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>
            {allSuppliers.length} suppliers registered
          </p>
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          <button
            onClick={() => setShowFormsModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 8, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer', transition: 'box-shadow 0.15s ease-out' }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.13)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            <FontAwesomeIcon icon={faClipboard} style={{ fontSize: 12 }} /> Forms
          </button>
          <button
            onClick={() => setShowAddRouterModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#DC0202', color: '#FFFFFF', fontWeight: 700, fontSize: 14, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'box-shadow 0.15s ease-out' }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(220,2,2,0.30)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            <FontAwesomeIcon icon={faPlus} style={{ fontSize: 11 }} /> Add Supplier
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center flex-wrap" style={{ gap: 12, marginBottom: 24 }}>
        <div className="relative" style={{ flex: '1 1 0', maxWidth: '50%' }}>
          <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#808285', fontSize: 14 }} />
          <input
            type="text"
            placeholder="Search supplier, folio, commodity..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 8, paddingBottom: 8, border: '1px solid #E0E0E0', borderRadius: 6, fontSize: 13, color: '#000000', backgroundColor: '#FFFFFF', outline: 'none' }}
          />
        </div>

        <FilterDropdown label="Stage" value={stageFilter} options={stageOptions} onChange={v => { setStageFilter(v); setPage(1); }} />
        <FilterDropdown label="Country" value={countryFilter} options={uniqueCountries} onChange={v => { setCountryFilter(v); setPage(1); }} />
        <FilterDropdown label="Buyer" value={buyerFilter} options={uniqueBuyers} onChange={v => { setBuyerFilter(v); setPage(1); }} />

        {activeFilterCount > 0 && (
          <>
            <span style={{ backgroundColor: '#DC020226', color: '#DC0202', fontSize: 11, fontWeight: 500, padding: '4px 8px', borderRadius: 3 }}>
              {activeFilterCount} active filter{activeFilterCount > 1 ? 's' : ''}
            </span>
            <button
              onClick={clearFilters}
              style={{ fontSize: 13, fontWeight: 600, color: '#000000', background: '#FFFFFF', border: '1px solid #D1D3D4', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', transition: 'box-shadow 0.15s ease-out' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.13)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              Clear filters
            </button>
          </>
        )}
      </div>

      {/* Content */}
      <div ref={tableRef}>
        <ListView
          sorted={sorted}
          paginated={paginated}
          columns={columns}
          sortField={sortField}
          sortDir={sortDir}
          handleSort={handleSort}
          navigate={navigate}
          safePage={safePage}
          totalPages={totalPages}
          startIdx={startIdx}
          endIdx={endIdx}
          perPage={perPage}
          setPerPage={setPerPage}
          setPage={setPage}
          changePage={changePage}
          clearFilters={clearFilters}
        />
      </div>

      {showFormsModal && <AddSupplierModal onClose={() => setShowFormsModal(false)} />}
      {showAddRouterModal && <AddSupplierRouterModal onClose={() => setShowAddRouterModal(false)} />}
    </div>
  );
}

function ListView({ sorted, paginated, columns, sortField, sortDir, handleSort, navigate, safePage, totalPages, startIdx, endIdx, perPage, setPerPage, setPage, changePage, clearFilters }: {
  sorted: any[]; paginated: any[]; columns: { label: string; field: SortField; width?: string }[];
  sortField: SortField | null; sortDir: SortDir; handleSort: (f: SortField) => void;
  navigate: (p: string) => void; safePage: number; totalPages: number;
  startIdx: number; endIdx: number; perPage: number;
  setPerPage: (n: number) => void; setPage: (n: number) => void;
  changePage: (n: number) => void; clearFilters: () => void;
}) {
  if (sorted.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0' }}>
        <FontAwesomeIcon icon={faSearchMinus} style={{ fontSize: 48, color: '#D1D3D4', marginBottom: 16 }} />
        <p style={{ fontSize: 16, fontWeight: 700, color: '#000000', margin: '0 0 4px' }}>No suppliers found</p>
        <p style={{ fontSize: 13, color: '#808285', margin: '0 0 16px' }}>Try different filters or search terms</p>
        <button onClick={clearFilters} style={{ fontSize: 13, fontWeight: 600, color: '#000000', background: '#FFFFFF', border: '1px solid #D1D3D4', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', transition: 'box-shadow 0.15s ease-out' }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.13)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.field} onClick={() => handleSort(col.field)} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000', backgroundColor: sortField === col.field ? '#EEEEEE' : '#F7F7F7', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', width: col.width }}>
                  <span className="flex items-center" style={{ gap: 4 }}>
                    {col.label}
                    {sortField === col.field && sortDir === 'asc' && <FontAwesomeIcon icon={faArrowUp} style={{ fontSize: 10, color: '#000000' }} />}
                    {sortField === col.field && sortDir === 'desc' && <FontAwesomeIcon icon={faArrowDown} style={{ fontSize: 10, color: '#000000' }} />}
                    {sortField !== col.field && <FontAwesomeIcon icon={faArrowUp} style={{ fontSize: 10, color: '#D1D3D4' }} />}
                  </span>
                </th>
              ))}
              <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000', backgroundColor: '#F7F7F7', width: '60px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((supplier: any, i: number) => {
              const displayStage = supplier.isBlacklisted ? 'Blacklisted' : (supplier as any).isCompleted ? 'Completed' : supplier.stage;
              const color = stageColors[displayStage] ?? '#808285';
              return (
                <tr key={supplier.id} onClick={() => {
                  if ((supplier as any).isCompleted) navigate(`/pipeline/completed/supplier/${supplier.id}`);
                  else navigate(`/suppliers/supplier/${supplier.id}`);
                }} style={{ borderBottom: '0.5px solid #D1D3D4', backgroundColor: i % 2 === 1 ? '#F7F7F7' : '#FFFFFF', cursor: 'pointer', transition: 'background-color 0.1s' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#EEEEEE')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 1 ? '#F7F7F7' : '#FFFFFF')}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000' }}>{supplier.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#808285' }}>{supplier.folio}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{supplier.commodity}</td>
                  <td style={{ padding: '12px 16px' }}><span style={{ backgroundColor: color + '26', color, fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 3 }}>{displayStage}</span></td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{supplier.country}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{supplier.buyer}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{supplier.daysInStage}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => {
                      if ((supplier as any).isCompleted) navigate(`/pipeline/completed/supplier/${supplier.id}`);
                      else navigate(`/suppliers/supplier/${supplier.id}`);
                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><FontAwesomeIcon icon={faEye} style={{ fontSize: 14, color: '#0084C0' }} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between" style={{ marginTop: 16 }}>
        <div className="flex items-center" style={{ gap: 12 }}>
          <span style={{ fontSize: 12, color: '#808285' }}>Showing {startIdx}–{endIdx} of {sorted.length} suppliers</span>
          <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }} style={{ padding: '4px 8px', border: '1px solid #E0E0E0', borderRadius: 4, fontSize: 12, color: '#000000', backgroundColor: '#FFFFFF', cursor: 'pointer' }}>
            <option value={15}>15 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>
        <div className="flex items-center" style={{ gap: 4 }}>
          <button onClick={() => safePage > 1 && changePage(safePage - 1)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', fontSize: 13, color: safePage <= 1 ? '#D1D3D4' : '#808285', cursor: safePage <= 1 ? 'not-allowed' : 'pointer', borderRadius: 4 }}>&lt;</button>
          {getPageNumbers(safePage, totalPages).map((p, i) =>
            p === '...' ? <span key={`dots-${i}`} style={{ width: 28, textAlign: 'center', fontSize: 12, color: '#808285' }}>...</span> : (
              <button key={p} onClick={() => changePage(p as number)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer', backgroundColor: safePage === p ? '#DC0202' : 'transparent', color: safePage === p ? '#FFFFFF' : '#808285', fontWeight: safePage === p ? 700 : 400 }}>{p}</button>
            )
          )}
          <button onClick={() => safePage < totalPages && changePage(safePage + 1)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', fontSize: 13, color: safePage >= totalPages ? '#D1D3D4' : '#808285', cursor: safePage >= totalPages ? 'not-allowed' : 'pointer', borderRadius: 4 }}>&gt;</button>
        </div>
      </div>
    </>
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
