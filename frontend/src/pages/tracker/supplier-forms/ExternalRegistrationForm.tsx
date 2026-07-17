import { useEffect, useState } from 'react';
import { CatalogSelect } from '../../../components/CatalogSelect';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { useToast } from '../../../context/ToastContext';
import {
  BUSINESS_SECTORS, COMMODITIES, COMPANY_TYPES, COUNTRIES, IMMEX_ANSWERS,
  MARKET_FOCUS, PRESENCE_REGIONS, TOOLING_DESIGN_CAPABILITY, YES_NO_WORDS,
} from '../../../constants/catalogs';
import {
  CERTIFICATIONS, COMPLEMENTARY_OPERATIONS, EMPLOYEE_RANGES, MANUFACTURING_PROCESSES,
  MATERIALS, NEXTEER_CONTACT_LOCATIONS, PRESS_CAPACITY_RANGES, RAW_MATERIAL_INDICES,
  TECHNOLOGIES, TYPICAL_APPLICATIONS,
} from '../../../constants/catalogs-pending-gsm';
import { getScoutingEvents } from '../../../services/eventsService';
import { addSupplierNote, registerSupplier } from '../../../services/suppliersService';
import { ApiError } from '../../../services/api.config';
import type { ScoutingEvent } from '../../../types';
import {
  BackButton, Field, FormFooter, Grid, IndirectExit, MultiSelect, ProgressBar,
  RadioGroup, SectionHeading, TextArea, TextInput, YearSelect, inputStyle,
} from './FormShell';
import {
  compact, employeesFromRange, isValidDuns, isValidEmail, isValidUrl, joinList,
  unmappedNote,
} from './payload';

// Formulario A — External Registration (Propuesta_Formularios_Proveedores_v2.pdf).
// The supplier registers itself, at a scouting event or directly. 41 questions
// across 6 sections; enters the pipeline in Stage = Scouting Event.

const SECTIONS = [
  'Product filter',
  'Event',
  'Company identity',
  'Main contact',
  'Product',
  'Technical & commercial profile',
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
  contactLocation: string;
  taxId: string;
  // §3 contact
  contactName: string;
  contactEmail: string;
  phone: string;
  // §4 product
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
  annualRevenue: string;
  productionVolume: string;
  technology: string;
  pressCapacity: string;
  marketFocus: string;
  marketFocusPct: string;
  topCustomers: string;
  exportLocalPct: string;
  exportCountries: string;
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
  website: '', contactLocation: '', taxId: '', contactName: '', contactEmail: '',
  phone: '', commodity: '', manufacturingProcess: '', businessSector: '',
  firstContact: '', duns: '', generalManager: '', companyType: '', foundedYear: '',
  headquarters: '', manufacturingAddress: '', presence: [], yearsInMexico: '',
  facilities: '', employeesRange: '', annualRevenue: '', productionVolume: '',
  technology: '', pressCapacity: '', marketFocus: '', marketFocusPct: '',
  topCustomers: '', exportLocalPct: '', exportCountries: '', certifications: [],
  immex: '', machineryType: '', processMethod: '', complementaryOperations: [],
  toolingDesign: '', materials: [], rawMaterialIndex: '', typicalApplications: '',
};

const PENDING_HINT = 'Placeholder list — pending confirmation with GSM.';

export function ExternalRegistrationForm({
  onBack, onClose, onCreated,
}: { onBack: () => void; onClose: () => void; onCreated: () => void }) {
  const [section, setSection] = useState(0);
  const [f, setF] = useState<FormA>(EMPTY);
  const [events, setEvents] = useState<ScoutingEvent[]>([]);
  const [eventsFailed, setEventsFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const set = <K extends keyof FormA>(key: K) => (value: FormA[K]) =>
    setF(prev => ({ ...prev, [key]: value }));

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

  if (f.productCategory === 'Indirect') {
    return <IndirectExit onClose={onClose} onBack={() => set('productCategory')('')} />;
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
        return f.commodity ? [] : ['Commodity'];
      case 5:
        return isValidDuns(f.duns) ? [] : ['DUNS number (must be exactly 9 digits)'];
      default:
        return [];
    }
  }

  function goNext() {
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

    const core = {
      name: f.companyName.trim().toUpperCase(),
      fullName: f.companyName.trim(),
      commodity: f.commodity,
      entrySource: 'Scouting Event' as const,
      productCategory: 'Direct' as const,
      country: f.country,
      manufacturingAddress: f.manufacturingAddress.trim(),
      scoutingInput: f.event,
      dunsNumber: f.duns.trim(),
      website: f.website.trim(),
      phone: f.phone.trim(),
      contactEmail: f.contactEmail.trim(),
      contactName: f.contactName.trim(),
    };

    const marketFocus = f.marketFocus === 'Mixed' && f.marketFocusPct.trim()
      ? `${f.marketFocus} (${f.marketFocusPct.trim()}% automotive)`
      : f.marketFocus;

    // §5 is written twice on purpose, to the two places that read it:
    //  • the flat CompanyInfo/TechnicalInfo/CommercialInfo columns, which the
    //    supplier detail shows at any stage;
    //  • the Preliminary satellite (`prelim_*`), which is where the spec says
    //    these answers resurface — "no se vuelven a preguntar ahí, solo se
    //    confirman". It is also the only home for the eight §5 questions that
    //    have no flat column (general manager, footprint, years in Mexico,
    //    market, processing method, tooling design, raw material index,
    //    applications) and for the export-capability detail text.
    const profile = compact({
      taxIdNumber: f.taxId.trim(),
      companyType: f.companyType,
      foundedYear: f.foundedYear ? Number(f.foundedYear) : undefined,
      headquarters: f.headquarters.trim(),
      // Q13 (closed catalog) owns ProcessMethod; Q36 is free text and lives in
      // the Preliminary satellite as `processingMethod`.
      processMethod: f.manufacturingProcess,
      technology: f.technology,
      machineryType: f.machineryType.trim(),
      pressCapacity: f.pressCapacity,
      materials: joinList(f.materials),
      complementaryOperations: joinList(f.complementaryOperations),
      certifications: joinList(f.certifications),
      employees: employeesFromRange(f.employeesRange),
      facilities: f.facilities ? Number(f.facilities) : undefined,
      topCustomers: f.topCustomers.trim(),
      annualRevenue: f.annualRevenue.trim(),
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
      prelim_hqCountry: f.country,
      prelim_manufacturingAddress: f.manufacturingAddress.trim(),
      prelim_footprint: joinList(f.presence),
      prelim_yearsInMexico: f.yearsInMexico ? Number(f.yearsInMexico) : undefined,
      prelim_facilities: f.facilities ? Number(f.facilities) : undefined,
      prelim_employees: employeesFromRange(f.employeesRange),
      prelim_annualRevenue: f.annualRevenue.trim(),
      prelim_productionVolume: f.productionVolume.trim(),
      prelim_mainTechnology: f.technology,
      prelim_pressCapacity: f.pressCapacity,
      prelim_market: marketFocus,
      prelim_topCustomers: f.topCustomers.trim(),
      prelim_exportCapability: exportDetail,
      prelim_certifications: joinList(f.certifications),
      prelim_machineryType: f.machineryType.trim(),
      prelim_processingMethod: f.processMethod.trim(),
      prelim_complementaryOps: joinList(f.complementaryOperations),
      prelim_toolingDesign: f.toolingDesign,
      prelim_materials: joinList(f.materials),
      prelim_rawMaterialIndex: f.rawMaterialIndex,
      prelim_applications: f.typicalApplications,
      prelim_commodity: f.commodity,
      prelim_scoutingInput: f.event,
    });

    // The three questions with nowhere to live in the schema. Captured as a
    // note rather than dropped; see backend/README.md for the full list.
    const unmapped = {
      'Where are you contacting us from (Nexteer plant/region)': f.contactLocation,
      'Business sector': f.businessSector,
      'First contact with Nexteer': f.firstContact,
    };

    try {
      const created = await registerSupplier(core, profile);

      // The answers with no column go in as a note rather than being dropped.
      // Non-fatal: the supplier already exists and is the point of the form.
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
      if (err instanceof ApiError && err.isUserFixable) {
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
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#000000', margin: '0 0 4px' }}>
        External Registration
      </h2>
      <p style={{ fontSize: 13, color: '#808285', margin: '0 0 20px' }}>
        The supplier registers itself — enters the pipeline in Scouting Event.
      </p>

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
              <CatalogSelect value={f.country} onChange={set('country')} options={COUNTRIES} placeholder="Select country" />
            </Field>
            <Field label="City / address">
              <TextInput value={f.cityAddress} onChange={set('cityAddress')} placeholder="e.g. Querétaro, Av. 5 de Febrero 1200" />
            </Field>
          </Grid>
          <Field label="Website">
            <TextInput value={f.website} onChange={set('website')} placeholder="e.g. https://bosch.com" />
          </Field>
          <Field label="Where are you contacting us from?" hint={PENDING_HINT}>
            <CatalogSelect value={f.contactLocation} onChange={set('contactLocation')} options={NEXTEER_CONTACT_LOCATIONS} placeholder="Select Nexteer plant / region" />
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
          <SectionHeading title="Product" />
          <Field label="Commodity" required>
            <CatalogSelect value={f.commodity} onChange={set('commodity')} options={COMMODITIES} placeholder="Select commodity" />
          </Field>
          <Field label="Main manufacturing process" hint={PENDING_HINT}>
            <CatalogSelect value={f.manufacturingProcess} onChange={set('manufacturingProcess')} options={MANUFACTURING_PROCESSES} placeholder="Select process" />
          </Field>
          <Field label="Business sector">
            <CatalogSelect value={f.businessSector} onChange={set('businessSector')} options={BUSINESS_SECTORS} placeholder="Select sector" />
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
            <MultiSelect options={PRESENCE_REGIONS} selected={f.presence} onChange={set('presence')} />
          </Field>

          <Grid>
            <Field label="Years operating in Mexico">
              <TextInput type="number" value={f.yearsInMexico} onChange={set('yearsInMexico')} />
            </Field>
            <Field label="Number of facilities">
              <TextInput type="number" value={f.facilities} onChange={set('facilities')} />
            </Field>
            <Field label="Number of employees" hint={PENDING_HINT}>
              <CatalogSelect value={f.employeesRange} onChange={set('employeesRange')} options={EMPLOYEE_RANGES.map(r => r.label)} placeholder="Select range" />
            </Field>
            <Field label="Press capacity" hint={PENDING_HINT}>
              <CatalogSelect value={f.pressCapacity} onChange={set('pressCapacity')} options={PRESS_CAPACITY_RANGES} placeholder="Select range" />
            </Field>
          </Grid>

          <Field label="Annual revenue by region" hint="Region, amount and currency — e.g. “Mexico 120M USD; Europe 40M EUR”.">
            <TextInput value={f.annualRevenue} onChange={set('annualRevenue')} />
          </Field>
          <Field label="Production volume by region" hint="Region and volume — e.g. “Mexico 2.4M pcs/yr”.">
            <TextInput value={f.productionVolume} onChange={set('productionVolume')} />
          </Field>

          <Field label="Main technology" hint={PENDING_HINT}>
            <CatalogSelect value={f.technology} onChange={set('technology')} options={TECHNOLOGIES} placeholder="Select technology" />
          </Field>

          <Grid>
            <Field label="Market focus">
              <CatalogSelect value={f.marketFocus} onChange={set('marketFocus')} options={MARKET_FOCUS} placeholder="Select focus" />
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

          <Field label="Certifications" hint={PENDING_HINT}>
            <MultiSelect options={CERTIFICATIONS} selected={f.certifications} onChange={set('certifications')} />
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
            <MultiSelect options={COMPLEMENTARY_OPERATIONS} selected={f.complementaryOperations} onChange={set('complementaryOperations')} />
          </Field>
          <Field label="Tooling design capability">
            <CatalogSelect value={f.toolingDesign} onChange={set('toolingDesign')} options={TOOLING_DESIGN_CAPABILITY} placeholder="Select" />
          </Field>
          <Field label="Materials handled" hint={PENDING_HINT}>
            <MultiSelect options={MATERIALS} selected={f.materials} onChange={set('materials')} />
          </Field>
          <Field label="Raw material reference index" hint={PENDING_HINT}>
            <CatalogSelect value={f.rawMaterialIndex} onChange={set('rawMaterialIndex')} options={RAW_MATERIAL_INDICES} placeholder="Select index" />
          </Field>
          <Field label="Typical applications" hint={PENDING_HINT}>
            <CatalogSelect value={f.typicalApplications} onChange={set('typicalApplications')} options={TYPICAL_APPLICATIONS} placeholder="Select" />
          </Field>
        </div>
      )}

      <FormFooter
        onCancel={onClose}
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
