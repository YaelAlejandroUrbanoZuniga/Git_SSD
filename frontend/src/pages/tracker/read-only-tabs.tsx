import type { HistoryEntry, TrackerSupplier } from '../../types';
import { IntelexLevelBadge } from '../../components/IntelexLevelBadge';
import { ACCENT_COLORS, BRAND_COLORS, NEUTRAL_COLORS } from '../../constants/designTokens';

// ── Shared read-only building blocks ────────────────────────────────────────

export function DisplayField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: BRAND_COLORS.sidebar, display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
      <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, backgroundColor: NEUTRAL_COLORS.borderLight }} />

      {history.slice().reverse().map((entry, i) => (
        <div key={i} style={{ position: 'relative', paddingBottom: i < history.length - 1 ? 20 : 0 }}>
          {/* Dot */}
          <div style={{ position: 'absolute', left: -20, top: 4, width: 12, height: 12, borderRadius: '50%', backgroundColor: BRAND_COLORS.cards, border: `2px solid ${ACCENT_COLORS.info}`, zIndex: 1 }} />
          <div>
            <p style={{ fontSize: 12, color: BRAND_COLORS.sidebar, margin: '0 0 2px' }}>{entry.date}</p>
            <p style={{ fontSize: 13, color: '#000000', margin: '0 0 2px', fontWeight: 500 }}>{entry.action}</p>
            <p style={{ fontSize: 12, color: BRAND_COLORS.sidebar, margin: 0 }}>{entry.user} · {entry.role}</p>
            {entry.note && <p style={{ fontSize: 12, color: BRAND_COLORS.sidebar, margin: '4px 0 0', fontStyle: 'italic' }}>{entry.note}</p>}
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
        <DisplayField label="SSD Leader" value={supplier.prelim_ssdLeader} />
        <DisplayField label="SDE Leader" value={supplier.prelim_sdeLeader} />
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
          <div key={i} style={{ marginBottom: i < supplier.prelim_parts.length - 1 ? 20 : 0, paddingBottom: i < supplier.prelim_parts.length - 1 ? 20 : 0, borderBottom: i < supplier.prelim_parts.length - 1 ? `1px solid ${BRAND_COLORS.background}` : 'none' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: BRAND_COLORS.sidebar, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Part {i + 1}</p>
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
              <DisplayField label="Cost" value={p.cost} />
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
            backgroundColor: doc.value === 'Y' ? '#6ABF4B26' : doc.value === 'N' ? `${BRAND_COLORS.accentRed}26` : `${BRAND_COLORS.sidebar}26`,
            color: doc.value === 'Y' ? '#6ABF4B' : doc.value === 'N' ? BRAND_COLORS.accentRed : BRAND_COLORS.sidebar,
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
// daysBetween/intelexLevelEfficiency/intelexEffColor/IntelexLevelBadge/INTELEX_EFF_LEVELS
// are also used by the editable Intelex tabs in TrackerSupplierDetail.tsx, which
// imports them back from here rather than duplicating the derivation.
//
// MODULE BOUNDARY — the dependency runs one way and must stay that way: this
// file imports nothing from TrackerSupplierDetail.tsx, and all three detail
// screens (TrackerSupplierDetail, CompletedSupplierDetail,
// BlacklistedSupplierDetail) import from here. Four components
// (TabROAttendees, TabROAgenda, TabRONextStep, TabCompletedOverview) used to
// live in TrackerSupplierDetail.tsx and be imported back out of it, which made
// the two read-only screens transitively depend on the 3000-line editable page
// and let Rollup collapse this module into that page's chunk. If a component
// here needs a helper that currently lives in TrackerSupplierDetail.tsx, move
// the helper into this file — do not add an import in the other direction.

export function daysBetween(from: string | null | undefined, to: string | null | undefined): number | null {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

export const intelexEffColor = (pct: number) => (pct >= 95 ? '#6ABF4B' : pct >= 70 ? '#D4A017' : BRAND_COLORS.accentRed);

/**
 * Efficiency of ONE Intelex level from its own Expected/Real pair: how late that
 * level landed, through the GSM team's stepped penalty. `null` while either date
 * is missing. Deliberately NOT measured from a common anchor — each level answers
 * only for its own delay.
 *
 * **Duplicate on purpose.** The source of truth is
 * `backend/src/domain/intelexEfficiency.ts`, which computes these values and
 * persists them on `IntelexData`; every read-only view shows the persisted
 * numbers. This copy exists for one job: the live preview in the editable
 * Timeline form, which has to score dates the user has typed but not yet saved.
 * Keep the five branches identical to the domain module (they mirror the team's
 * Excel column by column) — if that formula is retuned, retune it here too.
 */
export function intelexLevelEfficiency(
  expected: string | null | undefined,
  real: string | null | undefined,
): number | null {
  const delay = daysBetween(expected, real);
  if (delay == null) return null;
  if (delay <= 0) return 0.95;
  if (delay <= 5) return 0.95;
  if (delay <= 15) return 0.95 - (delay - 5) * 0.025;
  if (delay <= 25) return 0.70 - (delay - 15) * 0.02;
  return 0.50;
}

// The level badge moved to components/IntelexLevelBadge.tsx once the Tracker card
// became a third consumer; re-exported here so the Intelex tabs' existing imports
// (and TrackerSupplierDetail's) keep pointing at this module.
export { IntelexLevelBadge };

/**
 * The five scored levels and the wire field carrying each one. Only `field` is
 * read now: the values are computed and persisted by the backend, so every view
 * displays them instead of re-deriving them from the dates (Investigate is not
 * scored — it has no efficiency column).
 */
export const INTELEX_EFF_LEVELS: {
  key: 'L0' | 'L1' | 'L2' | 'L3' | 'L4';
  field: keyof TrackerSupplier;
}[] = [
  { key: 'L0', field: 'intelex_efficiencyL0' },
  { key: 'L1', field: 'intelex_efficiencyL1' },
  { key: 'L2', field: 'intelex_efficiencyL2' },
  { key: 'L3', field: 'intelex_efficiencyL3' },
  { key: 'L4', field: 'intelex_efficiencyL4' },
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
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: '0 16px', paddingBottom: 8, borderBottom: `1px solid ${NEUTRAL_COLORS.borderLight}`, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: BRAND_COLORS.sidebar, textTransform: 'uppercase' }}>Level</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: BRAND_COLORS.sidebar, textTransform: 'uppercase' }}>Expected</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: BRAND_COLORS.sidebar, textTransform: 'uppercase' }}>Real</span>
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

/** One level's (or the Global) bar + percentage, from an already-computed fraction. */
function IntelexEffRow({ label, frac, emphasis }: { label: string; frac: number | null; emphasis?: boolean }) {
  const pct = frac == null ? null : Math.round(frac * 100);
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '80px 1fr 44px', gap: '0 16px', alignItems: 'center',
      // The Global row closes the card: heavier top rule, no bottom hairline.
      ...(emphasis
        ? { padding: '12px 0 0', marginTop: 4, borderTop: `2px solid ${NEUTRAL_COLORS.border}` }
        : { padding: '8px 0', borderBottom: '1px solid #F5F5F5' }),
    }}>
      <span style={{ fontSize: 13, fontWeight: emphasis ? 800 : 600, color: '#000000' }}>{label}</span>
      <div style={{ height: 8, borderRadius: 4, backgroundColor: BRAND_COLORS.background, overflow: 'hidden' }}>
        <div style={{ width: `${pct == null ? 0 : pct}%`, height: '100%', backgroundColor: pct == null ? BRAND_COLORS.background : intelexEffColor(pct) }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: emphasis ? 800 : 700, color: pct == null ? '#9CA3AF' : intelexEffColor(pct), textAlign: 'right' }}>
        {pct == null ? '—' : `${pct}%`}
      </span>
    </div>
  );
}

export function TabROIntelexEfficiency({ supplier }: { supplier: TrackerSupplier }) {
  // Read, not recomputed: the backend scores each level on its own
  // Expected-vs-Real delay and persists the five values plus their average, so
  // this card can't drift from what is stored (see backend domain/intelexEfficiency).
  const global = supplier.intelex_efficiencyGlobal;
  return (
    <DisplayCard title="Intelex Handoff — Efficiency">
      {INTELEX_EFF_LEVELS.map(({ key, field }) => (
        <IntelexEffRow key={key} label={key} frac={supplier[field] as number | null} />
      ))}
      {/* Global = average of the levels that have a value, so it appears exactly
          when at least one level has been scored. */}
      {global != null && <IntelexEffRow label="Global" frac={global} emphasis />}
    </DisplayCard>
  );
}

// ── Scouting Event — B2B sub-tabs ──────────────────────────────────────────

export function TabROAttendees({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <DisplayCard title="Attendees">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <DisplayField label="B2B Meeting" value={supplier.b2bStatus} />
        <DisplayField label="Who Attends" value={supplier.b2bWhoAttends} />
        <DisplayField label="Manager" value={supplier.b2bManager} />
        <DisplayField label="Buyer" value={supplier.b2bBuyer} />
        <DisplayField label="Comments" value={supplier.b2bComments} />
      </div>
    </DisplayCard>
  );
}

export function TabROAgenda({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <DisplayCard title="Agenda">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <DisplayField label="Status" value={supplier.agendaStatus} />
        <DisplayField label="Scheduled Date" value={supplier.agendaScheduledDate} />
        <DisplayField label="Start Time" value={supplier.agendaStartTime} />
        <DisplayField label="End Time" value={supplier.agendaEndTime} />
        <DisplayField label="Duration" value={supplier.agendaDuration} />
        <DisplayField label="Timezone" value={supplier.agendaTimezone} />
        <DisplayField label="Stand" value={supplier.agendaStand} />
        <DisplayField label="Teams Link" value={supplier.agendaTeamsLink} />
      </div>
    </DisplayCard>
  );
}

export function TabRONextStep({ supplier }: { supplier: TrackerSupplier }) {
  return (
    <DisplayCard title="Next Step">
      <DisplayField label="Selected for Parking Lot" value={supplier.selectedForParking === true ? 'Yes' : supplier.selectedForParking === false ? 'No' : '—'} />
      <DisplayField label="Selection Reason" value={supplier.selectionReason} />
    </DisplayCard>
  );
}

// ── Consolidated overview ──────────────────────────────────────────────────
//
// `Badge`/`SectionTitle`/`InfoRow` and the two style maps below back
// `TabCompletedOverview`. They live here, not in `TrackerSupplierDetail.tsx`,
// because this module must never import from that one — see the module-boundary
// note above the Intelex section.

export const priorityStyles: Record<number, { bg: string; text: string }> = {
  1: { bg: `${BRAND_COLORS.accentRed}26`, text: BRAND_COLORS.accentRed },
  2: { bg: '#E3650B26', text: '#E3650B' },
  3: { bg: '#D4A01726', text: '#D4A017' },
};

export const confidenceStyles: Record<string, { bg: string; text: string }> = {
  'High':   { bg: '#6ABF4B26', text: '#6ABF4B' },
  'Medium': { bg: '#D4A01726', text: '#D4A017' },
  'Low':    { bg: `${BRAND_COLORS.accentRed}26`, text: BRAND_COLORS.accentRed },
};

export function Badge({ bg, text, label }: { bg: string; text: string; label: string }) {
  return <span style={{ backgroundColor: bg, color: text, fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 3, display: 'inline-block' }}>{label}</span>;
}

export function SectionTitle({ title }: { title: string }) {
  return <h3 style={{ fontSize: 11, fontWeight: 700, color: BRAND_COLORS.sidebar, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>{title}</h3>;
}

export function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid #F0F0F0' }}>
      <span style={{ fontSize: 13, color: BRAND_COLORS.sidebar, flex: '0 0 44%' }}>{label}</span>
      <span style={{ fontSize: 13, color: '#000000', fontWeight: 400, textAlign: 'right', flex: 1 }}>{value}</span>
    </div>
  );
}

/**
 * Consolidated, de-duplicated snapshot of who the supplier is — one canonical
 * value per fact, read straight from the core supplier record (never the
 * per-stage `prelim_*`/`parking_*` copies), so nothing appears twice. Used as
 * the Completed detail's main "Overview" so a reader can identify and contact
 * the supplier without hunting through five per-stage tabs.
 */
export function TabCompletedOverview({ supplier }: { supplier: TrackerSupplier }) {
  const yesNo = (v: boolean) => (
    <Badge bg={v ? '#6ABF4B26' : `${BRAND_COLORS.sidebar}26`} text={v ? '#6ABF4B' : BRAND_COLORS.sidebar} label={v ? 'Yes' : 'No'} />
  );
  const address = [supplier.manufacturingAddress, supplier.country].filter(Boolean).join(', ');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
      {/* Identity */}
      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
        <SectionTitle title="Identity" />
        <InfoRow label="Legal name" value={supplier.fullName || supplier.name} />
        <InfoRow label="Folio" value={supplier.folio} />
        <InfoRow label="Commodity" value={supplier.commodity} />
        <InfoRow label="Product type" value={supplier.productType} />
        <InfoRow label="Company type" value={supplier.companyType} />
        <InfoRow label="Founded year" value={supplier.foundedYear || '—'} />
        <InfoRow label="DUNS number" value={supplier.dunsNumber} />
        <InfoRow label="Tax ID" value={supplier.taxIdNumber ?? '—'} />
      </div>

      {/* Contact */}
      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
        <SectionTitle title="Contact" />
        <InfoRow label="Main contact" value={supplier.contactName} />
        <InfoRow label="Email" value={supplier.contactEmail} />
        <InfoRow label="Phone" value={supplier.phone} />
        <InfoRow
          label="Website"
          value={supplier.website
            ? <a href={supplier.website} target="_blank" rel="noreferrer" style={{ color: '#02B3E1', textDecoration: 'none' }}>{supplier.website}</a>
            : '—'}
        />
        <InfoRow label="Headquarters" value={supplier.headquarters} />
        <InfoRow label="Manufacturing address" value={address || '—'} />
        <InfoRow label="Assigned buyer" value={supplier.buyer} />
      </div>

      {/* Capabilities */}
      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
        <SectionTitle title="Capabilities" />
        <InfoRow label="Main technology" value={supplier.technology} />
        <InfoRow label="Process method" value={supplier.processMethod} />
        <InfoRow label="Materials" value={supplier.materials} />
        <InfoRow label="Certifications" value={supplier.certifications} />
        <InfoRow label="Safety-critical part" value={yesNo(supplier.safetyCritical)} />
        <InfoRow label="IMMEX" value={supplier.immexStatus ?? '—'} />
        <InfoRow label="Export capability" value={yesNo(supplier.exportCapability)} />
      </div>

      {/* Commercial & outcome */}
      <div className="bg-white" style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: 24 }}>
        <SectionTitle title="Commercial & Outcome" />
        <InfoRow label="Annual revenue" value={supplier.annualRevenue} />
        <InfoRow label="Employees" value={supplier.employees ? supplier.employees.toLocaleString() : '—'} />
        <InfoRow label="Facilities" value={supplier.facilities || '—'} />
        <InfoRow label="Top customers" value={supplier.topCustomers} />
        <InfoRow label="Priority" value={<Badge bg={priorityStyles[supplier.priority].bg} text={priorityStyles[supplier.priority].text} label={`Priority ${supplier.priority}`} />} />
        <InfoRow label="Confidence" value={<Badge bg={confidenceStyles[supplier.confidenceLevel].bg} text={confidenceStyles[supplier.confidenceLevel].text} label={supplier.confidenceLevel} />} />
        <InfoRow label="Selected for development" value={yesNo(supplier.selectedForDevelopment)} />
        <InfoRow label="Entry source" value={supplier.entrySource} />
      </div>
    </div>
  );
}
