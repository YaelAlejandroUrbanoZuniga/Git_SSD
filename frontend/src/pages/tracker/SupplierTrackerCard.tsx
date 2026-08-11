import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMapMarkerAlt, faUser, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import type { TrackerSupplier } from '../../types';
import { getDocsBarColor, getInfoCompletionPercent, slaColors, slaLabels } from '../../utils/tracker-helpers';
import { IntelexLevelBadge } from '../../components/IntelexLevelBadge';

// Shared supplier card used across tracker views.
export const subStatusStyles: Record<string, { bg: string; text: string }> = {
  'Go':               { bg: '#6ABF4B26', text: '#6ABF4B' },
  'No Go':            { bg: '#DC020226', text: '#DC0202' },
  'Under Evaluation': { bg: '#D4A01726', text: '#D4A017' },
  'On Hold':          { bg: '#80828526', text: '#808285' },
};

export function SupplierTrackerCard({ supplier, stageColor }: { supplier: TrackerSupplier; stageColor: string }) {
  const navigate = useNavigate();
  const stage = supplier.stage;

  const displayBuyer = stage === 'Parking Lot'
    ? (supplier.parkingBuyer ?? supplier.buyer)
    : stage === 'Preliminary Evaluation' || stage === 'Supplier Evaluation'
    ? (supplier.prelim_buyer ?? supplier.buyer)
    : supplier.buyer;

  const displayCommodity = stage === 'Parking Lot'
    ? (supplier.parkingCommodity ?? supplier.commodity)
    : stage === 'Preliminary Evaluation' || stage === 'Supplier Evaluation'
    ? (supplier.prelim_commodity ?? supplier.commodity)
    : supplier.commodity;

  const displayProductType = stage === 'Parking Lot'
    ? supplier.parkingProductType
    : supplier.productType;

  const displayCountry = stage === 'Parking Lot'
    ? (supplier.parkingManufacturingCountry ?? supplier.country)
    : stage === 'Preliminary Evaluation' || stage === 'Supplier Evaluation'
    ? (supplier.prelim_manufacturingCountry ?? supplier.country)
    : supplier.country;

  const displaySubStatus = supplier.subStatus ?? supplier.parkingSubStatus ?? null;

  const showIntelexLevel = stage === 'Intelex Handoff' && !!supplier.intelex_currentLevel;

  const contextLine: string | null =
    stage === 'Scouting Event'
      ? (supplier.scoutingInput ?? null)
    : stage === 'Preliminary Evaluation'
      ? (supplier.prelim_primaryDriver ? `Driver: ${supplier.prelim_primaryDriver}` : null)
    : stage === 'Supplier Evaluation'
      ? (supplier.prelim_parts && supplier.prelim_parts.length > 0 && supplier.prelim_parts[0].partNumber
          ? `PN: ${supplier.prelim_parts[0].partNumber}` : null)
    : stage === 'Intelex Handoff'
      ? (supplier.intelex_investigateRecordNumber ? `Record #${supplier.intelex_investigateRecordNumber}` : null)
    : null;

  return (
    <div
      onClick={() => navigate(`/tracker/supplier/${supplier.id}`)}
      className="bg-white"
      style={{ borderRadius: 8, padding: 20, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', transition: 'box-shadow 0.15s ease-out', borderRight: `4px solid ${stageColor}` }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)')}
    >
      <div className="flex items-center" style={{ gap: 6, marginBottom: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: '#1A1A1A', letterSpacing: '-0.01em' }}>{supplier.name}</span>
        {/* Discreet flag only — Parking Lot itself stays fully visible/editable.
            Backend-computed (domain/externalFormGate.ts); same rule that blocks
            the Preliminary Evaluation move (see frontend/README.md). */}
        {stage === 'Parking Lot' && supplier.hasExternalFormData === false && (
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            title="Missing external form data (DUNS number, manufacturing country/address) — required before advancing to Preliminary Evaluation."
            style={{ fontSize: 11, color: '#D4A017' }}
          />
        )}
      </div>

      <p style={{ fontSize: 13, fontWeight: 600, color: '#3D3D3D', margin: '0 0 4px' }}>
        {displayCommodity}{displayProductType ? ` · ${displayProductType}` : ''}
      </p>

      <p style={{ fontSize: 12, color: '#5A5A5A', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <FontAwesomeIcon icon={faMapMarkerAlt} style={{ fontSize: 11, color: stageColor }} />
        {displayCountry}
      </p>

      <p style={{ fontSize: 12, color: '#5A5A5A', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <FontAwesomeIcon icon={faUser} style={{ fontSize: 11, color: stageColor }} />
        {displayBuyer}
      </p>

      {contextLine && (
        <p style={{ fontSize: 12, color: '#5A5A5A', margin: '0 0 6px', fontStyle: 'italic' }}>{contextLine}</p>
      )}

      {/* The SLA dot belongs to time-in-stage, so it sits on this line — not next
          to the information-completeness bar below. */}
      <p style={{ fontSize: 12, color: '#5A5A5A', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* One counter for every stage: `daysInStage` is derived from the stage's
            anchor date and re-persisted by the backend on each read (backend
            README §2.1). Parking Lot used to prefer `parkingDaysElapsed`, a second
            counter nothing writes — same retirement as the old "Timeliness". */}
        <span>Days in stage: <span style={{ color: '#3D3D3D', fontWeight: 600 }}>{supplier.daysInStage}</span></span>
        <span
          title={`SLA status: ${supplier.sla}${slaLabels[supplier.sla] ? ` (${slaLabels[supplier.sla]})` : ''} — time-in-stage indicator`}
          style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: slaColors[supplier.sla], flexShrink: 0 }}
        />
      </p>

      {/* Status pills. The Intelex sub-level is the only stage-specific one: it
          means nothing outside Intelex Handoff, where it is the supplier's
          position in the Investigate → L0 → … → L4 sequence (see frontend
          README, "Intelex Handoff — level sequencing"). */}
      {(showIntelexLevel || (stage === 'Parking Lot' && displaySubStatus && subStatusStyles[displaySubStatus])) && (
        <div className="flex items-center" style={{ gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {showIntelexLevel && <IntelexLevelBadge level={supplier.intelex_currentLevel} compact />}
          {stage === 'Parking Lot' && displaySubStatus && subStatusStyles[displaySubStatus] && (
            <span style={{ backgroundColor: subStatusStyles[displaySubStatus].bg, color: subStatusStyles[displaySubStatus].text, fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 3 }}>
              {displaySubStatus}
            </span>
          )}
        </div>
      )}

      {/* Information completeness only — kept free of the SLA dot so the two
          metrics can't be read as one. */}
      {(() => {
        const pct = getInfoCompletionPercent(supplier);
        const completionTitle = `Information completeness: ${pct}% of this stage's fields filled in`;
        return (
          <div className="flex items-center" style={{ gap: 8 }}>
            <div title={completionTitle} style={{ flex: 1, backgroundColor: '#EEEEEE', borderRadius: 2, height: 4 }}>
              <div style={{ height: 4, borderRadius: 2, backgroundColor: getDocsBarColor(pct), width: `${pct}%`, transition: 'width 0.3s' }} />
            </div>
            <span title={completionTitle} style={{ fontSize: 11, color: '#808285' }}>{pct}%</span>
          </div>
        );
      })()}
    </div>
  );
}
