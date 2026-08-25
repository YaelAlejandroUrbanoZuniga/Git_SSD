import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { FORM_INTAKE_ACTOR, intakeSupplier } from '../../src/services/formIntakeService';
import { FORM_INTAKE_HEADER, requireFormIntakeKey, secretsMatch } from '../../src/middleware/formIntakeAuth';
import { ApiError, ValidationError } from '../../src/domain/errors';
import type { AppEnv } from '../../src/config/env';
import {
  asPrisma, createMockPrisma, fakeSlaCatalog, fakeSupplierRow, type MockPrisma,
} from '../helpers/mockPrisma';

/** The five answers the schema requires; individual cases add to them. */
const body = {
  name: 'ACME METALS',
  commodity: 'Machining',
  dunsNumber: '123456789',
  country: 'Mexico',
  manufacturingAddress: 'Celaya, GTO',
};

describe('formIntakeAuth', () => {
  describe('secretsMatch', () => {
    it('accepts the exact secret', () => {
      expect(secretsMatch('s3cr3t-value', 's3cr3t-value')).toBe(true);
    });

    it('rejects a different secret of the same length', () => {
      expect(secretsMatch('s3cr3t-valuf', 's3cr3t-value')).toBe(false);
    });

    it('rejects — rather than throwing — a secret of a different length', () => {
      // timingSafeEqual throws on mismatched buffers; hashing both sides first is
      // what keeps this a plain `false` (and hides the real secret's length).
      expect(secretsMatch('short', 's3cr3t-value')).toBe(false);
      expect(secretsMatch('', 's3cr3t-value')).toBe(false);
      expect(secretsMatch('s3cr3t-value-and-then-some-more', 's3cr3t-value')).toBe(false);
    });
  });

  describe('requireFormIntakeKey', () => {
    const envWith = (formIntakeSecret: string) => ({ formIntakeSecret } as AppEnv);
    const reqWith = (headers: Record<string, unknown>) => ({ headers } as unknown as Request);
    const res = {} as Response;

    function run(secret: string, headers: Record<string, unknown>): unknown {
      const next = vi.fn() as unknown as NextFunction;
      requireFormIntakeKey(envWith(secret))(reqWith(headers), res, next);
      return (next as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    }

    it('lets a request with the right key through', () => {
      expect(run('s3cr3t', { [FORM_INTAKE_HEADER]: 's3cr3t' })).toBeUndefined();
    });

    it('401s a wrong key', () => {
      const err = run('s3cr3t', { [FORM_INTAKE_HEADER]: 'nope' }) as ApiError;
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(401);
    });

    it('401s a missing key', () => {
      expect((run('s3cr3t', {}) as ApiError).status).toBe(401);
    });

    it('401s a repeated header (it arrives as an array — only one value can be right)', () => {
      expect((run('s3cr3t', { [FORM_INTAKE_HEADER]: ['s3cr3t', 'x'] }) as ApiError).status).toBe(401);
    });

    it('503s — never "no secret means no check" — when FORM_INTAKE_SECRET is unset', () => {
      const err = run('', { [FORM_INTAKE_HEADER]: 'anything' }) as ApiError;
      expect(err.status).toBe(503);
      expect(err.code).toBe('NOT_CONFIGURED');
    });

    it('503s an unconfigured server even with no key at all', () => {
      expect((run('', {}) as ApiError).status).toBe(503);
    });
  });
});

describe('formIntakeService.intakeSupplier', () => {
  let mock: MockPrisma;

  /** Every notification row written by any notifyTeam call in the run. */
  function notifiedMessages(): string[] {
    return mock.notification.createMany.mock.calls
      .flatMap(call => (call[0].data as Array<{ message: string }>))
      .map(row => row.message);
  }

  /** The `data` of the single supplier.create the intake is allowed to issue. */
  function createdSupplier(): any {
    expect(mock.supplier.create).toHaveBeenCalledTimes(1);
    return mock.supplier.create.mock.calls[0][0].data;
  }

  beforeEach(() => {
    mock = createMockPrisma();
    // createSupplier: commodity FK + the row getSupplierById reads back.
    mock.commodity.findUnique.mockResolvedValue({ id: 1, name: 'Machining' });
    mock.supplier.findUnique.mockResolvedValue(fakeSupplierRow());
    // notifyTeam's audience.
    mock.user.findMany.mockResolvedValue([{ id: 'u-pm' }, { id: 'u-buyer' }]);
    // updateSupplier's catalog lookups, for the profile patch.
    mock.sla.findMany.mockResolvedValue(fakeSlaCatalog);
    mock.subStatus.findMany.mockResolvedValue([{ id: 1, name: 'Go' }]);
    mock.productCategory.findMany.mockResolvedValue([{ id: 1, name: 'Direct' }]);
    mock.confidenceLevel.findMany.mockResolvedValue([{ id: 1, code: 'M' }]);
    mock.immexStatus.findMany.mockResolvedValue([{ id: 1, name: 'No' }]);
  });

  describe('Recommendation branch', () => {
    it('creates the supplier in Parking Lot through createSupplier', async () => {
      const result = await intakeSupplier(asPrisma(mock), { ...body, entrySource: 'Recommendation' });

      expect(result).toEqual({ outcome: 'created', id: 'ps1', folio: 'SSD-2026-001' });
      const data = createdSupplier();
      expect(data.entrySource).toBe('Recommendation');
      expect(data.stage.connect.name).toBe('Parking Lot');
      // Recommendation gets the Parking Lot satellite, not the scouting one.
      expect(data.parkingData.create.isRecommendation).toBe(true);
      expect(data.scoutingData).toBeUndefined();
      // No event link on this branch.
      expect(mock.eventSupplierEntry.create).not.toHaveBeenCalled();
    });

    it('allocates the folio inside the same transaction as the create', async () => {
      await intakeSupplier(asPrisma(mock), { ...body, entrySource: 'Recommendation' });
      expect(mock.$transaction).toHaveBeenCalled();
      expect(createdSupplier().folio).toMatch(/^SSD-\d{4}-\d{4}$/);
    });

    it('attributes the record to the synthetic intake actor, not to a real person', async () => {
      await intakeSupplier(asPrisma(mock), { ...body, entrySource: 'Recommendation' });
      const data = createdSupplier();
      expect(data.history.create.user).toBe(FORM_INTAKE_ACTOR.displayName);
      expect(data.buyer).toBe(FORM_INTAKE_ACTOR.displayName);
      expect(FORM_INTAKE_ACTOR.id).toBe('system-form-intake');
    });

    it('still sends the ordinary "new supplier" notification', async () => {
      await intakeSupplier(asPrisma(mock), { ...body, entrySource: 'Recommendation' });
      expect(notifiedMessages().some(m => m.startsWith('Nuevo proveedor registrado'))).toBe(true);
    });
  });

  describe('Event branch — the name matches an event', () => {
    beforeEach(() => {
      mock.event.findFirst.mockResolvedValue({ id: 'ev1', name: 'Expo Manufactura 2026' });
      mock.event.findUnique.mockResolvedValue({ id: 'ev1', name: 'Expo Manufactura 2026' });
    });

    it('resolves the event by NAME and links the supplier through addSupplierToEvent', async () => {
      const result = await intakeSupplier(asPrisma(mock), {
        ...body, entrySource: 'Event', eventName: 'Expo Manufactura 2026',
      });

      expect(result.outcome).toBe('created');
      expect(mock.event.findFirst).toHaveBeenCalledWith({
        where: { name: 'Expo Manufactura 2026' },
      });
      // The same junction row the in-app POST /events/:id/suppliers writes.
      expect(mock.eventSupplierEntry.create).toHaveBeenCalledTimes(1);
      expect(mock.eventSupplierEntry.create.mock.calls[0][0].data).toMatchObject({
        eventId: 'ev1', supplierId: expect.any(String),
        b2bMeeting: false, status: 'Accepted', result: 'Included',
      });
    });

    it('lands in Scouting Event with the event name as scoutingInput', async () => {
      await intakeSupplier(asPrisma(mock), {
        ...body, entrySource: 'Event', eventName: 'Expo Manufactura 2026',
      });
      const data = createdSupplier();
      expect(data.entrySource).toBe('Scouting Event');
      expect(data.stage.connect.name).toBe('Scouting Event');
      expect(data.scoutingInput).toBe('Expo Manufactura 2026');
    });

    it('raises no unmatched-event warning', async () => {
      await intakeSupplier(asPrisma(mock), {
        ...body, entrySource: 'Event', eventName: 'Expo Manufactura 2026',
      });
      expect(notifiedMessages().some(m => m.includes('no coincide'))).toBe(false);
    });
  });

  describe('Event branch — the name matches nothing', () => {
    beforeEach(() => {
      mock.event.findFirst.mockResolvedValue(null);
    });

    const unmatched = { ...body, entrySource: 'Event' as const, eventName: 'Feria Regional del Bajío' };

    it('still creates the supplier, in Scouting Event and with no event link', async () => {
      const result = await intakeSupplier(asPrisma(mock), unmatched);

      expect(result).toEqual({ outcome: 'created', id: 'ps1', folio: 'SSD-2026-001' });
      expect(createdSupplier().entrySource).toBe('Scouting Event');
      expect(mock.eventSupplierEntry.create).not.toHaveBeenCalled();
    });

    it('keeps the unmatched answer on the record itself, in scoutingInput', async () => {
      await intakeSupplier(asPrisma(mock), unmatched);
      expect(createdSupplier().scoutingInput).toBe('Feria Regional del Bajío');
    });

    it('notifies the team with the unmatched string quoted verbatim', async () => {
      await intakeSupplier(asPrisma(mock), unmatched);
      const warning = notifiedMessages().find(m => m.includes('Feria Regional del Bajío'));
      expect(warning).toBeDefined();
      expect(warning).toContain('"Feria Regional del Bajío"');
      // Distinct from the ordinary create notification, which also went out.
      expect(warning).not.toMatch(/^Nuevo proveedor registrado/);
      expect(notifiedMessages().some(m => m.startsWith('Nuevo proveedor registrado'))).toBe(true);
    });

    it('marks that notification as a warning, not routine info', async () => {
      await intakeSupplier(asPrisma(mock), unmatched);
      const rows = mock.notification.createMany.mock.calls
        .flatMap(call => call[0].data as Array<{ message: string; type: string }>);
      expect(rows.find(r => r.message.includes('Feria Regional'))?.type).toBe('warning');
    });
  });

  describe('DUNS duplicate', () => {
    it('reports the existing supplier and writes nothing', async () => {
      mock.companyInfo.findFirst.mockResolvedValue({
        supplier: { id: 'ps-existing', folio: 'SSD-2026-0042' },
      });

      const result = await intakeSupplier(asPrisma(mock), { ...body, entrySource: 'Recommendation' });

      expect(result).toEqual({
        outcome: 'duplicate', id: 'ps-existing', folio: 'SSD-2026-0042', dunsNumber: '123456789',
      });
      expect(mock.supplier.create).not.toHaveBeenCalled();
      expect(mock.notification.createMany).not.toHaveBeenCalled();
    });

    it('checks DUNS before resolving the event — a resubmission touches nothing', async () => {
      mock.companyInfo.findFirst.mockResolvedValue({
        supplier: { id: 'ps-existing', folio: 'SSD-2026-0042' },
      });

      await intakeSupplier(asPrisma(mock), {
        ...body, entrySource: 'Event', eventName: 'Expo Manufactura 2026',
      });

      expect(mock.event.findFirst).not.toHaveBeenCalled();
      expect(mock.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('profile answers', () => {
    it('patches the satellite tables after the create, like the in-app form does', async () => {
      await intakeSupplier(asPrisma(mock), {
        ...body,
        entrySource: 'Recommendation',
        technology: 'CNC',
        employeeRange: 'Medium (51–250)',
        annualRevenueAmount: '12,000,000',
        annualRevenueCurrency: 'USD',
      });

      expect(mock.technicalInfo.upsert).toHaveBeenCalledTimes(1);
      expect(mock.technicalInfo.upsert.mock.calls[0][0].update).toMatchObject({ technology: 'CNC' });
      expect(mock.commercialInfo.upsert.mock.calls[0][0].update).toMatchObject({
        employees: 51, annualRevenue: '12,000,000 USD',
      });
    });

    it('issues no patch at all when the Form sent only the core answers', async () => {
      await intakeSupplier(asPrisma(mock), { ...body, entrySource: 'Recommendation' });
      expect(mock.technicalInfo.upsert).not.toHaveBeenCalled();
      expect(mock.commercialInfo.upsert).not.toHaveBeenCalled();
    });

    it('keeps the 201 when the patch fails — the supplier and its folio already exist', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mock.technicalInfo.upsert.mockRejectedValue(new Error('column went missing'));

      const result = await intakeSupplier(asPrisma(mock), {
        ...body, entrySource: 'Recommendation', technology: 'CNC',
      });

      expect(result).toEqual({ outcome: 'created', id: 'ps1', folio: 'SSD-2026-001' });
      // Loud, not silent: an error log plus a notification naming the folio.
      expect(consoleError).toHaveBeenCalled();
      expect(notifiedMessages().some(m => m.includes('no se pudieron guardar'))).toBe(true);
      consoleError.mockRestore();
    });
  });

  // ── The profile shape check that runs BEFORE the supplier exists ──────
  // Three bands, one rule: invalid ÷ ANSWERED. Below the threshold the bad
  // answers are dropped and named; above it nothing is created at all.
  describe('unstorable profile answers', () => {
    /** 15 answered profile fields, all storable — the "everything fine" baseline. */
    const fifteenAnswers = {
      ...body,
      entrySource: 'Recommendation' as const,
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

    /** The `update` half of each satellite upsert the patch issued. */
    const patched = () => ({
      company: mock.companyInfo.upsert.mock.calls[0]?.[0].update as Record<string, unknown>,
      tech: mock.technicalInfo.upsert.mock.calls[0]?.[0].update as Record<string, unknown>,
      commercial: mock.commercialInfo.upsert.mock.calls[0]?.[0].update as Record<string, unknown>,
    });

    describe('none of them (the normal case)', () => {
      it('saves the whole profile and raises no warning at all', async () => {
        const result = await intakeSupplier(asPrisma(mock), fifteenAnswers);

        expect(result.outcome).toBe('created');
        const { company, tech, commercial } = patched();
        expect(company).toMatchObject({ foundedYear: 1998, taxIdNumber: 'ABC010101AAA' });
        expect(tech).toMatchObject({ technology: 'CNC', safetyCritical: true });
        expect(commercial).toMatchObject({ facilities: 3, topCustomers: 'OEM A, OEM B' });
        // The only notification is the ordinary "new supplier" one.
        expect(notifiedMessages().some(m => m.includes('no se pudieron guardar'))).toBe(false);
        expect(notifiedMessages().some(m => m.startsWith('Nuevo proveedor registrado'))).toBe(true);
      });
    });

    describe('a minority of them (2 of 15 → ratio ≤ 0.5)', () => {
      /** foundedYear must be a four-digit year; facilities cannot be negative. */
      const twoBad = { ...fifteenAnswers, foundedYear: 0, facilities: -3 };

      it('still registers the supplier — 13 answers are worth having', async () => {
        const result = await intakeSupplier(asPrisma(mock), twoBad);
        expect(result).toEqual({ outcome: 'created', id: 'ps1', folio: 'SSD-2026-001' });
      });

      it('saves the 13 valid answers and leaves the 2 bad ones out of the patch', async () => {
        await intakeSupplier(asPrisma(mock), twoBad);

        const { company, tech, commercial } = patched();
        // Dropped, so they can never take the rest of the patch down with them.
        expect('foundedYear' in company).toBe(false);
        expect('facilities' in commercial).toBe(false);
        // Everything else still landed, including the other fields of the same tables.
        expect(company).toMatchObject({ taxIdNumber: 'ABC010101AAA', headquarters: 'Querétaro, QRO' });
        expect(tech).toMatchObject({ technology: 'CNC', certifications: 'IATF 16949' });
        expect(commercial).toMatchObject({
          topCustomers: 'OEM A, OEM B', businessSector: 'Automotive tier 2',
        });
      });

      it('names exactly the 2 dropped fields in a warning notification', async () => {
        await intakeSupplier(asPrisma(mock), twoBad);

        const warning = notifiedMessages().find(m => m.includes('no se pudieron guardar'));
        expect(warning).toBeDefined();
        expect(warning).toContain('foundedYear');
        expect(warning).toContain('facilities');
        expect(warning).toContain('SSD-2026-001');
        // Names the fields — it is not the generic "the PATCH could not run" one.
        expect(warning).not.toContain('(compañía, técnicos y comerciales)');
        // A field that saved fine is never named.
        expect(warning).not.toContain('taxIdNumber');
      });

      it('keeps that warning at warning/supplier_created, like the other two', async () => {
        await intakeSupplier(asPrisma(mock), twoBad);
        const row = mock.notification.createMany.mock.calls
          .flatMap(call => call[0].data as Array<{ message: string; type: string; category: string }>)
          .find(r => r.message.includes('no se pudieron guardar'));
        expect(row?.type).toBe('warning');
        expect(row?.category).toBe('supplier_created');
      });

      it('does not block at exactly half — 1 bad answer out of 2', async () => {
        const result = await intakeSupplier(asPrisma(mock), {
          ...body, entrySource: 'Recommendation', technology: 'CNC', foundedYear: 0,
        });
        expect(result.outcome).toBe('created');
        expect(patched().tech).toMatchObject({ technology: 'CNC' });
      });
    });

    describe('most of them (9 of 15 → ratio > 0.5)', () => {
      /** Nine answers that cannot be stored: a bad year, a negative count, seven
       *  strings wider than their column. Six others are perfectly fine. */
      const nineBad = {
        ...fifteenAnswers,
        foundedYear: 0,
        facilities: -3,
        headquarters: 'x'.repeat(301),
        technology: 'x'.repeat(201),
        machineryType: 'x'.repeat(201),
        processMethod: 'x'.repeat(201),
        materials: 'x'.repeat(301),
        complementaryOperations: 'x'.repeat(301),
        certifications: 'x'.repeat(301),
      };

      it('creates nothing and 400s naming every invalid field', async () => {
        let thrown: unknown;
        try {
          await intakeSupplier(asPrisma(mock), nineBad);
        } catch (err) {
          thrown = err;
        }

        expect(thrown).toBeInstanceOf(ValidationError);
        const { message, status } = thrown as ValidationError;
        expect(status).toBe(400);
        for (const field of [
          'foundedYear', 'facilities', 'headquarters', 'technology', 'machineryType',
          'processMethod', 'materials', 'complementaryOperations', 'certifications',
        ]) {
          expect(message).toContain(field);
        }
        // And it says how bad it was, in the terms the rule is written in.
        expect(message).toContain('9 of the 15');
      });

      it('writes NOTHING — no supplier, no folio, no notification, not even a read', async () => {
        await expect(intakeSupplier(asPrisma(mock), nineBad)).rejects.toBeInstanceOf(ValidationError);

        expect(mock.supplier.create).not.toHaveBeenCalled();
        expect(mock.$transaction).not.toHaveBeenCalled();
        expect(mock.notification.createMany).not.toHaveBeenCalled();
        expect(mock.companyInfo.upsert).not.toHaveBeenCalled();
        // The shape rejection lands before the DUNS lookup, like every other one.
        expect(mock.companyInfo.findFirst).not.toHaveBeenCalled();
      });

      it('refuses an Event submission without consuming the event link either', async () => {
        mock.event.findFirst.mockResolvedValue({ id: 'ev1', name: 'Expo Manufactura 2026' });

        await expect(intakeSupplier(asPrisma(mock), {
          ...nineBad, entrySource: 'Event', eventName: 'Expo Manufactura 2026',
        })).rejects.toBeInstanceOf(ValidationError);

        expect(mock.event.findFirst).not.toHaveBeenCalled();
        expect(mock.eventSupplierEntry.create).not.toHaveBeenCalled();
      });
    });

    describe('blank answers are never failures', () => {
      it('registers a mostly-unanswered Form exactly like any other partial profile', async () => {
        // 3 answers given, every other optional question left blank — compact()
        // dropped them, so the ratio only ever sees the 3.
        const result = await intakeSupplier(asPrisma(mock), {
          ...body,
          entrySource: 'Recommendation',
          technology: 'CNC',
          foundedYear: 1998,
          certifications: 'IATF 16949',
          taxIdNumber: '',
          companyType: '   ',
          headquarters: '',
          machineryType: '',
          materials: '',
          productionVolume: '',
          topCustomers: '',
          employeeRange: '',
          annualRevenueAmount: '',
          pressCapacityValue: '',
          safetyCritical: undefined,
          knowsCQIs: undefined,
          exportDestinationCountries: '',
          exportLocalContentPercent: undefined,
          immexAnswer: undefined,
          facilities: undefined,
        });

        expect(result).toEqual({ outcome: 'created', id: 'ps1', folio: 'SSD-2026-001' });
        // Only the three answers reach the patch, and nothing is reported dropped.
        expect(patched().tech).toEqual({ technology: 'CNC', certifications: 'IATF 16949' });
        expect(patched().company).toEqual({ foundedYear: 1998 });
        expect(notifiedMessages().some(m => m.includes('no se pudieron guardar'))).toBe(false);
      });
    });
  });
});
