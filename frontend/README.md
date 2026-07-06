# SSD Pipeline Management — Frontend

React + TypeScript + Vite frontend for the SSD Pipeline Management System
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

## Current state — mock data

`src/services/*.ts` currently return data from `src/data/*.ts` directly (in-memory,
no network calls). `src/services/api.config.ts` already points at
`http://localhost:3000/api`, matching the backend's base URL, but the services have
not yet been switched to call it — that migration (replacing the mock returns with
`fetch` calls against the backend) is tracked as a pending TODO in
[backend/README.md](../backend/README.md).
