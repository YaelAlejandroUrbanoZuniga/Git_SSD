# Technical debt register

Deliberate shortcuts taken for the TEST phase that must not be forgotten before
the system is promoted to the production database (`MX_MFGIT_SSD`). Each entry
records why the shortcut was taken, what resolving it actually requires, and
the trigger that should prompt the resolution — so the reasoning survives even
after the people who made the call have moved on.

---

## 1. Visit-tab columns still live under `T_Supplier_PreliminaryData`

**Incurred:** 2026-08-07
**Trigger to resolve:** promotion to the production database `MX_MFGIT_SSD`.

### What happened

When GSM moved the **Visit** tab from *Preliminary Evaluation* to *Supplier
Evaluation*, only the tab and its completion flag (`TabVisit`) moved. The
underlying data columns — `VisitDatePlanned`, `VisitDateCompleted`,
`VisitParticipants`, `Strengths`, `Weaknesses`, `Observations`,
`Recommendations` — stayed in `T_Supplier_PreliminaryData` under their
`prelim_*` wire names, even though the tab that reads and writes them is now
part of Supplier Evaluation. See `backend/prisma/schema.prisma`
(`PreliminaryData.visitDatePlanned` and friends) and
`backend/sql/2026-08-07_move_visit_tab_and_add_costmodel.sql` for the change
that was actually applied.

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

### Resolution required

1. Add `VisitDatePlanned`, `VisitDateCompleted`, `VisitParticipants`,
   `Strengths`, `Weaknesses`, `Observations`, `Recommendations` to
   `T_Supplier_EvaluationData` (mirroring the columns currently on
   `T_Supplier_PreliminaryData`).
2. Migrate the existing row data across (one `UPDATE ... FROM ... JOIN` per
   the pattern already used for `TabVisit` in
   `backend/sql/2026-08-07_move_visit_tab_and_add_costmodel.sql`).
3. Drop the seven columns from `T_Supplier_PreliminaryData` once the data has
   been copied and verified.
4. Rename the wire contract from `prelim_*` to `eval_*` for these seven
   fields, consistently across:
   - the frontend `TrackerSupplier`/wire type definitions,
   - the backend mapper that translates between Prisma rows and the wire
     shape,
   - the field-routing sets that decide which satellite table a given wire
     key belongs to,
   - `frontend/src/utils/tracker-helpers.ts` — `SUPPLIER_EVALUATION_FIELDS`
     currently lists these keys under their `prelim_*` names and needs
     updating to match.
5. Update `backend/prisma/schema.prisma` to move the seven fields onto the
   `SupplierEvalData` model and re-run `prisma generate`.
6. Write the production migration script under `backend/sql/`, following the
   same idempotent, guarded-`ALTER`/backfill/drop pattern as
   `2026-08-07_move_visit_tab_and_add_costmodel.sql`, and run it by hand
   against `MX_MFGIT_SSD` (the repo's established policy for production
   schema changes — `prisma db push` is TEST-only).

Do **not** perform this migration outside of the production promotion — it is
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
