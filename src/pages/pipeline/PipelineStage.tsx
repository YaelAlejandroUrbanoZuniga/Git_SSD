import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faChevronDown, faMapMarkerAlt, faUser, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { pipelineSuppliers, pipelineStageConfig, PipelineSupplier } from '../../data/pipeline-demo';
import { getDocsBarColor } from '../../utils/pipeline-helpers';

const slaColors: Record<string, string> = { green: '#6ABF4B', amber: '#D4A017', red: '#DC0202' };
const subStatusStyles: Record<string, { bg: string; text: string }> = {
  'Go':               { bg: '#6ABF4B26', text: '#6ABF4B' },
  'No Go':            { bg: '#DC020226', text: '#DC0202' },
  'Under Evaluation': { bg: '#D4A01726', text: '#D4A017' },
  'On Hold':          { bg: '#80828526', text: '#808285' },
};

function SupplierStageCard({ supplier }: { supplier: PipelineSupplier }) {
  const navigate = useNavigate();
  const stageColor = pipelineStageConfig.find(s => s.name === supplier.stage)?.color ?? '#808285';

  return (
    <div
      onClick={() => navigate(`/pipeline/supplier/${supplier.id}`)}
      className="bg-white"
      style={{ borderRadius: 8, padding: 20, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', transition: 'box-shadow 0.15s ease-out' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)')}
    >
      <div className="flex items-start justify-between" style={{ marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#000000' }}>{supplier.name}</span>
        <span style={{ backgroundColor: stageColor + '26', color: stageColor, fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 3 }}>
          {supplier.stage}
        </span>
      </div>

      <p style={{ fontSize: 13, color: '#808285', margin: '0 0 4px' }}>{supplier.commodity} · {supplier.productType}</p>

      <p style={{ fontSize: 12, color: '#808285', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <FontAwesomeIcon icon={faMapMarkerAlt} style={{ fontSize: 11, color: '#808285' }} />
        {supplier.country}
      </p>

      <p style={{ fontSize: 12, color: '#808285', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <FontAwesomeIcon icon={faUser} style={{ fontSize: 11, color: '#808285' }} />
        {supplier.buyer}
      </p>

      <p style={{ fontSize: 12, color: '#808285', margin: '0 0 6px' }}>
        Origin: {supplier.scoutingInput}
      </p>

      <p style={{ fontSize: 12, color: '#808285', margin: '0 0 8px' }}>Days in stage: {supplier.daysInStage}</p>

      {supplier.subStatus && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ backgroundColor: subStatusStyles[supplier.subStatus].bg, color: subStatusStyles[supplier.subStatus].text, fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 3 }}>
            {supplier.subStatus}
          </span>
        </div>
      )}

      <div className="flex items-center" style={{ gap: 8 }}>
        <div style={{ flex: 1, backgroundColor: '#EEEEEE', borderRadius: 2, height: 4 }}>
          <div style={{ height: 4, borderRadius: 2, backgroundColor: getDocsBarColor(supplier.docsPercent), width: `${supplier.docsPercent}%` }} />
        </div>
        <span style={{ fontSize: 11, color: '#808285' }}>Docs {supplier.docsPercent}%</span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: slaColors[supplier.sla], flexShrink: 0 }} />
      </div>
    </div>
  );
}

export function PipelineStage() {
  const { stageName } = useParams<{ stageName: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const decodedStage = decodeURIComponent(stageName ?? '');
  const stageConfig = pipelineStageConfig.find(s => s.name === decodedStage);
  const stageSuppliers = pipelineSuppliers.filter(s => s.stage === decodedStage);
  const isParkingLot = decodedStage === 'Parking Lot';

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate('/pipeline')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 400, color: '#808285', marginBottom: 4, transition: 'color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#000000')}
        onMouseLeave={e => (e.currentTarget.style.color = '#808285')}
      >
        <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: 12 }} />
        Back
      </button>

      {/* Breadcrumb */}
      <nav style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: '#808285' }}>
          <Link to="/pipeline" style={{ color: '#0084C0', textDecoration: 'none', fontWeight: 400 }}>Pipeline</Link>
          <span style={{ margin: '0 6px', color: '#808285' }}>&gt;</span>
          <span style={{ color: '#000000' }}>{decodedStage}</span>
        </span>
      </nav>

      {/* Title */}
      <div className="flex items-end justify-between" style={{ marginBottom: 24 }}>
        <div className="flex items-center" style={{ gap: 12 }}>
          {stageConfig && <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: stageConfig.color, display: 'inline-block' }} />}
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>{decodedStage}</h1>
            <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>
              {stageSuppliers.length} suppliers in this stage
            </p>
          </div>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex items-center" style={{ gap: 12, marginBottom: 24 }}>
        <div className="relative" style={{ flex: '1 1 0', maxWidth: 320 }}>
          <FontAwesomeIcon icon={faMagnifyingGlass} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#808285', fontSize: 14 }} />
          <input
            type="text" placeholder="Search supplier..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 8, paddingBottom: 8, border: '1px solid #E0E0E0', borderRadius: 6, fontSize: 13, color: '#000000', backgroundColor: '#FFFFFF', outline: 'none' }}
          />
        </div>
        {['Commodity', 'Buyer', 'SLA Status'].map(f => (
          <button key={f} className="flex items-center" style={{ gap: 6, padding: '8px 12px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, color: '#000000', backgroundColor: '#FFFFFF', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F5F5F5')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
          >
            {f} <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 10, color: '#808285' }} />
          </button>
        ))}
        {isParkingLot && (
          <button className="flex items-center" style={{ gap: 6, padding: '8px 12px', border: '1px solid #E0E0E0', borderRadius: 8, fontSize: 13, color: '#000000', backgroundColor: '#FFFFFF', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F5F5F5')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
          >
            Go/No Go <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 10, color: '#808285' }} />
          </button>
        )}
      </div>

      {/* Grid of cards - 3 per row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {stageSuppliers.map(supplier => (
          <SupplierStageCard key={supplier.id} supplier={supplier} />
        ))}
      </div>

      {stageSuppliers.length === 0 && (
        <p style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', padding: '48px 0' }}>
          No suppliers in this stage.
        </p>
      )}
    </div>
  );
}
