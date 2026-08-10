// Real proveedores reach Parking Lot with data that, in the current app, comes
// from exactly two places: CompanyInfo.dunsNumber (there is no Parking Lot
// equivalent column) and ManufacturingCountry/ManufacturingAddress, which live
// on ParkingData once GSM reviews them at Parking Lot but start out on the
// Supplier row itself (set once, at creation, by the external registration /
// recommendation form — see ExternalRegistrationForm.tsx /
// InternalRecommendationForm.tsx). ParkingData wins when present since it is
// the more recently reviewed value; the Supplier column is the fallback for
// suppliers whose Parking Lot record never touched that field.

/** Minimal shape this check needs off a supplier row — matches supplierInclude. */
export interface ExternalFormSource {
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
}

const isEmpty = (v: string | null | undefined): boolean => !v || !v.trim();

/**
 * True (complete) only when every field the external form is supposed to have
 * captured is actually populated on this supplier. This is THE rule for
 * whether a supplier's external-form data is complete — used in two places
 * that must never drift apart:
 *   1. trackerService.moveSupplierToStage — gates Parking Lot → Preliminary
 *      Evaluation.
 *   2. eventsService — TODO hook for the future T_Event_Prospect → Supplier
 *      creation precondition (Phase 2, not implemented yet).
 * Both comments point back here.
 */
export function hasExternalFormData(supplier: ExternalFormSource): ExternalFormCheck {
  const missing: string[] = [];
  if (isEmpty(supplier.companyInfo?.dunsNumber)) missing.push('DUNS number');
  if (isEmpty(supplier.parkingData?.manufacturingCountry ?? supplier.country)) {
    missing.push('Manufacturing country');
  }
  if (isEmpty(supplier.parkingData?.manufacturingAddress ?? supplier.manufacturingAddress)) {
    missing.push('Manufacturing address');
  }
  return { complete: missing.length === 0, missing };
}
