import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell as faBellSolid, faTimes } from '@fortawesome/free-solid-svg-icons';
import { faBell as faBellRegular } from '@fortawesome/free-regular-svg-icons';
import { notifications as demoNotifications } from '../data/demo';
import type { Notification } from '../types';

const dotColor: Record<string, string> = {
  error: '#DC0202',
  warning: '#D4A017',
  info: '#02B3E1',
};

export function GlobalHeader() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>(() => demoNotifications.map(n => ({ ...n })));
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const unreadCount = items.filter(n => !n.read).length;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        bellRef.current && !bellRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function markAllRead() {
    setItems(prev => prev.map(n => ({ ...n, read: true })));
  }

  function handleNotificationClick(n: Notification) {
    setOpen(false);
    if (n.link) navigate(n.link);
  }

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
      <button
        ref={bellRef}
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center rounded-full"
        style={{ width: 36, height: 36, background: 'transparent', border: 'none', cursor: 'pointer' }}
        aria-label="Notifications"
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

      {/* Left-side sliding panel */}
      {open && (
        <div
          ref={panelRef}
          className="flex flex-col"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            height: '100vh',
            width: 380,
            backgroundColor: '#FFFFFF',
            boxShadow: '4px 0 24px rgba(0,0,0,0.20)',
            zIndex: 100,
          }}
        >
          {/* Panel header */}
          <div
            className="flex items-center justify-between"
            style={{ padding: '16px 20px', borderBottom: '1px solid #E0E0E0', flexShrink: 0 }}
          >
            <span style={{ fontWeight: 700, fontSize: 16, color: '#000000' }}>Notifications</span>
            <div className="flex items-center" style={{ gap: 16 }}>
              <button
                onClick={markAllRead}
                style={{ fontSize: 13, fontWeight: 500, color: '#0084C0', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Mark all as read
              </button>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} aria-label="Close">
                <FontAwesomeIcon icon={faTimes} style={{ fontSize: 16, color: '#808285' }} />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {items.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className="flex items-start gap-3"
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid #E0E0E0',
                  minHeight: 56,
                  cursor: 'pointer',
                  transition: 'background-color 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F5F5F5')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
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
        </div>
      )}
    </header>
  );
}
