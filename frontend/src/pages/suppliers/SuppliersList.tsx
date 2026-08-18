import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown, faEye, faSearchMinus,
  faPlus, faBuilding,
} from '@fortawesome/free-solid-svg-icons';
import { TRACKER_STAGE_CONFIG } from '../../constants/stage-config';
import { EmptyState } from '../../components/EmptyState';
import type { TrackerSupplier } from '../../types';
import {
  getBlacklistedSuppliers, getCompletedSuppliers, getTrackerSuppliers,
} from '../../services/suppliersService';
import { ApiError } from '../../services/api.config';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useTableSort, sortIcon, type SortDir } from '../../hooks/useTableSort';
import { filterBySearch } from '../../utils/search-filter';
import { getStageColor } from '../../utils/tracker-helpers';
import { SearchBar } from '../../components/SearchBar';
import { LoadingState } from '../../components/LoadingState';
import { moduleIcons } from '../../components/moduleIcons';
import { AddSupplierRouterModal } from '../tracker/AddSupplierRouterModal';
import { ACCENT_COLORS, BRAND_COLORS, NEUTRAL_COLORS } from '../../constants/designTokens';

type SortField = 'name' | 'folio' | 'commodity' | 'stage' | 'country' | 'buyer' | 'daysInStage';
type ListedSupplier = TrackerSupplier & { isBlacklisted?: boolean; isCompleted?: boolean };

/**
 * The master list is the three server-side lists merged, tagged with which one
 * each row came from — the tracker list carries the stage, while blacklisted
 * rows keep the stage they were rejected in and are shown as 'Blacklisted'.
 */
async function fetchAllSuppliers(): Promise<ListedSupplier[]> {
  const [tracker, blacklisted, completed] = await Promise.all([
    getTrackerSuppliers(),
    getBlacklistedSuppliers(),
    getCompletedSuppliers(),
  ]);
  return [
    ...tracker,
    ...blacklisted.map(s => ({
      ...s, stage: 'Blacklisted' as TrackerSupplier['stage'], isBlacklisted: true,
    })),
    ...completed.map(s => ({ ...s, isCompleted: true })),
  ];
}

export function SuppliersList() {
  const navigate = useNavigate();
  const toast = useToast();
  const { canWrite } = usePermissions();
  const tableRef = useRef<HTMLDivElement>(null);
  const [showAddRouterModal, setShowAddRouterModal] = useState(false);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [commodityFilter, setCommodityFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  const [allSuppliers, setAllSuppliers] = useState<ListedSupplier[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    fetchAllSuppliers()
      .then(list => { if (!cancelled) setAllSuppliers(list); })
      .catch(err => {
        if (cancelled) return;
        toast.systemError(
          err instanceof ApiError ? err.message : 'Could not load the supplier list.',
        );
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [toast]);

  useEffect(() => reload(), [reload]);

  const uniqueCommodities = useMemo(() => [...new Set(allSuppliers.map(s => s.commodity))].sort(), [allSuppliers]);
  const uniqueCountries = useMemo(() => [...new Set(allSuppliers.map(s => s.country))].sort(), [allSuppliers]);
  const uniqueBuyers = useMemo(() => [...new Set(allSuppliers.map(s => s.buyer))].sort(), [allSuppliers]);
  const stageOptions = TRACKER_STAGE_CONFIG.map(s => s.name);

  const activeFilterCount = [stageFilter, commodityFilter, countryFilter, buyerFilter].filter(Boolean).length;

  const filtered = useMemo(() => {
    let result = filterBySearch(allSuppliers, search, s =>
      [s.name, s.folio, s.commodity, s.productType, s.buyer, s.country]);
    if (stageFilter) result = result.filter(s => {
      const displayStage = s.isBlacklisted ? 'Blacklisted' : s.isCompleted ? 'Completed' : s.stage;
      return displayStage === stageFilter;
    });
    if (commodityFilter) result = result.filter(s => s.commodity === commodityFilter);
    if (countryFilter) result = result.filter(s => s.country === countryFilter);
    if (buyerFilter) result = result.filter(s => s.buyer === buyerFilter);
    return result;
  }, [allSuppliers, search, stageFilter, commodityFilter, countryFilter, buyerFilter]);

  const { sortField, sortDir, handleSort, sortedRows: sorted } = useTableSort<ListedSupplier, SortField>(
    filtered,
    (s, field) => {
      switch (field) {
        case 'name': return s.name;
        case 'folio': return s.folio;
        case 'commodity': return s.commodity;
        case 'stage': return s.isBlacklisted ? 'Blacklisted' : s.isCompleted ? 'Completed' : s.stage;
        case 'country': return s.country;
        case 'buyer': return s.buyer;
        case 'daysInStage': return s.daysInStage;
      }
    },
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * perPage, safePage * perPage);
  const startIdx = (safePage - 1) * perPage + 1;
  const endIdx = Math.min(safePage * perPage, sorted.length);

  function clearFilters() {
    setSearch('');
    setStageFilter('');
    setCommodityFilter('');
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
          <p style={{ fontSize: 16, fontWeight: 400, color: BRAND_COLORS.sidebar, margin: '4px 0 0' }}>
            {allSuppliers.length} suppliers registered
          </p>
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          {canWrite && (
            <button
              onClick={() => setShowAddRouterModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: BRAND_COLORS.accentRed, color: BRAND_COLORS.cards, fontWeight: 700, fontSize: 14, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'box-shadow 0.15s ease-out' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(220,2,2,0.30)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              <FontAwesomeIcon icon={faPlus} style={{ fontSize: 11 }} /> Add Supplier
            </button>
          )}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center flex-wrap" style={{ gap: 12, marginBottom: 24 }}>
        <SearchBar
          value={search}
          onChange={v => { setSearch(v); setPage(1); }}
          placeholder="Search supplier, folio, commodity..."
        />

        <FilterDropdown label="Stage" value={stageFilter} options={stageOptions} onChange={v => { setStageFilter(v); setPage(1); }} />
        <FilterDropdown label="Commodity" value={commodityFilter} options={uniqueCommodities} onChange={v => { setCommodityFilter(v); setPage(1); }} />
        <FilterDropdown label="Country" value={countryFilter} options={uniqueCountries} onChange={v => { setCountryFilter(v); setPage(1); }} />
        <FilterDropdown label="Buyer" value={buyerFilter} options={uniqueBuyers} onChange={v => { setBuyerFilter(v); setPage(1); }} />

        {activeFilterCount > 0 && (
          <>
            <span style={{ backgroundColor: `${BRAND_COLORS.accentRed}26`, color: BRAND_COLORS.accentRed, fontSize: 11, fontWeight: 500, padding: '4px 8px', borderRadius: 3 }}>
              {activeFilterCount} active filter{activeFilterCount > 1 ? 's' : ''}
            </span>
            <button
              onClick={clearFilters}
              style={{ fontSize: 13, fontWeight: 600, color: '#000000', background: BRAND_COLORS.cards, border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', transition: 'box-shadow 0.15s ease-out' }}
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
        {loading ? (
          <LoadingState entity="Suppliers" icon={moduleIcons.suppliers} style={{ padding: 48 }} />
        ) : (
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
          hasActiveFilters={activeFilterCount > 0 || !!search}
        />
        )}
      </div>

      {showAddRouterModal && (
        <AddSupplierRouterModal
          onClose={() => setShowAddRouterModal(false)}
          onCreated={reload}
        />
      )}
    </div>
  );
}

function ListView({ sorted, paginated, columns, sortField, sortDir, handleSort, navigate, safePage, totalPages, startIdx, endIdx, perPage, setPerPage, setPage, changePage, clearFilters, hasActiveFilters }: {
  // `ListedSupplier` (declared above) is the real row type — it already carries
  // the `isBlacklisted`/`isCompleted` tags this view branches on. Typing these
  // as `any[]` forced six `as any` casts below to read fields that were on the
  // type all along.
  sorted: ListedSupplier[]; paginated: ListedSupplier[];
  columns: { label: string; field: SortField; width?: string }[];
  sortField: SortField | null; sortDir: SortDir; handleSort: (f: SortField) => void;
  navigate: (p: string) => void; safePage: number; totalPages: number;
  startIdx: number; endIdx: number; perPage: number;
  setPerPage: (n: number) => void; setPage: (n: number) => void;
  changePage: (n: number) => void; clearFilters: () => void; hasActiveFilters: boolean;
}) {
  if (sorted.length === 0 && !hasActiveFilters) {
    // No filters/search active ⇒ the system genuinely has no suppliers yet —
    // a plain message, no "try different filters" copy and no Clear button.
    return <EmptyState icon={faBuilding} title="No suppliers yet" description="No suppliers yet." />;
  }

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={faSearchMinus}
        title="No suppliers found"
        description="Try different filters or search terms"
        action={{ label: 'Clear filters', onClick: clearFilters }}
      />
    );
  }

  return (
    <>
      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map(col => {
                const { icon, color: iconColor } = sortIcon(col.field, sortField, sortDir);
                return (
                  <th key={col.field} onClick={() => handleSort(col.field)} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000', backgroundColor: sortField === col.field ? BRAND_COLORS.background : NEUTRAL_COLORS.panelBg, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', width: col.width }}>
                    <span className="flex items-center" style={{ gap: 4 }}>
                      {col.label}
                      <FontAwesomeIcon icon={icon} style={{ fontSize: 10, color: iconColor }} />
                    </span>
                  </th>
                );
              })}
              <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000', backgroundColor: NEUTRAL_COLORS.panelBg, width: '60px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((supplier, i) => {
              const displayStage = supplier.isBlacklisted ? 'Blacklisted' : supplier.isCompleted ? 'Completed' : supplier.stage;
              const color = getStageColor(displayStage);
              return (
                <tr key={supplier.id} onClick={() => {
                  if (supplier.isCompleted) navigate(`/tracker/completed/supplier/${supplier.id}`);
                  else navigate(`/suppliers/supplier/${supplier.id}`);
                }} style={{ borderBottom: `0.5px solid ${NEUTRAL_COLORS.border}`, backgroundColor: i % 2 === 1 ? NEUTRAL_COLORS.panelBg : BRAND_COLORS.cards, cursor: 'pointer', transition: 'background-color 0.1s' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = BRAND_COLORS.background)} onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 1 ? NEUTRAL_COLORS.panelBg : BRAND_COLORS.cards)}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000' }}>{supplier.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: BRAND_COLORS.sidebar }}>{supplier.folio}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: BRAND_COLORS.sidebar }}>{supplier.commodity}</td>
                  <td style={{ padding: '12px 16px' }}><span style={{ backgroundColor: color + '26', color, fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 3 }}>{displayStage}</span></td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: BRAND_COLORS.sidebar }}>{supplier.country}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: BRAND_COLORS.sidebar }}>{supplier.buyer}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: BRAND_COLORS.sidebar }}>{supplier.daysInStage}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => {
                      if (supplier.isCompleted) navigate(`/tracker/completed/supplier/${supplier.id}`);
                      else navigate(`/suppliers/supplier/${supplier.id}`);
                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><FontAwesomeIcon icon={faEye} style={{ fontSize: 14, color: ACCENT_COLORS.info }} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between" style={{ marginTop: 16 }}>
        <div className="flex items-center" style={{ gap: 12 }}>
          <span style={{ fontSize: 12, color: BRAND_COLORS.sidebar }}>Showing {startIdx}–{endIdx} of {sorted.length} suppliers</span>
          <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }} style={{ padding: '4px 8px', border: `1px solid ${NEUTRAL_COLORS.borderLight}`, borderRadius: 4, fontSize: 12, color: '#000000', backgroundColor: BRAND_COLORS.cards, cursor: 'pointer' }}>
            <option value={15}>15 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>
        </div>
        <div className="flex items-center" style={{ gap: 4 }}>
          <button onClick={() => safePage > 1 && changePage(safePage - 1)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', fontSize: 13, color: safePage <= 1 ? NEUTRAL_COLORS.border : BRAND_COLORS.sidebar, cursor: safePage <= 1 ? 'not-allowed' : 'pointer', borderRadius: 4 }}>&lt;</button>
          {getPageNumbers(safePage, totalPages).map((p, i) =>
            p === '...' ? <span key={`dots-${i}`} style={{ width: 28, textAlign: 'center', fontSize: 12, color: BRAND_COLORS.sidebar }}>...</span> : (
              <button key={p} onClick={() => changePage(p as number)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer', backgroundColor: safePage === p ? BRAND_COLORS.accentRed : 'transparent', color: safePage === p ? BRAND_COLORS.cards : BRAND_COLORS.sidebar, fontWeight: safePage === p ? 700 : 400 }}>{p}</button>
            )
          )}
          <button onClick={() => safePage < totalPages && changePage(safePage + 1)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', fontSize: 13, color: safePage >= totalPages ? NEUTRAL_COLORS.border : BRAND_COLORS.sidebar, cursor: safePage >= totalPages ? 'not-allowed' : 'pointer', borderRadius: 4 }}>&gt;</button>
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
          appearance: 'none', padding: '8px 32px 8px 12px', border: `1px solid ${NEUTRAL_COLORS.borderLight}`, borderRadius: 8,
          fontSize: 13, color: value ? '#000000' : BRAND_COLORS.sidebar, backgroundColor: BRAND_COLORS.cards, cursor: 'pointer', outline: 'none',
        }}
      >
        <option value="">{label}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <FontAwesomeIcon icon={faChevronDown} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: BRAND_COLORS.sidebar, pointerEvents: 'none' }} />
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
