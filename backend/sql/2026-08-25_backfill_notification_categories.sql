/* ============================================================================
   2026-08-25_backfill_notification_categories.sql
   SSD Tracker Management App — Nexteer Automotive / GSM

   Reclasifica las notificaciones YA EXISTENTES en TEST desde las tres
   categorías genéricas del tracker hacia las nuevas categorías finas por stage:

       supplier_created  ->  supplier_created_scouting | supplier_created_parking
       supplier_updated  ->  supplier_updated_<stage>
       stage_advanced    ->  stage_advanced_<stage destino>

   El panel de notificaciones pinta cada fila con el color/ícono del stage al
   que pertenece el hecho (frontend `constants/stage-config.ts`,
   TRACKER_STAGE_CONFIG). Sin este backfill las notificaciones ya guardadas en
   TEST se seguirían viendo con el estilo de respaldo por severidad, porque su
   `Category` guarda un valor que la nueva tabla del frontend ya no conoce.

   NO hay cambio de esquema: `Category` es NVARCHAR(30) NULL de texto libre y el
   valor más largo del nuevo vocabulario, `supplier_updated_supplier_eval`, mide
   exactamente 30 caracteres. No se requiere ALTER TABLE ni migración de Prisma.

   ── EXCLUSIVO DE TEST ──────────────────────────────────────────────────────
   Producción (`MX_MFGIT_SSD`) todavía no existe y nace SIN notificaciones: no
   se siembran nunca, se generan por eventos de dominio reales (ver
   backend/README.md, §seed y `notificationsService.notifyTeam`). Por eso este
   script no tiene contraparte bajo `sql/prod/` y el guard de abajo aborta si se
   ejecuta contra cualquier base que no sea `MX_MFGIT_SSD_TEST`.

   ── QUÉ PATRÓN DE TEXTO ASUME ──────────────────────────────────────────────
   Solo `stage_advanced` se puede reconstruir con exactitud. `trackerService.ts`
   (`moveSupplierToStage`) escribe SIEMPRE la misma plantilla:

       '<nombre del proveedor> avanzó de <origen> a <destino>'

   …así que el stage destino es el final del mensaje. El script busca, con
   CHARINDEX/RIGHT, cuál de los seis nombres de stage cierra el `Message` y
   mapea ese sufijo a su categoría fina. Ninguno de los seis sufijos es sufijo
   de otro, de modo que cada fila casa con a lo más una regla.

   El blacklist NO entra aquí: usa otra plantilla y ya viaja con
   `Category = 'blacklisted'`, que no cambia.

   ── QUÉ PASA SI UNA FILA NO CASA ───────────────────────────────────────────
   Se queda intacta con su categoría antigua — nunca falla el script completo.
   El resumen final la reporta como "sin reclasificar" para que se revise a
   mano; en el panel se seguirá viendo con el respaldo por severidad, que es
   exactamente el comportamiento que ya tenía.

   ── LIMITACIÓN CONOCIDA (supplier_created / supplier_updated) ──────────────
   Sus mensajes NO nombran el stage:

       'Nuevo proveedor registrado: <nombre> (<folio>)'
       '<usuario> actualizó N campos de <nombre>: <campos>'

   El stage histórico tampoco es recuperable desde la fila del proveedor: hoy
   está en el stage al que haya llegado después, no en el que estaba cuando se
   emitió la notificación. Reconstruirlo exigiría cruzar el `CreatedDt` de la
   notificación contra `T_Supplier_History`, y el mensaje ni siquiera guarda el
   id del proveedor (solo su nombre, que no es único). Así que este script usa
   el respaldo más razonable y lo declara como aproximación:

       supplier_created -> supplier_created_scouting
           (Scouting Event es el destino por defecto de una creación; solo las
           recomendaciones internas nacen en Parking Lot)
       supplier_updated -> supplier_updated_scouting
           (el mismo respaldo neutro que `categoryForSupplierUpdate` aplica a un
           registro ya cerrado)

   Es una aproximación ACEPTADA PARA DATOS DE PRUEBA. No es un criterio
   promovible a producción — y no hace falta que lo sea, porque producción nace
   sin notificaciones y todas las suyas se escribirán ya con la categoría fina
   correcta desde el código.

   ── IDEMPOTENTE ────────────────────────────────────────────────────────────
   Cada UPDATE está condicionado a `Category = '<valor antiguo>'`. Después de la
   primera corrida ya no queda ninguna fila con esos valores, así que volver a
   ejecutarlo no toca nada y el resumen sale en cero.
============================================================================ */

/* Todo va en UN SOLO batch (sin `GO` intermedio) a propósito: `RETURN` solo
   aborta el batch en el que está, así que un `GO` entre el guard y los UPDATE
   dejaría que los UPDATE corrieran igual contra la base equivocada. */
SET NOCOUNT ON;

/* Bitácora de lo reclasificado, alimentada por el OUTPUT de cada UPDATE. */
DECLARE @Reclassified TABLE (
    OldCategory NVARCHAR(30) NOT NULL,
    NewCategory NVARCHAR(30) NOT NULL
);

IF DB_NAME() <> N'MX_MFGIT_SSD_TEST'
BEGIN
    RAISERROR(N'Este script es exclusivo de MX_MFGIT_SSD_TEST. Base actual: %s. Abortado.',
              16, 1, DB_NAME());
    RETURN;
END

BEGIN TRANSACTION;

/* ── 1. stage_advanced → stage_advanced_<destino> ───────────────────────────
   Reconstrucción exacta: el destino es el final del `Message`. El JOIN contra
   la tabla de sufijos hace las seis reglas en un solo UPDATE, y una fila cuyo
   mensaje no termine en ninguno de los seis simplemente no entra al JOIN. */
UPDATE n
SET Category = m.NewCategory
OUTPUT deleted.Category, inserted.Category INTO @Reclassified (OldCategory, NewCategory)
FROM dbo.T_User_Notification AS n
INNER JOIN (VALUES
    (N' a Scouting Event',         N'stage_advanced_scouting'),
    (N' a Parking Lot',            N'stage_advanced_parking'),
    (N' a Preliminary Evaluation', N'stage_advanced_preliminary'),
    (N' a Supplier Evaluation',    N'stage_advanced_supplier_eval'),
    (N' a Intelex Handoff',        N'stage_advanced_intelex'),
    (N' a Completed',              N'stage_advanced_completed')
) AS m (Suffix, NewCategory)
    ON RIGHT(n.Message, LEN(m.Suffix)) = m.Suffix
WHERE n.Category = N'stage_advanced'
  -- Guarda de plantilla, deliberadamente sin acentos para que el script no
  -- dependa de cómo el cliente SQL decodifique el archivo: la plantilla de
  -- `moveSupplierToStage` es la única que produce ' de <origen> a <destino>'.
  AND CHARINDEX(N' de ', n.Message) > 0;

/* ── 2. supplier_created → supplier_created_scouting (APROXIMACIÓN) ─────────
   Ver "LIMITACIÓN CONOCIDA" arriba: el stage de nacimiento no está en el
   mensaje. Scouting Event es el destino por defecto de una creación. */
UPDATE dbo.T_User_Notification
SET Category = N'supplier_created_scouting'
OUTPUT deleted.Category, inserted.Category INTO @Reclassified (OldCategory, NewCategory)
WHERE Category = N'supplier_created';

/* ── 3. supplier_updated → supplier_updated_scouting (APROXIMACIÓN) ─────────
   Mismo caso, y el mismo respaldo neutro que usa `categoryForSupplierUpdate`
   cuando el proveedor ya salió del tablero. */
UPDATE dbo.T_User_Notification
SET Category = N'supplier_updated_scouting'
OUTPUT deleted.Category, inserted.Category INTO @Reclassified (OldCategory, NewCategory)
WHERE Category = N'supplier_updated';

COMMIT TRANSACTION;

/* ── Resumen: cuántas filas y hacia dónde ───────────────────────────────── */
PRINT N'--- Reclasificación de T_User_Notification.Category ---';
PRINT N'(vacío = nada que hacer; el script ya se había corrido)';

SELECT
    OldCategory AS [Categoría anterior],
    NewCategory AS [Categoría nueva],
    COUNT(*)    AS [Filas reclasificadas]
FROM @Reclassified
GROUP BY OldCategory, NewCategory
ORDER BY OldCategory, NewCategory;

/* Lo que quedó intacto: filas de `stage_advanced` cuyo `Message` no terminó en
   ninguno de los seis stages conocidos. Deberían ser cero; si no lo son, hay
   que mirarlas a mano — siguen renderizando con el respaldo por severidad. */
SELECT
    Category AS [Sin reclasificar],
    COUNT(*) AS [Filas]
FROM dbo.T_User_Notification
WHERE Category IN (N'supplier_created', N'supplier_updated', N'stage_advanced')
GROUP BY Category
ORDER BY Category;
GO
