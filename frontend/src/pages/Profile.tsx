import { useAuth } from '../context/AuthContext';

/** First letters of each word in a name, max 2 (e.g. "Vianey Perea" → "VP"). */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function Profile() {
  const { user } = useAuth();

  const displayName = user?.displayName ?? '—';
  const email = user?.email ?? '—';
  const role = user?.role ?? '—';

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>My Profile</h1>
        <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>
          Your account details
        </p>
      </div>

      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24, maxWidth: 640 }}>
        <div className="flex items-center" style={{ gap: 16 }}>
          <div
            className="flex items-center justify-center text-white font-bold shrink-0"
            style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: '#DC0202', fontSize: 18 }}
          >
            {user ? initialsOf(displayName) : '—'}
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#000000', margin: '0 0 2px' }}>{displayName}</p>
            <p style={{ fontSize: 13, color: '#808285', margin: '0 0 2px' }}>{email}</p>
          </div>
        </div>

        <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #E0E0E0' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#000000', margin: '0 0 4px' }}>Application role</p>
          <p style={{ fontSize: 12, color: '#808285', margin: '0 0 12px' }}>
            Assigned from Active Directory / by an SSD administrator.
          </p>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#DC0202', backgroundColor: '#DC020226', padding: '4px 10px', borderRadius: 4 }}>
            {role}
          </span>
        </div>
      </div>
    </div>
  );
}
