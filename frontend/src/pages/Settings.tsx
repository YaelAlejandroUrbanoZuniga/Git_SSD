import { BRAND_COLORS } from '../constants/designTokens';
export function Settings() {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>Settings</h1>
        <p style={{ fontSize: 16, fontWeight: 400, color: BRAND_COLORS.sidebar, margin: '4px 0 0' }}>
          Notifications and system settings
        </p>
      </div>

      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24, maxWidth: 640 }}>
        <h2 style={{ fontWeight: 700, fontSize: 15, margin: '0 0 20px' }}>System preferences</h2>
        <p style={{ fontSize: 14, color: BRAND_COLORS.sidebar, margin: 0 }}>
          There are no configurable preferences yet. All users receive the same in-app notifications.
        </p>
      </div>
    </div>
  );
}
