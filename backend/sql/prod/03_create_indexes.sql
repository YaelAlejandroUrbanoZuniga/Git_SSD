/* ============================================================================
   03_create_indexes.sql
   SSD Tracker Management App — Nexteer Automotive / GSM

   Crea los 18 índices no-clustered del modelo + los 2 filtered unique indexes de C_User.

   Generado automáticamente desde backend/prisma/schema.prisma (rama dev,
   commit 25df003). schema.prisma es la fuente de verdad del modelo; este
   script es su traducción a DDL de SQL Server. Si el schema cambia, este
   archivo se regenera — no se edita a mano.

   SQL Server NO indexa automáticamente las columnas FK (a diferencia de
   MySQL), así que estos índices no son opcionales.

   DOS DE ELLOS NO PUEDEN DECLARARSE EN PRISMA y por eso viven solo aquí:
   UQ_C_User_Email_Filtered y UQ_C_User_AdObjectId_Filtered. Razón: un UNIQUE
   normal en SQL Server tolera UNA sola fila con NULL en toda la tabla. Como
   AdObjectId es NULL en el 100% de los usuarios (el servicio LDAP desplegado
   no devuelve objectGUID) y Email también puede faltar, un @unique ahí hacía
   que el segundo INSERT reventara con error de constraint (P2002 en Prisma).
   La unicidad condicional — única cuando el valor SÍ existe — se implementa
   como filtered index. Por esta misma razón, todo lookup de usuario por email
   o adObjectId en el backend usa findFirst, nunca findUnique.

   ⚠ CONSECUENCIA OPERATIVA: `prisma db push` contra esta base DESTRUIRÍA
   estos dos índices, porque no existen en schema.prisma. Nunca correr db push
   contra MX_MFGIT_SSD. Es la regla que separa esta carpeta de TEST.

   LIMITACIÓN CONOCIDA — IX_SupplierHistory_Date_ToStage: el diseño original
   pedía FK_Supplier y FK_StageFrom como columnas INCLUDE, para que las dos
   consultas del módulo Reports no tuvieran que volver a la tabla base. Prisma
   no tiene sintaxis para INCLUDE en @@index en ningún proveedor, así que en
   TEST el índice existe sin ellas. Aquí SÍ se agregan (este script no pasa por
   Prisma), y esa es una diferencia deliberada y documentada entre TEST y PROD.
============================================================================ */

USE [MX_MFGIT_SSD];
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Supplier_Stage_Status' AND object_id = OBJECT_ID(N'[T_Supplier]'))
    CREATE NONCLUSTERED INDEX [IX_Supplier_Stage_Status] ON [T_Supplier] ([FK_Stage], [FK_SupplierStatus]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Supplier_Buyer' AND object_id = OBJECT_ID(N'[T_Supplier]'))
    CREATE NONCLUSTERED INDEX [IX_Supplier_Buyer] ON [T_Supplier] ([Buyer]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_CompanyInfo_DunsNumber' AND object_id = OBJECT_ID(N'[T_Supplier_CompanyInfo]'))
    CREATE NONCLUSTERED INDEX [IX_CompanyInfo_DunsNumber] ON [T_Supplier_CompanyInfo] ([DunsNumber]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SupplierDocument_Supplier' AND object_id = OBJECT_ID(N'[T_Supplier_Document]'))
    CREATE NONCLUSTERED INDEX [IX_SupplierDocument_Supplier] ON [T_Supplier_Document] ([FK_Supplier]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SupplierNote_Supplier' AND object_id = OBJECT_ID(N'[T_Supplier_Note]'))
    CREATE NONCLUSTERED INDEX [IX_SupplierNote_Supplier] ON [T_Supplier_Note] ([FK_Supplier]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SupplierHistory_Supplier' AND object_id = OBJECT_ID(N'[T_Supplier_History]'))
    CREATE NONCLUSTERED INDEX [IX_SupplierHistory_Supplier] ON [T_Supplier_History] ([FK_Supplier]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SupplierHistory_Date_ToStage' AND object_id = OBJECT_ID(N'[T_Supplier_History]'))
    CREATE NONCLUSTERED INDEX [IX_SupplierHistory_Date_ToStage] ON [T_Supplier_History] ([Date], [FK_StageTo]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SupplierPart_Supplier' AND object_id = OBJECT_ID(N'[T_Supplier_Part]'))
    CREATE NONCLUSTERED INDEX [IX_SupplierPart_Supplier] ON [T_Supplier_Part] ([FK_Supplier]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PrelimPart_Supplier' AND object_id = OBJECT_ID(N'[T_Supplier_PrelimPart]'))
    CREATE NONCLUSTERED INDEX [IX_PrelimPart_Supplier] ON [T_Supplier_PrelimPart] ([FK_Supplier]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Event_DateRange' AND object_id = OBJECT_ID(N'[T_Event]'))
    CREATE NONCLUSTERED INDEX [IX_Event_DateRange] ON [T_Event] ([DateStart], [DateEnd]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EventSupplierEntry_Supplier' AND object_id = OBJECT_ID(N'[T_Event_SupplierEntry]'))
    CREATE NONCLUSTERED INDEX [IX_EventSupplierEntry_Supplier] ON [T_Event_SupplierEntry] ([FK_Supplier]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EventB2BMeeting_Supplier' AND object_id = OBJECT_ID(N'[T_Event_B2BMeeting]'))
    CREATE NONCLUSTERED INDEX [IX_EventB2BMeeting_Supplier] ON [T_Event_B2BMeeting] ([FK_Supplier]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EventProspect_Event' AND object_id = OBJECT_ID(N'[T_Event_Prospect]'))
    CREATE NONCLUSTERED INDEX [IX_EventProspect_Event] ON [T_Event_Prospect] ([FK_Event]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EventProspect_ImportBatch' AND object_id = OBJECT_ID(N'[T_Event_Prospect]'))
    CREATE NONCLUSTERED INDEX [IX_EventProspect_ImportBatch] ON [T_Event_Prospect] ([FK_ImportBatch]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_RefreshToken_ExpiresAt' AND object_id = OBJECT_ID(N'[T_User_RefreshToken]'))
    CREATE NONCLUSTERED INDEX [IX_RefreshToken_ExpiresAt] ON [T_User_RefreshToken] ([ExpiresDt]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Notification_User_Read' AND object_id = OBJECT_ID(N'[T_User_Notification]'))
    CREATE NONCLUSTERED INDEX [IX_Notification_User_Read] ON [T_User_Notification] ([FK_User], [Read]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AuditLog_CreatedDt' AND object_id = OBJECT_ID(N'[T_Audit_Log]'))
    CREATE NONCLUSTERED INDEX [IX_AuditLog_CreatedDt] ON [T_Audit_Log] ([CreatedDt]);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AuditLog_User' AND object_id = OBJECT_ID(N'[T_Audit_Log]'))
    CREATE NONCLUSTERED INDEX [IX_AuditLog_User] ON [T_Audit_Log] ([FK_User]);
GO


/* ------------------------------------------------------------------------
   INCLUDE columns en el índice de Reports — ver nota del encabezado.
   Se recrea con DROP_EXISTING para no depender de si 03 ya corrió antes.
------------------------------------------------------------------------ */
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SupplierHistory_Date_ToStage' AND object_id = OBJECT_ID(N'[T_Supplier_History]'))
    AND NOT EXISTS (
        SELECT 1 FROM sys.index_columns ic
        JOIN sys.indexes i ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        WHERE i.name = N'IX_SupplierHistory_Date_ToStage' AND ic.is_included_column = 1)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SupplierHistory_Date_ToStage]
        ON [T_Supplier_History] ([Date], [FK_StageTo])
        INCLUDE ([FK_Supplier], [FK_StageFrom])
        WITH (DROP_EXISTING = ON);
    PRINT 'IX_SupplierHistory_Date_ToStage recreado con INCLUDE.';
END
GO

/* ------------------------------------------------------------------------
   Filtered unique indexes de C_User — NO declarables en Prisma.
------------------------------------------------------------------------ */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_C_User_Email_Filtered' AND object_id = OBJECT_ID(N'[C_User]'))
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_C_User_Email_Filtered]
        ON [C_User] ([Email]) WHERE [Email] IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_C_User_AdObjectId_Filtered' AND object_id = OBJECT_ID(N'[C_User]'))
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_C_User_AdObjectId_Filtered]
        ON [C_User] ([AdObjectId]) WHERE [AdObjectId] IS NOT NULL;
GO

PRINT 'Índices creados. Continuar con 04_seed_catalogs.sql.';
GO
