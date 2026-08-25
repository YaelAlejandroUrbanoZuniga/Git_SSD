import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { Deps } from '../types/deps';
import { isOptionalEmail } from '../domain/textValidation';
import { IMMEX_ANSWERS } from '../domain/constants';
import type { FormIntakeInput } from '../domain/formIntakeMapper';
import * as formIntakeService from '../services/formIntakeService';

// ── POST /api/public/form-intake — request shape ────────────────────────
//
// A SHAPE guard, nothing more. "Required" below means "Zod requires the key in
// the body", never "this supplier is complete enough to move forward": whether a
// record carries enough to leave Parking Lot is `domain/externalFormGate.ts`'s
// decision and stays there. An intake that satisfies this schema can still be an
// incomplete supplier, and that is fine — it is in the tracker, which is the
// whole point.
//
// The `max` on every string mirrors the NVarChar width of the column it lands
// in (schema.prisma), the same idiom `prospectImportSchema` uses: an over-long
// answer becomes a 400 naming the field here instead of a truncation or an
// opaque driver error three layers down.
//
// Unknown keys are stripped rather than rejected (Zod's default). The Form and
// the Power Automate flow are edited by people who are not looking at this file,
// and a new question they add must not start 400-ing every registration.

/** Trimmed, length-capped free text. `.trim()` runs before `.max()`. */
const text = (max: number) => z.string().trim().max(max);
/** Same, but a blank/whitespace-only answer is a 400 rather than an empty column. */
const requiredText = (max: number) => text(max).min(1);

const optionalEmail = text(200).refine(isOptionalEmail, { message: 'Invalid email format' });

const baseSchema = z.object({
  // ── Required (see the note above on what "required" means here) ────────
  name: requiredText(200),
  // Free-form on the wire: createSupplier validates it against COMMODITIES and
  // C_Commodity, and the mapper turns the Form's "not sure" answer into the
  // pending-GSM placeholder before it gets there.
  commodity: requiredText(100),
  dunsNumber: requiredText(50),
  country: requiredText(100),
  manufacturingAddress: requiredText(300),

  // ── Core, optional ─────────────────────────────────────────────────────
  fullName: text(300).optional(),
  productCategory: z.enum(['Direct', 'Indirect']).optional(),
  productType: text(200).optional(),
  buyer: text(100).optional(),
  website: text(300).optional(),
  phone: text(50).optional(),
  contactEmail: optionalEmail.optional(),
  contactName: text(100).optional(),
  recommendedBy: text(100).optional(),
  recommenderDept: text(100).optional(),

  // ── Profile — CompanyInfo ──────────────────────────────────────────────
  taxIdNumber: text(50).optional(),
  companyType: text(50).optional(),
  foundedYear: z.number().int().optional(),
  headquarters: text(300).optional(),
  hqCity: text(100).optional(),
  hqCountry: text(100).optional(),
  manufacturingCity: text(100).optional(),
  generalManager: text(100).optional(),
  // Q15 — "is this your first contact with Nexteer?".
  firstContactWithNexteer: z.boolean().optional(),

  // ── Profile — TechnicalInfo ────────────────────────────────────────────
  technology: text(200).optional(),
  machineryType: text(200).optional(),
  // Q13's closed-catalog answer. There is deliberately NO field for "Main
  // manufacturing process" — that question does not exist on the Form yet.
  processMethod: text(200).optional(),
  materials: text(300).optional(),
  complementaryOperations: text(300).optional(),
  certifications: text(300).optional(),
  safetyCritical: z.boolean().optional(),
  safetyExperience: z.boolean().optional(),
  knowsCQIs: z.boolean().optional(),
  // Two answers, one NVarChar(100) column — joined by the mapper. The caps here
  // are per-part; the combined length is what the column cares about, and
  // `fitColumn` checks that.
  pressCapacityValue: text(60).optional(),
  pressCapacityUnit: text(40).optional(),
  toolingDesign: text(100).optional(),
  rawMaterialIndex: text(200).optional(),
  applications: text(300).optional(),

  // ── Profile — CommercialInfo ───────────────────────────────────────────
  productionVolume: text(100).optional(),
  facilities: z.number().int().nonnegative().optional(),
  topCustomers: text(300).optional(),
  footprint: text(100).optional(),
  // The Form validates 0–150 on its own side; the same bounds here mean a value
  // that got past it (a hand-built Power Automate test run) is a 400 naming the
  // field, not an implausible number in the column.
  yearsInMexico: z.number().int().min(0).max(150).optional(),
  market: text(100).optional(),
  businessSector: text(100).optional(),
  // Only stored when `market` is 'Mixed' — the mapper drops it otherwise, which
  // is a meaning rule and therefore not this schema's job.
  automotivePercent: z.number().int().min(0).max(100).optional(),
  // The two granular export answers that replaced the old `exportCapability`
  // boolean on the wire. That boolean is no longer accepted here: it is derived
  // from these two in domain/formIntakeMapper.ts and never sent.
  exportLocalContentPercent: z.number().int().min(0).max(100).optional(),
  exportDestinationCountries: text(300).optional(),
  // The Form asks one IMMEX question and Power Automate forwards its answer
  // as-is — one of exactly three strings, no local transformation. Anything else
  // is a 400 naming the field; updateSupplier resolves it to FK_ImmexStatus.
  immexAnswer: z.enum(IMMEX_ANSWERS).optional(),
  // Same pattern as press capacity, against AnnualRevenue NVarChar(50).
  annualRevenueAmount: text(40).optional(),
  annualRevenueCurrency: text(20).optional(),
  // A range label ("Small (11–50)"), not a count — Employees is an Int, so the
  // mapper keeps the lower bound.
  employeeRange: text(60).optional(),
});

/**
 * The branch that decides where the supplier lands. Split as a discriminated
 * union so `eventName` is required exactly when it means something: an 'Event'
 * answer with no event name would otherwise silently take the "no match" path
 * and generate a notification about an empty string.
 */
const intakeSchema = z.discriminatedUnion('entrySource', [
  baseSchema.extend({
    entrySource: z.literal('Event'),
    /** The event's NAME as the vendor picked it — resolved to an id server-side. */
    eventName: requiredText(300),
  }),
  baseSchema.extend({
    entrySource: z.literal('Recommendation'),
  }),
]);

export function formIntakeController(deps: Deps) {
  const intake: RequestHandler = async (req, res, next) => {
    try {
      const input = intakeSchema.parse(req.body);
      // Compile-time proof that the schema still covers everything the mapper
      // reads — add a field to FormIntakeInput and forget it here, and this line
      // stops building.
      const _shapeCheck: FormIntakeInput = input;
      void _shapeCheck;

      // Throws — and therefore 400s through `createErrorHandler`, like every
      // other shape rejection on this endpoint — when more than
      // PROFILE_FAILURE_THRESHOLD of the profile answers the vendor gave cannot
      // be stored. That error's message names each offending field so the Power
      // Automate run says what to fix; nothing was written when it is raised.
      const result = await formIntakeService.intakeSupplier(deps.prisma, input);

      if (result.outcome === 'duplicate') {
        // 409 rather than a second supplier. `id` and `folio` are at the top
        // level so the Power Automate flow can branch on them — log the
        // resubmission for manual review, mail the vendor their existing folio —
        // instead of treating a known company as a failed run.
        res.status(409).json({
          error: `A supplier with DUNS ${result.dunsNumber} already exists (${result.folio}). `
            + 'No second record was created.',
          code: 'CONFLICT',
          id: result.id,
          folio: result.folio,
        });
        return;
      }

      res.status(201).json({ id: result.id, folio: result.folio });
    } catch (err) {
      next(err);
    }
  };

  return { intake };
}
