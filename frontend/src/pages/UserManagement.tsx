import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPencil, faTrash, faTriangleExclamation, faPlus } from '@fortawesome/free-solid-svg-icons';
import { MODAL_PANEL_BASE, MODAL_BODY_PADDING } from '../components/modalPanelStyle';
import { ModalHeader } from '../components/ModalHeader';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

const ROLE_OPTIONS = ['System Admin', 'GSM Lead', 'GSM Member', 'SSD Analyst', 'Director', 'Buyer', 'SQD'];

const ROLE_TINT: Record<string, { bg: string; color: string }> = {
  'System Admin': { bg: '#DC020226', color: '#DC0202' },
  'GSM Lead':     { bg: '#0084C026', color: '#0084C0' },
  'Director':     { bg: '#6366F126', color: '#6366F1' },
  'SQD':          { bg: '#6ABF4B26', color: '#3E8E2E' },
  'Buyer':        { bg: '#D4A01726', color: '#9A7611' },
};

const initialUsers: User[] = [
  { id: '1', name: 'Yael Urbano',     email: 'yurbano@nexteer.com',  role: 'System Admin' },
  { id: '2', name: 'Carlos Mendoza',  email: 'cmendoza@nexteer.com', role: 'GSM Lead' },
  { id: '3', name: 'Ana García',      email: 'agarcia@nexteer.com',  role: 'Buyer' },
  { id: '4', name: 'Roberto Sánchez', email: 'rsanchez@nexteer.com', role: 'SQD' },
];

function roleBadge(role: string) {
  return ROLE_TINT[role] ?? { bg: '#EEEEEE', color: '#808285' };
}

interface EditModalProps {
  user: User | null;
  onClose: () => void;
  onSave: (user: User) => void;
}

function UserEditModal({ user, onClose, onSave }: EditModalProps) {
  const isEdit = !!user;
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState(user?.role ?? ROLE_OPTIONS[0]);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const validate = () => {
    const next: { name?: string; email?: string } = {};
    if (!name.trim()) next.name = 'Name is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({ id: user?.id ?? String(Date.now()), name: name.trim(), email: email.trim(), role });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', border: '1px solid #D1D3D4', borderRadius: 6, padding: '8px 12px',
    fontSize: 13, color: '#000000', backgroundColor: '#FFFFFF', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ ...MODAL_PANEL_BASE, width: 480 }}
      >
        <ModalHeader title={isEdit ? 'Edit user' : 'Add user'} accentColor="#DC0202" onClose={onClose} />

        <div style={{ padding: MODAL_BODY_PADDING }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#000000', display: 'block', marginBottom: 6 }}>Name</label>
            <input
              type="text" value={name}
              onChange={e => setName(e.target.value)}
              onBlur={validate}
              style={{ ...inputStyle, borderColor: errors.name ? '#DC0202' : '#D1D3D4' }}
            />
            {errors.name && <span style={{ fontSize: 11, color: '#DC0202', display: 'block', marginTop: 4 }}>{errors.name}</span>}
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#000000', display: 'block', marginBottom: 6 }}>Email</label>
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              onBlur={validate}
              style={{ ...inputStyle, borderColor: errors.email ? '#DC0202' : '#D1D3D4' }}
            />
            {errors.email && <span style={{ fontSize: 11, color: '#DC0202', display: 'block', marginTop: 4 }}>{errors.email}</span>}
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#000000', display: 'block', marginBottom: 6 }}>Role</label>
            <select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>
              {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '0.5px solid #D1D3D4', paddingTop: 16, marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: 'pointer' }}
          >
            Save
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

interface DeleteModalProps {
  user: User;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteConfirmModal({ user, onClose, onConfirm }: DeleteModalProps) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ ...MODAL_PANEL_BASE, width: 420, padding: MODAL_BODY_PADDING }}
      >
        <div className="flex items-center" style={{ gap: 12, marginBottom: 12 }}>
          <div className="flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#DC020226', flexShrink: 0 }}>
            <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 16, color: '#DC0202' }} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#000000', margin: 0 }}>Delete user?</h2>
        </div>
        <p style={{ fontSize: 13, color: '#808285', lineHeight: 1.5, margin: '0 0 24px' }}>
          You are about to delete <strong style={{ color: '#000000' }}>{user.name}</strong>. This action cannot be undone.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #D1D3D4', borderRadius: 6, backgroundColor: '#FFFFFF', color: '#000000', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 6, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: 'pointer' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [editing, setEditing] = useState<User | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);

  const openAdd = () => { setEditing(null); setEditOpen(true); };
  const openEdit = (user: User) => { setEditing(user); setEditOpen(true); };

  const handleSave = (user: User) => {
    setUsers(prev => prev.some(u => u.id === user.id)
      ? prev.map(u => (u.id === user.id ? user : u))
      : [...prev, user]);
    setEditOpen(false);
    setEditing(null);
  };

  const handleDelete = () => {
    if (deleting) setUsers(prev => prev.filter(u => u.id !== deleting.id));
    setDeleting(null);
  };

  return (
    <div>
      <div className="flex items-start justify-between" style={{ marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#000000', margin: 0, lineHeight: 1.1 }}>User Management</h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: '#808285', margin: '4px 0 0' }}>
            Manage system users
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center"
          style={{ gap: 6, padding: '10px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, backgroundColor: '#DC0202', color: '#FFFFFF', cursor: 'pointer' }}
        >
          <FontAwesomeIcon icon={faPlus} style={{ fontSize: 12 }} />
          Add user
        </button>
      </div>

      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#F7F7F7' }}>
              {['Name', 'Email', 'Role', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 24px', fontSize: 13, fontWeight: 700, color: '#000000', borderBottom: '0.5px solid #D1D3D4' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user, i) => {
              const badge = roleBadge(user.role);
              return (
                <tr key={user.id} style={{ borderBottom: '0.5px solid #D1D3D4', backgroundColor: i % 2 === 1 ? '#F7F7F7' : '#FFFFFF' }}>
                  <td style={{ padding: '12px 24px', fontSize: 13, fontWeight: 500, color: '#000000' }}>{user.name}</td>
                  <td style={{ padding: '12px 24px', fontSize: 13, color: '#808285' }}>{user.email}</td>
                  <td style={{ padding: '12px 24px' }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: badge.color, backgroundColor: badge.bg, padding: '3px 7px', borderRadius: 3 }}>
                      {user.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px 24px' }}>
                    <div className="flex items-center" style={{ gap: 12 }}>
                      <button
                        onClick={() => openEdit(user)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#0084C0', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500 }}
                      >
                        <FontAwesomeIcon icon={faPencil} style={{ fontSize: 14, color: '#0084C0' }} />
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleting(user)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#DC0202', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}
                      >
                        <FontAwesomeIcon icon={faTrash} style={{ fontSize: 14, color: '#DC0202' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editOpen && (
        <UserEditModal
          user={editing}
          onClose={() => { setEditOpen(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
      {deleting && (
        <DeleteConfirmModal
          user={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
