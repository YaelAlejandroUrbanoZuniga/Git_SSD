import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPencil, faTrash, faUser } from '@fortawesome/free-solid-svg-icons';
import { useRole } from '../context/RoleContext';
import type { AppRole } from '../types';

const preferences = [
  { id: 'email',  label: 'Email notifications', defaultOn: true },
  { id: 'sla',    label: 'Overdue SLA alerts',   defaultOn: true },
  { id: 'weekly', label: 'Weekly summary',        defaultOn: false },
];

const users = [
  { name: 'Carlos Mendoza',  email: 'cmendoza@nexteer.com',  role: 'SSD Lead' },
  { name: 'Ana García',      email: 'agarcia@nexteer.com',   role: 'Buyer' },
  { name: 'Roberto Sánchez', email: 'rsanchez@nexteer.com',  role: 'SQD' },
];

export function Settings() {
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(preferences.map(p => [p.id, p.defaultOn]))
  );
  const { activeRole, setActiveRole } = useRole();
  const roles: AppRole[] = ['SSD', 'PM', 'Buyer', 'SQD'];

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Settings</h1>
        <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>
          Account information and system settings
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* My Profile */}
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
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#000000', margin: '0 0 8px' }}>Active Role</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
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
          <button
            style={{
              padding: '8px 16px', fontSize: 14, fontWeight: 600,
              borderRadius: 8, border: '1px solid #D1D3D4',
              backgroundColor: '#FFFFFF', color: '#000000',
              cursor: 'pointer', transition: 'box-shadow 0.15s ease-out',
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.13)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            Edit profile
          </button>
        </div>

        {/* System Preferences */}
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

      {/* User Management */}
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
