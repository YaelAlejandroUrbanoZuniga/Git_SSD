// A supplier registered through the external MS Form has already answered most
// of what the Preliminary Evaluation "Overview" and "Capabilities" tabs ask —
// those answers land on the flat profile tables (CompanyInfo / TechnicalInfo /
// CommercialInfo) at registration. Historically the PreliminaryData satellite
// was still born empty, so GSM retyped answers the vendor had already given.
//
// This module derives that satellite's opening values from the profile. It is
// used at exactly one moment: when the supplier ENTERS Preliminary Evaluation
// (trackerService.ensureStageSatellite, `create` branch only). After that the
// row is GSM's to own and nothing here ever writes over it again.
//
// The duplication between the profile columns and their PreliminaryData twins
// is deliberate — see README §"La Sección 5 del form A se escribe dos veces" and
// sql/CAMBIOS_ESQUEMA.md. This seed is what makes the twin start out in sync.

/**
 * Minimal shape the seed reads off a supplier row. Structural, not the Prisma
 * type, so the include in `moveSupplierToStage` can grow without dragging this
 * module along — and so tests can build a source without a full row.
 */
export interface PreliminarySeedSource {
  buyer: string | null | undefined;
  /** The Supplier row's own manufacturing location, as the registration form set it. */
  country: string | null | undefined;
  manufacturingAddress: string | null | undefined;
  commodity?: { name: string | null } | null;
  companyInfo?: {
    fullName?: string | null;
    dunsNumber?: string | null;
    companyType?: string | null;
    foundedYear?: number | null;
    headquarters?: string | null;
    hqCity?: string | null;
    hqCountry?: string | null;
    manufacturingCity?: string | null;
    generalManager?: string | null;
  } | null;
  technicalInfo?: {
    technology?: string | null;
    machineryType?: string | null;
    processMethod?: string | null;
    pressCapacity?: string | null;
    materials?: string | null;
    complementaryOperations?: string | null;
    certifications?: string | null;
    toolingDesign?: string | null;
    rawMaterialIndex?: string | null;
    applications?: string | null;
  } | null;
  commercialInfo?: {
    annualRevenue?: string | null;
    productionVolume?: string | null;
    employees?: number | null;
    facilities?: number | null;
    topCustomers?: string | null;
    footprint?: string | null;
    yearsInMexico?: number | null;
    market?: string | null;
    exportLocalContentPercent?: number | null;
    exportDestinationCountries?: string | null;
  } | null;
}

/**
 * The PreliminaryData columns this seed can fill. Every one is optional: a key
 * is present only when the profile actually had an answer for it.
 */
export interface PreliminarySeed {
  companyName?: string;
  dunsNumber?: string;
  companyType?: string;
  foundedYear?: number;
  hqAddress?: string;
  hqCity?: string;
  hqCountry?: string;
  manufacturingAddress?: string;
  manufacturingCity?: string;
  manufacturingCountry?: string;
  footprint?: string;
  yearsInMexico?: number;
  facilities?: number;
  employees?: number;
  annualRevenue?: string;
  productionVolume?: string;
  mainTechnology?: string;
  pressCapacity?: string;
  generalManager?: string;
  market?: string;
  topCustomers?: string;
  exportCapability?: string;
  certifications?: string;
  machineryType?: string;
  processingMethod?: string;
  complementaryOps?: string;
  toolingDesign?: string;
  materials?: string;
  rawMaterialIndex?: string;
  applications?: string;
  commodity?: string;
  buyer?: string;
}

/** T_Supplier_PreliminaryData.ExportCapability is NVarChar(300). */
const EXPORT_CAPABILITY_MAX = 300;

/** Trimmed value, or `undefined` when there was nothing to say. */
const text = (v: string | null | undefined): string | undefined => {
  const t = (v ?? '').trim();
  return t === '' ? undefined : t;
};

/**
 * `undefined` for null and for zero. A 0 in `FoundedYear`, `Employees`,
 * `Facilities` or `YearsInMexico` is never a real answer — it is the placeholder
 * an unanswered numeric question leaves behind, and seeding it would read as a
 * figure GSM entered.
 */
const count = (v: number | null | undefined): number | undefined =>
  v === null || v === undefined || v === 0 ? undefined : v;

/**
 * The human-readable export answer, not the `'true'`/`'false'` the derived
 * `CommercialInfo.exportCapability` holds: the migrated Excel rows already in
 * `PreliminaryData.ExportCapability` are free text ("70% local content, exports
 * to: USA, Canada"), and GSM reads this column expecting that shape.
 *
 * A local-content percent of 0 counts as answered — "0% local content" is a real
 * statement about a vendor that imports everything, not a missing answer. This
 * matches `deriveExportCapability`, which also tests the percent for
 * null/undefined rather than for truthiness.
 */
export function formatExportCapability(
  localContentPercent: number | null | undefined,
  destinationCountries: string | null | undefined,
): string | undefined {
  const parts: string[] = [];
  if (localContentPercent !== null && localContentPercent !== undefined) {
    parts.push(`${localContentPercent}% local content`);
  }
  const countries = text(destinationCountries);
  if (countries) parts.push(`exports to: ${countries}`);
  if (parts.length === 0) return undefined;
  // Clamp rather than let an over-long country list fail the INSERT and roll
  // back the whole stage move. The percent — the half that cannot be re-derived
  // from another column — is written first, so it always survives the cut.
  return parts.join(', ').slice(0, EXPORT_CAPABILITY_MAX);
}

/**
 * The PreliminaryData columns a supplier's profile can supply, ready to spread
 * into the `create` of the satellite's upsert.
 *
 * Keys are omitted — never set to null or an empty string — when the source has
 * no answer, so spreading this can only ever ADD values. Callers must apply it
 * at row creation only: an existing PreliminaryData row holds GSM's own edits
 * and this must never write over them.
 */
export function buildPreliminarySeed(supplier: PreliminarySeedSource): PreliminarySeed {
  const company = supplier.companyInfo;
  const technical = supplier.technicalInfo;
  const commercial = supplier.commercialInfo;

  const seed: PreliminarySeed = {
    // Overview tab
    commodity: text(supplier.commodity?.name),
    buyer: text(supplier.buyer),
    companyName: text(company?.fullName),
    dunsNumber: text(company?.dunsNumber),
    companyType: text(company?.companyType),
    foundedYear: count(company?.foundedYear),
    hqAddress: text(company?.headquarters),
    hqCity: text(company?.hqCity),
    hqCountry: text(company?.hqCountry),
    generalManager: text(company?.generalManager),
    manufacturingCity: text(company?.manufacturingCity),
    manufacturingAddress: text(supplier.manufacturingAddress),
    manufacturingCountry: text(supplier.country),
    footprint: text(commercial?.footprint),
    yearsInMexico: count(commercial?.yearsInMexico),
    facilities: count(commercial?.facilities),
    employees: count(commercial?.employees),
    annualRevenue: text(commercial?.annualRevenue),
    productionVolume: text(commercial?.productionVolume),
    mainTechnology: text(technical?.technology),
    pressCapacity: text(technical?.pressCapacity),
    market: text(commercial?.market),
    topCustomers: text(commercial?.topCustomers),
    exportCapability: formatExportCapability(
      commercial?.exportLocalContentPercent,
      commercial?.exportDestinationCountries,
    ),
    certifications: text(technical?.certifications),
    // Capabilities tab
    machineryType: text(technical?.machineryType),
    processingMethod: text(technical?.processMethod),
    complementaryOps: text(technical?.complementaryOperations),
    toolingDesign: text(technical?.toolingDesign),
    materials: text(technical?.materials),
    rawMaterialIndex: text(technical?.rawMaterialIndex),
    applications: text(technical?.applications),
  };

  // Drop the keys with no answer, so the object can be spread into a Prisma
  // `create` without writing an explicit null over a column default.
  for (const key of Object.keys(seed) as (keyof PreliminarySeed)[]) {
    if (seed[key] === undefined) delete seed[key];
  }
  return seed;
}
