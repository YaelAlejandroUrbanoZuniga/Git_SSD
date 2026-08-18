import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faLock, faEye, faEyeSlash, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api.config';
import { BRAND_COLORS, NEUTRAL_COLORS } from '../constants/designTokens';

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      // The field is an email, but the backend accepts email or netid as username.
      await login(email, password);
      navigate('/home');
    } catch (err) {
      // The rejection reason is never surfaced verbatim — it could leak
      // LDAP-service detail. But "the server is unreachable" and "your password
      // is wrong" send the user (and support) after completely different
      // problems, so the two are told apart before falling back to the
      // credentials wording. `status === 0` is what `api.config.ts` throws when
      // the request never left the browser, which on this screen almost always
      // means the backend is down or `VITE_API_URL` was baked in wrong.
      if (err instanceof ApiError && err.status === 0) {
        setError('Cannot reach the server. Check your connection, or contact IT if this continues.');
      } else if (err instanceof ApiError && err.status >= 500) {
        setError('The sign-in service is not responding right now. Please try again in a moment.');
      } else {
        setError('Incorrect email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', width: '100%', position: 'relative' }}>
      {/* Left — Identity */}
      <div
        style={{
          flex: '0 0 52.78%',
          minWidth: 480,
          backgroundImage: 'url(/assets/images/AdobeStock_238352480.jpeg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          padding: '40px 48px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Red tint over the background photo */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: BRAND_COLORS.header,
            opacity: 0.80,
            zIndex: 0,
          }}
        />

        {/* Logo — pinned to the top */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <img src="/assets/images/nexteer-logo-white.png" alt="Nexteer Automotive" style={{ height: 60 }} />
        </div>

        {/* Headline block */}
        <div style={{ margin: 'auto 0', position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>
            Supplier Scouting &amp; Development
          </p>
          <h1 style={{ fontSize: 55, fontWeight: 800, color: BRAND_COLORS.cards, lineHeight: 1.15, letterSpacing: '-0.02em', margin: '0 0 16px' }}>
            SSD Tracker<br />Management
          </h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: 'rgba(255,255,255,0.80)', lineHeight: 1.6, maxWidth: 360, margin: '0 0 16px' }}>
            Track supplier scouting from first contact to onboarding — tracker, evaluations and SLAs in one place.
          </p>
          <div style={{ width: 64, height: 3, backgroundColor: BRAND_COLORS.cards, opacity: 0.6 }} />
        </div>
      </div>

      {/* Right — Form */}
      <div style={{ flex: 1, backgroundColor: BRAND_COLORS.background, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
        <div style={{ width: 550, backgroundColor: BRAND_COLORS.cards, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.20)', padding: '67px 30px' }}>
          {/* App icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <img src="/assets/images/app-icon.png" alt="SSD Tracker Management" style={{ height: 220, width: 'auto' }} />
          </div>

          {/* Title */}
          <h2 style={{ fontSize: 30, fontWeight: 700, color: '#000000', textAlign: 'center', margin: '0 0 4px' }}>
            Welcome
          </h2>
          <p style={{ fontSize: 15, color: '#484848', textAlign: 'center', margin: '0 0 36px' }}>
            Sign in to manage the supplier tracker.
          </p>

          {/* Email field */}
          <label style={{ fontSize: 16, fontWeight: 500, color: '#484848', display: 'block', marginBottom: 4 }}>
            Email
          </label>
          <div className="relative" style={{ marginBottom: 20 }}>
            <FontAwesomeIcon icon={faUser} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: BRAND_COLORS.sidebar, fontSize: 15 }} />
            <input
              type="email"
              placeholder="name@nexteer.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', paddingLeft: 42, paddingRight: 12, paddingTop: 12, paddingBottom: 12, border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6, fontSize: 15, color: '#000000', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Password field */}
          <label style={{ fontSize: 16, fontWeight: 500, color: '#484848', display: 'block', marginBottom: 4 }}>
            Password
          </label>
          <div className="relative" style={{ marginBottom: 28 }}>
            <FontAwesomeIcon icon={faLock} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: BRAND_COLORS.sidebar, fontSize: 15 }} />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSignIn(); }}
              style={{ width: '100%', paddingLeft: 42, paddingRight: 36, paddingTop: 12, paddingBottom: 12, border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6, fontSize: 15, color: '#000000', outline: 'none', boxSizing: 'border-box' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: BRAND_COLORS.sidebar, padding: 0 }}
            >
              <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} style={{ fontSize: 15 }} />
            </button>
          </div>

          {/* Error message — below the password field, above the button */}
          {error && (
            <p
              aria-live="polite"
              style={{ fontSize: 12, color: BRAND_COLORS.accentRed, margin: '0 0 12px', textAlign: 'center' }}
            >
              {error}
            </p>
          )}

          {/* Sign in — real authentication via AuthContext.login */}
          <button
            onClick={handleSignIn}
            disabled={loading}
            style={{
              width: '100%', padding: '13px 0', fontSize: 16, fontWeight: 700,
              backgroundColor: BRAND_COLORS.accentRed, color: BRAND_COLORS.cards, border: 'none',
              borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, transition: 'box-shadow 0.15s ease-out',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.18)'; }}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            {loading ? (
              <><FontAwesomeIcon icon={faSpinner} spin style={{ fontSize: 14, marginRight: 8 }} />Signing in…</>
            ) : 'Sign In'}
          </button>
        </div>
      </div>

      {/* Decorative divider */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 'calc(55% - 20px)',
          transform: 'translateX(-50%)',
          width: 90,
          height: '100%',
          backgroundColor: BRAND_COLORS.background,
          clipPath: 'polygon(50% 0%, 100% 8%, 100% 92%, 50% 100%, 0% 92%, 0% 8%)',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
