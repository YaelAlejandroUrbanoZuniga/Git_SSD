import { useState } from 'react';
import { CatalogSelect } from '../../../components/CatalogSelect';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { useToast } from '../../../context/ToastContext';
import { COMMODITIES, COUNTRIES } from '../../../constants/catalogs';
import { RECOMMENDER_DEPARTMENTS } from '../../../constants/catalogs-pending-gsm';
import { addSupplierNote, registerSupplier } from '../../../services/suppliersService';
import { ApiError } from '../../../services/api.config';
import {
  BackButton, Field, FormFooter, Grid, IndirectExit, ProgressBar, RadioGroup,
  SectionHeading, SelectWithOther, TextInput,
} from './FormShell';
import { compact, isValidDuns, isValidEmail, resolveOther, unmappedNote } from './payload';

// Formulario B — Internal Recommendation (Propuesta_Formularios_Proveedores_v2.pdf).
// A Nexteer employee recommends a supplier they already know. 12 questions
// across 4 sections; enters the tracker directly in Stage = Parking Lot.

const SECTIONS = ['Product filter', 'Recommender', 'Product', 'Company', 'Contacts'];

const AD_HINT = 'Will be auto-filled once Active Directory is connected.';

interface FormB {
  productCategory: string;
  recommendedBy: string;
  supervisor: string;
  department: string;
  commodity: string;
  companyName: string;
  duns: string;
  generalManager: string;
  city: string;
  country: string;
  contact1Name: string;
  contact1Email: string;
  contact2Name: string;
  contact2Email: string;
}

const EMPTY: FormB = {
  productCategory: '', recommendedBy: '', supervisor: '', department: '', commodity: '',
  companyName: '', duns: '', generalManager: '', city: '', country: '',
  contact1Name: '', contact1Email: '', contact2Name: '', contact2Email: '',
};

export function InternalRecommendationForm({
  onBack, onClose, onCreated,
}: { onBack: () => void; onClose: () => void; onCreated: () => void }) {
  const [section, setSection] = useState(0);
  const [f, setF] = useState<FormB>(EMPTY);
  const [otherText, setOtherText] = useState<Record<string, string>>({});
  const [indirectExit, setIndirectExit] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const set = <K extends keyof FormB>(key: K) => (value: FormB[K]) =>
    setF(prev => ({ ...prev, [key]: value }));
  const setOther = (key: string) => (v: string) =>
    setOtherText(prev => ({ ...prev, [key]: v }));

  // Selecting "Indirect" no longer exits — only pressing Next does (see goNext).
  if (indirectExit) {
    return <IndirectExit onClose={onClose} onBack={() => setIndirectExit(false)} />;
  }

  function validateSection(): string[] {
    switch (section) {
      case 0:
        return f.productCategory ? [] : ['Direct or Indirect'];
      case 1:
        return f.recommendedBy.trim() ? [] : ['Who recommends this supplier'];
      case 2:
        return f.commodity ? [] : ['Commodity'];
      case 3: {
        const missing = f.companyName.trim() ? [] : ['Company name'];
        if (!isValidDuns(f.duns)) missing.push('DUNS number (must be exactly 9 digits)');
        return missing;
      }
      case 4: {
        const missing = f.contact1Name.trim() ? [] : ['Contact 1 name'];
        if (!f.contact1Email.trim()) missing.push('Contact 1 email');
        else if (!isValidEmail(f.contact1Email)) missing.push('Contact 1 email (invalid format)');
        if (f.contact2Email.trim() && !isValidEmail(f.contact2Email)) {
          missing.push('Contact 2 email (invalid format)');
        }
        return missing;
      }
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
    setBusy(true);

    const department = resolveOther(f.department, otherText.department ?? '');
    const country = resolveOther(f.country, otherText.country ?? '');

    const core = {
      name: f.companyName.trim().toUpperCase(),
      fullName: f.companyName.trim(),
      commodity: f.commodity,
      entrySource: 'Recommendation' as const,
      productCategory: 'Direct' as const,
      country,
      manufacturingAddress: f.city.trim(),
      recommendedBy: f.recommendedBy.trim(),
      recommenderDept: department,
      dunsNumber: f.duns.trim(),
      contactName: f.contact1Name.trim(),
      contactEmail: f.contact1Email.trim(),
    };

    // Mirrors what the Parking Lot detail tab reads, so a recommended supplier
    // opens with its contact block already populated. The general manager has
    // no flat column — its only home is the Preliminary satellite.
    const profile = compact({
      parkingIsRecommendation: true,
      parkingCompanyName: f.companyName.trim(),
      parkingName1: f.contact1Name.trim(),
      parkingEmail1: f.contact1Email.trim(),
      parkingCommodity: f.commodity,
      parkingManufacturingCountry: country,
      parkingManufacturingAddress: f.city.trim(),
      prelim_generalManager: f.generalManager.trim(),
      prelim_companyName: f.companyName.trim(),
      prelim_dunsNumber: f.duns.trim(),
      prelim_hqCity: f.city.trim(),
      prelim_hqCountry: country,
      prelim_commodity: f.commodity,
    });

    // Fields with no column go in as a note rather than being dropped:
    // the recommender's supervisor (AD not connected yet) and a second contact.
    const unmapped = {
      "Recommender's supervisor / manager": f.supervisor.trim(),
      'Contact 2 — name': f.contact2Name.trim(),
      'Contact 2 — email': f.contact2Email.trim(),
    };

    try {
      const created = await registerSupplier(core, profile);

      const note = unmappedNote('Internal recommendation', unmapped);
      if (note) {
        await addSupplierNote(created.id, note).catch(() => {
          toast.warning(
            `${created.folio} was created`,
            'Some answers could not be attached as a note. They are listed in the form spec as fields with no column yet.',
          );
        });
      }

      toast.success(
        `${created.name} added to Parking Lot`,
        `Registered as ${created.folio}, recommended by ${f.recommendedBy.trim()}.`,
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

      <ProgressBar step={section} total={SECTIONS.length} label={SECTIONS[section]} />

      {section === 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeading
            title="Entry filter"
            note="SSD only manages Direct product suppliers. Choosing Indirect ends the form."
          />
          <Field label="Is the supplier you are recommending Direct or Indirect product?" required>
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
          <SectionHeading title="Who recommends" />
          <Field
            label="Who recommends this supplier?"
            required
            hint="Free text for now — this becomes a directory lookup once Active Directory is connected to this flow."
          >
            <TextInput value={f.recommendedBy} onChange={set('recommendedBy')} placeholder="e.g. Carlos Mendoza" />
          </Field>
          <Field label="Supervisor / Manager" hint={AD_HINT}>
            <TextInput value={f.supervisor} onChange={set('supervisor')} placeholder="e.g. Ana García" />
          </Field>
          <Field label="From which department?" hint="Placeholder list — pending confirmation with GSM.">
            <SelectWithOther
              value={f.department} onChange={set('department')} options={RECOMMENDER_DEPARTMENTS}
              placeholder="Select department"
              otherText={otherText.department ?? ''} onOtherText={setOther('department')}
            />
          </Field>
        </div>
      )}

      {section === 2 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeading title="Product" />
          <Field label="Commodity" required>
            <CatalogSelect value={f.commodity} onChange={set('commodity')} options={COMMODITIES} placeholder="Select commodity" />
          </Field>
        </div>
      )}

      {section === 3 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeading title="Company" />
          <Field label="Company name" required>
            <TextInput value={f.companyName} onChange={set('companyName')} placeholder="e.g. BOSCH México S.A. de C.V." />
          </Field>
          <Field label="DUNS number" hint="9 digits — worth capturing now, since this supplier goes straight to Parking Lot.">
            <TextInput value={f.duns} onChange={set('duns')} placeholder="123456789" />
          </Field>
          <Field label="General Manager">
            <TextInput value={f.generalManager} onChange={set('generalManager')} />
          </Field>
          <Grid>
            <Field label="City">
              <TextInput value={f.city} onChange={set('city')} />
            </Field>
            <Field label="Country">
              <SelectWithOther
                value={f.country} onChange={set('country')} options={COUNTRIES}
                placeholder="Select country"
                otherText={otherText.country ?? ''} onOtherText={setOther('country')}
              />
            </Field>
          </Grid>
        </div>
      )}

      {section === 4 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeading
            title="Contacts"
            note="Contact details for the supplier being recommended — not for yourself (the recommender is captured in the Recommender step)."
          />
          <Grid>
            <Field label="Name — contact 1" required>
              <TextInput value={f.contact1Name} onChange={set('contact1Name')} />
            </Field>
            <Field label="Email — contact 1" required>
              <TextInput type="email" value={f.contact1Email} onChange={set('contact1Email')} placeholder="name@company.com" />
            </Field>
            <Field label="Name — contact 2 (optional)">
              <TextInput value={f.contact2Name} onChange={set('contact2Name')} />
            </Field>
            <Field label="Email — contact 2 (optional)">
              <TextInput type="email" value={f.contact2Email} onChange={set('contact2Email')} placeholder="name@company.com" />
            </Field>
          </Grid>
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
              the database, directly in <strong style={{ color: '#000000' }}>Parking Lot</strong>.
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
