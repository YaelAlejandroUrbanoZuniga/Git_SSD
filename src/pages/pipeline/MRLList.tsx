import { useNavigate, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faLink } from '@fortawesome/free-solid-svg-icons';
import { mrlRequirements, pipelineSuppliers, MRLRequirement } from '../../data/pipeline-demo';

const statusStyles: Record<string, { bg: string; text: string }> = {
  'Open':        { bg: '#02B3E126', text: '#02B3E1' },
  'In Progress': { bg: '#D4A01726', text: '#D4A017' },
  'Fulfilled':   { bg: '#6ABF4B26', text: '#6ABF4B' },
};

function MRLCard({ req }: { req: MRLRequirement }) {
  const navigate = useNavigate();
  const linkedSuppliers = pipelineSuppliers.filter(s => req.linkedSupplierIds.includes(s.id));
  const style = statusStyles[req.status];

  return (
    <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 20 }}>
      <div className="flex items-start justify-between" style={{ marginBottom: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: 0 }}>{req.title}</h3>
        <span style={{ backgroundColor: style.bg, color: style.text, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 3, flexShrink: 0 }}>
          {req.status}
        </span>
      </div>

      <p style={{ fontSize: 13, color: '#808285', margin: '0 0 12px', lineHeight: 1.5 }}>{req.description}</p>

      <div className="flex items-center" style={{ gap: 16, marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: '#808285' }}>Commodity: <strong style={{ color: '#000' }}>{req.commodity}</strong></span>
        <span style={{ fontSize: 12, color: '#808285' }}>Requested by: <strong style={{ color: '#000' }}>{req.requestedBy}</strong></span>
        <span style={{ fontSize: 12, color: '#808285' }}>Created: {req.dateCreated}</span>
      </div>

      {linkedSuppliers.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#808285', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <FontAwesomeIcon icon={faLink} style={{ fontSize: 10, marginRight: 4 }} />
            Linked Suppliers
          </p>
          <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
            {linkedSuppliers.map(s => (
              <button
                key={s.id}
                onClick={() => navigate(`/pipeline/supplier/${s.id}`)}
                style={{ fontSize: 12, fontWeight: 500, color: '#0084C0', backgroundColor: '#0084C010', padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', transition: 'background-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0084C020')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#0084C010')}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MRLList() {
  const navigate = useNavigate();
  const open = mrlRequirements.filter(r => r.status === 'Open');
  const inProgress = mrlRequirements.filter(r => r.status === 'In Progress');
  const fulfilled = mrlRequirements.filter(r => r.status === 'Fulfilled');

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
          <Link to="/pipeline" style={{ color: '#0084C0', textDecoration: 'none' }}>Pipeline</Link>
          <span style={{ margin: '0 6px' }}>&gt;</span>
          <span style={{ color: '#000000' }}>MRL Requirements</span>
        </span>
      </nav>

      {/* Title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>MRL Requirements</h1>
        <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>
          Master Requirements List — business needs driving supplier scouting
        </p>
      </div>

      {/* Stats row */}
      <div className="flex" style={{ gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Open', count: open.length, color: '#02B3E1' },
          { label: 'In Progress', count: inProgress.length, color: '#D4A017' },
          { label: 'Fulfilled', count: fulfilled.length, color: '#6ABF4B' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, padding: '14px 20px', backgroundColor: '#FFFFFF', borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: `3px solid ${s.color}` }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: '#000000' }}>{s.count}</span>
            <span style={{ fontSize: 13, color: '#808285', marginLeft: 8 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Requirements list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[...open, ...inProgress, ...fulfilled].map(req => (
          <MRLCard key={req.id} req={req} />
        ))}
      </div>
    </div>
  );
}
