# SSD Tracker Management — Frontend

React + TypeScript + Vite frontend for the SSD Tracker Management System
(Nexteer Automotive — Global Supply Management team). See the [monorepo
README](../README.md) for the overall project structure and the [backend
README](../backend/README.md) for the API server this app is meant to consume.

## Stack

React 18 + TypeScript, Vite, Tailwind CSS, React Router, Recharts, Font Awesome.

## Running locally

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run build       # production build (dist/)
npm run preview      # preview a production build locally
npm run lint         # eslint
npm run typecheck    # tsc --noEmit -p tsconfig.app.json
```

## Structure

```
src/
├── components/   # shared UI (Sidebar, GlobalHeader, NotesSidePanel, …)
├── pages/        # route-level views, grouped by module (pipeline, events, …)
├── services/     # data-access functions consumed by pages
├── types/        # shared TypeScript interfaces (single source of truth for the domain model)
├── data/         # in-memory demo/mock datasets
├── constants/    # small fixed values (e.g. current user)
├── context/      # React context providers (AuthContext, ToastContext)
├── utils/        # pure helper functions
├── App.tsx, main.tsx, index.css, vite-env.d.ts
```

## Data access — services call the real API

`src/services/*.ts` make **real `fetch` calls** against the backend. All HTTP goes
through [src/services/api.config.ts](src/services/api.config.ts):

- `API_BASE_URL` — `VITE_API_URL`, default `http://localhost:3000/api`.
- `apiGet/apiPost/apiPatch/apiDelete` — JSON in/out.
- **`ApiError`** — every failure is normalised to this. `message` is the
  backend's own `{ error }` sentence (business rules, validation, 404s), so it
  can be shown to a user. `status === 0` means the request never reached the
  server. `isUserFixable` is true for 400/409/422.

Services **throw**; components decide how to surface it. The convention:
`toast.systemError(err.message)` for anything unexpected,
`toast.validationError(...)` when the backend rejected what the user just typed.

The **Bearer token lives in `apiFetch` and nowhere else**. `api.config.ts` keeps a
module-level token store (`setToken`/`setRefreshToken`, driven by `AuthContext`);
`apiFetch` attaches `Authorization: Bearer <token>` when present. On a **401 only**
(never a 403 — that is legitimate RBAC), it makes a single deduplicated
`POST /auth/refresh` attempt and retries the original request once; if the refresh
fails it clears the stored tokens, fires a `ssd:session-expired` window event, and
lets the 401 propagate. `AuthContext` listens for that event and drops the user to
the login screen.

## Authentication & roles

Real login is wired end to end (backend commit `2ddaae5`):

- **`AuthContext`** (`src/context/AuthContext.tsx`) — replaces the old demo
  `RoleContext`. Exposes `{ user, status, login, logout }` where `status` is
  `loading | authenticated | unauthenticated`. It persists three localStorage keys
  (`ssd_token`, `ssd_refresh_token`, `ssd_user`), hydrates the user optimistically
  on mount, then confirms the token with `GET /auth/me` (which does **not** return
  `email`, so the cached email is kept). `user.role` is the real role
  (`SSD | PM | Buyer | SQD | Guest`) — nothing is hardcoded any more.
- **`ProtectedRoute`** (`src/components/ProtectedRoute.tsx`) — `loading` → spinner,
  `unauthenticated` → `/login`, role not in `allow` → `/home`. In `App.tsx` the whole
  authenticated layout is wrapped once (any role), and operational route groups
  (`/tracker`, `/suppliers`, `/events`, `/strategy`, `/visuals`, …) are wrapped with
  `allow={['SSD','PM','Buyer','SQD']}` to block **Guest**; `/users` is
  `allow={['SSD']}`. `/home`, `/settings`, `/profile` are open to any authenticated
  role. `/login` is the only public route and bounces authenticated users to `/home`.
- **`Sidebar`** reads `useAuth()`: real `displayName` + initials, real role label,
  the nav collapses to just **Home** for Guest, **User Management** shows only for
  `SSD`, and **Sign Out** calls `logout()` then navigates to `/login`.
- **Guest home** — `pages/Inicio.tsx` dispatches by role: `Guest` gets
  `pages/HomeGuestView.tsx`, which calls only `GET /home/summary` (aggregated and
  anonymous — no supplier name/folio/company anywhere, no activity feed, no actions).
  Every other role keeps the full dashboard unchanged.
- **User management** — `pages/UserManagement.tsx` is wired to the real
  `usersService` (`GET/POST/PATCH/DELETE /api/users`). Add takes only email + role
  (name is filled from AD on first login); edit shows name/email read-only and edits
  only the role; delete uses `ConfirmDialog`. Backend business errors (e.g. the
  400 "Cannot demote/delete the last SSD user") surface as a toast. The table has a
  free-text **search** (name / email / role, via the shared `SearchBar`), two
  **filter dropdowns** — **Role** and **Supervisor** — and **sortable columns** (Name,
  Role, Supervisor — asc↔desc chevrons, same pattern as `SuppliersList`), plus a
  **Supervisor** column (`supervisorName ?? '—'`, sourced from LDAP on login — see
  backend README). The filter options are **derived from the loaded users** (never a
  fixed list), the Supervisor list drops nulls/blanks (so today it holds only your own
  supervisor and grows as more of the team signs in and their `SupervisorName` fills
  from AD), and search + both filters combine as a logical **AND** over the already
  Guest-free data. **Guests are hidden** (the backend `listUsers` excludes them); when
  you "Add" someone who already logged in as a Guest, the backend **reclaims that row**
  and the toast reads **"User promoted from Guest"** (via `promotedFromGuest` on the
  create response) instead of the usual "User added".
  - The `FilterDropdown` here is a local copy of the one in `SuppliersList` (that one
    isn't exported), same look & feel.
  - **SSD rows are DB-managed.** SSD is the master role and is assigned/removed only
    from the database (mirrors the backend guards). So SSD rows render **"Managed via
    DB"** in place of edit/delete, and **no role picker offers `SSD`** (add *or* edit):
    `ASSIGNABLE_ROLES = APP_ROLES.filter(r => r !== 'SSD')`.

### Read-only SQD — `usePermissions` write gate

**`SQD` is a read-only role** (and `Guest` sees only Home). The backend enforces this at
the route level (`SQD` is 403'd on every mutating verb — see the backend README "Roles y
control de acceso"); the frontend mirrors it structurally so read-only users don't see
write controls the API would reject.

- **`src/hooks/usePermissions.ts`** — `usePermissions()` returns
  `{ canWrite, role }`, where `canWrite` is true only for `SSD | PM | Buyer` (mirrors the
  backend's `OPERATIONAL_WRITE_ROLES`). **This is the single point to expand** when RASIC
  defines per-module/per-activity permissions — call sites already funnel through it.

This first pass gates the **principal page-level write controls** (create / edit / delete /
move / blacklist) — it is intentionally structural, **not** an exhaustive per-button audit.
Covered so far:

| Page | Control gated behind `canWrite` |
|---|---|
| `pages/suppliers/SuppliersList.tsx` | **Add Supplier** button (opens the A/B router modal) |
| `pages/events/EventsList.tsx` | **New Event** button |
| `pages/tracker/MRLList.tsx` | **+ Add requirement** button |
| `pages/strategy/StrategyPage.tsx` (`DrilldownView`) | **Edit** (needs-by-year) button |
| `pages/tracker/TrackerSupplierDetail.tsx` (`SupplierDetailBody`) | the entire write action bar — **Delete supplier**, **Move to / Move stage** (all stages), **Send to Blacklisted** |

Read-only / navigation controls (view detail, filters, search, pagination, Notes panel view,
`SuppliersDetail` which already renders `origin='suppliers'` read-only) are left visible —
SQD can **see** everything. **Not yet gated** (intentionally deferred to the RASIC pass):
per-tab **Save** buttons inside `TrackerSupplierDetail`, MRL row **delete**/inline edit,
Event detail note add/edit, and any secondary write affordances — the backend still 403s
these for SQD/Guest, so they fail safely if reached.

**Known follow-ups (out of scope here):**

- **Token is in `localStorage`, not an httpOnly cookie.** Moving to httpOnly cookies
  is the right hardening but is deferred; `localStorage` is XSS-readable.
- Fine-grained RASIC gating per module/activity — **PM and Buyer are operationally
  identical today** (a deliberate, provisional decision), and the write gate is one global
  boolean. Only Guest-vs-rest and read-only-SQD-vs-writers are enforced.

### `src/data/*.ts` is legacy — no page reads it any more

Every page and component now reads and writes through `src/services/*.ts`; **no
file outside `src/services/` imports `src/data/*.ts`**. The demo datasets survive
only because `prisma/seed.ts` still imports them — and now **only under
`SEED_DEMO=true`**. A plain `backend` `npm run seed` seeds just catalogs + the 21
real GSM-team users via upsert (no deletes), so it is **safe to re-run against
TEST/production** with real suppliers/events already captured. The demo
suppliers/events/strategy (which wipe and reseed those tables) load only when you
run `SEED_DEMO=true npm run seed` for local dev. The `notifications` demo array is
no longer seeded at all — notifications now come from real backend domain events.

`TrackerSupplierDetail.tsx` — the supplier detail screen — writes through the API
too: its tab saves go through a `saveSupplier(supplier, apply)` helper that clones
the record, applies the mutation, and `PATCH`es only the changed fields (a
denylist drops `stage`/`entrySource`/`prelim_hasIMMEX`, which PATCH can't accept);
stage moves, blacklist, complete and promote-to-B2B call the `tracker` endpoints;
notes call the notes endpoints. After each write the screen adopts the fresh
record the API returns (`applyFresh`) instead of re-reading a local array.

### Advancing a stage requires a note

`trackerService.moveSupplierToStage(id, newStage, note)` now takes a **mandatory
`note`** — the backend 400s on an empty/short/junk one (same shared rule as
supplier notes and blacklist reasons; see [backend/README.md](../backend/README.md)).
Every confirmation modal that advances a supplier collects it through the shared
`components/StageNoteField.tsx` (min-length hint fixed at `STAGE_NOTE_MIN = 10` to
match the backend — one line to change if GSM moves the number). Covered modals:
`ParkingLotPrefillModal`, `PreliminaryPrefillModal`, the three
`StageTransitionModal` variants (Preliminary→Supplier Eval, Supplier Eval→Intelex,
Intelex→Completed, where the note field replaces the old always-advance box on the
advance path) and the generic `MoveStageModal` fallback. **Blacklist** keeps its
own `RejectionReasonField` (unchanged) and **Promote to B2B** is a phase change,
not a transition, so it carries no note. The `Move to` confirm button is disabled
(StageTransition modals) or toast-gated (prefill / MoveStageModal, matching those
files' existing "clickable + toast" convention) until the note meets the minimum.

### Intelex Handoff — level sequencing

Intelex Handoff has an explicit sub-status, `intelex_currentLevel`
(`Investigate | L0 | L1 | L2 | L3 | L4 | Completed`), derived and persisted by the
backend (see [backend/README.md](../backend/README.md)). Both the editable
`TabIntelexTimeline` and the read-only `TabROIntelexTimeline` show it as a **"Current
level" badge** at the top of the card, so there's finally a visible indicator of where
the supplier is inside the handoff.

The **Timeline** tab mirrors the backend's sequencing rule structurally: a level's
**"Real"** date input is **disabled + greyed (with a tooltip)** until the previous
level's Real date has a value — Investigate is always open, and **"Expected" inputs stay
enabled** for every level. So you can't even type an out-of-sequence Real; if one somehow
reaches the API, the backend rejects it with a 409. Capturing a Real advances the badge on
the next fetch. `intelex_currentLevel` is on the `PATCH_DENYLIST` (server-derived,
read-only) so the tab-save diff never pushes it.

## Registering a supplier — forms A and B

A supplier can only enter the system through one of the two forms behind the
**Add Supplier** button (`AddSupplierRouterModal`). Step 1 picks the channel;
step 2 is the form. Both write to the database via the API — there is no
in-memory path any more.

| Channel | Form | `entrySource` | Starting stage |
|---|---|---|---|
| **External Registration** | A — 7 sections (last is *Compliance & manufacturing*) | `Scouting Event` | Scouting Event |
| **Internal Recommendation** | B — 5 sections | `Recommendation` | Parking Lot |

Both open with the **Direct/Indirect filter**. SSD only manages Direct product
suppliers; selecting *Indirect* does not leave the step — pressing **Next** with
Indirect selected shows `IndirectExit` (FormShell.tsx), which asks the supplier
to email `contacto.proveedores@nexteer.com` and creates nothing.

The modal has **no Cancel button and no click-outside-to-close** on any step —
the header **✕** is the only way to close it (GSM, 2026-07-17).

Registration is **two requests**: the first creates the supplier core row, the
second (`PATCH /api/suppliers/:id`) routes the extended profile to its satellite
tables. The first request differs by form:

- **Form A (External Registration)** goes through
  `suppliersService.registerSupplierForEvent` → `POST /api/events/:eventId/suppliers`,
  which creates the supplier **and** its `T_Event_SupplierEntry` link atomically,
  so the supplier shows up under the event's "Registered suppliers". An event is
  mandatory for this form; `entrySource`/`scoutingInput` are **not** sent — the
  backend derives both from the event record.
- **Form B (Internal Recommendation)** goes through
  `suppliersService.registerSupplier` → `POST /api/suppliers` (the fixed 17-field
  schema, which sets `entrySource: 'Recommendation'` → Parking Lot). It has no
  event concept.

Questions the schema cannot store are attached as a **supplier note** (see
[backend/README.md §4.1](../backend/README.md) for the field→column mapping).

**"Other" free-text.** Every closed question that offers *Other* reveals a
"please specify" input (`SelectWithOther` / `MultiSelectWithOther` in FormShell);
`resolveOther` / `joinListWithOther` (payload.ts) fold the typed text into the
value as `Other: <text>`. **Amount + unit** questions (press capacity → tonnes,
annual revenue → currency) use `QtyUnit` and are joined into their single column
(e.g. `500 T`, `120000000 USD`).

### Catalogs

- [src/constants/catalogs.ts](src/constants/catalogs.ts) — **confirmed** catalogs
  (`COMMODITIES` and the C_* tables) plus form option lists GSM has confirmed,
  including `CONTACT_CHANNELS` (Q7) and `EMPLOYEE_RANGES` (Q25).
- [src/constants/catalogs-pending-gsm.ts](src/constants/catalogs-pending-gsm.ts) —
  ⚠ **placeholders** still awaiting GSM. Do not merge them into `catalogs.ts`;
  move each one over as GSM confirms it, as was done for Q7/Q25.

### Stage colours

[src/constants/stage-config.ts](src/constants/stage-config.ts) holds stage
colours/icons as a synchronous constant — `getStageColor()` is called inline all
over the render tree, so a colour must not await a round-trip. The API serves the
same colours for the 5 working stages; Blacklisted and Completed are exits from
the board rather than columns on it, so only this file describes them.

## SLA colours come from the backend

`supplier.sla` and `supplier.globalSla` are **derived and persisted by the backend**
(thresholds and mechanism: [backend/README.md §2.1](../backend/README.md)). The
frontend must never re-derive a colour from a day count — it only maps the state
name to a hex through `slaColors` / `slaLabels` in
[src/utils/tracker-helpers.ts](src/utils/tracker-helpers.ts), which is also where
`slaBarScaleDays` lives (a display-only denominator for the progress bars).

⚠️ **While the services are still mocks, the rendered colour is only as fresh as
`src/data/pipeline-demo.ts`.** The demo rows carry hand-written `sla` values that no
longer match their own dates, so the detail page can show a live day count next to a
stale state — e.g. `ps6` renders "123 days · At risk" because the demo says
`sla: 'yellow'`, while the backend returns `red` for that same supplier. This
resolves itself when the services are switched to `fetch`; it is not a bug in the
rendering.

## Search & filters — one shared bar, standardized per module

`components/SearchBar.tsx` is the **canonical** free-text search input (extracted from
`SuppliersList`): magnifier at left 12, 36px left padding, `#E0E0E0` border, radius 6,
13px, plus an **× clear** button that appears once there is text. Every list module now
uses it instead of a hand-rolled `<input>`. All filtering is **client-side over already
loaded data** (no extra requests); filter option lists (commodity, SLA…) are derived from
the loaded rows.

**Empty state distinguishes "no data" from "no matches"** (`SuppliersList.tsx`,
`ListView`): when search and every filter dropdown are inactive and the list is still
empty, the system genuinely has zero suppliers, so it shows a plain **"No suppliers
yet."** with no icon and no "Clear filters" button (same text style as the other
list-module empty states, e.g. `UserManagement`'s "No users yet."). Only when a
filter/search *is* active and yields zero rows does it show the fuller "No suppliers
found — Try different filters or search terms" panel with the **Clear filters** button.
The parent computes `hasActiveFilters` (`activeFilterCount > 0 || !!search`) and passes
it down as a prop rather than `ListView` re-deriving it.

| Module | Search fields | Filters |
|---|---|---|
| `pages/tracker/TrackerStage` | name, folio, commodity, buyer, country | commodity, **SLA status** (green/yellow/red, from `supplier.sla`), days-in-stage |
| `pages/suppliers/SuppliersList` | name, folio, commodity, productType, buyer, country | stage, **commodity** (new), country, buyer |
| `pages/events/EventsList` | name, location, organizer, topCommodity, topCountry | status (dropdown, unchanged), **commodity** (topCommodity) |
| `pages/tracker/TrackerBlacklisted` | name, folio, commodity, buyer | commodity, buyer |
| `pages/tracker/TrackerCompleted` | name, folio, commodity, buyer | commodity, buyer |
| `pages/tracker/MRLList` | partNumber, partDescription, buyerName, commodity | **commodity** (via shared `CatalogSelect`, options derived from loaded rows) |
| `pages/UserManagement` | name, email, role | **Role** and **Supervisor** (both derived from the loaded users; sortable columns too) |

## Real dates on Home & Visuals

`utils/date-helpers.ts` → **`relativeLabel(dateStr)`** is the frontend twin of the
backend notification helper (own English wording: Today / Yesterday / N days ago / `DD
MMM`, and **`Recently`** when the date is missing/unparseable — it never invents one).
`pages/Inicio.tsx` uses it for the Recent Activity feed, driven by each object's real
server date (`stageEnteredAt` for tracker rows, `completedDate`, `rejectionDate`); the
header date is now `new Date()` (was hardcoded). `pages/Dashboard.tsx` builds
`monthlyData` by grouping suppliers by `onboardingDate` month over the **last 6 real
months** (was 5 hardcoded values). `ManagedUser` gains `supervisorName: string | null`.

## Reports module

`pages/Reports.tsx` (route `/reports`, nav entry between **Strategy** and
**Visuals**) is the weekly pipeline report GSM asked for: how many suppliers were in
each stage a week ago vs now, per commodity, plus the movements and notes that
explain the change. It is **read-only** (no write controls; SQD can view it, so it is
mounted under the same `OPERATIONAL` gate as the other modules), and it has **no
charts** — visualizations live in the Visuals module, not here.

- **`services/reportsService.ts`** — `getWeeklyReport(from, to, commodityId?)`,
  `getLatestWeeklyReport(commodityId?)` and `getReportCommodities()`, with types
  mirroring [backend/README.md §2.2](../backend/README.md) exactly. `StageSnapshotRow`
  now carries **`levelCounts`** (the Intelex Handoff L0…L4 breakdown, `null` for other
  stages) — the type is kept in sync with the wire; the comparison table still reads
  `count` (the stage total), so surfacing the level breakdown in the Reports UI is a
  small follow-up.
- **Date range** — two native `<input type="date">` pickers (the repo's established
  date-input pattern — used by `NewEventModal` and the prefill modals; **react-day-picker
  is not a dependency of this project**) plus a **Last 7 days** button that calls
  `getLatestWeeklyReport()`. `from > to` is rejected client-side (toast) and by the
  backend (400).
- **Commodity filter** — the shared **`components/CatalogSelect`** (not a new
  dropdown), fed by `GET /api/reports/commodities`. The backend filter is by
  `commodityId`, so the page keeps the `{id,name}` list to translate the selected
  name → id (the rest of the app works in commodity *names*, which is why this small
  catalog endpoint exists).
- **Sections** — a per-commodity/per-stage comparison table (zebra rows, `#F7F7F7`
  header, commodity group rows, a coloured Δ column), a movements list (supplier,
  commodity, `From → To` stage badges, date, author, and the **full untruncated**
  note), and a notes list (supplier, commodity, stage, text, author, and a
  human-readable `createdAt` like *"21 Jul, 2:45 PM"*). Each section has its own
  empty state; a spinner covers the initial/loading fetch.
