import { useState } from 'react';

const preferences = [
  { id: 'email',  label: 'Email notifications', defaultOn: true },
  { id: 'sla',    label: 'Overdue SLA alerts',   defaultOn: true },
  { id: 'weekly', label: 'Weekly summary',        defaultOn: false },
];

export function Settings() {
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(preferences.map(p => [p.id, p.defaultOn]))
  );

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Settings</h1>
        <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>
          Notifications and system settings
        </p>
      </div>

      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24, maxWidth: 640 }}>
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
  );
}
