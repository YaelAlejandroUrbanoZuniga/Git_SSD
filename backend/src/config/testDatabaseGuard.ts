/**
 * Guards for the CLI scripts that read DATABASE_URL from the SAME .env the
 * server uses: prisma/seed.ts's demo wipe (destructive, `assertTestDatabase`)
 * and the three data-import scripts (writes only, `assertWritableDatabase`).
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

function readDatabaseNameOrThrow(scriptLabel: string): string {
  const url = process.env.DATABASE_URL ?? '';
  const database = databaseNameFrom(url);

  if (!database) {
    const message =
      `${scriptLabel} ⚠ ABORTADO: no se pudo leer el nombre de la base desde DATABASE_URL.\n`
      + `${scriptLabel}   Este script sólo puede correr contra una base de pruebas (sufijo "_TEST").`;
    console.error(message);
    throw new Error(`${scriptLabel} DATABASE_URL has no readable database name`);
  }

  return database;
}

/**
 * Throws unless DATABASE_URL points at a `*_TEST` database. `scriptLabel` is the
 * script's own log prefix (e.g. `[seed:demo]`) so the abort message reads like
 * the rest of that script's output.
 *
 * For DESTRUCTIVE operations only (currently: prisma/seed.ts's demo wipe, which
 * deletes every supplier/event/strategy/MRL row before reseeding). There is no
 * override — by design, nothing can make this run against production.
 */
export function assertTestDatabase(scriptLabel: string): void {
  const database = readDatabaseNameOrThrow(scriptLabel);

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

/**
 * For the data-import scripts, which WRITE but never delete. Passes silently
 * against a `*_TEST` database, same as `assertTestDatabase`. Against production
 * it aborts UNLESS `ALLOW_PRODUCTION_IMPORT` is exactly `'true'` — the deliberate
 * opt-in the runbook sets when migrating the real GSM data into production. When
 * that opt-in is present, it prints a loud warning banner before letting the
 * script continue, so writing to production stays possible but never silent or
 * accidental.
 */
export function assertWritableDatabase(scriptLabel: string): void {
  const database = readDatabaseNameOrThrow(scriptLabel);

  if (database.toUpperCase().includes('_TEST')) return;

  if (process.env.ALLOW_PRODUCTION_IMPORT !== 'true') {
    const message =
      `${scriptLabel} ⚠ ABORTADO: DATABASE_URL apunta a "${database}", que NO es una base de pruebas.\n`
      + `${scriptLabel}   Para correr este script contra producción hay que setear\n`
      + `${scriptLabel}   ALLOW_PRODUCTION_IMPORT=true de forma deliberada (además de la bandera\n`
      + `${scriptLabel}   de importación del script). No se ejecutó ninguna operación.`;
    console.error(message);
    throw new Error(`${scriptLabel} refuses to run against non-TEST database "${database}" without ALLOW_PRODUCTION_IMPORT=true`);
  }

  const banner = '!'.repeat(78);
  console.warn(banner);
  console.warn(`! ${scriptLabel} va a ESCRIBIR en la base de PRODUCCIÓN "${database}".`);
  console.warn(`! ${scriptLabel} Verifica que exista un respaldo previo antes de continuar.`);
  console.warn(banner);
}
