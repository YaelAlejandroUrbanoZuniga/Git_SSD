import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faChevronDown, faArrowLeft, faBan, faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons';
import { blacklistedSuppliers } from '../../data/pipeline-demo';

export function PipelineBlacklisted() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [commodityFilter, setCommodityFilter] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('');

  const commodities = useMemo(
    () => Array.from(new Set(blacklistedSuppliers.map(s => s.commodity))).sort(),
    []
  );
  const buyers = useMemo(
    () => Array.from(new Set(blacklistedSuppliers.map(s => s.buyer))).sort(),
    []
  );

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return blacklistedSuppliers.filter(s => {
      const matchesSearch =
        !q || s.name.toLowerCase().includes(q) || s.commodity.toLowerCase().includes(q);
      const matchesCommodity = !commodityFilter || s.commodity === commodityFilter;
      const matchesBuyer = !buyerFilter || s.buyer === buyerFilter;
      return matchesSearch && matchesCommodity && matchesBuyer;
    });
  }, [searchTerm, commodityFilter, buyerFilter]);

  type BLSortField = 'name' | 'folio' | 'commodity' | 'productType' | 'scoutingInput' | 'buyer' | 'rejectedBy' | 'rejectionDate';
  type SortDir3 = 'asc' | 'desc' | null;
  const [sortField, setSortField] = useState<BLSortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir3>(null);

  const handleBLSort = (field: BLSortField) => {
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
            onClick={() => navigate('/pipeline')}
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
          <Link to="/pipeline" style={{ color: '#0084C0', textDecoration: 'none', fontWeight: 500 }}>Pipeline</Link>
          <span style={{ margin: '0 6px', color: '#808285' }}>/</span>
          <span style={{ color: '#000000', fontWeight: 600 }}>Blacklisted</span>
        </span>
      </nav>

      {/* Filters */}
      <div className="flex items-center" style={{ gap: 12, marginBottom: 24 }}>
        <div className="relative" style={{ flex: '1 1 0', maxWidth: 320 }}>
          <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#808285', fontSize: 14 }} />
          <input
            type="text"
            placeholder="Search supplier..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 8, paddingBottom: 8, border: '1px solid #E0E0E0', borderRadius: 6, fontSize: 13, color: '#000000', backgroundColor: '#FFFFFF', outline: 'none' }}
          />
        </div>
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
              ] as { label: string; field: BLSortField | null }[]).map(col => (
                <th
                  key={col.label}
                  onClick={col.field ? () => handleBLSort(col.field as BLSortField) : undefined}
                  style={{ textAlign: 'left', padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#000000', borderBottom: '0.5px solid #D1D3D4', cursor: col.field ? 'pointer' : 'default', userSelect: 'none', backgroundColor: col.field && sortField === col.field ? '#EEEEEE' : '#F7F7F7' }}
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
                onClick={() => navigate(`/pipeline/blacklisted/supplier/${s.id}?from=pipeline`)}
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
            {sorted.length === 0 && (
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
