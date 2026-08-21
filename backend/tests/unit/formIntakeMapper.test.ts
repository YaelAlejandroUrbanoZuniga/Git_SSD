import { describe, expect, it } from 'vitest';
import {
  ANNUAL_REVENUE_MAX,
  COMMODITY_UNDECIDED_ANSWER,
  compact,
  EMPLOYEE_RANGES,
  employeesFromRange,
  fitColumn,
  joinAmountAndUnit,
  mapCommodity,
  mapFormIntake,
  PRESS_CAPACITY_MAX,
  type FormIntakeInput,
} from '../../src/domain/formIntakeMapper';
import {
  PROFILE_FAILURE_THRESHOLD,
  PROFILE_FIELD_SPECS,
  validateFormIntakeProfile,
} from '../../src/domain/formIntakeProfileValidation';
import { PENDING_GSM_COMMODITY } from '../../src/domain/constants';
import { ValidationError } from '../../src/domain/errors';

/** The five fields the intake schema requires — every case below starts here. */
const minimal: FormIntakeInput = {
  name: 'ACME METALS',
  commodity: 'Machining',
  dunsNumber: '123456789',
  country: 'Mexico',
  manufacturingAddress: 'Celaya, GTO',
};

describe('formIntakeMapper', () => {
  describe('mapCommodity', () => {
    it('translates the Form\'s "not sure" answer to the pending-GSM placeholder', () => {
      expect(mapCommodity(COMMODITY_UNDECIDED_ANSWER)).toBe(PENDING_GSM_COMMODITY);
      expect(PENDING_GSM_COMMODITY).toBe('TBD -- Pending GSM');
    });

    it('matches that answer case- and whitespace-insensitively (the Form is edited elsewhere)', () => {
      expect(mapCommodity('  not sure / to be determined  ')).toBe(PENDING_GSM_COMMODITY);
    });

    it('treats a blank answer as "GSM has not defined it yet", not as an error', () => {
      expect(mapCommodity('')).toBe(PENDING_GSM_COMMODITY);
      expect(mapCommodity(undefined)).toBe(PENDING_GSM_COMMODITY);
    });

    it('passes every other value through untouched — createSupplier owns the catalog check', () => {
      expect(mapCommodity('Machining')).toBe('Machining');
      // A typo must reach createSupplier and become its own 400, not a silent PENDING.
      expect(mapCommodity('Machinning')).toBe('Machinning');
    });
  });

  describe('employeesFromRange', () => {
    it('keeps the lower bound of each range — Employees is an Int column', () => {
      expect(employeesFromRange('Micro (1–10)')).toBe(1);
      expect(employeesFromRange('Small (11–50)')).toBe(11);
      expect(employeesFromRange('Medium (51–250)')).toBe(51);
      expect(employeesFromRange('Large (250+)')).toBe(251);
    });

    it('covers every label in the mirrored EMPLOYEE_RANGES array', () => {
      for (const range of EMPLOYEE_RANGES) {
        expect(employeesFromRange(range.label)).toBe(range.approxCount);
      }
    });

    it('still resolves a label retyped with a plain hyphen instead of an en dash', () => {
      // The exact text lives in an MS Form nobody here controls; a punctuation
      // edit there must not silently drop every employee count.
      expect(employeesFromRange('Small (11-50)')).toBe(11);
      expect(employeesFromRange('medium (51-250)')).toBe(51);
    });

    it('returns undefined for blank or unrecognisable answers rather than failing the intake', () => {
      expect(employeesFromRange('')).toBeUndefined();
      expect(employeesFromRange('   ')).toBeUndefined();
      expect(employeesFromRange(undefined)).toBeUndefined();
      expect(employeesFromRange('Enormous')).toBeUndefined();
    });
  });

  describe('joinAmountAndUnit', () => {
    it('joins the two answers with a single space', () => {
      expect(joinAmountAndUnit('12,000,000', 'USD')).toBe('12,000,000 USD');
      expect(joinAmountAndUnit('  800  ', '  ton  ')).toBe('800 ton');
    });

    it('returns the amount alone when no unit was answered', () => {
      expect(joinAmountAndUnit('800', '')).toBe('800');
      expect(joinAmountAndUnit('800', undefined)).toBe('800');
    });

    it('returns "" when there is no amount — a unit alone means nothing', () => {
      expect(joinAmountAndUnit('', 'USD')).toBe('');
      expect(joinAmountAndUnit(undefined, 'USD')).toBe('');
      expect(joinAmountAndUnit('   ', 'USD')).toBe('');
    });
  });

  describe('fitColumn', () => {
    it('passes a value that fits, including one exactly at the limit', () => {
      expect(fitColumn('annualRevenue', 'x'.repeat(50), 50)).toBe('x'.repeat(50));
    });

    it('rejects an over-long value with a 400 naming the field, instead of truncating', () => {
      let thrown: unknown;
      try {
        fitColumn('annualRevenue', 'x'.repeat(51), 50);
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeInstanceOf(ValidationError);
      expect((thrown as ValidationError).status).toBe(400);
      expect((thrown as ValidationError).message).toContain('annualRevenue');
      expect((thrown as ValidationError).message).toContain('51');
      expect((thrown as ValidationError).message).toContain('50');
    });
  });

  describe('compact', () => {
    it('drops blanks so a PATCH never overwrites a populated column with ""', () => {
      expect(compact({ a: 'x', b: '', c: null, d: undefined, e: 0, f: false })).toEqual({
        a: 'x', e: 0, f: false,
      });
    });
  });

  describe('mapFormIntake', () => {
    it('maps the five required answers into the core create input', () => {
      const { core } = mapFormIntake(minimal);
      expect(core).toMatchObject({
        name: 'ACME METALS',
        commodity: 'Machining',
        dunsNumber: '123456789',
        country: 'Mexico',
        manufacturingAddress: 'Celaya, GTO',
      });
    });

    it('defaults fullName to the company name and productCategory to Direct', () => {
      const { core } = mapFormIntake(minimal);
      expect(core.fullName).toBe('ACME METALS');
      expect(core.productCategory).toBe('Direct');
    });

    it('keeps an explicit fullName when the Form asked for the legal name', () => {
      const { core } = mapFormIntake({ ...minimal, fullName: 'Acme Metals S.A. de C.V.' });
      expect(core.fullName).toBe('Acme Metals S.A. de C.V.');
    });

    it('trims every free-text answer', () => {
      const { core } = mapFormIntake({
        ...minimal,
        name: '  ACME METALS  ',
        country: '  Mexico  ',
        contactEmail: ' ana@acme.com ',
      });
      expect(core.name).toBe('ACME METALS');
      expect(core.country).toBe('Mexico');
      expect(core.contactEmail).toBe('ana@acme.com');
    });

    it('omits blank buyer/recommender answers so createSupplier applies its own defaults', () => {
      const { core } = mapFormIntake({ ...minimal, buyer: '   ', recommendedBy: '' });
      expect('buyer' in core).toBe(false);
      expect('recommendedBy' in core).toBe(false);
    });

    it('passes the recommender answers through when the Form sent them', () => {
      const { core } = mapFormIntake({
        ...minimal, recommendedBy: 'Ana García', recommenderDept: 'Purchasing',
      });
      expect(core.recommendedBy).toBe('Ana García');
      expect(core.recommenderDept).toBe('Purchasing');
    });

    it('applies the four conversions the in-app payload.ts applies', () => {
      const { core, profile } = mapFormIntake({
        ...minimal,
        commodity: COMMODITY_UNDECIDED_ANSWER,
        employeeRange: 'Medium (51–250)',
        annualRevenueAmount: '12,000,000',
        annualRevenueCurrency: 'USD',
        pressCapacityValue: '600',
        pressCapacityUnit: 'ton',
      });
      expect(core.commodity).toBe(PENDING_GSM_COMMODITY);
      expect(profile.employees).toBe(51);
      expect(profile.annualRevenue).toBe('12,000,000 USD');
      expect(profile.pressCapacity).toBe('600 ton');
    });

    it('routes the satellite answers into the profile patch, not the core input', () => {
      const { core, profile } = mapFormIntake({
        ...minimal,
        taxIdNumber: 'AME010203XYZ',
        companyType: 'Private',
        foundedYear: 1998,
        headquarters: 'Querétaro',
        technology: 'CNC',
        machineryType: 'Haas VF-2',
        processMethod: 'Milling',
        materials: 'Steel, Aluminum',
        complementaryOperations: 'Heat treatment',
        certifications: 'IATF 16949',
        safetyCritical: true,
        safetyExperience: false,
        knowsCQIs: true,
        productionVolume: '2M pcs/year',
        facilities: 3,
        topCustomers: 'OEM A, OEM B',
        exportCapability: true,
        hasIMMEX: false,
        planIMMEX: true,
      });
      expect(profile).toMatchObject({
        taxIdNumber: 'AME010203XYZ', companyType: 'Private', foundedYear: 1998,
        headquarters: 'Querétaro', technology: 'CNC', machineryType: 'Haas VF-2',
        processMethod: 'Milling', materials: 'Steel, Aluminum',
        complementaryOperations: 'Heat treatment', certifications: 'IATF 16949',
        safetyCritical: true, safetyExperience: false, knowsCQIs: true,
        productionVolume: '2M pcs/year', facilities: 3, topCustomers: 'OEM A, OEM B',
        exportCapability: true, hasIMMEX: false, planIMMEX: true,
      });
      // None of them leaked into the create input.
      for (const key of Object.keys(profile)) {
        expect(key in core).toBe(false);
      }
    });

    it('keeps `false` in the profile — it is an answer, not a blank', () => {
      const { profile } = mapFormIntake({ ...minimal, safetyCritical: false });
      expect(profile.safetyCritical).toBe(false);
    });

    it('produces an empty profile when the Form sent nothing beyond the core answers', () => {
      expect(mapFormIntake(minimal).profile).toEqual({});
    });

    it('never maps "Main manufacturing process" — the Form has no such question yet', () => {
      const { core, profile } = mapFormIntake({ ...minimal, processMethod: 'Milling' });
      // processMethod is its own, already-mapped field; nothing else appears.
      expect(profile).toEqual({ processMethod: 'Milling' });
      expect('manufacturingProcess' in profile).toBe(false);
      expect('manufacturingProcess' in core).toBe(false);
    });

    it('400s on a revenue string that would not fit AnnualRevenue, naming the field', () => {
      expect(() => mapFormIntake({
        ...minimal,
        annualRevenueAmount: '1'.repeat(ANNUAL_REVENUE_MAX),
        annualRevenueCurrency: 'USD',
      })).toThrow(/annualRevenue/);
      expect(() => mapFormIntake({
        ...minimal,
        annualRevenueAmount: '1'.repeat(ANNUAL_REVENUE_MAX),
        annualRevenueCurrency: 'USD',
      })).toThrow(ValidationError);
    });

    it('400s on a press-capacity string that would not fit PressCapacity, naming the field', () => {
      expect(() => mapFormIntake({
        ...minimal,
        pressCapacityValue: '9'.repeat(PRESS_CAPACITY_MAX),
        pressCapacityUnit: 'ton',
      })).toThrow(/pressCapacity/);
    });

    it('accepts a combined string sitting exactly on the column limit', () => {
      const amount = '1'.repeat(ANNUAL_REVENUE_MAX - 4); // + ' USD'
      const { profile } = mapFormIntake({
        ...minimal, annualRevenueAmount: amount, annualRevenueCurrency: 'USD',
      });
      expect(String(profile.annualRevenue)).toHaveLength(ANNUAL_REVENUE_MAX);
    });
  });
});

// ── The shape check that runs on what the mapper produced ───────────────
// Its input is always a `profile` object mapFormIntake built, so every case
// below either hands it one or hands it the literal shape mapFormIntake emits.

/** 15 answered profile fields, all of them storable. */
const fifteenAnswers: FormIntakeInput = {
  ...minimal,
  taxIdNumber: 'ABC010101AAA',
  companyType: 'S.A. de C.V.',
  foundedYear: 1998,
  headquarters: 'Querétaro, QRO',
  technology: 'CNC',
  machineryType: 'Haas VF-2',
  processMethod: 'Milling',
  materials: 'Steel, aluminium',
  complementaryOperations: 'Heat treatment',
  certifications: 'IATF 16949',
  safetyCritical: true,
  productionVolume: '2M pcs/yr',
  facilities: 3,
  topCustomers: 'OEM A, OEM B',
  exportCapability: true,
};

describe('formIntakeProfileValidation', () => {
  describe('a clean profile', () => {
    it('passes every answered field through untouched', () => {
      const { profile } = mapFormIntake(fifteenAnswers);
      const check = validateFormIntakeProfile(profile);

      expect(check.valid).toEqual(profile);
      expect(check.invalid).toEqual([]);
      expect(check.invalidWireKeys).toEqual([]);
      expect(check.answeredCount).toBe(15);
      expect(check.invalidRatio).toBe(0);
      expect(check.blocksRegistration).toBe(false);
    });

    it('treats a core-fields-only submission as ratio 0, never as 0/0 = NaN', () => {
      const check = validateFormIntakeProfile(mapFormIntake(minimal).profile);
      expect(check.answeredCount).toBe(0);
      expect(check.invalidRatio).toBe(0);
      expect(check.blocksRegistration).toBe(false);
    });
  });

  describe('what counts as structurally invalid', () => {
    it('rejects text wider than its column and keeps everything else', () => {
      const check = validateFormIntakeProfile({
        technology: 'CNC',
        materials: 'x'.repeat(301), // Materials is NVarChar(300)
      });
      expect(check.invalid).toEqual(['materials']);
      expect(check.valid).toEqual({ technology: 'CNC' });
    });

    it('accepts text sitting exactly on the column limit', () => {
      expect(validateFormIntakeProfile({ materials: 'x'.repeat(300) }).invalid).toEqual([]);
    });

    it('rejects a numeric field that is not a whole, storable number', () => {
      // Not a number at all, a float against an Int column, NaN, and past Int32.
      expect(validateFormIntakeProfile({ facilities: '3' }).invalid).toEqual(['facilities']);
      expect(validateFormIntakeProfile({ facilities: 2.5 }).invalid).toEqual(['facilities']);
      expect(validateFormIntakeProfile({ facilities: Number.NaN }).invalid).toEqual(['facilities']);
      expect(validateFormIntakeProfile({ facilities: 3_000_000_000 }).invalid).toEqual(['facilities']);
      expect(validateFormIntakeProfile({ facilities: -1 }).invalid).toEqual(['facilities']);
      expect(validateFormIntakeProfile({ facilities: 0 }).invalid).toEqual([]);
    });

    it('rejects a founded year that is not four digits — the shape of a year', () => {
      expect(validateFormIntakeProfile({ foundedYear: 0 }).invalid).toEqual(['foundedYear']);
      expect(validateFormIntakeProfile({ foundedYear: 98 }).invalid).toEqual(['foundedYear']);
      expect(validateFormIntakeProfile({ foundedYear: 20260 }).invalid).toEqual(['foundedYear']);
      // Old and far-future years are a business judgement, not a shape problem.
      expect(validateFormIntakeProfile({ foundedYear: 1802 }).invalid).toEqual([]);
      expect(validateFormIntakeProfile({ foundedYear: 2098 }).invalid).toEqual([]);
    });

    it('rejects a boolean field carrying anything but a boolean', () => {
      // updateSupplier stringifies exportCapability and derives the IMMEX FK from
      // the pair — 'yes' and 1 would both come out as truthy nonsense.
      expect(validateFormIntakeProfile({ exportCapability: 'yes' }).invalid)
        .toEqual(['exportCapability']);
      expect(validateFormIntakeProfile({ hasIMMEX: 1 }).invalid).toEqual(['hasIMMEX']);
      expect(validateFormIntakeProfile({ hasIMMEX: false }).invalid).toEqual([]);
    });

    it('rejects a key no spec covers, rather than risking the whole patch on it', () => {
      // updateSupplier 400s the ENTIRE patch on a key it cannot route, so an
      // unrecognised key must be dropped here or it costs every other field.
      const check = validateFormIntakeProfile({ technology: 'CNC', aBrandNewColumn: 'x' });
      expect(check.invalid).toEqual(['aBrandNewColumn']);
      expect(check.valid).toEqual({ technology: 'CNC' });
    });

    it('covers every key mapFormIntake can emit — a new mapped field fails here first', () => {
      // The exhaustive profile: every question the mapper reads, answered.
      const { profile } = mapFormIntake({
        ...fifteenAnswers,
        safetyExperience: false,
        knowsCQIs: true,
        hasIMMEX: true,
        planIMMEX: false,
        employeeRange: 'Medium (51–250)',
        annualRevenueAmount: '12,000,000',
        annualRevenueCurrency: 'USD',
        pressCapacityValue: '800',
        pressCapacityUnit: 'ton',
      });
      for (const key of Object.keys(profile)) {
        expect(PROFILE_FIELD_SPECS[key], `no spec for mapped profile field "${key}"`).toBeDefined();
      }
      expect(validateFormIntakeProfile(profile).invalid).toEqual([]);
    });
  });

  describe('the names it reports', () => {
    it('quotes the Form question, not the column, for the three derived fields', () => {
      const check = validateFormIntakeProfile({
        employees: 'many',
        annualRevenue: 12_000_000,
        pressCapacity: 800,
      });
      expect(check.invalidWireKeys).toEqual([
        'employeeRange',
        'annualRevenueAmount + annualRevenueCurrency',
        'pressCapacityValue + pressCapacityUnit',
      ]);
    });

    it('reports the field own name everywhere else', () => {
      const check = validateFormIntakeProfile({ foundedYear: 0, materials: 42 });
      expect(check.invalid).toEqual(['foundedYear', 'materials']);
      expect(check.invalidWireKeys).toEqual(['foundedYear', 'materials']);
    });
  });

  describe('the ratio and the threshold', () => {
    it('divides by the ANSWERED fields, never by the whole field catalogue', () => {
      const { profile } = mapFormIntake({ ...fifteenAnswers, foundedYear: 0, facilities: -3 });
      const check = validateFormIntakeProfile(profile);

      expect(check.answeredCount).toBe(15);
      expect(check.invalid).toEqual(['foundedYear', 'facilities']);
      expect(check.invalidRatio).toBeCloseTo(2 / 15);
      // The catalogue is larger than what this submission answered; dividing by
      // it would make an ordinary partial answer look like a broken one.
      expect(Object.keys(PROFILE_FIELD_SPECS).length).toBeGreaterThan(check.answeredCount);
      expect(check.blocksRegistration).toBe(false);
    });

    it('does NOT block exactly at the threshold — only past it', () => {
      const half = validateFormIntakeProfile({ technology: 'CNC', foundedYear: 0 });
      expect(half.invalidRatio).toBe(PROFILE_FAILURE_THRESHOLD);
      expect(half.blocksRegistration).toBe(false);

      const past = validateFormIntakeProfile({
        technology: 'CNC', foundedYear: 0, facilities: -3,
      });
      expect(past.invalidRatio).toBeGreaterThan(PROFILE_FAILURE_THRESHOLD);
      expect(past.blocksRegistration).toBe(true);
    });

    it('blocks when most of what was answered is unusable', () => {
      const check = validateFormIntakeProfile({
        technology: 'CNC',
        foundedYear: 0,
        facilities: -3,
        materials: 42,
        exportCapability: 'yes',
      });
      expect(check.invalidRatio).toBe(0.8);
      expect(check.blocksRegistration).toBe(true);
      // The good answer is still separated out — the caller decides what to do.
      expect(check.valid).toEqual({ technology: 'CNC' });
    });
  });

  describe('blank answers are not failures', () => {
    it('never sees the questions the vendor skipped — compact() already dropped them', () => {
      // A submission that answers 3 profile questions and leaves the rest blank,
      // the way an optional MS Form question arrives when nobody typed in it.
      const { profile } = mapFormIntake({
        ...minimal,
        technology: 'CNC',
        foundedYear: 1998,
        certifications: 'IATF 16949',
        taxIdNumber: '',
        companyType: '   ',
        headquarters: '',
        machineryType: '',
        processMethod: '',
        materials: '',
        complementaryOperations: '',
        productionVolume: '',
        topCustomers: '',
        employeeRange: '',
        annualRevenueAmount: '',
        annualRevenueCurrency: '',
        pressCapacityValue: '',
        pressCapacityUnit: '',
        safetyCritical: undefined,
        safetyExperience: undefined,
        knowsCQIs: undefined,
        exportCapability: undefined,
        hasIMMEX: undefined,
        planIMMEX: undefined,
        facilities: undefined,
      });
      const check = validateFormIntakeProfile(profile);

      expect(Object.keys(profile).sort()).toEqual(['certifications', 'foundedYear', 'technology']);
      expect(check.answeredCount).toBe(3);
      expect(check.invalid).toEqual([]);
      expect(check.invalidRatio).toBe(0);
      expect(check.blocksRegistration).toBe(false);
    });
  });
});
