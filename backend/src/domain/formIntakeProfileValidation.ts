import { ANNUAL_REVENUE_MAX, PRESS_CAPACITY_MAX } from './formIntakeMapper';

// ── The profile answers, checked BEFORE the supplier exists ─────────────
//
// `mapFormIntake` converts the Form's answers; this module decides whether each
// converted answer can actually land in its column. It runs on the `profile`
// object the mapper produces and it runs BEFORE `createSupplier`, which is the
// whole point: `updateSupplier` needs a supplier row to patch, so by the time it
// could reject anything the folio is already spent. Checking here means a
// submission whose profile is mostly garbage can be refused outright, with
// nothing written.
//
// Deliberately pure, exactly like formIntakeMapper: no Prisma, no Express, no
// clock. It never attempts a write and never asks the database anything — a
// column width and a JavaScript type are all it needs, and both are static.
//
// Kept as its own file rather than added to formIntakeMapper because the mapper
// answers "what does this answer become?" and this answers "is what it became
// storable?". They are read at different moments and only one of them is allowed
// to decide that a registration does not happen.

/**
 * The share of ANSWERED profile fields that may be structurally invalid before
 * the registration is refused outright.
 *
 * Strictly greater than this blocks; exactly at it still registers. The reasoning
 * is asymmetric on purpose: a couple of unusable answers out of many is a supplier
 * worth having minus two fields somebody re-types, while a profile that is mostly
 * unusable is a supplier record nobody can act on — and creating it burns a folio
 * and puts a near-empty row in the tracker that looks like real data.
 *
 * To change the rule, change this number. Nothing else encodes it.
 */
export const PROFILE_FAILURE_THRESHOLD = 0.5;

/**
 * THE DENOMINATOR IS WHAT THE VENDOR ANSWERED, NOT THE FIELD CATALOG.
 *
 * The ratio is `invalid ÷ Object.keys(profile).length` — the fields still present
 * after the mapper's `compact()` — and never `invalid ÷ PROFILE_FIELD_SPECS size`.
 * The external Form is mostly optional questions and a normal submission answers a
 * handful of them, so dividing by the ~20-field catalog would put almost every
 * healthy registration over any threshold worth having. A question the vendor left
 * blank was already dropped by `compact()` before this module sees the object: it
 * is a non-answer, not a failure, and it can neither be counted as invalid nor
 * inflate the denominator.
 */
export const PROFILE_RATIO_DENOMINATOR = 'answered fields (post-compact), not the full field catalog';

/** SQL Server `Int`. A value past this cannot be stored, whatever it means. */
const INT32_MAX = 2_147_483_647;
/**
 * `FoundedYear` is a year, so the shape check is "four digits". This is a shape
 * rule, not a plausibility rule — 1802 and 2098 both pass, because deciding which
 * years are believable is a business judgement this module has no business making
 * (and would need a clock for, which would stop it being pure).
 */
const FOUNDED_YEAR_MIN = 1000;
const FOUNDED_YEAR_MAX = 9999;

type ProfileFieldSpec =
  | { kind: 'text'; max: number; wireKey: string }
  | { kind: 'int'; min: number; max: number; wireKey: string }
  | { kind: 'boolean'; wireKey: string };

/**
 * Every key `mapFormIntake`'s `profile` can carry, with what the column behind it
 * accepts and the name the Form/Power Automate contract uses for it.
 *
 * `wireKey` exists because three profile keys are not what the vendor answered:
 * `pressCapacity` and `annualRevenue` are each a joined pair, and `employees` is
 * the Int derived from a range label. Naming `employees` in a message sent to SSD
 * would have somebody hunting the Form for a question that is not there, so the
 * message quotes the question instead.
 *
 * The widths mirror schema.prisma; the two joined strings reuse the maxima the
 * mapper already owns so the number lives in exactly one place.
 *
 * A key absent from this table is treated as INVALID rather than waved through —
 * see `validateFormIntakeProfile`. `tests/unit/formIntakeRules.test.ts` asserts
 * the table covers everything the mapper can emit, so adding a field to the mapper
 * and forgetting it here fails in CI, not in production.
 */
export const PROFILE_FIELD_SPECS: Readonly<Record<string, ProfileFieldSpec>> = {
  // CompanyInfo
  taxIdNumber: { kind: 'text', max: 50, wireKey: 'taxIdNumber' },
  companyType: { kind: 'text', max: 50, wireKey: 'companyType' },
  foundedYear: { kind: 'int', min: FOUNDED_YEAR_MIN, max: FOUNDED_YEAR_MAX, wireKey: 'foundedYear' },
  headquarters: { kind: 'text', max: 300, wireKey: 'headquarters' },
  // TechnicalInfo
  technology: { kind: 'text', max: 200, wireKey: 'technology' },
  machineryType: { kind: 'text', max: 200, wireKey: 'machineryType' },
  processMethod: { kind: 'text', max: 200, wireKey: 'processMethod' },
  pressCapacity: {
    kind: 'text', max: PRESS_CAPACITY_MAX, wireKey: 'pressCapacityValue + pressCapacityUnit',
  },
  materials: { kind: 'text', max: 300, wireKey: 'materials' },
  complementaryOperations: { kind: 'text', max: 300, wireKey: 'complementaryOperations' },
  certifications: { kind: 'text', max: 300, wireKey: 'certifications' },
  safetyCritical: { kind: 'boolean', wireKey: 'safetyCritical' },
  safetyExperience: { kind: 'boolean', wireKey: 'safetyExperience' },
  knowsCQIs: { kind: 'boolean', wireKey: 'knowsCQIs' },
  // CommercialInfo
  annualRevenue: {
    kind: 'text', max: ANNUAL_REVENUE_MAX, wireKey: 'annualRevenueAmount + annualRevenueCurrency',
  },
  productionVolume: { kind: 'text', max: 100, wireKey: 'productionVolume' },
  employees: { kind: 'int', min: 0, max: INT32_MAX, wireKey: 'employeeRange' },
  facilities: { kind: 'int', min: 0, max: INT32_MAX, wireKey: 'facilities' },
  topCustomers: { kind: 'text', max: 300, wireKey: 'topCustomers' },
  // updateSupplier stringifies this one into an NVarChar column, and collapses the
  // IMMEX pair into the single FK_ImmexStatus — both only work on real booleans.
  exportCapability: { kind: 'boolean', wireKey: 'exportCapability' },
  hasIMMEX: { kind: 'boolean', wireKey: 'hasIMMEX' },
  planIMMEX: { kind: 'boolean', wireKey: 'planIMMEX' },
};

/** True when `value` is storable in the column `spec` describes. */
function fits(spec: ProfileFieldSpec, value: unknown): boolean {
  switch (spec.kind) {
    case 'text':
      // Blank never reaches here (compact() dropped it); anything non-string would
      // reach the driver as a type it cannot bind.
      return typeof value === 'string' && value.length <= spec.max;
    case 'int':
      // Number.isInteger rejects NaN, Infinity and floats — an Int column takes
      // none of the three, and a float would be silently rounded if it got through.
      return typeof value === 'number' && Number.isInteger(value)
        && value >= spec.min && value <= spec.max;
    case 'boolean':
      return typeof value === 'boolean';
    default:
      return false;
  }
}

export interface ProfileValidation {
  /** The subset of `profile` safe to send to `updateSupplier`. */
  valid: Record<string, unknown>;
  /** Profile keys whose answer cannot be stored, in the mapper's own key order. */
  invalid: string[];
  /** The same fields named as the Form/Power Automate contract names them. */
  invalidWireKeys: string[];
  /** Fields the Form actually answered — the ratio's denominator. */
  answeredCount: number;
  /** `invalid.length / answeredCount`; `0` when nothing was answered. */
  invalidRatio: number;
  /** `invalidRatio > PROFILE_FAILURE_THRESHOLD` — refuse the registration. */
  blocksRegistration: boolean;
}

/**
 * Splits an already-mapped `profile` into what can be written and what cannot.
 *
 * What this is NOT: a live write attempt. It never touches Prisma, so it cannot
 * see a DB timeout, a dropped column or a lock — those are a different failure
 * mode, handled by the try/catch that still wraps `updateSupplier` in
 * formIntakeService. This one answers only "would this value fit its column?",
 * which is knowable without asking anybody.
 *
 * An UNKNOWN key (one with no entry in `PROFILE_FIELD_SPECS`) counts as invalid.
 * That is the safe direction: `updateSupplier` rejects the WHOLE patch on a key it
 * cannot route, so waving an unrecognized key through would trade one lost field
 * for the entire profile. The CI guard on the spec table means the only way to get
 * here is a mapper change nobody covered.
 */
export function validateFormIntakeProfile(profile: Record<string, unknown>): ProfileValidation {
  const valid: Record<string, unknown> = {};
  const invalid: string[] = [];
  const invalidWireKeys: string[] = [];

  for (const [key, value] of Object.entries(profile)) {
    const spec = PROFILE_FIELD_SPECS[key];
    if (spec && fits(spec, value)) {
      valid[key] = value;
    } else {
      invalid.push(key);
      invalidWireKeys.push(spec?.wireKey ?? key);
    }
  }

  const answeredCount = Object.keys(profile).length;
  // Guarded because a core-fields-only submission is the common case, and 0/0 is
  // NaN — which compares false against the threshold, but only by accident.
  const invalidRatio = answeredCount === 0 ? 0 : invalid.length / answeredCount;

  return {
    valid,
    invalid,
    invalidWireKeys,
    answeredCount,
    invalidRatio,
    blocksRegistration: invalidRatio > PROFILE_FAILURE_THRESHOLD,
  };
}
