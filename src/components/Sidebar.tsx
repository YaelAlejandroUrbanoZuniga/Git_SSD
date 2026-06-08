import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHome, faColumns, faBuilding, faCalendar, faChartBar,
  faChevronLeft, faChevronRight,
  faUser, faCog, faQuestionCircle, faSignOutAlt,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { useRole } from '../context/RoleContext';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  path: string;
  icon: IconDefinition;
  label: string;
}

const navItems: NavItem[] = [
  { path: '/home',       icon: faHome,     label: 'Home' },
  { path: '/pipeline',   icon: faColumns,  label: 'Pipeline' },
  { path: '/suppliers',  icon: faBuilding, label: 'Suppliers' },
  { path: '/events',     icon: faCalendar, label: 'Events' },
  { path: '/visuals',    icon: faChartBar, label: 'Visuals' },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { activeRole } = useRole();
  const sidebarWidth = collapsed ? 56 : 240;

  return (
    <aside
      className="fixed left-0 flex flex-col"
      style={{
        width: sidebarWidth,
        backgroundColor: '#808285',
        top: 44,           // directly below fixed header
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
          width: 24,
          height: 24,
          borderRadius: '50%',
          backgroundColor: '#AA0202',
          color: '#FFFFFF',
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
      <nav className="flex-1 overflow-y-auto overflow-x-hidden" style={{ paddingTop: 8, paddingBottom: 8 }}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: collapsed ? 0 : 12,
              justifyContent: collapsed ? 'center' : 'flex-start',
              width: '100%',
              padding: collapsed ? '11px 0' : '11px 16px',
              boxSizing: 'border-box',
              textDecoration: 'none',
              color: isActive ? '#000000' : '#FFFFFF',
              backgroundColor: isActive ? '#EEEEEE' : 'transparent',
              boxShadow: isActive ? 'inset 3px 0 0 #DC0202' : undefined,
              transition: 'background-color 0.15s, box-shadow 0.15s',
              position: 'relative',
            })}
            className={({ isActive }) => isActive ? '' : 'hover-sidebar-item'}
          >
            <FontAwesomeIcon
              icon={item.icon}
              style={{ fontSize: 18, width: 20, textAlign: 'center', flexShrink: 0 }}
            />
            {!collapsed && (
              <span style={{ fontSize: 15, fontWeight: 400, whiteSpace: 'nowrap' }}>{item.label}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User block */}
      <div
        className="relative"
        style={{ backgroundColor: '#6B7280', borderTop: '1px solid #6B7280' }}
      >
        <button
          onClick={() => setUserMenuOpen(v => !v)}
          className="flex items-center w-full"
          style={{
            gap: collapsed ? 0 : 10,
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '12px 0' : '12px 16px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div
            className="flex items-center justify-center shrink-0 rounded-full text-white font-bold"
            style={{ width: 32, height: 32, backgroundColor: '#DC0202', fontSize: 11 }}
          >
            YU
          </div>
          {!collapsed && (
            <div className="text-left overflow-hidden">
              <div style={{ color: '#FFFFFF', fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap' }}>Yael Urbano</div>
              <div style={{ color: 'rgba(255,255,255,0.70)', fontSize: 12, whiteSpace: 'nowrap' }}>{activeRole}</div>
            </div>
          )}
        </button>

        {/* User dropdown — opens to the right when collapsed, above when expanded */}
        {userMenuOpen && (
          <div
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
              onClick={() => { navigate('/settings'); setUserMenuOpen(false); }}
            >
              <FontAwesomeIcon icon={faUser} style={{ color: '#808285', fontSize: 13, width: 14 }} />
              My profile
            </button>
            <button
              className="flex items-center gap-3 w-full text-left hover:bg-[#F5F5F5] transition-colors"
              style={{ padding: '10px 16px', fontSize: 13, color: '#000000', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => { navigate('/settings'); setUserMenuOpen(false); }}
            >
              <FontAwesomeIcon icon={faCog} style={{ color: '#808285', fontSize: 13, width: 14 }} />
              Settings
            </button>
            <button
              className="flex items-center gap-3 w-full text-left hover:bg-[#F5F5F5] transition-colors"
              style={{ padding: '10px 16px', fontSize: 13, color: '#000000', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <FontAwesomeIcon icon={faQuestionCircle} style={{ color: '#808285', fontSize: 13, width: 14 }} />
              Help
            </button>
            <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #E0E0E0' }} />
            <button
              className="flex items-center gap-3 w-full text-left hover:bg-[#F5F5F5] transition-colors"
              style={{ padding: '10px 16px', fontSize: 13, color: '#DC0202', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <FontAwesomeIcon icon={faSignOutAlt} style={{ color: '#DC0202', fontSize: 13, width: 14 }} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
