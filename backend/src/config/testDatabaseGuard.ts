/**
 * Guard for the destructive CLI scripts (prisma/seed.ts's demo wipe and the three
 * data-import scripts). All four read DATABASE_URL from the SAME .env the server
 * uses, so nothing but this check stands between `SEED_DEMO=true npm run seed`
 * with the production .env loaded and deleting every real supplier.
 *
 * The pattern comes from data-import/backfill-stage-entered-at.ts, which already
 * documented "TEST database only (MX_MFGIT_SSD_TEST) — point DATABASE_URL at
 * production and it would touch production, so don't" as a comment. This turns
 * that comment into something the runtime enforces.
 */

/** Production database. Anything without the `_TEST` suffix is treated as real data. */
export const PRODUCTION_DATABASE = 'MX_MFGIT_SSD';

/** Reads the `database=` segment out of a Prisma SQL Server connection string. */
function databaseNameFrom(url: string): string {
  return /(?:^|;)\s*database\s*=\s*([^;]*)/i.exec(url)?.[1]?.trim() ?? '';
}

/**
 * Throws unless DATABASE_URL points at a `*_TEST` database. `scriptLabel` is the
 * script's own log prefix (e.g. `[seed:demo]`) so the abort message reads like
 * the rest of that script's output.
 */
export function assertTestDatabase(scriptLabel: string): void {
  const url = process.env.DATABASE_URL ?? '';
  const database = databaseNameFrom(url);

  if (!database) {
    const message =
      `${scriptLabel} ⚠ ABORTADO: no se pudo leer el nombre de la base desde DATABASE_URL.\n`
      + `${scriptLabel}   Este script sólo puede correr contra una base de pruebas (sufijo "_TEST").`;
    console.error(message);
    throw new Error(`${scriptLabel} DATABASE_URL has no readable database name`);
  }

  if (!database.toUpperCase().includes('_TEST')) {
    const message =
      `${scriptLabel} ⚠ ABORTADO: DATABASE_URL apunta a "${database}", que NO es una base de pruebas.\n`
      + `${scriptLabel}   Este script escribe (y en algunos casos BORRA) datos, y sólo puede correr\n`
      + `${scriptLabel}   contra una base con sufijo "_TEST" (p. ej. ${PRODUCTION_DATABASE}_TEST).\n`
      + `${scriptLabel}   No se ejecutó ninguna operación. Revisa qué .env tienes cargado.`;
    console.error(message);
    throw new Error(`${scriptLabel} refuses to run against non-TEST database "${database}"`);
  }
}
