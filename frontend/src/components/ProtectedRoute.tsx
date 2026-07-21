import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../context/AuthContext';
import type { AppRole } from '../types';

interface Props {
  /** If set, only these roles may render `children`; others go to /home. */
  allow?: AppRole[];
  children: ReactNode;
}

/**
 * Gates a route on auth status (and optionally on role):
 * - loading         → full-screen spinner
 * - unauthenticated → redirect to /login
 * - role not in `allow` → redirect to /home
 */
export function ProtectedRoute({ allow, children }: Props) {
  const { user, status } = useAuth();

  if (status === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#EEEEEE',
      }}>
        <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 28, color: '#DC0202' }} />
      </div>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allow && !allow.includes(user.role)) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}
