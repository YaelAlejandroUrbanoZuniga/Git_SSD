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
├── context/      # React context providers (e.g. RoleContext)
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
The Bearer token belongs in `apiFetch` and nowhere else once login exists
(today the backend runs `AUTH_OPTIONAL=true`, so no token is sent).

### `src/data/*.ts` is legacy — no page reads it any more

Every page and component now reads and writes through `src/services/*.ts`; **no
file outside `src/services/` imports `src/data/*.ts`**. The demo datasets are
kept only because `prisma/seed.ts` imports them to populate the database.

`TrackerSupplierDetail.tsx` — the supplier detail screen — writes through the API
too: its tab saves go through a `saveSupplier(supplier, apply)` helper that clones
the record, applies the mutation, and `PATCH`es only the changed fields (a
denylist drops `stage`/`entrySource`/`prelim_hasIMMEX`, which PATCH can't accept);
stage moves, blacklist, complete and promote-to-B2B call the `tracker` endpoints;
notes call the notes endpoints. After each write the screen adopts the fresh
record the API returns (`applyFresh`) instead of re-reading a local array.

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

Registration is **two requests** (`suppliersService.registerSupplier`): `POST
/api/suppliers` takes the fixed 17-field schema and sets `entrySource`; the
extended profile goes through `PATCH /api/suppliers/:id` to its satellite tables.

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
