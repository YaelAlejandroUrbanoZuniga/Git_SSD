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
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      {/* Left — Identity */}
      <div
        style={{
          flex: '0 0 35%',
          minWidth: 420,
          backgroundColor: '#AA0202',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '40px 48px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <div>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF', letterSpacing: '0.12em' }}>NEXTEER</span>
        </div>

        {/* Headline block */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>
            Supplier Scouting &amp; Development
          </p>
          <h1 style={{ fontSize: 40, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.15, letterSpacing: '-0.02em', margin: '0 0 16px' }}>
            SSD Pipeline<br />Management
          </h1>
          <p style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.80)', lineHeight: 1.6, maxWidth: 360, margin: '0 0 16px' }}>
            Track supplier scouting from first contact to onboarding — pipeline, evaluations and SLAs in one place.
          </p>
          <div style={{ width: 64, height: 3, backgroundColor: '#FFFFFF', opacity: 0.6 }} />
        </div>
      </div>

      {/* Right — Form */}
      <div style={{ flex: 1, backgroundColor: '#EEEEEE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 420, backgroundColor: '#FFFFFF', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.20)', padding: '32px 36px' }}>
          {/* Avatar */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: '#DC02021F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#DC0202' }}>SSD</span>
            </div>
          </div>

          {/* Title */}
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#000000', textAlign: 'center', margin: '0 0 4px' }}>
            Welcome
          </h2>
          <p style={{ fontSize: 13, color: '#808285', textAlign: 'center', margin: '0 0 28px' }}>
            Sign in to manage the supplier pipeline.
          </p>

          {/* Email field */}
          <label style={{ fontSize: 13, fontWeight: 400, color: '#808285', display: 'block', marginBottom: 4 }}>
            EMAIL
          </label>
          <div className="relative" style={{ marginBottom: 16 }}>
            <FontAwesomeIcon icon={faUser} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#808285', fontSize: 13 }} />
            <input
              type="email"
              placeholder="name@nexteer.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: '1px solid #D1D3D4', borderRadius: 6, fontSize: 13, color: '#000000', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Password field */}
          <label style={{ fontSize: 13, fontWeight: 400, color: '#808285', display: 'block', marginBottom: 4 }}>
            PASSWORD
          </label>
          <div className="relative" style={{ marginBottom: 24 }}>
            <FontAwesomeIcon icon={faLock} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#808285', fontSize: 13 }} />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', paddingLeft: 36, paddingRight: 36, paddingTop: 8, paddingBottom: 8, border: '1px solid #D1D3D4', borderRadius: 6, fontSize: 13, color: '#000000', outline: 'none', boxSizing: 'border-box' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#808285', padding: 0 }}
            >
              <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} style={{ fontSize: 13 }} />
            </button>
          </div>

          {/* Sign in — VISUAL ONLY: always navigates to /home, no validation */}
          <button
            onClick={() => navigate('/home')}
            style={{
              width: '100%', padding: '10px 0', fontSize: 14, fontWeight: 700,
              backgroundColor: '#DC0202', color: '#FFFFFF', border: 'none',
              borderRadius: 8, cursor: 'pointer', transition: 'box-shadow 0.15s ease-out',
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.18)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            Sign In
          </button>

          {/* Forgot password link */}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <a
              href="#"
              onClick={e => e.preventDefault()}
              style={{ fontSize: 12, color: '#02B3E1', textDecoration: 'underline' }}
            >
              Forgot your password?
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
