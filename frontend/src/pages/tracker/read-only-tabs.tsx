import type { HistoryEntry, IntelexLevel, TrackerSupplier } from '../../types';

// ── Shared read-only building blocks ────────────────────────────────────────

export function DisplayField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#808285', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: value ? '#000000' : '#9CA3AF', display: 'block' }}>
        {value ?? '—'}
      </span>
    </div>
  );
}

export function DisplayCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24, marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#000000', margin: '0 0 20px' }}>{title}</h3>
      {children}
    </div>
  );
}

/** The reverse-chronological dot timeline, shared by TrackerSupplierDetail's History tab and Blacklisted's Timeline tab. */
export function HistoryTimeline({ history }: { history: HistoryEntry[] }) {
  return (
    <div style={{ position: 'relative', paddingLeft: 24 }}>
      {/* Vertical line */}
      <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, backgroundColor: '#E0E0E0' }} />

      {history.slice().reverse().map((entry, i) => (
        <div key={i} style={{ position: 'relative', paddingBottom: i < history.length - 1 ? 20 : 0 }}>
          {/* Dot */}
          <div style={{ position: 'absolute', left: -20, top: 4, width: 12, height: 12, borderRadius: '50%', backgroundColor: '#FFFFFF', border: '2px solid #0084C0', zIndex: 1 }} />
          <div>
            <p style={{ fontSize: 12, color: '#808285', margin: '0 0 2px' }}>{entry.date}</p>
            <p style={{ fontSize: 13, color: '#000000', margin: '0 0 2px', fontWeight: 500 }}>{entry.action}</p>
            <p style={{ fontSize: 12, color: '#808285', margin: 0 }}>{entry.user} · {entry.role}</p>
            {entry.note && <p style={{ fontSize: 12, color: '#808285', margin: '4px 0 0', fontStyle: 'italic' }}>{entry.note}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Scouting Event ───────────────────────────────────────────────────────

export function TabROScoutingEvent({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <DisplayCard title="Scouting Event">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <DisplayField label="Scouting Input" value={supplier.scoutingInput} />
        <DisplayField label="Buyer" value={supplier.buyer} />
        <DisplayField label="Company Name" value={supplier.name} />
        <DisplayField label="Commodity" value={supplier.commodity} />
        <DisplayField label="Country" value={supplier.country} />
        <DisplayField label="Product Type" value={supplier.productType} />
      </div>
    </DisplayCard>
  );
}

export function TabROSupplierInfo({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <DisplayCard title="Supplier Info">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <DisplayField label="Manufacturing Address" value={supplier.manufacturingAddress} />
        <DisplayField label="DUNS Number" value={supplier.dunsNumber} />
        <DisplayField label="Website" value={supplier.website} />
        <DisplayField label="Email" value={supplier.contactEmail} />
        <DisplayField label="Phone" value={supplier.phone} />
        <DisplayField label="Certifications" value={supplier.certifications} />
      </div>
    </DisplayCard>
  );
}

// ── Parking Lot ──────────────────────────────────────────────────────────

export function TabROParkingOverview({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <DisplayCard title="Parking Lot — Overview">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <DisplayField label="Onboarding Date" value={supplier.parkingOnboardingDate} />
        <DisplayField label="Sub Status" value={supplier.parkingSubStatus} />
        <DisplayField label="Scouting Input" value={supplier.parkingScoutingInput} />
        <DisplayField label="Buyer" value={supplier.parkingBuyer} />
        <DisplayField label="Commodity" value={supplier.parkingCommodity} />
        <DisplayField label="Product Type" value={supplier.parkingProductType} />
        <DisplayField label="B2B Meeting" value={supplier.parkingB2BMeeting} />
        <DisplayField label="Date to Move" value={supplier.parkingDateToMovePreliminary} />
        <DisplayField label="Additional Comments" value={supplier.parkingAdditionalComments} />
      </div>
    </DisplayCard>
  );
}

export function TabROParkingContact({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <DisplayCard title="Parking Lot — Contact">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <DisplayField label="Contact Name" value={supplier.parkingName1} />
        <DisplayField label="Website" value={supplier.parkingWebsite} />
        <DisplayField label="Email" value={supplier.parkingEmail1} />
        <DisplayField label="Phone" value={supplier.parkingPhone} />
      </div>
    </DisplayCard>
  );
}

export function TabROParkingDetails({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <DisplayCard title="Parking Lot — Details">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <DisplayField label="Manufacturing Country" value={supplier.parkingManufacturingCountry} />
        <DisplayField label="Manufacturing Address" value={supplier.parkingManufacturingAddress} />
        <DisplayField label="Company Name" value={supplier.parkingCompanyName} />
      </div>
    </DisplayCard>
  );
}

// ── Preliminary Evaluation ───────────────────────────────────────────────

export function TabROPrelimOverview({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <DisplayCard title="Preliminary — Overview">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <DisplayField label="Start Date" value={supplier.prelim_startDate} />
        <DisplayField label="Priority" value={supplier.prelim_priority != null ? String(supplier.prelim_priority) : null} />
        <DisplayField label="Scouting Input" value={supplier.prelim_scoutingInput} />
        <DisplayField label="Buyer" value={supplier.prelim_buyer} />
        <DisplayField label="Commodity" value={supplier.prelim_commodity} />
        <DisplayField label="Primary Driver" value={supplier.prelim_primaryDriver} />
        <DisplayField label="Company Name" value={supplier.prelim_companyName} />
        <DisplayField label="DUNS Number" value={supplier.prelim_dunsNumber} />
        <DisplayField label="HQ Address" value={supplier.prelim_hqAddress} />
        <DisplayField label="HQ City" value={supplier.prelim_hqCity} />
        <DisplayField label="HQ Country" value={supplier.prelim_hqCountry} />
        <DisplayField label="Manufacturing Address" value={supplier.prelim_manufacturingAddress} />
        <DisplayField label="Manufacturing City" value={supplier.prelim_manufacturingCity} />
        <DisplayField label="Manufacturing Country" value={supplier.prelim_manufacturingCountry} />
        <DisplayField label="Company Type" value={supplier.prelim_companyType} />
        <DisplayField label="Founded Year" value={supplier.prelim_foundedYear != null ? String(supplier.prelim_foundedYear) : null} />
        <DisplayField label="Footprint" value={supplier.prelim_footprint} />
        <DisplayField label="Years in Mexico" value={supplier.prelim_yearsInMexico != null ? String(supplier.prelim_yearsInMexico) : null} />
        <DisplayField label="Facilities" value={supplier.prelim_facilities != null ? String(supplier.prelim_facilities) : null} />
        <DisplayField label="Employees" value={supplier.prelim_employees != null ? String(supplier.prelim_employees) : null} />
        <DisplayField label="Annual Revenue" value={supplier.prelim_annualRevenue} />
        <DisplayField label="Main Technology" value={supplier.prelim_mainTechnology} />
        <DisplayField label="Certifications" value={supplier.prelim_certifications} />
        <DisplayField label="IMMEX" value={supplier.prelim_hasIMMEX} />
        <DisplayField label="Plan to get IMMEX" value={supplier.prelim_planToGetIMMEX} />
      </div>
    </DisplayCard>
  );
}

export function TabROPrelimCapabilities({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <DisplayCard title="Preliminary — Capabilities">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <DisplayField label="Machinery Type" value={supplier.prelim_machineryType} />
        <DisplayField label="Processing Method" value={supplier.prelim_processingMethod} />
        <DisplayField label="Complementary Operations" value={supplier.prelim_complementaryOps} />
        <DisplayField label="Tooling Design" value={supplier.prelim_toolingDesign} />
        <DisplayField label="Materials" value={supplier.prelim_materials} />
        <DisplayField label="Raw Material Reference Index" value={supplier.prelim_rawMaterialIndex} />
        <DisplayField label="Applications" value={supplier.prelim_applications} />
      </div>
    </DisplayCard>
  );
}

// ── Supplier Evaluation ──────────────────────────────────────────────────

export function TabROSECompetitiveness({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <DisplayCard title="Supplier Evaluation — Competitiveness">
      {supplier.prelim_parts && supplier.prelim_parts.length > 0 ? (
        supplier.prelim_parts.map((p, i) => (
          <div key={i} style={{ marginBottom: i < supplier.prelim_parts.length - 1 ? 20 : 0, paddingBottom: i < supplier.prelim_parts.length - 1 ? 20 : 0, borderBottom: i < supplier.prelim_parts.length - 1 ? '1px solid #EEEEEE' : 'none' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#808285', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Part {i + 1}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <DisplayField label="Part Number" value={p.partNumber} />
              <DisplayField label="Description" value={p.partDescription} />
              <DisplayField label="PL" value={p.pl} />
              <DisplayField label="Annual Peak Volume" value={p.annualPeakVolume != null ? p.annualPeakVolume.toLocaleString() : null} />
              <DisplayField label="Program" value={p.program} />
              <DisplayField label="EOP" value={p.eop} />
              <DisplayField label="Initial Quote" value={p.initialQuote != null ? `$${p.initialQuote.toFixed(4)}` : null} />
              <DisplayField label="QAD Price" value={p.qadPrice != null ? `$${p.qadPrice.toFixed(4)}` : null} />
              <DisplayField label="Delta $" value={p.delta != null ? `$${p.delta.toFixed(4)}` : null} />
              <DisplayField label="Tooling" value={p.tooling != null ? `$${p.tooling.toLocaleString()}` : null} />
              <DisplayField label="Saving Expected" value={p.savingExpected != null ? `$${p.savingExpected.toLocaleString()}` : null} />
              <DisplayField label="Confidence" value={p.confidence} />
            </div>
          </div>
        ))
      ) : (
        <p style={{ fontSize: 13, color: '#9CA3AF' }}>No parts loaded.</p>
      )}
    </DisplayCard>
  );
}

export function TabROSEFundamentals({ supplier }: { supplier: TrackerSupplier }) {
  const docs = [
    { label: 'RFQ Received',  value: supplier.prelim_rfqReceived },
    { label: 'NDA Signed',    value: supplier.prelim_ndaSigned },
    { label: 'TC&s Signed',   value: supplier.prelim_tcsSigned },
    { label: 'TTC&S Signed',  value: supplier.prelim_ttcsSigned },
    { label: 'NSR Signed',    value: supplier.prelim_nsrSigned },
    { label: 'SDA Signed',    value: supplier.prelim_sdaSigned },
    { label: 'Cost Model',    value: supplier.prelim_costModel },
  ];
  return (
    <DisplayCard title="Supplier Evaluation — Fundamentals">
      {docs.map(doc => (
        <div key={doc.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F5F5F5' }}>
          <span style={{ fontSize: 13, color: '#000000' }}>{doc.label}</span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 3,
            backgroundColor: doc.value === 'Y' ? '#6ABF4B26' : doc.value === 'N' ? '#DC020226' : '#80828526',
            color: doc.value === 'Y' ? '#6ABF4B' : doc.value === 'N' ? '#DC0202' : '#808285',
          }}>
            {doc.value ?? '—'}
          </span>
        </div>
      ))}
    </DisplayCard>
  );
}

export function TabROSEVisit({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <>
      <DisplayCard title="Supplier Evaluation — Visit Scheduling">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <DisplayField label="Visit Date Planned" value={supplier.prelim_visitDatePlanned} />
          <DisplayField label="Visit Date Completed" value={supplier.prelim_visitDateCompleted} />
          <DisplayField label="Participants" value={supplier.prelim_visitParticipants} />
        </div>
      </DisplayCard>
      <DisplayCard title="Supplier Evaluation — Visit Report">
        <DisplayField label="Strengths" value={supplier.prelim_strengths} />
        <DisplayField label="Weaknesses" value={supplier.prelim_weaknesses} />
        <DisplayField label="Observations" value={supplier.prelim_observations} />
        <DisplayField label="Recommendations" value={supplier.prelim_recommendations} />
      </DisplayCard>
    </>
  );
}

// ── Intelex Handoff — shared helpers + read-only tabs ───────────────────
//
// daysBetween/intelexEfficiency/intelexEffColor/IntelexLevelBadge/INTELEX_EFF_LEVELS
// are also used by the editable Intelex tabs in TrackerSupplierDetail.tsx, which
// imports them back from here rather than duplicating the derivation.

export function daysBetween(from: string | null | undefined, to: string | null | undefined): number | null {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

export const intelexEffColor = (pct: number) => (pct >= 95 ? '#6ABF4B' : pct >= 70 ? '#D4A017' : '#DC0202');

/**
 * Efficiency of an Intelex milestone = planned elapsed vs. actual elapsed,
 * measured from the record creation date (the start of the Intelex process).
 * Returns a fraction 0–1: 1 = hit the expected date or finished earlier, < 1 =
 * proportionally late. `null` when either date (or the anchor) is missing, so a
 * partially-filled Timeline still yields efficiency for the levels it does have.
 */
export function intelexEfficiency(
  anchor: string | null | undefined,
  expected: string | null | undefined,
  real: string | null | undefined,
): number | null {
  const plannedDays = daysBetween(anchor, expected);
  const actualDays = daysBetween(anchor, real);
  if (plannedDays == null || actualDays == null) return null;
  if (actualDays <= 0) return plannedDays <= 0 ? 1 : null;
  return Math.max(0, Math.min(1, plannedDays / actualDays));
}

/** Prominent pill showing where the supplier is within the Intelex sequence. */
export function IntelexLevelBadge({ level }: { level: IntelexLevel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current level</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#0084C0', backgroundColor: '#0084C026', padding: '3px 10px', borderRadius: 4 }}>{level}</span>
    </div>
  );
}

export const INTELEX_EFF_LEVELS: {
  key: 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
  field: keyof TrackerSupplier;
  expected: keyof TrackerSupplier;
  real: keyof TrackerSupplier;
}[] = [
  { key: 'L0', field: 'intelex_efficiencyL0', expected: 'intelex_l0Expected', real: 'intelex_l0Real' },
  { key: 'L1', field: 'intelex_efficiencyL1', expected: 'intelex_l1Expected', real: 'intelex_l1Real' },
  { key: 'L2', field: 'intelex_efficiencyL2', expected: 'intelex_l2Expected', real: 'intelex_l2Real' },
  { key: 'L3', field: 'intelex_efficiencyL3', expected: 'intelex_l3Expected', real: 'intelex_l3Real' },
  { key: 'L4', field: 'intelex_efficiencyL4', expected: 'intelex_l4Expected', real: 'intelex_l4Real' },
];

export function TabROIntelexRecord({ supplier }: { supplier: TrackerSupplier }) {
  const preEvalRef = supplier.preEvalStartDate || supplier.prelim_startDate;
  const days = daysBetween(preEvalRef, supplier.intelex_recordCreationDate);
  return (
    <DisplayCard title="Intelex Handoff — Record">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <DisplayField label="Record creation date" value={supplier.intelex_recordCreationDate} />
        <DisplayField label="Investigate record number" value={supplier.intelex_investigateRecordNumber} />
        <DisplayField label="Days from Pre-eval" value={days == null ? '—' : `${days} days`} />
      </div>
    </DisplayCard>
  );
}

export function TabROIntelexTimeline({ supplier }: { supplier: TrackerSupplier }) {
  const rows: { label: string; exp: string | null; real: string | null }[] = [
    { label: 'Investigate', exp: supplier.intelex_investigateExpected, real: supplier.intelex_investigateReal },
    { label: 'L0', exp: supplier.intelex_l0Expected, real: supplier.intelex_l0Real },
    { label: 'L1', exp: supplier.intelex_l1Expected, real: supplier.intelex_l1Real },
    { label: 'L2', exp: supplier.intelex_l2Expected, real: supplier.intelex_l2Real },
    { label: 'L3', exp: supplier.intelex_l3Expected, real: supplier.intelex_l3Real },
    { label: 'L4', exp: supplier.intelex_l4Expected, real: supplier.intelex_l4Real },
  ];
  return (
    <DisplayCard title="Intelex Handoff — Timeline">
      <IntelexLevelBadge level={supplier.intelex_currentLevel} />
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: '0 16px', paddingBottom: 8, borderBottom: '1px solid #E0E0E0', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase' }}>Level</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase' }}>Expected</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#808285', textTransform: 'uppercase' }}>Real</span>
      </div>
      {rows.map(r => (
        <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: '0 16px', padding: '8px 0', borderBottom: '1px solid #F5F5F5' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#000000' }}>{r.label}</span>
          <span style={{ fontSize: 13, color: r.exp ? '#000000' : '#9CA3AF' }}>{r.exp ?? '—'}</span>
          <span style={{ fontSize: 13, color: r.real ? '#000000' : '#9CA3AF' }}>{r.real ?? '—'}</span>
        </div>
      ))}
    </DisplayCard>
  );
}

export function TabROIntelexEfficiency({ supplier }: { supplier: TrackerSupplier }) {
  // Derived live from the Timeline dates, same as the editable Efficiency tab.
  const anchor = supplier.intelex_recordCreationDate;
  return (
    <DisplayCard title="Intelex Handoff — Efficiency">
      {INTELEX_EFF_LEVELS.map(({ key, expected, real }) => {
        const frac = intelexEfficiency(anchor, supplier[expected] as string | null, supplier[real] as string | null);
        const pct = frac == null ? null : Math.round(frac * 100);
        return (
          <div key={key} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 44px', gap: '0 16px', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F5F5F5' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#000000' }}>{key}</span>
            <div style={{ height: 8, borderRadius: 4, backgroundColor: '#EEEEEE', overflow: 'hidden' }}>
              <div style={{ width: `${pct == null ? 0 : pct}%`, height: '100%', backgroundColor: pct == null ? '#EEEEEE' : intelexEffColor(pct) }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: pct == null ? '#9CA3AF' : intelexEffColor(pct), textAlign: 'right' }}>{pct == null ? '—' : `${pct}%`}</span>
          </div>
        );
      })}
    </DisplayCard>
  );
}
