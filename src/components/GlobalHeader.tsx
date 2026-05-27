import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell as faBellSolid } from '@fortawesome/free-solid-svg-icons';
import { faBell as faBellRegular } from '@fortawesome/free-regular-svg-icons';
import { notifications } from '../data/demo';

const dotColor: Record<string, string> = {
  error: '#DC0202',
  warning: '#D4A017',
  info: '#02B3E1',
};

export function GlobalHeader() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between"
      style={{ height: 44, backgroundColor: '#AA0202', paddingLeft: 24, paddingRight: 24 }}
    >
      {/* Logo */}
      <span className="text-white font-bold select-none" style={{ fontSize: 22, letterSpacing: '0.12em' }}>
        NEXTEER
      </span>

      {/* Bell */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(v => !v)}
          className="relative flex items-center justify-center rounded-full"
          style={{ width: 36, height: 36, background: 'transparent', border: 'none', cursor: 'pointer' }}
          aria-label="Notificaciones"
        >
          <FontAwesomeIcon
            icon={unreadCount > 0 ? faBellSolid : faBellRegular}
            style={{ color: '#FFFFFF', fontSize: 20 }}
          />
          {unreadCount > 0 && (
            <span
              className="absolute flex items-center justify-center text-white font-bold"
              style={{
                top: 2, right: 2,
                width: 15, height: 15,
                borderRadius: '50%',
                backgroundColor: '#DC0202',
                fontSize: 9,
                lineHeight: 1,
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div
            className="absolute right-0 bg-white flex flex-col overflow-hidden"
            style={{
              width: 360,
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.20)',
              top: 'calc(100% + 8px)',
              zIndex: 60,
            }}
          >
            {/* Panel header: title left, "Marcar todo" right */}
            <div
              className="flex items-center justify-between"
              style={{ padding: '12px 20px', borderBottom: '1px solid #E0E0E0' }}
            >
              <span style={{ fontWeight: 700, fontSize: 15, color: '#000000' }}>Notificaciones</span>
              <button
                style={{ fontSize: 13, fontWeight: 500, color: '#0084C0', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Marcar todo como leído
              </button>
            </div>

            {/* Notification list */}
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-3"
                  style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid #E0E0E0',
                    minHeight: 56,
                    cursor: 'default',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: n.read ? '#9CA3AF' : dotColor[n.type],
                      flexShrink: 0,
                      marginTop: 5,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#000000', margin: '0 0 2px', lineHeight: 1.4 }}>
                      {n.message}
                    </p>
                    <p style={{ fontSize: 12, color: '#808285', margin: 0 }}>{n.time}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer: only "Ver todas" */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #E0E0E0' }}>
              <button
                style={{ fontSize: 13, fontWeight: 500, color: '#0084C0', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Ver todas las notificaciones
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
