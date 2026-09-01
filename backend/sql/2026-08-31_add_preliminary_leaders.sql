/* ============================================================================
   2026-08-31_add_preliminary_leaders.sql
   SSD Tracker Management App — Nexteer Automotive / GSM

   Agrega dos columnas al satélite de Preliminary Evaluation, ambas del tab
   Overview:

     T_Supplier_PreliminaryData  +2  [SsdLeader], [SdeLeader]

   Las dos guardan el NOMBRE de la persona como texto, NO un FK a C_User. Es
   deliberado: dar de baja a un usuario no debe romper registros históricos
   (el nombre capturado sigue siendo el correcto para ese momento del
   proceso), y SDE Leader es texto libre por definición — hoy existe una sola
   persona con ese rol y se espera que haya más antes de que tenga sentido
   catalogarlo. El droplist de SSD Leader se alimenta en el frontend de los
   usuarios con rol 'SSD' (GET /api/users), pero lo que se persiste es el
   nombre resultante, no su id.

   Ambas son NULL y OPCIONALES: no bloquean el paso de Parking Lot a
   Preliminary Evaluation. Un proveedor puede moverse de etapa sin ninguna de
   las dos y capturarlas después desde el tab Overview.

   Sin backfill y sin DEFAULT: los proveedores que ya están en Preliminary
   Evaluation nunca tuvieron estos campos, así que su valor real es "no se
   preguntó" — que es exactamente lo que NULL dice.

   DESTINO: MX_MFGIT_SSD_TEST. La base de producción todavía no existe y nace
   correcta desde prod/01_create_tables.sql, que ya trae estas dos columnas —
   no hay que correr este script contra ella.

   Idempotente: cada ADD está protegido por IF COL_LENGTH(...) IS NULL, así que
   correrlo dos veces no falla ni altera nada la segunda vez.
============================================================================ */

USE [MX_MFGIT_SSD_TEST];
GO

/* ── T_Supplier_PreliminaryData — tab Overview ───────────────────────── */

IF COL_LENGTH(N'T_Supplier_PreliminaryData', N'SsdLeader') IS NULL
    ALTER TABLE [T_Supplier_PreliminaryData] ADD [SsdLeader] NVARCHAR(100) NULL;
GO

IF COL_LENGTH(N'T_Supplier_PreliminaryData', N'SdeLeader') IS NULL
    ALTER TABLE [T_Supplier_PreliminaryData] ADD [SdeLeader] NVARCHAR(100) NULL;
GO
