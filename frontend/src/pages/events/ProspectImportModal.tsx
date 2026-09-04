import { useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDownload, faFileExcel, faChevronDown, faChevronUp, faCircleCheck,
  faTriangleExclamation, faCopy,
} from '@fortawesome/free-solid-svg-icons';
import { downloadProspectTemplate } from '../../utils/prospectTemplate';
import { parseProspectWorkbook, type ParseResult } from '../../utils/parseProspectWorkbook';
import { importProspects, type ImportProspectsResult } from '../../services/eventProspectsService';
import { ApiError } from '../../services/api.config';
import { ModalHeader } from '../../components/ModalHeader';
import { MODAL_PANEL_BASE, MODAL_BODY_PADDING, MODAL_MAX_HEIGHT } from '../../components/modalPanelStyle';
import { useModalTransition } from '../../hooks/useModalTransition';
import { useToast } from '../../context/ToastContext';
import { ACCENT_COLORS, BRAND_COLORS, NEUTRAL_COLORS } from '../../constants/designTokens';

interface Props {
  eventId: string;
  eventName: string;
  onClose: () => void;
  /** Called after a successful import, before the modal closes, so the tab can refresh. */
  onImported: () => void;
}

type Step = 'pick' | 'preview' | 'result';

const statLabelStyle: React.CSSProperties = { fontSize: 11, color: BRAND_COLORS.sidebar, fontWeight: 500 };
const statValueStyle: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: '#000000' };

export function ProspectImportModal({ eventId, eventName, onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>('pick');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showRejected, setShowRejected] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportProspectsResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const { requestClose, overlayClass, panelClass } = useModalTransition(onClose);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file after fixing it
    if (!file) return;
    setParseError(null);
    try {
      const parsed = await parseProspectWorkbook(file);
      setParseResult(parsed);
      setFileName(file.name);
      setStep('preview');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'This file could not be read.');
    }
  }

  async function handleImport() {
    if (!parseResult || parseResult.rows.length === 0) return;
    setImporting(true);
    try {
      const res = await importProspects(
        eventId,
        parseResult.rows.map(r => ({ companyName: r.companyName, productType: r.productType, website: r.website })),
        fileName ?? undefined,
      );
      setResult(res);
      setStep('result');
    } catch (err) {
      if (err instanceof ApiError && err.isPermissionDenied) toast.permissionError();
      else if (err instanceof ApiError && err.isUserFixable) {
        toast.validationError('The import was rejected', err.message);
      } else {
        toast.systemError(err instanceof ApiError ? err.message : 'The prospects could not be imported.');
      }
    } finally {
      setImporting(false);
    }
  }

  function finish() {
    onImported();
    onClose();
  }

  const rejected = parseResult
    ? [
        ...parseResult.errors.map(e => ({ sourceRow: e.sourceRow, reason: e.reason })),
        ...parseResult.duplicates.map(d => ({
          sourceRow: d.sourceRow,
          reason: `Duplicate of an earlier row in this file ("${d.companyName}").`,
        })),
      ].sort((a, b) => a.sourceRow - b.sourceRow)
    : [];

  return (
    <div
      className={overlayClass}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.3)' }}
      onClick={requestClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={panelClass}
        role="dialog"
        aria-modal="true"
        style={{ ...MODAL_PANEL_BASE, width: 640, maxHeight: MODAL_MAX_HEIGHT, display: 'flex', flexDirection: 'column' }}
      >
        <ModalHeader
          title="Import Prospects"
          subtitle={step === 'pick' ? eventName : fileName ?? undefined}
          accentColor="#04BF6E"
          onClose={requestClose}
        />

        <div style={{ padding: MODAL_BODY_PADDING, overflowY: 'auto' }}>
          {step === 'pick' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <p style={{ fontSize: 13, color: NEUTRAL_COLORS.textDark, margin: '0 0 10px', lineHeight: 1.6 }}>
                  Upload the Excel list of companies expected to attend this event. Only
                  Company Name is required — Type of Product and Website are optional.
                </p>
                <button
                  onClick={() => {
                    downloadProspectTemplate(eventName).catch(() => toast.systemError('The template could not be generated.'));
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6, backgroundColor: BRAND_COLORS.cards, color: ACCENT_COLORS.info, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = NEUTRAL_COLORS.panelBg)}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = BRAND_COLORS.cards)}
                >
                  <FontAwesomeIcon icon={faDownload} style={{ fontSize: 12 }} /> Download template
                </button>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${NEUTRAL_COLORS.border}`, borderRadius: 8, padding: '32px 20px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                  cursor: 'pointer', backgroundColor: '#FAFAFA',
                }}
              >
                <FontAwesomeIcon icon={faFileExcel} style={{ fontSize: 28, color: '#6ABF4B' }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: '#000000', margin: 0 }}>Click to choose a file</p>
                <p style={{ fontSize: 12, color: BRAND_COLORS.sidebar, margin: 0 }}>.xlsx or .xls, up to 500 companies</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>

              {parseError && (
                <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 8, backgroundColor: `${BRAND_COLORS.accentRed}12`, border: `1px solid ${BRAND_COLORS.accentRed}40` }}>
                  <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 14, color: BRAND_COLORS.accentRed, marginTop: 2, flexShrink: 0 }} />
                  <p style={{ fontSize: 13, color: '#000000', margin: 0, lineHeight: 1.5 }}>{parseError}</p>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && parseResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Counts */}
              <div style={{ display: 'flex', gap: 20 }}>
                <div>
                  <span style={statValueStyle}>{parseResult.rows.length}</span>
                  <p style={statLabelStyle}>will be imported</p>
                </div>
                <div>
                  <span style={{ ...statValueStyle, color: parseResult.errors.length > 0 ? BRAND_COLORS.accentRed : '#000000' }}>{parseResult.errors.length}</span>
                  <p style={statLabelStyle}>have errors</p>
                </div>
                <div>
                  <span style={{ ...statValueStyle, color: parseResult.duplicates.length > 0 ? '#D4A017' : '#000000' }}>{parseResult.duplicates.length}</span>
                  <p style={statLabelStyle}>duplicates in the file</p>
                </div>
              </div>

              {/* Note about existing companies */}
              <div style={{ display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 8, backgroundColor: '#02B3E112', border: '1px solid #02B3E140' }}>
                <FontAwesomeIcon icon={faCopy} style={{ fontSize: 13, color: '#02B3E1', marginTop: 2, flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: NEUTRAL_COLORS.textDark, margin: 0, lineHeight: 1.5 }}>
                  Companies already on this event's list will be updated (product type / website),
                  and any existing interest or B2B decision on them is preserved.
                </p>
              </div>

              {/* Valid rows table */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: BRAND_COLORS.sidebar, margin: '0 0 6px' }}>Rows to import</p>
                <div style={{ border: `1px solid ${NEUTRAL_COLORS.borderLight}`, borderRadius: 8, maxHeight: 220, overflowY: 'auto' }}>
                  {parseResult.rows.length === 0 ? (
                    <p style={{ fontSize: 13, color: BRAND_COLORS.sidebar, margin: 0, padding: 16, textAlign: 'center' }}>No valid rows.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ backgroundColor: NEUTRAL_COLORS.panelBg, position: 'sticky', top: 0 }}>
                          <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: NEUTRAL_COLORS.textDark }}>Company</th>
                          <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: NEUTRAL_COLORS.textDark }}>Product</th>
                          <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: NEUTRAL_COLORS.textDark }}>Website</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parseResult.rows.map(r => (
                          <tr key={r.sourceRow} style={{ borderTop: '1px solid #F0F0F0' }}>
                            <td style={{ padding: '7px 12px', color: '#000000' }}>{r.companyName}</td>
                            <td style={{ padding: '7px 12px', color: NEUTRAL_COLORS.textDark }}>{r.productType ?? '—'}</td>
                            <td style={{ padding: '7px 12px', color: NEUTRAL_COLORS.textDark }}>{r.website ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Rejected rows — collapsed by default */}
              {rejected.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowRejected(p => !p)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: BRAND_COLORS.accentRed }}
                  >
                    <FontAwesomeIcon icon={showRejected ? faChevronUp : faChevronDown} style={{ fontSize: 10 }} />
                    {rejected.length} rejected row{rejected.length === 1 ? '' : 's'}
                  </button>
                  {showRejected && (
                    <div style={{ marginTop: 8, border: `1px solid ${NEUTRAL_COLORS.borderLight}`, borderRadius: 8, maxHeight: 160, overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <tbody>
                          {rejected.map((r, i) => (
                            <tr key={`${r.sourceRow}-${i}`} style={{ borderTop: i === 0 ? 'none' : '1px solid #F0F0F0' }}>
                              <td style={{ padding: '7px 12px', color: BRAND_COLORS.sidebar, whiteSpace: 'nowrap' }}>Row {r.sourceRow}</td>
                              <td style={{ padding: '7px 12px', color: '#000000' }}>{r.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'result' && result && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '12px 0' }}>
              <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 40, color: '#6ABF4B' }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: '#000000', margin: 0 }}>Import complete</p>
              <div style={{ display: 'flex', gap: 24 }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={statValueStyle}>{result.created}</span>
                  <p style={statLabelStyle}>created</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={statValueStyle}>{result.updated}</span>
                  <p style={statLabelStyle}>updated</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={statValueStyle}>{result.skipped}</span>
                  <p style={statLabelStyle}>skipped</p>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ borderTop: `0.5px solid ${NEUTRAL_COLORS.border}`, paddingTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
            {step === 'pick' && (
              <button
                onClick={requestClose}
                style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6, backgroundColor: BRAND_COLORS.cards, color: '#000000', cursor: 'pointer' }}
              >
                Cancel
              </button>
            )}
            {step === 'preview' && (
              <>
                <button
                  onClick={() => setStep('pick')}
                  style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 6, backgroundColor: BRAND_COLORS.cards, color: '#000000', cursor: 'pointer' }}
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={parseResult?.rows.length === 0 || importing}
                  style={{
                    padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 6,
                    backgroundColor: BRAND_COLORS.accentRed, color: BRAND_COLORS.cards,
                    cursor: (parseResult?.rows.length === 0 || importing) ? 'not-allowed' : 'pointer',
                    opacity: (parseResult?.rows.length === 0 || importing) ? 0.45 : 1,
                  }}
                >
                  {importing ? 'Importing…' : `Import ${parseResult?.rows.length ?? 0} prospect${parseResult?.rows.length === 1 ? '' : 's'}`}
                </button>
              </>
            )}
            {step === 'result' && (
              <button
                onClick={finish}
                style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 6, backgroundColor: BRAND_COLORS.accentRed, color: BRAND_COLORS.cards, cursor: 'pointer' }}
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
