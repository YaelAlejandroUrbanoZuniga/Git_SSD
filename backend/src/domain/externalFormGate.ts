// Real proveedores reach Parking Lot with data that, in the current app, comes
// from exactly two places: CompanyInfo.dunsNumber (there is no Parking Lot
// equivalent column) and ManufacturingCountry/ManufacturingAddress, which live
// on ParkingData once GSM reviews them at Parking Lot but start out on the
// Supplier row itself (set once, at creation, by the external registration /
// recommendation form — see ExternalRegistrationForm.tsx /
// InternalRecommendationForm.tsx). ParkingData wins when present since it is
// the more recently reviewed value; the Supplier column is the fallback for
// suppliers whose Parking Lot record never touched that field.
//
// Excel-migrated suppliers are the exception: they never went through either
// form, so none of those three columns has a source to come from and the data
// is captured by hand instead. They are recognised by their folio prefix — see
// domain/supplierOrigin.ts.

import { isExcelMigrated } from './supplierOrigin';

/** Minimal shape this check needs off a supplier row — matches supplierInclude. */
export interface ExternalFormSource {
  /** The folio prefix is what marks an Excel-migrated (exempt) supplier. */
  folio: string | null | undefined;
  companyInfo?: { dunsNumber: string | null | undefined } | null;
  parkingData?: {
    manufacturingCountry: string | null | undefined;
    manufacturingAddress: string | null | undefined;
  } | null;
  country: string | null | undefined;
  manufacturingAddress: string | null | undefined;
}

export interface ExternalFormCheck {
  complete: boolean;
  /** Human-readable labels for whichever fields are empty, in check order. */
  missing: string[];
  /** True when `complete` holds by exemption, not because the data is there. */
  exempt: boolean;
}

const isEmpty = (v: string | null | undefined): boolean => !v || !v.trim();

/**
 * True (complete) only when every field the external form is supposed to have
 * captured is actually populated on this supplier. This is THE rule for
 * whether a supplier's external-form data is complete.
 *
 * Excel-migrated suppliers (folio `XL-`, domain/supplierOrigin.ts) are exempt
 * and short-circuit to complete without a single field being read: they were
 * imported from spreadsheets, never saw the external form, and their DUNS /
 * manufacturing country / manufacturing address are captured manually
 * afterwards — gating them on data that has no source would strand the whole
 * migrated population in Parking Lot. That is a permanent business rule, not a
 * migration-window workaround. `exempt` is what separates the two ways a check
 * can come back complete: "the data is there" vs "this supplier was never
 * asked for it".
 *
 * One caller today: trackerService.moveSupplierToStage, which gates the
 * Parking Lot → Preliminary Evaluation move. Whether a future prospect →
 * Supplier conversion must satisfy the same rule is an open product question,
 * recorded as entry 5 in backend/DEBT.md.
 */
export function hasExternalFormData(supplier: ExternalFormSource): ExternalFormCheck {
  if (isExcelMigrated(supplier.folio)) return { complete: true, missing: [], exempt: true };

  const missing: string[] = [];
  if (isEmpty(supplier.companyInfo?.dunsNumber)) missing.push('DUNS number');
  if (isEmpty(supplier.parkingData?.manufacturingCountry ?? supplier.country)) {
    missing.push('Manufacturing country');
  }
  if (isEmpty(supplier.parkingData?.manufacturingAddress ?? supplier.manufacturingAddress)) {
    missing.push('Manufacturing address');
  }
  return { complete: missing.length === 0, missing, exempt: false };
}
