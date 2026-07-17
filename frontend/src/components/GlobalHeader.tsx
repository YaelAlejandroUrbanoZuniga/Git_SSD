import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell as faBellSolid, faTimes, faCircleExclamation, faTriangleExclamation, faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { faBell as faBellRegular } from '@fortawesome/free-regular-svg-icons';
import type { Notification } from '../types';
import { getNotifications, markAllNotificationsRead } from '../services/notificationsService';

const dotColor: Record<string, string> = {
  error: '#DC0202',
  warning: '#D4A017',
  info: '#02B3E1',
};

const typeIcon: Record<string, typeof faCircleExclamation> = {
  error: faCircleExclamation,
  warning: faTriangleExclamation,
  info: faCircleInfo,
};

export function GlobalHeader() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const unreadCount = items.filter(n => !n.read).length;

  useEffect(() => {
    let cancelled = false;
    getNotifications()
      .then(list => { if (!cancelled) setItems(list); })
      .catch(() => { /* header badge stays empty rather than blocking the app */ });
    return () => { cancelled = true; };
  }, []);

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
    markAllNotificationsRead().catch(() => { /* optimistic; server sync is best-effort */ });
  }

  function handleNotificationClick(n: Notification) {
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between"
      style={{ height: 55, backgroundColor: '#AA0202', paddingLeft: 24, paddingRight: 24 }}
    >
      {/* Logo */}
      <img src="/assets/images/nexteer-logo-white.png" alt="Nexteer Automotive" style={{ height: 32 }} />

      {/* Bell */}
      <button
        ref={bellRef}
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center rounded-full"
        style={{ width: 40, height: 36, background: 'transparent', border: 'none', cursor: 'pointer' }}
        aria-label="Notifications"
      >
        <FontAwesomeIcon
          icon={unreadCount > 0 ? faBellSolid : faBellRegular}
          style={{ color: '#FFFFFF', fontSize: 23 }}
        />
        {unreadCount > 0 && (
          <span
            className="absolute flex items-center justify-center text-white font-bold"
            style={{
              top: 2, right: 2,
              width: 16, height: 16,
              borderRadius: '50%',
              backgroundColor: '#DC0202',
              fontSize: 10,
              lineHeight: 1,
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            top: 44,
            left: 0,
            right: 0,
            bottom: 0,
            backdropFilter: 'blur(4px)',
            backgroundColor: 'rgba(0,0,0,0.15)',
            zIndex: 98,
          }}
        />
      )}

      {/* Right-side sliding panel */}
      {open && (
        <div
          ref={panelRef}
          className="flex flex-col"
          style={{
            position: 'fixed',
            top: 44,
            right: 0,
            height: 'calc(100vh - 44px)',
            width: 380,
            backgroundColor: '#FFFFFF',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.20)',
            zIndex: 99,
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
            {items.map((n) => {
              const color = n.read ? '#9CA3AF' : dotColor[n.type];
              const icon = typeIcon[n.type] ?? faCircleInfo;
              return (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className="flex items-start"
                  style={{
                    position: 'relative',
                    borderBottom: '1px solid #E0E0E0',
                    minHeight: 56,
                    cursor: 'pointer',
                    transition: 'background-color 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F5F5F5')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {/* Left color bar */}
                  <div style={{ width: 3, alignSelf: 'stretch', backgroundColor: color, flexShrink: 0 }} />

                  {/* Icon badge + text */}
                  <div className="flex items-start" style={{ gap: 12, padding: '14px 16px', flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        backgroundColor: `${color}1F`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FontAwesomeIcon icon={icon} style={{ fontSize: 13, color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#000000', margin: '0 0 2px', lineHeight: 1.4 }}>
                        {n.message}
                      </p>
                      <p style={{ fontSize: 12, color: '#808285', margin: 0 }}>{n.time}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
