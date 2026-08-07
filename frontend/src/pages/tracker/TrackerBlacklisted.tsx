import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faArrowLeft, faBan, faColumns } from '@fortawesome/free-solid-svg-icons';
import type { BlacklistedSupplier } from '../../types';
import { getBlacklistedSuppliers } from '../../services/suppliersService';
import { ApiError } from '../../services/api.config';
import { useToast } from '../../context/ToastContext';
import { SearchBar } from '../../components/SearchBar';
import { LoadingState } from '../../components/LoadingState';
import { useTableSort, sortIcon } from '../../hooks/useTableSort';

export function TrackerBlacklisted() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [commodityFilter, setCommodityFilter] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('');
  const [blacklistedSuppliers, setBlacklistedSuppliers] = useState<BlacklistedSupplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBlacklistedSuppliers()
      .then(list => { if (!cancelled) setBlacklistedSuppliers(list); })
      .catch(err => {
        if (!cancelled) toast.systemError(err instanceof ApiError ? err.message : 'Could not load blacklisted suppliers.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [toast]);

  const commodities = useMemo(
    () => Array.from(new Set(blacklistedSuppliers.map(s => s.commodity))).sort(),
    [blacklistedSuppliers]
  );
  const buyers = useMemo(
    () => Array.from(new Set(blacklistedSuppliers.map(s => s.buyer))).sort(),
    [blacklistedSuppliers]
  );

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return blacklistedSuppliers.filter(s => {
      const matchesSearch =
        !q || s.name.toLowerCase().includes(q) || s.folio.toLowerCase().includes(q) ||
        s.commodity.toLowerCase().includes(q) || s.buyer.toLowerCase().includes(q);
      const matchesCommodity = !commodityFilter || s.commodity === commodityFilter;
      const matchesBuyer = !buyerFilter || s.buyer === buyerFilter;
      return matchesSearch && matchesCommodity && matchesBuyer;
    });
  }, [searchTerm, commodityFilter, buyerFilter, blacklistedSuppliers]);

  type BLSortField = 'name' | 'folio' | 'commodity' | 'productType' | 'scoutingInput' | 'buyer' | 'rejectedBy' | 'rejectionDate';
  const { sortField, sortDir, handleSort: handleBLSort, sortedRows: sorted } = useTableSort<BlacklistedSupplier, BLSortField>(
    filtered,
    (s, field) => (field === 'rejectionDate' ? new Date(s.rejectionDate) : s[field]),
  );


  return (
    <div>
      {/* ── Hero Header ──────────────────────────────────────── */}
      <div style={{
        backgroundColor: '#000000',
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
            <FontAwesomeIcon icon={faBan} style={{ fontSize: 20, color: 'rgba(255,255,255,0.90)' }} />
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF', margin: 0, letterSpacing: '-0.02em' }}>Blacklisted</h1>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
            {blacklistedSuppliers.length} rejected suppliers
          </p>
        </div>
      </div>

      {/* Breadcrumb */}
      <nav style={{ marginBottom: 20, marginTop: 4 }}>
        <span style={{ fontSize: 12, color: '#808285' }}>
          <Link to="/tracker" style={{ color: '#0084C0', textDecoration: 'none', fontWeight: 500 }}>Tracker</Link>
          <span style={{ margin: '0 6px', color: '#808285' }}>/</span>
          <span style={{ color: '#000000', fontWeight: 600 }}>Blacklisted</span>
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

      {/* Table */}
      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {([
                { label: 'Company',       field: 'name' as BLSortField },
                { label: 'Folio',         field: 'folio' as BLSortField },
                { label: 'Commodity',     field: 'commodity' as BLSortField },
                { label: 'Product type',  field: 'productType' as BLSortField },
                { label: 'Scouting Input', field: 'scoutingInput' as BLSortField },
                { label: 'Buyer',         field: 'buyer' as BLSortField },
                { label: 'Rejected by',   field: 'rejectedBy' as BLSortField },
                { label: 'Date',          field: 'rejectionDate' as BLSortField },
                { label: 'Reason',        field: null },
              ] as { label: string; field: BLSortField | null }[]).map(col => {
                const iconInfo = col.field ? sortIcon(col.field, sortField, sortDir) : null;
                return (
                  <th
                    key={col.label}
                    onClick={col.field ? () => handleBLSort(col.field as BLSortField) : undefined}
                    style={{ textAlign: 'left', padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000', borderBottom: '0.5px solid #D1D3D4', cursor: col.field ? 'pointer' : 'default', userSelect: 'none', backgroundColor: col.field && sortField === col.field ? '#EEEEEE' : '#F7F7F7' }}
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
                style={{ borderBottom: '0.5px solid #D1D3D4', backgroundColor: i % 2 === 1 ? '#F7F7F7' : '#FFFFFF', cursor: 'pointer', transition: 'background-color 0.1s' }}
                onClick={() => navigate(`/tracker/blacklisted/supplier/${s.id}?from=tracker`)}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#EEEEEE')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 1 ? '#F7F7F7' : '#FFFFFF')}
              >
                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000' }}>{s.name}</td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#808285' }}>{s.folio}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{s.commodity}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{s.productType}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{s.scoutingInput}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{s.buyer}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{s.rejectedBy}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285' }}>{s.rejectionDate}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#808285', maxWidth: 220 }}>
                  <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {s.rejectionReason}
                  </span>
                </td>
              </tr>
            ))}
            {loading && (
              <tr>
                <td colSpan={9}>
                  <LoadingState entity="Suppliers" icon={faColumns} style={{ justifyContent: 'center' }} />
                </td>
              </tr>
            )}
            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: 32, textAlign: 'center', fontSize: 13, color: '#808285' }}>
                  No suppliers match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
