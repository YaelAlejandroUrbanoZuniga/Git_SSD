import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertTestDatabase, assertWritableDatabase } from '../../src/config/testDatabaseGuard';

const ORIGINAL_ENV = { ...process.env };

function setDatabaseUrl(database: string): void {
  process.env.DATABASE_URL = `sqlserver://localhost:1433;database=${database};trustServerCertificate=true`;
}

describe('testDatabaseGuard', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  describe('assertTestDatabase', () => {
    it('passes against a _TEST database', () => {
      setDatabaseUrl('MX_MFGIT_SSD_TEST');
      expect(() => assertTestDatabase('[seed:demo]')).not.toThrow();
    });

    it('throws against production, with no override available', () => {
      setDatabaseUrl('MX_MFGIT_SSD');
      process.env.ALLOW_PRODUCTION_IMPORT = 'true';
      expect(() => assertTestDatabase('[seed:demo]')).toThrow(/refuses to run against non-TEST database/);
    });
  });

  describe('assertWritableDatabase', () => {
    it('passes against a _TEST database', () => {
      setDatabaseUrl('MX_MFGIT_SSD_TEST');
      expect(() => assertWritableDatabase('[import]')).not.toThrow();
    });

    it('throws against production when ALLOW_PRODUCTION_IMPORT is not set', () => {
      setDatabaseUrl('MX_MFGIT_SSD');
      delete process.env.ALLOW_PRODUCTION_IMPORT;
      expect(() => assertWritableDatabase('[import]')).toThrow(/ALLOW_PRODUCTION_IMPORT=true/);
    });

    it('passes against production when ALLOW_PRODUCTION_IMPORT=true and prints a warning banner', () => {
      setDatabaseUrl('MX_MFGIT_SSD');
      process.env.ALLOW_PRODUCTION_IMPORT = 'true';
      const warnSpy = vi.spyOn(console, 'warn');

      expect(() => assertWritableDatabase('[import]')).not.toThrow();
      expect(warnSpy).toHaveBeenCalled();
      const printed = warnSpy.mock.calls.flat().join('\n');
      expect(printed).toMatch(/PRODUCCIÓN/);
      expect(printed).toMatch(/MX_MFGIT_SSD/);
    });

    it('does not pass against production with an inexact ALLOW_PRODUCTION_IMPORT value', () => {
      setDatabaseUrl('MX_MFGIT_SSD');
      process.env.ALLOW_PRODUCTION_IMPORT = 'TRUE';
      expect(() => assertWritableDatabase('[import]')).toThrow();
    });
  });
});
