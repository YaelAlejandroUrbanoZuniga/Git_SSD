/* ============================================================================
   06_verify_schema.sql
   SSD Tracker Management App — Nexteer Automotive / GSM

   Verifica que MX_MFGIT_SSD quedó construida exactamente como la describe
   backend/prisma/schema.prisma. NO modifica nada — solo lee y reporta.

   Correr después de 00..05. Todas las filas deben decir OK. Cualquier
   FALLA significa que un script anterior no corrió completo o corrió
   contra la base equivocada — no continuar con la migración de datos
   hasta que este script salga limpio.

   Los conteos esperados están escritos a mano contra el schema del commit
   25df003, más los cambios posteriores registrados en ../CAMBIOS_ESQUEMA.md.
   Si el modelo cambia, actualizar los números de este script en el mismo
   commit que el cambio de esquema.

   Última actualización: 2026-08-31 — 459 → 461 columnas, por [SsdLeader] y
   [SdeLeader] en T_Supplier_PreliminaryData. El número de tablas, PKs, FKs e
   índices no cambió: son dos columnas de texto (guardan el nombre, no un FK a
   C_User) sobre una tabla existente.
   Anterior: 2026-08-24 — 444 → 459 columnas, por las 15 columnas de perfil
   alineadas con el MS Form externo.
============================================================================ */

USE [MX_MFGIT_SSD];
GO

PRINT '';
PRINT '=== 1. ESTRUCTURA ===';
GO

WITH expected AS (
    SELECT * FROM (VALUES
        ('Tablas',            36, (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0)),
        ('Columnas',         461, (SELECT COUNT(*) FROM sys.columns c
                                   JOIN sys.tables t ON t.object_id = c.object_id
                                   WHERE t.is_ms_shipped = 0)),
        ('Llaves primarias',  36, (SELECT COUNT(*) FROM sys.key_constraints WHERE type = 'PK')),
        ('Llaves foráneas',   46, (SELECT COUNT(*) FROM sys.foreign_keys)),
        ('Índices IX_*',      18, (SELECT COUNT(*) FROM sys.indexes WHERE name LIKE 'IX[_]%')),
        ('Filtered unique',    2, (SELECT COUNT(*) FROM sys.indexes
                                   WHERE has_filter = 1 AND is_unique = 1
                                     AND object_id = OBJECT_ID(N'[C_User]')))
    ) v(Concepto, Esperado, Real)
)
SELECT Concepto, Esperado, Real,
       CASE WHEN Esperado = Real THEN 'OK' ELSE '*** FALLA ***' END AS Resultado
FROM expected;
GO

PRINT '';
PRINT '=== 2. CATÁLOGOS ===';
GO

WITH cat AS (
    SELECT * FROM (VALUES
        ('C_Commodity',        37, (SELECT COUNT(*) FROM C_Commodity)),
        ('C_Stage',             7, (SELECT COUNT(*) FROM C_Stage)),
        ('C_SupplierStatus',    3, (SELECT COUNT(*) FROM C_SupplierStatus)),
        ('C_SubStatus',         4, (SELECT COUNT(*) FROM C_SubStatus)),
        ('C_Sla',               3, (SELECT COUNT(*) FROM C_Sla)),
        ('C_ProductCategory',   2, (SELECT COUNT(*) FROM C_ProductCategory)),
        ('C_ConfidenceLevel',   4, (SELECT COUNT(*) FROM C_ConfidenceLevel)),
        ('C_ImmexStatus',       4, (SELECT COUNT(*) FROM C_ImmexStatus)),
        ('C_Role',              5, (SELECT COUNT(*) FROM C_Role)),
        ('C_User',             21, (SELECT COUNT(*) FROM C_User))
    ) v(Tabla, Esperado, Real)
)
SELECT Tabla, Esperado, Real,
       CASE WHEN Esperado = Real THEN 'OK' ELSE '*** FALLA ***' END AS Resultado
FROM cat;
GO

PRINT '';
PRINT '=== 3. VALORES CRÍTICOS ===';
GO

SELECT 'C_Role contiene Guest' AS Verificacion,
       CASE WHEN EXISTS (SELECT 1 FROM C_Role WHERE Name = N'Guest')
            THEN 'OK' ELSE '*** FALLA — un login nuevo no tendría rol que asignar ***' END AS Resultado
UNION ALL
SELECT 'C_Commodity contiene el placeholder TBD -- Pending GSM',
       CASE WHEN EXISTS (SELECT 1 FROM C_Commodity WHERE Name = N'TBD -- Pending GSM')
            THEN 'OK' ELSE '*** FALLA — el alta de proveedor en Scouting Event rompería ***' END
UNION ALL
SELECT 'Commodities con orden Subcategoría -- Categoría (GSM 2026-07-17)',
       CASE WHEN EXISTS (SELECT 1 FROM C_Commodity WHERE Name = N'CCA -- Controllers')
             AND NOT EXISTS (SELECT 1 FROM C_Commodity WHERE Name = N'Controllers -- CCA')
            THEN 'OK' ELSE '*** FALLA — catálogo con el orden viejo, invertido ***' END
UNION ALL
SELECT 'C_Stage incluye Blacklisted y Completed',
       CASE WHEN (SELECT COUNT(*) FROM C_Stage WHERE Name IN (N'Blacklisted', N'Completed')) = 2
            THEN 'OK' ELSE '*** FALLA ***' END
UNION ALL
SELECT 'Todos los usuarios sembrados tienen rol asignado',
       CASE WHEN NOT EXISTS (SELECT 1 FROM C_User WHERE FK_Role IS NULL)
            THEN 'OK' ELSE '*** FALLA ***' END
UNION ALL
SELECT 'IX_SupplierHistory_Date_ToStage tiene columnas INCLUDE',
       CASE WHEN EXISTS (
            SELECT 1 FROM sys.index_columns ic
            JOIN sys.indexes i ON i.object_id = ic.object_id AND i.index_id = ic.index_id
            WHERE i.name = N'IX_SupplierHistory_Date_ToStage' AND ic.is_included_column = 1)
            THEN 'OK' ELSE 'AVISO — sin INCLUDE; Reports funciona, solo con un lookup extra' END;
GO

PRINT '';
PRINT '=== 4. TABLAS TRANSACCIONALES (deben estar VACÍAS antes de migrar) ===';
GO

WITH tx AS (
    SELECT * FROM (VALUES
        ('T_Supplier',         (SELECT COUNT(*) FROM T_Supplier)),
        ('T_Supplier_History', (SELECT COUNT(*) FROM T_Supplier_History)),
        ('T_Event',            (SELECT COUNT(*) FROM T_Event)),
        ('T_Event_Prospect',   (SELECT COUNT(*) FROM T_Event_Prospect)),
        ('T_Strategy_Entry',   (SELECT COUNT(*) FROM T_Strategy_Entry)),
        ('T_Strategy_MrlRequirement', (SELECT COUNT(*) FROM T_Strategy_MrlRequirement)),
        ('T_User_Notification',(SELECT COUNT(*) FROM T_User_Notification))
    ) v(Tabla, Filas)
)
SELECT Tabla, Filas,
       CASE WHEN Filas = 0 THEN 'OK — lista para la migración de Excel'
            ELSE 'AVISO — ya tiene datos; confirmar que es intencional' END AS Resultado
FROM tx;
GO

PRINT '';
PRINT '=== 5. DETALLE DE LOS FILTERED UNIQUE INDEXES ===';
GO

SELECT i.name AS Indice, OBJECT_NAME(i.object_id) AS Tabla,
       i.is_unique AS EsUnico, i.filter_definition AS Filtro
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID(N'[C_User]') AND i.has_filter = 1;
GO

PRINT '';
PRINT 'Verificación terminada. Revisar que no haya ninguna línea con FALLA.';
PRINT 'Siguiente paso: apuntar DATABASE_URL a MX_MFGIT_SSD, arrancar el backend';
PRINT '(verifyDatabaseSchema debe pasar sin warnings) y correr la migración de';
PRINT 'los Excel reales — ver RUNBOOK_PROMOCION.md.';
GO
