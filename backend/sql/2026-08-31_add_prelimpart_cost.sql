/* ============================================================================
   2026-08-31_add_prelimpart_cost.sql
   SSD Tracker Management App — Nexteer Automotive / GSM

   Agrega una columna al tab Competitiveness de Supplier Evaluation:

     T_Supplier_PrelimPart  +1  [Cost]

   Vive junto a [FK_ConfidenceLevel]: es un atributo POR PARTE, no del
   proveedor. Se guarda como NVARCHAR(20) con los valores 'Saving' o 'Impact',
   validados en la capa de aplicación (Zod, en suppliersController.ts) — NO se
   crea tabla catálogo: son dos valores fijos que no van a crecer, y una tabla
   de dos filas es sobreingeniería para este caso.

   No confundir con [T_Supplier_EvaluationData].[CostModel] (tab Fundamentals,
   campo prelim_costModel): son campos distintos en tablas distintas.

   NULL y OPCIONAL, igual que [FK_ConfidenceLevel] en esta misma tabla: no
   bloquea el guardado del tab Competitiveness.

   DESTINO: MX_MFGIT_SSD_TEST. La base de producción todavía no existe y nace
   correcta desde prod/01_create_tables.sql, que ya trae esta columna — no hay
   que correr este script contra ella.

   Idempotente: el ADD está protegido por IF COL_LENGTH(...) IS NULL, así que
   correrlo dos veces no falla ni altera nada la segunda vez.
============================================================================ */

USE [MX_MFGIT_SSD_TEST];
GO

IF COL_LENGTH(N'T_Supplier_PrelimPart', N'Cost') IS NULL
    ALTER TABLE [T_Supplier_PrelimPart] ADD [Cost] NVARCHAR(20) NULL;
GO
