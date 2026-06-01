import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPencil, faTrash } from '@fortawesome/free-solid-svg-icons';

const preferences = [
  { id: 'email',  label: 'Email notifications', defaultOn: true },
  { id: 'sla',    label: 'Overdue SLA alerts',   defaultOn: true },
  { id: 'weekly', label: 'Weekly summary',           defaultOn: false },
];

const users = [
  { name: 'Carlos Mendoza',  email: 'cmendoza@nexteer.com',  role: 'SSD Lead' },
  { name: 'Ana García',      email: 'agarcia@nexteer.com',   role: 'Buyer' },
  { name: 'Roberto Sánchez', email: 'rsanchez@nexteer.com',  role: 'SQD' },
];

export function Configuracion() {
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(preferences.map(p => [p.id, p.defaultOn]))
  );

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Settings</h1>
        <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>
          Account information and system settings
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Mi Perfil */}
        <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
          <h2 style={{ fontWeight: 700, fontSize: 15, margin: '0 0 20px' }}>My Profile</h2>
          <div className="flex items-center" style={{ gap: 16, marginBottom: 20 }}>
            <div
              className="flex items-center justify-center text-white font-bold shrink-0"
              style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: '#DC0202', fontSize: 18 }}
            >
              YU
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#000000', margin: '0 0 2px' }}>Yael Urbano</p>
              <p style={{ fontSize: 13, color: '#808285', margin: '0 0 2px' }}>IT Trainee</p>
              <p style={{ fontSize: 13, color: '#808285', margin: 0 }}>yurbano@nexteer.com</p>
            </div>
          </div>
          <button
            className="btn-secondary"
            style={{
              padding: '8px 16px', fontSize: 14, fontWeight: 600,
              borderRadius: 8, border: '1px solid #000000',
              backgroundColor: '#FFFFFF', color: '#000000',
              cursor: 'pointer', transition: 'box-shadow 0.15s ease-out',
            }}
          >
            Edit profile
          </button>
        </div>

        {/* Preferencias */}
        <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
          <h2 style={{ fontWeight: 700, fontSize: 15, margin: '0 0 20px' }}>System preferences</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {preferences.map((pref) => (
              <div key={pref.id} className="flex items-center justify-between">
                <span style={{ fontSize: 14, color: '#000000' }}>{pref.label}</span>
                <button
                  onClick={() => setToggles(prev => ({ ...prev, [pref.id]: !prev[pref.id] }))}
                  style={{
                    position: 'relative', width: 44, height: 24,
                    borderRadius: 99,
                    backgroundColor: toggles[pref.id] ? '#DC0202' : '#D1D3D4',
                    border: 'none', cursor: 'pointer',
                    transition: 'background-color 0.2s', flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      position: 'absolute', top: 2,
                      left: toggles[pref.id] ? 22 : 2,
                      width: 20, height: 20, borderRadius: '50%',
                      backgroundColor: '#FFFFFF',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      transition: 'left 0.2s',
                    }}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gestión de usuarios */}
      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E0E0E0' }}>
          <h2 style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>User management</h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E0E0E0' }}>
              {['Name', 'Email', 'Role', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 24px', fontSize: 13, fontWeight: 700, color: '#000000' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user, i) => (
              <tr
                key={user.email}
                style={{
                  borderBottom: i < users.length - 1 ? '1px solid #E0E0E0' : undefined,
                  backgroundColor: i % 2 === 1 ? '#FAFAFA' : '#FFFFFF',
                }}
              >
                <td style={{ padding: '12px 24px', fontSize: 13, fontWeight: 500, color: '#000000' }}>{user.name}</td>
                <td style={{ padding: '12px 24px', fontSize: 13, color: '#808285' }}>{user.email}</td>
                <td style={{ padding: '12px 24px' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#808285', backgroundColor: '#EEEEEE', padding: '3px 7px', borderRadius: 4 }}>
                    {user.role}
                  </span>
                </td>
                <td style={{ padding: '12px 24px' }}>
                  <div className="flex items-center" style={{ gap: 12 }}>
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#0084C0', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500 }}
                    >
                      <FontAwesomeIcon icon={faPencil} style={{ fontSize: 13, color: '#0084C0' }} />
                      Edit
                    </button>
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#DC0202', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}
                    >
                      <FontAwesomeIcon icon={faTrash} style={{ fontSize: 13, color: '#DC0202' }} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
