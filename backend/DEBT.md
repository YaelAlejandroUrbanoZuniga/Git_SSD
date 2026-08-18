# Technical debt register

Deliberate shortcuts taken for the TEST phase that must not be forgotten before
the system is promoted to the production database (`MX_MFGIT_SSD`). Each entry
records why the shortcut was taken, what resolving it actually requires, and
the trigger that should prompt the resolution — so the reasoning survives even
after the people who made the call have moved on.

---

## 1. Visit-tab columns still live under `T_Supplier_PreliminaryData`

**Incurred:** 2026-08-07
**Part A (application code) completed:** 2026-08-17
**Trigger to resolve Part B:** promotion to the production database
`MX_MFGIT_SSD`.

### What happened

When GSM moved the **Visit** tab from *Preliminary Evaluation* to *Supplier
Evaluation*, only the tab and its completion flag (`TabVisit`) moved. The
underlying data columns — `VisitDatePlanned`, `VisitDateCompleted`,
`VisitParticipants`, `Strengths`, `Weaknesses`, `Observations`,
`Recommendations` — stayed in `T_Supplier_PreliminaryData` under their
`prelim_*` wire names, even though the tab that reads and writes them is now
part of Supplier Evaluation. See
`backend/sql/2026-08-07_move_visit_tab_and_add_costmodel.sql` for the change
that was originally applied.

### Why the shortcut was taken

`MX_MFGIT_SSD_TEST` already held 533 real suppliers. Moving the columns to
`T_Supplier_EvaluationData` would have meant migrating that data for no
functional gain at the time — the tab reads and writes correctly regardless of
which table the columns physically live in, so the grouping mismatch is
invisible to users. Treating this as a pure tab-grouping change (only the
completion flag moved) avoided a data migration that bought nothing for TEST.

### Why it is debt, not a permanent decision

The physical schema no longer matches the tab structure GSM confirmed: Visit
is conceptually part of Supplier Evaluation, but its columns sit on the
Preliminary Evaluation satellite table under a `prelim_*` wire contract that
now describes the wrong stage. This is acceptable for TEST but should not
carry into production, where a clean schema is worth the one-time migration
cost.

### Part A — application code (done, 2026-08-17)

The seven columns now live on `SupplierEvalData` in
`backend/prisma/schema.prisma` (same SQL column names — `VisitDatePlanned`,
`Strengths`, etc. — no collision with existing `SupplierEvalData` columns),
and the application code that reads/writes them was moved to match:

- `backend/prisma/schema.prisma` — the seven fields moved from
  `PreliminaryData` to `SupplierEvalData`.
- `backend/src/mappers/supplierMapper.ts` — the `prelim_visit*`/`strengths`/…
  wire fields are now built from `supplierEvalData`, not `preliminaryData`.
- `backend/src/services/suppliersService.ts` — `SUPPLIER_EVAL_FIELDS` now
  includes the seven `prelim_*` keys, so writes route to `supplierEval` via
  the existing `stripPrefix()` mechanism (same pattern as the Fundamentals
  fields).
- `backend/prisma/seed.ts` — seed data for these seven fields is now written
  under `supplierEvalData.create` instead of `preliminaryData.create`.
- The `prelim_*` wire contract itself did **not** change — the frontend
  (`frontend/src/types/index.ts`, `TrackerSupplierDetail.tsx`,
  `read-only-tabs.tsx`, `tracker-helpers.ts`) needed no changes.

This was validated against `MX_MFGIT_SSD_TEST`'s Prisma client
(`prisma validate` + `prisma generate`, backend/frontend `tsc --noEmit`).

**`MX_MFGIT_SSD_TEST` synced 2026-08-17** (Yael's explicit sign-off): 33 rows
had non-null Visit data in `T_Supplier_PreliminaryData`. Copied via a manual
`UPDATE ... FROM ... JOIN` into the newly-added columns on
`T_Supplier_EvaluationData` first (0 already existed for suppliers without an
`EvaluationData` row, so no `INSERT` branch was needed), verified a 0-row
mismatch between source and destination, then ran
`npx prisma db push --accept-data-loss` to drop the 7 columns from
`T_Supplier_PreliminaryData`. Post-push verification: 33/33 rows intact on
`SupplierEvalData`, backend starts with no schema-mismatch error, and a live
GET + PATCH round-trip on a real supplier confirmed the `prelim_visit*`/
`strengths`/… wire fields read and write correctly.

### Part B — production data migration (still pending)

1. Migrate the existing row data in `MX_MFGIT_SSD` from
   `T_Supplier_PreliminaryData` to `T_Supplier_EvaluationData` (one
   `UPDATE ... FROM ... JOIN` per the pattern already used for `TabVisit` in
   `backend/sql/2026-08-07_move_visit_tab_and_add_costmodel.sql`).
2. Drop the seven columns from `T_Supplier_PreliminaryData` once the data has
   been copied and verified.
3. Rename the wire contract from `prelim_*` to `eval_*` for these seven
   fields, consistently across:
   - the frontend `TrackerSupplier`/wire type definitions,
   - the backend mapper that translates between Prisma rows and the wire
     shape,
   - the field-routing sets that decide which satellite table a given wire
     key belongs to,
   - `frontend/src/utils/tracker-helpers.ts` — `SUPPLIER_EVALUATION_FIELDS`
     currently lists these keys under their `prelim_*` names and needs
     updating to match.
4. Write the production migration script under `backend/sql/`, following the
   same idempotent, guarded-`ALTER`/backfill/drop pattern as
   `2026-08-07_move_visit_tab_and_add_costmodel.sql`, and run it by hand
   against `MX_MFGIT_SSD` (the repo's established policy for production
   schema changes — `prisma db push` is TEST-only).

Do **not** perform Part B outside of the production promotion — it is
deliberately deferred until then.

---

## 2. Blacklisted suppliers cannot re-enter the active pipeline

**Incurred:** 2026-08-10
**Trigger to resolve:** confirmation from SSD/Itzel on whether re-entry should
be allowed at all, and if so, at which stage.

### What happened

`moveSupplierToStage` (`backend/src/services/trackerService.ts`) explicitly
rejects any move on a supplier whose `status` is `BLACKLISTED`:

```ts
if (supplier.status.name === 'BLACKLISTED') {
  throw new BusinessRuleError('Blacklisted suppliers cannot be moved');
}
```

The frontend's `BlacklistedSupplierDetail` was reworked (stage-scoped
read-only tabs, reusing `TabRO*` from the new `pages/tracker/read-only-tabs.tsx`)
without touching this rule — a blacklisted record is still a dead end, just a
better-presented one.

### Why the shortcut was taken

Re-entry was out of scope for the tab-restructure request: it only asked for
read access to the satellite data a blacklisted supplier already carries
(scouting/parking/preliminary/evaluation/intelex, whichever it reached before
rejection), not for a new write path back onto the board. Building a "move
Blacklisted → back to stage X" flow needs product decisions this task had no
mandate to make: which stage should it re-enter at (the one it was rejected
from, or Scouting Event from scratch), does the rejection reason/history stay
visible after re-entry, and does it need a separate approval step.

### Why it is debt, not a permanent decision

Nothing in the domain model rules this out — `BlacklistEntry` already tracks
`fromStage`, so the data needed to resume at the right point exists. The
restriction is a single guard clause, not a structural one.

### Resolution required

1. Get SSD/Itzel to confirm whether blacklisted suppliers should be able to
   re-enter the pipeline, and if so, at which stage.
2. If yes: relax the `BLACKLISTED` check in `moveSupplierToStage`, decide
   whether it should require a distinct endpoint/permission (this is a
   status reversal, not a normal forward move) and whether the `BlacklistEntry`
   history should record the re-entry.
3. Add the corresponding UI entry point — most likely a new action on
   `BlacklistedSupplierDetail` alongside the existing Notes button.

---

## 3. B2B scheduling now exists in two tables

**Incurred:** 2026-08-13
**Trigger to resolve:** whenever the event agenda is unified — i.e. the first
time a screen has to show prospect meetings and supplier meetings in one
chronological list, or the first request to print "the agenda" for an event.

### What happened

`T_Event_Prospect` (`sql/2026-08-13_add_event_prospect.sql`) carries its own
four scheduling columns — `B2bScheduled`, `B2bDateTime`, `B2bLocation`,
`B2bSetBy`/`B2bSetDt` — while `T_Event_B2BMeeting` remains the richer agenda
entity (time, stand, duration, commodity, attendee manager/buyer, status) keyed
to a real `T_Supplier`. Two tables now answer "when is the meeting".

### Why the shortcut was taken

`T_Event_B2BMeeting.FK_Supplier` presupposes a supplier row, and a prospect
deliberately has none — a prospect is a company that *might* attend and only
becomes a `T_Supplier` when it fills the external form on event day. Reusing
that table would have meant either making its supplier link optional (changing
the meaning of every existing row and of the queries that read them) or
inventing placeholder suppliers, which is exactly the `T_Supplier`
contamination the new table exists to avoid. Extending a working, populated
agenda module was out of scope for a change whose job was to add prospects.

### Why it is debt, not a permanent decision

The duplication is invisible today only because nothing renders both sets of
meetings together: prospect B2Bs live on the event's prospect list, supplier
B2Bs on the agenda. The moment one view needs both, the two shapes have to be
reconciled at read time — and the prospect side has no stand, duration or
status to reconcile *with*.

### Resolution required

1. Decide the target shape: most likely `T_Event_B2BMeeting` with a nullable
   `FK_Supplier` **plus** a nullable `FK_Event_Prospect`, exactly one of the two
   set (a check constraint), so a meeting always points at a real counterpart.
2. Migrate the prospect scheduling columns into it (one `INSERT ... SELECT`
   from `T_Event_Prospect` where `B2bScheduled = 1`), and decide what the
   prospect rows get for the fields they never had (stand, duration, status).
3. Drop the five `B2b*` columns from `T_Event_Prospect`, and move
   `setProspectB2b` in `src/services/eventProspectsService.ts` onto the unified
   entity.
4. Do **not** do this piecemeal: the value of the unification is a single
   chronological agenda query, which only exists once both sources are in one
   table.

---

## 4. LDAP service transport and API key (external, Leo's FastAPI service)

**Incurred:** carried since the LDAP integration shipped
**Recorded here:** 2026-08-17 (moved out of `src/auth/ldapClient.ts`, where it
lived as two `TODO(security)` comments)
**Trigger to resolve:** before the system authenticates real users against
production Active Directory.

### What the risk is

Two security issues in the **external** FastAPI/LDAP credential-validation
service this backend depends on — not in this repository:

1. **LDAP runs on port 389 with no encryption** (no LDAPS, no StartTLS), so
   corporate credentials travel the internal network in the clear between the
   FastAPI service and the domain controller.
2. **The FastAPI `API_KEY` is hardcoded in its `config.py`**, so it is a
   constant shared by anyone with access to that source.

(The third historical note — unpinned `requirements.txt` — no longer applies:
the deployed service ships pinned versions.)

### Why it is here and not a code TODO

Neither is fixable from this codebase. Both need a change to a service owned by
another person, and issue 1 needs the domain controller to expose LDAPS and a
certificate to be trusted — a coordination and infrastructure decision, not a
task someone can pick up in `backend/`. As a comment in `ldapClient.ts` it read
like pending work on this file, which it is not.

### Resolution required

1. Agree with the service owner on LDAPS (636) or StartTLS on 389, and confirm
   the CA the FastAPI service must trust.
2. Move the FastAPI `API_KEY` out of `config.py` into that service's own
   environment, and rotate the current value (it must be assumed leaked).
3. Only then is `AUTH_MODE=ldap` safe to point at production AD. Note this
   backend already refuses to start in `ldap` mode without `LDAP_API_URL`
   (`src/config/env.ts`), but it cannot verify anything about the transport.

---

## 5. Prospect → Supplier conversion must reuse the external-form gate

**Incurred:** 2026-08-13 (when `T_Event_Prospect` shipped without conversion)
**Recorded here:** 2026-08-17 (moved out of `src/services/eventsService.ts`,
where it lived as a `TODO(Phase 2)` comment duplicated in
`src/domain/externalFormGate.ts`)
**Trigger to resolve:** when Buyers are given the ability to convert an
interested prospect into a real `Supplier`.

### The pending decision

`T_Event_Prospect` exists and interest can be marked, but there is **no**
prospect → `Supplier` conversion yet. When it is built, the open question is
whether that conversion must satisfy the same precondition the tracker already
enforces elsewhere: `domain/externalFormGate.ts → hasExternalFormData`, which
gates the Parking Lot → Preliminary Evaluation move on DUNS number,
manufacturing country and manufacturing address all being present.

### Why it is a product decision, not a coding task

A prospect is a company name off an organizer's spreadsheet — it has none of
those three fields. Requiring the gate at conversion means a Buyer cannot turn
an interested prospect into a supplier until someone captures that data;
*not* requiring it means suppliers can enter the pipeline through a second
door that skips a rule the first door enforces. Which of the two is correct is
GSM's call, and it changes what the conversion UI has to ask for.

### Resolution required

1. Confirm with SSD/GSM whether conversion requires the external-form data up
   front, or admits an incomplete supplier that the existing stage gate stops
   later.
2. Implement the conversion accordingly, and if the gate applies, call
   `hasExternalFormData` — do not re-implement the field list.
3. `addSupplierToEvent` (Form A) is unaffected: it creates directly from the
   event registration form and is not a prospect conversion.

---

## 6. Dead column `T_Supplier_ParkingData.DaysElapsed`

**Incurred:** predates the audit
**Recorded here:** 2026-08-17 (previously noted only in `backend/README.md`)
**Trigger to resolve:** the next schema cleanup, and at the latest the
promotion to `MX_MFGIT_SSD`.

### What happened

`ParkingData.daysElapsed` is written by nothing in `src/`. It is read once, by
`src/mappers/supplierMapper.ts` (which exposes it as `parkingDaysElapsed`), and
written only by `prisma/seed.ts` for the demo dataset. The live "days in
Parking Lot" figure the UI shows comes from `daysSinceParkingLot` /
`stageEnteredAt` via `domain/sla.ts`, not from this column.

### Why it is debt, not a permanent decision

A column that is read but never maintained is worse than no column: it renders
a number that was true once and has been frozen ever since. It survives because
dropping a column requires a migration and a check that nothing downstream
reads it.

### Resolution required

1. Confirm no consumer depends on `parkingDaysElapsed` on the wire (today only
   the mapper produces it).
2. Drop it from `PreliminaryData`'s sibling `ParkingData` in
   `prisma/schema.prisma`, from the mapper, and from the seed.
3. Add the dated `DROP COLUMN` script under `backend/sql/` with its
   `CAMBIOS_ESQUEMA.md` entry, following the usual promotion process.

---

## 7. No `postinstall` hook to auto-run `prisma generate`

**Incurred:** 2026-08-18, during the Fase 3.A close-out cross-verification.
**Trigger to resolve:** if the manual-reminder approach in `backend/README.md`
turns out not to be enough in practice (someone loses real time to it more than
once).

### What happened

A fresh `npm ci` from the repo root deletes and reinstalls `node_modules`,
which wipes the generated Prisma client. Regenerating it
(`npm run prisma:generate`) requires downloading an engine binary from
`binaries.prisma.sh`, which fails on this network with *"unable to get local
issuer certificate"* unless `NODE_EXTRA_CA_CERTS` points at an exported copy of
the Zscaler root CA (see `backend/README.md`). Verified directly during this
pass: `npm ci` → `npm run typecheck`/`npm test` in backend both failed with
Prisma-client-shaped errors (missing `Prisma.SupplierWhereInput`,
`Prisma.PrismaClientKnownRequestError`, etc.), and `npm run prisma:generate`
itself failed with the certificate error, confirming the failure mode end to
end.

### Why a `postinstall` script was considered and not added

A `"postinstall": "prisma generate"` in `backend/package.json` would run
automatically after every `npm install`/`npm ci`, removing the need to
remember the manual step. It was evaluated and **deliberately not added**:

- On any machine without `NODE_EXTRA_CA_CERTS` pointed at a valid Zscaler CA
  export — a fresh clone, a CI runner, a new teammate's laptop before they've
  exported their cert — a `postinstall` hook would make the download failure
  happen automatically **inside `npm ci` itself**, turning a currently-clear,
  isolated `prisma:generate` failure into an install-time failure that is
  harder to diagnose (the person is now debugging "why does `npm ci` fail"
  instead of "why does `prisma generate` fail").
- `npm ci` is meant to be safe and reliable in non-interactive/CI contexts;
  making it depend on network access to `binaries.prisma.sh` succeeding is a
  new hard dependency this project does not currently have, and CI does not
  need a real Prisma client to run (typecheck/tests are the only consumers,
  and CI does not currently run them against a live-generated client either).
- The manual step is already loud: `backend/README.md`'s Prerequisites section
  states it must be re-run after every `npm ci`, and the failure mode (TS
  errors naming missing `Prisma.*` members, or `instanceof` throwing on
  `undefined`) is distinctive enough to grep for once someone has seen it once.

### Resolution required (if revisited)

If this keeps costing real time, the safer version is not a bare
`postinstall` but a small wrapper script that runs `prisma generate`, catches
a failure, and prints a short pointer to the README section and the
`NODE_EXTRA_CA_CERTS` requirement instead of a raw Prisma stack trace — loud
and fast to diagnose, without making `npm ci` itself fail on a network hiccup.
