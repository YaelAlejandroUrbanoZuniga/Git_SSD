import { useEffect, useState } from 'react';
import { CatalogSelect } from '../../../components/CatalogSelect';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { useToast } from '../../../context/ToastContext';
import {
  BUSINESS_SECTORS, COMMODITIES, COMPANY_TYPES, CONTACT_CHANNELS, COUNTRIES,
  EMPLOYEE_RANGES, IMMEX_ANSWERS, MARKET_FOCUS, PENDING_GSM_COMMODITY,
  PRESENCE_REGIONS, TOOLING_DESIGN_CAPABILITY, YES_NO_WORDS,
} from '../../../constants/catalogs';
import {
  CERTIFICATIONS, COMPLEMENTARY_OPERATIONS, CURRENCIES, MANUFACTURING_PROCESSES,
  MATERIALS, PRESS_CAPACITY_UNITS, RAW_MATERIAL_INDICES, TECHNOLOGIES,
  TYPICAL_APPLICATIONS,
} from '../../../constants/catalogs-pending-gsm';
import { getScoutingEvents } from '../../../services/eventsService';
import { addSupplierNote, registerSupplierForEvent } from '../../../services/suppliersService';
import { ApiError } from '../../../services/api.config';
import type { ScoutingEvent } from '../../../types';
import {
  BackButton, Field, FormFooter, Grid, IndirectExit, MultiSelectWithOther, ProgressBar,
  QtyUnit, RadioGroup, SectionHeading, SelectWithOther, TextArea, TextInput,
  YearSelect, inputStyle,
} from './FormShell';
import {
  compact, employeesFromRange, isValidDuns, isValidEmail, isValidUrl,
  joinListWithOther, resolveOther, unmappedNote,
} from './payload';

// Formulario A — External Registration (Propuesta_Formularios_Proveedores_v2.pdf
// + GSM adjustments 2026-07-17). The supplier registers itself; enters the
// tracker in Stage = Scouting Event. 7 sections (Compliance & manufacturing is
// a dedicated final step before confirmation).

const SECTIONS = [
  'Product filter',
  'Event',
  'Company identity',
  'Main contact',
  'Product',
  'Technical & commercial profile',
  'Compliance & manufacturing',
];

interface FormA {
  // §0 filter
  productCategory: string;
  // §1 event
  event: string;
  // §2 company identity
  companyName: string;
  country: string;
  cityAddress: string;
  website: string;
  contactChannel: string;
  taxId: string;
  // §3 contact
  contactName: string;
  contactEmail: string;
  phone: string;
  // §4 product
  productType: string;
  commodity: string;
  manufacturingProcess: string;
  businessSector: string;
  firstContact: string;
  // §5 profile
  duns: string;
  generalManager: string;
  companyType: string;
  foundedYear: string;
  headquarters: string;
  manufacturingAddress: string;
  presence: string[];
  yearsInMexico: string;
  facilities: string;
  employeesRange: string;
  annualRevenueAmount: string;
  annualRevenueCurrency: string;
  productionVolume: string;
  technology: string;
  pressCapacityAmount: string;
  pressCapacityUnit: string;
  marketFocus: string;
  marketFocusPct: string;
  topCustomers: string;
  exportLocalPct: string;
  exportCountries: string;
  // §6 compliance & manufacturing
  certifications: string[];
  immex: string;
  machineryType: string;
  processMethod: string;
  complementaryOperations: string[];
  toolingDesign: string;
  materials: string[];
  rawMaterialIndex: string;
  typicalApplications: string;
}

const EMPTY: FormA = {
  productCategory: '', event: '', companyName: '', country: '', cityAddress: '',
  website: '', contactChannel: '', taxId: '', contactName: '', contactEmail: '',
  phone: '', productType: '', commodity: '', manufacturingProcess: '', businessSector: '',
  firstContact: '', duns: '', generalManager: '', companyType: '', foundedYear: '',
  headquarters: '', manufacturingAddress: '', presence: [], yearsInMexico: '',
  facilities: '', employeesRange: '', annualRevenueAmount: '', annualRevenueCurrency: '',
  productionVolume: '', technology: '', pressCapacityAmount: '', pressCapacityUnit: '',
  marketFocus: '', marketFocusPct: '', topCustomers: '', exportLocalPct: '',
  exportCountries: '', certifications: [], immex: '', machineryType: '', processMethod: '',
  complementaryOperations: [], toolingDesign: '', materials: [], rawMaterialIndex: '',
  typicalApplications: '',
};

const PENDING_HINT = 'Placeholder list — pending confirmation with GSM.';

export function ExternalRegistrationForm({
  onBack, onClose, onCreated,
}: { onBack: () => void; onClose: () => void; onCreated: () => void }) {
  const [section, setSection] = useState(0);
  const [f, setF] = useState<FormA>(EMPTY);
  const [otherText, setOtherText] = useState<Record<string, string>>({});
  const [indirectExit, setIndirectExit] = useState(false);
  const [events, setEvents] = useState<ScoutingEvent[]>([]);
  const [eventsFailed, setEventsFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const set = <K extends keyof FormA>(key: K) => (value: FormA[K]) =>
    setF(prev => ({ ...prev, [key]: value }));
  const setOther = (key: string) => (v: string) =>
    setOtherText(prev => ({ ...prev, [key]: v }));

  // Real events from the API — the spec requires the list of active events.
  useEffect(() => {
    let cancelled = false;
    getScoutingEvents()
      .then(list => { if (!cancelled) setEvents(list); })
      .catch(err => {
        if (cancelled) return;
        setEventsFailed(true);
        toast.systemError(
          err instanceof ApiError ? err.message : 'Could not load the list of scouting events.',
        );
      });
    return () => { cancelled = true; };
  }, [toast]);

  // Selecting "Indirect" no longer exits — only pressing Next does (see goNext).
  if (indirectExit) {
    return <IndirectExit onClose={onClose} onBack={() => setIndirectExit(false)} />;
  }

  function validateSection(): string[] {
    switch (section) {
      case 0:
        return f.productCategory ? [] : ['Direct or Indirect'];
      case 1:
        return f.event ? [] : ['Scouting event'];
      case 2: {
        const missing = [
          ...(f.companyName.trim() ? [] : ['Company name']),
          ...(f.country ? [] : ['Country']),
        ];
        if (!isValidUrl(f.website)) missing.push('Website (must be a valid URL)');
        return missing;
      }
      case 3: {
        const missing = f.contactName.trim() ? [] : ['Contact name'];
        if (!f.contactEmail.trim()) missing.push('Contact email');
        else if (!isValidEmail(f.contactEmail)) missing.push('Contact email (invalid format)');
        return missing;
      }
      case 4:
        // In Scouting Event the supplier only describes what it makes (Type of
        // Products, free text). Commodity is NOT defined here — GSM assigns it at
        // Parking Lot — so it is optional and defaults to PENDING_GSM_COMMODITY.
        return f.productType.trim() ? [] : ['Type of Products'];
      case 5:
        return isValidDuns(f.duns) ? [] : ['DUNS number (must be exactly 9 digits)'];
      default:
        return [];
    }
  }

  function goNext() {
    // Indirect is a filter exit — reached only here, on Next.
    if (section === 0 && f.productCategory === 'Indirect') {
      setIndirectExit(true);
      return;
    }
    const missing = validateSection();
    if (missing.length > 0) {
      toast.validationError(
        'Missing required information',
        missing.length === 1
          ? `"${missing[0]}" is required to continue.`
          : `Check these fields: ${missing.map(m => `"${m}"`).join(', ')}.`,
      );
      return;
    }
    if (section === SECTIONS.length - 1) setConfirming(true);
    else setSection(s => s + 1);
  }

  async function handleCreate() {
    setConfirming(false);

    // The supplier is registered *through* the selected event so the junction
    // row is created too. Section 1's validation already requires f.event, so
    // this should always resolve — bail loudly rather than silently otherwise.
    const event = events.find(e => e.name === f.event);
    if (!event) {
      toast.validationError(
        'Select a scouting event',
        'A supplier registered through External Registration must be linked to an event. Pick one and try again.',
      );
      return;
    }

    setBusy(true);

    const immex = IMMEX_ANSWERS.find(a => a.label === f.immex);
    // Top-level `exportCapability` is a boolean on the wire (the mapper reads
    // the column as `=== 'true'`), so the detail — % local and destinations —
    // only survives in the Preliminary satellite, which stores it as text.
    const exportDetail = [
      f.exportLocalPct.trim() ? `${f.exportLocalPct.trim()}% local` : '',
      f.exportCountries.trim() ? `to: ${f.exportCountries.trim()}` : '',
    ].filter(Boolean).join(' — ');
    const hasExport = exportDetail.length > 0;

    // Amount + unit fields are joined into their single NVarChar column.
    const pressCapacity = f.pressCapacityAmount.trim()
      ? `${f.pressCapacityAmount.trim()}${f.pressCapacityUnit ? ` ${f.pressCapacityUnit}` : ''}`
      : '';
    const annualRevenue = f.annualRevenueAmount.trim()
      ? `${f.annualRevenueAmount.trim()}${f.annualRevenueCurrency ? ` ${f.annualRevenueCurrency}` : ''}`
      : '';

    // "Other" selects/multi-selects → their specified text.
    const country = resolveOther(f.country, otherText.country ?? '');
    const manufacturingProcess = resolveOther(f.manufacturingProcess, otherText.manufacturingProcess ?? '');
    const technology = resolveOther(f.technology, otherText.technology ?? '');
    const rawMaterialIndex = resolveOther(f.rawMaterialIndex, otherText.rawMaterialIndex ?? '');
    const typicalApplications = resolveOther(f.typicalApplications, otherText.typicalApplications ?? '');
    const certifications = joinListWithOther(f.certifications, otherText.certifications ?? '');
    const complementaryOperations = joinListWithOther(f.complementaryOperations, otherText.complementaryOperations ?? '');
    const materials = joinListWithOther(f.materials, otherText.materials ?? '');
    const presence = joinListWithOther(f.presence, otherText.presence ?? '');
    const marketFocusBase = resolveOther(f.marketFocus, otherText.marketFocus ?? '');
    const marketFocus = f.marketFocus === 'Mixed' && f.marketFocusPct.trim()
      ? `${marketFocusBase} (${f.marketFocusPct.trim()}% automotive)`
      : marketFocusBase;

    // `entrySource` and `scoutingInput` are intentionally omitted — the backend
    // derives both from the event record when the supplier is created through it.
    const core = {
      name: f.companyName.trim().toUpperCase(),
      fullName: f.companyName.trim(),
      // "Type of Products" — the free-text description captured in Scouting Event.
      productType: f.productType.trim(),
      // Commodity is optional here; when GSM has not defined one it is the pending
      // placeholder, replaced with a real commodity at Parking Lot.
      commodity: f.commodity || PENDING_GSM_COMMODITY,
      productCategory: 'Direct' as const,
      country,
      manufacturingAddress: f.manufacturingAddress.trim(),
      dunsNumber: f.duns.trim(),
      website: f.website.trim(),
      phone: f.phone.trim(),
      contactEmail: f.contactEmail.trim(),
      contactName: f.contactName.trim(),
    };

    // §5/§6 are written twice: to the flat CompanyInfo/TechnicalInfo/
    // CommercialInfo columns (shown at any stage) and to the Preliminary
    // satellite (`prelim_*`), where the spec says these answers resurface and
    // which is the only home for the fields with no flat column.
    const profile = compact({
      taxIdNumber: f.taxId.trim(),
      companyType: f.companyType,
      foundedYear: f.foundedYear ? Number(f.foundedYear) : undefined,
      headquarters: f.headquarters.trim(),
      // Q13 (closed catalog) owns ProcessMethod; Q36 free text → prelim_processingMethod.
      processMethod: manufacturingProcess,
      technology,
      machineryType: f.machineryType.trim(),
      pressCapacity,
      materials,
      complementaryOperations,
      certifications,
      employees: employeesFromRange(f.employeesRange),
      facilities: f.facilities ? Number(f.facilities) : undefined,
      topCustomers: f.topCustomers.trim(),
      annualRevenue,
      productionVolume: f.productionVolume.trim(),
      exportCapability: hasExport,
      ...(immex ? { hasIMMEX: immex.hasIMMEX, planIMMEX: immex.planIMMEX } : {}),

      prelim_companyName: f.companyName.trim(),
      prelim_dunsNumber: f.duns.trim(),
      prelim_generalManager: f.generalManager.trim(),
      prelim_companyType: f.companyType,
      prelim_foundedYear: f.foundedYear ? Number(f.foundedYear) : undefined,
      prelim_hqAddress: f.headquarters.trim(),
      prelim_hqCity: f.cityAddress.trim(),
      prelim_hqCountry: country,
      prelim_manufacturingAddress: f.manufacturingAddress.trim(),
      prelim_footprint: presence,
      prelim_yearsInMexico: f.yearsInMexico ? Number(f.yearsInMexico) : undefined,
      prelim_facilities: f.facilities ? Number(f.facilities) : undefined,
      prelim_employees: employeesFromRange(f.employeesRange),
      prelim_annualRevenue: annualRevenue,
      prelim_productionVolume: f.productionVolume.trim(),
      prelim_mainTechnology: technology,
      prelim_pressCapacity: pressCapacity,
      prelim_market: marketFocus,
      prelim_topCustomers: f.topCustomers.trim(),
      prelim_exportCapability: exportDetail,
      prelim_certifications: certifications,
      prelim_machineryType: f.machineryType.trim(),
      prelim_processingMethod: f.processMethod.trim(),
      prelim_complementaryOps: complementaryOperations,
      prelim_toolingDesign: f.toolingDesign,
      prelim_materials: materials,
      prelim_rawMaterialIndex: rawMaterialIndex,
      prelim_applications: typicalApplications,
      prelim_commodity: f.commodity,
      prelim_scoutingInput: f.event,
    });

    // Questions with nowhere to live in the schema — captured as a note.
    const unmapped = {
      'How did you hear about Nexteer?': resolveOther(f.contactChannel, otherText.contactChannel ?? ''),
      'Business sector': resolveOther(f.businessSector, otherText.businessSector ?? ''),
      'First contact with Nexteer': f.firstContact,
    };

    try {
      const created = await registerSupplierForEvent(event.id, core, profile);

      const note = unmappedNote('External registration', unmapped);
      if (note) {
        await addSupplierNote(created.id, note).catch(() => {
          toast.warning(
            `${created.folio} was created`,
            'Some answers could not be attached as a note. They are listed in the form spec as fields with no column yet.',
          );
        });
      }

      toast.success(
        `${created.name} added to Scouting Event`,
        `Registered as ${created.folio}${f.event ? ` from "${f.event}"` : ''}.`,
      );
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.isPermissionDenied) toast.permissionError();
      else if (err instanceof ApiError && err.isUserFixable) {
        toast.validationError('The server rejected this registration', err.message);
      } else {
        toast.systemError(
          err instanceof ApiError ? err.message : 'The supplier could not be registered.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <BackButton onBack={section === 0 ? onBack : () => setSection(s => s - 1)} />

      <ProgressBar step={section} total={SECTIONS.length} label={SECTIONS[section]} />

      {section === 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeading
            title="Entry filter"
            note="SSD only manages Direct product suppliers. Choosing Indirect ends the form."
          />
          <Field label="Does your company produce Direct product (parts that go in the vehicle) or Indirect (services, MRO, consumables)?" required>
            <RadioGroup
              options={['Direct', 'Indirect']}
              value={f.productCategory}
              onChange={set('productCategory')}
            />
          </Field>
        </div>
      )}

      {section === 1 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeading title="Event" />
          <Field
            label="Which Scouting Event are you registering for?"
            required
            hint={eventsFailed ? 'The event list could not be loaded from the server.' : undefined}
          >
            <CatalogSelect
              value={f.event}
              onChange={set('event')}
              options={events.map(e => e.name)}
              placeholder={events.length === 0 ? 'No active events available' : 'Select event'}
            />
          </Field>
        </div>
      )}

      {section === 2 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeading title="Company identity" />
          <Field label="Company name" required>
            <TextInput value={f.companyName} onChange={set('companyName')} placeholder="e.g. BOSCH México S.A. de C.V." />
          </Field>
          <Grid>
            <Field label="Country" required>
              <SelectWithOther
                value={f.country} onChange={set('country')} options={COUNTRIES}
                placeholder="Select country"
                otherText={otherText.country ?? ''} onOtherText={setOther('country')}
              />
            </Field>
            <Field label="City / address">
              <TextInput value={f.cityAddress} onChange={set('cityAddress')} placeholder="e.g. Querétaro, Av. 5 de Febrero 1200" />
            </Field>
          </Grid>
          <Field label="Website">
            <TextInput value={f.website} onChange={set('website')} placeholder="e.g. https://bosch.com" />
          </Field>
          <Field label="How did you hear about Nexteer?">
            <SelectWithOther
              value={f.contactChannel} onChange={set('contactChannel')} options={CONTACT_CHANNELS}
              placeholder="Select"
              otherText={otherText.contactChannel ?? ''} onOtherText={setOther('contactChannel')}
            />
          </Field>
          <Field label="RFC (Mexico) or Tax ID / W9 (other countries)">
            <TextInput value={f.taxId} onChange={set('taxId')} placeholder="e.g. BOS950101AB1" />
          </Field>
        </div>
      )}

      {section === 3 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeading title="Main contact" />
          <Field label="Contact name" required>
            <TextInput value={f.contactName} onChange={set('contactName')} />
          </Field>
          <Field label="Contact email" required>
            <TextInput type="email" value={f.contactEmail} onChange={set('contactEmail')} placeholder="name@company.com" />
          </Field>
          <Field label="Contact phone" hint="Include the country code, e.g. +52 442 123 4567.">
            <TextInput type="tel" value={f.phone} onChange={set('phone')} />
          </Field>
        </div>
      )}

      {section === 4 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeading
            title="Product"
            note="In Scouting Event you only describe what you make. The commodity is assigned by GSM later, when the supplier reaches Parking Lot."
          />
          <Field label="Type of Products" required hint="Describe the products your company manufactures — free text.">
            <TextArea
              value={f.productType} onChange={set('productType')} rows={2}
              placeholder="e.g. Stamped brackets and welded sub-assemblies for chassis"
            />
          </Field>
          <Field label="Commodity" hint="Optional — leave blank if not defined yet; GSM assigns it at Parking Lot.">
            <CatalogSelect value={f.commodity} onChange={set('commodity')} options={COMMODITIES} placeholder="Select commodity (optional)" />
          </Field>
          <Field label="Main manufacturing process" hint={PENDING_HINT}>
            <SelectWithOther
              value={f.manufacturingProcess} onChange={set('manufacturingProcess')} options={MANUFACTURING_PROCESSES}
              placeholder="Select process"
              otherText={otherText.manufacturingProcess ?? ''} onOtherText={setOther('manufacturingProcess')}
            />
          </Field>
          <Field label="Business sector">
            <SelectWithOther
              value={f.businessSector} onChange={set('businessSector')} options={BUSINESS_SECTORS}
              placeholder="Select sector"
              otherText={otherText.businessSector ?? ''} onOtherText={setOther('businessSector')}
            />
          </Field>
          <Field label="Is this your first contact with Nexteer?">
            <CatalogSelect value={f.firstContact} onChange={set('firstContact')} options={YES_NO_WORDS} />
          </Field>
        </div>
      )}

      {section === 5 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeading
            title="Technical & commercial profile"
            note="These answers are confirmed — not asked again — when the supplier reaches Preliminary Evaluation."
          />

          <Grid>
            <Field label="DUNS number" hint="9 digits.">
              <TextInput value={f.duns} onChange={set('duns')} placeholder="123456789" />
            </Field>
            <Field label="General Manager name">
              <TextInput value={f.generalManager} onChange={set('generalManager')} />
            </Field>
            <Field label="Company type">
              <CatalogSelect value={f.companyType} onChange={set('companyType')} options={COMPANY_TYPES} placeholder="Select type" />
            </Field>
            <Field label="Year founded">
              <YearSelect value={f.foundedYear} onChange={set('foundedYear')} />
            </Field>
          </Grid>

          <Field label="Headquarters address / city / country">
            <TextInput value={f.headquarters} onChange={set('headquarters')} />
          </Field>
          <Field label="Manufacturing address / city / country">
            <TextInput value={f.manufacturingAddress} onChange={set('manufacturingAddress')} />
          </Field>
          <Field label="Presence in">
            <MultiSelectWithOther
              options={PRESENCE_REGIONS} selected={f.presence} onChange={set('presence')}
              otherText={otherText.presence ?? ''} onOtherText={setOther('presence')}
            />
          </Field>

          <Grid>
            <Field label="Years operating in Mexico">
              <TextInput type="number" value={f.yearsInMexico} onChange={set('yearsInMexico')} />
            </Field>
            <Field label="Number of facilities">
              <TextInput type="number" value={f.facilities} onChange={set('facilities')} />
            </Field>
            <Field label="Number of employees">
              <CatalogSelect value={f.employeesRange} onChange={set('employeesRange')} options={EMPLOYEE_RANGES.map(r => r.label)} placeholder="Select range" />
            </Field>
            <Field label="Press capacity" hint={`Unit ${PENDING_HINT.toLowerCase()}`}>
              <QtyUnit
                amount={f.pressCapacityAmount} onAmount={set('pressCapacityAmount')}
                unit={f.pressCapacityUnit} onUnit={set('pressCapacityUnit')}
                units={PRESS_CAPACITY_UNITS} amountPlaceholder="e.g. 500"
              />
            </Field>
          </Grid>

          <Field label="Annual revenue by region" hint="Amount and currency — add regions in the amount if needed, e.g. “120M (Mexico)”.">
            <QtyUnit
              amount={f.annualRevenueAmount} onAmount={set('annualRevenueAmount')}
              unit={f.annualRevenueCurrency} onUnit={set('annualRevenueCurrency')}
              units={CURRENCIES} amountPlaceholder="e.g. 120000000"
            />
          </Field>
          <Field label="Production volume by region" hint="Region and volume — e.g. “Mexico 2.4M pcs/yr”.">
            <TextInput value={f.productionVolume} onChange={set('productionVolume')} />
          </Field>

          <Field label="Main technology" hint={PENDING_HINT}>
            <SelectWithOther
              value={f.technology} onChange={set('technology')} options={TECHNOLOGIES}
              placeholder="Select technology"
              otherText={otherText.technology ?? ''} onOtherText={setOther('technology')}
            />
          </Field>

          <Grid>
            <Field label="Market focus">
              <SelectWithOther
                value={f.marketFocus} onChange={set('marketFocus')} options={MARKET_FOCUS}
                placeholder="Select focus"
                otherText={otherText.marketFocus ?? ''} onOtherText={setOther('marketFocus')}
              />
            </Field>
            <Field label="% automotive" hint={f.marketFocus === 'Mixed' ? undefined : 'Only for a mixed focus.'}>
              <input
                type="number" min={0} max={100}
                value={f.marketFocusPct}
                onChange={e => set('marketFocusPct')(e.target.value)}
                disabled={f.marketFocus !== 'Mixed'}
                style={{ ...inputStyle, opacity: f.marketFocus === 'Mixed' ? 1 : 0.45 }}
              />
            </Field>
          </Grid>

          <Field label="Main customers">
            <TextArea value={f.topCustomers} onChange={set('topCustomers')} rows={2} placeholder="e.g. GM, Ford, Stellantis" />
          </Field>

          <Grid>
            <Field label="Export capability — % local content">
              <TextInput type="number" value={f.exportLocalPct} onChange={set('exportLocalPct')} />
            </Field>
            <Field label="Export capability — destination countries">
              <TextInput value={f.exportCountries} onChange={set('exportCountries')} placeholder="e.g. US, Canada, Germany" />
            </Field>
          </Grid>

          <Field label="Tooling design capability">
            <CatalogSelect value={f.toolingDesign} onChange={set('toolingDesign')} options={TOOLING_DESIGN_CAPABILITY} placeholder="Select" />
          </Field>
          <Field label="Materials handled" hint={PENDING_HINT}>
            <MultiSelectWithOther
              options={MATERIALS} selected={f.materials} onChange={set('materials')}
              otherText={otherText.materials ?? ''} onOtherText={setOther('materials')}
            />
          </Field>
          <Field label="Raw material reference index" hint={PENDING_HINT}>
            <SelectWithOther
              value={f.rawMaterialIndex} onChange={set('rawMaterialIndex')} options={RAW_MATERIAL_INDICES}
              placeholder="Select index"
              otherText={otherText.rawMaterialIndex ?? ''} onOtherText={setOther('rawMaterialIndex')}
            />
          </Field>
          <Field label="Typical applications" hint={PENDING_HINT}>
            <SelectWithOther
              value={f.typicalApplications} onChange={set('typicalApplications')} options={TYPICAL_APPLICATIONS}
              placeholder="Select"
              otherText={otherText.typicalApplications ?? ''} onOtherText={setOther('typicalApplications')}
            />
          </Field>
        </div>
      )}

      {section === 6 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeading
            title="Compliance & manufacturing"
            note="If any of these is marked as not held, this record will be flagged for GSM validation before continuing in the flow."
          />

          <Field label="Certifications" hint={PENDING_HINT}>
            <MultiSelectWithOther
              options={CERTIFICATIONS} selected={f.certifications} onChange={set('certifications')}
              otherText={otherText.certifications ?? ''} onOtherText={setOther('certifications')}
            />
          </Field>
          <Field label="IMMEX certification">
            <CatalogSelect value={f.immex} onChange={set('immex')} options={IMMEX_ANSWERS.map(a => a.label)} placeholder="Select" />
          </Field>

          <Field label="Machinery type" hint="Examples depend on the commodity selected.">
            <TextInput value={f.machineryType} onChange={set('machineryType')} />
          </Field>
          <Field label="Processing method" hint="Examples depend on the commodity selected.">
            <TextInput value={f.processMethod} onChange={set('processMethod')} />
          </Field>
          <Field label="Complementary operations" hint={PENDING_HINT}>
            <MultiSelectWithOther
              options={COMPLEMENTARY_OPERATIONS} selected={f.complementaryOperations} onChange={set('complementaryOperations')}
              otherText={otherText.complementaryOperations ?? ''} onOtherText={setOther('complementaryOperations')}
            />
          </Field>
        </div>
      )}

      <FormFooter
        onBack={section === 0 ? undefined : () => setSection(s => s - 1)}
        onNext={goNext}
        nextLabel={section === SECTIONS.length - 1 ? 'Register supplier →' : 'Next →'}
        busy={busy}
      />

      {confirming && (
        <ConfirmDialog
          title="Register this supplier?"
          message={
            <>
              This creates <strong style={{ color: '#000000' }}>{f.companyName.trim()}</strong> in
              the database, in <strong style={{ color: '#000000' }}>Scouting Event</strong>.
            </>
          }
          confirmLabel="Register supplier"
          onCancel={() => setConfirming(false)}
          onConfirm={handleCreate}
        />
      )}
    </>
  );
}
