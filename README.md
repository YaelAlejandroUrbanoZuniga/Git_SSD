# SSD Tracker Management System

Nexteer Automotive internal web application for Supplier Scouting & Development
(Global Supply Management / GSM team).

## Structure

- **`frontend/`** — React + TypeScript + Vite (user interface)
- **`backend/`** — Node.js + Express + TypeScript + Prisma (API server)

## Quick Start

This is an npm workspace — install once from the repo root (a single
`package-lock.json` here covers both `frontend/` and `backend/`; do not run
`npm install`/`npm ci` inside either subpackage):

```bash
npm ci
```

### Frontend (http://localhost:5173)
```bash
cd frontend
npm run dev
```

### Backend (http://localhost:3000/api)
```bash
cd backend
npm run dev
```

For detailed instructions, see [frontend/README.md](./frontend/README.md) and
[backend/README.md](./backend/README.md).

## Project Details

- **Team:** Global Supply Management (GSM)
- **Location:** Nexteer Automotive, Querétaro México
- **Delivery:** Go-live August 31, 2026
- **Status:** Backend and frontend both in active development toward that date
