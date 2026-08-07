import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faArrowLeft, faCircleCheck, faEye, faArrowUp, faArrowDown, faColumns } from '@fortawesome/free-solid-svg-icons';
import type { CompletedSupplier } from '../../types';
import { getCompletedSuppliers } from '../../services/suppliersService';
import { ApiError } from '../../services/api.config';
import { useToast } from '../../context/ToastContext';
import { getStageColor } from '../../utils/tracker-helpers';
import { SearchBar } from '../../components/SearchBar';
import { LoadingState } from '../../components/LoadingState';
import { EmptyState } from '../../components/EmptyState';

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
    const q = searchTerm.trim().toLowerCase();
    return completedSuppliers.filter(s => {
      const matchesSearch =
        !q || s.name.toLowerCase().includes(q) || s.folio.toLowerCase().includes(q) ||
        s.commodity.toLowerCase().includes(q) || s.buyer.toLowerCase().includes(q);
      const matchesCommodity = !commodityFilter || s.commodity === commodityFilter;
      const matchesBuyer = !buyerFilter || s.buyer === buyerFilter;
      return matchesSearch && matchesCommodity && matchesBuyer;
    });
  }, [searchTerm, commodityFilter, buyerFilter, completedSuppliers]);

  type COSortField = 'folio' | 'name' | 'country' | 'commodity' | 'buyer' | 'completedDate' | 'completedBy';
  type SortDir3 = 'asc' | 'desc' | null;
  const [sortField, setSortField] = useState<COSortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir3>(null);

  const handleCOSort = (field: COSortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else if (sortDir === 'desc') {
      setSortField(null);
      setSortDir(null);
    } else {
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    if (!sortField || !sortDir) return filtered;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = (a[sortField] || '').toLowerCase();
      const bv = (b[sortField] || '').toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sortField, sortDir]);


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
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.14)', color: '#FFFFFF', cursor: 'pointer', transition: 'background 0.15s', marginBottom: 10 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.24)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
          >
            <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 12 }} />
            Back
          </button>
          <div className="flex items-center" style={{ gap: 10, marginBottom: 8 }}>
            <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 20, color: 'rgba(255,255,255,0.90)' }} />
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '-0.02em' }}>Completed Suppliers</h1>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
            Suppliers that completed the full SSD tracker cycle
          </p>
        </div>
      </div>

      {/* Breadcrumb */}
      <nav style={{ marginBottom: 20, marginTop: 4 }}>
        <span style={{ fontSize: 12, color: '#808285' }}>
          <Link to="/tracker" style={{ color: '#0084C0', textDecoration: 'none', fontWeight: 500 }}>Tracker</Link>
          <span style={{ margin: '0 6px', color: '#808285' }}>/</span>
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
        <div className="relative">
          <select
            value={commodityFilter}
            onChange={e => setCommodityFilter(e.target.value)}
            style={{ appearance: 'none', WebkitAppearance: 'none', padding: '8px 32px 8px 12px', border: '1px solid #D1D3D4', borderRadius: 8, fontSize: 13, color: '#000000', backgroundColor: '#FFFFFF', cursor: 'pointer', outline: 'none' }}
          >
            <option value="">All commodities</option>
            {commodities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <FontAwesomeIcon icon={faChevronDown} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#808285', pointerEvents: 'none' }} />
        </div>
        <div className="relative">
          <select
            value={buyerFilter}
            onChange={e => setBuyerFilter(e.target.value)}
            style={{ appearance: 'none', WebkitAppearance: 'none', padding: '8px 32px 8px 12px', border: '1px solid #D1D3D4', borderRadius: 8, fontSize: 13, color: '#000000', backgroundColor: '#FFFFFF', cursor: 'pointer', outline: 'none' }}
          >
            <option value="">All buyers</option>
            {buyers.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <FontAwesomeIcon icon={faChevronDown} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#808285', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* Empty state */}
      {loading ? (
        <LoadingState entity="Suppliers" icon={faColumns} style={{ justifyContent: 'center', padding: '64px 32px' }} />
      ) : completedSuppliers.length === 0 ? (
        <EmptyState icon={faCircleCheck} title="No suppliers completed" description="No suppliers have completed the tracker yet." />
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
                ] as { label: string; field: COSortField | null }[]).map(col => (
                  <th
                    key={col.label}
                    onClick={col.field ? () => handleCOSort(col.field as COSortField) : undefined}
                    style={{ textAlign: col.field ? 'left' : 'center', padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000', borderBottom: '0.5px solid #D1D3D4', cursor: col.field ? 'pointer' : 'default', userSelect: 'none', backgroundColor: col.field && sortField === col.field ? '#EEEEEE' : '#F7F7F7' }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {col.label}
                      {col.field && sortField === col.field && sortDir === 'asc'  && <FontAwesomeIcon icon={faArrowUp}   style={{ fontSize: 10, color: '#000000' }} />}
                      {col.field && sortField === col.field && sortDir === 'desc' && <FontAwesomeIcon icon={faArrowDown} style={{ fontSize: 10, color: '#000000' }} />}
                      {col.field && sortField !== col.field && <FontAwesomeIcon icon={faArrowUp} style={{ fontSize: 10, color: '#D1D3D4' }} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <tr
                  key={s.id}
                  style={{ borderBottom: '0.5px solid #D1D3D4', backgroundColor: i % 2 === 1 ? '#F7F7F7' : '#FFFFFF', cursor: 'pointer', transition: 'background-color 0.1s' }}
                  onClick={() => navigate(`/tracker/completed/supplier/${s.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#EEEEEE')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 1 ? '#F7F7F7' : '#FFFFFF')}
                >
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#808285' }}>{s.folio}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000' }}>{s.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{s.country}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{s.commodity}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{s.buyer}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{s.completedDate}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{s.completedBy}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/tracker/completed/supplier/${s.id}`); }}
                      title="View detail"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#0084C0' }}
                    >
                      <FontAwesomeIcon icon={faEye} style={{ fontSize: 15 }} />
                    </button>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 32, textAlign: 'center', fontSize: 13, color: '#808285' }}>
                    No suppliers match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
