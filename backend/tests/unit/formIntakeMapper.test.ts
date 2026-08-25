import { describe, expect, it } from 'vitest';
import {
  ANNUAL_REVENUE_MAX,
  automotivePercentForMarket,
  COMMODITY_UNDECIDED_ANSWER,
  compact,
  deriveExportCapability,
  EMPLOYEE_RANGES,
  employeesFromRange,
  EXPORT_DESTINATION_NONE_ANSWER,
  fitColumn,
  joinAmountAndUnit,
  mapCommodity,
  mapFormIntake,
  MIXED_MARKET_ANSWER,
  PRESS_CAPACITY_MAX,
  yearsInMexico,
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

  describe('yearsInMexico', () => {
    it('takes the Form\'s integer answer as-is', () => {
      expect(yearsInMexico(26)).toBe(26);
      expect(yearsInMexico(0)).toBe(0);
      expect(yearsInMexico(150)).toBe(150);
    });

    it('takes the leading integer of the migrated Excel\'s free text', () => {
      expect(yearsInMexico('26 Years')).toBe(26);
      expect(yearsInMexico('12 years')).toBe(12);
      expect(yearsInMexico('  8 años en México  ')).toBe(8);
      expect(yearsInMexico('30')).toBe(30);
    });

    it('returns undefined for an unparseable answer rather than failing the intake', () => {
      // The field is simply not written; the raw answer survives in the Power
      // Automate run history either way.
      expect(yearsInMexico('more than 20')).toBeUndefined();
      expect(yearsInMexico('since 1998')).toBeUndefined();
      expect(yearsInMexico('')).toBeUndefined();
      expect(yearsInMexico('   ')).toBeUndefined();
      expect(yearsInMexico(undefined)).toBeUndefined();
      expect(yearsInMexico(null)).toBeUndefined();
    });
  });

  describe('automotivePercentForMarket', () => {
    it('keeps the percentage when the market answer is Mixed', () => {
      expect(automotivePercentForMarket(MIXED_MARKET_ANSWER, 40)).toBe(40);
      expect(automotivePercentForMarket('  Mixed  ', 0)).toBe(0);
      expect(automotivePercentForMarket('Mixed', 100)).toBe(100);
    });

    it('drops it against any other market — a stray number is worse than none', () => {
      expect(automotivePercentForMarket('Automotive', 40)).toBeUndefined();
      expect(automotivePercentForMarket('Industrial', 40)).toBeUndefined();
      expect(automotivePercentForMarket('', 40)).toBeUndefined();
      expect(automotivePercentForMarket(undefined, 40)).toBeUndefined();
    });

    it('drops it when the percentage itself was not answered', () => {
      expect(automotivePercentForMarket(MIXED_MARKET_ANSWER, undefined)).toBeUndefined();
      expect(automotivePercentForMarket(MIXED_MARKET_ANSWER, null)).toBeUndefined();
    });
  });

  describe('deriveExportCapability', () => {
    it('is true when local content is below 100 % — something goes abroad', () => {
      expect(deriveExportCapability(40, undefined)).toBe(true);
      expect(deriveExportCapability(0, '')).toBe(true);
      expect(deriveExportCapability(99, undefined)).toBe(true);
    });

    it('is false at 100 % local content with no destination country', () => {
      expect(deriveExportCapability(100, undefined)).toBe(false);
      expect(deriveExportCapability(100, '   ')).toBe(false);
    });

    it('is true when destination countries name somewhere', () => {
      expect(deriveExportCapability(undefined, 'USA, Canada')).toBe(true);
      // Even alongside 100 % local content: the two answers disagree, and the
      // one that names a country is the one carrying information.
      expect(deriveExportCapability(100, 'USA')).toBe(true);
    });

    it('is false for the Form\'s "None" answer, matched case-insensitively', () => {
      expect(deriveExportCapability(undefined, EXPORT_DESTINATION_NONE_ANSWER)).toBe(false);
      expect(deriveExportCapability(undefined, '  none  ')).toBe(false);
      expect(deriveExportCapability(undefined, 'NONE')).toBe(false);
    });

    it('is undefined — not false — when the Form answered neither question', () => {
      // "does not export" and "was never asked" are different facts, and only
      // the first is worth writing over whatever the column already holds.
      expect(deriveExportCapability(undefined, undefined)).toBeUndefined();
      expect(deriveExportCapability(null, '')).toBeUndefined();
      expect(deriveExportCapability(undefined, '   ')).toBeUndefined();
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
        exportLocalContentPercent: 60,
        exportDestinationCountries: 'USA, Canada',
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
        exportLocalContentPercent: 60, exportDestinationCountries: 'USA, Canada',
        exportCapability: true, hasIMMEX: false, planIMMEX: true,
      });
      // None of them leaked into the create input.
      for (const key of Object.keys(profile)) {
        expect(key in core).toBe(false);
      }
    });

    it('routes the fifteen answers added 2026-08-24 to their satellite columns', () => {
      const { core, profile } = mapFormIntake({
        ...minimal,
        // CompanyInfo
        hqCity: 'Querétaro',
        hqCountry: 'Mexico',
        manufacturingCity: 'Celaya',
        generalManager: 'Ana García',
        firstContactWithNexteer: true,
        // TechnicalInfo
        toolingDesign: 'In-house',
        rawMaterialIndex: 'LME Aluminium',
        applications: 'Steering columns, brackets',
        // CommercialInfo
        footprint: 'Global',
        yearsInMexico: 26,
        market: 'Mixed',
        businessSector: 'Automotive tier 2',
        automotivePercent: 65,
        exportLocalContentPercent: 40,
        exportDestinationCountries: 'USA, Canada',
      });

      expect(profile).toMatchObject({
        hqCity: 'Querétaro', hqCountry: 'Mexico', manufacturingCity: 'Celaya',
        generalManager: 'Ana García', firstContactWithNexteer: true,
        toolingDesign: 'In-house', rawMaterialIndex: 'LME Aluminium',
        applications: 'Steering columns, brackets',
        footprint: 'Global', yearsInMexico: 26, market: 'Mixed',
        businessSector: 'Automotive tier 2', automotivePercent: 65,
        exportLocalContentPercent: 40, exportDestinationCountries: 'USA, Canada',
      });
      // Fifteen answers + the derived exportCapability, and nothing in core.
      expect(Object.keys(profile)).toHaveLength(16);
      for (const key of Object.keys(profile)) {
        expect(key in core).toBe(false);
      }
    });

    it('trims the new free-text answers like every other one', () => {
      const { profile } = mapFormIntake({
        ...minimal,
        hqCity: '  Querétaro  ',
        generalManager: '  Ana García ',
        applications: ' Steering columns ',
        market: '  Mixed  ',
      });
      expect(profile).toMatchObject({
        hqCity: 'Querétaro', generalManager: 'Ana García',
        applications: 'Steering columns', market: 'Mixed',
      });
    });

    it('converts a free-text years-in-Mexico answer, and drops an unparseable one', () => {
      expect(mapFormIntake({ ...minimal, yearsInMexico: '26 Years' }).profile.yearsInMexico)
        .toBe(26);
      expect(mapFormIntake({ ...minimal, yearsInMexico: 'a long time' }).profile)
        .not.toHaveProperty('yearsInMexico');
    });

    it('drops the automotive percentage unless the market answer is Mixed', () => {
      const mixed = mapFormIntake({ ...minimal, market: 'Mixed', automotivePercent: 65 });
      expect(mixed.profile.automotivePercent).toBe(65);

      const notMixed = mapFormIntake({
        ...minimal, market: 'Automotive', automotivePercent: 65,
      });
      expect(notMixed.profile).not.toHaveProperty('automotivePercent');
      // The market answer itself is still stored — only the stray number goes.
      expect(notMixed.profile.market).toBe('Automotive');
    });

    it('derives exportCapability from the two granular export answers', () => {
      const belowFull = mapFormIntake({ ...minimal, exportLocalContentPercent: 40 });
      expect(belowFull.profile.exportCapability).toBe(true);

      const named = mapFormIntake({ ...minimal, exportDestinationCountries: 'USA, Canada' });
      expect(named.profile.exportCapability).toBe(true);

      const fullyLocal = mapFormIntake({
        ...minimal, exportLocalContentPercent: 100, exportDestinationCountries: 'None',
      });
      expect(fullyLocal.profile.exportCapability).toBe(false);
    });

    it('leaves exportCapability out entirely when neither export question was answered', () => {
      // Not `false`: updateSupplier would write 'false' over a value somebody
      // already captured by hand, and "was never asked" is not "does not export".
      const { profile } = mapFormIntake({ ...minimal, technology: 'CNC' });
      expect('exportCapability' in profile).toBe(false);
      expect(profile).toEqual({ technology: 'CNC' });
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
  businessSector: 'Automotive tier 2',
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
        hqCity: 'Querétaro',
        hqCountry: 'Mexico',
        manufacturingCity: 'Celaya',
        generalManager: 'Ana García',
        firstContactWithNexteer: true,
        toolingDesign: 'In-house',
        rawMaterialIndex: 'LME Aluminium',
        applications: 'Steering columns',
        footprint: 'Global',
        yearsInMexico: 26,
        market: 'Mixed',
        automotivePercent: 65,
        exportLocalContentPercent: 40,
        exportDestinationCountries: 'USA, Canada',
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
        hqCity: '',
        manufacturingCity: '   ',
        generalManager: '',
        toolingDesign: '',
        rawMaterialIndex: '',
        applications: '',
        footprint: '',
        market: '',
        businessSector: '',
        exportDestinationCountries: '',
        safetyCritical: undefined,
        safetyExperience: undefined,
        knowsCQIs: undefined,
        firstContactWithNexteer: undefined,
        yearsInMexico: undefined,
        automotivePercent: undefined,
        exportLocalContentPercent: undefined,
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
