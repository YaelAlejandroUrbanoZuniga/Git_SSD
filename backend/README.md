# SSD Tracker Management — Backend

Node.js + Express + TypeScript + Prisma + SQL Server backend for the SSD Tracker
Management frontend (React/Vite app in the sibling `frontend/` folder). The API mirrors
the contract implied by `frontend/src/services/*.ts` and `frontend/src/types/index.ts`,
and the seed reproduces `backend/prisma/fixtures/*.ts` so the frontend looks identical when
pointed at the API (`http://localhost:3000/api`, matching
`frontend/src/services/api.config.ts`).

### Estado de integración (2026-07-17)

**Backend: verificado y funcional.** Conexión real a SQL Server
(`MX_MFGIT_SSD_TEST`), `prisma db push` → *already in sync*, `npm run seed` →
`[seed] done ✔`, y la API completa (auth, tracker, suppliers, events, strategy,
notifications — ver §3) implementada y cubierta por 530 tests.

**Frontend completamente conectado.** Los 6 servicios hacen `fetch` real a la API
(vía `apiFetch`, que normaliza todo error a `ApiError`), y **los datos demo ya no
viven en el frontend en absoluto** — se movieron a `backend/prisma/fixtures/*.ts`,
de donde solo los importa `prisma/seed.ts` para poblar la base.
`TrackerSupplierDetail.tsx`
(el detalle del proveedor) también escribe vía API: sus tab-saves construyen un
patch por diff y llaman `PATCH /api/suppliers/:id`; mover de etapa, blacklist,
completar y promote-B2B usan los endpoints `tracker`; las notas usan los de notas.

**Verificado end-to-end contra `MX_MFGIT_SSD_TEST`** (persistencia tras recarga):
form A → `Scouting Event`, form B → `Parking Lot`, movimiento por las 5 etapas
hasta `Completed`, `blacklist` (razón obligatoria: vacía = 400), y notas
add/edit/delete — todo persiste al re-leer desde la API.

**Nomenclatura Pipeline → Tracker.** Los identificadores de código que usaban
"Pipeline" para el concepto ya renombrado a Tracker se renombraron en backend y
frontend: `PipelineSupplier`→`TrackerSupplier`, `PipelineStage`→`TrackerStage`,
`PipelineDocument`→`TrackerDocument`, `PIPELINE_STAGES`→`TRACKER_STAGES`,
`PIPELINE_STAGE_CONFIG`→`TRACKER_STAGE_CONFIG`, `totalInPipeline`→`totalInTracker`.
Se conserva el archivo `backend/prisma/fixtures/pipeline-demo.ts` y sus variables
exportadas (`pipelineSuppliers`, etc.) por decisión: solo las consume el seed.

---

## 1. Running locally

### Prerequisites

- Node.js ≥ 20 (developed on v24)
- A reachable **SQL Server** instance over **TCP** (Express edition is fine)

> **✅ TCP/IP connectivity — resolved.** The historical blocker (SQL Server Express
> ships with TCP/IP disabled) has been resolved and verified in at least one dev
> environment with a real run: `npm run prisma:generate` (client generated, no
> errors) → `npm run prisma:push:test-only` (`Your database is now in sync with your Prisma
> schema. Done in 2.56s`) → `npm run seed` (all 9 phases — catalogs, commodities,
> users, suppliers, events, strategy entries, MRL requirements, notifications —
> finished with `[seed] done ✔`). If you hit a **new** instance with TCP/IP
> disabled (e.g. `MSSQL$SQLEXPRESS`, instance `MSSQL17.SQLEXPRESS`), these are the
> steps used to fix it before, kept here as reference: *SQL Server Configuration
> Manager → SQL Server Network Configuration → Protocols for SQLEXPRESS → TCP/IP →
> Enabled = Yes*, set a static port (1433) under *IP Addresses → IPAll → TCP Port*,
> then restart the `MSSQL$SQLEXPRESS` service (needs admin rights). Alternatively
> point `DATABASE_URL` at any corporate SQL Server that already has TCP/IP enabled.

> **⚠ Corporate proxy (Zscaler):** Prisma downloads its engines from
> `binaries.prisma.sh`, which is TLS-intercepted here. If `prisma generate` fails with
> *"unable to get local issuer certificate"*, export the Zscaler root CA to a PEM file
> and set `NODE_EXTRA_CA_CERTS=<path to pem>` before running Prisma commands. A
> `corp-ca.pem` was generated during setup (gitignored). Exporting the Zscaler root CA
> is machine-specific, not project-specific — see Zscaler's own client documentation,
> or ask IT, for how to export it on a given machine.
>
> **`npm run prisma:generate` must be re-run after every `npm ci` from the repo
> root.** `npm ci` deletes and reinstalls `node_modules`, which wipes the generated
> client under `node_modules/.prisma/`. Its absence surfaces as TypeScript errors on
> types like `Prisma.SupplierWhereInput`/`PrismaClientKnownRequestError` (missing
> exported members) and, at runtime, as `instanceof` checks against `undefined`
> throwing — both `npm run typecheck` and `npm test` will fail with these until
> `prisma:generate` is run again. This is not optional cleanup: no client, no
> correct types, no working test suite. There is deliberately no `postinstall` hook
> that does this automatically — see `backend/DEBT.md` for why.

### Steps

Dependencies are installed once from the repo root (`npm ci` — this project is
an npm workspace with a single root `package-lock.json`; do not run
`npm install`/`npm ci` inside `backend/`).

```bash
cd backend
cp .env.example .env          # then edit DATABASE_URL, and set a real JWT_SECRET
npm run prisma:generate       # generate the Prisma client
npm run prisma:push:test-only # create the schema in the database (needs a live DB)
npm run seed                  # catalogs + 21 real users only (safe to re-run; no deletes)
SEED_DEMO=true npm run seed   # ALSO load the demo suppliers/events/strategy (dev only)
npm run dev                   # start on http://localhost:3000/api
```

> **Seed is split in two (idempotent by default).** `npm run seed` runs
> `seedCatalogsAndUsers()` only — catalogs by upsert and **nothing is ever deleted** — so it
> is safe to re-run against TEST/production holding real suppliers/events. Running it twice
> in a row leaves the exact same state (no duplicates, no failures). The 21 real GSM-team
> users are pre-provisioned **by email** (`findFirst`, since email isn't `@unique` in
> Prisma): a new user is created with a `pending:<local-part>` placeholder username and the
> assigned role; a re-run refreshes only `displayName` — **never** `username` (a real login
> may have already stamped the true netid) nor `roleId` (app-owned). The demo dataset from
> `backend/prisma/fixtures/*.ts` (which **wipes and reseeds** suppliers/events/strategy) is
> gated behind `SEED_DEMO=true` and is for local dev only. Notifications are **not** seeded
> — they come from real domain events.

Tests and typecheck (no database required — Prisma is injected/mocked):

```bash
npm test                      # 515 tests: unit (business rules) + integration (HTTP)
npm run typecheck
```

### Environment variables (see `.env.example`)

| Var | Meaning |
|---|---|
| `DATABASE_URL` | Prisma SQL Server connection string |
| `PORT` / `CORS_ORIGIN` | Server port / allowed origins (Vite dev server default) |
| `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_EXPIRES_DAYS` | Token settings |
| `AUTH_MODE` | `mock` (simulated LDAP, password `password`) or `ldap` (real FastAPI service). **`NODE_ENV=production` refuses to start unless this is exactly `ldap`.** |
| `LDAP_API_URL` | FastAPI/LDAP service base URL. **Required when `AUTH_MODE=ldap`** — no hardcoded default; the server refuses to start without it. Ignored in mock mode. |
| `LDAP_API_KEY` | `X-API-Key` for the service's `POST /auth/profile` (profile lookups). **Not used by login** — `POST /auth/login` authenticates by body only. |
| `AUTH_OPTIONAL` | `true` → requests without JWT run as the demo user (Yael Urbano / SSD) — needed while the frontend has no login UI and sends no token; `false` → strict Bearer auth everywhere. **`NODE_ENV=production` refuses to start unless this resolves to exactly `false`.** |
| `DEFAULT_APP_ROLE` | Role assigned to a brand-new user on first login. Defaults to `Guest` (least privilege). |
| `FORM_INTAKE_SECRET` | Shared secret for the public MS Forms intake (`POST /api/public/form-intake`, §3). **Absent or blank disables the endpoint** — it answers 503 to everything rather than falling back to no authentication. Commented out in `.env.example`; the server refuses to start if it holds that placeholder. |

Mock-mode users (`AUTH_MODE=mock`, password `password`): `yael.urbano`,
`carlos.mendoza`, `ana.garcia`, `roberto.sanchez`.

---

## 2. Architecture

```
backend/
├── prisma/schema.prisma   # 37 tables in 7 domains (see below)
├── prisma/seed.ts         # seedCatalogsAndUsers() always; seedDemoTrackerData() only if SEED_DEMO=true
├── src/
│   ├── server.ts / app.ts # app factory with full dependency injection
│   ├── routes/            # one file per module
│   ├── controllers/       # HTTP ↔ service translation (zod validation)
│   ├── services/          # pure business logic (testable without HTTP)
│   ├── mappers/           # relational rows ↔ flat TrackerSupplier wire shape
│   ├── middleware/        # JWT auth, role guard, request logging (§2.3), error handling
│   ├── auth/ldapClient.ts # LdapAuthClient interface + HTTP + mock impls
│   ├── domain/            # controlled vocabularies + typed errors + SLA rules (sla.ts)
│   └── config/            # env + shared Prisma client + startup schema check
├── sql/                   # production migration/data-fix scripts (see below and sql/README.md)
├── data-import/           # Excel → JSON parser for the real GSM data (§7, data-import/README.md)
└── tests/                 # vitest + supertest (Prisma mocked via DI)
```

**`sql/` is the production migration record — files stay after they run.** There is no
`prisma migrate`/migrations folder in this project (schema changes go to TEST via
`npx prisma db push`); each dated script under `sql/` is the corresponding hand-run
production change (schema ALTERs) or one-off data fix, and every one is written
idempotent so re-running it is always safe. Files are **not deleted once executed** —
they are the auditable history of what changed in production and when, and (for schema
changes) the README links above point at them by name, so removing a file would break
those references. A script's header notes when it has already run (see e.g.
`sql/2026-07-23_revert_citlaly_to_guest.sql`). [`sql/README.md`](sql/README.md) tracks,
per script, whether it has been applied to TEST and to production — update it by hand
whenever a script is added or actually run against `MX_MFGIT_SSD`.
[`sql/CAMBIOS_ESQUEMA.md`](sql/CAMBIOS_ESQUEMA.md) is the companion log: `README.md`
answers *has it run yet?*, `CAMBIOS_ESQUEMA.md` answers *what changed since the
`01_`–`07_` baseline and why* — the running list of deltas, in order, that the
production promotion script is assembled from. A new script means a row in both.

**Startup schema check** (`src/config/startupCheck.ts`) — schema/database drift used to
surface as a Prisma `P2022` only when a user opened the affected screen (this happened
for real with `Notification.category` and `EvaluationData.tabVisit`/`costModel`).
`server.ts` now calls `verifyDatabaseSchema(prisma)` before `app.listen()` and runs a
minimal read against every model that has a real history of drift (`Supplier`,
`Notification`, `SupplierEvalData`); if the connected database is missing a column the
process logs which model failed and exits instead of listening with a broken schema.
It is not a full integration check across all 36 tables — only the models that have
already broken once.

**Table domains** (spec said ~17–19; this landed at 37 because notes, junction,
child and catalog tables are modeled explicitly):

1. **Catálogos** — `Commodity` (36-value controlled lookup + a 37th `TBD -- Pending GSM` placeholder) + the naming-compliance
   catalog retrofit: `Stage`, `SupplierStatus`, `SubStatus`, `Sla`, `ProductCategory`,
   `ConfidenceLevel`, `ImmexStatus`, `Role` (9 tables)
2. **Supplier núcleo** — `Supplier`, `CompanyInfo`, `TechnicalInfo`, `CommercialInfo`,
   `SupplierDocument`, `SupplierNote`, `SupplierHistoryEntry`, `SupplierPart`, `PrelimPart`
   (9 tables)
3. **Satélites por etapa (1:1)** — `ScoutingData`, `ParkingData`, `PreliminaryData`,
   `SupplierEvalData`, `IntelexData` (5 tables)
4. **Ramas de salida** — `BlacklistEntry`, `CompletionEntry` (2 tables)
5. **Events** — `Event`, `EventSupplierEntry` (N:M junction), `EventB2BMeeting`,
   `EventNote`, `EventProspect` (5 tables — see "Prospects" below)
6. **Strategy/MRL** — `StrategyEntry`, `MrlRequirement` (2 tables)
7. **Sistema/usuarios** — `User` (with `adObjectId` + custom `appRole`),
   `RefreshToken`, `Notification`, `AuditLog` (4 tables — see §2.3)

Suppliers carry a `status` (`ACTIVE`/`BLACKLISTED`/`COMPLETED`) plus the
`stage` they were in (for blacklisted rows, the stage at rejection — matching the
demo data, where blacklisted suppliers keep their last stage).

### Business rules enforced in `services/` (not just columns)

- **Meaningful free-text is one shared rule.** Notes (all 4 note routes),
  stage-change notes and blacklist rejection reasons go through
  `domain/textValidation.ts` → `assertMeaningfulText(text, label)`: trims, then
  rejects empty, `< 10` / `> 2000` chars, and a small junk-value list (`na`,
  `n/a`, `ok`, `ninguna`, `-`, `.`, `x`, …) — 400 otherwise. The 10/2000 bounds
  and the junk list are **provisional** (GSM to confirm) and live in that one
  file. Previously each of these only checked "non-empty", independently.
- **Advancing a stage requires a real note.** `POST /:id/move` now takes
  `{newStage, note}`; `note` is validated by `assertMeaningfulText` **before any
  DB access** (so a missing/junk note is a 400 and touches nothing). The note is
  written three ways in the same transaction: onto the history row's `Note`
  column, as the structured `SupplierHistoryEntry.fromStageId/toStageId`
  transition record, and as a **real `SupplierNote`** tagged to the *destination*
  stage (so it shows in the existing notes panel with no frontend change).
- **Blacklist requires a non-empty reason** — 400 otherwise (now via the shared
  `assertMeaningfulText`, so `"na"`/`"ok"`-style junk is rejected too); writes
  `BlacklistEntry` + history (with `fromStageId`/`toStageId → Blacklisted`).
- **`StageEnteredAt` tracks entry into the current stage** for all 5 active
  stages. Stamped on `createSupplier`, `moveSupplierToStage` and
  `blacklistSupplier`; also written by the seed and by the Excel import backfill
  (§7), so imported/demo rows carry one too. It is a superset of the two SLA
  anchor dates (`ParkingData.OnboardingDate`, `PreliminaryData.StartDate`) — it
  does **not** replace them (those still take precedence for their stage), and no
  SLA **colour** changed. It is the anchor that makes the displayed
  **`DaysInStage`** live on all five stages (§2.1).
- **Parking Lot → Preliminary Evaluation requires the external form data to be
  complete.** `domain/externalFormGate.ts` → `hasExternalFormData(supplier)`
  checks `CompanyInfo.dunsNumber` and manufacturing country/address (preferring
  `ParkingData`'s reviewed value, falling back to the `Supplier` row's own
  column — the one the external registration/recommendation form set at
  creation). `moveSupplierToStage` throws a `BusinessRuleError` (409) naming
  the missing fields when the target is `Preliminary Evaluation` and any are
  still empty (null/undefined/whitespace-only) — a real gate, not just the
  `PreliminaryPrefillModal` form marking them required. No expiry or
  auto-blacklist: a supplier can sit in Parking Lot indefinitely until the data
  is completed (confirmed with Itzel — intentional). `SubStatus` (`Go`/`No
  Go`/…) is unaffected — a "Go" supplier can still be stuck on this gate. Same
  function is referenced by a TODO in `eventsService.ts` as the future
  precondition for creating a `Supplier` from an accepted `T_Event_Prospect`.
  That table now exists (see **Prospects** below), but the **conversion** does
  not: no code path turns a prospect into a supplier yet. The mapper also exposes it as the read-only,
  computed `hasExternalFormData` DTO field, so the frontend's Parking Lot
  indicator reuses the same check instead of re-deriving it.
  - **Excel-migrated suppliers are exempt from this gate.** Rows brought in by
    `data-import/import-suppliers.ts` carry an `XL-SSD-<year>-NNNN` folio and
    never went through the external registration/recommendation form, so
    `CompanyInfo.dunsNumber` and the manufacturing country/address have no
    source to come from — GSM types them in by hand afterwards. Holding those
    rows in Parking Lot until then would strand the entire migrated population,
    so `hasExternalFormData` short-circuits to `{ complete: true, missing: [],
    exempt: true }` for them without reading a single field. The origin test is
    `domain/supplierOrigin.ts` → `isExcelMigrated(folio)` (case-insensitive
    `XL-` prefix after `trim()`), kept in its own module because the prefix is
    standing in for a column that does not exist yet (see §5). **This is a
    permanent business rule, not a migration-window workaround** — no env var,
    no feature flag. Nothing else is relaxed: the mandatory stage-change note,
    the tab checklists and every other validation apply unchanged to `XL-` rows.
  - **`exempt` is what separates the two ways a check comes back complete** —
    "the data is there" vs "this supplier was never asked for it". On the wire
    the mapper exposes both: `hasExternalFormData` is `true` for **every** `XL-`
    folio, and the sibling boolean **`isExcelMigrated`** carries the reason, so
    the frontend can suppress the Parking Lot warning triangle and drop the
    modal's three required-field markers without ever parsing a folio itself.
- **Entering Preliminary Evaluation seeds the satellite from the supplier's
  profile.** The answers the external MS Form collected already sit on
  `CompanyInfo`/`TechnicalInfo`/`CommercialInfo`; until now
  `T_Supplier_PreliminaryData` was still born empty and GSM retyped them.
  `domain/preliminarySeed.ts` → `buildPreliminarySeed(supplier)` derives the
  satellite's opening values from those three tables plus the `Supplier` row's
  own `Commodity`, `Buyer`, `ManufacturingAddress` and `Country`, and
  `ensureStageSatellite` spreads it into the upsert's **`create` only**. Details:
  - **Create-only, never retroactive.** `update: {}` stays empty on purpose — once
    the row exists it is GSM's, and nothing here ever writes over their edits.
    Suppliers already in or past Preliminary Evaluation are untouched.
  - **One write, inside the existing transaction** — the seed rides on the
    satellite INSERT `moveSupplierToStage` already performs; there is no second
    write and no extra query (the profile relations were added to the `include`
    that stage-move already runs).
  - **Empty answers are omitted, not seeded.** A source that is null, blank or
    `0` leaves its key out of the object entirely, so a partly answered profile
    just fills fewer columns and nothing lands that reads like a figure GSM
    entered. `StartDate` is still `todayISO()`.
  - **`ExportCapability` is written as free text**, not as the derived boolean
    `CommercialInfo.exportCapability` holds: `exportLocalContentPercent` and
    `exportDestinationCountries` are joined into `"70% local content, exports to:
    USA, Canada"`, matching the shape the migrated Excel rows already hold in
    that column (clamped to the column's 300 chars). Omitted when neither was
    answered; `0 %` counts as answered.
  - **Nothing else moves.** The `hasExternalFormData` gate, the SLA anchors, the
    `prelim_*` wire contract and the other four `ensureStageSatellite` cases
    (Parking Lot, Supplier Evaluation, Intelex Handoff, Completed) are unchanged
    — an incomplete profile still blocks the move on the gate, not on the seed.
- **Deletion only in Scouting Event** — anywhere else the API returns 409 (`use blacklist instead`).
- **Direct entry to Parking Lot** for `entrySource: 'Recommendation'` (form B); form A
  (`POST /api/events/:id/suppliers`) creates the supplier in Scouting Event linked to the event.
- **Parking Lot sub-status** `On Hold | Under Evaluation | Go | No Go`; **`No Go`
  auto-blacklists** and therefore requires a reason *before* any write.
- **`Completed` is terminal** — no standard-API move out of it, and it can only be
  entered from `Intelex Handoff`. No administrative override was implemented (see TODOs).
- **Notes are stage-tagged** at creation and **only the original author can edit/delete**
  (enforced in `notesService`, matching the frontend's author-name convention).
- **Commodity is a controlled catalog** (FK to `Commodity`), rejected on create/update
  if not one of the 36 canonical values (official Nexteer list — see
  `src/domain/constants.ts`; `Controllers` and `E-Mechanical Components` are
  split into individual subdivision entries in `Subcategory -- Category` order,
  e.g. `CCA -- Controllers`, `PCB -- E-Mechanical Components` — inverted per GSM
  2026-07-17) **or** the 37th placeholder `TBD -- Pending GSM`. The placeholder is
  auto-assigned to suppliers whose commodity GSM has not defined yet (those still in
  Scouting Event, and those imported from Excel with an aggregated commodity value);
  it is temporary and replaced when GSM confirms the real value — the Parking Lot
  prefill forces a real commodity before a supplier can leave Scouting Event.
- **Direct Material only on the tracker board** — `GET /api/tracker/suppliers`
  filters `productCategory = 'Direct'`; Indirect rows remain visible through
  `GET /api/suppliers` (Indirect is "an exit via filter", not a parallel flow).
- **SLA colour and the day counters are derived, not authored** — `FK_Sla` /
  `FK_GlobalSla` / `DaysInStage` / `DaysSinceParkingLot` are all recomputed from
  the stage's anchor dates and persisted by the backend; see §2.1.
- **A prospect's interest has exactly one owner** — see **Prospects** below.

### 2.0b Prospects — pre-event companies that are deliberately not suppliers

`T_Event_Prospect` (`EventProspect`, `sql/2026-08-13_add_event_prospect.sql`,
`services/eventProspectsService.ts`, pure rules in `domain/eventProspects.ts`)
holds the list of companies the organizer says *might* attend a scouting event,
uploaded per event from an Excel file (the frontend already parses that file —
see [frontend/README.md](../frontend/README.md) → *Prospect Excel template &
parser*).

**Why it is its own table and not a `Supplier`.** A supplier only exists once it
fills the external form on event day. Writing prospects into `T_Supplier` would
inflate the tracker stage counts, the Home KPIs and the Reports weekly snapshots
— all read as *real pipeline* — and would start an SLA clock on a company that
may never show up. `T_Event_SupplierEntry` could not be reused either: its
`FK_Supplier` is NOT NULL, i.e. it presupposes exactly the supplier row a
prospect does not have. So the table hangs off `T_Event` alone; its only other
FK is the nullable `FK_InterestedByUser → C_User`. Nothing in
`eventProspectsService.ts` reads or writes the supplier table.

**Interest is one marker with one owner, not a tri-state.** There is no
Interested / Not Interested / Pending:

- a prospect starts **unmarked**;
- **any** of SSD/PM/Buyer/**SDE** may mark it, which records who and when;
- a second person marking it gets a **409** — an interest already recorded is
  never silently overwritten. The owner re-marking their own is an idempotent
  no-op, not an error (a double click must not 409);
- **only the owner may unmark** — anyone else gets a **403**, and **SSD is not
  special-cased**: removing someone else's recorded opinion is a different,
  explicit act, and today the only route to it is deleting the whole import
  batch;
- there is **no "not interested" value to store**. A prospect that stays
  unmarked through the window is meaningful information (nobody wanted it) and
  is never deleted for it.

**`FK_ImportBatch` is a per-call UUID**, stamped on every row an import
**created *or* updated**. Stamping updated rows too is what makes
`DELETE …/prospects/import/:importBatchId` a real undo: SSD can drop the file
they just loaded by mistake without touching prospects another import put on the
same event. That delete is a **hard** delete and SSD-only — it corrects an
operator error, which is a different thing from discarding an unmarked prospect.

**A re-import never erases a decision.** The upsert key is
(`FK_Event`, `CompanyName`) after `normalizeCompanyName` (trim + collapse
whitespace); duplicates *within* one payload are dropped, first occurrence wins,
and counted as `skipped`. On update, `ProductType`/`Website` are overwritten
**only when the incoming value is non-empty** (a thinner second file must not
blank out data the first one carried), and the `Interested*`/`B2b*` columns are
not in the update at all.

**Import resolves create-vs-update in memory, in one query.** `importProspects`
does a single `findMany` scoped to the event (covered by `IX_EventProspect_Event`)
instead of a `findUnique` per row, then writes the whole batch — `createMany`
for new companies plus one `update()` per existing one (each can carry a
different `ProductType`/`Website`, so `updateMany` can't collapse them) — as a
single `$transaction([...])` array, one round trip instead of up to
`2 × MAX_PROSPECT_IMPORT_ROWS` sequential ones.

**`interestDeadline` is advisory.** `domain/eventProspects.ts` computes it as
min(import + 14 days, event start − 1 day) and `listProspects` returns it in
`meta` alongside `deadlinePassed` — anchored on the **oldest** import for the
event, the list people have had longest to react to. The service **never**
rejects a write because the deadline passed: a late mark is still real
information, and SSD scheduling a B2B on the event's own morning is normal.

### 2.1 SLA and days-in-stage — derived, persisted values

`FK_Sla` (per stage) and `FK_GlobalSla` (full cycle) used to be written once at
creation and never revisited, while the frontend painted its own colours from day
counts — the two disagreed. The colour is now **derived by the backend and
persisted**, and the frontend only maps the name to a hex.

**Thresholds** (`src/domain/sla.ts`, pure and unit-tested):

| Scope | green | yellow | red |
|---|---|---|---|
| Parking Lot | < 25 days | 25–29 | ≥ 30 |
| Preliminary Evaluation | < 50 days | 50–59 | ≥ 60 |
| Global (since Parking Lot) | < 75 days | 75–89 | ≥ 90 |

**Scouting Event, Supplier Evaluation and Intelex Handoff have no confirmed
business threshold**, so they get no automatic colour and keep whatever value
they already carry. Do not invent limits for them: `slaForStage()` returns `null`
for those stages, which every caller reads as "leave it alone".

**Where the days come from.** `DaysInStage` / `DaysSinceParkingLot` are *stored*
columns that nothing used to recompute over time, so a colour derived from them
would freeze until someone edited the supplier. Instead the days are counted from
the stage's **anchor date** on every read, and the recomputed counters are
persisted back:

| Scope | Anchor (first one that parses wins) | Fallback |
|---|---|---|
| Scouting Event | `Supplier.StageEnteredAt` → `Supplier.OnboardingDate` | stored `DaysInStage` |
| Parking Lot | `T_Supplier_ParkingData.OnboardingDate` → `StageEnteredAt` | stored `DaysInStage` |
| Preliminary Evaluation | `T_Supplier_PreliminaryData.StartDate` → `StageEnteredAt` | stored `DaysInStage` |
| Supplier Evaluation | `Supplier.StageEnteredAt` | stored `DaysInStage` |
| Intelex Handoff | `T_Supplier_IntelexData.RecordCreationDate` → `StageEnteredAt` | stored `DaysInStage` |
| Global | `T_Supplier_ParkingData.OnboardingDate` | stored `DaysSinceParkingLot` |

The satellite anchors are exactly the dates the stage satellites already record
when `moveSupplierToStage` creates them, so rows that flow through the app always
have one. **`StageEnteredAt` generalizes that to all five stages** (it is stamped
on create/move/blacklist, set by the seed, and backfilled for the Excel import —
see §7), which is what lets the three stages *without* an SLA threshold still show
a live day count. The stored counter remains the last-resort fallback for rows
that have no anchor at all — those keep a static number rather than a wrong one.

**Parking Lot and Preliminary Evaluation keep their satellite date as the *first*
anchor**, ahead of `StageEnteredAt`: that date is the one the business agreed the
colour is measured from, so adding the generic anchor cannot move an existing
colour — it only fills in where the satellite date is missing.

**`DaysInStage` is a display value, not a threshold input for the other stages.**
`slaForStage()` still returns `null` for Scouting Event / Supplier Evaluation /
Intelex Handoff; computing a day count for them adds a *number*, never a colour.

Both counters are re-persisted alongside the colour: `DaysSinceParkingLot` because
the UI shows it as "N/90 days" next to the global badge, and `DaysInStage` because
it is the "Days in Stage" figure on every tracker card and on the detail page. Both
are therefore **read-only from a client's perspective** — `PATCH
/api/suppliers/:id` still accepts them, but the derived value wins in the same
request (same rule as `sla`/`globalSla` below).

**Where it happens.** `services/slaService.ts` → `syncSuppliersSla()`, called by
the four read paths (`listSuppliers`, `getSupplierById`, `listByStage`,
`getTrackerSupplier`) immediately before mapping to the DTO. Every write path
(`createSupplier`, `updateSupplier`, `moveSupplierToStage`, `blacklistSupplier`,
`setParkingSubStatus`) returns through one of those reads, so a write cannot
leave a stale colour behind either — this is deliberately the *only*
recalculation point. It writes only when the stored value disagrees with the
derived one, so an already-correct board costs zero extra queries, and reads stay
idempotent.

There is **no cron/scheduled job** in this project and this feature does not add
one; persisting on read is what keeps the column usable as the source of truth
for clients that read `FK_Sla` directly.

**Terminal suppliers are frozen.** Blacklisted and completed rows are skipped:
their clock stopped when they left the tracker, and the colour **and the day
count** at exit are part of the record.

`sla` / `globalSla` are still *accepted* by `PATCH /api/suppliers/:id` so the wire
contract doesn't break, but they are overwritten by the derived value in the same
request — clients should treat both as read-only. The same now applies to
`daysInStage`.

> **The frozen-counter bug this fixed.** `dto.daysInStage` used to be the raw
> `T_Supplier.DaysInStage` column, written only by the seed, by the Excel import,
> by `moveSupplierToStage` (reset to 0) and by `PATCH`. Nothing advanced it with
> the calendar, so a card could read *"Days in stage: 0"* next to a red SLA dot
> derived from a months-old anchor. The two numbers now come from the same
> anchor, so they can no longer disagree.

### 2.2 Reports — a weekly diff reconstructed on demand

`services/reportsService.ts` answers "how many suppliers were in each stage a week
ago vs now, per commodity, and why did they move" **without any snapshot table or
cron job** — it is rebuilt from the structured supplier history on each request.

**Foundation (a small but required change to `createSupplier`).** Every supplier is
now born with exactly **one** `SupplierHistoryEntry` carrying `toStageId` = its
initial stage (`fromStageId` stays null). Before this, a supplier that never moved
had no stage-defining history row and was invisible to any date-based
reconstruction. This is the single fact the whole module leans on.

- **`getStageSnapshot(asOfDateISO, commodityId?)`** — for each **ACTIVE** supplier
  (BLACKLISTED/COMPLETED excluded, same as the rest of the system), its stage on
  that date is the `toStageId` of its **latest history entry with `date <= asOf`
  and `toStageId` not null** (ordered `date` desc, then `createdAt` desc, then `id`
  desc). A supplier with no such entry didn't exist yet on that date and is
  excluded. Grouped and counted by `(commodityId, stageId)`. **Intelex Handoff rows
  additionally carry `levelCounts`** — how the row's `count` splits across the
  Intelex sub-levels (`{ L0: 2, L3: 1 }`), so the report can answer "how many
  suppliers were at L0 vs L4" inside the handoff (the reason the sub-status was
  added). `count` stays the stage total, and `levelCounts` is `null` for every
  other stage, so consumers that only read `count` are unaffected. The level is
  **derived for the snapshot date, not read from the live `currentLevel` column**:
  `domain/intelexLevels.deriveIntelexLevelAsOf(intelexData, asOf)` returns the
  furthest level whose "Real" date (and every Real before it) is `<= asOf`, so a
  supplier that has advanced since still shows the level it had then. The query
  therefore selects the six Real columns (`INTELEX_REAL_SELECT`) instead of
  `currentLevel`. Same idea as the stage itself: the past is reconstructed from
  dates already stored, with **no** level-transition log — the Real dates are the
  historical record (see §2.2b).
- **`getWeeklyDiff(fromISO, toISO, commodityId?)`** — the two snapshots, plus
  **`movements`** (history entries with `date > from AND date <= to AND toStageId
  not null` — the `toStageId not null` filter automatically drops the three
  non-transition history sources: patch-update, promote-to-B2B and sub-status
  change) and **`notes`** (SupplierNote by `createdAt` in `[start of from, start of
  the day after to)`). Each row carries `commodityId`+`commodityName` so the client
  can build its filter and group without extra lookups.
- **`getLatestWeeklyDiff(commodityId?)`** — `to = today`, `from = today − 7 days`.

**Dates: two columns, two jobs.** The `date` columns on history/notes are
`'YYYY-MM-DD'` strings; that format sorts chronologically under plain string
comparison, so the `date` where-clauses use `<=`/`>`/`<=` directly ("which business
day the event belongs to"). `createdAt` is a real `DateTime` and is used **only**
for the notes window ("the exact instant a note was written — day + hour"). The two
are never mixed.

**Read-only + guarded.** Mounted under the same `operationalRead` gate as the other
operational modules (SSD/PM/Buyer/SDE can view, Guest is 403'd). There are no
mutating routes. **Known limitation:** demo suppliers loaded via `SEED_DEMO=true`
have free-text history without `toStageId`, so they don't appear in snapshots — the
module is built for app-created suppliers, which always carry the structured FKs.

### 2.2b Intelex sub-levels — one definition, two readings

`domain/intelexLevels.ts` owns the Intelex Handoff level sequence and what "the
level a supplier had reached" means. It exists because two callers needed the same
criterion and neither should own it:

- `INTELEX_LEVEL_SEQUENCE` — `Investigate → L0 → L1 → L2 → L3 → L4`, each entry
  carrying the `IntelexData` Real column (`realKey`) and the user-facing `label`
  the sequencing error message quotes.
- `deriveIntelexLevelBy(reached)` — **the** rule: the furthest level such that it
  and every level before it counts as reached, stopping at the first gap so an
  out-of-order Real (rejected on write, but possible in imported rows) can never
  skip a level. The caller decides what *reached* means.
- `deriveIntelexLevelAsOf(intelexData, asOfDateISO)` — the historical reading:
  reached = the Real exists **and** its day is `<= asOf`. Returns `'Investigate'`
  when there is no `IntelexData` row at all. It can never return `'Completed'` —
  that value is written when the supplier leaves the stage, and such suppliers are
  not ACTIVE, so they are outside every snapshot.
- `INTELEX_REAL_SELECT` — the six Real columns as a Prisma `select`.

`suppliersService.updateSupplier` calls `deriveIntelexLevelBy` with the **live**
reading (does the Real exist, dates irrelevant) to persist `currentLevel`;
`reportsService.getStageSnapshot` calls `deriveIntelexLevelAsOf` for the snapshot
date. One criterion, two predicates — the report and the badge can't drift apart.

**Why no level-transition table.** The Real dates already are the history: the level
is a pure function of them, so a past level is recomputed, never looked up. Adding a
level-events table would create a second source of truth for the same fact.

### 2.2c Intelex efficiency — the team's stepped delay scale

`domain/intelexEfficiency.ts` owns **how punctual each Intelex level was**. It is a
separate concern from §2.2b: that module answers *which level* a supplier reached,
this one answers *how late it got there*.

- `calcIntelexLevelEfficiency(expected, real)` — the score of **one** level, from
  **that level's own pair of dates**. `delay = Real - Expected` in days, then the
  GSM team's Excel scale: `<= 0 → 0.95`, `<= 5 → 0.95`, `<= 15 → 0.95 - (delay-5)*0.025`,
  `<= 25 → 0.70 - (delay-15)*0.02`, else `0.50`. `null` when either date is missing
  or unparseable — an uncaptured level has *no* score, which is not a bad one. The
  five branches are transcribed **as they appear in the Excel** (including the two
  that both return `0.95`) so the function stays auditable against that file
  column by column; the branches meet exactly at their boundaries, so the curve is
  continuous and one day later is always worth slightly less.
- `calcIntelexGlobalEfficiency(levelEfficiencies)` — the plain average of the levels
  that **have** a score. Nulls are skipped, never counted as 0: counting them would
  make the number measure *progress through the handoff* rather than punctuality.
  `null` while no level has both dates.

**Not a ratio from a common anchor.** Efficiency used to be `planned days / actual
days`, both measured from `recordCreationDate`. That is not the metric the team
uses, and because both terms shared an anchor it collapsed to 0% or 100% in
practice. Each level now answers only for its own delay — an early slip no longer
drags every later level down by construction.

`suppliersService.updateSupplier` rewrites **all six** values (`efficiencyL0..L4` +
`efficiencyGlobal`) whenever a patch touches any Intelex Expected **or** Real date,
merging the patch over the stored row so a level scores from whichever half arrives
now plus what is already on file. They are **server-owned**: like `currentLevel`,
client-sent values are dropped (`INTELEX_DERIVED_FIELDS`), so the stored numbers can
never disagree with the stored dates. The frontend reads them back through the mapper
(`intelex_efficiencyL0..L4`, `intelex_efficiencyGlobal`); the editable Timeline form
mirrors the formula locally for a live preview of unsaved dates, and says so.
Covered by `tests/unit/intelexEfficiency.test.ts`.

**Index: `IX_SupplierHistory_Date_ToStage`.** `getStageSnapshot`/`getWeeklyDiff` both
filter `T_Supplier_History` on `date` (`<=`, or `>`+`<=` for the diff window) **and**
`FK_StageTo IS NOT NULL` (the condition that isolates stage-defining entries from the
three non-transition history sources) — a composite index on `(Date, FK_StageTo)`
avoids a full table scan on that pair as the table grows past the current small TEST
volume, in particular once the real production suppliers are migrated (§7). This was
specified in `SSD_Modelo_BD_MX_MFGIT_SSD_v2.docx`/`03_create_indexes.sql` but never
actually added to `schema.prisma` or applied to any database until now — Reports gave
correct results without it the whole time, just via a table scan.

The original spec additionally called for `FK_Supplier` and `FK_StageFrom` as SQL
Server **INCLUDE** (non-key) columns, so the two queries' extra reads (`supplierId`
always; `fromStageId` only in `getWeeklyDiff`) wouldn't need a lookup back to the base
table. **Prisma's declarative `@@index` has no syntax for INCLUDE columns on any
provider** — not a SQL Server-specific gap, and not fixed by the `extendedIndexes`
preview feature (which covers index sort order/type for Postgres/MySQL, not SQL
Server INCLUDE). The index therefore ships as the plain composite
`@@index([date, toStageId])`, which still eliminates the scan on the filter itself
(the bulk of the cost); the two extra columns cost one additional lookup per matching
row instead of zero. Applied to TEST via `npx prisma db push` and verified against
`sys.indexes`/`sys.index_columns` (`Date` then `FK_StageTo`, no included columns). ⚠
**No production (`MX_MFGIT_SSD`) script yet** — same policy as the other pending
scripts under `sql/`, promoted together later.

### 2.3 Observability — request log, requestId and the audit trail

Added for the **internal TEST phase (TEST / `MX_MFGIT_SSD_TEST`)** so that when the
GSM team hits a problem it is immediately clear (a) whether it was bad input or a real
system failure, and (b) exactly what happened — on their screen and in the terminal.
No new dependency: `console.log` + `node:crypto` only (no morgan/pino).

**One line per request** (`src/middleware/requestLogger.ts`):

```
[req] a1b2c3d4 GET /api/tracker/suppliers 200 42ms user=yael.urbano
[req] 7f0e91cd POST /api/auth/login 401 118ms user=-
```

`a1b2c3d4` is the **requestId** (`randomUUID().slice(0,8)`), stamped on `req.requestId`.
`user=` is `req.user.username` (the AD netid; `-` when the request never authenticated).

> **Why it is mounted *before* `authenticate()`.** A request rejected by
> `authenticate()` calls `next(err)` and jumps straight to the error handler, so a
> logger mounted *after* it would silently lose every 401 — and `/api/auth/*`, which
> has no `authenticate()` at all. The line is instead written on the response's
> `finish` event, by which point `req.user` has already been populated if the request
> got that far. Mounting first therefore gets **both** the user *and* full coverage.

**The requestId reaches the user on 500s only.** `createErrorHandler(deps)` (it is now
a factory, since it needs `deps.prisma` for the audit write) leaves the
400/401/403/404/409 shapes **untouched** — those are already typed and self-explanatory
via `ApiError`/`ValidationError`. A genuine 500 instead:

1. logs `[unhandled] <requestId> <METHOD> <url> user=<netid>: <error>` (same
   `[prefix]` style as `[notify]`/`[audit]`),
2. writes a `SYSTEM_ERROR` audit row carrying that same requestId,
3. answers `{ error, code: 'INTERNAL', requestId }`.

The frontend folds that code into the message of its red *"Technical problem — not your
data"* toast (see frontend/README.md), so a tester can read it off the screen and it
maps 1:1 to the `[req]`/`[unhandled]` lines and to `T_Audit_Log`.

**Every `console.*` in the backend carries one of these prefixes** — that is what makes
"is there a stray debug log in here?" answerable at a glance:

| Prefix | Where | What it reports |
|---|---|---|
| `[req]` | `middleware/requestLogger.ts` | one line per HTTP request |
| `[unhandled]` | `middleware/errorHandler.ts` | genuine 500s only |
| `[audit]` | `services/auditService.ts` | a fire-and-forget audit write that failed |
| `[notify]` | the services that call `notifyTeam` | a notification that failed without breaking its operation |
| `[startup]` | `config/startupCheck.ts` | schema-drift and `DEFAULT_APP_ROLE` checks that abort the boot |
| `[server]` | `server.ts` | the listening banner and the insecure-auth-configuration warning |

The CLI scripts use their own prefixes on the same pattern: `[seed]`, `[seed:demo]`,
`[import]`, `[import:rest]`, `[backfill:stage]`.

**`T_Audit_Log` — system actions, not supplier movements.** `T_Supplier_History` is
untouched and remains the source of truth for a supplier's journey (stage, notes,
blacklist). `AuditLog` answers the *other* question — "what happened in the system"
when a report is only *"it got stuck"* / *"it didn't save"*. Written by
`services/auditService.ts` → **`logAction(prisma, {...})`**, which is
**fire-and-forget** (never awaited, `.catch` → `console.error('[audit]', …)`, plus a
`try`/`Promise.resolve` guard) exactly like the notification fan-out: an audit failure
can never turn a working request into a 500. Long values are truncated to their real
`NVARCHAR` limits rather than blowing up the insert.

| Column | Notes |
|---|---|
| `Action` | `LOGIN_OK` · `LOGIN_FAILED` · `EVENT_CREATED` · `SYSTEM_ERROR` |
| `RequestId` | ties the row to the `[req]` line and to what the user saw |
| `FK_User` / `UserEmail` | **not a Prisma relation** (see below); the email is a snapshot |
| `EntityType` / `EntityId` | e.g. `Event` / `evt-…` |
| `Detail` | a descriptive sentence — never just `"error"` |

> **Deliberate deviation from `RefreshToken`/`Notification`:** those cascade-delete from
> `User`. `AuditLog.userId` is a **plain column with no FK relation**, because an audit
> row must outlive the user it describes and a failed login has no user row at all. It
> keeps the `FK_User` map name for DB naming consistency but carries no constraint.

**Call sites (deliberately few):**

- `authService.login` — `LOGIN_OK` and `LOGIN_FAILED`. The failed row stores **only the
  typed identifier** (`userEmail`) — never the password (still never touched after LDAP
  validation) and not LDAP's reason, which could leak whether an account exists.
- `createErrorHandler` — every 500.
- `eventsService.createEvent` — `EVENT_CREATED`.

Supplier creation/edit and stage moves are **intentionally not audited here**: they are
already fully covered by `T_Supplier_History`, and a parallel row would be redundant.

**Applied to TEST** with `npx prisma db push` (verified: `T_Audit_Log` with its 9
columns, `IX_AuditLog_CreatedDt` and `IX_AuditLog_User`, and a real insert/read/delete
round-trip). ⚠ **The production (`MX_MFGIT_SSD`) script under `sql/` is deliberately
NOT written yet** — it ships when the rest of the pending scripts are promoted.

### Auth flow

```
React → POST /api/auth/login → Node → LdapAuthClient → FastAPI/LDAP3 (external)
```

- Node validates credentials through the `LdapAuthClient` abstraction
  (`HttpLdapAuthClient` for the real service, `MockLdapAuthClient` for `AUTH_MODE=mock`).
- The **password is discarded immediately** after validation — never stored or logged.
  Neither the password nor the raw request body of `POST /auth/login` is ever logged
  at any level.
- The user is resolved locally in three steps: **(1)** by `username` (= the real AD
  netid LDAP just returned — the normal re-login path); **(2)** if no match, by **`email`**
  (`findFirst`) — this is the **first real login of a pre-provisioned user**, whose row was
  created with a `pending:<local-part>` placeholder username, so it's claimed here and the
  **real netid is stamped onto `username`**; **(3)** a legacy `adObjectId` fallback for when
  the service eventually returns a GUID. If none match, the user is genuinely new and is
  `create`d with the real netid.
  - **Why email, not username?** The corporate netid (e.g. `GZJGZE`) bears no relation to
    the email local part (`yael.urbano`), and LDAP only reveals it at login. Pre-provisioning
    by a guessed username never matched, so the person was wrongly recreated as `Guest` on
    every login. Email is the stable identity.
  - `appRole` (`SSD|PM|Buyer|SDE|Guest`) is a **custom column on `users`**, not derived from
    AD, and **`roleId` is never touched on update** — it belongs to the app. New users
    default to **`Guest`** (least privilege; see "Roles y control de acceso").
  - **`email` and `adObjectId` are nullable and NOT `@unique` in Prisma.** SQL Server's plain
    `UNIQUE` tolerates only one `NULL` per table, and LDAP never returns a GUID (every row has
    `adObjectId = NULL`), so a `@unique` there made the 2nd user INSERT fail with `P2002`.
    Real uniqueness (when not null) is enforced by **manual filtered indexes** outside Prisma
    (`UQ_C_User_Email_Filtered`, `UQ_C_User_AdObjectId_Filtered` — already present in TEST,
    versioned for production promotion in
    [`sql/2026-08-10_add_filtered_unique_indexes_cuser.sql`](sql/2026-08-10_add_filtered_unique_indexes_cuser.sql));
    all lookups by email/adObjectId therefore use `findFirst`, never `findUnique`/upsert.
- Node issues its **own JWT** (claims: `sub`, `username`, `displayName`, `role`) plus a
  rotating refresh token (stored as SHA-256 hash, revoked on rotation/logout).

#### Real LDAP service contract (`HttpLdapAuthClient`)

The deployed FastAPI/LDAP service is verified against its source:

- **`POST /auth/login`** — body `{ username, password }`, `Content-Type: application/json`,
  **no `X-API-Key`**. It **always returns `200 OK`, even on failure** — success is
  discriminated by the body's **`success`** flag, never by the HTTP status. On success the
  body carries the full profile (`employee_number`, `name`, `email`, `department`,
  `job_title`, `supervisor_name`, `netid`). `netid` → `username` (falling back to the typed
  username, lowercased, `@nexteer.com` stripped); `name` → `displayName` (falling back to
  the username); **`supervisor_name` → `User.supervisorName`** (nullable), written on both
  the create and the update path in `authService`, so it auto-fills/refreshes on every
  real login and surfaces in `GET /api/users`.

> **Schema change (2026-07-22): `User.supervisorName`** — a new nullable
> `NVarChar(100)` column (`@map("SupervisorName")`). Applied to TEST with
> `npx prisma db push` and to **production** via
> [`sql/2026-07-22_add_supervisorname.sql`](sql/2026-07-22_add_supervisorname.sql)
> (`ALTER TABLE [C_User] ADD [SupervisorName] NVARCHAR(100) NULL;`, guarded so it is
> idempotent — safe to keep/re-run). Verify in SSMS with
> `SELECT COL_LENGTH('C_User','SupervisorName')` (non-null once the column exists).

> **Wire addition: `TrackerSupplier.stageEnteredAt`** — the mapper now emits the
> supplier's real "entered current stage" instant (`Supplier.StageEnteredAt`, already
> stamped on create/move/blacklist) as an ISO string or `null`. Additive and nullable;
> the frontend Home activity feed uses it for real relative timestamps.

> **Schema change (2026-07-23): `IntelexData.currentLevel`** — a new
> `NVarChar(20) NOT NULL DEFAULT 'Investigate'` column (`@map("CurrentLevel")`) that makes
> the Intelex Handoff sub-level an **explicit sub-status** instead of something only
> implied by which date fields are filled. Values: `Investigate | L0 | L1 | L2 | L3 | L4
> | Completed`. Applied to TEST with `npx prisma db push` and to **production** via
> [`sql/2026-07-23_add_intelex_currentlevel.sql`](sql/2026-07-23_add_intelex_currentlevel.sql)
> (idempotent — safe to keep/re-run; the `DEFAULT` backfills existing rows so the column
> is `NOT NULL` immediately). **Sequencing rule** (`suppliersService.updateSupplier`): a level's **"Real"**
> date can only be captured once the previous level's Real exists (Investigate → L0 → L1 →
> L2 → L3 → L4); an out-of-sequence Real is a **`BusinessRuleError` (409)** thrown before
> any write. "Expected" dates are never sequenced. Capturing a Real advances `currentLevel`
> to the furthest fully-sequenced level; closing the handoff (move to `Completed`) sets it
> to `'Completed'`. The mapper emits it as **`intelex_currentLevel`** (read-only; the update
> path ignores any client-sent value and re-derives it). The sequence and the derivation
> live in `domain/intelexLevels.ts` and are shared with Reports, which derives the level
> a supplier had on a **past** date from the same Real columns (§2.2b). Covered by
> `tests/unit/intelexSequencing.test.ts` — the write-path sequencing rules plus
> `deriveIntelexLevelAsOf` on its own (inclusive date bound, Reals after the date
> ignored, first gap stops the walk, unparseable date rejected).

> **Schema change (2026-08-11): `IntelexData.efficiencyGlobal`** — a new `FLOAT NULL`
> column (`@map("EfficiencyGlobal")`) holding the handoff's aggregated efficiency
> next to the five per-level ones. It ships with a change to **how all six are
> computed**: each level is now scored on the delay between **its own** Expected and
> Real dates through the GSM team's stepped scale, replacing the
> `planned/actual` ratio measured from `recordCreationDate` that produced only 0% or
> 100% in practice (§2.2c). The global value is the average of the levels that have a
> score, so it is `NULL` until one does. Applied to TEST with `npx prisma db push`
> and to **production** via
> [`sql/2026-08-11_add_intelex_efficiencyglobal.sql`](sql/2026-08-11_add_intelex_efficiencyglobal.sql)
> (idempotent). **No backfill**: `updateSupplier` rewrites the six values on every
> save that touches an Intelex date, so existing rows adopt the new scale the next
> time their Timeline is saved — backfilling would mean a second copy of the formula
> in T-SQL, free to drift from the domain module. The mapper emits
> **`intelex_efficiencyGlobal`** alongside `intelex_efficiencyL0..L4`, all read-only
> (the update path drops client-sent values and re-derives them). Covered by
> `tests/unit/intelexEfficiency.test.ts`.

> **Schema change (2026-08-07): the Visit tab moved to Supplier Evaluation, and
> Fundamentals gained `CostModel`.** Both confirmed by the GSM business owner.
> Preliminary Evaluation is left with **Overview → Capabilities**; Supplier
> Evaluation becomes **Competitiveness → Fundamentals → Visit**.
>
> - **Only the tab's completion flag moved.** `TabVisit` was dropped from
>   `T_Supplier_PreliminaryData` and added to `T_Supplier_EvaluationData`
>   (`SupplierEvalData.tabVisit`), so the mapper now emits
>   `preliminaryTabsCompleted: {overview, capabilities}` and
>   `supplierEvalTabsCompleted: {competitiveness, fundamentals, visit}`.
> - **The Visit *data* columns (Part A of `backend/DEBT.md` entry 1):**
>   `VisitDatePlanned`, `VisitDateCompleted`, `VisitParticipants`, `Strengths`,
>   `Weaknesses`, `Observations`, `Recommendations` now live on
>   `T_Supplier_EvaluationData` (`SupplierEvalData`), alongside the tab's
>   completion flag. They keep their `prelim_*` wire names — the wire rename to
>   `eval_*` is Part B, still pending until the production promotion (see
>   `backend/DEBT.md` entry 1). Application code + Prisma schema moved
>   2026-08-17; `MX_MFGIT_SSD_TEST` itself was synced the same day via
>   `npx prisma db push --accept-data-loss`, after manually copying the 33
>   rows that already had Visit data into `T_Supplier_EvaluationData` and
>   verifying a 0-row diff (`db push` drops/adds columns, it does not move
>   data between tables).
> - **`CostModel`** — a new nullable `NVarChar(5)` (`Y | N`) on
>   `T_Supplier_EvaluationData`, exposed as **`prelim_costModel`** and routed by
>   `SUPPLIER_EVAL_FIELDS` exactly like the `prelim_*Signed` fields. It is
>   **optional** (like TC&Cs / TTC&Cs / NSR / SDA) and is **not** part of the
>   `selectedForDevelopment` gate, which stays `RFQ = Y && NDA = Y`.
>
> Applied to TEST with `npx prisma db push` and to **production** via
> [`sql/2026-08-07_move_visit_tab_and_add_costmodel.sql`](sql/2026-08-07_move_visit_tab_and_add_costmodel.sql)
> (idempotent — it adds both columns, backfills the new `TabVisit` from the old
> Preliminary one for suppliers holding both satellite rows, then drops the old
> column). Covered by `tests/integration/supplierEvalTabs.test.ts`.

- The service **does not return `objectGUID`**, so `adObjectId` is always `null` today
  (the field is retained for a future service revision).
- A **10 s** timeout (via `AbortController`) or any network/parse error yields
  `{ ok: false, error: 'LDAP service unreachable' }` — never a raw exception.
- **`POST /auth/profile`** (requires `X-API-Key`) exists for future profile lookups but is
  **not used in login** — `/auth/login` already returns the full profile.

### Roles y control de acceso

Five application roles (`src/domain/constants.ts` → `APP_ROLES`):

| Role | Purpose |
|---|---|
| **`SSD`** | **Master.** User administration (`/api/users`) + full read/write on all operational modules — the only operational writer. |
| `PM` / `Buyer` / `SDE` | **Read-only** across the app: may `GET` every operational module but are 403'd on every mutating verb (POST/PATCH/PUT/DELETE) on tracker/suppliers/events/strategy/MRL. Each keeps exactly two named write exceptions — adding a note to a supplier or event, and marking (or unmarking, for the owner) interest on an event prospect — see `NOTE_WRITE_ROLES`/`PROSPECT_INTEREST_ROLES` below. **Deliberately identical to each other** beyond those two exceptions — the flat model has no finer per-role distinction. |
| `Guest` | Least privilege. Assigned to every new AD login until an SSD promotes them. |

**SSD is managed exclusively from the database.** `updateUserRole` and `deleteUser`
both throw a `ValidationError` (**400**) for any row whose current role is `SSD` —
the app can neither reassign nor delete an SSD user, not even another SSD. SSD is the
highest-privilege role, so once granted it can only be changed with direct DB access;
this closes the same-level escalation/demotion path. `ValidationError` (400) is used to
match the sibling last-SSD guard's status code (that older guard is now unreachable for
SSD rows but is kept as a second line of defence). The frontend mirrors this: SSD rows
show "Managed via DB" instead of edit/delete, and no role picker (add or edit) offers
`SSD`. Covered by `tests/integration/users.test.ts`.

**Guests are hidden from — and reclaimed by — User Management.** A `Guest` is anyone
who authenticated against AD but has not yet been granted an operational role, so the
User Management list would otherwise fill with people who merely logged in once.
`listUsers` therefore filters them out (`where: { role: { is: { name: { not: 'Guest' } } } }`)
— **this filter lives only in that one query**; login, auth and every other user lookup
still see Guests. The flip side is `createUser`: "adding" someone whose email already
belongs to a Guest row does **not** 409 — it **reclaims that same row**, promoting it to
the requested role in place (never a second row), keeping their `username` (which may
already be the true AD netid stamped at first login, not the `pending:` placeholder) and
`displayName`, and returning `promotedFromGuest: true` so the UI can say "promoted from
Guest". A real non-Guest email clash, or a username-only clash (a different person whose
netid happens to equal the new email's local part), stays a genuine **409**. Covered by
`tests/integration/users.test.ts`.

Any employee with `@nexteer.com` credentials can authenticate against AD, so the default
must be the lowest-privilege role. The operational modules split their guard into a
**read** gate (mount-level in `app.ts`) and a **write** gate (per mutating route in each
router), both defined in `src/middleware/auth.ts`:

- `OPERATIONAL_READ_ROLES = ['SSD','PM','Buyer','SDE']` — mounted on `/api/tracker`,
  `/api/suppliers`, `/api/events`, `/api/strategy`; blocks `Guest`.
- `OPERATIONAL_WRITE_ROLES = ['SSD']` — applied to every POST/PATCH/DELETE in those four
  routers (and MRL) that isn't one of the two named exceptions below. `PM`, `Buyer` and
  `SDE` are all 403'd — none of them is an operational writer any more.
- `NOTE_WRITE_ROLES = ['SSD','PM','Buyer','SDE']` — **the first of two exceptions**: adding,
  editing or deleting a note on a supplier or an event. A note is commentary, not a change
  to the record itself, so it stays open to every non-Guest role. Guards only the note
  routes in `routes/suppliers.ts` and `routes/events.ts`; every other mutating route on
  those routers uses `write` (`OPERATIONAL_WRITE_ROLES`, SSD-only).
- `PROSPECT_INTEREST_ROLES = ['SSD','PM','Buyer','SDE']` — **the second exception**,
  deliberately a separate constant rather than a widening of the write set. It guards only
  the two *mark/unmark interest* routes on event prospects (see §2.0b): quality's opinion
  on which companies are worth a B2B meeting is the whole point of the pre-event list, and
  that write touches nothing else — it cannot create, move or edit a supplier. Everything
  else in the events router keeps `write`, and importing/undoing a list and scheduling a
  B2B are `requireRole('SSD')`.

| Router / verb | Guard | `PM`/`Buyer` | `SDE` | `Guest` |
|---|---|---|---|---|
| `/api/tracker\|suppliers\|events\|strategy` — **GET** | `OPERATIONAL_READ_ROLES` | ✅ 200 | ✅ 200 | ❌ 403 |
| `/api/tracker\|suppliers\|events\|strategy\|mrl` — **POST/PATCH/DELETE** (non-note) | `OPERATIONAL_WRITE_ROLES` | ❌ 403 | ❌ 403 | ❌ 403 |
| `/api/suppliers/:id/notes[/:noteId]`, `/api/events/:id/notes[/:noteId]` | `NOTE_WRITE_ROLES` | ✅ 200/201 | ✅ 200/201 | ❌ 403 |
| `/api/events/:id/prospects/:pid/interest` — **POST/DELETE** | `PROSPECT_INTEREST_ROLES` | ✅ 200 | ✅ 200 | ❌ 403 |
| `/api/events/:id/prospects/import[/:batchId]` — **DELETE**, `…/b2b` — **PATCH** | `requireRole('SSD')` | ❌ 403 | ❌ 403 | ❌ 403 |
| `/api/users` (all verbs) | `requireRole('SSD')` | ❌ 403 | ❌ 403 | ❌ 403 |
| `/api/notifications` | none (any authenticated user) | ✅ | ✅ | ✅ (empty for Guest) |
| `/api/home/summary` | none (any authenticated user) | ✅ | ✅ | ✅ — its only supplier-derived data |
| `/api/auth/me` | authenticated | ✅ | ✅ | ✅ |

So a `Guest` user reaches exactly three things: `/api/auth/me`, `/api/notifications`
(empty for them) and `/api/home/summary` (aggregated, anonymous — see §3). `PM`, `Buyer`
and `SDE` see the full app read-only, keeping only notes and prospect interest as writes.

---

## 3. Endpoints

| Module | Endpoint | Notes |
|---|---|---|
| Auth | `POST /api/auth/login` | `{username, password}` → `{token, refreshToken, user}` |
| | `POST /api/auth/refresh` | rotates refresh token |
| | `POST /api/auth/logout` | revokes refresh token (idempotent) |
| | `GET /api/auth/me` | identity from Bearer token |
| Tracker | `GET /api/tracker/stage-config` | 5 working stages (color/icon) |
| | `GET /api/tracker/suppliers[?stage=]` | board list (ACTIVE+COMPLETED, Direct only) |
| | `GET /api/tracker/suppliers/:id` | flat `TrackerSupplier` detail |
| | `POST /api/tracker/suppliers/:id/move` | `{newStage, note}` — validated transition; **`note` is mandatory** (see below) |
| | `POST /api/tracker/suppliers/:id/blacklist` | `{reason}` — mandatory |
| | `PATCH /api/tracker/suppliers/:id/substatus` | `{subStatus, reason?}` — No Go auto-blacklists |
| Suppliers | `GET /api/suppliers` | search/filter: `q, stage, commodity, country, status` |
| | `GET /api/suppliers/tracker\|blacklisted\|completed` | mirrors frontend service fns |
| | `GET/POST/PATCH/DELETE /api/suppliers[/:id]` | CRUD (delete only in Scouting Event) |
| | `POST/PATCH/DELETE /api/suppliers/:id/notes[/:noteId]` | author-only edit/delete |
| Events | `GET/POST/PATCH/DELETE /api/events[/:id]` | CRUD; `suppliersRegistered` and `prospectsRegistered` computed (the prospect **count** only — the list has its own endpoint) |
| | `POST /api/events/:id/suppliers` | form A: create supplier from event |
| | `POST /api/events/:id/suppliers/link` | link existing supplier (junction upsert) |
| | `POST/PATCH/DELETE /api/events/:id/notes[/:noteId]` | author-only edit/delete |
| | `GET /api/events/:id/prospects` | §2.0b — `{prospects, meta}`; ordered by company name; `meta` = `interestDeadline` / `deadlinePassed` (**advisory**) / `total` / `interested` / `unmarked` / `b2bScheduled` |
| | `POST /api/events/:id/prospects/import` | `{rows[], sourceFileName?}` — upsert on (event, company); **400** on an empty list or more than 500 rows; returns `{created, updated, skipped, importBatchId, prospects}`. Never touches interest/B2B on an existing row |
| | `DELETE /api/events/:id/prospects/import/:importBatchId` | **SSD only.** Undo one import — hard-deletes exactly the rows that batch created *or* updated; **404** if no prospect on the event carries that batch |
| | `POST /api/events/:id/prospects/:prospectId/interest` | mark interested — **`SDE`, `PM` and `Buyer` allowed here** despite being read-only elsewhere (`PROSPECT_INTEREST_ROLES`). **409** if someone else already marked it; a no-op for the owner |
| | `DELETE /api/events/:id/prospects/:prospectId/interest` | unmark — **403** unless the caller is the person who marked it (SSD included); a no-op if already unmarked |
| | `PATCH /api/events/:id/prospects/:prospectId/b2b` | **SSD only.** `{b2bScheduled, b2bDateTime?, b2bLocation?}` — `b2bDateTime` is **mandatory** and strict `YYYY-MM-DDTHH:mm` when scheduling (**400** otherwise); unscheduling nulls both fields |
| Strategy | `GET /api/strategy/entries` / `PATCH /api/strategy/entries/:id` | inline needs edit (existing entry only) |
| | `PATCH /api/strategy/entries/by-commodity/:commodity` | **upsert** needs by commodity name — creates the entry if the commodity never had one (the drilldown editor uses this) |
| | `GET /api/strategy/overview` | `CommodityStrategyRow[]` (same algorithm as `StrategyPage.tsx`) |
| | `GET /api/strategy/commodity/:commodity` | drilldown row + its suppliers |
| | `GET/POST/PATCH/DELETE /api/strategy/mrl[/:id]` | MRL CRUD / inline edit |
| Reports | `GET /api/reports/weekly?from&to[&commodityId]` | week-over-week diff (see §2.2); **400** if `from`/`to` missing/malformed or `from > to` |
| | `GET /api/reports/weekly/latest[?commodityId]` | same, for the last 7 days ending today |
| | `GET /api/reports/commodities` | `{id,name}[]` commodity catalog for the filter |
| Notifications | `GET /api/notifications` | **per-user** (`req.user.id`); `time` label computed from `createdAt` ('hace 1h'), plus `category` (the domain event — see below, `null` on pre-2026-08-07 rows, backfilled by `sql/2026-08-10_backfill_notification_category.sql` where the message pattern makes it unambiguous) and `createdAt` as an ISO instant (the panel sorts on it and derives the relative label from it; neither tab filters by age) |
| | `PATCH /api/notifications/:id/read` / `POST /api/notifications/read-all` | scoped to the caller — read-all only touches the caller's rows; marking another user's notification returns **404** (ownership check) |
| | `DELETE /api/notifications/:id` / `POST /api/notifications/delete` `{ids}` / `DELETE /api/notifications` | delete one / a selection / all — **caller-scoped**, same ownership rule as read: a row that is not the caller's is a **404**, never a 403, so the endpoint can't be used to probe for other users' ids. The batch form is **all-or-nothing** — one foreign id aborts it before anything is deleted. `POST` for the batch because the id list travels in a body |
| Users | `GET /api/users` | **SSD only.** `{id, username, displayName, email, supervisorName, role}`, ordered by `displayName`. **Guest rows are excluded** (see below) |
| | `POST /api/users` | pre-provision `{email, role}` — `username` is a `pending:<local-part>` placeholder until first login stamps the real netid. **Reclaims a Guest** with that email (promotes in place, adds `promotedFromGuest:true`); **409** only on a non-Guest email clash or a username-only clash |
| | `PATCH /api/users/:id` | `{role}` — **400 for any SSD row** (SSD is DB-managed, see below); also refuses to demote the last SSD (unreachable now, kept as defence) |
| | `DELETE /api/users/:id` | **400 for any SSD row** (SSD is DB-managed); non-SSD delete re-provisions as `Guest` on re-login |
| Home | `GET /api/home/summary` | **any authenticated role (incl. `Guest`).** Aggregated + **anonymous** — no supplier name/folio/company/id (see below) |
| Public intake | `POST /api/public/form-intake` | **The one route outside JWT auth.** Supplier registrations from the external MS Form, relayed by Power Automate. Authenticated by the `x-form-intake-key` shared secret only; **201** `{id, folio}`, **409** `{id, folio}` on a DUNS already on file, **400** on shape, **401** on a bad/missing key, **503** when `FORM_INTAKE_SECRET` is unset (see below) |

**Implemented vs pending:** every endpoint above is implemented and covered by
typecheck; auth, tracker, RBAC, users and notifications are covered by integration/unit
tests. Role-restricted endpoints **are now applied** (`requireRole` per router — see
"Roles y control de acceso"). Notifications are **per-user and generated by real domain
events** (see below). Still pending: file upload for `PipelineDocument.link`.

### `POST /api/public/form-intake` — the external MS Form

Vendors fill in a Microsoft Form; Power Automate posts each response here. It is
the **only** route mounted above `app.use('/api', authenticate())` (besides
`/api/auth` and `/api/health`), because Power Automate holds no Nexteer identity
and cannot obtain a JWT.

**It is a new caller of the existing registration logic, not a second copy of
it.** `services/formIntakeService.ts` ends up in `createSupplier` /
`addSupplierToEvent` exactly as the in-app forms do, so folio allocation, FK
resolution, the birth history entry, the `supplier_created_*` notification and the
transaction that holds them together are the same code paths, already tested.
Completeness is likewise **not** re-judged here: whether a record carries enough
to leave Parking Lot stays `domain/externalFormGate.ts`'s decision. The Zod
schema is a shape guard, so "required" there means "required in the body", never
"business-complete".

**Authentication — a shared secret, compared in constant time.** Power Automate
sends `x-form-intake-key`; `middleware/formIntakeAuth.ts` hashes both sides with
SHA-256 and compares the digests with `crypto.timingSafeEqual`. Hashing first is
what makes the comparison total: `timingSafeEqual` throws on length-mismatched
buffers, and `===` would return on the first differing byte, leaking the length
of the matching prefix through response time — on a public endpoint whose only
door is that secret, that is a real recovery attack. Both rejections below happen
**before anything touches the database**:

| Situation | Answer |
|---|---|
| `FORM_INTAKE_SECRET` unset/blank | **503** `NOT_CONFIGURED`. Never "no secret ⇒ no check" — that would turn a forgotten variable into a public write endpoint. 503 rather than 401 so the deployment problem reads as one. |
| Header missing, wrong, or repeated | **401** `UNAUTHORIZED` |

**Actor.** There is no `req.user` on this route, so every write is attributed to a
fixed synthetic identity — `system-form-intake` / *"MS Forms Intake"* — which is
what appears in the supplier's history entry and in `Buyer` when the Form sends
none. It matches no `C_User` row, so the notification fan-out excludes nobody.

**`entrySource` routing.** The wire values are `'Event'` and `'Recommendation'`
(not the column's `'Scouting Event'`), because the Form asks the vendor *where
they met us*, and an `'Event'` answer carries the event's **name** — a string
picked from a list — not an internal id:

| Answer | What happens |
|---|---|
| `Recommendation` | `createSupplier(entrySource: 'Recommendation')` → Parking Lot, same as form B today |
| `Event`, name matches | `addSupplierToEvent` → Scouting Event **plus** the `EventSupplierEntry` link, identical to `POST /api/events/:id/suppliers` |
| `Event`, name matches nothing | `createSupplier(entrySource: 'Scouting Event')` — **the registration is never dropped.** No event link; the unmatched string is kept on `ScoutingInput` *and* in a second, `warning`-severity notification quoting it verbatim, so GSM can link the event by hand |

**DUNS is the duplicate key.** The Form is public and a vendor who gets no
confirmation will submit again, so an existing `CompanyInfo.DunsNumber` answers
**409** carrying the existing `{id, folio}` at the top level of the body (Power
Automate branches on it) instead of creating a second record. There is no unique
index behind this — adding one is a schema change, and the column is `''` for
every supplier imported from Excel — so two submissions in the same instant could
both pass; Power Automate runs one flow per response, sequentially, and a
duplicate that did slip through is visible and deletable.

**Field conversions live in `domain/formIntakeMapper.ts`**, a pure module that
mirrors the frontend's `supplier-forms/payload.ts` server-side: the "Not sure /
To be determined" commodity answer → `PENDING_GSM_COMMODITY`, the employee-range
label → the Int lower bound, the two amount+unit pairs (revenue+currency,
press capacity+unit) → their single `NVarChar` column, the years-in-Mexico answer
→ an Int (a number as-is; a migrated free-text "26 Years" by its leading integer;
anything else simply not written), the automotive percentage → **dropped unless
the market answer is `Mixed`**, and the two granular export answers → the
`exportCapability` boolean the legacy column still stores (see below). `EMPLOYEE_RANGES` is
**duplicated** there from `frontend/src/constants/catalogs.ts` (the backend cannot
import across the boundary) with a comment naming the frontend as the source of
truth. A joined string that would not fit its column is a **400 naming the
field** — never a silent truncation, which would store a wrong number nobody can
tell is wrong. Every other string is length-capped in the Zod schema against its
NVarChar width, the same idiom `prospectImportSchema` uses. Unknown keys are
stripped rather than rejected: the Form gains questions without this endpoint
starting to 400.

**`exportCapability` is derived now, not sent.** The Form asks two questions —
"% of local content" and "destination countries" — and each has had its own column
since 2026-08-24 (`ExportLocalContentPercent`, `ExportDestinationCountries`). The
old boolean is untouched on the wire and in its column, because the frontend still
reads it; what changed is that `deriveExportCapability` computes it: **true** when
local content is below 100 %, or when a destination country is named and it is not
the Form's "None" answer. When the vendor answered **neither** question the key is
left out of the PATCH entirely rather than written as `false` — "does not export"
and "was never asked" are different facts, and only the first is worth writing over
a value somebody captured by hand.

**The satellite answers are a best-effort second step.** Like the in-app form
(`registerSupplierForEvent`), the core fields are created and everything on
`CompanyInfo`/`TechnicalInfo`/`CommercialInfo` is then PATCHed through
`updateSupplier`. If that PATCH fails the response is still **201**: the supplier
and its folio are already committed, and any other status would make Power
Automate retry a submission that *did* land. The failure is made loud instead —
an error log carrying the folio, plus a `warning` notification asking someone to
complete the fields by hand.

**A profile that is mostly unstorable does not become a supplier.** Before any of
the above — before the DUNS lookup, before a single query —
`domain/formIntakeProfileValidation.ts` checks each mapped profile answer against
the column behind it: a text answer must fit its `NVarChar` width, an `Int` column
must get a whole in-range number (`FoundedYear` must be four digits),
`ExportCapability` — which `updateSupplier` stringifies — must be a real boolean,
and `immexAnswer` must be one of the three labels `C_ImmexStatus` can be looked
up by. It is a **pure shape check** — no Prisma, no write
attempt — for the same reason `updateSupplier` cannot do this job: it needs the
supplier to already exist, so by the time it could reject anything the folio is
spent. Its contract is untouched by this and the in-app `PATCH /api/suppliers/:id`
behaves exactly as before.

What happens then is a ratio, and **the denominator is what the vendor actually
answered** — `Object.keys(profile).length` after the mapper's `compact()`, never
the ~35-field catalogue. Most of the Form is optional and a normal submission
answers a handful of questions; dividing by the catalogue would put every healthy
partial answer over the line. A question left blank was dropped by `compact()`
before this check runs, so it is a non-answer, never a failure, and it cannot move
the ratio in either direction.

| invalid ÷ answered | Result |
|---|---|
| `0` (the normal case) | **201.** Full profile saved, no warning |
| `> 0` but `≤ PROFILE_FAILURE_THRESHOLD` | **201.** The supplier is created and the *valid* answers are PATCHed; the invalid ones are dropped from the patch (`updateSupplier` writes it as one operation, so leaving one bad value in would cost every other answer too) and named in a `warning` notification |
| `> PROFILE_FAILURE_THRESHOLD` | **400**, `VALIDATION_ERROR`, message naming every invalid field. **Nothing is written** — no supplier, no folio, no event link — so Power Automate can log it and the vendor or GSM can fix the answers and resubmit |

`PROFILE_FAILURE_THRESHOLD` (**0.5**, in
`domain/formIntakeProfileValidation.ts`) is the one place the rule lives — change
that constant and both bands move. Strictly greater blocks; exactly at it still
registers. The asymmetry is the point: a couple of unusable answers is a supplier
worth having minus two fields somebody re-types, while a mostly-unusable profile
is a folio spent on a row nobody can act on.

**Two different failures, two different messages.** They are not the same event
and are deliberately not merged:

| Failure | When | Notification |
|---|---|---|
| Some answers were the wrong shape | Caught **before** the write, per field | *"`{folio}` se registró desde el formulario externo, pero `{n}` de sus respuestas de perfil no se pudieron guardar por venir en un formato inválido: `{campos}`. El resto del perfil sí se guardó…"* — `{campos}` are the **Form's** field names (`employeeRange`, `annualRevenueAmount + annualRevenueCurrency`), not the column names, because whoever reads it opens the Power Automate run or calls the vendor |
| The PATCH could not run at all | Caught by the `try/catch` around `updateSupplier` — a timeout, a lost connection | *"…sus datos de perfil (compañía, técnicos y comerciales) no se pudieron guardar. Complétalos a mano…"* — stays generic, because a write that never ran says nothing about any individual answer |

> All three warnings above carry the **same category the creation itself used** —
> `supplier_created_parking` for a `Recommendation`, `supplier_created_scouting`
> for an `Event` (the unmatched-event branch lands in Scouting Event too) — with
> `type: 'warning'`. They report a creation that went partly wrong, so they belong
> in the same colour as the "Nuevo proveedor registrado" row they follow, and are
> told apart from it by their message, not by an icon.

**`GET /api/home/summary`** returns `stageCounts` (the 5 working stages, ACTIVE + Direct
only, with colour), `topCommodities` (top 5 over all suppliers), `totalActive` /
`totalCompleted` / `totalBlacklisted`, and up to 3 `upcomingEvents` (Upcoming/Ongoing,
`{id, name, dateStart, location}`). Its aggregate **shape is the security boundary** — it
is the only supplier-derived endpoint the `Guest` role can reach, so it must never carry
an individual supplier identity.

**Notifications are generated by domain events** (`notificationsService.notifyTeam`):
supplier created **and edited**, stage move, blacklist, event created and edited, strategy
entry saved, and MRL requirement created/edited/deleted each fan out one notification per
recipient. Every call site wraps the notify in `try/catch` so a notification failure can
never roll back or fail the underlying operation.

**The audience is every operational user except the one who made the change.** Two rules,
both deliberate:

- **All four operational roles, not only SSD.** The fan-out used to filter `role = 'SSD'` on
  the theory that SSD is the sole operational writer. But `/api/notifications` carries **no
  role guard** (see the table above) — PM, Buyer and SDE all open the same panel, and these
  events are exactly what they need to see precisely *because* they cannot write them.
  `notifyTeam` therefore selects `OPERATIONAL_READ_ROLES` — the same
  `['SSD','PM','Buyer','SDE']` list that gates the read routes. There is still no finer
  per-role/per-commodity targeting planned.
  - **`Guest` is deliberately not in the audience**, which is why the audience is that list
    and not "every row in `C_User`". Guest is 403'd from every operational module, and these
    messages carry supplier names, commodities, part numbers and links a Guest cannot open —
    fanning out to them would walk around the boundary that `/api/home/summary` being
    aggregate-only exists to hold (it is the *only* supplier-derived thing a Guest may
    reach, and it must never carry an individual supplier identity). The table above already
    documents `/api/notifications` as **"empty for Guest"**; this keeps that true.
- **Never the actor.** `NotifyInput.excludeUserId` is the id of whoever performed the
  action, and it is excluded **in the where-clause**, not filtered afterwards. Someone who
  just saved a form does not need to be told they saved it; a panel that reports your own
  clicks back to you is noise that trains people to ignore the bell. Every call site passes
  its `actor.id`; `null`/omitted notifies everyone and is reserved for events with no human
  actor (none today).

**One notification per save operation — never one per changed field.** The four write paths
that summarize a multi-field save (`updateSupplier`, both strategy writers,
`updateMrlRequirement`) build **one** message naming everything that moved
(*"Itzel actualizó 4 campos de Aceros del Bajío: DUNS, País, Buyer, Website"*) and issue a
single `notifyTeam` call, so a recipient gets exactly one row per save. The shared
`summarizeChangedFields(labels)` caps the list at 8 labels and appends *"y N más"*, and
`notifyTeam` trims `Message`/`Link` to their `NVARCHAR(500)`/`(300)` limits, so a wide save
can neither produce an unreadable message nor blow up the insert.

**A save that writes nothing notifies nobody.** The check is on the fields actually being
written, not on "the endpoint was called": an empty `PATCH` body, a strategy save setting no
year, and a supplier patch carrying only the server-owned Intelex values (`currentLevel`,
the six efficiencies — accepted from the client and then dropped, §2.2b/§2.2c) all produce
no notification at all.

Each notification carries **two independent labels**, and they are deliberately not merged:

| column | question it answers | values |
|---|---|---|
| `Type` | how loud is it? (severity) | `info` \| `warning` \| `error` |
| `Category` | **what happened?** (domain event) | 20 values, the tracker ones **granular per stage** — see the table below |

`Category` was added (`sql/2026-08-07_add_notification_category.sql`) because nearly every
event is `info`, so a panel keyed off the severity alone drew the same blue circle-info icon
for a new supplier, a stage advance, a new event and an edited one. The frontend maps the
category to a representative icon + colour. Only `blacklisted` and `mrl_deleted` are
`warning`; everything else is `info`.

**The three tracker families are granular per stage** (2026-08-25). They started out as one
flat value each — `supplier_created`, `supplier_updated`, `stage_advanced` — which could
only ever say *"something happened in the tracker"*, the one thing the reader already knows.
Each now names the stage the fact belongs to, so the panel can paint the row with **that
stage's own colour and icon**, taken straight from the frontend's `TRACKER_STAGE_CONFIG`
(`frontend/src/constants/stage-config.ts`) rather than a second, parallel notification
palette. The correspondence is **1:1** — a Parking Lot notification is the same yellow +
`fa-circle-pause` as the Parking Lot column:

| `Category` | stage it borrows its style from | written by |
|---|---|---|
| `supplier_created_scouting` | Scouting Event | `createSupplier` (`entrySource` ≠ Recommendation), `formIntakeService` warnings |
| `supplier_created_parking` | Parking Lot | `createSupplier` (`entrySource: 'Recommendation'`), `formIntakeService` warnings |
| `supplier_updated_scouting` | Scouting Event | `updateSupplier`, by the supplier's **current** stage |
| `supplier_updated_parking` | Parking Lot | ” |
| `supplier_updated_preliminary` | Preliminary Evaluation | ” |
| `supplier_updated_supplier_eval` | Supplier Evaluation | ” |
| `supplier_updated_intelex` | Intelex Handoff | ” |
| `stage_advanced_scouting` | Scouting Event | `moveSupplierToStage`, by **destination** stage |
| `stage_advanced_parking` | Parking Lot | ” |
| `stage_advanced_preliminary` | Preliminary Evaluation | ” |
| `stage_advanced_supplier_eval` | Supplier Evaluation | ” |
| `stage_advanced_intelex` | Intelex Handoff | ” |
| `stage_advanced_completed` | Completed | ” |
| `blacklisted` | Blacklisted | `blacklistSupplier` / `setParkingSubStatus` (`warning`) |

The remaining six keep one colour each, one icon per event within it, because they belong to
modules with no stage to name: `event_created` / `event_updated` green (`#04BF6E`, the accent
`EventDetail` paints its own header with), `strategy_updated` magenta, and `mrl_created` /
`mrl_updated` / `mrl_deleted` orange. **The three MRL values are deliberately not merged into
the stage vocabulary**: MRL belongs to the Strategy module and only *happens* to share
Preliminary Evaluation's orange.

Two helpers in `notificationsService.ts` own the mapping so no call site spells a category
out by hand: `categoryForStageAdvance(newStage)` and `categoryForSupplierUpdate(stage)`, both
driven by a single `STAGE_SUFFIX` table. `categoryForSupplierUpdate` falls back to
`supplier_updated_scouting` for `Completed`/`Blacklisted`: a closed record has left the board,
so no stage colour would mean anything on it. `stage_advanced_scouting` is mapped but
unreachable through the API — backward moves are rejected and a supplier is never "already
in" its own stage, so nothing can *arrive* at the board's first column.

Nothing about this needed a schema change: `Category` is free-text `NVARCHAR(30)` and the
longest value, `supplier_updated_supplier_eval`, is **exactly 30 characters**. Existing TEST
rows were reclassified in place by
`sql/2026-08-25_backfill_notification_categories.sql` (TEST only — see below).

Rows written before the column existed (pre-2026-08-07) started out `NULL`, but their
category isn't a guess: the fan-out (`notifySsdTeam` at the time, now `notifyTeam`) always
wrote one of five fixed message templates, one per call site, so the template a row's
`Message` matches identifies its category exactly (`Link`'s prefix is used as a tie-breaker). `sql/2026-08-10_backfill_notification_category.sql`
does that match-and-`UPDATE`, `WHERE Category IS NULL` only, so re-running it is a no-op.
Any row matching no template (there shouldn't be any, but the script doesn't assume it) is
left `NULL` and still renders correctly via the severity fallback above.

The column **stays nullable**, and a row is only ever backfilled when its message says what
happened without guesswork: anything left over keeps its `null` and renders through the
severity fallback, because a guessed icon on real history is worse than a generic one. (The
2026-08-25 per-stage backfill is the one deliberate exception, and it is confined to TEST —
see the note below.) `NotifyInput.category` is **required** in TypeScript, so a new call
site cannot forget to classify itself.

> **No category change has ever needed a migration.** `Category` is already
> `NVARCHAR(30) NULL` and free-text as far as the database is concerned — the controlled
> vocabulary lives in `NotificationCategory` (TypeScript) and in the frontend's
> `categoryStyle` map. The per-stage split of 2026-08-25 is no exception: its longest value
> fills the column exactly (30 of 30 characters) without an `ALTER`.
>
> **`sql/2026-08-25_backfill_notification_categories.sql` is a *data* backfill, and it is
> TEST-only.** It rewrites the rows already sitting in `MX_MFGIT_SSD_TEST` so the panel
> renders its existing history with the right stage colours instead of falling back to the
> severity icon; it aborts if `DB_NAME()` is anything but the TEST database, and it is
> idempotent (each `UPDATE` is keyed on the old value, so a second run does nothing).
> **There is deliberately no `sql/prod/` counterpart**: production does not exist yet and is
> born with zero notifications — they are never seeded, only generated by real domain events
> — so every row it ever holds is written with a fine-grained category from the start.
>
> Only `stage_advanced` can be reconstructed exactly, from the fixed
> `'<nombre> avanzó de <origen> a <destino>'` template `moveSupplierToStage` writes: the
> destination closes the message, so the script matches its tail against the six stage names.
> `supplier_created` / `supplier_updated` messages never name a stage and the supplier's row
> now holds whatever stage it reached *later*, so both fall back to the `_scouting` variant —
> **a documented approximation, accepted for test data only**. A row matching nothing is left
> untouched (never a script failure) and reported by the script's closing summary, which
> prints how many rows moved from each old category to each new one.

---

## 4. Design decisions where the contract was ambiguous

1. **Commodity catalog replaced with the official 36-value Nexteer list**
   (confirmed by the business team) — it no longer mirrors the frontend
   `Commodity` union in `frontend/src/types/index.ts` verbatim. `Controllers` and
   `E-Mechanical Components` are split into individual subdivision entries in
   `Subcategory -- Category` order (`CCA -- Controllers`,
   `PCB -- E-Mechanical Components`, …; inverted per GSM 2026-07-17), and the
   plural `'Plastics'` is gone in favor of the official singular `'Plastic'`.
   A **37th value `TBD -- Pending GSM`** was later appended as a temporary
   placeholder for suppliers whose commodity GSM has not defined yet (Scouting
   Event suppliers, and Excel imports with an aggregated value); the frontend keeps
   it out of the pickable dropdown (`PENDING_GSM_COMMODITY` in
   `frontend/src/constants/catalogs.ts`) since it is auto-assigned, not chosen.
   The frontend demo data has since been reconciled to these values (see
   "Pending TODOs"). Existing `C_Commodity` rows were renamed in place — without
   re-seeding — by a one-off migration script (applied; no longer kept in this
   repo, see git log). **Events no longer carry a commodity:** the `Event.topCommodity`
   field was removed entirely (GSM confirmed an event has no commodity attribute) —
   dropped from the model, DTO, API schema, seed and frontend, with the production
   column removed by [`sql/2026-07-23_drop_event_topcommodity.sql`](sql/2026-07-23_drop_event_topcommodity.sql).
2. **Date-like fields stored as `NVarChar`** — many contract "dates" carry non-date
   values (`eop: '2031'`, `time: 'hace 1h'`, `'TBC'`), and the frontend expects the
   exact strings back. Only system timestamps (`createdAt`, token expiries) are real
   `DateTime`. Tightening types is a candidate future migration.
3. **`prelim_parts` + `prelim_*Signed` + `prelim_costModel` + the seven Visit-tab
   fields (`prelim_visitDatePlanned`, `prelim_visitDateCompleted`,
   `prelim_visitParticipants`, `prelim_strengths`, `prelim_weaknesses`,
   `prelim_observations`, `prelim_recommendations`) live in the Supplier
   Evaluation satellite** — the frontend type prefixes them `prelim_`, but its own
   comments and `supplierEvalTabsCompleted`
   (`competitiveness`/`fundamentals`/`visit`) assign them to Supplier Evaluation.
   The wire shape is unchanged; only the Prisma model changed (see the schema
   change below and `backend/DEBT.md` entry 1).
4. **Backward stage moves are blocked.** `moveSupplierToStage` compares
   `stageIndex(newStage)` against the supplier's current stage and rejects the
   move with a `BusinessRuleError` if the target is earlier in the tracker.
   Only forward movement among the 5 working stages is allowed; `Completed` is
   reachable **only** from Intelex Handoff. Blacklisted/Completed suppliers can
   never move (terminal states).
5. **No admin override for Completed** — explicitly not implemented, per instructions.
   If needed, it should be a separate role-guarded endpoint with an audit entry.
6. **Note ownership by author display name** — mirrors the frontend
   (`note.author === currentUserName` in `NotesSidePanel.tsx`, where `currentUserName` is
   the authenticated user's `displayName` from `AuthContext`, not a hardcoded value).
   User-ID ownership would be more robust, but the backend's own comparison is against
   `displayName` too (`notesService.ts`), so this is consistent end-to-end. Seeded note
   IDs get a supplier prefix to guarantee uniqueness (demo IDs repeat across
   spread-copied rows).
7. **`AUTH_OPTIONAL=true` demo mode** — the current frontend sends no tokens; strict
   auth would break it. Default keeps GET/mutations working attributed to the demo user
   (Yael Urbano). Flip to `false` once the frontend implements login.
8. **`suppliersRegistered` is computed** from junction rows (consistent with all demo
   events) instead of stored.
9. **`tabsCompleted` objects flattened to boolean columns** with a `hasTabs` flag to
   round-trip the `null` vs `{…false}` distinction (Prisma has no JSON type on SQL Server).
10. **Prisma enums unsupported on SQL Server** → controlled vocabularies are validated
    in `src/domain/constants.ts` at the service layer.
11. **Blacklisted demo rows are spread-copies of `ps8`** — seeded as-is (shared company
    info), since the frontend shows exactly that today.
12. **Folio generation**: `SSD-<year>-NNNN` (4-digit, e.g. `SSD-2026-0001`), next number
    per year computed from the numeric max of the existing native folios. Padding is 4
    digits because 3 broke lexicographic ordering past 999 suppliers, which the real-data
    import will approach; the next number is now derived from the real numeric maximum
    (not a lexicographic `orderBy`) so mixed 3-/4-digit widths can't pick the wrong last.
    Folios imported from Excel carry an **`XL-` prefix** (`XL-SSD-2026-NNNN`) and are
    **excluded** from this calculation so imported numbers never consume the native range.
    Fine for single-user dev; needs a sequence/retry for concurrency.

## 4.1 Formularios A/B — mapeo a columnas reales

Los dos formularios de alta (`Propuesta_Formularios_Proveedores_v2.pdf`) escriben
en dos pasos, porque la superficie de escritura está partida:

1. **`POST /api/suppliers`** — esquema zod fijo de 17 campos. Zod **descarta en
   silencio** cualquier clave fuera de esa lista, así que el formulario no puede
   mandar el perfil extendido por aquí. Es lo único que fija `entrySource`, y de
   ahí sale la etapa inicial (form A → Scouting Event, form B → Parking Lot).
2. **`PATCH /api/suppliers/:id`** — rutea cada campo plano a su satélite. A
   diferencia del POST, **rechaza con 400** las claves que no conoce, listándolas.

> **Un tercer escritor, con el mismo mapeo.** `POST /api/public/form-intake` (§3)
> recibe el formulario externo de MS Forms vía Power Automate y hace estos dos
> mismos pasos del lado del servidor, reusando `createSupplier`/`updateSupplier`.
> Las conversiones de campo viven en `domain/formIntakeMapper.ts`, espejo de
> `supplier-forms/payload.ts`. Una diferencia deliberada con la tabla de abajo:
> ese endpoint **no** escribe el satélite `prelim_*`, solo las columnas planas.
> IMMEX (Q34) sí viaja igual en los dos: un solo `immexAnswer` con la etiqueta de
> la pregunta, que el servicio resuelve al FK.

**La Sección 5 del form A se escribe dos veces, a propósito:** a las columnas
planas (`CompanyInfo`/`TechnicalInfo`/`CommercialInfo`), que el detalle del
proveedor muestra en cualquier etapa; y al satélite **`PreliminaryData`**
(`prelim_*`), que es donde el documento dice que estas respuestas reaparecen
("no se vuelven a preguntar ahí, solo se confirman").

Desde el **2026-08-24** `PreliminaryData` ya casi no es el hogar exclusivo de
nada: siete de las ocho preguntas de §5 que no tenían columna plana ahora la
tienen (`generalManager`, `footprint`, `yearsInMexico`, `market`,
`toolingDesign`, `rawMaterialIndex`, `applications`), con **el mismo nombre, tipo
y ancho** en las dos tablas. La duplicación es deliberada y su reconciliación se
rastrea fuera de este repositorio — ver
[`sql/CAMBIOS_ESQUEMA.md`](sql/CAMBIOS_ESQUEMA.md). La única que sigue viviendo
solo en el satélite es `processingMethod`.

Esa duplicación es justo lo que hace posible el **seed de `PreliminaryData`**: al
entrar a Preliminary Evaluation, `domain/preliminarySeed.ts` copia el perfil
(`CompanyInfo`/`TechnicalInfo`/`CommercialInfo` + `Commodity`/`Buyer`/dirección
de manufactura del propio `Supplier`) a las columnas gemelas del satélite, de
modo que la pestaña nace con las respuestas que el proveedor ya dio en lugar de
en blanco. Solo en el `create` del upsert — ver la regla "Entering Preliminary
Evaluation seeds the satellite from the supplier's profile" en §"Business rules
enforced in `services/`".

### Campos SIN columna equivalente (no se pierden: se guardan como nota)

Estas preguntas no tienen dónde vivir en el esquema. En vez de descartarlas, el
formulario las adjunta como **nota del proveedor**. Añadir columnas es una
decisión de esquema fuera del alcance de esta tarea.

| Form | Pregunta | Por qué |
|---|---|---|
| A (Q7) | "How did you hear about Nexteer?" (Event/Social Media/Email/Other — catálogo confirmado GSM) | No existe columna |
| B | Supervisor / Manager del recomendante | No existe columna; pendiente de Active Directory |
| B (Q11-12) | Nombre / Email — Contacto 2 | El esquema guarda **un solo** par de contacto |

> **Q14 y Q15 salieron de esta tabla el 2026-08-24.** El sector de negocio dejó de
> tratarse como duplicado de Q30 — son dos preguntas distintas y ahora tienen dos
> columnas, `CommercialInfo.BusinessSector` y `CommercialInfo.Market` — y "¿es tu
> primer contacto con Nexteer?" tiene la suya, `CompanyInfo.FirstContactWithNexteer`.

### Campos que SÍ se guardan pero con pérdida

| Campo | Pérdida |
|---|---|
| A (Q25) Número de empleados | Rangos GSM (Micro/Small/Medium/Large); `CommercialInfo.Employees` es `Int`, así que solo se guarda la cota inferior (1/11/51/251) — la etiqueta no se persiste. |
| A (Q26) Ingresos anuales por región | Ahora **monto + moneda** (input numérico + select); se unen a `AnnualRevenue` `NVarChar(50)` como `"120000000 USD"`. El desglose repetible por región sigue sin estructura. |
| A (Q27) Volumen de producción por región | Filas repetibles → texto en `NVarChar(100)`. |
| A (Q29) Press capacity | Ahora **valor numérico + unidad** (T/kN); se unen a `pressCapacity`/`prelim_pressCapacity` como `"500 T"`. |
| A (Q32) Capacidad de exportación | Ya **sin pérdida** desde el 2026-08-24: el % de contenido local y los países destino tienen columna propia (`ExportLocalContentPercent`, `ExportDestinationCountries`). `exportCapability` sigue siendo **booleano en el contrato**, pero ahora se **deriva** de esas dos respuestas en lugar de ser lo único que sobrevive. |
| A (Q33/Q37/Q39) Certificaciones / Operaciones / Materiales | Multi-select → una sola cadena separada por comas. "Other" se expande a `Other: <texto>`. |

> **"Other" free-text (GSM 2026-07-17).** Toda pregunta cerrada con opción
> *Other* revela un input para especificar; se pliega en el valor como
> `Other: <texto>` (`resolveOther`/`joinListWithOther`, payload.ts) y se guarda
> en la misma columna que la selección.

> ⚠ `prelim_hasIMMEX` **no** es una columna (el modelo usa `immexStatusId`);
> mandarlo por PATCH devuelve 500. IMMEX (Q34) se manda como **un solo**
> `immexAnswer` — `'Yes' | 'No, with a plan' | 'No, without a plan'`, las
> etiquetas de la pregunta — y el servicio lo resuelve al FK vía
> `immexNameFromAnswer` (`services/catalogMapping.ts`), que las traduce a los
> valores del catálogo `'Yes' | 'In Plan' | 'No'`. El par `hasIMMEX`/`planIMMEX`
> ya no existe en el contrato: cuatro combinaciones para tres respuestas obligaban
> a que una bandera le ganara a la otra en silencio. De vuelta, `GET` devuelve el
> nombre del catálogo en `immexStatus` (`null` si no hay `CommercialInfo`), que es
> de **solo lectura** — se escribe por `immexAnswer`. `'TBC'` sigue en el catálogo
> y fuera de este contrato: ninguna respuesta de Q34 lo produce.

## 5. Pending TODOs

- **Supplier origin is inferred from the folio prefix, not stored.** `T_Supplier`
  has no `Origin` column, so `domain/supplierOrigin.ts` decides whether a row came
  from the Excel migration by testing its folio for the `XL-` prefix that
  `data-import/import-suppliers.ts` allocates (and that `nextFolio()` excludes from
  the native `SSD-` sequence). That is enough today — the two ranges cannot
  collide — but it makes a display string load-bearing for a business rule: the
  external-form gate exemption and the `isExcelMigrated` DTO field both hang off
  it, and a folio ever being renumbered or reformatted would silently change which
  suppliers are exempt. **After go-live this should become a real `Origin` column
  on `T_Supplier`** (`APP` | `EXCEL_IMPORT` | …), backfilled from the current
  prefixes. The rule is deliberately isolated in that one module so the migration
  is a single-file change with no caller touched.
- **Deliberate technical debt register:** see [`backend/DEBT.md`](DEBT.md). It
  tracks shortcuts taken for the TEST phase that must be resolved before —
  or at — promotion to the production database `MX_MFGIT_SSD`; currently six
  entries: the Visit-tab columns now living on `T_Supplier_EvaluationData` in
  application code (Part A, done) but still keyed under their `prelim_*` wire
  names and not yet migrated in the physical `MX_MFGIT_SSD_TEST`/`MX_MFGIT_SSD`
  data (Part B, pending), blacklisted suppliers having no way back into the
  pipeline, B2B scheduling now existing both on `T_Event_Prospect` and on
  `T_Event_B2BMeeting`, the two security issues in the external FastAPI/LDAP
  service, the open question of whether a prospect → `Supplier` conversion must
  satisfy the external-form gate, and the dead
  `T_Supplier_ParkingData.DaysElapsed` column — **this last one is now resolved
  in code** (the column is gone from `schema.prisma`, `sql/prod/`, the mapper and
  the seed; see §"`DaysElapsed` is now dead" below), so `DEBT.md` entry 6 still
  needs to be closed there.

  **This section and `DEBT.md` are one register, not two.** Pending items that
  describe a decision someone still has to make live in `DEBT.md` with their
  reasoning; this list keeps the running history of what has already been
  resolved. Loose `TODO` comments in the code are not a third place — the four
  that existed were folded into `DEBT.md` entries 4–6.
- **Prospects are backend-only so far** (§2.0b). Three things are deliberately
  not built yet, each as its own change: **no notifications** fire on an import,
  an interest mark or a scheduled B2B; **no conversion** turns a prospect into a
  real `Supplier` (whether that path must reuse `hasExternalFormData` as its
  precondition is an open decision — `DEBT.md` entry 5); and **no frontend** calls
  these endpoints, though the Excel parsing utilities the import modal will use
  already exist client-side (frontend/README.md → *Prospect Excel template &
  parser*).
- **FastAPI/LDAP service — 2 known security issues (Leo's service, NOT this repo, by scope):**
  1. LDAP traffic on **port 389 unencrypted** (no LDAPS/StartTLS).
  2. **`API_KEY` hardcoded** in the service's `config.py`.
  Registered with their resolution path as [`DEBT.md`](DEBT.md) entry 4. (The former
  "`requirements.txt` unpinned" item **no longer applies** — the deployed service ships
  pinned versions.)
- ~~Role → permission matrix undefined~~ — **partially applied.** `requireRole()` guards
  each router (see "Roles y control de acceso"): `Guest` is blocked from all operational
  modules and `SDE` is read-only (read gate vs. write gate). **PM and Buyer remain
  operationally identical** — a deliberate, permanent decision; there is no finer
  field/activity permission model or per-commodity notification targeting planned.
- ~~Admin flow to assign `appRole`~~ — **done.** SSD users manage roles via `/api/users`
  (pre-provision by email, patch role, delete). New logins get `Guest`.
- ~~`daysInStage` is still a frozen seeded counter~~ — **done.** It is now derived
  from the stage anchor dates and re-persisted on every read, exactly like
  `sla`/`globalSla`/`daysSinceParkingLot` (§2.1), for **all 5 active stages** —
  `Supplier.StageEnteredAt` is the generic anchor that unblocked the three stages
  without a satellite date. The two root causes of the staleness were fixed with
  it: the seed never populated `StageEnteredAt` (it does now, from the last
  history entry or the current stage's own date), and neither did the Excel import
  (`import-rest.ts`'s backfill now writes it, and
  [`data-import/backfill-stage-entered-at.ts`](data-import/backfill-stage-entered-at.ts)
  is the one-time catch-up for the rows imported before that — §7).
  **`T_Supplier_ParkingData.DaysElapsed` was dead and is now dropped**: nothing
  wrote it, and the frontend card had already stopped preferring it over
  `daysInStage`, so it only ever rendered a number frozen at seed time. The column
  is gone from `prisma/schema.prisma`, from the production baseline
  (`sql/prod/01_create_tables.sql`), from `supplierMapper` — so the API no longer
  returns `parkingDaysElapsed` — and from `prisma/seed.ts`. `parkingDaysElapsed`
  is additionally **rejected by name** in `suppliersService.updateSupplier`: the
  generic `parking*` prefix would otherwise have routed it into the Prisma upsert
  and answered 500, where a stale client now gets the same 400 as any other
  non-patchable key. This closes what [`DEBT.md`](DEBT.md) entry 6 asked for,
  minus its step 3 — no dated `DROP COLUMN` script was added because the loose
  `backend/sql/*.sql` scripts are being retired in favour of the `sql/prod/`
  baseline.
- ~~Notifications are global and not generated by domain events~~ — **done for domain
  events.** They are now **per-user** and generated by `notifyTeam` on supplier
  create/edit, stage move, blacklist, event create/edit, strategy save and MRL
  create/edit/delete — fanned out to **every user except the actor**. The demo set is **no
  longer seeded**. SLA-breach notifications specifically are still not generated (no
  scheduled job exists — see the SLA notes).
- **Seed rows have inconsistent SLA inputs.** The demo data is anchored to dates from
  early 2026 while its `daysInStage` values describe a "today" around April — e.g.
  `SSD-2026-006` says `daysInStage: 28` but has been parked since `2026-03-15`. The
  derived SLA (correctly) reads the anchor and reports red. Completed demo rows also
  carry a `daysSinceParkingLot` with a null `globalSla`. Re-dating the demo data
  relative to the current date would make the seeded board tell a coherent story.
- **Frontend pages not yet on the services** — the services themselves now use
  `fetch` (done), but ~19 page/component files still import `backend/prisma/fixtures/*.ts`
  directly and so read from memory instead of the API; their writes never reach the
  database. Exact list in frontend/README.md. The big one is
  `TrackerSupplierDetail.tsx` (3 137 lines), whose blacklist/complete/delete paths
  `splice`/`push` the demo arrays and need to call
  `trackerService.blacklistSupplier` / `moveSupplierToStage` and refetch instead.
- ~~Commodity catalog vs. demo data mismatch~~ — **resolved.** The demo data no
  longer contains bare `'Plastics'` or `'E-Mechanical Components'`; every value in
  `backend/prisma/fixtures/*.ts` is a valid entry of the 36-value catalog. Verified by a
  clean `npm run seed` against `MX_MFGIT_SSD_TEST` (it throws
  `Commodity not in catalog` otherwise). The former `Event.topCommodity` free-text
  field (which never matched the catalog) has since been **removed entirely** (see
  design decision 1), so there is no longer an event-side commodity to reconcile.
- Integration tests still run against a mocked Prisma layer (DI), not a real
  database — this was originally because no SQL Server was reachable in the dev
  environment (TCP disabled, no admin rights); that connectivity blocker is now
  resolved (see §1), but the test suite has not yet been switched to run against a
  live test database. Add a test database + `prisma db push` to CI for full
  end-to-end coverage.

## 6. Test summary

`npm test` → **460 passing** (vitest). `tests/integration/users.test.ts` now also asserts
that `PATCH`/`DELETE` on an **SSD** row is a **400** ("managed via the database directly")
even when other SSDs remain — the app can never reassign or delete an SSD user. `tests/unit/textValidation.test.ts` covers the
shared `assertMeaningfulText` rule (empty / short / long / every junk value
case-insensitively / accepts normal text), and the tracker/notes suites were
extended for the mandatory stage-change note and the structured history columns.
`tests/unit/reportsRules.test.ts` covers the Reports module: `createSupplier` writes
exactly one birth history entry with `fromStage` null and `toStage` = initial stage
(the §2.2 foundation); `getStageSnapshot` shows a supplier created before the date in
its initial stage, excludes one created after, takes only the latest stage-bearing
entry per supplier, honours the `commodityId` filter, breaks Intelex Handoff into
`levelCounts`, **derives those levels as of the snapshot date** (the same supplier
reads L0 on a April date and L3 on a June one) and selects the Real columns rather
than `currentLevel`; `getWeeklyDiff` lists a
transition with its from/to stages and note, excludes non-transition history via the
`toStageId not null` where-clause, maps notes to a real `createdAt` instant over a UTC
day window, and filters movements + notes by `commodityId`. Beyond the
SLA/tracker/notes/auth suites below, the RBAC + user-admin + notification work added:

- `tests/integration/auth.test.ts` also covers the **real LDAP contract** (`200` +
  `success:false` = invalid, `netid` identity, `adObjectId` null, empty-string netid falling
  back, `LDAP service unreachable` on network error) and the **`Guest`** default role (not
  `Buyer`). It resolves existing users by `username` then **by email** — a pre-provisioned
  `pending:` user is **claimed by email on first login**, its real netid stamped onto
  `username`, its role kept — and creates two null-`adObjectId` users back-to-back without a
  `P2002` (the single-NULL-unique regression), never overwriting `roleId`.
- `tests/integration/rbac.test.ts` — every guarded router (incl. the read-only
  `/api/reports/weekly/latest`) returns **403 for `Guest`** and **200 for `SSD`**;
  read-only **`SDE` gets 200 on GET but 403 on POST** in the operational modules;
  `/api/users` is SSD-only; `/api/home/summary` is 200 for Guest/SDE/SSD
  and its response carries only aggregate keys (no supplier identity).
- `tests/unit/notificationsRules.test.ts` — the **fan-out audience**: `notifyTeam` excludes
  the actor *in the where-clause* (`{ NOT: { id } }`), targets all four operational roles
  (PM/Buyer/SDE included) and **never `Guest`**, writes exactly one row per remaining
  recipient, writes none when the actor is the only recipient, and trims `Message`/`Link`
  to the column limits;
  `summarizeChangedFields` caps a long field list with *"y N más"*. Then the **write paths
  that notify** (`domain events that notify`): a four-field supplier edit is **one** row per
  recipient carrying all four labels — not four rows — the editor is never among the
  recipients, the message uses the post-rename supplier name and the singular *"1 campo"*,
  and an empty patch / a derived-Intelex-only patch notifies nobody; both strategy writers
  fire one `strategy_updated` naming the commodity and the years (none when no year is set);
  MRL create/update/delete fire their own category, with the update listing the changed
  fields (volumes expanded per year) and the delete being a `warning` linking to the list.
  Plus `listNotifications`/`markAllNotificationsRead` scoped to the requesting `userId`;
  cross-user `markNotificationRead` is a 404; the **category** round-trip (persisted
  *alongside* the severity, not instead of it; returned by both `listNotifications` and
  `markNotificationRead`; `null` for pre-column rows, which still come back); and the
  **delete ownership** rule (another user's row and a non-existent id are the same 404; one
  foreign id in a batch deletes **nothing**; an empty selection is a 400 rather than a
  silent delete-everything; `deleteAllNotifications` filters by `userId`).
- `tests/unit/formIntakeMapper.test.ts` (61 tests) — the pure MS Forms conversions (§3),
  no Prisma: the "not sure" commodity answer → `PENDING_GSM_COMMODITY` (case- and
  whitespace-insensitively, blank included) while every other value passes through so a
  typo still becomes `createSupplier`'s own 400; every `EMPLOYEE_RANGES` label → its Int
  lower bound, **including a label retyped with a plain hyphen** instead of an en dash, and
  `undefined` (never a rejection) for an unrecognisable one; amount+unit joining, and its
  `''` when there is no amount; and `fitColumn` **rejecting** an over-long joined string
  with a 400 that names the field, accepting one sitting exactly on the limit. Plus the
  whole-payload split: core vs. profile, `fullName`/`productCategory` defaults, blanks
  dropped but `false` kept, and no mapping for "Main manufacturing process". Plus the
  three conversions added 2026-08-24: `yearsInMexico` (an Int as-is, "26 Years" → 26,
  an unparseable answer → `undefined`), `automotivePercentForMarket` (kept for `Mixed`,
  dropped for every other market), and each branch of the derived
  `deriveExportCapability` — including "neither question answered → the key is absent".
- `tests/unit/formIntakeRules.test.ts` (25 tests) — the secret comparison (equal-length
  mismatch, **different-length mismatch returning `false` rather than throwing**, the
  503/401 split, a repeated header) and `intakeSupplier`'s routing against a mock Prisma:
  Recommendation → Parking Lot with the recommendation satellite and no event link; a
  matching event name → the `EventSupplierEntry` link with `addSupplierToEvent`'s exact
  defaults; a non-matching one → still created, in Scouting Event, with the string on
  `ScoutingInput` and a `warning` notification quoting it verbatim *alongside* the ordinary
  create notification; a DUNS already on file → no create, no notification, and the event is
  not even resolved; and a failing profile PATCH still answering "created" while logging and
  notifying.
- `tests/integration/formIntake.test.ts` (34 tests) — the endpoint over HTTP with
  `AUTH_OPTIONAL=false`, so every 201 is also proof it sits **above** the `authenticate()`
  mount: 201 `{id, folio}` with no JWT, 401 (missing/wrong key) and 503 (unset secret) both
  leaving `supplier.create` untouched, the ZodError 400 shape for a missing field / wrong
  type / unknown `entrySource` / `Event` with no `eventName` / an answer wider than its
  column, the 400 naming `annualRevenue`, unknown keys ignored, and the 409 carrying the
  existing id and folio. Plus the fifteen profile answers added 2026-08-24: a full payload
  landing every one of them in its satellite table on **both** `entrySource` branches, the
  same payload with all fifteen absent still answering 201, the automotive percentage
  dropped against a non-`Mixed` market, both derived values of `exportCapability` (and its
  absence when neither export question was answered), and the 400s for a percentage outside
  0–100 or a years-in-Mexico past 150. Plus Q34 as a single value: each of the three
  `immexAnswer` labels reaching its own `FK_ImmexStatus` id against the **whole** catalog
  (so a wrong mapping picks a wrong id rather than none), the 400 naming the field when the
  answer is outside the three — `'In Plan'` is the catalog name, not a Form answer — and the
  retired `hasIMMEX`/`planIMMEX` pair now being stripped as unknown keys rather than
  writing a status nobody chose.
- `tests/integration/users.test.ts` — full `/api/users` CRUD incl. the **last-SSD guard**
  (both PATCH and DELETE), 409 on duplicate, 400 on bad email/role.
- `tests/unit/eventProspectsRules.test.ts` (15 tests) — the pure prospect rules (§2.0b),
  no Prisma: `normalizeCompanyName` trims and collapses tabs/newlines/runs (and reduces a
  whitespace-only cell to `''`, which the import drops); `interestDeadline` picks the
  earlier limit **in both directions** (an event 9 days out is capped by the event, one 30
  days out by the 14-day window), crosses a month boundary and a leap-year February,
  accepts a full ISO instant for the import date (that is what the column stores), and is
  `null` for garbage — including a date the calendar does not have (`2026-02-30`), which
  must not roll forward. `isValidB2bDateTime` accepts `2026-08-20T14:30` and rejects a
  bare date, month 13, Feb 30, hour 25, minute 60 and anything not exactly that format.
  The interest **ownership** rules (409/403) live in the service and are not covered here.
- `tests/unit/intelexEfficiency.test.ts` (20 tests) — the stepped scale at **every
  branch boundary** (delay −10/0/5/6/15/16/25/26 and far beyond), that it stays
  gradual in between (ten consecutive delays, strictly falling, never 0 or 1 — the
  bug it replaced), null for a missing/unparseable date, and an ISO instant read
  day-first. `calcIntelexGlobalEfficiency` averages only the scored levels
  (**nulls skipped, not zeroes**) and is null when none is. Plus persistence through
  `updateSupplier`: a level scored from its own pair with the stored row filling the
  other half, recomputation on an **Expected-only** patch, a level cleared back to
  null when a date is removed, client-sent efficiencies ignored, and no recompute
  (nor read of the stored row) when the patch touches no Intelex date.

Earlier suites (verified 2026-07-16):

- `tests/unit/slaRules.test.ts` (38 tests) — the pure threshold functions at their
  exact boundaries (24/25/29/30 Parking, 49/50/59/60 Preliminary, 74/75/89/90
  global), no colour invented for the three stages without a confirmed limit,
  `daysSince` (floors future dates at 0, null for absent/unparseable like `'TBC'`),
  and `resolveSla` anchor precedence vs. the stored-counter fallback. Plus the
  **live `daysInStage`** (§2.1): its anchor chain per stage (Scouting →
  `stageEnteredAt` then `onboardingDate`; Supplier Evaluation → `stageEnteredAt`
  only; Intelex → record-creation date first), that Parking/Preliminary keep their
  satellite date ahead of `stageEnteredAt` **so no colour moves**, that an
  unparseable anchor falls through like a null one, and that terminal stages stay
  on their frozen counter.
- `tests/integration/sla.test.ts` (13 tests) — `FK_Sla`/`FK_GlobalSla` and the day
  counters actually persisted over HTTP: stale green → red at 30 days parked, the
  25-day boundary, no write when already correct (idempotent reads), stage and
  global colours resolved from different anchors, fallback to the stored
  `daysInStage`, stages without a threshold left alone, blacklisted rows frozen,
  and recalculation on create / patch / stage move. Two cover the frozen-counter
  fix specifically: a **Supplier Evaluation** row whose `daysInStage` refreshes
  from `stageEnteredAt` **without** gaining a colour, and an **Intelex Handoff**
  row counted from its record-creation date.
- `tests/unit/trackerRules.test.ts` — stage transitions (unknown stage,
  blacklisted / completed immovable, backward moves rejected, Completed only from
  Intelex Handoff, satellite creation), the **mandatory stage-change note**
  (missing/junk note rejected before any DB access; valid note stamps
  `stageEnteredAt`, structured `fromStageId`/`toStageId`, and a real
  destination-tagged `SupplierNote`), blacklist reason mandatory **and** junk
  rejected (`"na"`), double-blacklist, No Go auto-blacklist (reason validated
  before any write), Go doesn't blacklist, delete only in Scouting Event.
- `tests/unit/notesRules.test.ts` — stage tagging, empty **and short/junk** text
  (shared `assertMeaningfulText` rule), author-only edit/delete, cross-supplier
  note 404.
- `tests/integration/auth.test.ts` (12 tests) — login success (upsert + hashed refresh
  token), existing-user update, wrong password 401, unknown user 401, missing field
  400, `/me` with valid/invalid token, refresh rotation/expiry, logout idempotency.
- `tests/integration/tracker.test.ts` (12 tests) — stage-config, flat DTO contract
  over HTTP, move/blacklist/substatus validation codes (400/404/409), strict-auth 401,
  demo-user attribution with `AUTH_OPTIONAL=true`.
- `tests/unit/catalogMapping.test.ts` (13 tests) — the two catalog translations
  (`services/catalogMapping.ts`): `immexNameFromAnswer` on each of Q34's three answers,
  that it covers every wire answer and maps them to **distinct** catalog values (the
  property the old `hasIMMEX`/`planIMMEX` pair could not have — four combinations for
  three answers), and that it never produces `'TBC'`; plus `normalizeConfidence`'s
  aliases and its `TBD` fallback.
- `tests/integration/immexAnswer.test.ts` (12 tests) — Q34 on the in-app contract, both
  directions: `PATCH` resolving each answer to its own `FK_ImmexStatus` (including over
  the create branch's `'No'` default), the 400 on a value outside the three **before any
  write**, the retired boolean pair now failing loudly as unroutable keys, and an omitted
  answer leaving the FK alone; `GET` returning the catalog name in `immexStatus`, `null`
  with no `CommercialInfo`, and neither `hasIMMEX` nor `planIMMEX` in any form.
- `tests/unit/dataImportNormalize.test.ts` (34 tests) — the pure functions behind the
  Excel importer (§7): name normalization/dedup key, commodity mapping (aliases,
  aggregated→placeholder, unmapped incident), safe truncation, integer/year extraction
  from prose, Excel-date parsing, IMMEX/Y-N/sub-status normalization, buyer/event aliases
  and stage resolution (blacklist-wins, most-advanced-reached, never Completed).

---

## 7. Data import — real GSM spreadsheets → JSON → DB (`data-import/`)

A **one-off, three-stage** migration of the 5 real GSM Excel files: **(1)** a parser that
produces an intermediate JSON payload (no database), **(2)** an importer that inserts the
suppliers, and **(3)** an importer for the rest (events, MRL, and the history backfill that
powers Reports).

```bash
npm run import:parse                           # stage 1: source/*.xlsx → output/*.json (no DB)
IMPORT_REAL_DATA=true npm run import:suppliers  # stage 2: output/suppliers.json → suppliers
IMPORT_REAL_DATA=true npm run import:rest       # stage 3: events + MRL + event links + history backfill

# one-time catch-up for data imported BEFORE stage 3 learned to write StageEnteredAt
BACKFILL_STAGE_ENTERED_AT=true npm run import:backfill-stage
```

- **`data-import/source/`** — the 5 `.xlsx` (`Master_Requirements_List…`,
  `Scouting_Event_-_B2B_Meetings`, `Supplier_Parking`, `Preliminary_Evaluation…`,
  `BlackList_Suppliers`). **Gitignored** — real, confidential company data. The folder is
  not tracked, so a fresh clone won't have it: the spreadsheets are **placed by hand on the
  server just before an import, and deleted from disk right after it**, never versioned and
  never left there between runs. `source-guard.ts` enforces that at runtime — `parse.ts` and
  `import-rest.ts` re-check every path with `git check-ignore` before reading it and abort if
  it isn't ignored (or is already tracked). Full procedure:
  [`data-import/README.md`](data-import/README.md).
- **`data-import/output/`** — generated `suppliers.json`, `events.json`, `mrl.json`,
  `import-report.md`, `import-log.md`, `import-rest-log.md`. Also **gitignored** (derived).
- **`parse.ts`** (parser entry) · **`import-suppliers.ts`** + **`import-rest.ts`** (importer
  entries) · **`mappings.ts`** (lookup tables) · **`source-guard.ts`** (the `.gitignore`
  check above) · **`normalize.ts`** (pure, unit-tested
  cleaning functions). Uses **`xlsx` (SheetJS)**, a **devDependency** (build-time only; its
  known advisories don't reach runtime — it never parses untrusted input in the server).

**The sheets are layers, not separate sets.** One supplier is written across every sheet
it passed through, so the parser **deduplicates**: key = *normalized name* + *mapped
commodity* (a company evaluated for two commodities is intentionally **two** suppliers —
OGAWA / ARBOMEX / NIDEC / MINAMIDA — which is why `DunsNumber` has no `UNIQUE`).
Scouting-List rows have no defined commodity, so they dedup by **name only** and attach
their event participation to an existing supplier when one exists (oldest onboarding on a
tie, logged as an ambiguity). 692 raw rows → **533 deduplicated suppliers** (last run).

**Stage is the most advanced reached** (`Scouting Event < Parking Lot < Preliminary <
Supplier Evaluation < Intelex Handoff`); **Blacklist always wins** (`status=BLACKLISTED`,
DB `stageBeforeExit` = the furthest stage before exit). Nothing imports as `Completed`.
Output objects mirror the frontend `TrackerSupplier`/`BlacklistedSupplier` wire shape
(every field present) with `id`/`folio` `null` and two importer-facing fields the DB needs
but the frontend derives: **`status`** and **`stageBeforeExit`**.

**Faithful cleaning, no data loss.** Commodities fold to the catalog (`Plastics→Plastic`,
`Stamping→Stampings`, …); the two aggregated values and any unmapped one go to
`'TBD -- Pending GSM'` (unmapped is flagged as an incident, never invented). Every text
field is truncated to its **real NVARCHAR limit** with an `…` and reported. `Int?` columns
carrying prose ("598 globally", "26 Years") yield their first number or null. Excel dates
become `YYYY-MM-DD` (`TBD`/`TBC`/`-`/`#VALUE!` → null); the broken `Days elapsed` and
formula-based `Timeless` Parking columns are dropped (the app recomputes SLA from the
onboarding date). Buyers normalize to the 21 seeded users; unknown ones stay as free text
and are reported (never invented as users). The Intelex **`intelexTabsCompleted`**
flags are derived from the row's own data — `efficiency` used to be hardcoded
`false`, which left the tab permanently incomplete and so permanently disabled the
detail page's *Complete* button for every imported supplier; it is now true when
the derived `intelex_currentLevel` is past `Investigate` (efficiency comes from the
expected-vs-real dates, so any captured level gives something to review) **or** the
Excel carries at least one `intelex_efficiencyL0..L4` value. Those five percentages
are taken from the Excel as-is (it computes them with the same formula the app now
uses — §2.2c); **`intelex_efficiencyGlobal` is aggregated here** with
`calcIntelexGlobalEfficiency`, since the Excel has no column for it, so an imported
supplier shows a Global without waiting for its first Timeline save. The Plan-IMMEX sentence is normalized to
`Y/N/null` with the full text preserved in `prelim_observations`. Each supplier also
carries an **`_excelSources`** array (the exact folio/item of every source row) — provenance
the importer turns into a history entry. **`import-report.md`** documents every
transformation: counts per stage, merged suppliers (which sheets joined), `TBD` commodities
and why, truncations, unrecognized buyers, event ambiguities and any discarded rows.

### The importer (`import-suppliers.ts`)

Inserts `suppliers.json` into the database by **reusing `seedSupplier()`** from
`prisma/seed.ts` (the same writer the demo seed uses — no second insert path) with a catalog
map built exactly like `seedDemoTrackerData()`. It is deliberately **non-destructive**: it
never calls `seedDemoTrackerData()` or any `deleteMany()`, so it can only add rows.

- **Guarded by `IMPORT_REAL_DATA=true`** (same pattern as `SEED_DEMO`). Without it, it
  prints a warning and exits without touching the DB. Also guarded by
  `assertWritableDatabase`: a non-`_TEST` `DATABASE_URL` aborts unless
  `ALLOW_PRODUCTION_IMPORT=true` is set deliberately (it then prints a warning banner
  and proceeds — production writes are possible, never silent).
- **Folios:** each imported supplier gets `XL-SSD-<year>-NNNN` (`padStart(4)`), and id
  `xl-<uuid>`. The **`XL-` prefix** marks Excel-migrated rows and keeps them out of the
  native `SSD-<year>-NNNN` sequence — `suppliersService.nextFolio()` explicitly excludes
  `XL-` folios so imported numbers never consume the native range.
- **`StageEnteredAt` at insert time:** `seedSupplier()` (shared with the demo seed) now
  derives it — the date of the **last history entry** when the supplier has one (true for
  the `pipeline-demo.ts` rows, whose log ends with the move into their current stage),
  otherwise the current stage's own date (`onboardingDate` / parking onboarding / prelim
  start / Intelex record creation). **Supplier Evaluation is deliberately left null** here:
  the schema has no date of its own for it, so guessing would invent an inflated day count
  — `import-rest.ts`'s Part 4 fills it with the real import anchor instead.
- **Traceability:** the supplier's first history entry records the source folios in its
  `action`, e.g. *"Imported from Excel — origen: Parking Lot List folio 100; Blacklist folio
  34"* (from `_excelSources`) — the audit trail back to the spreadsheets without spending a
  schema column.
- **Idempotent:** before inserting it loads existing `name + commodity` keys and **skips**
  any already present (reported as "already imported"), so a re-run never duplicates and a
  partial run can be finished. It never upserts over rows the team may have edited by hand.
- **Batched + isolated:** 50 suppliers per transaction so one bad row can't sink the run;
  if a batch transaction fails it retries its rows one-by-one to isolate and report the
  culprit, then continues. Results (inserted / skipped / failed-with-error) go to the
  console and **`import-log.md`**.
- **Post-import verification** (printed + logged): counts by stage and by status
  (`ACTIVE`/`BLACKLISTED`), how many landed on `'TBD -- Pending GSM'`, and how many are
  **SLA red**. The importer recomputes SLA the same way every read path does
  (`syncSuppliersSla`), so red reflects the **real** elapsed days — for Parking Lot that is
  77–317 days against a 25/30-day threshold, so almost all are red. **That is correct, not a
  bug:** the colour is derived from the onboarding date and keeps advancing.

Verified end-to-end against a local SQL Server: **533 inserted** (532 + 1 re-run to prove
idempotency), 0 failed, split ACTIVE 445 / BLACKLISTED 88 and 344 on the pending commodity.

### The rest importer (`import-rest.ts`)

Runs **after** `import:suppliers` (same `IMPORT_REAL_DATA=true` gate, idempotent,
non-destructive). Finishes the migration in four parts and writes **`import-rest-log.md`**:

- **Events** — the 7 events from `events.json` (`organizer`/`description`/`objective`/
  `topCountry` empty, filled in-app later; `status` = *Completed* if `dateEnd < today` else
  *Upcoming*; the Agenda **Stand** column, which has no `T_Event` field, is preserved as a
  `"[Stand: …] "` prefix on `description`). Then a **`T_Event_SupplierEntry`** per Scouting-List
  row (supplier matched by the parser's normalized name, oldest-onboarding on a tie; event
  label normalized — `CAPIM 2026`→`CAPIM`) and a **`T_Event_B2BMeeting`** for each of the 71
  rows carrying agenda data. The July-summit rows get `b2bMeeting=false / Accepted / Not
  Included` and no meeting, as specified.
- **MRL** — the 37 Master Requirements List rows → `MrlRequirement`. The schema's NOT-NULL
  text columns that the Excel leaves blank go in as `''`; `priority` defaults to `2`;
  `targetPrice` is `null` for the row whose Excel value is the literal `'$'` (a parser
  `numOrNull` fix — `Number('')` was `0`); the empty 2026–2031 volume columns are all `null`.
- **Strategy** — **not touched.** It only **reports** the current `StrategyEntry` count and
  commodities; GSM captures the real needs in-app (`upsertStrategyEntryByCommodity`). The
  "Data SD" tabs are intentionally not imported.
- **History backfill — this is what makes Reports work.** `reportsService.getStageSnapshot()`
  reconstructs a supplier's stage on any past date from `T_Supplier_History`; a supplier with
  only its import-day entry is invisible before today. So for each supplier this writes one
  stage-defining entry **per datable transition, in chronological order**, using the real
  Excel dates: birth (earliest date, `toStage` = first stage, `action` carries the Excel
  origin), → Parking Lot (onboarding date), → Preliminary (pre-eval start), → Supplier
  Evaluation (pre-eval start, flagged **estimated**), → Intelex Handoff (record-creation
  date), → Blacklisted (rejection date, `fromStage` = the pre-exit stage). A transition's
  `note` carries the real reason (blacklist *Reason* / parking *Additional Comments*) **only
  when it passes the shared `assertMeaningfulText` rule** (≥10 chars, not junk) — otherwise
  `null`, never invented text — and each such reason also becomes a real **`SupplierNote`**
  (dated at the movement, `createdAt` too) so it shows in the notes panel and Reports. A
  Scouting birth date is **capped at today** (a supplier registered for a future event
  entered the pipeline now, not on the event date), and the redundant `"Demo supplier seeded"`
  row `seedSupplier` appends (dated today) is **neutralized** (`toStageId` nulled, relabeled —
  no delete) so it can't show as a bogus "moved today" in every weekly diff.
  **The same timeline now also anchors `Supplier.StageEnteredAt`** — the date the live
  "Days in Stage" counter reads (§2.1) — using the last non-`Blacklisted` transition, and
  **only when the column is still null** (a value already there is either correct or a
  manual correction; overwriting it would restart someone's clock). Suppliers whose current
  stage is **Supplier Evaluation** get the literal constant `SUPPLIER_EVAL_IMPORT_ANCHOR =
  '2026-07-24'` — the date the real import ran — instead of their timeline date, because
  that date is the *estimated* pre-eval start and would show a fabricated, months-old day
  count from day one. It is hardcoded rather than a dynamic `TODAY` on purpose: a dynamic
  value would silently reset those counters to 0 on every re-run.

**Verification** (printed + logged): `getStageSnapshot()` at **2026-03-01, 2026-05-01 and
today** must show a coherent progression — fewer, earlier-stage suppliers the older the date.
Against the local SQL Server it produced **44 → 178 → 445** (e.g. 2026-03-01 concentrated in
Parking Lot, today spread across all five active stages incl. 2 in Intelex Handoff), and a
re-run changed nothing (7 events reused, 420 entries upserted, 0 meetings/MRL/backfill added).

### The one-time `StageEnteredAt` catch-up (`backfill-stage-entered-at.ts`)

```bash
BACKFILL_STAGE_ENTERED_AT=true npm run import:backfill-stage
```

**Why a separate script.** The real Excel import already ran against
`MX_MFGIT_SSD_TEST` on **2026-07-24** (commit `c23fed5`), before `import-rest.ts`
learned to write `StageEnteredAt`. Its backfill is idempotent by checking whether the
supplier's birth history row already carries a `toStageId`, so simply re-running
`import:rest` reports *"already backfilled"* for all 533 rows and applies nothing. This
script is the retroactive pass over data that already exists.

- **Guarded by `BACKFILL_STAGE_ENTERED_AT=true`** (same pattern as `IMPORT_REAL_DATA`);
  without it, it warns and exits without touching the database. Also guarded by
  `assertWritableDatabase` (see above).
- **Scope:** every **ACTIVE** supplier — any folio, demo (`SSD-`) or imported (`XL-`) —
  whose `StageEnteredAt` is **null**. Terminal rows are left alone (their clock stopped).
- **Value:** the `date` of the **most recent `T_Supplier_History` entry whose `toStageId`
  is the supplier's current stage** (ordered `date`, `createdAt`, `id` desc — the same
  ordering `reportsService.getStageSnapshot()` uses) — that row *is* the recorded moment
  the supplier entered where it is now. Suppliers in **Supplier Evaluation** get the same
  literal `2026-07-24` anchor, for the same reason as the rest importer above. Timestamps
  are written at **noon UTC**, since the source is a day-precision string and midnight
  would fall on the previous calendar day in the local UTC-6 timezone.
- **Idempotent and narrow:** it writes only that one column, only where it is null, so a
  second run is a no-op. A supplier with no history entry into its current stage is
  **skipped and listed** — never given an invented date.
- **Log:** `data-import/output/backfill-stage-entered-at-log.md` (same `writeLog()`
  pattern as the other importers) — candidates, fixed count broken down by stage, the
  skipped rows with the reason, how many remain null, and a per-supplier detail table.

⚠ **TEST by default.** It is a data fix for `MX_MFGIT_SSD_TEST`. Pointing `DATABASE_URL`
at production aborts unless `ALLOW_PRODUCTION_IMPORT=true` is also set — see
`assertWritableDatabase` in `src/config/testDatabaseGuard.ts`.

