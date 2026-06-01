import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQrcode, faCopy, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';

interface Props {
  onClose: () => void;
}

function QRPattern() {
  const size = 160;
  const cellSize = 8;
  const grid = size / cellSize;
  const cells: { x: number; y: number }[] = [];

  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      if (row < 3 && col < 3) continue;
      if (row < 3 && col >= grid - 3) continue;
      if (row >= grid - 3 && col < 3) continue;
      if (Math.random() > 0.55) {
        cells.push({ x: col * cellSize, y: row * cellSize });
      }
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <rect width={size} height={size} fill="#F7F7F7" />
      <rect x="0" y="0" width="24" height="24" fill="#000000" />
      <rect x="4" y="4" width="16" height="16" fill="#F7F7F7" />
      <rect x="8" y="8" width="8" height="8" fill="#000000" />
      <rect x={size - 24} y="0" width="24" height="24" fill="#000000" />
      <rect x={size - 20} y="4" width="16" height="16" fill="#F7F7F7" />
      <rect x={size - 16} y="8" width="8" height="8" fill="#000000" />
      <rect x="0" y={size - 24} width="24" height="24" fill="#000000" />
      <rect x="4" y={size - 20} width="16" height="16" fill="#F7F7F7" />
      <rect x="8" y={size - 16} width="8" height="8" fill="#000000" />
      {cells.map((c, i) => (
        <rect key={i} x={c.x} y={c.y} width={cellSize - 1} height={cellSize - 1} fill="#000000" />
      ))}
    </svg>
  );
}

export function NewEventModal({ onClose }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.3)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 560, backgroundColor: '#FFFFFF', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.20)', padding: '28px 32px', position: 'relative' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <FontAwesomeIcon icon={faTimes} style={{ fontSize: 16, color: '#808285' }} />
        </button>

        {/* Header */}
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#000000', margin: '0 0 4px' }}>New Event</h2>
        <p style={{ fontSize: 13, color: '#808285', margin: '0 0 24px' }}>Register a new scouting event</p>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {/* Icon */}
          <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: '#02B3E115', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FontAwesomeIcon icon={faQrcode} style={{ fontSize: 28, color: '#02B3E1' }} />
          </div>

          {/* Title + description */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#000000', margin: '0 0 4px' }}>Event form</p>
            <p style={{ fontSize: 13, color: '#808285', margin: 0, maxWidth: 360, lineHeight: 1.5 }}>
              Scan this QR to create a scouting event with all the meeting information.
            </p>
          </div>

          {/* QR Code */}
          <div style={{ border: '1px solid #D1D3D4', borderRadius: 8, padding: 12, backgroundColor: '#F7F7F7' }}>
            <QRPattern />
          </div>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', fontSize: 13, fontWeight: 500,
              border: '1px solid #E0E0E0', borderRadius: 8,
              backgroundColor: '#FFFFFF', cursor: 'pointer',
              color: copied ? '#6ABF4B' : '#000000',
              transition: 'color 0.15s',
            }}
          >
            <FontAwesomeIcon icon={copied ? faCheck : faCopy} style={{ fontSize: 12 }} />
            {copied ? 'Copied!' : 'Copy link'}
          </button>

          {/* URL */}
          <a
            href="#"
            onClick={e => e.preventDefault()}
            style={{ fontSize: 12, color: '#02B3E1', textDecoration: 'underline' }}
          >
            forms.nexteer.com/new-scouting-event
          </a>
        </div>
      </div>
    </div>
  );
}
