import { PENDING_GSM_COMMODITY } from './constants';
import { ValidationError } from './errors';

// ── MS Forms → CreateSupplierInput / PATCH profile ──────────────────────
//
// The server-side twin of frontend/src/pages/tracker/supplier-forms/payload.ts.
// The external MS Form (relayed by Power Automate) asks the SAME questions the
// in-app registration forms ask, so its answers need the SAME conversions before
// they fit the columns — and those conversions cannot live in Power Automate,
// where they would be invisible, untestable and impossible to keep in step with
// the schema.
//
// Deliberately pure: no Express, no Prisma, no clock. Everything below is
// exercised by tests/unit/formIntakeMapper.test.ts without a database.

/**
 * DUPLICATED, on purpose, from `EMPLOYEE_RANGES` in
 * frontend/src/constants/catalogs.ts. The backend cannot import from frontend/
 * (separate tsconfig and build), and this is the only literal list the intake
 * needs, so it is copied here rather than dragging the whole catalogs module
 * across the boundary. **The frontend file stays the source of truth** — the two
 * are meant to be read side by side, so keep the labels character-for-character
 * identical (en dashes included) whenever either one changes.
 *
 * `Employees` is an Int column, so only `approxCount` (the range's lower bound)
 * is persisted; "Large" uses 251 since it has no upper bound.
 */
export const EMPLOYEE_RANGES = [
  { label: 'Micro (1–10)', approxCount: 1 },
  { label: 'Small (11–50)', approxCount: 11 },
  { label: 'Medium (51–250)', approxCount: 51 },
  { label: 'Large (250+)', approxCount: 251 },
] as const;

/**
 * The Form's "I don't know yet" answer for commodity. A vendor is not expected
 * to know Nexteer's internal catalog, and GSM assigns the real commodity at
 * Parking Lot — so this answer maps to the placeholder instead of being an
 * error. Matched case-insensitively after trimming: the string is typed into an
 * MS Form option list that lives outside this repository.
 */
export const COMMODITY_UNDECIDED_ANSWER = 'Not sure / To be determined';

// Column widths this mapper is responsible for. Every other field is capped by
// the Zod schema in controllers/formIntakeController.ts; these two are here
// because their length is a property of the JOIN, not of either input.
/** T_Supplier_CommercialInfo.AnnualRevenue — NVarChar(50). */
export const ANNUAL_REVENUE_MAX = 50;
/** T_Supplier_TechnicalInfo.PressCapacity — NVarChar(100). */
export const PRESS_CAPACITY_MAX = 100;
/** T_Supplier.ScoutingInput — NVarChar(200); holds an unmatched event name. */
export const SCOUTING_INPUT_MAX = 200;

const trim = (v: string | null | undefined): string => (v ?? '').trim();

/**
 * `''` for anything blank, so `compact()` below drops it and the resulting PATCH
 * never overwrites a populated column with an empty string.
 */
export function joinAmountAndUnit(
  amount: string | null | undefined,
  unit: string | null | undefined,
): string {
  const value = trim(amount);
  if (!value) return '';
  const suffix = trim(unit);
  return suffix ? `${value} ${suffix}` : value;
}

/**
 * Rejects rather than truncates. A silently shortened figure ("1,250,000,000 MXN"
 * → "1,250,000,000 MX") is a wrong number nobody can tell is wrong, whereas a
 * 400 naming the field is something Power Automate can log and a human can fix
 * at the source. Only reachable for absurd input — the Zod schema already caps
 * each half — so it costs the integration nothing in practice.
 */
export function fitColumn(field: string, value: string, max: number): string {
  if (value.length <= max) return value;
  throw new ValidationError(
    `"${field}" is ${value.length} characters once its parts are combined, but the column holds `
    + `at most ${max}. Shorten the answer at the source: ${JSON.stringify(value)}`,
  );
}

/**
 * Range label → the Int the column stores. An unknown label returns `undefined`
 * (the field is simply not written) instead of failing the registration: an
 * employee-count range is not worth rejecting a supplier over, and the raw
 * answer survives in Power Automate's run history either way.
 *
 * The exact-label match mirrors the frontend's `employeesFromRange`. The
 * leading-word fallback exists because the option text lives in an MS Form
 * outside this repository, where retyping "Micro (1-10)" with a plain hyphen is
 * one edit away from silently losing every employee count.
 */
export function employeesFromRange(label: string | null | undefined): number | undefined {
  const value = trim(label);
  if (!value) return undefined;
  const exact = EMPLOYEE_RANGES.find(r => r.label === value);
  if (exact) return exact.approxCount;
  const firstWord = value.split(/[\s(]/)[0].toLowerCase();
  if (!firstWord) return undefined;
  return EMPLOYEE_RANGES.find(r => r.label.toLowerCase().startsWith(firstWord))?.approxCount;
}

/**
 * The Form's commodity answer → a value `createSupplier` will accept. Only the
 * "not sure" answer is translated; every other string passes through untouched
 * so `createSupplier` stays the single authority on which commodities exist (it
 * validates against COMMODITIES and the C_Commodity table, and a typo'd value
 * has to surface as its own 400 rather than as a silent PENDING).
 */
export function mapCommodity(commodity: string | null | undefined): string {
  const value = trim(commodity);
  if (!value) return PENDING_GSM_COMMODITY;
  return value.toLowerCase() === COMMODITY_UNDECIDED_ANSWER.toLowerCase()
    ? PENDING_GSM_COMMODITY
    : value;
}

/** Drops blanks so a PATCH never writes `''` over a populated column (mirrors payload.ts). */
export function compact(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  );
}

// ── Input / output shapes ───────────────────────────────────────────────

/**
 * What the Form sends, AFTER Zod has type-checked it. Kept structural (rather
 * than importing the Zod-inferred type) so this module compiles with no
 * knowledge of the HTTP layer; the controller's schema is checked against it at
 * the call site instead.
 */
export interface FormIntakeInput {
  name: string;
  commodity: string;
  dunsNumber: string;
  country: string;
  manufacturingAddress: string;

  // Core — optional
  fullName?: string;
  productCategory?: 'Direct' | 'Indirect';
  productType?: string;
  buyer?: string;
  website?: string;
  phone?: string;
  contactEmail?: string;
  contactName?: string;
  recommendedBy?: string;
  recommenderDept?: string;

  // Profile — CompanyInfo
  taxIdNumber?: string;
  companyType?: string;
  foundedYear?: number;
  headquarters?: string;

  // Profile — TechnicalInfo
  technology?: string;
  machineryType?: string;
  processMethod?: string;
  materials?: string;
  complementaryOperations?: string;
  certifications?: string;
  safetyCritical?: boolean;
  safetyExperience?: boolean;
  knowsCQIs?: boolean;
  pressCapacityValue?: string;
  pressCapacityUnit?: string;

  // Profile — CommercialInfo
  productionVolume?: string;
  facilities?: number;
  topCustomers?: string;
  exportCapability?: boolean;
  hasIMMEX?: boolean;
  planIMMEX?: boolean;
  annualRevenueAmount?: string;
  annualRevenueCurrency?: string;
  employeeRange?: string;
}

/**
 * `core` is what `createSupplier`/`addSupplierToEvent` take, minus the two
 * routing fields the service decides (`entrySource` and `scoutingInput`);
 * `profile` is the satellite-table patch, applied through `updateSupplier`
 * exactly as the in-app form does through `registerSupplierForEvent`.
 */
export interface MappedFormIntake {
  core: {
    name: string;
    fullName: string;
    commodity: string;
    productCategory: 'Direct' | 'Indirect';
    productType: string;
    country: string;
    manufacturingAddress: string;
    dunsNumber: string;
    website: string;
    phone: string;
    contactEmail: string;
    contactName: string;
    recommendedBy?: string;
    recommenderDept?: string;
    buyer?: string;
  };
  profile: Record<string, unknown>;
}

/**
 * The whole conversion, in one place. Throws `ValidationError` (→ 400) only for
 * the two joined strings that cannot fit their column; every other answer either
 * maps or is left out.
 *
 * Note what is deliberately absent. There is no mapping for "Main manufacturing
 * process": the Form has no such question yet, and `processMethod` above is a
 * different, already-mapped field. Nothing from SCOUTING_FIELDS (the b2b and
 * agenda answers, selectedForParking) is mapped either — those are captured by
 * SSD during the event itself, never by the vendor filling in the Form.
 */
export function mapFormIntake(input: FormIntakeInput): MappedFormIntake {
  const name = trim(input.name);

  const annualRevenue = fitColumn(
    'annualRevenue',
    joinAmountAndUnit(input.annualRevenueAmount, input.annualRevenueCurrency),
    ANNUAL_REVENUE_MAX,
  );
  const pressCapacity = fitColumn(
    'pressCapacity',
    joinAmountAndUnit(input.pressCapacityValue, input.pressCapacityUnit),
    PRESS_CAPACITY_MAX,
  );

  return {
    core: {
      name,
      // Same convention as the in-app external form: `name` is the display name,
      // `fullName` the legal one, defaulting to whatever the vendor typed.
      fullName: trim(input.fullName) || name,
      commodity: mapCommodity(input.commodity),
      // The tracker only follows Direct; the in-app form exits early on Indirect.
      productCategory: input.productCategory ?? 'Direct',
      productType: trim(input.productType),
      country: trim(input.country),
      manufacturingAddress: trim(input.manufacturingAddress),
      dunsNumber: trim(input.dunsNumber),
      website: trim(input.website),
      phone: trim(input.phone),
      contactEmail: trim(input.contactEmail),
      contactName: trim(input.contactName),
      // Left undefined when blank so createSupplier applies its own defaults
      // (buyer → the actor's display name; the recommender columns → null).
      ...(trim(input.buyer) ? { buyer: trim(input.buyer) } : {}),
      ...(trim(input.recommendedBy) ? { recommendedBy: trim(input.recommendedBy) } : {}),
      ...(trim(input.recommenderDept) ? { recommenderDept: trim(input.recommenderDept) } : {}),
    },
    profile: compact({
      // CompanyInfo
      taxIdNumber: trim(input.taxIdNumber),
      companyType: trim(input.companyType),
      foundedYear: input.foundedYear,
      headquarters: trim(input.headquarters),
      // TechnicalInfo
      technology: trim(input.technology),
      machineryType: trim(input.machineryType),
      processMethod: trim(input.processMethod),
      pressCapacity,
      materials: trim(input.materials),
      complementaryOperations: trim(input.complementaryOperations),
      certifications: trim(input.certifications),
      safetyCritical: input.safetyCritical,
      safetyExperience: input.safetyExperience,
      knowsCQIs: input.knowsCQIs,
      // CommercialInfo
      annualRevenue,
      productionVolume: trim(input.productionVolume),
      employees: employeesFromRange(input.employeeRange),
      facilities: input.facilities,
      topCustomers: trim(input.topCustomers),
      exportCapability: input.exportCapability,
      // updateSupplier collapses this pair into the single FK_ImmexStatus.
      hasIMMEX: input.hasIMMEX,
      planIMMEX: input.planIMMEX,
    }),
  };
}
