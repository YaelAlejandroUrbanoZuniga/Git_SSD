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
├── components/   # shared UI (Sidebar, GlobalHeader, NotesSidePanel, SearchBar, LoadingState, …)
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
  server. `isUserFixable` is true for 400/409/422. **`requestId`** carries the
  backend correlation code, sent on **500s only** (see below).

Services **throw**; components decide how to surface it. The convention:
`toast.systemError(err.message)` for anything unexpected,
`toast.validationError(...)` when the backend rejected what the user just typed.

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

`pages/events/EventDetail.tsx`'s **Edit** button (header area) is gated narrower than the
table above: `role === 'SSD'` directly via `usePermissions()`, not the coarser `canWrite`
(PM/Buyer can view events but not edit them). `EventFormModal.tsx` now serves both create and
edit — pass an `event` prop to open it pre-filled in edit mode, saving through
`eventsService.updateEvent`.

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
- **The field bindings did not change.** Visit still reads and writes
  `prelim_visitDatePlanned`, `prelim_visitDateCompleted`,
  `prelim_visitParticipants`, `prelim_strengths`, `prelim_weaknesses`,
  `prelim_observations`, `prelim_recommendations` — those columns stayed in
  `PreliminaryData` on purpose (see [backend/README.md](../backend/README.md)), so
  a supplier whose visit was reported before this change shows the same data under
  the new tab. Only the completion flag moved: `visit` is now a key of
  `supplierEvalTabsCompleted`, not of `preliminaryTabsCompleted`.
- `utils/tracker-helpers.ts` follows the new grouping in its per-stage field
  lists: the Visit fields count towards **Supplier Evaluation**'s completion
  percentage, not Preliminary's (see "Information completeness" below).
- `CompletedSupplierDetail` (the read-only full-history view) shows Visit as a
  third sub-tab under **Supplier Eval** rather than under **Preliminary**.

**Fundamentals gained a "Cost Model" Y/N select**, right after *SDA signed*, using
the same `ynSelect` helper and grid as the other document fields. It maps to
`prelim_costModel` and is **optional** — like TC&Cs / TTC&Cs / NSR / SDA it is not
required to save the tab, and it is **not** part of the gate that sets
`selectedForDevelopment` (still RFQ = Y && NDA = Y). `TabROSEFundamentals` renders
it read-only in the same position.

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

**Commodity is not defined in Scouting Event.** In Form A the Product section leads
with a free-text **"Type of Products"** field (the primary field — what the supplier
makes), and the **Commodity selector is optional**: leaving it blank sends the
`PENDING_GSM_COMMODITY` placeholder (`'TBD -- Pending GSM'`), because GSM assigns the
real commodity later. That happens at **Parking Lot**, where `ParkingLotPrefillModal`
makes commodity **required** and refuses to save while it is still the placeholder —
forcing a real value before the supplier leaves Scouting Event. Form B (Internal
Recommendation) goes straight to Parking Lot, so its commodity stays required from the
start.

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
writes (null except for a few demo rows with hand-written values). That fallback is
gone; the field is dead on the read path, the same way the old dual "Timeliness"
indicator was retired in favour of one value. `ParkingLotPrefillModal` still sends
it on create, which is harmless but equally pointless — it can go when the column
is dropped.

⚠️ **While the services are still mocks, the rendered colour is only as fresh as
`src/data/pipeline-demo.ts`.** The demo rows carry hand-written `sla` values that no
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
from the **read-only tab components** in `pages/tracker/TrackerSupplierDetail.tsx`
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
a fixed, full-viewport overlay instead of an inline block.

```tsx
<LoadingState entity="Suppliers" icon={faBuilding} />
<LoadingState message="Loading report…" icon={faChartColumn} fullScreen />
```

Each screen passes the icon for its own module (Home → `faHouse`, Reports →
`faChartColumn`, Users → `faUsers`, Suppliers → `faBuilding`, Events →
`faCalendarDays`, Tracker → `faColumns`, Strategy → `faBullseye`, Visuals →
`faChartLine`). The optional `style` merges over the container, for callers that need
the block centred inside a card/table cell or a taller full-page block.

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
`category` (the domain event). The panel styles rows off the **category**, because four of
the five events are `info` and severity alone drew the same icon for all of them:

| `category` | icon | colour |
|---|---|---|
| `blacklisted` | `faBan` | `#000000` |
| `event_created` | `faCalendarPlus` | `#02B3E1` |
| `event_updated` | `faCalendarCheck` | `#02B3E1` |
| `supplier_created` | `faBuilding` | `#6ABF4B` |
| `stage_advanced` | `faArrowRight` | `#0084C0` |

`styleFor(n)` is the single mapping: category first, **severity as the fallback** when the
category is `null` or unknown — every notification stored before the column existed still
renders, just with the old generic icon. The colour drives both the 3px left bar and the
tinted circular badge (`colour + 1F`); a **read** row is muted to `#9CA3AF` but keeps its
category icon, so it stays identifiable after being read.

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

- **`services/reportsService.ts`** — `getWeeklyReport(from, to, commodityId?)` and
  `getLatestWeeklyReport(commodityId?)`, with types mirroring
  [backend/README.md §2.2](../backend/README.md) exactly. `StageSnapshotRow`
  also carries **`levelCounts`** (the Intelex Handoff L0…L4 breakdown, `null` for other
  stages) — the type is kept in sync with the wire, but nothing on the screen displays
  it; the matrix reads `count` (the stage total). The `commodityId` parameter is still
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
  into one `commodity::stage → { from, to }` map, so every cell carries its own delta.
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
