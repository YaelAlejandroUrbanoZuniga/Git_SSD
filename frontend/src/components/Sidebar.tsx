import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronLeft, faChevronRight,
  faUser, faCog, faUsersGear, faQuestionCircle, faSignOutAlt,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../context/AuthContext';
import { HEADER_HEIGHT } from './GlobalHeader';
import { moduleIcons, type NavModule } from './moduleIcons';
import { BRAND_COLORS, NEUTRAL_COLORS } from '../constants/designTokens';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  path: string;
  module: NavModule;
  label: string;
}

const navItems: NavItem[] = [
  { path: '/home',       module: 'home',      label: 'Home' },
  { path: '/tracker',    module: 'tracker',   label: 'Tracker' },
  { path: '/suppliers',  module: 'suppliers', label: 'Suppliers' },
  { path: '/events',     module: 'events',    label: 'Events' },
  { path: '/strategy',   module: 'strategy',  label: 'Strategy' },
  { path: '/reports',    module: 'reports',   label: 'Reports' },
  { path: '/visuals',    module: 'visuals',   label: 'Visuals' },
];

/** First letters of each word, max 2 (e.g. "Vianey Perea" → "VP"). */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const sidebarWidth = collapsed ? 60 : 240;

  const displayName = user?.displayName ?? '';
  const role = user?.role ?? '';
  // Guest sees only Home; every operational role sees the full nav. There is
  // no finer per-module gating planned.
  const visibleNavItems = role === 'Guest' ? navItems.filter(i => i.path === '/home') : navItems;

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await logout();
    navigate('/login');
  };
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <aside
      className="fixed left-0 flex flex-col"
      style={{
        width: sidebarWidth,
        backgroundColor: BRAND_COLORS.sidebar,
        top: HEADER_HEIGHT, // directly below fixed header
        bottom: 0,
        zIndex: 30,
        transition: 'width 0.3s',
      }}
    >
      {/* Collapse toggle — circular button on right edge */}
      <button
        onClick={onToggle}
        className="absolute flex items-center justify-center"
        style={{
          right: -12,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 30,
          height: 30,
          borderRadius: '50%',
          backgroundColor: BRAND_COLORS.header,
          color: BRAND_COLORS.cards,
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.28)',
          zIndex: 10,
          transition: 'background-color 0.15s',
        }}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <FontAwesomeIcon icon={collapsed ? faChevronRight : faChevronLeft} style={{ fontSize: 10 }} />
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden" style={{ paddingBottom: 8 }}>
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              justifyContent: 'flex-start',
              width: '100%',
              padding: '15px 15px',
              minHeight: 40,  
              boxSizing: 'border-box',
              textDecoration: 'none',
              color: isActive ? '#000000' : BRAND_COLORS.cards,
              backgroundColor: isActive ? BRAND_COLORS.background : 'transparent',
              boxShadow: isActive ? `inset 6px 0 0 ${BRAND_COLORS.accentRed}` : undefined,
              transition: 'background-color 0.15s, box-shadow 0.15s',
              position: 'relative',
            })}
            className={({ isActive }) => isActive ? '' : 'hover-sidebar-item'}
          >
            <FontAwesomeIcon
              icon={moduleIcons[item.module]}
              style={{ fontSize: 18, width: 40, textAlign: 'center', flexShrink: 10 }}
            />
            {!collapsed && (
              <span style={{ fontSize: 16, fontWeight: 500, whiteSpace: 'nowrap' }}>{item.label}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User block */}
      <div
        className="relative"
        style={{ backgroundColor: BRAND_COLORS.userBlock, borderTop: `1px solid ${BRAND_COLORS.userBlock}` }}
      >
        <button
          ref={triggerRef}
          onClick={() => setUserMenuOpen(v => !v)}
          className="flex items-center w-full"
          style={{
            gap: 10,
            justifyContent: 'flex-start',
            padding: '12px 16px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div
            className="flex items-center justify-center shrink-0 rounded-full text-white font-bold"
            style={{ width: 32, height: 32, backgroundColor: BRAND_COLORS.accentRed, fontSize: 11 }}
          >
            {initialsOf(displayName)}
          </div>
          {!collapsed && (
            <div className="text-left overflow-hidden">
              <div style={{ color: BRAND_COLORS.cards, fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap' }}>{displayName}</div>
              <div style={{ color: 'rgba(255,255,255,0.70)', fontSize: 12, whiteSpace: 'nowrap' }}>{role}</div>
            </div>
          )}
        </button>

        {/* User dropdown */}
        {userMenuOpen && (
          <div
            ref={menuRef}
            className="absolute bg-white"
            style={{
              bottom: collapsed ? 0 : '100%',
              left: collapsed ? sidebarWidth + 4 : 8,
              right: collapsed ? 'auto' : 8,
              marginBottom: collapsed ? 0 : 4,
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.20)',
              paddingTop: 4,
              paddingBottom: 4,
              zIndex: 50,
              minWidth: 180,
            }}
          >
            <button
              className="flex items-center gap-3 w-full text-left hover:bg-[#F5F5F5] transition-colors"
              style={{ padding: '10px 16px', fontSize: 13, color: '#000000', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => { navigate('/profile'); setUserMenuOpen(false); }}
            >
              <FontAwesomeIcon icon={faUser} style={{ color: BRAND_COLORS.sidebar, fontSize: 13, width: 14 }} />
              My Profile
            </button>
            <button
              className="flex items-center gap-3 w-full text-left hover:bg-[#F5F5F5] transition-colors"
              style={{ padding: '10px 16px', fontSize: 13, color: '#000000', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => { navigate('/settings'); setUserMenuOpen(false); }}
            >
              <FontAwesomeIcon icon={faCog} style={{ color: BRAND_COLORS.sidebar, fontSize: 13, width: 14 }} />
              Settings
            </button>
            {/* User Management — master role only (defense in depth; backend 403s too) */}
            {role === 'SSD' && (
              <button
                className="flex items-center gap-3 w-full text-left hover:bg-[#F5F5F5] transition-colors"
                style={{ padding: '10px 16px', fontSize: 13, color: '#000000', background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => { navigate('/users'); setUserMenuOpen(false); }}
              >
                <FontAwesomeIcon icon={faUsersGear} style={{ color: BRAND_COLORS.sidebar, fontSize: 13, width: 14 }} />
                User Management
              </button>
            )}
            <button
              className="flex items-center gap-3 w-full text-left hover:bg-[#F5F5F5] transition-colors"
              style={{ padding: '10px 16px', fontSize: 13, color: '#000000', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <FontAwesomeIcon icon={faQuestionCircle} style={{ color: BRAND_COLORS.sidebar, fontSize: 13, width: 14 }} />
              Help
            </button>
            <hr style={{ margin: '4px 0', border: 'none', borderTop: `1px solid ${NEUTRAL_COLORS.borderLight}` }} />
            <button
              className="flex items-center gap-3 w-full text-left hover:bg-[#F5F5F5] transition-colors"
              style={{ padding: '10px 16px', fontSize: 13, color: BRAND_COLORS.accentRed, background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={handleSignOut}
            >
              <FontAwesomeIcon icon={faSignOutAlt} style={{ color: BRAND_COLORS.accentRed, fontSize: 13, width: 14 }} />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
