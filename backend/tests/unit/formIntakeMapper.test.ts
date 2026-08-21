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
