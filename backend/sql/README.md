# backend/sql — manual migration scripts

**[`prod/`](prod/) is the source of truth for the production schema.** It is a
numbered baseline (`00_`–`06_`, see [`prod/RUNBOOK_PROMOCION.md`](prod/RUNBOOK_PROMOCION.md))
that already includes every structural change made since the project started —
nothing under `prod/` waits on a dated script. The dated scripts in this folder
exist to bring the **already-running TEST database** to the same shape; they are
listed below.

- **TEST** (`MX_MFGIT_SSD_TEST`) is kept in sync with `prisma/schema.prisma` via
  `npx prisma db push`. Schema changes land in the Prisma schema first, get
  pushed to TEST, and are then folded into the `prod/` baseline scripts.
- **`MX_MFGIT_SSD` (production) is never touched by `db push`.** It does not
  exist yet; it will be built by running the `prod/` scripts in order.
- Once production exists, any schema change made **after** that baseline is
  recorded in [`CAMBIOS_ESQUEMA.md`](CAMBIOS_ESQUEMA.md), with the reasoning
  behind it, and folded into the relevant `prod/` script the same way today's
  baseline was assembled.

**A dated script never has to run against production.** Production does not exist
yet, so every change made before it is built is folded straight into the `prod/`
baseline and the database is born with it — the dated script exists only to bring
the already-running TEST database to the same shape. That changes the day
`MX_MFGIT_SSD` is created; from then on the PROD column means what it says.

> ⚠ **`npm run prisma:push:test-only` NUNCA debe correrse con el `.env` de
> producción cargado.** `prisma db push` reescribe el esquema de la base a la que
> apunte `DATABASE_URL`, saltándose por completo el proceso de promoción
> controlado que `prod/` representa. El script npm lleva el sufijo `:test-only`
> justamente para que no se teclee por inercia; el nombre es la única guarda que
> tiene, así que verifica qué `.env` está cargado antes de ejecutarlo.
