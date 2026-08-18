/* ============================================================================
   04_seed_catalogs.sql
   SSD Tracker Management App — Nexteer Automotive / GSM

   Siembra los 9 catálogos (tablas C_) excepto C_User.

   Valores extraídos literalmente de backend/src/domain/constants.ts, que es la
   fuente de verdad de las listas controladas. Si esa constante cambia, este
   script se regenera.

   ⚠ RUTA PRIMARIA vs. RUTA ALTERNA. La forma preferida de sembrar catálogos y
   usuarios en producción es `npm run seed` desde el host del backend: es el
   mismo código que la aplicación valida, es idempotente por diseño y no borra
   nada. Este script (y el 05) existen como ALTERNATIVA para cuando el host de
   base de datos no tenga el backend disponible y Leo tenga que levantar la BD
   desde SSMS únicamente. Correr ambos no causa daño — los dos son idempotentes
   y se saltan lo que ya exista — pero mantener dos rutas es la razón por la que
   la versión anterior de este script se desincronizó (traía los commodities con
   el orden invertido, sin el placeholder, y C_Role sin 'Guest').

   NO siembra proveedores, eventos ni estrategia. Esos datos entran a producción
   por la migración de los Excel reales (backend/data-import), nunca por seed.
   Tampoco siembra notificaciones: se generan por eventos de dominio reales.

   Idempotente: cada fila se inserta solo si no existe. Re-ejecutar no duplica.
============================================================================ */

USE [MX_MFGIT_SSD];
GO

-- C_Stage — las 7 etapas (5 activas + Blacklisted + Completed).
IF NOT EXISTS (SELECT 1 FROM [C_Stage] WHERE [Name] = N'Scouting Event')
    INSERT INTO [C_Stage] ([Name], [SortOrder], [CreatedBy]) VALUES (N'Scouting Event', 0, N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Stage] WHERE [Name] = N'Parking Lot')
    INSERT INTO [C_Stage] ([Name], [SortOrder], [CreatedBy]) VALUES (N'Parking Lot', 1, N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Stage] WHERE [Name] = N'Preliminary Evaluation')
    INSERT INTO [C_Stage] ([Name], [SortOrder], [CreatedBy]) VALUES (N'Preliminary Evaluation', 2, N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Stage] WHERE [Name] = N'Supplier Evaluation')
    INSERT INTO [C_Stage] ([Name], [SortOrder], [CreatedBy]) VALUES (N'Supplier Evaluation', 3, N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Stage] WHERE [Name] = N'Intelex Handoff')
    INSERT INTO [C_Stage] ([Name], [SortOrder], [CreatedBy]) VALUES (N'Intelex Handoff', 4, N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Stage] WHERE [Name] = N'Blacklisted')
    INSERT INTO [C_Stage] ([Name], [SortOrder], [CreatedBy]) VALUES (N'Blacklisted', 5, N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Stage] WHERE [Name] = N'Completed')
    INSERT INTO [C_Stage] ([Name], [SortOrder], [CreatedBy]) VALUES (N'Completed', 6, N'seed-script');

-- C_SupplierStatus
IF NOT EXISTS (SELECT 1 FROM [C_SupplierStatus] WHERE [Name] = N'ACTIVE')
    INSERT INTO [C_SupplierStatus] ([Name], [CreatedBy]) VALUES (N'ACTIVE', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_SupplierStatus] WHERE [Name] = N'BLACKLISTED')
    INSERT INTO [C_SupplierStatus] ([Name], [CreatedBy]) VALUES (N'BLACKLISTED', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_SupplierStatus] WHERE [Name] = N'COMPLETED')
    INSERT INTO [C_SupplierStatus] ([Name], [CreatedBy]) VALUES (N'COMPLETED', N'seed-script');

-- C_SubStatus
IF NOT EXISTS (SELECT 1 FROM [C_SubStatus] WHERE [Name] = N'Go')
    INSERT INTO [C_SubStatus] ([Name], [CreatedBy]) VALUES (N'Go', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_SubStatus] WHERE [Name] = N'No Go')
    INSERT INTO [C_SubStatus] ([Name], [CreatedBy]) VALUES (N'No Go', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_SubStatus] WHERE [Name] = N'Under Evaluation')
    INSERT INTO [C_SubStatus] ([Name], [CreatedBy]) VALUES (N'Under Evaluation', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_SubStatus] WHERE [Name] = N'On Hold')
    INSERT INTO [C_SubStatus] ([Name], [CreatedBy]) VALUES (N'On Hold', N'seed-script');

-- C_Sla — ColorHex queda NULL a propósito: el frontend define los colores
-- en frontend/src/constants/stage-config.ts. No inventar valores aquí.
IF NOT EXISTS (SELECT 1 FROM [C_Sla] WHERE [Name] = N'green')
    INSERT INTO [C_Sla] ([Name], [ColorHex], [CreatedBy]) VALUES (N'green', NULL, N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Sla] WHERE [Name] = N'yellow')
    INSERT INTO [C_Sla] ([Name], [ColorHex], [CreatedBy]) VALUES (N'yellow', NULL, N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Sla] WHERE [Name] = N'red')
    INSERT INTO [C_Sla] ([Name], [ColorHex], [CreatedBy]) VALUES (N'red', NULL, N'seed-script');

-- C_ProductCategory
IF NOT EXISTS (SELECT 1 FROM [C_ProductCategory] WHERE [Name] = N'Direct')
    INSERT INTO [C_ProductCategory] ([Name], [CreatedBy]) VALUES (N'Direct', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_ProductCategory] WHERE [Name] = N'Indirect')
    INSERT INTO [C_ProductCategory] ([Name], [CreatedBy]) VALUES (N'Indirect', N'seed-script');

-- C_ConfidenceLevel
IF NOT EXISTS (SELECT 1 FROM [C_ConfidenceLevel] WHERE [Code] = N'H')
    INSERT INTO [C_ConfidenceLevel] ([Code], [Label], [SortOrder], [CreatedBy]) VALUES (N'H', N'High', 0, N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_ConfidenceLevel] WHERE [Code] = N'M')
    INSERT INTO [C_ConfidenceLevel] ([Code], [Label], [SortOrder], [CreatedBy]) VALUES (N'M', N'Medium', 1, N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_ConfidenceLevel] WHERE [Code] = N'L')
    INSERT INTO [C_ConfidenceLevel] ([Code], [Label], [SortOrder], [CreatedBy]) VALUES (N'L', N'Low', 2, N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_ConfidenceLevel] WHERE [Code] = N'TBD')
    INSERT INTO [C_ConfidenceLevel] ([Code], [Label], [SortOrder], [CreatedBy]) VALUES (N'TBD', N'To Be Defined', 3, N'seed-script');

-- C_ImmexStatus
IF NOT EXISTS (SELECT 1 FROM [C_ImmexStatus] WHERE [Name] = N'Yes')
    INSERT INTO [C_ImmexStatus] ([Name], [CreatedBy]) VALUES (N'Yes', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_ImmexStatus] WHERE [Name] = N'No')
    INSERT INTO [C_ImmexStatus] ([Name], [CreatedBy]) VALUES (N'No', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_ImmexStatus] WHERE [Name] = N'In Plan')
    INSERT INTO [C_ImmexStatus] ([Name], [CreatedBy]) VALUES (N'In Plan', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_ImmexStatus] WHERE [Name] = N'TBC')
    INSERT INTO [C_ImmexStatus] ([Name], [CreatedBy]) VALUES (N'TBC', N'seed-script');

-- C_Role — 5 valores. 'Guest' es el rol de menor privilegio que se asigna
-- automáticamente a cualquier persona de Nexteer que se autentique sin estar
-- pre-aprovisionada. Sin él, un login nuevo no tiene rol que asignar y falla.
IF NOT EXISTS (SELECT 1 FROM [C_Role] WHERE [Name] = N'SSD')
    INSERT INTO [C_Role] ([Name], [CreatedBy]) VALUES (N'SSD', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Role] WHERE [Name] = N'PM')
    INSERT INTO [C_Role] ([Name], [CreatedBy]) VALUES (N'PM', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Role] WHERE [Name] = N'Buyer')
    INSERT INTO [C_Role] ([Name], [CreatedBy]) VALUES (N'Buyer', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Role] WHERE [Name] = N'SQD')
    INSERT INTO [C_Role] ([Name], [CreatedBy]) VALUES (N'SQD', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Role] WHERE [Name] = N'Guest')
    INSERT INTO [C_Role] ([Name], [CreatedBy]) VALUES (N'Guest', N'seed-script');

-- C_Commodity — 36 commodities oficiales + 1 placeholder ('TBD -- Pending GSM',
-- valor 37). Las 7 subdivididas usan orden "Subcategoría -- Categoría", invertido
-- por instrucción de GSM el 2026-07-17. No modificar sin instrucción explícita.
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'CCA -- Controllers')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'CCA -- Controllers', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'MSB -- Controllers')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'MSB -- Controllers', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'PHA -- Controllers')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'PHA -- Controllers', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Headers -- E-Mechanical Components')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Headers -- E-Mechanical Components', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Connectors -- E-Mechanical Components')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Connectors -- E-Mechanical Components', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Leadframe -- E-Mechanical Components')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Leadframe -- E-Mechanical Components', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'PCB -- E-Mechanical Components')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'PCB -- E-Mechanical Components', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Castings')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Castings', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Motors')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Motors', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Machining')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Machining', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Driveline')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Driveline', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Assembly')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Assembly', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Bearing')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Bearing', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Tubing')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Tubing', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Forgings')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Forgings', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Stampings')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Stampings', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Steel')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Steel', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Rubber')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Rubber', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Plastic')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Plastic', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Allied')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Allied', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Fasteners')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Fasteners', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Extrusions')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Extrusions', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Powder Metal')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Powder Metal', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Grease')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Grease', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Explosives')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Explosives', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'O/S Process')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'O/S Process', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Chemicals')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Chemicals', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Magnets')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Magnets', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Springs')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Springs', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Directed Buy')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Directed Buy', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Harnesses')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Harnesses', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Resins')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Resins', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Service')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Service', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Controller')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Controller', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Labels')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Labels', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'Electronics MSB')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'Electronics MSB', N'seed-script');
IF NOT EXISTS (SELECT 1 FROM [C_Commodity] WHERE [Name] = N'TBD -- Pending GSM')
    INSERT INTO [C_Commodity] ([Name], [CreatedBy]) VALUES (N'TBD -- Pending GSM', N'seed-script');

GO

PRINT 'Catálogos sembrados. Continuar con 05_seed_users.sql.';
GO
