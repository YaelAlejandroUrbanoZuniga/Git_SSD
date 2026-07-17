# SSD Tracker Management — Backend

Node.js + Express + TypeScript + Prisma + SQL Server backend for the SSD Tracker
Management frontend (React/Vite app in the sibling `frontend/` folder). The API mirrors
the contract implied by `frontend/src/services/*.ts` and `frontend/src/types/index.ts`,
and the seed reproduces `frontend/src/data/*.ts` so the frontend looks identical when
pointed at the API (`http://localhost:3000/api`, matching
`frontend/src/services/api.config.ts`).

### Estado de integración (2026-07-16)

**Backend: verificado y funcional.** Conexión real a SQL Server
(`MX_MFGIT_SSD_TEST`), `prisma db push` → *already in sync*, `npm run seed` →
`[seed] done ✔`, y la API completa (auth, tracker, suppliers, events, strategy,
notifications — ver §3) implementada y cubierta por 99 tests.

**Capa de servicios del frontend: MIGRADA.** Los 6 servicios
(`suppliersService`, `trackerService`, `eventsService`, `mrlService`,
`notificationsService`, `strategyService`) ya hacen `fetch` real contra la API a
través de `apiFetch` en `frontend/src/services/api.config.ts`, que normaliza todo
error a `ApiError` (ver frontend/README.md).

**Formularios A/B: conectados a la base real.** El alta de proveedores solo
ocurre por los dos formularios detrás de *Add Supplier*, y escribe vía
`POST /api/suppliers` + `PATCH /api/suppliers/:id` (ver §6). Verificado
end-to-end contra `MX_MFGIT_SSD_TEST`: form A → `Scouting Event`, form B →
`Parking Lot`, movimiento por etapas hasta `Completed` y `blacklist` persisten.

**Páginas del frontend: PARCIALMENTE migradas.** `TrackerStage`,
`TrackerStepperView`, `SuppliersList` y `StrategyPage` (entries) ya leen de los
servicios. El resto sigue importando `frontend/src/data/*.ts` directamente — la
lista exacta está en frontend/README.md. Consecuencia: esas páginas muestran los
mismos datos (porque el seed reproduce los demos) pero **desde memoria**, y sus
escrituras no llegan a la base. `TrackerSupplierDetail.tsx` (3 137 líneas, con
`splice`/`push` sobre los arrays demo) es el trabajo grande que queda.

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
npm run seed                  # load the demo dataset from ../frontend/src/data/*.ts
npm run dev                   # start on http://localhost:3000/api
```

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
| `LDAP_API_URL`, `LDAP_API_KEY` | FastAPI/LDAP service (only for `AUTH_MODE=ldap`) |
| `AUTH_OPTIONAL` | `true` → requests without JWT run as the demo user (Yael Urbano / SSD) so the un-migrated frontend keeps working; `false` → strict Bearer auth everywhere |

Mock-mode users (`AUTH_MODE=mock`, password `password`): `yael.urbano`,
`carlos.mendoza`, `ana.garcia`, `roberto.sanchez`.

---

## 2. Architecture

```
backend/
├── prisma/schema.prisma   # 35 tables in 7 domains (see below)
├── prisma/seed.ts         # imports ../../frontend/src/data/*.ts directly and decomposes it
├── src/
│   ├── server.ts / app.ts # app factory with full dependency injection
│   ├── routes/            # one file per module
│   ├── controllers/       # HTTP ↔ service translation (zod validation)
│   ├── services/          # pure business logic (testable without HTTP)
│   ├── mappers/           # relational rows ↔ flat PipelineSupplier wire shape
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

- **Blacklist requires a non-empty reason** — 400 otherwise; writes `BlacklistEntry` + history.
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
  split into individual subdivision entries, e.g. `Controllers -- CCA`).
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

### Auth flow

```
React → POST /api/auth/login → Node → LdapAuthClient → FastAPI/LDAP3 (external)
```

- Node validates credentials through the `LdapAuthClient` abstraction
  (`HttpLdapAuthClient` for the real service, `MockLdapAuthClient` for `AUTH_MODE=mock`).
- The **password is discarded immediately** after validation — never stored or logged.
- The user is **upserted** locally (matched by `adObjectId`, falling back to username);
  `appRole` (`SSD|PM|Buyer|SQD`) is a **custom column on `users`**, not derived from AD.
  New users default to `Buyer`.
- Node issues its **own JWT** (claims: `sub`, `username`, `displayName`, `role`) plus a
  rotating refresh token (stored as SHA-256 hash, revoked on rotation/logout).

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
| | `GET /api/tracker/suppliers/:id` | flat `PipelineSupplier` detail |
| | `POST /api/tracker/suppliers/:id/move` | `{newStage}` — validated transition |
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
| Strategy | `GET /api/strategy/entries` / `PATCH /api/strategy/entries/:id` | inline needs edit |
| | `GET /api/strategy/overview` | `CommodityStrategyRow[]` (same algorithm as `StrategyPage.tsx`) |
| | `GET /api/strategy/commodity/:commodity` | drilldown row + its suppliers |
| | `GET/POST/PATCH/DELETE /api/strategy/mrl[/:id]` | MRL CRUD / inline edit |
| Notifications | `GET /api/notifications` | `time` label computed from `createdAt` ('hace 1h') |
| | `PATCH /api/notifications/:id/read` / `POST /api/notifications/read-all` | |

**Implemented vs pending:** every endpoint above is implemented and covered by
typecheck; tracker + auth are covered by integration tests. Not implemented:
role-restricted endpoints (no permission matrix specified), file upload for
`PipelineDocument.link`, per-user notifications (the model is global, like the demo).

---

## 4. Design decisions where the contract was ambiguous

1. **Commodity catalog replaced with the official 36-value Nexteer list**
   (confirmed by the business team) — it no longer mirrors the frontend
   `Commodity` union in `frontend/src/types/index.ts` verbatim. `Controllers` and
   `E-Mechanical Components` are split into individual subdivision entries
   (`Controllers -- CCA`, `E-Mechanical Components -- PCB`, …), and the plural
   `'Plastics'` is gone in favor of the official singular `'Plastic'`.
   The frontend demo data has since been reconciled to these values (see
   "Pending TODOs"). Event `topCommodity` values (`'Machined Parts'`,
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
| A (Q7) | ¿Desde dónde nos contactas? (planta/región Nexteer) | No existe columna |
| A (Q14) | Sector de negocio | Duplicado de Q30 "Enfoque de mercado" → `prelim_market` |
| A (Q15) | ¿Es tu primer contacto con Nexteer? | No existe columna |
| B (Q11-12) | Nombre / Email — Contacto 2 | El esquema guarda **un solo** par de contacto |

### Campos que SÍ se guardan pero con pérdida

| Campo | Pérdida |
|---|---|
| A (Q25) Número de empleados | El documento pide **rangos**; `CommercialInfo.Employees` es `Int`. Solo se guarda la cota inferior — la etiqueta del rango no se persiste. |
| A (Q26) Ingresos anuales por región | El documento pide **filas repetibles** (Región+Monto+Moneda); la columna es `NVarChar(50)`. Se captura como texto libre corto. |
| A (Q27) Volumen de producción por región | Igual: filas repetibles → `NVarChar(100)`. |
| A (Q32) Capacidad de exportación | `exportCapability` es **booleano en el contrato** (el mapper lee `=== 'true'`), así que el detalle (% local + países) solo sobrevive en `prelim_exportCapability` (texto). |
| A (Q33/Q37/Q39) Certificaciones / Operaciones / Materiales | Multi-select → una sola cadena separada por comas. |

> ⚠ `prelim_hasIMMEX` **no** es una columna (el modelo usa `immexStatusId`);
> mandarlo por PATCH devuelve 500. IMMEX se manda como `hasIMMEX`/`planIMMEX`,
> que el servicio colapsa en el FK.

## 5. Pending TODOs

- **FastAPI/LDAP service — 3 known security issues (NOT fixed here, by scope):**
  1. LDAP traffic on **port 389 unencrypted** (no LDAPS/StartTLS).
  2. **`API_KEY` hardcoded** in the service's `config.py`.
  3. **`requirements.txt` empty** — dependencies unpinned, builds not reproducible.
  (Also marked as `TODO(security)` in `src/auth/ldapClient.ts`.)
- Role → permission matrix undefined; `requireRole()` middleware exists but is not
  applied anywhere restrictive yet.
- Admin flow to assign `appRole` to users (today: seed or manual SQL; new logins get `Buyer`).
- **`daysInStage` is still a frozen seeded counter.** `sla` / `globalSla` no longer
  are (§2.1 — they are derived from anchor dates on every read, and
  `daysSinceParkingLot` is re-persisted with them), but `DaysInStage` itself is
  only ever written by the seed, by `moveSupplierToStage` (resets to 0) and by
  `PATCH /suppliers/:id`. It is therefore stale on any row nobody has edited, and
  the DTO can show a small `daysInStage` next to a red SLA derived from a months-old
  anchor. Deriving it the same way is blocked on there being no stage-entry date for
  Scouting Event / Supplier Evaluation / Intelex Handoff — adding one (a
  `StageEnteredDate` column set on every move) would let `daysInStage` be derived
  uniformly and would remove the last frozen counter. Same applies to
  `T_Supplier_ParkingData.DaysElapsed`, which the UI already ignores in favour of
  computing from the onboarding date.
- Notifications are global and not generated by domain events yet (SLA breaches, stage
  moves); the demo set is seeded.
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

`npm test` → **99 passing** (vitest, verified 2026-07-16):

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
- `tests/unit/trackerRules.test.ts` (26 tests) — stage transitions (unknown stage,
  blacklisted / completed immovable, backward moves rejected, Completed only from
  Intelex Handoff, satellite creation), blacklist reason mandatory, double-blacklist,
  No Go auto-blacklist (reason validated before any write), Go doesn't blacklist,
  delete only in Scouting Event.
- `tests/unit/notesRules.test.ts` (6 tests) — stage tagging, empty text, author-only
  edit/delete, cross-supplier note 404.
- `tests/integration/auth.test.ts` (12 tests) — login success (upsert + hashed refresh
  token), existing-user update, wrong password 401, unknown user 401, missing field
  400, `/me` with valid/invalid token, refresh rotation/expiry, logout idempotency.
- `tests/integration/tracker.test.ts` (12 tests) — stage-config, flat DTO contract
  over HTTP, move/blacklist/substatus validation codes (400/404/409), strict-auth 401,
  demo-user attribution with `AUTH_OPTIONAL=true`.

