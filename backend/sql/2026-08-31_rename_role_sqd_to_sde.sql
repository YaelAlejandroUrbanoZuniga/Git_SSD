/* ============================================================================
   2026-08-31_rename_role_sqd_to_sde.sql
   SSD Tracker Management App — Nexteer Automotive / GSM

   Renombra el rol de aplicación 'SQD' a 'SDE' en C_Role.Name. Es un rename
   puro: ningún permiso ni regla RBAC cambia, solo el nombre bajo el que el
   rol existe. `authService.ts` lee `user.role.name` literalmente como
   `AppRole`, así que el código (ya actualizado para esperar 'SDE') y esta fila
   son inseparables — si uno cambia sin el otro, todo usuario con este rol
   queda con un `role.name` fuera de la unión `AppRole` y pierde acceso.

   ── EXCLUSIVO DE TEST ──────────────────────────────────────────────────────
   Producción (`MX_MFGIT_SSD`) todavía no existe. `sql/prod/04_seed_catalogs.sql`
   ya siembra 'SDE' directamente desde cero (ver CAMBIOS_ESQUEMA.md), así que
   este script nunca tendrá que correr contra producción: existe solo para
   traer la base de TEST, que ya sembró 'SQD' antes de este cambio, a la misma
   forma que la baseline. El guard de abajo aborta si se ejecuta contra
   cualquier base que no sea `MX_MFGIT_SSD_TEST`.

   ── IDEMPOTENTE ────────────────────────────────────────────────────────────
   El UPDATE solo corre si existe una fila 'SQD' y todavía NO existe una fila
   'SDE' (evita violar `UQ_C_Role_Name`). Después de la primera corrida
   ninguna de las dos condiciones se cumple, así que una segunda ejecución no
   toca nada.
============================================================================ */

SET NOCOUNT ON;

IF DB_NAME() <> N'MX_MFGIT_SSD_TEST'
BEGIN
    RAISERROR(N'Este script es exclusivo de MX_MFGIT_SSD_TEST. Base actual: %s. Abortado.',
              16, 1, DB_NAME());
    RETURN;
END

IF EXISTS (SELECT 1 FROM [C_Role] WHERE [Name] = N'SQD')
   AND NOT EXISTS (SELECT 1 FROM [C_Role] WHERE [Name] = N'SDE')
BEGIN
    UPDATE [C_Role] SET [Name] = N'SDE' WHERE [Name] = N'SQD';
    PRINT N'C_Role: SQD renombrado a SDE.';
END
ELSE
BEGIN
    PRINT N'C_Role: nada que hacer (SQD ya no existe, o SDE ya existe).';
END
GO
