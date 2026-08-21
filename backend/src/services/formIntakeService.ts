import type { PrismaClient } from '@prisma/client';
import type { AuthUser } from '../middleware/auth';
import {
  mapFormIntake,
  SCOUTING_INPUT_MAX,
  type FormIntakeInput,
} from '../domain/formIntakeMapper';
import { createSupplier, updateSupplier } from './suppliersService';
import { addSupplierToEvent } from './eventsService';
import { notifyTeam } from './notificationsService';

// ── Public form intake (MS Forms → Power Automate → here) ───────────────
//
// This module is a CALLER of the registration logic, never a second copy of it:
// folio allocation, FK resolution, the birth history entry, the "new supplier"
// notification and the transaction that holds them together all stay inside
// createSupplier/addSupplierToEvent. What lives here is only what is specific to
// an unattended, external submission — the DUNS pre-check, resolving an event by
// the NAME the vendor picked, and what to do when that name matches nothing.

/**
 * The actor every intake write is attributed to. The route is mounted before
 * `authenticate()`, so there is no `req.user` to fall back on and inventing one
 * per request would put an arbitrary human's name on a record they never
 * touched. A fixed synthetic identity instead: it shows up verbatim in the
 * supplier's history entry and in the `Buyer` column when the Form sends no
 * buyer, which is exactly the provenance GSM needs when they open the record.
 *
 * `role: 'SSD'` because the two service functions read `actor.role` only to
 * stamp that history entry — this object is never authorization for anything.
 * It also carries no matching row in `C_User`, so `excludeUserId` below excludes
 * nobody and the whole operational team is notified.
 */
export const FORM_INTAKE_ACTOR: AuthUser = {
  id: 'system-form-intake',
  username: 'form-intake',
  displayName: 'MS Forms Intake',
  role: 'SSD',
};

/** `'Event'` carries the event's NAME (what the vendor picked), not an id. */
export type FormIntakeEntrySource = 'Event' | 'Recommendation';

export interface FormIntakeRequest extends FormIntakeInput {
  entrySource: FormIntakeEntrySource;
  /** Required by the controller's schema when `entrySource === 'Event'`. */
  eventName?: string;
}

/**
 * Deliberately a result, not an exception, for the duplicate case. The 409 has
 * to carry the existing `id` and `folio` so Power Automate's flow can branch on
 * them, and `createErrorHandler` renders an `ApiError` as `{error, code}` and
 * nothing else — widening that shape for one route would change the body of
 * every other 409 in the API. So the duplicate travels back as data and the
 * controller decides the status code.
 */
export type FormIntakeResult =
  | { outcome: 'created'; id: string; folio: string }
  | { outcome: 'duplicate'; id: string; folio: string; dunsNumber: string };

/** `{ id, folio }` off the DTO `createSupplier` returns. */
function identify(created: Record<string, unknown>): { id: string; folio: string } {
  return { id: String(created.id), folio: String(created.folio) };
}

export async function intakeSupplier(
  prisma: PrismaClient,
  input: FormIntakeRequest,
): Promise<FormIntakeResult> {
  const { core, profile } = mapFormIntake(input);

  // ── 1. Already registered? ────────────────────────────────────────────
  // The Form is public and a vendor who does not get a confirmation mail will
  // submit it again. DUNS is the one field that identifies a company
  // independently of how they typed their name, so it is the duplicate key.
  //
  // There is no unique index behind this (adding one is a schema change, and the
  // column is `''` for every supplier imported from Excel), so two submissions
  // landing in the same millisecond could both pass. Power Automate runs a flow
  // per response, sequentially, so that race is theoretical; a duplicate that
  // does slip through is visible in the tracker and deletable, which is a far
  // smaller problem than rejecting real registrations.
  const existing = await prisma.companyInfo.findFirst({
    where: { dunsNumber: core.dunsNumber },
    select: { supplier: { select: { id: true, folio: true } } },
  });
  if (existing?.supplier) {
    return {
      outcome: 'duplicate',
      id: existing.supplier.id,
      folio: existing.supplier.folio,
      dunsNumber: core.dunsNumber,
    };
  }

  // ── 2. Create, through whichever door the answer names ────────────────
  let created: Record<string, unknown>;
  /** Set only on the "event name matched nothing" path — see the notify below. */
  let unmatchedEventName: string | null = null;

  if (input.entrySource === 'Event') {
    const eventName = (input.eventName ?? '').trim();
    // findFirst, not findUnique: `Name` has no unique constraint. SQL Server's
    // default collation makes this case-insensitive, which is what we want for a
    // string a vendor picked from a list somebody else typed.
    const event = await prisma.event.findFirst({ where: { name: eventName } });

    if (event) {
      // Byte-for-byte the same call eventsController.addSupplier makes, so the
      // EventSupplierEntry link (and its defaults) are identical to an in-app
      // registration — including committing in the supplier's own transaction.
      created = await addSupplierToEvent(prisma, event.id, core, FORM_INTAKE_ACTOR);
    } else {
      // A name we cannot resolve must NOT cost us the registration: the supplier
      // is real and its answers are real. It lands in Scouting Event — the stage
      // it belongs in — with no event link, and the unmatched string is kept in
      // two places: `scoutingInput` on the record itself (where GSM sees it while
      // linking the event by hand) and the notification below.
      unmatchedEventName = eventName;
      created = await createSupplier(
        prisma,
        {
          ...core,
          entrySource: 'Scouting Event',
          scoutingInput: eventName.slice(0, SCOUTING_INPUT_MAX),
        },
        FORM_INTAKE_ACTOR,
      );
    }
  } else {
    // Recommendation → Parking Lot, the same business rule createSupplier
    // applies to form B today.
    created = await createSupplier(
      prisma,
      { ...core, entrySource: 'Recommendation' },
      FORM_INTAKE_ACTOR,
    );
  }

  const { id, folio } = identify(created);

  // ── 3. The satellite answers ──────────────────────────────────────────
  // Same two-step the in-app form uses (`registerSupplierForEvent`): POST the 17
  // core fields, then PATCH everything that lives in CompanyInfo/TechnicalInfo/
  // CommercialInfo. Best-effort on purpose — the supplier row and its folio are
  // already committed, and answering anything other than 201 here would make
  // Power Automate retry a submission that DID land (the DUNS check above would
  // then 409 it, so nothing would be created but the flow would report a
  // failure). A failure is instead made loud twice: an error log with the folio,
  // and a warning notification so somebody re-enters the fields by hand.
  if (Object.keys(profile).length > 0) {
    try {
      await updateSupplier(prisma, id, profile, FORM_INTAKE_ACTOR);
    } catch (err) {
      console.error(`[form-intake] profile patch failed for ${folio} (${id}):`, err);
      await notifyTeam(prisma, {
        message: `${folio} se registró desde el formulario externo, pero sus datos de perfil `
          + '(compañía, técnicos y comerciales) no se pudieron guardar. Complétalos a mano en el detalle del proveedor.',
        type: 'warning',
        category: 'supplier_created',
        link: `/suppliers/supplier/${id}`,
      }).catch(notifyErr => {
        console.error('[notify] form-intake profile-failure notification failed:', notifyErr);
      });
    }
  }

  // ── 4. The unmatched event, said out loud ─────────────────────────────
  // Distinct from the "Nuevo proveedor registrado" notification createSupplier
  // already sent, and it quotes the vendor's answer verbatim: that string is the
  // only clue to which event they meant, and it exists nowhere else GSM will
  // look. Never allowed to fail the request — the supplier is already saved.
  if (unmatchedEventName) {
    try {
      await notifyTeam(prisma, {
        message: `${folio} llegó del formulario externo indicando el evento "${unmatchedEventName}", `
          + 'que no coincide con ningún evento registrado. El proveedor quedó en Scouting Event SIN vincular; '
          + 'enlázalo al evento correcto manualmente.',
        type: 'warning',
        category: 'supplier_created',
        link: `/suppliers/supplier/${id}`,
      });
    } catch (err) {
      console.error('[notify] form-intake unmatched-event notification failed:', err);
    }
  }

  return { outcome: 'created', id, folio };
}
