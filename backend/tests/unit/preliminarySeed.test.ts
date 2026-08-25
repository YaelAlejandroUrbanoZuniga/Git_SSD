import { describe, expect, it } from 'vitest';
import {
  buildPreliminarySeed,
  formatExportCapability,
  type PreliminarySeedSource,
} from '../../src/domain/preliminarySeed';

/** A supplier whose external-form profile is answered end to end. */
const fullProfile: PreliminarySeedSource = {
  buyer: 'Ana García',
  country: 'Mexico',
  manufacturingAddress: 'Parque Industrial Celaya, GTO',
  commodity: { name: 'Machining' },
  companyInfo: {
    fullName: 'ACME MANUFACTURING S.A. DE C.V.',
    dunsNumber: '123456789',
    companyType: 'Tier 1',
    foundedYear: 1998,
    headquarters: 'Av. Reforma 100, CDMX',
    hqCity: 'Ciudad de México',
    hqCountry: 'Mexico',
    manufacturingCity: 'Celaya',
    generalManager: 'Luis Ramírez',
  },
  technicalInfo: {
    technology: 'CNC Machining',
    machineryType: 'Multi-axis lathes',
    processMethod: 'Turning + milling',
    pressCapacity: '400 ton',
    materials: 'Aluminium, steel',
    complementaryOperations: 'Heat treatment, plating',
    certifications: 'IATF 16949, ISO 14001',
    toolingDesign: 'In-house',
    rawMaterialIndex: 'LME Aluminium',
    applications: 'Steering columns',
  },
  commercialInfo: {
    annualRevenue: '120000000 USD',
    productionVolume: '2M pieces/year',
    employees: 450,
    facilities: 3,
    topCustomers: 'GM, Ford, Stellantis',
    footprint: 'North America',
    yearsInMexico: 26,
    market: 'Automotive',
    exportLocalContentPercent: 70,
    exportDestinationCountries: 'USA, Canada',
  },
};

describe('buildPreliminarySeed', () => {
  it('maps every profile column onto its PreliminaryData twin', () => {
    expect(buildPreliminarySeed(fullProfile)).toEqual({
      // Overview
      commodity: 'Machining',
      buyer: 'Ana García',
      companyName: 'ACME MANUFACTURING S.A. DE C.V.',
      dunsNumber: '123456789',
      companyType: 'Tier 1',
      foundedYear: 1998,
      hqAddress: 'Av. Reforma 100, CDMX',
      hqCity: 'Ciudad de México',
      hqCountry: 'Mexico',
      generalManager: 'Luis Ramírez',
      manufacturingCity: 'Celaya',
      manufacturingAddress: 'Parque Industrial Celaya, GTO',
      manufacturingCountry: 'Mexico',
      footprint: 'North America',
      yearsInMexico: 26,
      facilities: 3,
      employees: 450,
      annualRevenue: '120000000 USD',
      productionVolume: '2M pieces/year',
      mainTechnology: 'CNC Machining',
      pressCapacity: '400 ton',
      market: 'Automotive',
      topCustomers: 'GM, Ford, Stellantis',
      exportCapability: '70% local content, exports to: USA, Canada',
      certifications: 'IATF 16949, ISO 14001',
      // Capabilities
      machineryType: 'Multi-axis lathes',
      processingMethod: 'Turning + milling',
      complementaryOps: 'Heat treatment, plating',
      toolingDesign: 'In-house',
      materials: 'Aluminium, steel',
      rawMaterialIndex: 'LME Aluminium',
      applications: 'Steering columns',
    });
  });

  it('reads manufacturing address/country off the Supplier row, not CompanyInfo', () => {
    const seed = buildPreliminarySeed(fullProfile);
    expect(seed.manufacturingAddress).toBe('Parque Industrial Celaya, GTO');
    expect(seed.manufacturingCountry).toBe('Mexico');
    // hqAddress is the one that comes from CompanyInfo.headquarters.
    expect(seed.hqAddress).toBe('Av. Reforma 100, CDMX');
  });

  it('seeds nothing at all from a supplier with no profile rows', () => {
    expect(
      buildPreliminarySeed({
        buyer: null,
        country: null,
        manufacturingAddress: null,
        commodity: null,
        companyInfo: null,
        technicalInfo: null,
        commercialInfo: null,
      }),
    ).toEqual({});
  });

  it('omits keys — rather than seeding null/empty/zero placeholders', () => {
    const seed = buildPreliminarySeed({
      buyer: '   ',
      country: '',
      manufacturingAddress: null,
      commodity: { name: null },
      companyInfo: {
        fullName: 'ACME',
        dunsNumber: '  ',
        // 0 is what an unanswered numeric question leaves behind, not a year.
        foundedYear: 0,
        headquarters: null,
      },
      technicalInfo: { technology: '', materials: 'Steel' },
      commercialInfo: { employees: 0, facilities: 0, yearsInMexico: 0, market: null },
    });

    expect(seed).toEqual({ companyName: 'ACME', materials: 'Steel' });
    // Explicitly: the keys are absent, not present-and-null, so spreading the
    // seed into a Prisma `create` cannot write a null over a column default.
    for (const key of ['dunsNumber', 'foundedYear', 'employees', 'buyer', 'commodity']) {
      expect(seed).not.toHaveProperty(key);
    }
  });

  it('seeds only what a partly answered profile actually holds', () => {
    const seed = buildPreliminarySeed({
      buyer: 'Ana García',
      country: 'Mexico',
      manufacturingAddress: 'Celaya, GTO',
      commodity: { name: 'Forging' },
      companyInfo: { fullName: 'ACME', dunsNumber: '123456789' },
      technicalInfo: null,
      commercialInfo: null,
    });

    expect(seed).toEqual({
      buyer: 'Ana García',
      commodity: 'Forging',
      companyName: 'ACME',
      dunsNumber: '123456789',
      manufacturingAddress: 'Celaya, GTO',
      manufacturingCountry: 'Mexico',
    });
  });

  it('trims the values it does seed', () => {
    const seed = buildPreliminarySeed({
      buyer: '  Ana García  ',
      country: null,
      manufacturingAddress: null,
      companyInfo: { fullName: '  ACME  ' },
    });
    expect(seed).toEqual({ buyer: 'Ana García', companyName: 'ACME' });
  });
});

describe('formatExportCapability', () => {
  it('joins both answers into the free-text shape the migrated Excel rows use', () => {
    expect(formatExportCapability(70, 'USA, Canada')).toBe('70% local content, exports to: USA, Canada');
  });

  it('writes whichever half was answered on its own', () => {
    expect(formatExportCapability(70, null)).toBe('70% local content');
    expect(formatExportCapability(null, 'USA, Canada')).toBe('exports to: USA, Canada');
  });

  it('keeps 0% local content — a vendor that imports everything did answer', () => {
    expect(formatExportCapability(0, null)).toBe('0% local content');
  });

  it('is undefined when neither question was answered', () => {
    expect(formatExportCapability(null, null)).toBeUndefined();
    expect(formatExportCapability(undefined, undefined)).toBeUndefined();
    expect(formatExportCapability(null, '   ')).toBeUndefined();
  });

  it('never exceeds the NVarChar(300) column, and keeps the percent when it clamps', () => {
    const value = formatExportCapability(70, 'Country, '.repeat(60))!;
    expect(value.length).toBe(300);
    expect(value.startsWith('70% local content, exports to: ')).toBe(true);
  });
});
