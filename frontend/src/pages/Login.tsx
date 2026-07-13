import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faLock, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';

export function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', position: 'relative' }}>
      {/* Left — Identity */}
      <div
        style={{
          flex: '0 0 52.78%',
          minWidth: 480,
          backgroundImage: 'url(/assets/images/login-background.jpg)',
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
            backgroundColor: '#AA0202',
            opacity: 0.80,
            zIndex: 0,
          }}
        />

        {/* Logo — pinned to the top */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <img src="/assets/images/nexteer-logo-white.png" alt="Nexteer Automotive" style={{ height: 60 }} />
        </div>

        {/* Headline block — vertically centered in the remaining space below the logo */}
        <div style={{ margin: 'auto 0', position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>
            Supplier Scouting &amp; Development
          </p>
          <h1 style={{ fontSize: 55, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.15, letterSpacing: '-0.02em', margin: '0 0 16px' }}>
            SSD Pipeline<br />Management
          </h1>
          <p style={{ fontSize: 16, fontWeight: 400, color: 'rgba(255,255,255,0.80)', lineHeight: 1.6, maxWidth: 360, margin: '0 0 16px' }}>
            Track supplier scouting from first contact to onboarding — pipeline, evaluations and SLAs in one place.
          </p>
          <div style={{ width: 64, height: 3, backgroundColor: '#FFFFFF', opacity: 0.6 }} />
        </div>
      </div>

      {/* Right — Form */}
      <div style={{ flex: 1, backgroundColor: '#EEEEEE', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
        <div style={{ width: 550, backgroundColor: '#FFFFFF', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.20)', padding: '67px 30px' }}>
          {/* App icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <img src="/assets/images/app-icon.png" alt="SSD Pipeline Management" style={{ height: 220, width: 'auto' }} />
          </div>

          {/* Title */}
          <h2 style={{ fontSize: 30, fontWeight: 700, color: '#000000', textAlign: 'center', margin: '0 0 4px' }}>
            Welcome
          </h2>
          <p style={{ fontSize: 15, color: '#484848', textAlign: 'center', margin: '0 0 36px' }}>
            Sign in to manage the supplier pipeline.
          </p>

          {/* Email field */}
          <label style={{ fontSize: 16, fontWeight: 500, color: '#484848', display: 'block', marginBottom: 4 }}>
            Email
          </label>
          <div className="relative" style={{ marginBottom: 20 }}>
            <FontAwesomeIcon icon={faUser} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#808285', fontSize: 15 }} />
            <input
              type="email"
              placeholder="name@nexteer.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', paddingLeft: 42, paddingRight: 12, paddingTop: 12, paddingBottom: 12, border: '1px solid #D1D3D4', borderRadius: 6, fontSize: 15, color: '#000000', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Password field */}
          <label style={{ fontSize: 16, fontWeight: 500, color: '#484848', display: 'block', marginBottom: 4 }}>
            Password
          </label>
          <div className="relative" style={{ marginBottom: 28 }}>
            <FontAwesomeIcon icon={faLock} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#808285', fontSize: 15 }} />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', paddingLeft: 42, paddingRight: 36, paddingTop: 12, paddingBottom: 12, border: '1px solid #D1D3D4', borderRadius: 6, fontSize: 15, color: '#000000', outline: 'none', boxSizing: 'border-box' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#808285', padding: 0 }}
            >
              <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} style={{ fontSize: 15 }} />
            </button>
          </div>

          {/* Sign in — VISUAL ONLY: always navigates to /home, no validation */}
          <button
            onClick={() => navigate('/home')}
            style={{
              width: '100%', padding: '13px 0', fontSize: 16, fontWeight: 700,
              backgroundColor: '#DC0202', color: '#FFFFFF', border: 'none',
              borderRadius: 8, cursor: 'pointer', transition: 'box-shadow 0.15s ease-out',
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.18)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            Sign In
          </button>

          {/* Forgot password link */}
          <div style={{ textAlign: 'center', marginTop: 25 }}>
            <a
              href="#"
              onClick={e => e.preventDefault()}
              style={{ fontSize: 15, color: '#027DE1', textDecoration: 'underline' }}
            >
              Forgot your password?
            </a>
          </div>
        </div>
      </div>

      {/* Decorative divider */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 'calc(55% - 20px)',
          transform: 'translate(-50%, -50%)',
          width: 90,
          height: '110vh',
          backgroundColor: '#EEEEEE',
          clipPath: 'polygon(50% 10%, 100% 18%, 100% 82%, 50% 90%, 0% 82%, 0% 18%)',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
