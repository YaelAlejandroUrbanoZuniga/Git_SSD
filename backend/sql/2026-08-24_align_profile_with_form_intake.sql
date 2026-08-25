/* ============================================================================
   2026-08-24_align_profile_with_form_intake.sql
   SSD Tracker Management App — Nexteer Automotive / GSM

   Alinea las tres tablas de perfil del proveedor con el MS Form externo de 48
   preguntas: 15 respuestas que el formulario ya recoge no tenían columna donde
   aterrizar, así que formIntakeController las descartaba en silencio.

     T_Supplier_CompanyInfo     +5  (4 gemelas + FirstContactWithNexteer)
     T_Supplier_TechnicalInfo   +3  (3 gemelas)
     T_Supplier_CommercialInfo  +7  (3 gemelas + 4 nuevas)

   "Gemela" = columna con el MISMO nombre, tipo y ancho que una ya existente en
   T_Supplier_PreliminaryData. La duplicación es DELIBERADA y está explicada en
   CAMBIOS_ESQUEMA.md; su reconciliación se rastrea fuera de este repositorio.

   Las 15 columnas son NULL. Los 533 proveedores migrados no tienen valor para
   ninguna de ellas y este script no hace backfill ni pone DEFAULT: un default
   los describiría mal (un 0 en YearsInMexico no es "cero años", es "no se
   preguntó"), y un NOT NULL simplemente no podría aplicarse.

   [ExportCapability] NO se toca. Sigue existiendo y sigue guardando 'true' /
   'false'; lo que cambia es que ahora se DERIVA de [ExportLocalContentPercent]
   y [ExportDestinationCountries] en domain/formIntakeMapper.ts.

   DESTINO: MX_MFGIT_SSD_TEST. La base de producción todavía no existe y nace
   correcta desde prod/01_create_tables.sql, que ya trae estas 15 columnas — no
   hay que correr este script contra ella.

   Idempotente: cada ADD está protegido por IF COL_LENGTH(...) IS NULL, así que
   correrlo dos veces no falla ni altera nada la segunda vez.
============================================================================ */

USE [MX_MFGIT_SSD_TEST];
GO

/* ── T_Supplier_CompanyInfo ──────────────────────────────────────────── */

IF COL_LENGTH(N'T_Supplier_CompanyInfo', N'HqCity') IS NULL
    ALTER TABLE [T_Supplier_CompanyInfo] ADD [HqCity] NVARCHAR(100) NULL;
GO

IF COL_LENGTH(N'T_Supplier_CompanyInfo', N'HqCountry') IS NULL
    ALTER TABLE [T_Supplier_CompanyInfo] ADD [HqCountry] NVARCHAR(100) NULL;
GO

IF COL_LENGTH(N'T_Supplier_CompanyInfo', N'ManufacturingCity') IS NULL
    ALTER TABLE [T_Supplier_CompanyInfo] ADD [ManufacturingCity] NVARCHAR(100) NULL;
GO

IF COL_LENGTH(N'T_Supplier_CompanyInfo', N'GeneralManager') IS NULL
    ALTER TABLE [T_Supplier_CompanyInfo] ADD [GeneralManager] NVARCHAR(100) NULL;
GO

-- Q15 del formulario. Sin gemela en PreliminaryData: es nueva en el sistema.
IF COL_LENGTH(N'T_Supplier_CompanyInfo', N'FirstContactWithNexteer') IS NULL
    ALTER TABLE [T_Supplier_CompanyInfo] ADD [FirstContactWithNexteer] BIT NULL;
GO

/* ── T_Supplier_TechnicalInfo ────────────────────────────────────────── */

IF COL_LENGTH(N'T_Supplier_TechnicalInfo', N'ToolingDesign') IS NULL
    ALTER TABLE [T_Supplier_TechnicalInfo] ADD [ToolingDesign] NVARCHAR(100) NULL;
GO

IF COL_LENGTH(N'T_Supplier_TechnicalInfo', N'RawMaterialIndex') IS NULL
    ALTER TABLE [T_Supplier_TechnicalInfo] ADD [RawMaterialIndex] NVARCHAR(200) NULL;
GO

IF COL_LENGTH(N'T_Supplier_TechnicalInfo', N'Applications') IS NULL
    ALTER TABLE [T_Supplier_TechnicalInfo] ADD [Applications] NVARCHAR(300) NULL;
GO

/* ── T_Supplier_CommercialInfo ───────────────────────────────────────── */

IF COL_LENGTH(N'T_Supplier_CommercialInfo', N'Footprint') IS NULL
    ALTER TABLE [T_Supplier_CommercialInfo] ADD [Footprint] NVARCHAR(100) NULL;
GO

-- El MS Form manda un entero 0-150; el Excel migrado traía texto libre
-- ("26 Years"), que el mapper convierte antes de llegar aquí.
IF COL_LENGTH(N'T_Supplier_CommercialInfo', N'YearsInMexico') IS NULL
    ALTER TABLE [T_Supplier_CommercialInfo] ADD [YearsInMexico] INT NULL;
GO

IF COL_LENGTH(N'T_Supplier_CommercialInfo', N'Market') IS NULL
    ALTER TABLE [T_Supplier_CommercialInfo] ADD [Market] NVARCHAR(100) NULL;
GO

IF COL_LENGTH(N'T_Supplier_CommercialInfo', N'BusinessSector') IS NULL
    ALTER TABLE [T_Supplier_CommercialInfo] ADD [BusinessSector] NVARCHAR(100) NULL;
GO

-- Solo tiene sentido cuando [Market] = 'Mixed'; el mapper descarta el número
-- en cualquier otro caso, así que la columna nunca guarda un porcentaje suelto.
IF COL_LENGTH(N'T_Supplier_CommercialInfo', N'AutomotivePercent') IS NULL
    ALTER TABLE [T_Supplier_CommercialInfo] ADD [AutomotivePercent] INT NULL;
GO

IF COL_LENGTH(N'T_Supplier_CommercialInfo', N'ExportLocalContentPercent') IS NULL
    ALTER TABLE [T_Supplier_CommercialInfo] ADD [ExportLocalContentPercent] INT NULL;
GO

IF COL_LENGTH(N'T_Supplier_CommercialInfo', N'ExportDestinationCountries') IS NULL
    ALTER TABLE [T_Supplier_CommercialInfo] ADD [ExportDestinationCountries] NVARCHAR(300) NULL;
GO

/* ── Verificación ────────────────────────────────────────────────────── */

WITH esperado AS (
    SELECT * FROM (VALUES
        ('T_Supplier_CompanyInfo',    'HqCity'),
        ('T_Supplier_CompanyInfo',    'HqCountry'),
        ('T_Supplier_CompanyInfo',    'ManufacturingCity'),
        ('T_Supplier_CompanyInfo',    'GeneralManager'),
        ('T_Supplier_CompanyInfo',    'FirstContactWithNexteer'),
        ('T_Supplier_TechnicalInfo',  'ToolingDesign'),
        ('T_Supplier_TechnicalInfo',  'RawMaterialIndex'),
        ('T_Supplier_TechnicalInfo',  'Applications'),
        ('T_Supplier_CommercialInfo', 'Footprint'),
        ('T_Supplier_CommercialInfo', 'YearsInMexico'),
        ('T_Supplier_CommercialInfo', 'Market'),
        ('T_Supplier_CommercialInfo', 'BusinessSector'),
        ('T_Supplier_CommercialInfo', 'AutomotivePercent'),
        ('T_Supplier_CommercialInfo', 'ExportLocalContentPercent'),
        ('T_Supplier_CommercialInfo', 'ExportDestinationCountries')
    ) v(Tabla, Columna)
)
SELECT e.Tabla, e.Columna,
       CASE WHEN COL_LENGTH(e.Tabla, e.Columna) IS NOT NULL
            THEN 'OK' ELSE '*** FALLA — la columna no existe ***' END AS Resultado
FROM esperado e;
GO
