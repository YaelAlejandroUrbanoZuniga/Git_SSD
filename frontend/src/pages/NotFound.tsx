import { useLocation, useNavigate } from 'react-router-dom';
import { faCompass } from '@fortawesome/free-solid-svg-icons';
import { EmptyState } from '../components/EmptyState';
import { BRAND_COLORS } from '../constants/designTokens';

/**
 * Catch-all for `path="*"`. Before this existed an unrecognised URL — a stale
 * bookmark, a notification `link` pointing at a route that was later retired —
 * rendered the header and sidebar around a completely empty `<main>`, with no
 * indication that anything had gone wrong.
 */
export function NotFound() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div>
      <EmptyState
        icon={faCompass}
        title="This page does not exist"
        description="The address you followed does not match any screen in the application. It may be an old link, or the page may have been moved."
        action={{ label: 'Go to Home', onClick: () => navigate('/home') }}
      />
      <p
        style={{
          textAlign: 'center', marginTop: 12, fontSize: 11,
          color: BRAND_COLORS.sidebar, fontFamily: 'monospace', wordBreak: 'break-all',
        }}
      >
        {pathname}
      </p>
    </div>
  );
}
