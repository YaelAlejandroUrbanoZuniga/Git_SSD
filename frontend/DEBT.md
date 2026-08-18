# Technical debt register — frontend

Deliberate shortcuts and unresolved product decisions in `frontend/` that must
not be forgotten before the system is promoted to production. Each entry records
why the shortcut was taken (or why the decision is still open), what resolving it
actually requires, and the trigger that should prompt the resolution — so the
reasoning survives even after the people who made the call have moved on.

Mirrors the format of [backend/DEBT.md](../backend/DEBT.md). Where an item has a
backend half, the two are cross-referenced rather than duplicated.

---

## 1. `AdobeStock_238352480.jpeg` ships at stock-library resolution (2.5 MB)

**Incurred:** predates the audit
**Recorded here:** 2026-08-18 (from `AUDITORIA_FRONTEND_FASE2B.md` §1.7.2)
**Trigger to resolve:** before the first production deployment, or the first
complaint about login being slow on the plant network.

### What happened

`frontend/public/assets/images/AdobeStock_238352480.jpeg` is the background of
the login screen (`pages/Login.tsx`). It is used, so it must not be deleted — but
it is still at the resolution it was downloaded at, 2.5 MB.

Its 8.9 MB companion, `login-background.jpg`, **was** deleted (2026-08-18): it
was the background of an earlier design and `grep -rn "login-background" src
index.html` returned zero results. Vite copies `public/` wholesale and verbatim
into `dist/`, referenced or not, so those 8.9 MB were shipped on every deploy for
nothing.

### Why it is debt, not a permanent decision

This image is the **first** thing every user downloads, before authenticating,
on the one screen that must work when everything else is unknown — and it is
painted over with an 80 %-opacity red tint (`Login.tsx`, the `BRAND_COLORS.header`
overlay) that hides almost all of the detail justifying the file size. `public/`
was 11.5 MB, of which 11.4 MB was these two images alone; deleting the unused one
took it to ~2.6 MB, and this entry is what remains of that.

### Resolution required

1. Re-export at the size the layout actually uses (the left panel is ~53 % of the
   viewport width; ~1600 px wide is generous), and as WebP with a JPEG fallback
   if the target browsers allow it.
2. Verify the tinted result is visually identical — given the overlay, it will be.
3. Not done in the Fase 3.A pass on purpose: image re-encoding is not a code
   change and wants a designer's eye on the result.

---

## 2. `VITE_API_URL` silently falls back to localhost instead of failing the build

**Incurred:** predates the audit
**Recorded here:** 2026-08-18 (from `AUDITORIA_FRONTEND_FASE2B.md` §2.1.1, severity **Alta**)
**Trigger to resolve:** before the first production build is cut by anyone other
than the developer who set the machine up.

### What happened

`services/api.config.ts` reads:

```ts
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
```

Vite resolves `import.meta.env` **at build time**. If `VITE_API_URL` is absent
when `npm run build` runs, the bundle ships with `http://localhost:3000/api`
compiled in, and **every user's browser calls its own machine**. The build does
not fail and prints no warning. What the user sees is the `status === 0` message
— *"Could not reach the server at …"* — on every screen, naming an address that
has nothing to do with the server.

Separately, `??` only covers `null`/`undefined`: an empty `VITE_API_URL=` survives
as `''`, and every request goes out relative to the origin serving the app.

### What was done in Fase 3.A, and what was not

`frontend/.env.example` now documents all three behaviours explicitly — build-time
resolution, the silent localhost fallback, and the empty-string case. **The runtime
behaviour in `api.config.ts` was deliberately not changed.**

### Why it is debt, not a permanent decision

Whether a missing env var should hard-fail the build is a product/deployment
decision, not a bug fix. Making it throw is the safer default for production but
would break any workflow that relies on the localhost default for local
development, and it is the deployment owner's call which of those matters more.

### Resolution required

Pick one and apply it:

1. **Fail loudly** — throw at module load when `import.meta.env.VITE_API_URL` is
   `undefined` *or* empty and `import.meta.env.PROD` is true. Local dev keeps the
   fallback, production builds cannot ship broken. (Recommended.)
2. **Fail at build time** — validate in `vite.config.ts` and abort the build.
   Strictest; also blocks the reverse-proxy same-origin deployment, which needs
   the empty value to be legal.
3. **Accept it** and rely on the runbook. Only defensible if a deployment
   checklist enforces the variable.

---

## 3. `index.html` declares `lang="es"` while the entire UI is in English

**Incurred:** predates the audit
**Recorded here:** 2026-08-18 (from `AUDITORIA_FRONTEND_FASE2B.md` §1.5.2)
**Trigger to resolve:** whenever SSD/GSM confirm which language the application
is meant to be in.

### What happened

`frontend/index.html` opens with `<html lang="es">`, but every string the user
reads is in English. The two Spanish leaks that *were* in the code have been
fixed (2026-08-18): `Login.tsx`'s `'Correo o contraseña incorrectos.'` is now
English, and `HomeGuestView`'s Spanish `MONTHS_SHORT` (`ENE`, `FEB`, …) now
imports the English array from `utils/date-helpers.ts`, which every other role's
Home already used — the Guest home and everyone else's disagreed on month names.

### Why the attribute was left alone

Changing `lang` is not a bug fix, it is the visible half of a product decision:
either the app is English (and `lang="en"` is a one-character change), or it is
meant to be Spanish (and the whole UI, not the attribute, is what is wrong). The
Fase 3.A pass had no mandate to decide which.

The attribute is not cosmetic — screen readers pick pronunciation from it, and
browsers offer to translate pages based on it, so today a Spanish-speaking
screen-reader user hears English text read with Spanish phonetics.

### Resolution required

1. Confirm with SSD/GSM whether the application is English-only, Spanish-only, or
   needs real localisation.
2. If English (the current de-facto state): set `lang="en"`. One line.
3. If Spanish or bilingual: that is a localisation project, not a fix — the 80+
   files under `src/` carry their strings inline, with no i18n layer.

---

## 4. Prefill-advance flows are not atomic (two requests, no transaction)

**Incurred:** predates the audit
**Recorded here:** 2026-08-18 (from `AUDITORIA_FRONTEND_FASE2B.md` §2.5.1)
**Trigger to resolve:** the first report of a supplier that changed stage with
none of the data the user entered in the modal, or any backend work that touches
`POST /tracker/suppliers/:id/move`.
**Backend half:** `backend/AUDITORIA_BACKEND_FASE2A.md` §2.5.4 (create supplier +
link to event across two transactions) — the same shape from the other side.

### What happened

`TrackerSupplierDetail.advanceWithPrefill` — the shared implementation behind the
Parking Lot and Preliminary Evaluation prefill modals — performs a stage advance
as **two independent requests**:

```
POST  /tracker/suppliers/:id/move     ← the stage change
PATCH /suppliers/:id                  ← the fields collected by the modal
```

They hit different endpoints and either can fail alone. If the `PATCH` fails, the
supplier has **already changed stage** and none of the information the user just
reviewed was saved.

### What was fixed in Fase 3.A

The split remains; the damage it did silently does not:

- The `PATCH` now diffs against **`moved`** — the record the server returned from
  the move — instead of the pre-move `supplier` snapshot. `buildSupplierPatch`
  was comparing against a record that was already stale, so the patch re-sent
  fields the move had just changed.
- The failure is now **attributed to the step that actually failed**. A `PATCH`
  that failed after a successful move used to raise *"The supplier could not be
  moved"* — the opposite of what happened — leaving the user unaware that the
  stage really had changed while their form input was lost. It now raises a
  warning naming both facts and telling them where to re-enter the data.
- The two copies of this flow (one named function, one inline in the JSX, with
  identical defects) were collapsed into the single `advanceWithPrefill`.

### Why full atomicity was not done here

It cannot be fixed in the frontend. Making the advance atomic requires a **single
backend endpoint** that performs the move and the field write in one transaction
— and backend changes were explicitly out of scope for the Fase 3.A frontend
pass.

### Resolution required

1. Add an endpoint (or extend `POST /tracker/suppliers/:id/move`) that accepts
   the prefill field payload alongside `newStage` and `note`, and applies both
   inside one Prisma transaction.
2. Reuse the existing stage-gate logic (`hasExternalFormData`) rather than
   re-implementing it — the gate must run *before* either write commits.
3. Collapse `advanceWithPrefill` to a single `await` against the new endpoint and
   delete the partial-failure warning path, which will no longer be reachable.

---

## 5. `TrackerSupplierDetail.tsx` (~3,061 lines, 110 KB / 24 KB gzip chunk) — investigated, no clean split point found

**Incurred:** predates the audit
**Recorded here:** 2026-08-18 (from `AUDITORIA_FRONTEND_FASE2B.md` §2.7.2, investigated
during the Fase 3.A follow-up once the `TabRO*`/`TabCompletedOverview` relocation
had already cut this chunk from the ~127 KB it added to `BlacklistedSupplierDetail`/
`CompletedSupplierDetail` down to a standalone ~110 KB)
**Trigger to resolve:** only if this file grows meaningfully past its current size,
or if a future stage gains a genuinely heavy dependency (a chart library, a rich
text editor) that today's small tab bodies don't have.

### What was considered

`SupplierDetailBody` (`:1988`–`:2862`, ~875 lines) picks which tab component to
render from `activeTab` state, itself derived from the supplier's **current
pipeline stage** (`:2076`–`:2116`) — not from a URL sub-route. Every one of the
17 `Tab*` components in this file (`TabGeneral`, `TabScoutingEvent`,
`TabParkingOverview`, `TabPrelimOverview`, `TabSECompetitiveness`,
`TabIntelexRecord`, …) is therefore reachable as the **first** thing rendered,
depending only on which stage the linked supplier happens to be in — there is no
"only reached from a specific tab click" sub-view the way the prompt's hypothesis
(a `supplier-forms/`-style heavy import chain) assumed. `supplier-forms/` itself
is barely present here: the only import from it is `isValidEmail`, a few lines
from `payload.ts`.

Two ways to split were weighed and rejected:

1. **`React.lazy()` per stage-group of tabs** (e.g. one chunk for the five
   Scouting tabs, one for the three Parking Lot tabs, etc.). Rejected: every tab
   component closes over module-private helpers defined earlier in the same file
   and never exported — `FormSaveBar`, `catalogSelect`, `codeSelect`,
   `ScoutingField`, `scoutingInput`, `prelimNumInput`, `ParkingCard`,
   `IntelexEffBar`, plus the completion-marking helpers (`markPrelimComplete`,
   `markSupplierEvalComplete`, `markIntelexComplete`). Splitting the tabs apart
   without first extracting all of these into a shared module would either
   duplicate them per split or force a large mechanical refactor un-related to
   the goal — exactly the "artificial split that fragments related logic
   awkwardly" the prompt warned against.
2. **Route-level splitting**, mirroring how `TabRO*` moved out to
   `read-only-tabs.tsx`. Rejected: that split worked because the `TabRO*`
   components have a **second real consumer** (`BlacklistedSupplierDetail`,
   `CompletedSupplierDetail`) reachable by an entirely different route, which is
   what let Rollup give them their own chunk. The editable `Tab*` components here
   have exactly one consumer, `SupplierDetailBody`, on exactly one route
   (`/tracker/:id`); there is no second entry point to hang a route-level split
   off of.

### Why it is not urgent

At 110 KB (24.4 KB gzip) post-relocation, this chunk is already roughly half of
`Dashboard`'s 205 KB (which legitimately carries Chart.js) and nowhere near the
461 KB `EventDetail` was carrying for `xlsx` before this pass. The size is mostly
17 similarly-shaped form tabs, not one disproportionate dependency — there is no
single culprit to extract the way `xlsx` was.

### Resolution required, if ever

If this file's size becomes a real problem, the correct order is: first extract
the shared local helpers listed above into `pages/tracker/supplier-detail-tabs/`
or similar as their own exported module, *then* move stage-groups of tabs into
their own files behind `React.lazy()`, keyed off `currentStage` rather than a
route. Do not attempt the lazy-loading step before the extraction step — that is
what would produce the "fragments related logic awkwardly" outcome this
investigation avoided.
