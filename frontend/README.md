# SSD Tracker Management — Frontend

React + TypeScript + Vite frontend for the SSD Tracker Management System
(Nexteer Automotive — Global Supply Management team). See the [monorepo
README](../README.md) for the overall project structure and the [backend
README](../backend/README.md) for the API server this app is meant to consume.

## Stack

React 18 + TypeScript, Vite, Tailwind CSS, React Router, Chart.js (via
`react-chartjs-2`), Font Awesome.

## Running locally

Dependencies are installed once from the repo root (`npm ci` — this project is
an npm workspace with a single root `package-lock.json`; do not run
`npm install`/`npm ci` inside `frontend/`). Then:

```bash
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
├── components/   # shared UI (Sidebar, GlobalHeader, NotesSidePanel, SearchBar, LoadingState, …)
├── pages/        # route-level views, grouped by module (pipeline, events, …)
├── services/     # data-access functions consumed by pages
├── types/        # shared TypeScript interfaces (single source of truth for the domain model)
├── constants/    # small fixed values (e.g. design tokens, stage config, catalogs)
├── context/      # React context providers (AuthContext, ToastContext)
├── utils/        # pure helper functions
├── App.tsx, main.tsx, index.css, vite-env.d.ts
```

## Data access — services call the real API

`src/services/*.ts` make **real `fetch` calls** against the backend. All HTTP goes
through [src/services/api.config.ts](src/services/api.config.ts):

- `API_BASE_URL` — `VITE_API_URL`. In **development** it falls back to
  `http://localhost:3000/api`. In a **production** bundle there is no fallback:
  if `VITE_API_URL` is absent or empty, `api.config.ts` throws while the module
  loads and the app refuses to start, naming the missing variable. Vite inlines
  `import.meta.env.*` at build time, so a bundle built without it can never
  recover the value — it used to quietly point every user's browser at their own
  machine and turn every screen into "Could not reach the server". Note the
  check fires when the bundle **loads**, not during `vite build`, which still
  exits 0. Same-origin deployments must now write `VITE_API_URL=/api`
  explicitly; the old empty-string spelling is rejected. See
  [.env.example](.env.example).
- `apiGet/apiPost/apiPatch/apiDelete` — JSON in/out.
- **`ApiError`** — every failure is normalised to this. `message` is the
  backend's own `{ error }` sentence (business rules, validation, 404s), so it
  can be shown to a user. `status === 0` means the request never reached the
  server. `isUserFixable` is true for **400/403/409/422**; `isPermissionDenied`
  narrows that to 403. **`requestId`** carries the backend correlation code,
  sent on **500s only** (see below).

Services **throw**; components decide how to surface it. The convention, in the
order call sites must test it:

```ts
if (err instanceof ApiError && err.isPermissionDenied) toast.permissionError();
else if (err instanceof ApiError && err.isUserFixable) toast.validationError(title, err.message);
else toast.systemError(err instanceof ApiError ? err.message : fallback);
```

**Why 403 comes first, and why it is `isUserFixable` at all.** 403 was originally
excluded, so every permission rejection in the app fell through to
`toast.systemError` — telling a read-only user *"Technical problem — not your
data. Nothing was changed. Please try again in a moment."* That is wrong twice:
the system did exactly what it meant to, and retrying will fail identically
forever. It is `isUserFixable` because the failure is a refusal, not a fault; it
is tested first because the backend's own 403 sentence is `Requires role: SSD`,
which means nothing to a user, so `toast.permissionError()` supplies its own copy
(*"You do not have permission for this — your role can view this information but
not change it…"*) and does not surface `err.message`. `TabProspects` handles 403
separately, checking `err.status === 403` directly, because there the right
response is to re-sync the row rather than to explain a gate.

### 500s carry a reference code

The backend stamps every request with a short `requestId`, prints it on its `[req]`
log line, stores it on the audit row and returns it in the body of a **500 only**
(the 400/401/403/404/409 shapes are unchanged — see
[backend/README.md §2.3](../backend/README.md)). `apiFetch` reads it into
`ApiError.requestId` **and folds it into the message**:

```
Internal server error. Reference: a1b2c3d4
```

so the red *"Technical problem — not your data"* toast shows it in all 50+ existing
`toast.systemError(err.message)` call sites **without touching any of them**, and
`ToastContext` keeps its styling logic untouched. A tester who reports that code
pins down the exact request in the server log and in `T_Audit_Log`.

The **Bearer token lives in `apiFetch` and nowhere else**. `api.config.ts` keeps a
module-level token store (`setToken`/`setRefreshToken`, driven by `AuthContext`);
`apiFetch` attaches `Authorization: Bearer <token>` when present. On a **401 only**
(never a 403 — that is legitimate RBAC), it makes a single deduplicated
`POST /auth/refresh` attempt and retries the original request once; if the refresh
fails it clears the stored tokens, fires a `ssd:session-expired` window event, and
lets the 401 propagate. `AuthContext` listens for that event and drops the user to
the login screen.

### Nothing renders a blank screen — `ErrorBoundary`, chunk failures and 404

Three separate failures used to end in an empty page with no message, no toast and
no way back. Each now has an explicit surface:

- **A render-time exception in any page.** `components/ErrorBoundary.tsx` is
  mounted **twice** in `App.tsx`, on purpose. The **outer** one wraps
  `<BrowserRouter>` and backstops the shell itself (header, sidebar, `Login`).
  The **inner** one sits inside `AppRoutes`' `key={location.pathname}` div, so it
  remounts — and therefore resets — on every navigation; it catches a page crash
  while leaving the header and sidebar usable, which is what lets the user
  navigate away instead of only reloading. It offers **Reload the application**
  and, for a plain render error, **Try again**, and prints the stack to the
  console. That `console.error` is the **one deliberate console call in `src/`**
  and only fires on an actual unhandled error.

- **A lazy chunk that fails to download.** The realistic case is a user who kept
  the tab open across a redeploy: their cached `index.html` names hashed chunks
  that no longer exist on the server. `App.tsx` wraps every `lazy()` in a
  `lazyPage()` helper whose `.catch` rethrows a named `ChunkLoadError` with a
  readable sentence, which the boundary recognises (`isChunkLoadError`) and
  answers with reload-only copy — reloading genuinely *is* the fix, since it
  refetches `index.html` and the current chunk names.

- **An unknown URL.** `AppRoutes` ends with `<Route path="*" element={<NotFound />} />`
  (`pages/NotFound.tsx`), so a stale bookmark or a notification `link` pointing at
  a retired route gets an explicit 404 with a **Go to Home** action and the offending
  path echoed, instead of the header and sidebar wrapped around an empty `<main>`.

`/settings` and its legacy `/configuracion` alias are **intentionally unrouted** and
absent from the sidebar user menu — `pages/Settings.tsx` still exists but its whole
content is "There are no configurable preferences yet", so it was the first thing a new
user found under a menu promising settings. Both paths now fall through to the 404.
Restore the route and the menu entry together when the page has real content.

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
- **Code splitting** — every routed page except `Login` is loaded via
  `React.lazy()` in `App.tsx` and rendered inside a single `<Suspense>`
  around `<Routes>`, with `DelayedSuspenseFallback` as the fallback (also in
  `App.tsx`). Only the login screen, the app shell (`GlobalHeader`, `Sidebar`,
  `ProtectedRoute`/`Gate`) and `LoadingState` itself are statically imported,
  so the login bundle doesn't pull in the charting library (`Dashboard`) or
  the ~3,000-line `TrackerSupplierDetail`. `npm run build` emits one `.js`
  chunk per lazy page under `dist/assets/`.
  - `DelayedSuspenseFallback` renders nothing for `SUSPENSE_FALLBACK_DELAY_MS`
    (200ms) after mounting, then shows `<LoadingState fill />`. Since each
    module already renders its own `entity`/`icon`-specific `LoadingState`
    while it waits on its first data fetch, the common case (chunk already
    cached by the browser, resolving in well under 200ms) never shows the
    generic "Loading elements…" fallback at all — only the module's own
    loading state appears. A genuinely slow chunk download (cold cache, slow
    network) still shows the generic fallback after the threshold, so the
    user is never left without feedback.
  - **`xlsx` is dynamically imported, not statically bundled.** Both
    `utils/parseProspectWorkbook.ts` and `utils/prospectTemplate.ts` load it via
    `await import('xlsx')` inside the function that actually needs it
    (`parseProspectWorkbook`, `downloadProspectTemplate`), not at module scope.
    `EventDetail` → `TabProspects` → `ProspectImportModal` still statically
    imports both utility modules, but since neither imports `xlsx` at the top
    level, Rollup gives the library its own `xlsx-*.js` chunk (~430 kB), fetched
    only when a user actually opens the import modal or downloads the template —
    a path only the SSD role reaches (`TabProspects.tsx`). Every other event
    visitor's `EventDetail` chunk dropped from 461 kB to ~36 kB as a result.
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
  Role, Supervisor — via the shared `useTableSort` hook, see below), plus a
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

### Read-only PM/Buyer/SQD — `usePermissions` write gate

**`PM`, `Buyer` and `SQD` are read-only roles** (and `Guest` sees only Home). The backend
enforces this at the route level (`OPERATIONAL_WRITE_ROLES` now blocks all three on every
mutating verb — see the backend README "Roles y control de acceso") except two named
writes each keeps: adding a note, and marking prospect interest. The frontend mirrors the
coarse gate structurally so read-only users don't see write controls the API would reject.

- **`src/hooks/usePermissions.ts`** — `usePermissions()` returns
  `{ canWrite, role }`, where `canWrite` is true only for `SSD` (mirrors the backend's
  `OPERATIONAL_WRITE_ROLES`). **This is the single point to expand** if per-module/per-activity
  permissions are ever needed — call sites already funnel through it. The two named
  exceptions (notes, prospect interest) are **not** routed through this hook — the notes UI
  (`NotesSidePanel.tsx`) always shows its add/edit/delete controls (the backend's
  `NOTE_WRITE_ROLES` already allows every non-Guest role), and prospect-interest controls,
  once built, must check role directly rather than `canWrite`.

Every page-level write control (create / edit / delete / move / blacklist / save) is now
gated. Covered:

| Page | Control gated behind `canWrite` |
|---|---|
| `pages/suppliers/SuppliersList.tsx` | **Add Supplier** button (opens the A/B router modal) |
| `pages/events/EventsList.tsx` | **New Event** button |
| `pages/tracker/MRLList.tsx` | **+ Add requirement** button (and the empty-state's "Add the first requirement" action) |
| `pages/tracker/MRLRequirementDetail.tsx` | **Save changes** and **Delete** (the whole header action group) |
| `pages/strategy/StrategyPage.tsx` (`DrilldownView`) | **Edit** (needs-by-year) button |
| `pages/tracker/TrackerSupplierDetail.tsx` (`SupplierDetailBody`) | the entire write action bar — **Delete supplier**, **Move to / Move stage** (all stages), **Send to Blacklisted** |
| `pages/tracker/TrackerSupplierDetail.tsx` (`FormSaveBar`) | the per-tab **Save** button — every tab form on the supplier detail goes through this one component, so one gate covers all of them |

Read-only / navigation controls (view detail, filters, search, pagination, Notes panel view,
`SuppliersDetail` which already renders `origin='suppliers'` read-only) are left visible —
SQD can **see** everything, including every field of an MRL requirement or a supplier tab;
what disappears is the button that would try to persist a change.

**Deliberately left ungated**, and why:

- **The Notes panel** (`NotesSidePanel.tsx`) add/edit/delete controls. This is not a gap:
  the backend's `NOTE_WRITE_ROLES` allows every non-Guest role, so PM/Buyer/SQD really can
  write notes. Gating these behind `canWrite` would remove a permission they have.
- **Prospect interest** (`TabProspects.tsx`) — same reasoning, via the backend's
  `PROSPECT_INTEREST_ROLES`. It checks `role` directly rather than `canWrite`.

`pages/events/EventDetail.tsx` uses a **narrower** gate than the table above — `role === 'SSD'`
directly via `usePermissions()`, not the coarser `canWrite` (PM/Buyer can view events but not
edit them). Both of that page's write controls use it: the header **Edit** button and the
**event status `<select>`** (Upcoming / Ongoing / Completed / Canceled). The status dropdown
was previously rendered unconditionally, so a PM/Buyer/SQD got a fully interactive control
whose every use produced an optimistic change, a 403, a silent revert, and an error toast.
`EventFormModal.tsx` serves both create and edit — pass an `event` prop to open it pre-filled
in edit mode, saving through `eventsService.updateEvent`.

A 403 from any of these paths no longer reads as a system failure: `ApiError.isUserFixable`
includes 403, and call sites branch on `ApiError.isPermissionDenied` first to raise
`toast.permissionError()` ("You do not have permission for this") instead of
`toast.systemError()` ("Technical problem — not your data … please try again"), which told a
read-only user the failure was the system's fault and invited them to retry forever. See
"Error handling" below.

**Known follow-ups (out of scope here):**

- **Token is in `localStorage`, not an httpOnly cookie.** Moving to httpOnly cookies
  is the right hardening but is deferred; `localStorage` is XSS-readable.
- Fine-grained gating per module/activity — **PM, Buyer and SQD are operationally
  identical today** (a deliberate, permanent decision: all three are read-only except
  notes and prospect interest), and the write gate is one global boolean. Only
  Guest-vs-rest and SSD-vs-everyone-else are enforced.

### The demo datasets live in the backend now, not here

Every page and component reads and writes through `src/services/*.ts`; this
frontend no longer contains a `src/data/` directory at all — the old demo
datasets (`pipeline-demo.ts`, `events-demo.ts`, `strategy-demo.ts`) moved to
`backend/prisma/fixtures/*.ts`, where only `prisma/seed.ts` imports them, and
now **only under `SEED_DEMO=true`**. A plain `backend` `npm run seed` seeds just
catalogs + the 21 real GSM-team users via upsert (no deletes), so it is **safe
to re-run against TEST/production** with real suppliers/events already
captured. The demo suppliers/events/strategy (which wipe and reseed those
tables) load only when you run `SEED_DEMO=true npm run seed` for local dev. The
`notifications` demo array is no longer seeded at all — notifications now come
from real backend domain events.

`TrackerSupplierDetail.tsx` — the supplier detail screen — writes through the API
too: its tab saves go through a `saveSupplier(supplier, apply)` helper that clones
the record, applies the mutation, and `PATCH`es only the changed fields (a
denylist drops `stage`/`entrySource`/`prelim_hasIMMEX`/`immexStatus`, which PATCH
can't accept — `immexStatus` is the catalog name the API *returns*, written back
only through `immexAnswer` from the External Registration form);
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
not a transition, so it carries no note. All four transition modals
(`MoveStageModal`, `StageTransitionModal`, `ParkingLotPrefillModal`,
`PreliminaryPrefillModal`) share one disabled-until-valid contract: a
`blockedReason`/`canConfirm` pair renders the missing requirement next to the
button and the confirm button itself is `disabled={!canConfirm}` until the note
(and every other required field) is satisfied.

### Send to Blacklisted — availability by stage

The backend accepts a blacklist from any stage except one already `Blacklisted`
or `Completed` (`trackerService.blacklistSupplier`), but the action bar used to
expose that exit only from Preliminary Evaluation, Supplier Evaluation and
Intelex Handoff. Scouting Event and Parking Lot now have their own **Send to
Blacklisted** button too, so a supplier with nowhere good to go is never stuck
without one:

| Stage | Send to Blacklisted | Move to |
|---|---|---|
| Scouting Event | Always enabled (independent of tab completion, the Attendees tab, or `selectedForParking`) | Gated on all five scouting tabs being complete, as before |
| Parking Lot, `parkingSubStatus === 'No Go'` | Enabled | Disabled — *"The supplier is marked 'No Go'. Send it to Blacklisted."* |
| Parking Lot, `'Go'` | Disabled — *"Mark the supplier as 'No Go' to send it to Blacklisted."* | Enabled once the three parking tabs are complete (`canAdvanceParking`, unchanged) |
| Parking Lot, `'Under Evaluation'`, `'On Hold'`, or `parkingSubStatus` unset (`null`/`undefined`) | Disabled — *"The supplier must be marked 'Go' or 'No Go' before advancing or rejecting."* | Same tooltip, also disabled |
| Preliminary Evaluation / Supplier Evaluation / Intelex Handoff | Always enabled (unchanged) | Gated on that stage's tabs (unchanged) |

Every button still opens the shared `BlacklistConfirmModal`, whose rejection
reason remains mandatory (`REJECTION_REASON_MIN`, unchanged). Parking Lot's two
buttons are now always rendered — the old three-branch conditional render is
gone — with the disabled one carrying the tooltip explaining what to change.

### Parking Lot → Preliminary Evaluation — external form data gate

`PreliminaryPrefillModal` now marks **DUNS number**, **Manufacturing country**
and **Manufacturing address** as required (same disabled-until-valid contract as
the other required fields there — see "Advancing a stage requires a note"
above), but this is UI convenience, not the real gate — the backend enforces it
independently (`hasExternalFormData` in
[backend/README.md](../backend/README.md)), so a direct API call with
incomplete data is rejected too. Because the modal's DUNS/country/address
inputs write to `PreliminaryData`/`ParkingData` while the backend's check reads
`CompanyInfo.dunsNumber` and `ParkingData`/`Supplier`'s manufacturing fields, a
supplier can still have the modal's fields filled in yet get rejected by the
backend if those specific source columns are empty — the modal shows the
backend's `BusinessRuleError` message verbatim in that case (`ApiError`'s
`isUserFixable` already covers 409s), rather than a generic one.

**Suppliers migrated from Excel are exempt from this gate**, on both sides.
They never went through the external form, so those three fields have no source
and are captured by hand over time; the backend lets them through unconditionally
(backend/README.md, same section) and the modal matches it. When
`supplier.isExcelMigrated` is `true`, **DUNS number**, **Manufacturing country**
and **Manufacturing address** lose their asterisk and stop entering the
`blockedReason` list, and "Company essentials" gains a non-blocking amber notice
— *"Supplier migrated from Excel — external form data is captured manually.
Fill it in if you have it."* The fields stay editable, and the
9-digit DUNS format rule still applies to **every** supplier the moment a value
is actually typed; it simply no longer fires on an empty field, which only an
exempt supplier can leave empty. Nothing else is relaxed: **Start date**,
**Priority**, **Commodity**, **Primary driver** and the mandatory move note
remain required for everyone, as do the tab checklists in `MoveStageModal` /
`TrackerSupplierDetail`.

`isExcelMigrated` is a backend-computed boolean on the supplier DTO
(`domain/supplierOrigin.ts`, derived from the folio's `XL-` prefix). The
frontend consumes the flag and **never parses the folio itself** — the prefix
convention is a backend detail that is expected to become a real `T_Supplier`
column later. It also explains `hasExternalFormData`: that field is `true` for
every `XL-` supplier, so `isExcelMigrated` is what tells "the data is complete"
apart from "this supplier was never asked for it".

Once the move goes through, the **Preliminary Evaluation tabs arrive
pre-filled**: the backend seeds `PreliminaryData` from the supplier's
`CompanyInfo`/`TechnicalInfo`/`CommercialInfo` at the moment the row is created
(see backend/README.md, "Entering Preliminary Evaluation seeds the satellite
from the supplier's profile"). No frontend change was needed — the same
`prelim_*` fields simply come back populated instead of empty, and GSM confirms
or corrects them rather than retyping. Fields the supplier never answered are
still blank, and every value is GSM's to edit from then on: the seed runs once,
at row creation, and never writes over an edit.

`SupplierTrackerCard` shows a small amber triangle next to the supplier name,
Parking Lot only, when the backend-computed `supplier.hasExternalFormData` is
`false` **and** `supplier.isExcelMigrated` is not `true` — a discreet heads-up
that the supplier can't advance yet. Exempt suppliers never get the triangle:
warning about data that will never block them would be noise. Parking Lot itself
stays fully visible and editable; there's no expiry or auto-blacklist for missing
data (intentional — see backend/README.md).

Excel-migrated suppliers instead carry a neutral-grey `faFileImport` icon next
to the name, **in every stage**, titled *"Migrated from Excel — exempt from
external form data."* Tooltip only — no pill, no visible label: it
states where the row came from, it is not a problem to act on.

### Intelex Handoff — level sequencing

Intelex Handoff has an explicit sub-status, `intelex_currentLevel`
(`Investigate | L0 | L1 | L2 | L3 | L4 | Completed`), derived and persisted by the
backend (see [backend/README.md](../backend/README.md)). Both the editable
`TabIntelexTimeline` and the read-only `TabROIntelexTimeline` show it as a **"Current
level" badge** at the top of the card, so there's finally a visible indicator of where
the supplier is inside the handoff.

**Where the level shows up.** Three places, all reading the same field:

- **`IntelexLevelBadge`** ([src/components/IntelexLevelBadge.tsx](src/components/IntelexLevelBadge.tsx))
  — it moved out of `read-only-tabs.tsx` into `components/` once it gained a third
  consumer; `read-only-tabs.tsx` re-exports it so the two Timeline tabs' imports are
  unchanged. Its `compact` prop is the pill alone (no "Current level" caption, no
  bottom margin) for use inside a card.
- **`SupplierTrackerCard`** shows the compact badge **only when the supplier's stage
  is Intelex Handoff** — the level means nothing anywhere else. It shares the status
  pill row with the sub-status chip.
- **`TrackerStage`** renders the Intelex Handoff board as **seven collapsible groups**
  (`IntelexLevelGroups`), one per level in sequence order, instead of one flat grid.
  Empty levels are still listed (muted, collapsed) so the shape of the handoff reads
  at a glance; a level value outside the sequence lands in a trailing **Other** group
  rather than dropping off the board. This grouping is **exclusive to this stage** —
  the other four working stages keep the plain 3-per-row grid, and Intelex Handoff is
  still one stage in `TRACKER_STAGE_CONFIG`, never seven.

The level order lives once in
[src/constants/intelex-levels.ts](src/constants/intelex-levels.ts) (`INTELEX_LEVELS`,
`INTELEX_LEVEL_COLOR`), shared by the Tracker grouping and the Reports breakdown.

The **Timeline** tab mirrors the backend's sequencing rule structurally: a level's
**"Real"** date input is **disabled + greyed (with a tooltip)** until the previous
level's Real date has a value — Investigate is always open, and **"Expected" inputs stay
enabled** for every level. So you can't even type an out-of-sequence Real; if one somehow
reaches the API, the backend rejects it with a 409. Capturing a Real advances the badge on
the next fetch. `intelex_currentLevel` is on the `PATCH_DENYLIST` (server-derived,
read-only) so the tab-save diff never pushes it.

### Intelex Handoff — efficiency comes from the server

Each level's efficiency is **how late its own Real date landed against its own
Expected date**, through the GSM team's stepped penalty (`<= 5` days → 95%, sliding
down to a 50% floor past 25 days), plus a **Global** value averaging the levels that
have one. The formula and all six stored values are the backend's
([backend/README.md §2.2c](../backend/README.md)); it used to be a
planned-vs-actual ratio measured from the record creation date, which in practice
only ever showed 0% or 100%.

**The frontend reads, it does not compute.** `TabROIntelexEfficiency` (read-only) and
`TabIntelexEfficiency` (the editable tab, which only marks the tab reviewed) both
render `supplier.intelex_efficiencyL0..L4` and `intelex_efficiencyGlobal` straight
from the wire, so the two cards and the database can't disagree. All six fields are on
the `PATCH_DENYLIST` alongside `intelex_currentLevel` — saving the Timeline sends only
the dates, and the backend's response carries the recomputed scores back.

The one exception is the **live preview inside the editable Timeline form**, which has
to score dates the user has typed but not yet saved: `intelexLevelEfficiency(expected,
real)` in [read-only-tabs.tsx](src/pages/tracker/read-only-tabs.tsx) is a **deliberate
duplicate** of the backend's five branches, labelled as such at both ends — retune one,
retune the other. Investigate shows *Not scored* there: it has no efficiency column.

The **Global** row closes both Efficiency cards under a heavier rule, and appears only
once at least one level has a score (it is `null` until then, never 0% — an
uncaptured level is skipped by the average, not counted as a failure).

### Stage tabs — Visit belongs to Supplier Evaluation

GSM moved the **Visit** tab out of Preliminary Evaluation and into Supplier
Evaluation, as the **last** of its three tabs. In
[src/pages/tracker/TrackerSupplierDetail.tsx](src/pages/tracker/TrackerSupplierDetail.tsx):

| Stage | Tabs, in order | Advance gate |
|---|---|---|
| Preliminary Evaluation | Overview → Capabilities | both complete |
| Supplier Evaluation | Competitiveness → Fundamentals → Visit | all three complete |

- The tab id is **`se_visit`** (was `prelim_visit`), and the components are
  `TabSEVisit` / `TabROSEVisit` (was `TabPrelimVisit` / `TabROPrelimVisit`),
  titled *"Supplier Evaluation — Visit …"*.
- **The field bindings/wire names did not change.** Visit still reads and
  writes `prelim_visitDatePlanned`, `prelim_visitDateCompleted`,
  `prelim_visitParticipants`, `prelim_strengths`, `prelim_weaknesses`,
  `prelim_observations`, `prelim_recommendations`. Those columns now live on
  `SupplierEvalData` in the backend (moved from `PreliminaryData` as of
  2026-08-17 — see [backend/README.md](../backend/README.md) and
  `backend/DEBT.md` entry 1, Part A), but the `prelim_*` wire contract is
  unchanged, so this move is invisible from the frontend: a supplier whose
  visit was reported before the move shows the same data under the same tab.
  The completion flag is a key of `supplierEvalTabsCompleted`, not of
  `preliminaryTabsCompleted`.
- `utils/tracker-helpers.ts` follows the new grouping in its per-stage field
  lists: the Visit fields count towards **Supplier Evaluation**'s completion
  percentage, not Preliminary's (see "Information completeness" below).
- `CompletedSupplierDetail` (the read-only full-history view) shows Visit as a
  third sub-tab under **Supplier Eval** rather than under **Preliminary**.

### Read-only tabs — shared between Completed and Blacklisted

**All 17** `TabRO*` components (one per stage's read-only card —
`TabROScoutingEvent`, `TabROAttendees`, `TabROAgenda`, `TabRONextStep`,
`TabROParkingOverview`, `TabROSEFundamentals`, `TabROIntelexTimeline`, …),
`TabCompletedOverview` (the consolidated "who is this supplier" summary), the
shared primitives `DisplayCard`/`DisplayField`/`Badge`/`SectionTitle`/`InfoRow`,
`HistoryTimeline`, and the Intelex efficiency helpers (`daysBetween`,
`intelexLevelEfficiency`, `intelexEffColor`, `INTELEX_EFF_LEVELS`, and
`IntelexLevelBadge` — now defined in `components/IntelexLevelBadge.tsx` and
re-exported here, see "Intelex Handoff — level sequencing") live in
[src/pages/tracker/read-only-tabs.tsx](src/pages/tracker/read-only-tabs.tsx),
not in `TrackerSupplierDetail.tsx`.

**The dependency runs one way and must stay that way.** `read-only-tabs.tsx`
imports nothing from `TrackerSupplierDetail.tsx`; all three detail screens
import from it. `TrackerSupplierDetail` imports them for its own read-only
sub-tabs (e.g. the `SupplierDetailBody` write flow shows `TabROParkingOverview`
once Parking Lot is complete) and for the Timeline form's live efficiency
preview — the displayed numbers themselves come from the server (see "Intelex
Handoff — efficiency comes from the server"), so the write and read-only views
can't drift. `CompletedSupplierDetail` and `BlacklistedSupplierDetail` import
the same components directly — there is exactly one implementation of each
stage's read-only card, never a copy per consumer.

Four of these (`TabROAttendees`, `TabROAgenda`, `TabRONextStep`,
`TabCompletedOverview`) used to be *defined* in `TrackerSupplierDetail.tsx` and
imported back out of it, which made the module boundary documentation-only. The
cost was measurable: because the two read-only screens could only reach
`read-only-tabs.tsx` *through* the 3000-line editable page, Rollup had no choice
but to fold the whole module into that page's chunk, so opening a blacklisted or
completed supplier downloaded ~127 KB of an editable detail view that reader
would never use. With the four moved, `read-only-tabs` is its own ~18 KB chunk
and neither read-only screen's bundle references
`TrackerSupplierDetail-*.js` at all.

If a component here needs a helper that currently lives in
`TrackerSupplierDetail.tsx`, **move the helper into this file** — do not add an
import in the other direction.

### Blacklisted supplier detail — stage-scoped tabs

`BlacklistedSupplierDetail` mirrors `CompletedSupplierDetail`'s tab layout
(same `SubTabBar`, same `TabRO*` components), but a blacklisted supplier never
finished the pipeline, so it only ever populated the tabs up to the stage it
was rejected from. The wire `stage` field already carries that stage — the
backend mapper substitutes `stageBeforeExit` into `stage` for blacklisted rows
(see "Information completeness" below) — so the page derives which tabs to
show from `stageIndex(supplier.stage)` (`utils/tracker-helpers.ts`), a small
frontend-only mirror of the backend's stage ordering (the backend's own
`stageIndex` lives in domain code the frontend can't import). A supplier
blacklisted from Parking Lot shows only Overview/Scouting/Parking/Timeline; one
blacklisted from Intelex Handoff shows all 6 stage tabs plus Timeline.
**Timeline** is the one tab Completed doesn't have — a plain read-only render
of `supplier.history` via the shared `HistoryTimeline` component, the same
dot-timeline `TrackerSupplierDetail`'s own History tab shows. The **Rejection
Details** card (rejected by / date / last stage / reason) sits above the tabs
and is not part of any of them, since it should stay visible no matter which
tab is active.

Re-entering a blacklisted supplier into the active pipeline is explicitly out
of scope — `moveSupplierToStage` still rejects any move on a `BLACKLISTED`
supplier — see [`backend/DEBT.md`](../backend/DEBT.md) entry 2.

**Fundamentals gained a "Cost Model" Y/N select**, right after *SDA signed*, using
the same `ynSelect` helper and grid as the other document fields. It maps to
`prelim_costModel` and is **optional** — like TC&Cs / TTC&Cs / NSR / SDA it is not
required to save the tab, and it is **not** part of the gate that sets
`selectedForDevelopment` (still RFQ = Y && NDA = Y). `TabROSEFundamentals` renders
it read-only in the same position.

## Registering a supplier — forms A and B

A supplier enters the system through one of the two forms behind the
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

> **These two forms are no longer the only door.** Suppliers can also register
> themselves through an external Microsoft Form, which Power Automate posts to
> `POST /api/public/form-intake` — a backend-only route with no UI in this app
> (see backend/README.md §3). It reaches the same `createSupplier` /
> `addSupplierToEvent` logic and applies the same field conversions
> `payload.ts` applies here, mirrored server-side in
> `backend/src/domain/formIntakeMapper.ts`. Anything changed in `payload.ts` —
> especially `EMPLOYEE_RANGES`, which that file duplicates — has to change there
> too.
>
> **The mirror is partial in one direction.** Since 2026-08-24 the external Form
> asks fifteen questions these two in-app forms do not (HQ city/country,
> manufacturing city, general manager, first contact with Nexteer, tooling design,
> raw-material index, applications, footprint, years in Mexico, market, business
> sector, automotive %, export local content % and destination countries), and the
> backend now has a column for each. They are **backend-only**: nothing in this app
> collects or displays them, and `payload.ts` has no counterpart to keep in step.

**Commodity is not defined in Scouting Event.** In Form A the Product section leads
with a free-text **"Type of Products"** field (the primary field — what the supplier
makes), and the **Commodity selector is optional**: leaving it blank sends the
`PENDING_GSM_COMMODITY` placeholder (`'TBD -- Pending GSM'`), because GSM assigns the
real commodity later. `ParkingLotPrefillModal` still makes commodity **required** —
blank fails validation like any other required field — but the placeholder itself no
longer blocks the move: `commodity === PENDING_GSM_COMMODITY` is a valid, non-empty
value now, so a supplier can advance from Scouting Event to Parking Lot still carrying
it. The modal instead shows a non-blocking amber notice under the Commodity selector
— *"This supplier still has the pending "TBD -- Pending GSM" commodity. Assign it a real
commodity soon; the advance is not blocked."* — as a nudge to assign the real
value soon rather than a gate. Form B (Internal Recommendation) goes straight to
Parking Lot, so its commodity is still expected to be a real value from the start,
though it is no longer specially enforced beyond the shared required-field check.

**"Other" free-text.** Every closed question that offers *Other* reveals a
"please specify" input (`SelectWithOther` / `MultiSelectWithOther` in FormShell);
`resolveOther` / `joinListWithOther` (payload.ts) fold the typed text into the
value as `Other: <text>`. **Amount + unit** questions (press capacity → tonnes,
annual revenue → currency) use `QtyUnit` and are joined into their single column
(e.g. `500 T`, `120000000 USD`).

### Catalogs

- [src/constants/catalogs.ts](src/constants/catalogs.ts) — **confirmed** catalogs
  (`COMMODITIES` and the C_* tables) plus form option lists GSM has confirmed,
  including `CONTACT_CHANNELS` (Q7) and `EMPLOYEE_RANGES` (Q25). `PENDING_GSM_COMMODITY`
  (`'TBD -- Pending GSM'`, the backend's 37th commodity value) lives here too but is
  **kept out of `COMMODITIES`** — it is auto-assigned when GSM has not defined a
  commodity, never offered as a pickable option.
- [src/constants/catalogs-pending-gsm.ts](src/constants/catalogs-pending-gsm.ts) —
  ⚠ **placeholders** still awaiting GSM. Do not merge them into `catalogs.ts`;
  move each one over as GSM confirms it, as was done for Q7/Q25.

### Design tokens — the brand palette

[src/constants/designTokens.ts](src/constants/designTokens.ts) is the single
source of truth for the brand/layout palette. Import from here instead of
writing a hex literal in a `style={{}}`:

| Token | Value | Was |
| --- | --- | --- |
| `BRAND_COLORS.header` | `#AA0202` | header bar |
| `BRAND_COLORS.sidebar` | `#808285` | sidebar + all secondary/muted text |
| `BRAND_COLORS.background` | `#EEEEEE` | page background, dividers |
| `BRAND_COLORS.cards` | `#FFFFFF` | card and panel surfaces |
| `BRAND_COLORS.accentRed` | `#DC0202` | primary action / destructive accent |
| `BRAND_COLORS.userBlock` | `#6B7280` | user block, Guest role tint |
| `NEUTRAL_COLORS.border` | `#D1D3D4` | default input/button border |
| `NEUTRAL_COLORS.borderLight` | `#E0E0E0` | lighter card border |
| `NEUTRAL_COLORS.panelBg` | `#F7F7F7` | inset panel / table header fill |
| `NEUTRAL_COLORS.textDark` | `#333333` | dark body text |
| `ACCENT_COLORS.info` | `#0084C0` | info/link accent, MRL & Strategy headers, B2B badges |
| `ACCENT_COLORS.purple` | `#C026D3` | secondary accent (e.g. the "strategy updated" notification icon) |

`ACCENT_COLORS` is consumed from the token at every call site outside
`stage-config.ts` itself, same as `BRAND_COLORS`/`NEUTRAL_COLORS`. The file
also re-exports `TRACKER_STAGE_CONFIG` / `TERMINAL_STAGE_CONFIG` so a caller
needing both palettes has one import.

**Transparency suffixes** keep the token and append the alpha as a template
string — `` `${BRAND_COLORS.accentRed}26` ``, not `'#DC020226'`.

Three things are deliberately **not** tokenised: `#000000` (~275 uses), which is
generic black body text rather than a brand colour; the stage colours, which
belong to `stage-config.ts` (below) because they are paired with names and icons
there — including the two entries whose values happen to equal `ACCENT_COLORS.info`
(`Intelex Handoff`) and `ACCENT_COLORS.purple` (`Supplier Evaluation`), left as
plain hex in that file by the same rule; and `#6ABF4B` (~68 uses), a repeated
green that has no token yet — a
candidate for a future extension, not something to inline a new name for.

### Stage colours

[src/constants/stage-config.ts](src/constants/stage-config.ts) holds stage
colours/icons as a synchronous constant — `getStageColor()` is called inline all
over the render tree, so a colour must not await a round-trip. The API serves the
same colours for the 5 working stages; Blacklisted and Completed are exits from
the board rather than columns on it, so only this file describes them.

## SLA colours — and the day count — come from the backend

`supplier.sla` and `supplier.globalSla` are **derived and persisted by the backend**
(thresholds and mechanism: [backend/README.md §2.1](../backend/README.md)). The
frontend must never re-derive a colour from a day count — it only maps the state
name to a hex through `slaColors` / `slaLabels` in
[src/utils/tracker-helpers.ts](src/utils/tracker-helpers.ts), which is also where
`slaBarScaleDays` lives (a display-only denominator for the progress bars).

**`supplier.daysInStage` is the single day counter**, and it is derived the same
way: the backend recomputes it from the current stage's anchor date on every read,
for all five active stages, so it advances with the calendar and can never
disagree with the SLA dot next to it. Render it as-is.
[src/pages/tracker/SupplierTrackerCard.tsx](src/pages/tracker/SupplierTrackerCard.tsx)
used to prefer **`supplier.parkingDaysElapsed`** for Parking Lot cards — a second
counter backed by `T_Supplier_ParkingData.DaysElapsed` that nothing in the backend
wrote (null except for a few demo rows with hand-written values). That fallback
went first, the same way the old dual "Timeliness" indicator was retired in favour
of one value; **the column itself is now gone too**, dropped from the Prisma
schema, the production baseline, the mapper and the seed. The API therefore no
longer returns `parkingDaysElapsed` at all, and sending it in a `PATCH` is
rejected as non-patchable. `ParkingLotPrefillModal` already refrains from sending
it. `TrackerSupplier.parkingDaysElapsed` survives in
[src/types/index.ts](src/types/index.ts) only because the backend demo fixtures
import that type and still populate the field; it is inert on both sides.

⚠️ **While the services are still mocks, the rendered colour is only as fresh as
`backend/prisma/fixtures/pipeline-demo.ts`.** The demo rows carry hand-written `sla` values that no
longer match their own dates, so the detail page can show a live day count next to a
stale state — e.g. `ps6` renders "123 days · At risk" because the demo says
`sla: 'yellow'`, while the backend returns `red` for that same supplier. This
resolves itself when the services are switched to `fetch`; it is not a bug in the
rendering.

## Information completeness — counted from fields, not from tabs

The second bar on every tracker card (`SupplierTrackerCard`, via
`getInfoCompletionPercent` in
[src/utils/tracker-helpers.ts](src/utils/tracker-helpers.ts)) answers a different
question from the SLA dot next to it: **how much of this supplier's data is
captured for the stage it is in right now.** SLA is about elapsed time; this is
about filled fields. The card keeps them visually separate on purpose.

It used to count **completed tabs** — which measured a click, not data, so a
supplier could read **100% with almost every field empty**. GSM reported exactly
that: a supplier at 100% with only the NDA filled in. The rule is now:

```
percent = round(filled fields of the current stage / total fields of that stage × 100)
```

- **Only the current stage counts.** That is what makes the number restart when a
  supplier advances — the new stage is simply a different denominator. There is no
  explicit reset anywhere. A stage nothing prefilled starts at **0%**; one entered
  through `ParkingLotPrefillModal` / `PreliminaryPrefillModal` or the registration
  form starts at whatever those populated (a Preliminary supplier arriving through
  the prefill modal shows ~31%, its 10 prefilled fields out of 32).
- **Filled** means not `null`/`undefined`, not a blank or whitespace-only string,
  and not an empty list. **`false` and `0` count as filled** — they are real
  answers. `prelim_parts` is one key covering the whole Competitiveness tab: it
  counts once the list holds at least one part.
- **Intelex Handoff** is computed the same way; it no longer returns a hardcoded
  100.
- **Terminal suppliers.** A blacklisted row already arrives carrying the stage it
  was rejected from (the backend mapper substitutes `stageBeforeExit` into
  `stage`), so it scores against that stage like any other supplier. A completed
  one reports `stage: 'Completed'` and its pre-exit stage is not on the wire, so
  it returns **0** rather than inventing a denominator.

**The field lists are exported constants**, one per stage —
`SCOUTING_EVENT_FIELDS` (27), `PARKING_LOT_FIELDS` (16),
`PRELIMINARY_EVALUATION_FIELDS` (32), `SUPPLIER_EVALUATION_FIELDS` (15),
`INTELEX_HANDOFF_FIELDS` (14) — typed `readonly (keyof TrackerSupplier)[]`, so a
key that no longer exists on the type is a compile error. They are transcribed
from the **read-only tab components** in `pages/tracker/read-only-tabs.tsx`
(`TabROParkingOverview`, `TabROPrelimOverview`, `TabROSEFundamentals`, …), which
are the authoritative enumeration of what each stage holds. **Adding a field to a
tab means adding its key to the matching list**, or the denominator silently
under-reports. Deliberately excluded: derived values a tab renders but nobody
types (Intelex Record's "Days from Pre-eval", the entire Intelex **Efficiency**
tab, `intelex_currentLevel`), and the tab-completion booleans themselves.

> These lists are **display** fields, not a validation contract. Listing a field
> does not make it required to save a tab or to advance a stage — those rules are
> unchanged. Whether any field becomes mandatory is a separate, still-open GSM
> decision.

`docsPercent`, which still travels from the backend, is **not** what this reads;
it is a legacy column and nothing on the card consumes it. `getDocsBarColor`
(≥75 green, ≥50 amber, else red) is unchanged and still colours the bar.

## Loading, empty and KPI states — Nexteer UI v4 shared components

`components/LoadingState.tsx`, `components/EmptyState.tsx` and `components/KpiCard.tsx`
are the **canonical** implementations of these three building blocks, aligned to the
Nexteer UI component kit (v4). No screen defines its own private spinner or KPI card
any more; `UserManagement`'s zero-data empty text is the one remaining ad-hoc empty
state (out of scope for this pass — see below).

**`LoadingState`** — a 72×72 circular progress ring (`#F3D6D6` track, `#DC0202` arc,
spinning 1.1s linear) around a contextual 22px Font Awesome icon (`icon` prop, defaults
to `faChartLine`), with a bold 15px message below and an optional 13px submessage.
`message` defaults to `"Loading elements…"`; the legacy `entity` prop still works
(`"Loading {entity}…"`) so old call sites compile unchanged. `fullScreen` renders it as
a fixed, full-viewport overlay instead of an inline block; `fill` (see below) fills and
centres it in the `<main>` content area instead.

```tsx
<LoadingState entity="Suppliers" icon={moduleIcons.suppliers} />
<LoadingState message="Loading report…" icon={moduleIcons.reports} fullScreen />
```

**`components/moduleIcons.ts`** is the single source of truth for "which icon
represents this module" — one `Record<NavModule, IconDefinition>` for the 7 nav
modules (`home | tracker | suppliers | events | strategy | reports | visuals`), keyed
off the icon `Sidebar.tsx`'s `NAV` array actually renders (the sidebar is the user's
visual reference). `Sidebar` consumes the map instead of importing icons directly, and
every `LoadingState` call site for a nav module — including its detail sub-screens
(e.g. `TrackerSupplierDetail`, `BlacklistedSupplierDetail`, `MRLList` → `tracker`;
`SuppliersDetail` → `suppliers`) — pulls its icon from the same map, so the sidebar
icon and the loading-spinner icon can no longer drift apart the way `Tracker`
(`faTimeline` vs `faColumns`), `Reports` (`faFileLines` vs `faChartColumn`), `Visuals`
(`faChartBar` vs `faChartLine`) and `Events` (`faCalendar` vs `faCalendarDays`) once
did. `UserManagement` isn't a nav module and keeps its own `faUsers` icon by hand.

The optional `style` merges over the container, for callers that need the block
centred inside a card/table cell rather than filling the page (`UserManagement`,
`TrackerStage`, `MRLList`, `SuppliersList`, `EventsList`, `HomeGuestView`,
`TrackerBlacklisted`, `TrackerCompleted` — these render `LoadingState` next to other
already-rendered chrome, so they keep their own padding and never pass `fill`).

**`fill`** is for the other case: a screen whose *entire* content, while loading, is
`return <LoadingState .../>`. Without it the spinner sat at the top of `<main>` with a
flat `64px 0` padding, reading as "stuck near the header" rather than centred in the
grey content area. With `fill`, the container's height is
`calc(100vh - MAIN_PADDING_TOP - MAIN_PADDING_BOTTOM)px` — `MAIN_PADDING_TOP`/
`MAIN_PADDING_BOTTOM` from `components/layoutConstants.ts`, the exact numbers
`App.tsx`'s `<main>` pads itself with — so it fills precisely the visible content area
(excluding the fixed header and the sidebar's row, since `<main>` is already offset
past both) with no added vertical scroll, and centres its contents in it.

## Layout constants — one source of truth for the header/content geometry

`components/layoutConstants.ts` holds `HEADER_HEIGHT` (55, the fixed header's height),
`MAIN_PADDING_TOP/X/BOTTOM` (`<main>`'s own padding in `App.tsx`), and
`NOTIFICATION_PANEL_MAX_WIDTH` (the notification panel's max width, `GlobalHeader.tsx`).
Everything that positions itself relative to the header or needs the real content-area
size reads from here instead of a hand-copied number — `GlobalHeader.tsx` imports
`HEADER_HEIGHT` and **re-exports** it (so `Sidebar.tsx`, `App.tsx` and
`NotesSidePanel.tsx`, which already imported it from `GlobalHeader`, keep working
unchanged); `LoadingState`'s `fill` mode and `ToastContext`'s toast stack both import
straight from `layoutConstants.ts`. This split also lets `ToastContext` (mounted in
`main.tsx` **above** the router, see below) read `HEADER_HEIGHT` without importing the
whole `GlobalHeader` module just for a number.

**Toast stack** (`context/ToastContext.tsx`) is anchored `top: HEADER_HEIGHT + 16,
right: 24` — top-right, below the fixed header, flush against the right edge. It does
**not** reserve space for the notification panel (`NOTIFICATION_PANEL_MAX_WIDTH`,
still used by `GlobalHeader.tsx` for the panel's own width, is unrelated to this
container): an open panel can occasionally sit under a toast, which is accepted — a
toast is transient (auto-dismisses) and dismissible by hand, so it isn't worth
permanently pushing the whole stack toward the screen's centre just to dodge that.
The stack's `zIndex` (`10002`, above the panel's `99`) keeps a toast visible over the
panel on the rare occasion they do overlap. Newest-on-top: the `toasts` array is still
appended-to in creation order, but the render maps over `[...toasts].reverse()` so the
most recent one renders closest to the header — the opposite of the old bottom-right
anchor, where the newest toast was the one closest to the screen edge. The `toast-in`
slide-from-the-right keyframe in `index.css` didn't need to change — it never
referenced the vertical anchor.

**`EmptyState`** — a white card (radius 8, shared shadow) with a 48px grey icon badge,
a bold 15px title and a 13px `#808285` description, plus an optional primary-red
`action` button (`{ label, onClick }`) rendered only when provided.

```tsx
<EmptyState icon={faInbox} title="No notes in this period" description="No comments were written between these dates." />
<EmptyState icon={faSearchMinus} title="No suppliers found" description="Try different filters or search terms" action={{ label: 'Clear filters', onClick: clearFilters }} />
```

Screens that distinguish "no data at all" from "no matches for the current
filter/search" (e.g. `SuppliersList`) render `EmptyState` for both cases, but only the
filtered/searched empty result gets the `action` button — the zero-data case has no
"Clear filters" affordance to offer. `UserManagement` still keeps its own plain,
icon-less "No users yet." text for the zero-data case (out of scope for this pass).

**`KpiCard`** — the label (14px/500 `#808285`) and value (30px/700 `#000000`, optional
11px `#808285` sub) sit on the left; a 48px icon circle (icon colour at ~12% opacity,
20px icon) sits on the right, vertically centred against the whole card via a flex row
(`alignItems: 'center'`, `justifyContent: 'space-between'`) rather than pinned to the
label.

```tsx
<KpiCard icon={faBuilding} color="#02B3E1" label="Total Suppliers" value={totalSuppliers} sub="registered in the system" />
```

| Screen | `entity` |
|---|---|
| `Inicio` (full dashboard) · `HomeGuestView` | `Home` |
| `Reports` | `Report` |
| `UserManagement` | `Users` |
| `Dashboard` (Visuals) | `Visuals` |
| `tracker/TrackerStepperView` · `TrackerStage` · `TrackerBlacklisted` · `TrackerCompleted` | `Suppliers` |
| `tracker/TrackerSupplierDetail` · `BlacklistedSupplierDetail` · `CompletedSupplierDetail` · `suppliers/SuppliersDetail` | `Supplier` |
| `suppliers/SuppliersList` | `Suppliers` |
| `events/EventsList` | `Events` · `events/EventDetail` → `Event` |
| `strategy/StrategyPage` | `Strategy` |
| `tracker/MRLList` | `MRL Requirements` · `MRLRequirementDetail` → `MRL Requirement` |

Screens whose **whole** body is derived from several parallel fetches (`Inicio`,
`Dashboard`, `StrategyPage`, `TrackerStepperView`) return the loading state instead of
rendering, rather than briefly painting a dashboard of zeros that then jumps to real
numbers. List screens keep their header/filters visible and swap only the table body,
so the loading state never displaces the controls. `ProtectedRoute` and `Login` keep
their own spinners on purpose — they are auth-status/button states, not data fetches.

## Notifications panel — the icon says what happened

`components/GlobalHeader.tsx` owns the bell and the panel behind it. A notification
carries **two** labels from the backend: `type` (severity — `info`/`warning`/`error`) and
`category` (the domain event). The panel styles rows off the **category**, because nearly
every event is `info` and severity alone drew the same icon for all of them.

### Tracker categories: `TRACKER_STAGE_CONFIG` is the source of truth

The three tracker families are **granular per stage** — `supplier_created_*`,
`supplier_updated_*` and `stage_advanced_*` each name the stage the fact belongs to — and
`categoryStyle` derives their `{icon, color}` **from `TRACKER_STAGE_CONFIG`
(`constants/stage-config.ts`) rather than declaring a palette of its own.** No stage colour
is typed twice anywhere in this file; `stageIconByName` only translates the config's
FontAwesome class names (`'fa-circle-pause'`) into the definitions the component renders,
the same map `TrackerStepperView` keeps for the board.

That is the whole point of the split. A single `stage_advanced` colour could only ever say
*"the tracker"*, which is what the reader already knows; naming the stage means a
notification **looks like the column it is about** — the correspondence is 1:1:

| `category` | stage entry it reads | icon | colour |
|---|---|---|---|
| `supplier_created_scouting` · `supplier_updated_scouting` · `stage_advanced_scouting` | Scouting Event | `faBinoculars` | `#02B3E1` |
| `supplier_created_parking` · `supplier_updated_parking` · `stage_advanced_parking` | Parking Lot | `faCirclePause` | `#D4A017` |
| `supplier_updated_preliminary` · `stage_advanced_preliminary` | Preliminary Evaluation | `faClipboardCheck` | `#E3650B` |
| `supplier_updated_supplier_eval` · `stage_advanced_supplier_eval` | Supplier Evaluation | `faFileContract` | `#C026D3` |
| `supplier_updated_intelex` · `stage_advanced_intelex` | Intelex Handoff | `faHandshake` | `#0084C0` |
| `stage_advanced_completed` | Completed | `faCircleCheck` | `#6ABF4B` |
| `blacklisted` | Blacklisted | `faBan` | `#000000` |

So a supplier registered by internal recommendation arrives yellow with a pause icon, one
registered from an event arrives light blue with binoculars, an edit made while the supplier
sits in Parking Lot is yellow too, and a move to Completed is green with a check — each of
them the exact colour of the place on the board it is talking about. Editing a stage's colour
in `stage-config.ts` repaints its notifications with it, automatically.

### The six non-tracker categories

These keep **one colour per module, one icon per event within it**, because they have no
stage to name:

| `category` | icon | colour | module |
|---|---|---|---|
| `event_created` | `faCalendarPlus` | `#04BF6E` | events |
| `event_updated` | `faCalendarCheck` | `#04BF6E` | events |
| `strategy_updated` | `faBullseye` | `#C026D3` | strategy (the sidebar's own icon) |
| `mrl_created` | `faFileCirclePlus` | `#E3650B` | MRL |
| `mrl_updated` | `faFilePen` | `#E3650B` | MRL |
| `mrl_deleted` | `faFileCircleMinus` | `#E3650B` | MRL |

`#04BF6E` is the green `EventDetail.tsx` already paints its own header and modals with, so a
new-event notification matches the screen it opens; it replaced `#02B3E1`, which is Scouting
Event's colour and now belongs to that stage alone. The three MRL values are **deliberately
not folded into the stage vocabulary**: MRL lives in the Strategy module and only *happens*
to share Preliminary Evaluation's orange.

`styleFor(n)` is the single mapping: category first, **severity as the fallback** when the
category is `null` or unknown — every notification stored before the column existed still
renders, just with the old generic icon. That fallback is also what catches a row whose
`category` predates the per-stage split and was never backfilled, so it must not be removed.
The colour drives both the 3px left bar and the tinted circular badge (`colour + 1F`); a
**read** row is muted to `#9CA3AF` but keeps its category icon, so it stays identifiable
after being read.

**You never see your own saves.** The backend fans each domain event out to every
operational user (SSD/PM/Buyer/SQD — never `Guest`, whose panel stays empty) *except* the
one who performed it, and sends **one** notification per save operation — a
supplier edit touching four fields is a single row naming all four (*"Itzel actualizó 4
campos de Aceros del Bajío: DUNS, País, Buyer, Website"*), never four rows. The panel needs
no filtering of its own for either rule; see [backend/README.md](../backend/README.md) →
*Notifications are generated by domain events*.

**Layout** (Nexteer UI kit): `25vw` wide clamped to `300–420`, `75vh` tall, anchored under
the fixed header on the right. `#DC0202` header strip (the fixed global header above it is
the darker `#AA0202`, so the two reds stay visually separated) with a white bold-15px title
and a white close ×; two 13px/600 half-width tabs below it — **Unread (n)** (unread,
regardless of age) first and active by default on open, then **All** (every notification,
read and unread, unfiltered by age) — active in `#DC0202` with a 2px underline, inactive
`#808285`. The list between the tabs and the bottom bar is `flex:1; overflowY:auto;
minHeight:0` — the `minHeight:0` is what makes it scroll instead of stretching the panel past
75vh. An empty list renders a centred message: **"You're all caught up."** on Unread,
**"No notifications here."** on All.

Opening the panel (closed → open) re-fetches the list, so the badge/rows can't go stale for
the length of a session; there is deliberately no interval polling on top of that. Clicking
an unread row (outside multi-select) marks it read — optimistically in local state, plus
`markNotificationRead(id)` to the server, errors swallowed the same way `markAllRead` does —
before closing the panel and navigating to its link.

**Deleting always asks first.** The bottom bar's **Delete** enters a multi-select mode
(checkbox per row, then **Delete (n)** / **Delete all** / **Cancel**); every one of those
paths — one, several or all — opens `ConfirmDialog` before anything is removed, and the
outside-click handler is suspended while the dialog is up so the panel can't close under the
question. The delete runs on the **server first** and only then updates the list; a failure
re-fetches instead of guessing what survived. **Mark all as read** (`#0084C0`) stays
optimistic — it is not destructive. Rows, tabs and bar buttons each own their hover state,
so a hovered row can never override the selected-row tint in multi-select mode.

## Search & filters — one shared bar, standardized per module

`components/SearchBar.tsx` is the **canonical** free-text search input (extracted from
`SuppliersList`): magnifier at left 12, 36px left padding, `#E0E0E0` border, radius 6,
13px, plus an **× clear** button that appears once there is text. Every list module now
uses it instead of a hand-rolled `<input>`. All filtering is **client-side over already
loaded data** (no extra requests); filter option lists (commodity, SLA…) are derived from
the loaded rows.

**`utils/search-filter.ts` is the matching rule**, as `SearchBar` is the input and
`useTableSort` is the ordering. The seven list screens had each written the same
shape by hand — lowercase the query, then OR a chain of `.includes()` — with small
divergences (some trimmed the query, some did not; some coalesced nulls, some would
have thrown on one). `filterBySearch(rows, query, row => [fields…])` normalises the
query once per render, treats null/undefined as empty, and searches numbers by their
string form. **Which fields are searched stays at the call site**, because that is the
part that legitimately differs per screen — see the table below.

**Empty state distinguishes "no data" from "no matches"** (`SuppliersList.tsx`,
`ListView`): when search and every filter dropdown are inactive and the list is still
empty, the system genuinely has zero suppliers, so it shows a plain **"No suppliers
yet."** with no icon and no "Clear filters" button (same text style as the other
list-module empty states, e.g. `UserManagement`'s "No users yet."). Only when a
filter/search *is* active and yields zero rows does it show the fuller "No suppliers
found — Try different filters or search terms" panel with the **Clear filters** button.
The parent computes `hasActiveFilters` (`activeFilterCount > 0 || !!search`) and passes
it down as a prop rather than `ListView` re-deriving it.

**`TrackerStage` accepts a commodity in the URL** — `/tracker/stage/{stage}?commodity={name}`
seeds `commodityFilter` via `useSearchParams()` in the `useState` lazy initializer, so a
link that arrives from elsewhere (today: a Reports matrix cell) lands on the stage already
filtered. It is a *seed*, not a controlled binding: the dropdown and the **Clear** button
keep full ownership of the filter afterwards and the URL is never rewritten.

| Module | Search fields | Filters |
|---|---|---|
| `pages/tracker/TrackerStage` | name, folio, commodity, buyer, country | commodity (seedable from `?commodity=`, see below), **SLA status** (green/yellow/red, from `supplier.sla`), days-in-stage |
| `pages/suppliers/SuppliersList` | name, folio, commodity, productType, buyer, country | stage, **commodity** (new), country, buyer |
| `pages/events/EventsList` | name, location, organizer, topCountry | status (dropdown, unchanged) |
| `pages/tracker/TrackerBlacklisted` | name, folio, commodity, buyer | commodity, buyer |
| `pages/tracker/TrackerCompleted` | name, folio, commodity, buyer | commodity, buyer |
| `pages/tracker/MRLList` | partNumber, partDescription, buyerName, commodity | **commodity** (via shared `CatalogSelect`, options derived from loaded rows) |
| `pages/UserManagement` | name, email, role | **Role** and **Supervisor** (both derived from the loaded users; sortable columns too) |

## Column sorting — one shared hook

**`hooks/useTableSort.ts`** is the single implementation of the three-state sort cycle
used on every sortable table in the app — no screen keeps a private copy of it any
more. `SuppliersList`, `UserManagement`, `StrategyPage` (both the main table and its
drilldown supplier list), `TrackerCompleted`, `TrackerBlacklisted` and `MRLList` all
call it; the Reports "Suppliers per stage" matrix and the Events list (see below) do
too.

`useTableSort(rows, getValue)` takes the already-filtered rows and a
`(row, field) => value` accessor, and returns `{ sortField, sortDir, handleSort,
sortedRows }`:

- **The cycle** is a single arrow icon per column, never two shown/hidden at once:
  unsorted (grey `faArrowUp`) → click → ascending (black `faArrowUp`) → click →
  descending (black `faArrowDown`) → click → back to unsorted. Clicking a different
  column resets the previous one and starts the new one at ascending. The `sortIcon(field,
  sortField, sortDir)` helper returns the `{ icon, color }` pair for a header cell in one
  call, so every table's header renders the arrow the same way.
- **Comparison is type-aware**: strings compare case-insensitively via
  `localeCompare`, numbers compare numerically, and `Date` values (or anything a
  column passes as a `Date`, e.g. `new Date(supplier.completedDate)`) compare
  chronologically — never as strings. `null`/`undefined`/`''` always sort last, in
  **both** directions (this fixed a pre-existing bug in `TrackerCompleted`,
  `TrackerBlacklisted` and `MRLList`'s hand-rolled sorts, where `MRLList`'s missing
  `targetPrice` sorted *first* on ascending).
- **`sortedRows` is `rows` itself** (not a copy) while `sortField`/`sortDir` are
  `null` — the very state produced by three clicks on the same column — so every
  table's **default, unsorted order is preserved exactly** (`SuppliersList`'s API
  order, `EventsList`'s status-then-date grouping, the Reports matrix's alphabetical
  commodity order, etc.).

**Reports matrix** (`SuppliersPerStageMatrix` in `pages/Reports.tsx`) sorts by
clicking the **Commodity** header (alphabetical) or any **stage column header**
(by that stage's current-period count, `cell.to`) or **Total**; the field type is a
plain `string` rather than a fixed union because the stage columns are the runtime
`MATRIX_STAGES` list, not a static set of keys.

**Events list** (`pages/events/EventsList.tsx`) has no table — it is a card list — so
sorting is exposed as a row of **Sort by** chips (Name / Date / Suppliers) above the
cards, using the same hook, the same single-arrow icon, and the same three-state
cycle; the chips sort on top of the existing status-then-date default order rather
than replacing it.

Non-sortable columns (badge-only, e.g. `MRLList`'s Safety Critical; action columns,
e.g. every table's trailing view/edit button) pass `field: null` and render with the
default cursor and no arrow, same as before this hook existed.

## Prospects tab — Excel import, interest, B2B scheduling

SSD receives, from the event organizer, a list of the companies expected to attend
a scouting event (filtered by GSM to Direct suppliers only) and uploads it into the
app per event. These companies are **prospects, not suppliers** — they never touch
`T_Supplier` until they fill the external form on event day. The **Prospects** tab on
`pages/events/EventDetail.tsx` (between General Information and Event Suppliers,
badge-counted from `ScoutingEvent.prospectsRegistered`) is the UI over the backend's
`T_Event_Prospect` endpoints (`services/eventProspectsService.ts`, thin `apiGet`/
`apiPost`/`apiPatch`/`apiDelete` wrappers — see
[backend/README.md §2.0b](../backend/README.md) for the DTO and business rules this
mirrors exactly, `interestedById` included).

- **`pages/events/TabProspects.tsx`** — fetches `GET .../prospects` when the tab is
  first opened (mounted only while `activeTab === 'prospects'`, so it never fires on
  page load), and reports the fresh `meta.total` back to `EventDetail` so the tab
  badge stays live without a reload. Rows are grouped by `importBatchId` (newest
  import first, alphabetical within a batch), each group headed by its source file
  name and import date. A summary strip shows total / interested / unmarked / B2B
  scheduled plus the advisory `meta.interestDeadline`, and — only as a `#DC0202`
  warning label, never a disabled control — whether `meta.deadlinePassed`.
  - **Mark / unmark** follow the optimistic-update-with-rollback pattern
    `EventDetail`'s own `changeStatus` already uses, with one deliberate exception:
    a 409 from `markInterest` (someone else marked it first) or a 403 from
    `unmarkInterest` does **not** roll back silently — it toasts and refetches, so
    the user sees who actually got there first instead of just watching their click
    revert. The unmark control checks `prospect.interestedById === currentUser.id`
    and is **hidden**, not disabled, for everyone else. Marking itself has no role
    gate beyond being logged in (`PROSPECT_INTEREST_ROLES` = SSD/PM/Buyer/SQD).
  - **Import Excel** (opens `ProspectImportModal` below) is gated on
    `usePermissions().canWrite`, i.e. **SSD only** — the backend's `write` route
    guard for `POST .../prospects/import` is `OPERATIONAL_WRITE_ROLES` (also
    SSD-only), so the button can't offer an action the API would 403.
  - **B2B scheduling** (inline `datetime-local` + location text, via `setProspectB2b`)
    and **Remove this import** (`deleteImportBatch`, behind a `ConfirmDialog` naming
    the file and row count) both render only for `role === 'SSD'`, matching the
    backend's `b2bOnly` guard on both routes; every other role sees the read-only
    value or `'—'`.
- **`pages/events/ProspectImportModal.tsx`** — three steps, and nothing is sent
  before the user confirms a preview: **Pick** (template download + file input) →
  **Preview** (mandatory — counts of importable/errored/duplicate rows, a scrollable
  table of the valid rows, a collapsed-by-default rejected-rows list with source row
  + reason, and a note that existing companies are updated in place with their
  interest/B2B decisions preserved; "Import N prospects" is disabled at 0 valid rows)
  → **Result** (created/updated/skipped, then closes and triggers `TabProspects` to
  refetch). A parse-level throw (bad header, >500 rows) is shown inline and keeps the
  user on the Pick step.

The template/parser utilities below are unchanged by this UI — the modal is a thin
caller of both, converted straight to the `POST .../prospects/import` body (`rows:
[{companyName, productType, website}]`, dropping the client-only `sourceRow`).

- **`utils/prospectTemplate.ts`** — `PROSPECT_COLUMNS` (`companyName` required,
  `productType`/`website` optional, each with its header text, `maxLength` and
  alias list) is the **single source of truth**, shared with the parser below so
  the two can never drift. `downloadProspectTemplate(eventName?)` is `async` —
  it `await import('xlsx')`s the library on first call, builds the workbook
  **in memory** with it, and triggers a browser download — the template is
  deliberately **not** a binary file committed to the repo, since a checked-in
  copy would silently go stale. Sheet 1 "Prospects" carries only the three
  headers (no example row, which would otherwise import as a real prospect);
  Sheet 2 "Instructions" carries a marker (`TEMPLATE_MARKER`), plain-text
  guidance and a field reference table.
- **`utils/parseProspectWorkbook.ts`** — a **tolerant** parser: the template above
  is a convenience, not a contract, so a file the organizer builds from scratch
  must still import. Split in two so the core logic is testable without a `File`:
  - `mapProspectRows(cells: unknown[][])` — **pure**, no `xlsx` import at all, not
    even a dynamic one. Scans the
    first 10 rows for the header (tolerates a title/logo row above the table),
    matches columns **by normalized header name** (uppercase, accent/punctuation-
    stripped, whitespace-collapsed) so reordered or renamed-but-aliased columns
    and unknown extra columns don't break the import, coerces every cell to a
    trimmed string (a numeric or date cell never becomes `"[object Object]"` or a
    raw serial number), skips fully blank rows silently, and reports per-row
    problems without throwing: an empty company name or an over-`maxLength` value
    goes to `errors`, an in-file repeat (case/whitespace-insensitive, first
    occurrence wins) goes to `duplicates`. Throws only for a structural problem —
    no header row found, or more than `MAX_PROSPECT_ROWS` (500) data rows.
  - `parseProspectWorkbook(file: File)` — thin wrapper that `await import('xlsx')`s
    the library, reads the file's **first sheet regardless of its name**, and
    hands the raw grid to `mapProspectRows`.
  - No test runner is configured in `frontend/` (no vitest/jest, no `test` script
    in `package.json`), so the spec'd `mapProspectRows` unit tests were not added —
    the pure/impure split above keeps them easy to add once a runner exists.

## Real dates on Home & Visuals

`utils/date-helpers.ts` → **`relativeLabel(dateStr)`** is the frontend twin of the
backend notification helper (own English wording: Today / Yesterday / N days ago / `DD
MMM`, and **`Recently`** when the date is missing/unparseable — it never invents one).
`pages/Inicio.tsx` uses it for the Recent Activity feed, driven by each object's real
server date (`stageEnteredAt` for tracker rows, `completedDate`, `rejectionDate`); the
header date is now `new Date()` (was hardcoded). `pages/Dashboard.tsx` builds
`monthlyData` by grouping suppliers by `onboardingDate` month over the **last 6 real
months** (was 5 hardcoded values). `ManagedUser` gains `supervisorName: string | null`.

## Charts on Visuals — Chart.js, registered piece by piece

`pages/Dashboard.tsx` is the **only** file in the app that draws charts, and it draws
them with **Chart.js 4** through **`react-chartjs-2`**. It previously used Recharts,
whose v3 core (`CategoricalChart`) loads whole regardless of how many chart families a
page actually renders — the `/visuals` chunk was **427 kB (123 kB gzip)** for four
families. The same six sections on Chart.js build to **205 kB (69 kB gzip)**.

That saving only holds if the registration stays explicit. **Never import
`chart.js/auto`** — it registers every controller, scale and plugin and puts the whole
library back in the chunk. The file registers exactly what it draws:

```ts
ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement,
  Filler, Tooltip, Legend,
);
```

Adding a chart family means adding *its* element/controller to that list, nothing more.

Translation notes for anyone editing these charts:

- `<ResponsiveContainer width height>` has no equivalent — each chart sits in a plain
  `<div>` with the height it used to be given (260 / 220 / 180 px) and runs with
  `responsive: true, maintainAspectRatio: false`.
- A horizontal bar chart is `indexAxis: 'y'`, not a `layout` prop.
- **Per-datum colours** (stage colours, commodity colours) are a `backgroundColor`
  **array** on the dataset — `data.map(d => d.color)` — not one element per slice.
  `buildDashboardData()` still computes those colours; the render only maps them.
- Grid lines are dashed via **`scales.<axis>.border.dash`**, not `grid` — in Chart.js v4
  `grid` carries only their colour. `GRID_LINE` / `GRID_HIDDEN` / `GRID_DASH` at the top
  of the file are the shared pieces.
- The donut's centre total is an **absolutely-positioned HTML overlay**, because the
  chart is a canvas and can't hold text nodes the way an SVG could. It is
  `pointerEvents: none` so the slice tooltips still work.
- Tooltips come from the registered `Tooltip` plugin with default styling; only the
  "Conversion rate per event" chart shows a `Legend` (bottom, 11px), matching its
  two-series layout.

**Rendering bugs surfaced in manual verification after the migration, all fixed
in place:**

- **No curve smoothing on the two Line datasets** ("Suppliers by Stage" → Line,
  "Suppliers onboarded per month" → Line/Area). They used to set
  `cubicInterpolationMode: 'monotone'`, which visually rounds off each peak/valley
  into a curve — mathematically bounded by the surrounding data points, but a rounded
  peak can *read* as exceeding the real value even when it doesn't, which is what got
  reported as an "overshoot." Chart.js's `tension` option is **not** the knob to
  reach for here: once `cubicInterpolationMode: 'monotone'` is set, Chart.js's line
  element only ever consults `tension` on the *other* spline branch (plain Catmull-Rom
  smoothing), so `tension: 0` next to `monotone` is a silent no-op — confirmed by
  rendering both configurations and diffing the output pixel-for-pixel (identical).
  The fix is simpler than either: drop `cubicInterpolationMode` entirely. With no
  tension set either (`0` is Chart.js v4's own default), the line element takes its
  straight-segment fast path — connecting the real points with no interpolation, which
  by construction can never draw above the higher (or below the lower) of any two
  consecutive values.
- **A chart draws blurry and can spill past its card after a browser zoom**
  (Ctrl +/-). The root cause is *not* the resize trigger — **`chart.resize()` alone
  cannot fix it**, which is worth knowing before touching this code.
  `Chart#_resize` computes its ratio as
  `options.devicePixelRatio || platform.getDevicePixelRatio()`. `devicePixelRatio`
  defaults to a **scriptable** returning the live ratio, but Chart.js resolves
  scriptables once and **caches** the result — so `options.devicePixelRatio` is frozen
  at whatever the ratio was when the chart was *constructed*. Being a truthy number it
  then shadows the live platform getter permanently: `retinaScale()` is handed the
  stale ratio, sees the canvas already matches it, returns `false`, and `_resize`
  bails before re-rendering. The canvas keeps the previous zoom's pixel size.

  So the fix refreshes that cached option *before* resizing — `chart.options
  .devicePixelRatio = window.devicePixelRatio`, then `chart.resize()` (both in
  `syncChartsToDpr`). Assigning a concrete number also makes this the single source of
  truth for DPR: the stale-cache path that caused the bug can no longer be consulted.
  The Dashboard keeps one `ChartLike` ref per chart *position* (`chartRefs`, six slots —
  a toggle group's alternates, e.g. Chart A's Bar vs Line, never mount at once, so they
  share a slot).

  **The assignment is durable.** Chart.js's options proxy writes *through* to
  `config.options` (the resolver's `set` trap targets `scopes[0]`), and `Chart#update()`
  rebuilds its resolver from those same scopes — so a later data or options update
  cannot restore the scriptable default. This matters because `react-chartjs-2` calls
  `chart.update()` on **every** re-render here (the `options` object literals are rebuilt
  each render, so their identity always changes). Verified against the shipped
  chart.js 4.5.1 by driving `_createResolver`/`_attachContext` directly: an assigned
  `1.25` still reads back as `1.25` after a resolver rebuild whose scriptable would have
  returned `1`.

  **Two triggers, one for each half of the problem — a *changed* ratio and a *wrong
  initial* one.**

  - *Changed.* `matchMedia('(resolution: Ndppx)')`, re-armed after each change, because
    it reports exactly when the ratio leaves N — and, unlike `resize`, it fires
    *because* the ratio already changed, so the new value is guaranteed readable when it
    runs. A `window.resize` listener is kept next to it since a real zoom also relayouts
    the viewport and not every browser fires both. That is **not** a double resize:
    `syncDevicePixelRatio` returns early unless the ratio actually changed (the same
    guard Chart.js uses internally), so whichever trigger arrives second does no work.
  - *Wrong initial.* Change detection alone left a hole big enough to make the charts
    look blurry at **every** zoom level, not just after changing one: the effect above
    runs a single time, on mount, when `chartRefs.current` is still **empty** — the whole
    chart tree sits behind the page's `loading` gate — so nothing ever asserted the ratio
    a chart was actually *born* with. A chart that resolved a stale ratio at construction
    (page opened with the zoom already at 110%, canvas measured before layout settled)
    stayed blurry forever, because there was no change left to detect, only a wrong
    initial state. The missing assertion now lives in the **`chartRef(idx)` callback**:
    `react-chartjs-2` invokes the forwarded ref from inside its own `renderChart`,
    immediately after `new Chart(…)` returns, so it fires on every path that constructs
    an instance (first mount, a type toggle rebuilding a slot, the `animKey` remount) and
    on no other render — it is a manual call, not a React-managed DOM ref, so a fresh
    closure per render causes no spurious re-attachment.

  The two paths share **`appliedDpr`** (a ref), which records the ratio the charts are
  currently pinned to. Don't replace it with a local captured inside the effect: a mount
  that happened at a different ratio would leave the guard's baseline behind, and zooming
  *back* to that stale baseline would then be dismissed as "no change". For the same
  reason the ref callback re-pins **all** slots, not just the one that mounted.

  Verified by driving a real Chromium through `deviceScaleFactor` 1→2→1→3→1 with the
  shipped handler: plain `resize()` leaves `canvas.width` at the old value every time,
  the option-refresh variant tracks the ratio on all three chart families, and three
  extra handler calls at an unchanged ratio perform zero additional resizes. Note that
  CDP's `deviceScaleFactor` override is *not* a faithful zoom simulation (it changes
  the value without reliably updating it before the events fire), so the trigger
  itself still wants a human on Ctrl +/-.

- **Cards spilling past the right edge of the screen** ("Distribution by Commodity",
  "Geographic Distribution", "Conversion rate per event"), while the rest of the page
  compressed normally. A flex item — and a `1fr` grid track, which is `minmax(auto, 1fr)`
  — defaults to **`min-width: auto`**: it refuses to shrink below its content's
  min-content width. A Chart.js canvas contributes its *current* pixel width to that
  figure (Chart.js writes an explicit `style.width` in px in `retinaScale`), so a card
  holding one can never give width back once it has grown, and neither can a legend
  column whose min-content width is its longest commodity name.

  **Every card and every inner column in `Dashboard.tsx` therefore carries
  `minWidth: 0`** — not only the three that were reported, since the pattern repeats
  across all six sections. Removing the floor lets the card follow its flex basis, and
  Chart.js's own `ResizeObserver` shrinks the canvas immediately after. Note that
  `minWidth: 0` is also what *activates* the existing ellipsis on the commodity legend
  (`whiteSpace: nowrap; overflow: hidden; textOverflow: ellipsis` on the name span): that
  truncation was already written, but could never take effect while the column's parent
  was pinned to its content width. **Adding a new card here means adding `minWidth: 0`
  with it.** The KPI row is the one exception that doesn't need it — its four cards hold
  short text, no canvas.

- **"Suppliers onboarded per month" had a hardcoded `max: 15`** on the Y axis of *both*
  its branches (Bar and Line/Area), so the axis ignored the data: real monthly counts
  sat flattened against the bottom of the plot, and anything above 15 would have been
  clipped outright. The `max` is gone — Chart.js sizes the ceiling from the real peak of
  `monthlyData`, the same as every other chart on the page. **`min: 0` stays**:
  onboardings are never negative, and without it Chart.js lifts the floor off zero and
  exaggerates small month-to-month differences.

## CSV export on Visuals

`pages/Dashboard.tsx`'s 7 export controls (the header "Export report" button plus one
`DownloadBtn` per chart) used to just show a fake success toast without producing a
file. They now download real CSVs via **`utils/exportCsv.ts`**:

- **`downloadCsv(filename, rows)`** — one dataset → one CSV, via Blob + a temporary
  `<a download>` link (no new dependency). Returns `false` (no download) when `rows`
  is empty.
- **`downloadMultiSectionCsv(filename, sections)`** — several labeled datasets → one
  CSV file, each section marked by a `# Title` line. Used by "Export report" to bundle
  all chart datasets (stage, commodity, monthly trend, geography, events, conversion,
  buyer summary) without inventing an aggregation the dashboard doesn't already compute.
- **`todayStamp()`** — `YYYY-MM-DD` for filenames, e.g.
  `ssd-visuals-commodity-breakdown-2026-08-14.csv`.

Each `DownloadBtn` exports exactly the array already feeding its chart (e.g. `stageData`
or `monthlyData` depending on which chart-type toggle is active) — nothing is
recomputed or re-fetched. A button disables itself (dimmed, with a `title` tooltip)
when its dataset has no data to export, instead of downloading an empty file. The
success toast now names the real file: `Downloaded {filename}`.

## Reports module

`pages/Reports.tsx` (route `/reports`, nav entry between **Strategy** and
**Visuals**) is the weekly pipeline report GSM asked for: how many suppliers were in
each stage a week ago vs now, per commodity, plus the movements and notes that
explain the change. It is **read-only** (no write controls; SQD can view it, so it is
mounted under the same `OPERATIONAL` gate as the other modules), and it has **no
charts** — visualizations live in the Visuals module, not here.

- **`services/reportsService.ts`** — `getWeeklyReport(from, to, commodityId?)` and
  `getLatestWeeklyReport(commodityId?)`, with types mirroring
  [backend/README.md §2.2](../backend/README.md) exactly. `StageSnapshotRow`
  also carries **`levelCounts`** (the Intelex Handoff sub-level breakdown, `null` for
  other stages), which the matrix now renders under the Intelex Handoff counts — the
  backend derives those levels **as of the snapshot date**, so a past report shows
  where suppliers were then, not their level today. The `commodityId` parameter is still
  part of the service and the API, but **the Reports screen no longer calls it** (see
  below) — the report is always fetched for all commodities. The backend
  `GET /reports/commodities` endpoint (and its `getReportCommodities()` frontend
  wrapper) is no longer used by any screen; the endpoint is left in place, the frontend
  wrapper has been removed.
- **Date range** — two native `<input type="date">` pickers (the repo's established
  date-input pattern — used by `EventFormModal` and the prefill modals; **react-day-picker
  is not a dependency of this project**) plus a **Last 7 days** button that calls
  `getLatestWeeklyReport()`. `from > to` is rejected client-side (toast) and by the
  backend (400). There is **no commodity dropdown**: commodities are the rows of the
  matrix, so filtering the whole report down to one of them is no longer how the screen
  is used.
- **Tabs** — the three sections are tabs, not a stacked page, and only the active one
  renders: **Suppliers per stage** (default), **Stage movements**, **Notes written**.
  Tab styling is 13px/600, `#808285` inactive → `#DC0202` with a 2px `#DC0202` bottom
  border when active (transparent border otherwise), on a `#E0E0E0` baseline.

**Suppliers per stage — the commodity × stage matrix.** This mirrors the Excel matrix
the GSM team already keeps: one **row per commodity** (every commodity present in either
snapshot, sorted alphabetically), one **column per working stage** in the canonical
`TRACKER_STAGE_CONFIG` order (Scouting Event → Intelex Handoff; `TERMINAL_STAGE_CONFIG`
— Completed and Blacklisted — is excluded, they are exits from the board rather than
columns on it), plus a **Total** column and a bold **Total** row separated by a top
border.

- Each cell shows the count as of the report's **to** date (`snapshotTo`) with the change
  versus the **from** date (`snapshotFrom`) beside it: `+n` in `#6ABF4B`, `-n` in
  `#DC0202`, and **nothing at all** when the delta is zero. Both snapshots are folded
  into one `commodity::stage → { from, to, levelCounts }` map, so every cell carries its
  own delta.
- **Intelex Handoff cells additionally show the sub-level split** under the count, as a
  compact `Inv 3 · L0 2 · L4 1` line in the stage colour (`INTELEX_LEVEL_COLOR`), in
  sequence order and skipping empty levels so the column stays narrow (the full list is
  the cell's `title`). The Intelex **column total** sums the same breakdown across
  commodities; row totals and the grand total mix five stages, so they carry none. Every
  other stage's `levelCounts` is `null` and the line is simply not rendered — nothing in
  the matrix branches on the stage name beyond that.
- A cell with a **count > 0** is clickable (pointer cursor, `#EFEFEF` hover) and
  navigates to `/tracker/stage/{stage}?commodity={commodity}` — that stage's tracker view
  already filtered to the row's commodity. Zero-count cells are inert.
- A cell with a **non-zero delta** shows a hover panel listing the movements behind it
  (every `report.movements` entry for that commodity where the stage is the origin *or*
  the destination), each line naming the supplier, the date and the `From → To` badges.
  It is a real positioned panel, not a `title` attribute: `position: fixed` (so the
  table's `overflow-x` wrapper cannot clip it), clamped horizontally to the viewport and
  flipped above the cell when there is no room below, white/radius 8/`0 8px 24px
  rgba(0,0,0,0.20)`/12px padding, max 240px tall with internal scroll. A ~140ms hide
  delay lets the pointer travel onto the panel to scroll it.

**Stage movements and Notes written — day-grouped rows.** Both were a flat stack of one
card per entry; they are now **grouped by day** (`groupByDay`, preserving the ascending
order the API returns) with a 12px/700 `#808285` uppercase day heading over **one white
card per day**. Inside the card each entry is a compact row — supplier 14px/700,
commodity 12px `#808285`, the `From → To` badges (movements) or the single stage badge
(notes), the author right-aligned, and the **full untruncated** text below in 13px
`pre-wrap` — separated by a 1px `#E0E0E0` rule with a `#FAFAFA` row hover. Notes also show
the exact time (`"2:45 PM"`, from `createdAt`); movements do not, because the wire only
carries a day for them. Each tab keeps its own `EmptyState`, and a `LoadingState` covers
the initial/loading fetch.
