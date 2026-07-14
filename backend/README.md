# SSD Tracker Management — Backend

Node.js + Express + TypeScript + Prisma + SQL Server backend for the SSD Tracker
Management frontend (React/Vite app in the sibling `frontend/` folder). The API mirrors
the contract implied by `frontend/src/services/*.ts` and `frontend/src/types/index.ts`,
and the seed reproduces `frontend/src/data/*.ts` so the frontend looks identical when
pointed at the API (`http://localhost:3000/api`, matching
`frontend/src/services/api.config.ts`).

---

## 1. Running locally

### Prerequisites

- Node.js ≥ 20 (developed on v24)
- A reachable **SQL Server** instance over **TCP** (Express edition is fine)

> **⚠ SQL Server Express ships with TCP/IP disabled.** On this machine
> (`MSSQL$SQLEXPRESS`, instance `MSSQL17.SQLEXPRESS`) TCP was disabled and the session
> had no admin rights, so it could not be enabled automatically. To enable it (needs
> admin): *SQL Server Configuration Manager → SQL Server Network Configuration →
> Protocols for SQLEXPRESS → TCP/IP → Enabled = Yes*, set a static port (1433) under
> *IP Addresses → IPAll → TCP Port*, then restart the `MSSQL$SQLEXPRESS` service.
> Alternatively point `DATABASE_URL` at any corporate SQL Server.

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
npm test                      # 49 tests: unit (business rules) + integration (HTTP)
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
├── prisma/schema.prisma   # 26 tables in 6 domains (see below)
├── prisma/seed.ts         # imports ../../frontend/src/data/*.ts directly and decomposes it
├── src/
│   ├── server.ts / app.ts # app factory with full dependency injection
│   ├── routes/            # one file per module
│   ├── controllers/       # HTTP ↔ service translation (zod validation)
│   ├── services/          # pure business logic (testable without HTTP)
│   ├── mappers/           # relational rows ↔ flat PipelineSupplier wire shape
│   ├── middleware/        # JWT auth, role guard, error handling
│   ├── auth/ldapClient.ts # LdapAuthClient interface + HTTP + mock impls
│   ├── domain/            # controlled vocabularies + typed errors
│   └── config/            # env + shared Prisma client
└── tests/                 # vitest + supertest (Prisma mocked via DI)
```

**Table domains** (spec said ~17–19; this landed at 26 because notes, junction and
child tables are modeled explicitly):

1. **Supplier core** — `Supplier`, `CompanyInfo`, `TechnicalInfo`, `CommercialInfo`,
   `SupplierDocument`, `SupplierNote`, `SupplierHistoryEntry`, `SupplierPart`, `PrelimPart`
2. **Stage satellites (1:1)** — `ScoutingData`, `ParkingData`, `PreliminaryData`,
   `SupplierEvalData`, `IntelexData`
3. **Exit branches** — `BlacklistEntry`, `CompletionEntry`
4. **Events** — `Event`, `EventSupplierEntry` (N:M junction), `EventB2BMeeting`, `EventNote`
5. **Strategy/MRL** — `Commodity` (controlled lookup), `StrategyEntry`, `MrlRequirement`
6. **System** — `User` (with `adObjectId` + custom `appRole`), `RefreshToken`, `Notification`

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
   **Consequence:** the frontend demo data (`frontend/src/data/*.ts`) still uses the
   old bare values (`'Plastics'`, `'E-Mechanical Components'`) for some
   suppliers — `prisma/seed.ts` will throw `Commodity not in catalog` for
   those rows until either the demo data or the catalog is reconciled (see
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

## 5. Pending TODOs

- **FastAPI/LDAP service — 3 known security issues (NOT fixed here, by scope):**
  1. LDAP traffic on **port 389 unencrypted** (no LDAPS/StartTLS).
  2. **`API_KEY` hardcoded** in the service's `config.py`.
  3. **`requirements.txt` empty** — dependencies unpinned, builds not reproducible.
  (Also marked as `TODO(security)` in `src/auth/ldapClient.ts`.)
- Role → permission matrix undefined; `requireRole()` middleware exists but is not
  applied anywhere restrictive yet.
- Admin flow to assign `appRole` to users (today: seed or manual SQL; new logins get `Buyer`).
- `daysInStage` / `daysSinceParkingLot` / `sla` are seeded values; a scheduled job
  should recompute them daily from stage-entry dates.
- Notifications are global and not generated by domain events yet (SLA breaches, stage
  moves); the demo set is seeded.
- Frontend `frontend/src/services/*.ts` still return mock data — migrating them to `fetch` was
  the optional final step and was **not** done (frontend untouched).
- **Commodity catalog vs. demo data mismatch** — the frontend demo suppliers using
  bare `'Plastics'` or `'E-Mechanical Components'` (without a subdivision) no longer
  match any entry in the official 36-value catalog. Reconcile before running
  `npm run seed` against a live database: either update those demo rows to a valid
  subdivision (e.g. `'E-Mechanical Components -- PCB'`, `'Plastic'`) or add
  transitional aliases — do not silently drop the affected suppliers from the seed.
- Integration tests run against a mocked Prisma layer (no SQL Server was reachable in
  the dev environment — TCP disabled, no admin rights). Once a DB is available, add a
  test database + `prisma db push` to CI for full end-to-end coverage, and run
  `npm run seed` to verify the seed end-to-end.

## 6. Test summary

`npm test` → **50 passing** (vitest):

- `tests/unit/trackerRules.test.ts` — stage transitions (unknown stage, blacklisted /
  completed immovable, backward moves rejected, Completed only from Intelex Handoff,
  satellite creation), blacklist reason mandatory, double-blacklist, No Go
  auto-blacklist (reason validated before any write), Go doesn't blacklist, delete only
  in Scouting Event.
- `tests/unit/notesRules.test.ts` — stage tagging, empty text, author-only edit/delete,
  cross-supplier note 404.
- `tests/integration/auth.test.ts` — login success (upsert + hashed refresh token),
  existing-user update, wrong password 401, unknown user 401, missing field 400,
  `/me` with valid/invalid token, refresh rotation/expiry, logout idempotency.
- `tests/integration/tracker.test.ts` — stage-config, flat DTO contract over HTTP,
  move/blacklist/substatus validation codes (400/404/409), strict-auth 401, demo-user
  attribution with `AUTH_OPTIONAL=true`.

