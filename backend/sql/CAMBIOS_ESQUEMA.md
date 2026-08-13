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
a scouting event and needs Buyers/PMs/SQD to mark interest **before** the event.
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
