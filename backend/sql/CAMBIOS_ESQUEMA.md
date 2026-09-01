# CAMBIOS_ESQUEMA — running log of schema deltas after the baseline

The database was created from the numbered baseline scripts `01_`–`07_`. Every
structural change made **after** that baseline lives as a dated script in this
folder, and every one of those changes is also recorded here, in chronological
order, with the reason behind it.

**Why a second file next to [`README.md`](README.md).** `README.md` answers an
operational question — *has this script been run in TEST / in PROD yet?* — one
line per file, no context. This file answers the design question: *what does the
schema look like today compared with the baseline, and why did each delta
happen?* That is what gets consumed when the production promotion script is
assembled: whoever writes it needs the deltas in order, with their rationale, not
just a checklist of filenames.

Keep the two in sync — a new script under `sql/` means a new row in `README.md`
**and** a new entry here.

---

## 2026-08-13 — `T_Event_Prospect` (new table)

**Script:** [`2026-08-13_add_event_prospect.sql`](2026-08-13_add_event_prospect.sql)
**Prisma model:** `EventProspect` in `prisma/schema.prisma`

### What was added

One new table, `T_Event_Prospect`, plus two foreign keys and three indexes:

- FK `FK_EventProspect_Event` → `T_Event(PK_Event)`, `ON DELETE CASCADE`.
- FK `FK_EventProspect_InterestedByUser` → `C_User(PK_User)`, nullable, **no
  cascade**.
- `UQ_EventProspect_Event_Company` (unique on `FK_Event` + `CompanyName`) —
  the key the Excel import upserts on.
- `IX_EventProspect_Event`, `IX_EventProspect_ImportBatch`.

No existing table was modified. `T_Supplier`, `T_Event_SupplierEntry` and
`T_Event_B2BMeeting` are untouched by this change.

### Why

SSD receives from the event organizer a list of the companies expected to attend
a scouting event and needs Buyers/PMs/SDE to mark interest **before** the event.
Those companies are prospects, not suppliers:

- Putting them in `T_Supplier` would corrupt the tracker stage counts, the Home
  KPIs, the Reports weekly snapshots and the SLA clocks — all of which the
  business reads as real pipeline. A company that may never show up is not
  pipeline.
- `T_Event_SupplierEntry` could not be reused: its `FK_Supplier` is NOT NULL, so
  it presupposes exactly the `T_Supplier` row a prospect does not have.

A prospect only becomes a supplier the normal way: by filling the external form
on event day.

### Two things about this table that are not obvious from the DDL

- **Interest is a single marker, not a tri-state.** A prospect is unmarked or
  marked by exactly one person; only that person may unmark it. There is no
  "not interested" value — staying unmarked is the answer. The rule is enforced
  in `src/services/eventProspectsService.ts` (409 on a second marker, 403 on a
  foreign unmark), not by a constraint.
- **`FK_ImportBatch` is a per-import-call UUID**, stamped on every row that call
  created *or* updated. It is what makes "undo the import I just did by mistake"
  possible without touching prospects loaded into the same event by a different
  import.

### Related debt

B2B scheduling now exists in two places — see entry 3 in
[`../DEBT.md`](../DEBT.md).

---

## 2026-08-13 — `T_Role_RasicAssignment` (table dropped)

**Script:** [`2026-08-13_drop_role_rasic_assignment.sql`](2026-08-13_drop_role_rasic_assignment.sql)
**Prisma model:** `RoleRasicAssignment` removed from `prisma/schema.prisma`

### What was removed

The `T_Role_RasicAssignment` table (Role × Stage RASIC-type assignment) and
its `rasicAssignments` relations on `Role` and `Stage`.

### Why

The permission model that shipped is a flat SSD-write / everyone-else-read
model plus two named write exceptions (`OPERATIONAL_WRITE_ROLES`,
`PROSPECT_INTEREST_ROLES`/note-write), not a 32-activity RASIC matrix. The
table was scaffolded ahead of that decision and was never seeded, read from,
or written to by any route or service — it had no reader or writer anywhere
in the codebase.

---

## 2026-08-17 — `FK_AuthorUser` on `T_Supplier_Note` and `T_Event_Note`

**Script:** [`2026-08-17_add_note_authorid.sql`](2026-08-17_add_note_authorid.sql)
**Prisma models:** `SupplierNote.authorId`, `EventNote.authorId` in `prisma/schema.prisma`

### What was added

One nullable column per table, each with a non-cascading foreign key:

- `T_Supplier_Note.FK_AuthorUser` → `C_User(PK_User)`, FK
  `FK_SupplierNote_AuthorUser`.
- `T_Event_Note.FK_AuthorUser` → `C_User(PK_User)`, FK
  `FK_EventNote_AuthorUser`.

No column was dropped or altered: `Author` (the display name) stays exactly as
it was, and it is still the value shown in the UI.

### Why

"Only the original author may edit or delete this note" was enforced by
comparing `Author` — a display name — against the actor's `displayName`. A
display name is not an identity, and this produced two real failures:

- Two employees who share a display name could edit and delete each other's
  notes.
- Anyone whose name changed in Active Directory **lost access to their own
  notes**, because `authService` refreshes `DisplayName` from AD on every login
  while the note kept the old spelling.

The FK is the identity the check actually needs. `notesService.isNoteOwner` now
compares by id when the note carries one, and falls back to the display name
when it does not — the same id-first/name-fallback shape
`eventProspectsService.isInterestOwner` already uses for
`T_Event_Prospect.FK_InterestedByUser`.

### Why nullable, and why there is no backfill

Both reasons are the same ones that made `FK_InterestedByUser` nullable:

- Notes written **before** this column have no id to recover. `Author` is
  free text, and matching it back to a `C_User` row would be a guess — a wrong
  match would hand someone else's note to the wrong person.
- Notes written while `AUTH_OPTIONAL=true` come from the demo identity, which
  has **no `C_User` row at all**, so the FK could not hold its id even now.

For both cases `Author` remains the fallback, which is precisely the behaviour
those notes already had — so no existing note changes hands.

---

## 2026-08-24 — fifteen profile columns aligned with the external MS Form

**Script:** [`2026-08-24_align_profile_with_form_intake.sql`](2026-08-24_align_profile_with_form_intake.sql)
**Prisma models:** `CompanyInfo`, `TechnicalInfo`, `CommercialInfo` in `prisma/schema.prisma`

### What was added

Fifteen columns, **every one of them nullable**, spread across the three profile
tables. No existing column was altered or dropped, and
`T_Supplier_PreliminaryData` was not touched at all.

`T_Supplier_CompanyInfo` (+5):

- `HqCity` `NVARCHAR(100)`, `HqCountry` `NVARCHAR(100)`,
  `ManufacturingCity` `NVARCHAR(100)`, `GeneralManager` `NVARCHAR(100)` — twins
  (see below).
- `FirstContactWithNexteer` `BIT` — new.

`T_Supplier_TechnicalInfo` (+3), all three twins:

- `ToolingDesign` `NVARCHAR(100)`, `RawMaterialIndex` `NVARCHAR(200)`,
  `Applications` `NVARCHAR(300)`.

`T_Supplier_CommercialInfo` (+7):

- `Footprint` `NVARCHAR(100)`, `YearsInMexico` `INT`, `Market` `NVARCHAR(100)` —
  twins.
- `BusinessSector` `NVARCHAR(100)`, `AutomotivePercent` `INT`,
  `ExportLocalContentPercent` `INT`, `ExportDestinationCountries`
  `NVARCHAR(300)` — new.

`ExportCapability` **stays, and still stores `'true'`/`'false'`**. The only thing
that changed is where that value comes from: the Form no longer sends a boolean,
so `domain/formIntakeMapper.ts` derives it from the two granular answers (true
when local content is below 100 %, or when destination countries are present and
are not the Form's "None" answer). When neither was answered the key is left out
of the PATCH entirely, so an existing value is preserved.

### Why

The external MS Form (48 questions, filled in by the vendor and relayed by Power
Automate) has been collecting these fifteen answers since day one, and none of
them had a column to land in: `controllers/formIntakeController.ts` strips keys
it does not know — deliberately, so the Form can gain questions without this
endpoint starting to 400 — so all fifteen were silently discarded on every
registration.

Ten of them were already modelled on `PreliminaryData`, which is not the same
thing as being reachable. That satellite is the Preliminary Evaluation tab; the
supplier detail shown in Parking Lot and Scouting Event — where a Form
registration actually lands — does not read it.

Two of the new columns close a data loss the backend README already documented:
export capability arrived as a single boolean, and the real detail (local content
percentage, destination countries) survived only as free text in
`prelim_exportCapability`.

### The duplication with `T_Supplier_PreliminaryData` is deliberate

Ten of the fifteen (`HqCity`, `HqCountry`, `ManufacturingCity`, `GeneralManager`,
`ToolingDesign`, `RawMaterialIndex`, `Applications`, `Footprint`,
`YearsInMexico`, `Market`) already exist, with **the same name, type and width**,
on `T_Supplier_PreliminaryData`. That is not an oversight:

- The two tables are filled at different moments by different actors.
  `PreliminaryData` is captured by SSD during Preliminary Evaluation; these
  columns are answered by the vendor in the Form, before the record exists.
- `PreliminaryData` is not a superset either: a supplier can live its whole life
  in Parking Lot without ever having a row there.

The names, types and widths are kept identical **on purpose**, so the two sides
can be reconciled later with no conversion. **That reconciliation — deciding
which side wins when both hold a value, and whether one of them goes away — is
tracked outside this repository**, not in `DEBT.md` and not here.

### Why nullable, and why there is no backfill

None of the 533 suppliers migrated from Excel has a value for any of the fifteen.
A `DEFAULT` would describe them wrongly — a `0` in `YearsInMexico` does not mean
"zero years", it means "never asked" — and `NOT NULL` could not be applied at all
without inventing data. The intake is additive in the same spirit: an unanswered
question leaves its column NULL and never blocks a registration.

---

## 2026-08-31 — role `SQD` renamed to `SDE` (row rename, no schema change)

**Script:** [`2026-08-31_rename_role_sqd_to_sde.sql`](2026-08-31_rename_role_sqd_to_sde.sql)
**Prisma model:** `Role` in `prisma/schema.prisma` — unaffected structurally;
`C_Role.Name` keeps its `NVARCHAR(20)` type, only the row value changes.

### What changed

The application role `'SQD'` is renamed to `'SDE'` everywhere: the `C_Role.Name`
row, the `AppRole` union and every constant derived from it
(`APP_ROLES`, `OPERATIONAL_READ_ROLES`, `NOTE_WRITE_ROLES`,
`PROSPECT_INTEREST_ROLES` in the backend; `AppRole`/`APP_ROLES` in the
frontend), every route/service comment naming the role, the RBAC and
notification-rules tests, the seed data and demo fixtures, and the visible
role label in User Management. No permission, RBAC rule or behavior changed —
this is a rename of the identifier only.

### Why

`'SQD'` no longer matched the name the business uses for the role day to day.
The rename touches a live NVARCHAR row rather than an enum or a schema
constraint, which is why it ships as a dated data script (like
`2026-08-25_backfill_notification_categories.sql`) instead of an `ALTER TABLE`.

### Why the code change and the SQL script are inseparable

`authService.ts` reads `user.role.name` **literally** as `AppRole` — there is
no mapping layer between the database string and the TypeScript union. Renaming
the code without renaming the `C_Role` row (or the reverse) leaves every user
holding that role with a `role.name` outside `AppRole`, which reads as an
unrecognized role and blocks their access. Both changes ship in the same
commit.

### Scope of the SQL script

Production (`MX_MFGIT_SSD`) does not exist yet, and `sql/prod/04_seed_catalogs.sql`
now seeds `'SDE'` directly — production is born with the new name and never
needs this script. `2026-08-31_rename_role_sqd_to_sde.sql` exists only to bring
the already-seeded TEST database (which has a `'SQD'` row from before this
change) to the same shape as the baseline. It is idempotent — the `UPDATE` only
runs while a `'SQD'` row exists and no `'SDE'` row does yet — and aborts outside
`MX_MFGIT_SSD_TEST`, the same guard `2026-08-25_backfill_notification_categories.sql`
uses.
