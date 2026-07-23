# SSD Tracker Management — Backend

Node.js + Express + TypeScript + Prisma + SQL Server backend for the SSD Tracker
Management frontend (React/Vite app in the sibling `frontend/` folder). The API mirrors
the contract implied by `frontend/src/services/*.ts` and `frontend/src/types/index.ts`,
and the seed reproduces `frontend/src/data/*.ts` so the frontend looks identical when
pointed at the API (`http://localhost:3000/api`, matching
`frontend/src/services/api.config.ts`).

### Estado de integración (2026-07-17)

**Backend: verificado y funcional.** Conexión real a SQL Server
(`MX_MFGIT_SSD_TEST`), `prisma db push` → *already in sync*, `npm run seed` →
`[seed] done ✔`, y la API completa (auth, tracker, suppliers, events, strategy,
notifications — ver §3) implementada y cubierta por 99 tests.

**Frontend completamente conectado.** Los 6 servicios hacen `fetch` real a la API
(vía `apiFetch`, que normaliza todo error a `ApiError`), y **ninguna página o
componente importa ya `frontend/src/data/*.ts`** — esos demos solo sobreviven
porque `prisma/seed.ts` los importa para poblar la base. `TrackerSupplierDetail.tsx`
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
Se conserva el archivo `frontend/src/data/pipeline-demo.ts` y sus variables
exportadas (`pipelineSuppliers`, etc.) por decisión: solo las consume el seed.

---

## 1. Running locally

### Prerequisites

- Node.js ≥ 20 (developed on v24)
- A reachable **SQL Server** instance over **TCP** (Express edition is fine)

> **✅ TCP/IP connectivity — resolved.** The historical blocker (SQL Server Express
> ships with TCP/IP disabled) has been resolved and verified in at least one dev
> environment with a real run: `npm run prisma:generate` (client generated, no
> errors) → `npm run prisma:push` (`Your database is now in sync with your Prisma
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
> `corp-ca.pem` was generated during setup (gitignored).

### Steps

```bash
cd backend
npm install
cp .env.example .env          # then edit DATABASE_URL if needed
npm run prisma:generate       # generate the Prisma client
npm run prisma:push           # create the schema in the database (needs a live DB)
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
> `../frontend/src/data/*.ts` (which **wipes and reseeds** suppliers/events/strategy) is
> gated behind `SEED_DEMO=true` and is for local dev only. Notifications are **not** seeded
> — they come from real domain events.

Tests and typecheck (no database required — Prisma is injected/mocked):

```bash
npm test                      # 99 tests: unit (business rules) + integration (HTTP)
npm run typecheck
```

### Environment variables (see `.env.example`)

| Var | Meaning |
|---|---|
| `DATABASE_URL` | Prisma SQL Server connection string |
| `PORT` / `CORS_ORIGIN` | Server port / allowed origins (Vite dev server default) |
| `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_EXPIRES_DAYS` | Token settings |
| `AUTH_MODE` | `mock` (simulated LDAP, password `password`) or `ldap` (real FastAPI service) |
| `LDAP_API_URL` | FastAPI/LDAP service base URL. **Required when `AUTH_MODE=ldap`** — no hardcoded default; the server refuses to start without it. Ignored in mock mode. |
| `LDAP_API_KEY` | `X-API-Key` for the service's `POST /auth/profile` (profile lookups). **Not used by login** — `POST /auth/login` authenticates by body only. |
| `AUTH_OPTIONAL` | `true` → requests without JWT run as the demo user (Yael Urbano / SSD) — needed while the frontend has no login UI and sends no token; `false` → strict Bearer auth everywhere |
| `DEFAULT_APP_ROLE` | Role assigned to a brand-new user on first login. Defaults to `Guest` (least privilege). |

Mock-mode users (`AUTH_MODE=mock`, password `password`): `yael.urbano`,
`carlos.mendoza`, `ana.garcia`, `roberto.sanchez`.

---

## 2. Architecture

```
backend/
├── prisma/schema.prisma   # 35 tables in 7 domains (see below)
├── prisma/seed.ts         # seedCatalogsAndUsers() always; seedDemoTrackerData() only if SEED_DEMO=true
├── src/
│   ├── server.ts / app.ts # app factory with full dependency injection
│   ├── routes/            # one file per module
│   ├── controllers/       # HTTP ↔ service translation (zod validation)
│   ├── services/          # pure business logic (testable without HTTP)
│   ├── mappers/           # relational rows ↔ flat TrackerSupplier wire shape
│   ├── middleware/        # JWT auth, role guard, error handling
│   ├── auth/ldapClient.ts # LdapAuthClient interface + HTTP + mock impls
│   ├── domain/            # controlled vocabularies + typed errors + SLA rules (sla.ts)
│   └── config/            # env + shared Prisma client
└── tests/                 # vitest + supertest (Prisma mocked via DI)
```

**Table domains** (spec said ~17–19; this landed at 35 because notes, junction,
child and catalog tables are modeled explicitly):

1. **Catálogos** — `Commodity` (36-value controlled lookup) + the naming-compliance
   catalog retrofit: `Stage`, `SupplierStatus`, `SubStatus`, `Sla`, `ProductCategory`,
   `ConfidenceLevel`, `ImmexStatus`, `Role`, `RoleRasicAssignment` (10 tables)
2. **Supplier núcleo** — `Supplier`, `CompanyInfo`, `TechnicalInfo`, `CommercialInfo`,
   `SupplierDocument`, `SupplierNote`, `SupplierHistoryEntry`, `SupplierPart`, `PrelimPart`
   (9 tables)
3. **Satélites por etapa (1:1)** — `ScoutingData`, `ParkingData`, `PreliminaryData`,
   `SupplierEvalData`, `IntelexData` (5 tables)
4. **Ramas de salida** — `BlacklistEntry`, `CompletionEntry` (2 tables)
5. **Events** — `Event`, `EventSupplierEntry` (N:M junction), `EventB2BMeeting`,
   `EventNote` (4 tables)
6. **Strategy/MRL** — `StrategyEntry`, `MrlRequirement` (2 tables)
7. **Sistema/usuarios** — `User` (with `adObjectId` + custom `appRole`),
   `RefreshToken`, `Notification` (3 tables)

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
  `blacklistSupplier`. It is a reporting/display superset of the two SLA anchor
  dates (`ParkingData.OnboardingDate`, `PreliminaryData.StartDate`) — it does
  **not** replace them and the SLA logic is unchanged (§2.1).
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
  2026-07-17).
- **Direct Material only on the tracker board** — `GET /api/tracker/suppliers`
  filters `productCategory = 'Direct'`; Indirect rows remain visible through
  `GET /api/suppliers` (Indirect is "an exit via filter", not a parallel flow).
- **SLA colour is derived, not authored** — `FK_Sla` / `FK_GlobalSla` are
  recomputed from elapsed days and persisted by the backend; see §2.1.

### 2.1 SLA — a derived, persisted value

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
columns that nothing recomputes over time (see Pending TODOs), so a colour
derived from them would freeze until someone edited the supplier. Instead the
days are counted from the stage's **anchor date** on every read:

| Scope | Anchor | Fallback |
|---|---|---|
| Parking Lot | `T_Supplier_ParkingData.OnboardingDate` | stored `DaysInStage` |
| Preliminary Evaluation | `T_Supplier_PreliminaryData.StartDate` | stored `DaysInStage` |
| Global | `T_Supplier_ParkingData.OnboardingDate` | stored `DaysSinceParkingLot` |

The anchors are exactly the dates the stage satellites already record when
`moveSupplierToStage` creates them, so rows that flow through the app always have
one. The fallback covers seeded rows that don't (demo suppliers past Parking Lot
carry the counter but no parking date) — those keep a static colour rather than a
wrong one. `DaysSinceParkingLot` is re-persisted alongside the colour, since the
UI shows it as "N/90 days" next to the global badge.

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
their clock stopped when they left the tracker, and the colour at exit is part of
the record.

`sla` / `globalSla` are still *accepted* by `PATCH /api/suppliers/:id` so the wire
contract doesn't break, but they are overwritten by the derived value in the same
request — clients should treat both as read-only.

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
  other stage, so consumers that only read `count` are unaffected. **Caveat:**
  `currentLevel` is a live field (not historized), so for a **past** snapshot date
  the *stage* is reconstructed correctly from history but the *level* reflects each
  supplier's current level — historizing level transitions is a follow-up.
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
operational modules (SSD/PM/Buyer/SQD can view, Guest is 403'd). There are no
mutating routes. **Known limitation:** demo suppliers loaded via `SEED_DEMO=true`
have free-text history without `toStageId`, so they don't appear in snapshots — the
module is built for app-created suppliers, which always carry the structured FKs.

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
  - `appRole` (`SSD|PM|Buyer|SQD|Guest`) is a **custom column on `users`**, not derived from
    AD, and **`roleId` is never touched on update** — it belongs to the app. New users
    default to **`Guest`** (least privilege; see "Roles y control de acceso").
  - **`email` and `adObjectId` are nullable and NOT `@unique` in Prisma.** SQL Server's plain
    `UNIQUE` tolerates only one `NULL` per table, and LDAP never returns a GUID (every row has
    `adObjectId = NULL`), so a `@unique` there made the 2nd user INSERT fail with `P2002`.
    Real uniqueness (when not null) is enforced by **manual filtered indexes** outside Prisma;
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
> `NVarChar(100)` column (`@map("SupervisorName")`). TEST was updated with
> `npx prisma db push` (applied against `MX_MFGIT_SSD_TEST`). **Production** must run
> [`sql/2026-07-22_add_supervisorname.sql`](sql/2026-07-22_add_supervisorname.sql)
> (`ALTER TABLE [C_User] ADD [SupervisorName] NVARCHAR(100) NULL;`, guarded so it is
> idempotent). Verify in SSMS with `SELECT COL_LENGTH('C_User','SupervisorName')` (non-null
> once the column exists).

> **Wire addition: `TrackerSupplier.stageEnteredAt`** — the mapper now emits the
> supplier's real "entered current stage" instant (`Supplier.StageEnteredAt`, already
> stamped on create/move/blacklist) as an ISO string or `null`. Additive and nullable;
> the frontend Home activity feed uses it for real relative timestamps.

> **Schema change (2026-07-23): `IntelexData.currentLevel`** — a new
> `NVarChar(20) NOT NULL DEFAULT 'Investigate'` column (`@map("CurrentLevel")`) that makes
> the Intelex Handoff sub-level an **explicit sub-status** instead of something only
> implied by which date fields are filled. Values: `Investigate | L0 | L1 | L2 | L3 | L4
> | Completed`. TEST was updated with `npx prisma db push`; **production** runs
> [`sql/2026-07-23_add_intelex_currentlevel.sql`](sql/2026-07-23_add_intelex_currentlevel.sql)
> (idempotent; the `DEFAULT` backfills existing rows so the column is `NOT NULL`
> immediately). **Sequencing rule** (`suppliersService.updateSupplier`): a level's **"Real"**
> date can only be captured once the previous level's Real exists (Investigate → L0 → L1 →
> L2 → L3 → L4); an out-of-sequence Real is a **`BusinessRuleError` (409)** thrown before
> any write. "Expected" dates are never sequenced. Capturing a Real advances `currentLevel`
> to the furthest fully-sequenced level; closing the handoff (move to `Completed`) sets it
> to `'Completed'`. The mapper emits it as **`intelex_currentLevel`** (read-only; the update
> path ignores any client-sent value and re-derives it). Covered by
> `tests/unit/intelexSequencing.test.ts`.
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
| **`SSD`** | **Master.** User administration (`/api/users`) + full read/write on all operational modules. |
| `PM` / `Buyer` | Operational writers — full read/write on tracker/suppliers/events/strategy. **Provisionally identical**: field-level PM-vs-Buyer differences are deferred to the RASIC matrix (an explicit decision, not an oversight). |
| `SQD` | **Read-only.** May `GET` every operational module but is 403'd on every mutating verb (POST/PATCH/PUT/DELETE). |
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

- `OPERATIONAL_READ_ROLES = ['SSD','PM','Buyer','SQD']` — mounted on `/api/tracker`,
  `/api/suppliers`, `/api/events`, `/api/strategy`; blocks `Guest`.
- `OPERATIONAL_WRITE_ROLES = ['SSD','PM','Buyer']` — applied to every POST/PATCH/DELETE in
  those four routers; additionally blocks read-only `SQD`.

| Router / verb | Guard | `SQD` | `Guest` |
|---|---|---|---|
| `/api/tracker\|suppliers\|events\|strategy` — **GET** | `OPERATIONAL_READ_ROLES` | ✅ 200 | ❌ 403 |
| `/api/tracker\|suppliers\|events\|strategy` — **POST/PATCH/DELETE** | `OPERATIONAL_WRITE_ROLES` | ❌ 403 | ❌ 403 |
| `/api/users` (all verbs) | `requireRole('SSD')` | ❌ 403 | ❌ 403 |
| `/api/notifications` | none (any authenticated user) | ✅ | ✅ (empty for Guest) |
| `/api/home/summary` | none (any authenticated user) | ✅ | ✅ — its only supplier-derived data |
| `/api/auth/me` | authenticated | ✅ | ✅ |

So a `Guest` user reaches exactly three things: `/api/auth/me`, `/api/notifications`
(empty for them) and `/api/home/summary` (aggregated, anonymous — see §3). `SQD` sees the
full app read-only.

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
| Events | `GET/POST/PATCH/DELETE /api/events[/:id]` | CRUD; `suppliersRegistered` computed |
| | `POST /api/events/:id/suppliers` | form A: create supplier from event |
| | `POST /api/events/:id/suppliers/link` | link existing supplier (junction upsert) |
| | `POST/PATCH/DELETE /api/events/:id/notes[/:noteId]` | author-only edit/delete |
| Strategy | `GET /api/strategy/entries` / `PATCH /api/strategy/entries/:id` | inline needs edit (existing entry only) |
| | `PATCH /api/strategy/entries/by-commodity/:commodity` | **upsert** needs by commodity name — creates the entry if the commodity never had one (the drilldown editor uses this) |
| | `GET /api/strategy/overview` | `CommodityStrategyRow[]` (same algorithm as `StrategyPage.tsx`) |
| | `GET /api/strategy/commodity/:commodity` | drilldown row + its suppliers |
| | `GET/POST/PATCH/DELETE /api/strategy/mrl[/:id]` | MRL CRUD / inline edit |
| Reports | `GET /api/reports/weekly?from&to[&commodityId]` | week-over-week diff (see §2.2); **400** if `from`/`to` missing/malformed or `from > to` |
| | `GET /api/reports/weekly/latest[?commodityId]` | same, for the last 7 days ending today |
| | `GET /api/reports/commodities` | `{id,name}[]` commodity catalog for the filter |
| Notifications | `GET /api/notifications` | **per-user** (`req.user.id`); `time` label computed from `createdAt` ('hace 1h') |
| | `PATCH /api/notifications/:id/read` / `POST /api/notifications/read-all` | scoped to the caller — read-all only touches the caller's rows; marking another user's notification returns **404** (ownership check) |
| Users | `GET /api/users` | **SSD only.** `{id, username, displayName, email, supervisorName, role}`, ordered by `displayName`. **Guest rows are excluded** (see below) |
| | `POST /api/users` | pre-provision `{email, role}` — `username` is a `pending:<local-part>` placeholder until first login stamps the real netid. **Reclaims a Guest** with that email (promotes in place, adds `promotedFromGuest:true`); **409** only on a non-Guest email clash or a username-only clash |
| | `PATCH /api/users/:id` | `{role}` — **400 for any SSD row** (SSD is DB-managed, see below); also refuses to demote the last SSD (unreachable now, kept as defence) |
| | `DELETE /api/users/:id` | **400 for any SSD row** (SSD is DB-managed); non-SSD delete re-provisions as `Guest` on re-login |
| Home | `GET /api/home/summary` | **any authenticated role (incl. `Guest`).** Aggregated + **anonymous** — no supplier name/folio/company/id (see below) |

**Implemented vs pending:** every endpoint above is implemented and covered by
typecheck; auth, tracker, RBAC, users and notifications are covered by integration/unit
tests. Role-restricted endpoints **are now applied** (`requireRole` per router — see
"Roles y control de acceso"). Notifications are **per-user and generated by real domain
events** (see below). Still pending: file upload for `PipelineDocument.link`.

**`GET /api/home/summary`** returns `stageCounts` (the 5 working stages, ACTIVE + Direct
only, with colour), `topCommodities` (top 5 over all suppliers), `totalActive` /
`totalCompleted` / `totalBlacklisted`, and up to 3 `upcomingEvents` (Upcoming/Ongoing,
`{id, name, dateStart, location}`). Its aggregate **shape is the security boundary** — it
is the only supplier-derived endpoint the `Guest` role can reach, so it must never carry
an individual supplier identity.

**Notifications are generated by domain events** (`notificationsService.notifySsdTeam`):
supplier created, stage move, blacklist, and event created each fan out one notification
per **SSD** user. This is a provisional audience decision (whole SSD team) until the RASIC
matrix defines finer per-role/per-commodity audiences. Every call site wraps the notify in
`try/catch` so a notification failure can never roll back or fail the underlying operation.

---

## 4. Design decisions where the contract was ambiguous

1. **Commodity catalog replaced with the official 36-value Nexteer list**
   (confirmed by the business team) — it no longer mirrors the frontend
   `Commodity` union in `frontend/src/types/index.ts` verbatim. `Controllers` and
   `E-Mechanical Components` are split into individual subdivision entries in
   `Subcategory -- Category` order (`CCA -- Controllers`,
   `PCB -- E-Mechanical Components`, …; inverted per GSM 2026-07-17), and the
   plural `'Plastics'` is gone in favor of the official singular `'Plastic'`.
   The frontend demo data has since been reconciled to these values (see
   "Pending TODOs"). Existing `C_Commodity` rows were renamed in place — without
   re-seeding — by a one-off migration script (applied; no longer kept in this
   repo, see git log). Event `topCommodity` values (`'Machined Parts'`,
   `'Electronics'`, `'Stamping'`…) still do **not** match the catalog — kept
   as free text on `Event` since they're display summaries, not FKs.
2. **Date-like fields stored as `NVarChar`** — many contract "dates" carry non-date
   values (`eop: '2031'`, `time: 'hace 1h'`, `'TBC'`), and the frontend expects the
   exact strings back. Only system timestamps (`createdAt`, token expiries) are real
   `DateTime`. Tightening types is a candidate future migration.
3. **`prelim_parts` + `prelim_*Signed` live in the Supplier Evaluation satellite** —
   the frontend type prefixes them `prelim_`, but its own comments and
   `supplierEvalTabsCompleted` (`competitiveness`/`fundamentals`) assign them to
   Supplier Evaluation. The wire shape is unchanged either way.
4. **Backward stage moves are blocked.** `moveSupplierToStage` compares
   `stageIndex(newStage)` against the supplier's current stage and rejects the
   move with a `BusinessRuleError` if the target is earlier in the tracker.
   Only forward movement among the 5 working stages is allowed; `Completed` is
   reachable **only** from Intelex Handoff. Blacklisted/Completed suppliers can
   never move (terminal states).
5. **No admin override for Completed** — explicitly not implemented, per instructions.
   If needed, it should be a separate role-guarded endpoint with an audit entry.
6. **Note ownership by author display name** — mirrors the frontend
   (`note.author === currentUserName` in `NotesSidePanel.tsx`). User-ID ownership would
   be more robust once the frontend sends authenticated requests. Seeded note IDs get a
   supplier prefix to guarantee uniqueness (demo IDs repeat across spread-copied rows).
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
12. **Folio generation**: `SSD-<year>-NNN`, next number per year computed from the max
    existing folio. Fine for single-user dev; needs a sequence/retry for concurrency.

## 4.1 Formularios A/B — mapeo a columnas reales

Los dos formularios de alta (`Propuesta_Formularios_Proveedores_v2.pdf`) escriben
en dos pasos, porque la superficie de escritura está partida:

1. **`POST /api/suppliers`** — esquema zod fijo de 17 campos. Zod **descarta en
   silencio** cualquier clave fuera de esa lista, así que el formulario no puede
   mandar el perfil extendido por aquí. Es lo único que fija `entrySource`, y de
   ahí sale la etapa inicial (form A → Scouting Event, form B → Parking Lot).
2. **`PATCH /api/suppliers/:id`** — rutea cada campo plano a su satélite. A
   diferencia del POST, **rechaza con 400** las claves que no conoce, listándolas.

**La Sección 5 del form A se escribe dos veces, a propósito:** a las columnas
planas (`CompanyInfo`/`TechnicalInfo`/`CommercialInfo`), que el detalle del
proveedor muestra en cualquier etapa; y al satélite **`PreliminaryData`**
(`prelim_*`), que es donde el documento dice que estas respuestas reaparecen
("no se vuelven a preguntar ahí, solo se confirman"). `PreliminaryData` es
además el **único** hogar de 8 preguntas de §5 que no tienen columna plana:
`generalManager`, `footprint` (presencia), `yearsInMexico`, `market` (enfoque de
mercado), `processingMethod`, `toolingDesign`, `rawMaterialIndex`,
`applications`.

### Campos SIN columna equivalente (no se pierden: se guardan como nota)

Estas preguntas no tienen dónde vivir en el esquema. En vez de descartarlas, el
formulario las adjunta como **nota del proveedor**. Añadir columnas es una
decisión de esquema fuera del alcance de esta tarea.

| Form | Pregunta | Por qué |
|---|---|---|
| A (Q7) | "How did you hear about Nexteer?" (Event/Social Media/Email/Other — catálogo confirmado GSM) | No existe columna |
| A (Q14) | Sector de negocio | Duplicado de Q30 "Enfoque de mercado" → `prelim_market` |
| A (Q15) | ¿Es tu primer contacto con Nexteer? | No existe columna |
| B | Supervisor / Manager del recomendante | No existe columna; pendiente de Active Directory |
| B (Q11-12) | Nombre / Email — Contacto 2 | El esquema guarda **un solo** par de contacto |

### Campos que SÍ se guardan pero con pérdida

| Campo | Pérdida |
|---|---|
| A (Q25) Número de empleados | Rangos GSM (Micro/Small/Medium/Large); `CommercialInfo.Employees` es `Int`, así que solo se guarda la cota inferior (1/11/51/251) — la etiqueta no se persiste. |
| A (Q26) Ingresos anuales por región | Ahora **monto + moneda** (input numérico + select); se unen a `AnnualRevenue` `NVarChar(50)` como `"120000000 USD"`. El desglose repetible por región sigue sin estructura. |
| A (Q27) Volumen de producción por región | Filas repetibles → texto en `NVarChar(100)`. |
| A (Q29) Press capacity | Ahora **valor numérico + unidad** (T/kN); se unen a `pressCapacity`/`prelim_pressCapacity` como `"500 T"`. |
| A (Q32) Capacidad de exportación | `exportCapability` es **booleano en el contrato**; el detalle (% local + países) solo sobrevive en `prelim_exportCapability` (texto). |
| A (Q33/Q37/Q39) Certificaciones / Operaciones / Materiales | Multi-select → una sola cadena separada por comas. "Other" se expande a `Other: <texto>`. |

> **"Other" free-text (GSM 2026-07-17).** Toda pregunta cerrada con opción
> *Other* revela un input para especificar; se pliega en el valor como
> `Other: <texto>` (`resolveOther`/`joinListWithOther`, payload.ts) y se guarda
> en la misma columna que la selección.

> ⚠ `prelim_hasIMMEX` **no** es una columna (el modelo usa `immexStatusId`);
> mandarlo por PATCH devuelve 500. IMMEX se manda como `hasIMMEX`/`planIMMEX`,
> que el servicio colapsa en el FK.

## 5. Pending TODOs

- **FastAPI/LDAP service — 2 known security issues (Leo's service, NOT this repo, by scope):**
  1. LDAP traffic on **port 389 unencrypted** (no LDAPS/StartTLS).
  2. **`API_KEY` hardcoded** in the service's `config.py`.
  (Also marked as `TODO(security)` in `src/auth/ldapClient.ts`. The former
  "`requirements.txt` unpinned" item **no longer applies** — the deployed service ships
  pinned versions.)
- ~~Role → permission matrix undefined~~ — **partially applied.** `requireRole()` guards
  each router (see "Roles y control de acceso"): `Guest` is blocked from all operational
  modules and `SQD` is read-only (read gate vs. write gate). **PM and Buyer remain
  operationally identical** — a deliberate, provisional decision; the finer RASIC matrix
  (field/activity permissions per role, and per-commodity notification targeting) is still
  pending.
- ~~Admin flow to assign `appRole`~~ — **done.** SSD users manage roles via `/api/users`
  (pre-provision by email, patch role, delete). New logins get `Guest`.
- **`daysInStage` is still a frozen seeded counter.** `sla` / `globalSla` no longer
  are (§2.1 — they are derived from anchor dates on every read, and
  `daysSinceParkingLot` is re-persisted with them), but `DaysInStage` itself is
  only ever written by the seed, by `moveSupplierToStage` (resets to 0) and by
  `PATCH /suppliers/:id`. It is therefore stale on any row nobody has edited, and
  the DTO can show a small `daysInStage` next to a red SLA derived from a months-old
  anchor. The blocker — no stage-entry date for Scouting Event / Supplier
  Evaluation / Intelex Handoff — is now **unblocked**: `Supplier.StageEnteredAt`
  is set on create/move/blacklist for all 5 active stages, so `daysInStage`
  could be derived from it uniformly (that derivation itself is not wired yet —
  the column only feeds reporting/display for now). Same applies to
  `T_Supplier_ParkingData.DaysElapsed`, which the UI already ignores in favour of
  computing from the onboarding date.
- ~~Notifications are global and not generated by domain events~~ — **done for domain
  events.** They are now **per-user** and generated by `notifySsdTeam` on supplier create /
  stage move / blacklist / event create (fanned out to the SSD team). The demo set is **no
  longer seeded**. SLA-breach notifications specifically are still not generated (no
  scheduled job exists — see the SLA notes).
- **Seed rows have inconsistent SLA inputs.** The demo data is anchored to dates from
  early 2026 while its `daysInStage` values describe a "today" around April — e.g.
  `SSD-2026-006` says `daysInStage: 28` but has been parked since `2026-03-15`. The
  derived SLA (correctly) reads the anchor and reports red. Completed demo rows also
  carry a `daysSinceParkingLot` with a null `globalSla`. Re-dating the demo data
  relative to the current date would make the seeded board tell a coherent story.
- **Frontend pages not yet on the services** — the services themselves now use
  `fetch` (done), but ~19 page/component files still import `frontend/src/data/*.ts`
  directly and so read from memory instead of the API; their writes never reach the
  database. Exact list in frontend/README.md. The big one is
  `TrackerSupplierDetail.tsx` (3 137 lines), whose blacklist/complete/delete paths
  `splice`/`push` the demo arrays and need to call
  `trackerService.blacklistSupplier` / `moveSupplierToStage` and refetch instead.
- ~~Commodity catalog vs. demo data mismatch~~ — **resolved.** The demo data no
  longer contains bare `'Plastics'` or `'E-Mechanical Components'`; every value in
  `frontend/src/data/*.ts` is a valid entry of the 36-value catalog. Verified by a
  clean `npm run seed` against `MX_MFGIT_SSD_TEST` (it throws
  `Commodity not in catalog` otherwise). Event `topCommodity` values
  (`'Machined Parts'`, `'Electronics'`, `'Stamping'`) still do not match the
  catalog, which is fine — they are free-text display summaries, not FKs.
- Integration tests still run against a mocked Prisma layer (DI), not a real
  database — this was originally because no SQL Server was reachable in the dev
  environment (TCP disabled, no admin rights); that connectivity blocker is now
  resolved (see §1), but the test suite has not yet been switched to run against a
  live test database. Add a test database + `prisma db push` to CI for full
  end-to-end coverage.

## 6. Test summary

`npm test` → **175 passing** (vitest). `tests/integration/users.test.ts` now also asserts
that `PATCH`/`DELETE` on an **SSD** row is a **400** ("managed via the database directly")
even when other SSDs remain — the app can never reassign or delete an SSD user. `tests/unit/textValidation.test.ts` covers the
shared `assertMeaningfulText` rule (empty / short / long / every junk value
case-insensitively / accepts normal text), and the tracker/notes suites were
extended for the mandatory stage-change note and the structured history columns.
`tests/unit/reportsRules.test.ts` covers the Reports module: `createSupplier` writes
exactly one birth history entry with `fromStage` null and `toStage` = initial stage
(the §2.2 foundation); `getStageSnapshot` shows a supplier created before the date in
its initial stage, excludes one created after, takes only the latest stage-bearing
entry per supplier, and honours the `commodityId` filter; `getWeeklyDiff` lists a
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
  read-only **`SQD` gets 200 on GET but 403 on POST** in the operational modules;
  `/api/users` is SSD-only; `/api/home/summary` is 200 for Guest/SQD/SSD
  and its response carries only aggregate keys (no supplier identity).
- `tests/unit/notificationsRules.test.ts` — `notifySsdTeam` writes one row per SSD user and
  none for other roles; `listNotifications`/`markAllNotificationsRead` are scoped to the
  requesting `userId`; cross-user `markNotificationRead` is a 404.
- `tests/integration/users.test.ts` — full `/api/users` CRUD incl. the **last-SSD guard**
  (both PATCH and DELETE), 409 on duplicate, 400 on bad email/role.

Earlier suites (verified 2026-07-16):

- `tests/unit/slaRules.test.ts` (32 tests) — the pure threshold functions at their
  exact boundaries (24/25/29/30 Parking, 49/50/59/60 Preliminary, 74/75/89/90
  global), no colour invented for the three stages without a confirmed limit,
  `daysSince` (floors future dates at 0, null for absent/unparseable like `'TBC'`),
  and `resolveSla` anchor precedence vs. the stored-counter fallback.
- `tests/integration/sla.test.ts` (11 tests) — `FK_Sla`/`FK_GlobalSla` actually
  persisted with the right colour over HTTP: stale green → red at 30 days parked,
  the 25-day boundary, no write when already correct (idempotent reads), stage and
  global colours resolved from different anchors, fallback to the stored
  `daysInStage`, stages without a threshold left alone, blacklisted rows frozen,
  and recalculation on create / patch / stage move.
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

