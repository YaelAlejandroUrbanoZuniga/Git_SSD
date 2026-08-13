import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBell as faBellSolid, faTimes, faCircleExclamation, faTriangleExclamation, faCircleInfo,
  faBan, faCalendarPlus, faCalendarCheck, faBuilding, faArrowRight, faSquareCheck,
  faPenToSquare, faBullseye, faFileCirclePlus, faFilePen, faFileCircleMinus,
} from '@fortawesome/free-solid-svg-icons';
import { faBell as faBellRegular, faSquare } from '@fortawesome/free-regular-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { Notification, NotificationCategory } from '../types';
import {
  getNotifications, markAllNotificationsRead, markNotificationRead,
  deleteNotifications, deleteAllNotifications,
} from '../services/notificationsService';
import { ConfirmDialog } from './ConfirmDialog';
import { HEADER_HEIGHT, NOTIFICATION_PANEL_MAX_WIDTH } from './layoutConstants';

/** Re-exported so Sidebar.tsx, App.tsx and NotesSidePanel.tsx — which import
 *  it from here — keep working unchanged; layoutConstants.ts is the actual
 *  source of truth. */
export { HEADER_HEIGHT };

/** Fallback styling, by severity, for notifications with no category (every row
 *  written before the Category column existed). */
const dotColor: Record<string, string> = {
  error: '#DC0202',
  warning: '#D4A017',
  info: '#02B3E1',
};

const typeIcon: Record<string, IconDefinition> = {
  error: faCircleExclamation,
  warning: faTriangleExclamation,
  info: faCircleInfo,
};

/**
 * The real mapping: WHAT happened → how it looks. A blacklisting must not look
 * like a new event, and a new event must not look like a stage advance — which
 * is exactly what happened while the panel keyed off the severity alone (most
 * of the domain events are `info`).
 *
 * One colour per *module*, one icon per *event within it* (the same idiom the
 * two event categories already used): suppliers green, events cyan, strategy
 * magenta, MRL orange — the module colours from `constants/stage-config.ts`.
 */
const categoryStyle: Record<NotificationCategory, { icon: IconDefinition; color: string }> = {
  blacklisted:      { icon: faBan,             color: '#000000' },
  event_created:    { icon: faCalendarPlus,    color: '#02B3E1' },
  event_updated:    { icon: faCalendarCheck,   color: '#02B3E1' },
  supplier_created: { icon: faBuilding,        color: '#6ABF4B' },
  supplier_updated: { icon: faPenToSquare,     color: '#6ABF4B' },
  stage_advanced:   { icon: faArrowRight,      color: '#0084C0' },
  strategy_updated: { icon: faBullseye,        color: '#C026D3' },
  mrl_created:      { icon: faFileCirclePlus,  color: '#E3650B' },
  mrl_updated:      { icon: faFilePen,         color: '#E3650B' },
  mrl_deleted:      { icon: faFileCircleMinus, color: '#E3650B' },
};

const READ_COLOR = '#9CA3AF';
const ROW_HOVER_BG = '#F5F5F5';
/** Selected-row tint — the same `colour + 1F` idiom the icon badge uses. */
const ROW_SELECTED_BG = '#DC02021F';

/** Icon + colour for one row: category first, severity as the fallback, and the
 *  muted grey once it has been read (the icon itself still identifies the event). */
function styleFor(n: Notification): { icon: IconDefinition; color: string } {
  const base = (n.category && categoryStyle[n.category])
    ?? { icon: typeIcon[n.type] ?? faCircleInfo, color: dotColor[n.type] ?? '#02B3E1' };
  return { icon: base.icon, color: n.read ? READ_COLOR : base.color };
}

type Tab = 'all' | 'unread';
/** Which delete the ConfirmDialog is currently asking about. Nothing is ever
 *  removed before this round-trip through the user — one, several or all. */
type PendingDelete = 'selected' | 'all' | null;

export function GlobalHeader() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [tab, setTab] = useState<Tab>('unread');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const unreadCount = items.filter(n => !n.read).length;

  const visible = tab === 'unread'
    ? items.filter(n => !n.read)  // unread, regardless of age
    : items;                      // everything, read and unread

  // Initial load, so the bell badge has a count before the panel is ever opened.
  useEffect(() => {
    let cancelled = false;
    getNotifications()
      .then(list => { if (!cancelled) setItems(list); })
      .catch(() => { /* header badge stays empty rather than blocking the app */ });
    return () => { cancelled = true; };
  }, []);

  // Re-query every time the panel goes from closed to open — no interval
  // polling, so the badge only goes stale while the panel stays shut.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getNotifications()
      .then(list => { if (!cancelled) setItems(list); })
      .catch(() => { /* keep showing whatever the list already had */ });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      // The ConfirmDialog renders outside the panel — an outside-click while it
      // is up would close the panel underneath the question being asked.
      if (pendingDelete) return;
      const target = e.target as Node;
      if (
        panelRef.current && !panelRef.current.contains(target) &&
        bellRef.current && !bellRef.current.contains(target)
      ) {
        // Inlined rather than calling closePanel() so the effect keeps a stable
        // dependency list (setState identities never change).
        setOpen(false);
        setSelectMode(false);
        setSelectedIds([]);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [pendingDelete]);

  function closePanel() {
    setOpen(false);
    exitSelectMode();
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds([]);
  }

  /** Switching tab drops the selection: the other tab hides rows, and deleting
   *  ones the user can no longer see is not what "Delete (n)" should mean. */
  function switchTab(next: Tab) {
    setTab(next);
    setSelectedIds([]);
  }

  function markAllRead() {
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    markAllNotificationsRead().catch(() => { /* optimistic; server sync is best-effort */ });
  }

  function toggleSelected(id: string) {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }

  function handleNotificationClick(n: Notification) {
    if (selectMode) { toggleSelected(n.id); return; }
    if (!n.read) {
      setItems(prev => prev.map(x => (x.id === n.id ? { ...x, read: true } : x)));
      markNotificationRead(n.id).catch(() => { /* optimistic; server sync is best-effort */ });
    }
    closePanel();
    if (n.link) navigate(n.link);
  }

  /** Runs only after ConfirmDialog says yes. Deletes on the server first, then
   *  updates the list — a failed delete must not leave rows missing from a panel
   *  that still has them. */
  async function runDelete(mode: Exclude<PendingDelete, null>) {
    const ids = selectedIds;
    try {
      if (mode === 'all') {
        await deleteAllNotifications();
        setItems([]);
      } else {
        await deleteNotifications(ids);
        setItems(prev => prev.filter(n => !ids.includes(n.id)));
      }
    } catch {
      // Re-sync rather than guess what survived.
      getNotifications().then(setItems).catch(() => { /* leave the list as it is */ });
    } finally {
      exitSelectMode();
    }
  }

  const selectedCount = selectedIds.length;

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between"
      style={{ height: HEADER_HEIGHT, backgroundColor: '#AA0202', paddingLeft: 24, paddingRight: 24 }}
    >
      {/* Logo */}
      <img src="/assets/images/nexteer-logo-white.png" alt="Nexteer Automotive" style={{ height: 32 }} />

      {/* Bell */}
      <button
        ref={bellRef}
        onClick={() => (open ? closePanel() : setOpen(true))}
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
          onClick={() => { if (!pendingDelete) closePanel(); }}
          style={{
            position: 'fixed',
            top: HEADER_HEIGHT,
            left: 0,
            right: 0,
            bottom: 0,
            backdropFilter: 'blur(4px)',
            backgroundColor: 'rgba(0,0,0,0.15)',
            zIndex: 98,
          }}
        />
      )}

      {/* Right-side panel */}
      {open && (
        <div
          ref={panelRef}
          className="flex flex-col"
          style={{
            position: 'fixed',
            top: HEADER_HEIGHT,
            right: 0,
            width: '25vw',
            minWidth: 300,
            maxWidth: NOTIFICATION_PANEL_MAX_WIDTH,
            height: '75vh',
            backgroundColor: '#FFFFFF',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.20)',
            overflow: 'hidden',
            zIndex: 99,
          }}
        >
          {/* Header strip */}
          <div
            className="flex items-center justify-between"
            style={{ padding: '12px 16px', backgroundColor: '#DC0202', flexShrink: 0 }}
          >
            <span style={{ fontWeight: 700, fontSize: 15, color: '#FFFFFF' }}>Notifications</span>
            <button
              onClick={closePanel}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}
              aria-label="Close"
            >
              <FontAwesomeIcon icon={faTimes} style={{ fontSize: 16, color: '#FFFFFF' }} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex" style={{ borderBottom: '1px solid #E0E0E0', flexShrink: 0 }}>
            <TabButton
              label={`Unread (${unreadCount})`}
              active={tab === 'unread'}
              onClick={() => switchTab('unread')}
            />
            <TabButton label="All" active={tab === 'all'} onClick={() => switchTab('all')} />
          </div>

          {/* Notification list — minHeight:0 is what makes this scroll instead of
              stretching the panel past its 75vh. */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {visible.length === 0 ? (
              <div
                className="flex items-center justify-center"
                style={{ height: '100%', padding: 24, fontSize: 13, color: '#808285', textAlign: 'center' }}
              >
                {tab === 'unread' ? "You're all caught up." : 'No notifications here.'}
              </div>
            ) : (
              visible.map(n => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  selectMode={selectMode}
                  selected={selectedIds.includes(n.id)}
                  onClick={() => handleNotificationClick(n)}
                />
              ))
            )}
          </div>

          {/* Bottom bar */}
          <div
            className="flex items-center justify-between"
            style={{ padding: '8px 12px', borderTop: '1px solid #E0E0E0', gap: 8, flexShrink: 0 }}
          >
            {selectMode ? (
              <>
                <div className="flex items-center" style={{ gap: 4 }}>
                  <BarButton
                    label={`Delete (${selectedCount})`}
                    color="#DC0202"
                    disabled={selectedCount === 0}
                    onClick={() => setPendingDelete('selected')}
                  />
                  <BarButton
                    label="Delete all"
                    color="#DC0202"
                    disabled={items.length === 0}
                    onClick={() => setPendingDelete('all')}
                  />
                </div>
                <BarButton label="Cancel" color="#808285" onClick={exitSelectMode} />
              </>
            ) : (
              <>
                <BarButton
                  label="Delete"
                  color="#DC0202"
                  disabled={items.length === 0}
                  onClick={() => setSelectMode(true)}
                />
                {unreadCount > 0 && (
                  <BarButton label="Mark all as read" color="#0084C0" onClick={markAllRead} />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirmation — every delete goes through here first, one or many. */}
      {pendingDelete && (
        <ConfirmDialog
          title={pendingDelete === 'all' ? 'Delete all notifications' : 'Delete notifications'}
          message={
            pendingDelete === 'all'
              ? `This deletes all ${items.length} of your notifications, including the ones not shown by the current tab. This cannot be undone.`
              : selectedCount === 1
                ? 'This deletes the selected notification. This cannot be undone.'
                : `This deletes the ${selectedCount} selected notifications. This cannot be undone.`
          }
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const mode = pendingDelete;
            setPendingDelete(null);
            void runDelete(mode);
          }}
        />
      )}
    </header>
  );
}

// ── Panel pieces ─────────────────────────────────────────────────────────
// Each keeps its own hover state, so a row's hover can never win over the
// selected background (both feed one computed style, instead of the two
// fighting over element.style.backgroundColor).

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1,
        padding: '10px 0',
        fontSize: 13,
        fontWeight: 600,
        color: active ? '#DC0202' : '#808285',
        backgroundColor: !active && hover ? ROW_HOVER_BG : 'transparent',
        border: 'none',
        borderBottom: `2px solid ${active ? '#DC0202' : 'transparent'}`,
        cursor: 'pointer',
        transition: 'background-color 0.12s, color 0.12s',
      }}
    >
      {label}
    </button>
  );
}

function BarButton({ label, color, disabled = false, onClick }: {
  label: string; color: string; disabled?: boolean; onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={() => { if (!disabled) onClick(); }}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '6px 10px',
        fontSize: 13,
        fontWeight: 600,
        color,
        backgroundColor: hover && !disabled ? `${color}14` : 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'background-color 0.12s',
      }}
    >
      {label}
    </button>
  );
}

function NotificationRow({ notification, selectMode, selected, onClick }: {
  notification: Notification;
  selectMode: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const { icon, color } = styleFor(notification);
  // Selection wins over hover — hovering a picked row must not un-highlight it.
  const background = selected ? ROW_SELECTED_BG : hover ? ROW_HOVER_BG : 'transparent';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex items-start"
      style={{
        position: 'relative',
        borderBottom: '1px solid #E0E0E0',
        minHeight: 56,
        cursor: 'pointer',
        backgroundColor: background,
        transition: 'background-color 0.12s',
      }}
    >
      {/* Left colour bar */}
      <div style={{ width: 3, alignSelf: 'stretch', backgroundColor: color, flexShrink: 0 }} />

      {/* Checkbox + icon badge + text */}
      <div className="flex items-start" style={{ gap: 12, padding: '14px 16px', flex: 1, minWidth: 0 }}>
        {selectMode && (
          <FontAwesomeIcon
            icon={selected ? faSquareCheck : faSquare}
            style={{ fontSize: 15, color: selected ? '#DC0202' : '#808285', marginTop: 6, flexShrink: 0 }}
          />
        )}
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
            {notification.message}
          </p>
          <p style={{ fontSize: 12, color: '#808285', margin: 0 }}>{notification.time}</p>
        </div>
      </div>
    </div>
  );
}
