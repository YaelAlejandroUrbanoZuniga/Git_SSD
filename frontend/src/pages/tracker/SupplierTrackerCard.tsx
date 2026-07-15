import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMapMarkerAlt, faUser } from '@fortawesome/free-solid-svg-icons';
import type { PipelineSupplier } from '../../types';
import { getDocsBarColor, getInfoCompletionPercent } from '../../utils/tracker-helpers';

// Shared supplier card used across tracker views.
export const slaColors: Record<string, string> = { green: '#6ABF4B', yellow: '#D4A017', red: '#DC0202' };
// Plain-language meaning of each SLA state (time-in-stage indicator, not data completeness).
const slaLabels: Record<string, string> = { green: 'On track', yellow: 'At risk', red: 'Overdue' };
export const subStatusStyles: Record<string, { bg: string; text: string }> = {
  'Go':               { bg: '#6ABF4B26', text: '#6ABF4B' },
  'No Go':            { bg: '#DC020226', text: '#DC0202' },
  'Under Evaluation': { bg: '#D4A01726', text: '#D4A017' },
  'On Hold':          { bg: '#80828526', text: '#808285' },
};

export function SupplierTrackerCard({ supplier, stageColor }: { supplier: PipelineSupplier; stageColor: string }) {
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

  const displayDays = stage === 'Parking Lot'
    ? (supplier.parkingDaysElapsed ?? supplier.daysInStage)
    : supplier.daysInStage;

  const displaySubStatus = supplier.subStatus ?? supplier.parkingSubStatus ?? null;

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
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: '#1A1A1A', letterSpacing: '-0.01em' }}>{supplier.name}</span>
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

      <p style={{ fontSize: 12, color: '#5A5A5A', margin: '0 0 8px' }}>
        Days in stage: <span style={{ color: '#3D3D3D', fontWeight: 600 }}>{displayDays}</span>
      </p>

      {displaySubStatus && subStatusStyles[displaySubStatus] && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ backgroundColor: subStatusStyles[displaySubStatus].bg, color: subStatusStyles[displaySubStatus].text, fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 3 }}>
            {displaySubStatus}
          </span>
        </div>
      )}

      {(() => {
        const pct = getInfoCompletionPercent(supplier);
        const completionTitle = `Information completeness: ${pct}% of required fields/tabs filled for this stage`;
        const slaTitle = `SLA status: ${supplier.sla}${slaLabels[supplier.sla] ? ` (${slaLabels[supplier.sla]})` : ''} — time-in-stage indicator`;
        return (
          <div className="flex items-center" style={{ gap: 8 }}>
            <div title={completionTitle} style={{ flex: 1, backgroundColor: '#EEEEEE', borderRadius: 2, height: 4 }}>
              <div style={{ height: 4, borderRadius: 2, backgroundColor: getDocsBarColor(pct), width: `${pct}%`, transition: 'width 0.3s' }} />
            </div>
            <span title={completionTitle} style={{ fontSize: 11, color: '#808285' }}>{pct}%</span>
            <span title={slaTitle} style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: slaColors[supplier.sla], flexShrink: 0 }} />
          </div>
        );
      })()}
    </div>
  );
}
