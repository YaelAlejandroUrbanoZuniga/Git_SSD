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
