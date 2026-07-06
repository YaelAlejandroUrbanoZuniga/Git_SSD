import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser } from '@fortawesome/free-solid-svg-icons';
import { useRole } from '../context/RoleContext';
import { CURRENT_USER } from '../constants/currentUser';
import type { AppRole } from '../types';

export function Profile() {
  const { activeRole, setActiveRole } = useRole();
  const roles: AppRole[] = ['SSD', 'PM', 'Buyer', 'SQD'];

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
            YU
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#000000', margin: '0 0 2px' }}>{CURRENT_USER.name}</p>
            <p style={{ fontSize: 13, color: '#808285', margin: '0 0 2px' }}>IT Trainee</p>
            <p style={{ fontSize: 13, color: '#808285', margin: 0 }}>yurbano@nexteer.com</p>
          </div>
        </div>

        <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #E0E0E0' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#000000', margin: '0 0 4px' }}>Active role (demo)</p>
          <p style={{ fontSize: 12, color: '#808285', margin: '0 0 12px' }}>Switch the active role to preview the app from another perspective.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxWidth: 320 }}>
            {roles.map(role => (
              <button
                key={role}
                onClick={() => setActiveRole(role)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  padding: '6px 10px', fontSize: 13, fontWeight: activeRole === role ? 700 : 400,
                  borderRadius: 4, cursor: 'pointer',
                  backgroundColor: activeRole === role ? '#DC0202' : '#FFFFFF',
                  color: activeRole === role ? '#FFFFFF' : '#808285',
                  border: activeRole === role ? 'none' : '1px solid #D1D3D4',
                  transition: 'all 0.15s',
                }}
              >
                <FontAwesomeIcon icon={faUser} style={{ fontSize: 10 }} />
                {role}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
