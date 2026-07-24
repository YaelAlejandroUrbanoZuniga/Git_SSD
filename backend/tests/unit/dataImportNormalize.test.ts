import { describe, expect, it } from 'vitest';
import {
  extractInt, extractYear, mapCommodity, normalizeBuyer, normalizeEventName,
  normalizeImmex, normalizeName, normalizePlanToGetImmex, normalizeSubStatus, normalizeYN,
  parseExcelDate, resolveEntrySource, resolveStage, truncate,
} from '../../data-import/normalize';

// These are the functions where a silent error corrupts imported data at scale
// (backend/data-import/parse.ts). Every case below is drawn from the real GSM sheets.

describe('normalizeName (dedup comparison key)', () => {
  it('folds case so OGAWA == Ogawa', () => {
    expect(normalizeName('OGAWA')).toBe(normalizeName('Ogawa'));
    expect(normalizeName('OGAWA')).toBe('ogawa');
  });

  it('strips accents and societal suffixes', () => {
    expect(normalizeName('BOSCH México S.A. de C.V.')).toBe('bosch mexico');
    expect(normalizeName('MINAMIDA MEXICANA SA DE CV')).toBe('minamida mexicana');
    expect(normalizeName('WALOR NORTH AMERICA INC.')).toBe('walor north america');
    expect(normalizeName('Mubea de México S. de R.L de C.V.')).toBe('mubea de mexico');
  });

  it('strips leading company markers (Grupo/Group)', () => {
    expect(normalizeName('Grupo Industrial Saltillo')).toBe('industrial saltillo');
  });

  it('collapses punctuation and whitespace to single spaces', () => {
    expect(normalizeName('A&B   TEKINIK')).toBe('a b tekinik');
    expect(normalizeName('  Almity (India) - (Puebla) ')).toBe('almity india puebla');
  });

  it('returns empty string for empty/nullish input', () => {
    expect(normalizeName('')).toBe('');
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
  });
});

describe('mapCommodity', () => {
  it('applies the GSM direct equivalences', () => {
    expect(mapCommodity('Plastics')).toEqual({ commodity: 'Plastic', reason: 'alias' });
    expect(mapCommodity('Stamping')).toEqual({ commodity: 'Stampings', reason: 'alias' });
    expect(mapCommodity('Casting')).toEqual({ commodity: 'Castings', reason: 'alias' });
    expect(mapCommodity('Extrusion')).toEqual({ commodity: 'Extrusions', reason: 'alias' });
    expect(mapCommodity('Powder metal')).toEqual({ commodity: 'Powder Metal', reason: 'alias' });
  });

  it('folds case/whitespace against the catalog', () => {
    expect(mapCommodity('machining')).toEqual({ commodity: 'Machining', reason: 'catalog' });
    expect(mapCommodity('  Stampings ')).toEqual({ commodity: 'Stampings', reason: 'catalog' });
  });

  it('sends the two aggregated values to the placeholder (expected)', () => {
    expect(mapCommodity('E-MECHANICAL COMPONENTS -- HEADERS, CONNECTORS, LEADFRAME, PCB'))
      .toEqual({ commodity: 'TBD -- Pending GSM', reason: 'aggregated' });
    expect(mapCommodity('CONTROLLERS -- CCA, MSB, PHA'))
      .toEqual({ commodity: 'TBD -- Pending GSM', reason: 'aggregated' });
  });

  it('sends an unknown value to the placeholder as an incident, never inventing a value', () => {
    expect(mapCommodity('Systems')).toEqual({ commodity: 'TBD -- Pending GSM', reason: 'unmapped' });
  });

  it('treats empty as the placeholder (not an incident)', () => {
    expect(mapCommodity('')).toEqual({ commodity: 'TBD -- Pending GSM', reason: 'empty' });
  });
});

describe('truncate', () => {
  it('leaves a string that fits unchanged', () => {
    expect(truncate('abc', 5)).toBe('abc');
    expect(truncate('abcde', 5)).toBe('abcde');
  });

  it('cuts and appends a single-char ellipsis, never exceeding maxLen', () => {
    const out = truncate('a'.repeat(300), 200);
    expect(out).toHaveLength(200);
    expect(out.endsWith('…')).toBe(true);
    expect(out.slice(0, 199)).toBe('a'.repeat(199));
  });

  it('handles tiny limits', () => {
    expect(truncate('abcdef', 1)).toBe('a');
  });
});

describe('extractInt (Int? columns that carry prose)', () => {
  it('takes the first integer anywhere in the text', () => {
    expect(extractInt('598 globally')).toBe(598);
    expect(extractInt('150 Mex')).toBe(150);
    expect(extractInt('3 production plants, 2 sales offices')).toBe(3);
    expect(extractInt('26 Years')).toBe(26);
    expect(extractInt('3500')).toBe(3500);
  });

  it('tolerates thousands separators', () => {
    expect(extractInt('1,200 units')).toBe(1200);
  });

  it('returns null when there is no number', () => {
    expect(extractInt('NA')).toBeNull();
    expect(extractInt('')).toBeNull();
    expect(extractInt(null)).toBeNull();
  });
});

describe('extractYear (foundedYear from prose)', () => {
  it('takes the first 4-digit year', () => {
    expect(extractYear('Headquarter 1911 / New Boston plant 2022')).toBe(1911);
    expect(extractYear('1965 in Basque Country, Spain')).toBe(1965);
  });

  it('returns null with no year (a bare count is not a year)', () => {
    expect(extractYear('NA')).toBeNull();
    expect(extractYear('26 Years')).toBeNull();
  });
});

describe('resolveStage (most-advanced-reached; blacklist always wins)', () => {
  it('resolves the most advanced active stage', () => {
    expect(resolveStage({ inScouting: true }).stage).toBe('Scouting Event');
    expect(resolveStage({ inParking: true }).stage).toBe('Parking Lot');
    expect(resolveStage({ inPreliminary: true }).stage).toBe('Preliminary Evaluation');
    expect(resolveStage({ reachedSupplierEval: true }).stage).toBe('Supplier Evaluation');
    expect(resolveStage({ reachedIntelex: true }).stage).toBe('Intelex Handoff');
  });

  it('picks the furthest when several layers are present', () => {
    const r = resolveStage({ inScouting: true, inParking: true, inPreliminary: true });
    expect(r).toEqual({ stage: 'Preliminary Evaluation', status: 'ACTIVE', stageBeforeExit: null });
  });

  it('marks active suppliers with no exit and no stageBeforeExit', () => {
    expect(resolveStage({ inParking: true }).status).toBe('ACTIVE');
    expect(resolveStage({ inParking: true }).stageBeforeExit).toBeNull();
  });

  it('blacklist wins and records stageBeforeExit = furthest reached', () => {
    expect(resolveStage({ inParking: true, reachedIntelex: true, inBlacklist: true }))
      .toEqual({ stage: 'Intelex Handoff', status: 'BLACKLISTED', stageBeforeExit: 'Intelex Handoff' });
  });

  it('floors a blacklist-only supplier at Scouting Event', () => {
    expect(resolveStage({ inBlacklist: true }))
      .toEqual({ stage: 'Scouting Event', status: 'BLACKLISTED', stageBeforeExit: 'Scouting Event' });
  });

  it('never returns Completed', () => {
    for (const ev of [{ reachedIntelex: true }, { inBlacklist: true, reachedIntelex: true }]) {
      expect(resolveStage(ev).stage).not.toBe('Completed');
    }
  });
});

describe('parseExcelDate', () => {
  it('formats a JS Date as YYYY-MM-DD (UTC)', () => {
    expect(parseExcelDate(new Date(Date.UTC(2026, 1, 17)))).toBe('2026-02-17');
  });

  it('treats junk literals and the 1899 epoch time as null', () => {
    for (const junk of ['TBD', 'TBC', '-', '#VALUE!', '', 'NA']) expect(parseExcelDate(junk)).toBeNull();
    expect(parseExcelDate(new Date(Date.UTC(1899, 11, 30)))).toBeNull();
  });

  it('passes ISO through and converts US m/d/yyyy', () => {
    expect(parseExcelDate('2026-03-15')).toBe('2026-03-15');
    expect(parseExcelDate('3/15/2026')).toBe('2026-03-15');
  });
});

describe('IMMEX normalization', () => {
  it('maps the catalog values and the TBD/NO variants', () => {
    expect(normalizeImmex('TBD')).toBe('TBC');
    expect(normalizeImmex('NO')).toBe('No');
    expect(normalizeImmex('')).toBe('TBC');
    expect(normalizeImmex('Yes')).toBe('Yes');
    expect(normalizeImmex('In Plan')).toBe('In Plan');
  });

  it('normalizes plan-to-get-IMMEX sentences to Y/N/null (never truncates)', () => {
    expect(normalizePlanToGetImmex('No, We do not have a facility in Mexico…')).toBe('N');
    expect(normalizePlanToGetImmex('Yes, We plan to open one')).toBe('Y');
    expect(normalizePlanToGetImmex('NA')).toBeNull();
    expect(normalizePlanToGetImmex('')).toBeNull();
  });

  it('normalizes Y/N fundamentals flags', () => {
    expect(normalizeYN('Y')).toBe('Y');
    expect(normalizeYN('no')).toBe('N');
    expect(normalizeYN('TBD')).toBeNull();
  });
});

describe('buyer / event / status / entrySource normalization', () => {
  it('maps buyer aliases to the official seeded names, keeps unknowns and two-person values', () => {
    expect(normalizeBuyer('Oscar Sanchez')).toBe('Oscar Alejandro Sanchez');
    expect(normalizeBuyer('Mguel Molina')).toBe('Miguel Angel Molina');
    expect(normalizeBuyer('Arturo Armendariz')).toBe('Christian Arturo Armendariz');
    expect(normalizeBuyer('Juan Ramirez')).toBe('Juan Ramirez');
    expect(normalizeBuyer('Fernando Ramos / Diego Campos')).toBe('Fernando Ramos / Diego Campos');
  });

  it('maps event-name aliases to canonical', () => {
    expect(normalizeEventName('CAPIM 2026')).toBe('CAPIM');
    expect(normalizeEventName('Automotive Meeting Queretaro')).toBe('Automotive Meetings Querétaro');
  });

  it('resolves entrySource from the scouting input', () => {
    expect(resolveEntrySource('CAPIM 2026')).toBe('Scouting Event');
    expect(resolveEntrySource('Automotive Meetings Querétaro')).toBe('Scouting Event');
    expect(resolveEntrySource('Known from previous experience')).toBe('Recommendation');
    expect(resolveEntrySource('Development Need (Last File)')).toBe('Recommendation');
    expect(resolveEntrySource('Juan Carlos Solis Recommendation')).toBe('Recommendation');
    expect(resolveEntrySource('')).toBe('Recommendation');
  });

  it('normalizes parking sub-status case (On hold → On Hold)', () => {
    expect(normalizeSubStatus('On hold')).toBe('On Hold');
    expect(normalizeSubStatus('No Go')).toBe('No Go');
    expect(normalizeSubStatus('go')).toBe('Go');
    expect(normalizeSubStatus('Under Evaluation')).toBe('Under Evaluation');
    expect(normalizeSubStatus('whatever')).toBeNull();
  });
});
