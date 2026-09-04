import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faCircleCheck, faEye } from '@fortawesome/free-solid-svg-icons';
import type { CompletedSupplier } from '../../types';
import { getCompletedSuppliers } from '../../services/suppliersService';
import { ApiError } from '../../services/api.config';
import { useToast } from '../../context/ToastContext';
import { getStageColor } from '../../utils/tracker-helpers';
import { SearchBar } from '../../components/SearchBar';
import { FilterPanel } from '../../components/FilterPanel';
import { FilterField } from '../../components/FilterField';
import { CatalogSelect } from '../../components/CatalogSelect';
import { LoadingState } from '../../components/LoadingState';
import { EmptyState } from '../../components/EmptyState';
import { moduleIcons } from '../../components/moduleIcons';
import { useTableSort, sortIcon } from '../../hooks/useTableSort';
import { filterBySearch } from '../../utils/search-filter';
import { ACCENT_COLORS, BRAND_COLORS, NEUTRAL_COLORS } from '../../constants/designTokens';

export function TrackerCompleted() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [commodityFilter, setCommodityFilter] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('');
  const [completedSuppliers, setCompletedSuppliers] = useState<CompletedSupplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCompletedSuppliers()
      .then(list => { if (!cancelled) setCompletedSuppliers(list); })
      .catch(err => {
        if (!cancelled) toast.systemError(err instanceof ApiError ? err.message : 'Could not load completed suppliers.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [toast]);

  const commodities = useMemo(
    () => Array.from(new Set(completedSuppliers.map(s => s.commodity))).sort(),
    [completedSuppliers]
  );
  const buyers = useMemo(
    () => Array.from(new Set(completedSuppliers.map(s => s.buyer))).sort(),
    [completedSuppliers]
  );

  const filtered = useMemo(() => {
    const byDropdowns = completedSuppliers.filter(s =>
      (!commodityFilter || s.commodity === commodityFilter) &&
      (!buyerFilter || s.buyer === buyerFilter),
    );
    return filterBySearch(byDropdowns, searchTerm, s => [s.name, s.folio, s.commodity, s.buyer]);
  }, [searchTerm, commodityFilter, buyerFilter, completedSuppliers]);

  const activeFilterCount = [commodityFilter, buyerFilter].filter(Boolean).length;
  const clearFilters = () => { setCommodityFilter(''); setBuyerFilter(''); };

  type COSortField = 'folio' | 'name' | 'country' | 'commodity' | 'buyer' | 'completedDate' | 'completedBy';
  const { sortField, sortDir, handleSort: handleCOSort, sortedRows: sorted } = useTableSort<CompletedSupplier, COSortField>(
    filtered,
    (s, field) => (field === 'completedDate' ? new Date(s.completedDate) : s[field]),
  );


  return (
    <div>
      {/* ── Hero Header ──────────────────────────────────────── */}
      <div style={{
        backgroundColor: getStageColor('Completed'),
        padding: '20px 32px',
        marginBottom: 28,
        marginLeft: -32,
        marginRight: -32,
        marginTop: -32,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}>
        <div>
          <button
            onClick={() => navigate('/tracker')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.14)', color: BRAND_COLORS.cards, cursor: 'pointer', transition: 'background 0.15s', marginBottom: 10 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.24)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
          >
            <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 12 }} />
            Back
          </button>
          <div className="flex items-center" style={{ gap: 10, marginBottom: 8 }}>
            <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 20, color: 'rgba(255,255,255,0.90)' }} />
            <h1 style={{ fontSize: 28, fontWeight: 800, color: BRAND_COLORS.cards, margin: 0, letterSpacing: '-0.02em' }}>Completed Suppliers</h1>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
            Suppliers that completed the full SSD tracker cycle
          </p>
        </div>
      </div>

      {/* Breadcrumb */}
      <nav style={{ marginBottom: 20, marginTop: 4 }}>
        <span style={{ fontSize: 12, color: BRAND_COLORS.sidebar }}>
          <Link to="/tracker" style={{ color: ACCENT_COLORS.info, textDecoration: 'none', fontWeight: 500 }}>Tracker</Link>
          <span style={{ margin: '0 6px', color: BRAND_COLORS.sidebar }}>/</span>
          <span style={{ color: '#000000', fontWeight: 600 }}>Completed</span>
        </span>
      </nav>

      {/* Filters */}
      <div className="flex items-center" style={{ gap: 12, marginBottom: 24 }}>
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search supplier, folio, commodity, buyer..."
          style={{ flex: '1 1 0', maxWidth: 320 }}
        />
        <FilterPanel activeCount={activeFilterCount} onClearAll={clearFilters}>
          <FilterField label="Commodity">
            <CatalogSelect value={commodityFilter} onChange={setCommodityFilter} options={commodities} placeholder="All commodities" />
          </FilterField>
          <FilterField label="Buyer">
            <CatalogSelect value={buyerFilter} onChange={setBuyerFilter} options={buyers} placeholder="All buyers" />
          </FilterField>
        </FilterPanel>
      </div>

      {/* Empty state */}
      {loading ? (
        <LoadingState entity="Suppliers" icon={moduleIcons.tracker} style={{ padding: '64px 32px' }} />
      ) : completedSuppliers.length === 0 ? (
        <EmptyState icon={faCircleCheck} title="No suppliers completed" description="No suppliers have completed the tracker yet." />
      ) : sorted.length === 0 ? (
        <EmptyState icon={faCircleCheck} title="No matches" description="No suppliers match the current filters." />
      ) : (
        <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {([
                  { label: 'Folio',          field: 'folio' as COSortField },
                  { label: 'Supplier',       field: 'name' as COSortField },
                  { label: 'Country',        field: 'country' as COSortField },
                  { label: 'Commodity',      field: 'commodity' as COSortField },
                  { label: 'Buyer',          field: 'buyer' as COSortField },
                  { label: 'Completed Date', field: 'completedDate' as COSortField },
                  { label: 'Completed By',   field: 'completedBy' as COSortField },
                  { label: 'Actions',        field: null },
                ] as { label: string; field: COSortField | null }[]).map(col => {
                  const iconInfo = col.field ? sortIcon(col.field, sortField, sortDir) : null;
                  return (
                    <th
                      key={col.label}
                      onClick={col.field ? () => handleCOSort(col.field as COSortField) : undefined}
                      style={{ textAlign: col.field ? 'left' : 'center', padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000', borderBottom: `0.5px solid ${NEUTRAL_COLORS.border}`, cursor: col.field ? 'pointer' : 'default', userSelect: 'none', backgroundColor: col.field && sortField === col.field ? BRAND_COLORS.background : NEUTRAL_COLORS.panelBg }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {col.label}
                        {iconInfo && <FontAwesomeIcon icon={iconInfo.icon} style={{ fontSize: 10, color: iconInfo.color }} />}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <tr
                  key={s.id}
                  style={{ borderBottom: `0.5px solid ${NEUTRAL_COLORS.border}`, backgroundColor: i % 2 === 1 ? NEUTRAL_COLORS.panelBg : BRAND_COLORS.cards, cursor: 'pointer', transition: 'background-color 0.1s' }}
                  onClick={() => navigate(`/tracker/completed/supplier/${s.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = BRAND_COLORS.background)}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 1 ? NEUTRAL_COLORS.panelBg : BRAND_COLORS.cards)}
                >
                  <td style={{ padding: '12px 16px', fontSize: 12, color: BRAND_COLORS.sidebar }}>{s.folio}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000' }}>{s.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: BRAND_COLORS.sidebar }}>{s.country}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: BRAND_COLORS.sidebar }}>{s.commodity}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: BRAND_COLORS.sidebar }}>{s.buyer}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: BRAND_COLORS.sidebar }}>{s.completedDate}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: BRAND_COLORS.sidebar }}>{s.completedBy}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/tracker/completed/supplier/${s.id}`); }}
                      title="View detail"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: ACCENT_COLORS.info }}
                    >
                      <FontAwesomeIcon icon={faEye} style={{ fontSize: 15 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
