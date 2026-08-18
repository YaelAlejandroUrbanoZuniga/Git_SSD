import { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPencil, faTrash, faPlus, faDatabase, faChevronDown, faUsers, faSearchMinus } from '@fortawesome/free-solid-svg-icons';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { MODAL_PANEL_BASE, MODAL_BODY_PADDING } from '../components/modalPanelStyle';
import { ModalHeader } from '../components/ModalHeader';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SearchBar } from '../components/SearchBar';
import { APP_ROLES, type AppRole } from '../types';
import { ApiError } from '../services/api.config';
import { useToast } from '../context/ToastContext';
import { useTableSort, sortIcon } from '../hooks/useTableSort';
import { EMAIL_RE } from './tracker/supplier-forms/payload';
import { filterBySearch } from '../utils/search-filter';
import { ACCENT_COLORS, BRAND_COLORS, NEUTRAL_COLORS } from '../constants/designTokens';
import {
  createUser, deleteUser, getUsers, updateUserRole, type ManagedUser,
} from '../services/usersService';

// SSD is the master role and is assigned ONLY from the database — never from the
// app (mirrors the backend guards in usersService.updateUserRole/deleteUser).
// So it is excluded from every role picker here, and SSD rows expose no
// edit/delete actions (see the table below).
const ASSIGNABLE_ROLES = APP_ROLES.filter(r => r !== 'SSD');

// Reuses existing palette entries (no new colours): SSD = action red (master),
// PM = info blue (distinct from the other four roles), Guest = archived grey (least privilege).
const ROLE_TINT: Record<AppRole, { bg: string; color: string }> = {
  SSD:     { bg: `${BRAND_COLORS.accentRed}26`, color: BRAND_COLORS.accentRed },
  PM:      { bg: `${ACCENT_COLORS.info}26`, color: ACCENT_COLORS.info },
  Buyer:   { bg: '#D4A01726', color: '#9A7611' },
  SQD:     { bg: '#6ABF4B26', color: '#3E8E2E' },
  Guest:   { bg: `${BRAND_COLORS.userBlock}26`, color: BRAND_COLORS.userBlock },
};

function roleBadge(role: string) {
  return ROLE_TINT[role as AppRole] ?? { bg: BRAND_COLORS.background, color: BRAND_COLORS.sidebar };
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6, padding: '8px 12px',
  fontSize: 13, color: '#000000', backgroundColor: BRAND_COLORS.cards, outline: 'none', boxSizing: 'border-box',
};

// ── Add-user modal (email + role only; displayName comes from AD on first login) ──
interface AddModalProps {
  onClose: () => void;
  onSave: (email: string, role: AppRole) => Promise<boolean>;
}

function AddUserModal({ onClose, onSave }: AddModalProps) {
  const [email, setEmail] = useState('');
  // SSD is intentionally NOT selectable — assigned only via the database.
  const [role, setRole] = useState<AppRole>('Guest');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!EMAIL_RE.test(email.trim())) { setEmailError('Enter a valid email'); return; }
    setSaving(true);
    const ok = await onSave(email.trim(), role);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div onClick={e => e.stopPropagation()} style={{ ...MODAL_PANEL_BASE, width: 480 }}>
        <ModalHeader title="Add user" accentColor={BRAND_COLORS.accentRed} onClose={onClose} />
        <div style={{ padding: MODAL_BODY_PADDING }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#000000', display: 'block', marginBottom: 6 }}>Email</label>
              <input
                type="email" value={email}
                onChange={e => { setEmail(e.target.value); if (emailError) setEmailError(undefined); }}
                onBlur={() => setEmailError(EMAIL_RE.test(email.trim()) ? undefined : 'Enter a valid email')}
                placeholder="name@nexteer.com"
                style={{ ...inputStyle, borderColor: emailError ? BRAND_COLORS.accentRed : NEUTRAL_COLORS.border }}
              />
              {emailError && <span style={{ fontSize: 11, color: BRAND_COLORS.accentRed, display: 'block', marginTop: 4 }}>{emailError}</span>}
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#000000', display: 'block', marginBottom: 6 }}>Role</label>
              <select value={role} onChange={e => setRole(e.target.value as AppRole)} style={inputStyle}>
                {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <span style={{ fontSize: 12, color: BRAND_COLORS.sidebar, display: 'block', marginTop: 4 }}>
                The name is filled in automatically from Active Directory on the user's first login.
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: `0.5px solid ${NEUTRAL_COLORS.border}`, paddingTop: 16, marginTop: 24 }}>
            <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6, backgroundColor: BRAND_COLORS.cards, color: '#000000', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 6, backgroundColor: BRAND_COLORS.accentRed, color: BRAND_COLORS.cards, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Add user'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Edit-user modal (name + email read-only; only role editable) ──
interface EditModalProps {
  user: ManagedUser;
  onClose: () => void;
  onSave: (id: string, role: AppRole) => Promise<boolean>;
}

function EditUserModal({ user, onClose, onSave }: EditModalProps) {
  const [role, setRole] = useState<AppRole>(user.role);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave(user.id, role);
    setSaving(false);
    if (ok) onClose();
  };

  const readOnlyStyle: React.CSSProperties = { ...inputStyle, backgroundColor: NEUTRAL_COLORS.panelBg, color: BRAND_COLORS.sidebar, cursor: 'not-allowed' };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div onClick={e => e.stopPropagation()} style={{ ...MODAL_PANEL_BASE, width: 480 }}>
        <ModalHeader title="Edit user" accentColor={BRAND_COLORS.accentRed} onClose={onClose} />
        <div style={{ padding: MODAL_BODY_PADDING }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#000000', display: 'block', marginBottom: 6 }}>Name</label>
              <input type="text" value={user.displayName} disabled style={readOnlyStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#000000', display: 'block', marginBottom: 6 }}>Email</label>
              <input type="text" value={user.email ?? ''} disabled style={readOnlyStyle} />
              <span style={{ fontSize: 12, color: BRAND_COLORS.sidebar, display: 'block', marginTop: 4 }}>
                Synchronized from Active Directory
              </span>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#000000', display: 'block', marginBottom: 6 }}>Role</label>
              {/* SSD is excluded — it can only be granted from the database, so
                  the app never offers it as a promotion target either. */}
              <select value={role} onChange={e => setRole(e.target.value as AppRole)} style={inputStyle}>
                {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: `0.5px solid ${NEUTRAL_COLORS.border}`, paddingTop: 16, marginTop: 24 }}>
            <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6, backgroundColor: BRAND_COLORS.cards, color: '#000000', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 6, backgroundColor: BRAND_COLORS.accentRed, color: BRAND_COLORS.cards, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type UserSortField = 'displayName' | 'role' | 'supervisorName';

export function UserManagement() {
  const toast = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [deleting, setDeleting] = useState<ManagedUser | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [supervisorFilter, setSupervisorFilter] = useState('');

  const load = () => {
    setLoading(true);
    getUsers()
      .then(list => setUsers(list))
      .catch(err => toast.systemError(err instanceof ApiError ? err.message : 'Could not load users.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [toast]);

  /** Surfaces backend errors legibly (400 "last SSD" guards etc. are user-fixable). */
  const showError = (err: unknown, fallback: string) => {
    if (err instanceof ApiError) {
      if (err.isPermissionDenied) toast.permissionError();
      else if (err.isUserFixable) toast.validationError('Action not allowed', err.message);
      else toast.systemError(err.message);
    } else {
      toast.systemError(fallback);
    }
  };

  const handleCreate = async (email: string, role: AppRole): Promise<boolean> => {
    try {
      const result = await createUser({ email, role });
      load();
      if (result.promotedFromGuest) {
        // The email already existed as a Guest — the backend reclaimed that row.
        toast.success('User promoted from Guest', `${email} now has the ${role} role.`);
      } else {
        toast.success('User added', `${email} was pre-provisioned as ${role}.`);
      }
      return true;
    } catch (err) {
      showError(err, 'Could not create the user.');
      return false;
    }
  };

  const handleUpdate = async (id: string, role: AppRole): Promise<boolean> => {
    try {
      await updateUserRole(id, { role });
      load();
      toast.success('Role updated');
      return true;
    } catch (err) {
      showError(err, 'Could not update the role.');
      return false;
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteUser(deleting.id);
      load();
      toast.success('User deleted');
      setDeleting(null);
    } catch (err) {
      showError(err, 'Could not delete the user.');
      setDeleting(null);
    }
  };

  // Filter options are derived from the loaded users, never a fixed list — so
  // they stay in sync with whatever roles/supervisors actually exist. Guests are
  // already excluded server-side (usersService.listUsers), so they never surface
  // as an option here either. The Supervisor list only holds people whose
  // `supervisorName` is filled from AD (nulls/blanks dropped); it grows on its
  // own as more of the team signs in.
  const roleOptions = useMemo(
    () => [...new Set(users.map(u => u.role))].sort(),
    [users],
  );
  const supervisorOptions = useMemo(
    () => [...new Set(
      users.map(u => u.supervisorName).filter((s): s is string => !!s && s.trim() !== ''),
    )].sort(),
    [users],
  );

  // Free-text search (name/email/role) combined with the Role and Supervisor
  // dropdowns as a logical AND, over the already Guest-free loaded data.
  const filtered = useMemo(() => {
    const byDropdowns = users.filter(u => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (supervisorFilter && (u.supervisorName ?? '') !== supervisorFilter) return false;
      return true;
    });
    return filterBySearch(byDropdowns, search, u => [u.displayName, u.email, u.role]);
  }, [users, search, roleFilter, supervisorFilter]);

  const { sortField, sortDir, handleSort, sortedRows: sorted } = useTableSort<ManagedUser, UserSortField>(
    filtered,
    (u, field) => (field === 'supervisorName' ? u.supervisorName : u[field]),
  );

  const columns: { label: string; field: UserSortField | null }[] = [
    { label: 'Name', field: 'displayName' },
    { label: 'Email', field: null },
    { label: 'Role', field: 'role' },
    { label: 'Supervisor', field: 'supervisorName' },
    { label: 'Actions', field: null },
  ];

  return (
    <div>
      <div className="flex items-start justify-between" style={{ marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>User Management</h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: BRAND_COLORS.sidebar, margin: '4px 0 0' }}>
            Manage system users
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center"
          style={{ gap: 6, padding: '10px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, backgroundColor: BRAND_COLORS.accentRed, color: BRAND_COLORS.cards, cursor: 'pointer' }}
        >
          <FontAwesomeIcon icon={faPlus} style={{ fontSize: 12 }} />
          Add user
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex items-center flex-wrap" style={{ gap: 12, marginBottom: 20 }}>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search name, email or role…"
          style={{ flex: '1 1 0', maxWidth: 380 }}
        />
        <FilterDropdown label="Role" value={roleFilter} options={roleOptions} onChange={setRoleFilter} />
        <FilterDropdown label="Supervisor" value={supervisorFilter} options={supervisorOptions} onChange={setSupervisorFilter} />
      </div>

      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {loading ? (
          <LoadingState entity="Users" icon={faUsers} style={{ padding: 48 }} />
        ) : users.length === 0 ? (
          <EmptyState icon={faUsers} title="No users yet" description="No users yet." />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={faSearchMinus}
            title="No users found"
            description="No users match the current search or filters."
          />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {columns.map(col => {
                  const iconInfo = col.field ? sortIcon(col.field, sortField, sortDir) : null;
                  return (
                    <th
                      key={col.label}
                      onClick={col.field ? () => handleSort(col.field as UserSortField) : undefined}
                      style={{ textAlign: 'left', padding: '12px 24px', fontSize: 13, fontWeight: 700, color: '#000000', backgroundColor: col.field && sortField === col.field ? BRAND_COLORS.background : NEUTRAL_COLORS.panelBg, borderBottom: `0.5px solid ${NEUTRAL_COLORS.border}`, cursor: col.field ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}
                    >
                      <span className="flex items-center" style={{ gap: 4 }}>
                        {col.label}
                        {iconInfo && <FontAwesomeIcon icon={iconInfo.icon} style={{ fontSize: 10, color: iconInfo.color }} />}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((user, i) => {
                const badge = roleBadge(user.role);
                const isSsd = user.role === 'SSD';
                return (
                  <tr key={user.id} style={{ borderBottom: `0.5px solid ${NEUTRAL_COLORS.border}`, backgroundColor: i % 2 === 1 ? NEUTRAL_COLORS.panelBg : BRAND_COLORS.cards }}>
                    <td style={{ padding: '12px 24px', fontSize: 13, fontWeight: 500, color: '#000000' }}>{user.displayName}</td>
                    <td style={{ padding: '12px 24px', fontSize: 13, color: BRAND_COLORS.sidebar }}>{user.email ?? '—'}</td>
                    <td style={{ padding: '12px 24px' }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: badge.color, backgroundColor: badge.bg, padding: '3px 7px', borderRadius: 3 }}>
                        {user.role}
                      </span>
                    </td>
                    <td style={{ padding: '12px 24px', fontSize: 13, color: BRAND_COLORS.sidebar }}>{user.supervisorName ?? '—'}</td>
                    <td style={{ padding: '12px 24px' }}>
                      {isSsd ? (
                        // SSD users exist but can't be edited/deleted from the app —
                        // they are managed directly in the database (see backend guards).
                        <span
                          title="SSD users are managed directly in the database — the app cannot change or remove them."
                          className="flex items-center"
                          style={{ gap: 5, fontSize: 12, color: BRAND_COLORS.sidebar, fontStyle: 'italic', cursor: 'default' }}
                        >
                          <FontAwesomeIcon icon={faDatabase} style={{ fontSize: 11, color: BRAND_COLORS.sidebar }} />
                          Managed via DB
                        </span>
                      ) : (
                        <div className="flex items-center" style={{ gap: 12 }}>
                          <button
                            onClick={() => setEditing(user)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: ACCENT_COLORS.info, display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500 }}
                          >
                            <FontAwesomeIcon icon={faPencil} style={{ fontSize: 14, color: ACCENT_COLORS.info }} />
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleting(user)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: BRAND_COLORS.accentRed, display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}
                          >
                            <FontAwesomeIcon icon={faTrash} style={{ fontSize: 14, color: BRAND_COLORS.accentRed }} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {addOpen && (
        <AddUserModal onClose={() => setAddOpen(false)} onSave={handleCreate} />
      )}
      {editing && (
        <EditUserModal user={editing} onClose={() => setEditing(null)} onSave={handleUpdate} />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete user?"
          message={<>You are about to delete <strong style={{ color: '#000000' }}>{deleting.displayName}</strong>. This action cannot be undone.</>}
          confirmLabel="Delete"
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

// Dropdown filter — same look & feel as SuppliersList's FilterDropdown (that one
// is a local, non-exported component, so this is an equivalent copy). The empty
// value shows the label itself and clears the filter.
function FilterDropdown({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="relative" style={{ display: 'inline-block' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          appearance: 'none', padding: '8px 32px 8px 12px', border: `1px solid ${NEUTRAL_COLORS.borderLight}`, borderRadius: 8,
          fontSize: 13, color: value ? '#000000' : BRAND_COLORS.sidebar, backgroundColor: BRAND_COLORS.cards, cursor: 'pointer', outline: 'none',
        }}
      >
        <option value="">{label}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <FontAwesomeIcon icon={faChevronDown} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: BRAND_COLORS.sidebar, pointerEvents: 'none' }} />
    </div>
  );
}
