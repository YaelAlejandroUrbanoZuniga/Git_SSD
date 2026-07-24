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
notifications — ver §3) implementada y cubierta por 218 tests.

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
npm test                      # 218 tests: unit (business rules) + integration (HTTP)
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
├── prisma/schema.prisma   # 36 tables in 7 domains (see below)
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
│   └── config/            # env + shared Prisma client
├── sql/                   # production migration/data-fix scripts (see below)
├── data-import/           # one-off Excel → JSON parser for the real GSM data (§7)
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
`sql/2026-07-23_revert_citlaly_to_guest.sql`).

**Table domains** (spec said ~17–19; this landed at 35 because notes, junction,
child and catalog tables are modeled explicitly):

1. **Catálogos** — `Commodity` (36-value controlled lookup + a 37th `TBD -- Pending GSM` placeholder) + the naming-compliance
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
  2026-07-17) **or** the 37th placeholder `TBD -- Pending GSM`. The placeholder is
  auto-assigned to suppliers whose commodity GSM has not defined yet (those still in
  Scouting Event, and those imported from Excel with an aggregated commodity value);
  it is temporary and replaced when GSM confirms the real value — the Parking Lot
  prefill forces a real commodity before a supplier can leave Scouting Event.
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

`npm test` → **218 passing** (vitest). `tests/integration/users.test.ts` now also asserts
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
```

- **`data-import/source/`** — the 5 `.xlsx` (`Master_Requirements_List…`,
  `Scouting_Event_-_B2B_Meetings`, `Supplier_Parking`, `Preliminary_Evaluation…`,
  `BlackList_Suppliers`). **Gitignored** — real, confidential company data.
- **`data-import/output/`** — generated `suppliers.json`, `events.json`, `mrl.json`,
  `import-report.md`, `import-log.md`, `import-rest-log.md`. Also **gitignored** (derived).
- **`parse.ts`** (parser entry) · **`import-suppliers.ts`** + **`import-rest.ts`** (importer
  entries) · **`mappings.ts`** (lookup tables) · **`normalize.ts`** (pure, unit-tested
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
and are reported (never invented as users). The Plan-IMMEX sentence is normalized to
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
  prints a warning and exits without touching the DB.
- **Folios:** each imported supplier gets `XL-SSD-<year>-NNNN` (`padStart(4)`), and id
  `xl-<uuid>`. The **`XL-` prefix** marks Excel-migrated rows and keeps them out of the
  native `SSD-<year>-NNNN` sequence — `suppliersService.nextFolio()` explicitly excludes
  `XL-` folios so imported numbers never consume the native range.
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

**Verification** (printed + logged): `getStageSnapshot()` at **2026-03-01, 2026-05-01 and
today** must show a coherent progression — fewer, earlier-stage suppliers the older the date.
Against the local SQL Server it produced **44 → 178 → 445** (e.g. 2026-03-01 concentrated in
Parking Lot, today spread across all five active stages incl. 2 in Intelex Handoff), and a
re-run changed nothing (7 events reused, 420 entries upserted, 0 meetings/MRL/backfill added).

