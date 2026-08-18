/* ============================================================================
   02_create_foreign_keys.sql
   SSD Tracker Management App — Nexteer Automotive / GSM

   Agrega las 44 llaves foráneas del modelo.

   Generado automáticamente desde backend/prisma/schema.prisma (rama dev,
   commit 25df003). schema.prisma es la fuente de verdad del modelo; este
   script es su traducción a DDL de SQL Server. Si el schema cambia, este
   archivo se regenera — no se edita a mano.

   Requiere que 01_create_tables.sql haya corrido completo sobre la misma base.
   Idempotente: cada constraint se verifica contra sys.foreign_keys antes de
   crearse.

   ON DELETE CASCADE se usa SOLO donde el schema lo declara: los satélites 1:1
   y las tablas hijas de T_Supplier, las hijas de T_Event, y las hijas de
   C_User. Todo lo demás es NO ACTION, incluidos los casos donde el schema fija
   NoAction explícitamente para evitar rutas de cascada múltiple — SQL Server
   las rechaza. Ejemplos: T_Event_SupplierEntry y T_Event_B2BMeeting tienen FK
   a Event Y a Supplier, y solo Event cascada.

   T_Audit_Log NO tiene FK aunque su columna se llame FK_User. Es deliberado:
   una fila de auditoría debe sobrevivir al usuario que describe, y un login
   fallido no tiene fila de usuario en absoluto. Conserva el nombre por
   consistencia de nomenclatura, sin constraint.
============================================================================ */

USE [MX_MFGIT_SSD];
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_C_User_FK_Role')
    ALTER TABLE [C_User] ADD CONSTRAINT [FK_C_User_FK_Role]
        FOREIGN KEY ([FK_Role]) REFERENCES [C_Role] ([PK_Role])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_FK_SupplierStatus')
    ALTER TABLE [T_Supplier] ADD CONSTRAINT [FK_T_Supplier_FK_SupplierStatus]
        FOREIGN KEY ([FK_SupplierStatus]) REFERENCES [C_SupplierStatus] ([PK_SupplierStatus])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_FK_Stage')
    ALTER TABLE [T_Supplier] ADD CONSTRAINT [FK_T_Supplier_FK_Stage]
        FOREIGN KEY ([FK_Stage]) REFERENCES [C_Stage] ([PK_Stage])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_FK_Commodity')
    ALTER TABLE [T_Supplier] ADD CONSTRAINT [FK_T_Supplier_FK_Commodity]
        FOREIGN KEY ([FK_Commodity]) REFERENCES [C_Commodity] ([PK_Commodity])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_FK_ProductCategory')
    ALTER TABLE [T_Supplier] ADD CONSTRAINT [FK_T_Supplier_FK_ProductCategory]
        FOREIGN KEY ([FK_ProductCategory]) REFERENCES [C_ProductCategory] ([PK_ProductCategory])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_FK_Sla')
    ALTER TABLE [T_Supplier] ADD CONSTRAINT [FK_T_Supplier_FK_Sla]
        FOREIGN KEY ([FK_Sla]) REFERENCES [C_Sla] ([PK_Sla])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_FK_GlobalSla')
    ALTER TABLE [T_Supplier] ADD CONSTRAINT [FK_T_Supplier_FK_GlobalSla]
        FOREIGN KEY ([FK_GlobalSla]) REFERENCES [C_Sla] ([PK_Sla])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_FK_SubStatus')
    ALTER TABLE [T_Supplier] ADD CONSTRAINT [FK_T_Supplier_FK_SubStatus]
        FOREIGN KEY ([FK_SubStatus]) REFERENCES [C_SubStatus] ([PK_SubStatus])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_CompanyInfo_FK_Supplier')
    ALTER TABLE [T_Supplier_CompanyInfo] ADD CONSTRAINT [FK_T_Supplier_CompanyInfo_FK_Supplier]
        FOREIGN KEY ([FK_Supplier]) REFERENCES [T_Supplier] ([PK_Supplier])
        ON DELETE CASCADE ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_TechnicalInfo_FK_Supplier')
    ALTER TABLE [T_Supplier_TechnicalInfo] ADD CONSTRAINT [FK_T_Supplier_TechnicalInfo_FK_Supplier]
        FOREIGN KEY ([FK_Supplier]) REFERENCES [T_Supplier] ([PK_Supplier])
        ON DELETE CASCADE ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_CommercialInfo_FK_Supplier')
    ALTER TABLE [T_Supplier_CommercialInfo] ADD CONSTRAINT [FK_T_Supplier_CommercialInfo_FK_Supplier]
        FOREIGN KEY ([FK_Supplier]) REFERENCES [T_Supplier] ([PK_Supplier])
        ON DELETE CASCADE ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_CommercialInfo_FK_ImmexStatus')
    ALTER TABLE [T_Supplier_CommercialInfo] ADD CONSTRAINT [FK_T_Supplier_CommercialInfo_FK_ImmexStatus]
        FOREIGN KEY ([FK_ImmexStatus]) REFERENCES [C_ImmexStatus] ([PK_ImmexStatus])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_CommercialInfo_FK_ConfidenceLevel')
    ALTER TABLE [T_Supplier_CommercialInfo] ADD CONSTRAINT [FK_T_Supplier_CommercialInfo_FK_ConfidenceLevel]
        FOREIGN KEY ([FK_ConfidenceLevel]) REFERENCES [C_ConfidenceLevel] ([PK_ConfidenceLevel])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_Document_FK_Supplier')
    ALTER TABLE [T_Supplier_Document] ADD CONSTRAINT [FK_T_Supplier_Document_FK_Supplier]
        FOREIGN KEY ([FK_Supplier]) REFERENCES [T_Supplier] ([PK_Supplier])
        ON DELETE CASCADE ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_Note_FK_Supplier')
    ALTER TABLE [T_Supplier_Note] ADD CONSTRAINT [FK_T_Supplier_Note_FK_Supplier]
        FOREIGN KEY ([FK_Supplier]) REFERENCES [T_Supplier] ([PK_Supplier])
        ON DELETE CASCADE ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_Note_FK_Stage')
    ALTER TABLE [T_Supplier_Note] ADD CONSTRAINT [FK_T_Supplier_Note_FK_Stage]
        FOREIGN KEY ([FK_Stage]) REFERENCES [C_Stage] ([PK_Stage])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_History_FK_Supplier')
    ALTER TABLE [T_Supplier_History] ADD CONSTRAINT [FK_T_Supplier_History_FK_Supplier]
        FOREIGN KEY ([FK_Supplier]) REFERENCES [T_Supplier] ([PK_Supplier])
        ON DELETE CASCADE ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_History_FK_StageFrom')
    ALTER TABLE [T_Supplier_History] ADD CONSTRAINT [FK_T_Supplier_History_FK_StageFrom]
        FOREIGN KEY ([FK_StageFrom]) REFERENCES [C_Stage] ([PK_Stage])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_History_FK_StageTo')
    ALTER TABLE [T_Supplier_History] ADD CONSTRAINT [FK_T_Supplier_History_FK_StageTo]
        FOREIGN KEY ([FK_StageTo]) REFERENCES [C_Stage] ([PK_Stage])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_Part_FK_Supplier')
    ALTER TABLE [T_Supplier_Part] ADD CONSTRAINT [FK_T_Supplier_Part_FK_Supplier]
        FOREIGN KEY ([FK_Supplier]) REFERENCES [T_Supplier] ([PK_Supplier])
        ON DELETE CASCADE ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_Part_FK_ConfidenceLevel')
    ALTER TABLE [T_Supplier_Part] ADD CONSTRAINT [FK_T_Supplier_Part_FK_ConfidenceLevel]
        FOREIGN KEY ([FK_ConfidenceLevel]) REFERENCES [C_ConfidenceLevel] ([PK_ConfidenceLevel])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_PrelimPart_FK_Supplier')
    ALTER TABLE [T_Supplier_PrelimPart] ADD CONSTRAINT [FK_T_Supplier_PrelimPart_FK_Supplier]
        FOREIGN KEY ([FK_Supplier]) REFERENCES [T_Supplier] ([PK_Supplier])
        ON DELETE CASCADE ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_PrelimPart_FK_ConfidenceLevel')
    ALTER TABLE [T_Supplier_PrelimPart] ADD CONSTRAINT [FK_T_Supplier_PrelimPart_FK_ConfidenceLevel]
        FOREIGN KEY ([FK_ConfidenceLevel]) REFERENCES [C_ConfidenceLevel] ([PK_ConfidenceLevel])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_ScoutingData_FK_Supplier')
    ALTER TABLE [T_Supplier_ScoutingData] ADD CONSTRAINT [FK_T_Supplier_ScoutingData_FK_Supplier]
        FOREIGN KEY ([FK_Supplier]) REFERENCES [T_Supplier] ([PK_Supplier])
        ON DELETE CASCADE ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_ParkingData_FK_Supplier')
    ALTER TABLE [T_Supplier_ParkingData] ADD CONSTRAINT [FK_T_Supplier_ParkingData_FK_Supplier]
        FOREIGN KEY ([FK_Supplier]) REFERENCES [T_Supplier] ([PK_Supplier])
        ON DELETE CASCADE ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_ParkingData_FK_SubStatus')
    ALTER TABLE [T_Supplier_ParkingData] ADD CONSTRAINT [FK_T_Supplier_ParkingData_FK_SubStatus]
        FOREIGN KEY ([FK_SubStatus]) REFERENCES [C_SubStatus] ([PK_SubStatus])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_PreliminaryData_FK_Supplier')
    ALTER TABLE [T_Supplier_PreliminaryData] ADD CONSTRAINT [FK_T_Supplier_PreliminaryData_FK_Supplier]
        FOREIGN KEY ([FK_Supplier]) REFERENCES [T_Supplier] ([PK_Supplier])
        ON DELETE CASCADE ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_PreliminaryData_FK_ImmexStatus')
    ALTER TABLE [T_Supplier_PreliminaryData] ADD CONSTRAINT [FK_T_Supplier_PreliminaryData_FK_ImmexStatus]
        FOREIGN KEY ([FK_ImmexStatus]) REFERENCES [C_ImmexStatus] ([PK_ImmexStatus])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_EvaluationData_FK_Supplier')
    ALTER TABLE [T_Supplier_EvaluationData] ADD CONSTRAINT [FK_T_Supplier_EvaluationData_FK_Supplier]
        FOREIGN KEY ([FK_Supplier]) REFERENCES [T_Supplier] ([PK_Supplier])
        ON DELETE CASCADE ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_IntelexData_FK_Supplier')
    ALTER TABLE [T_Supplier_IntelexData] ADD CONSTRAINT [FK_T_Supplier_IntelexData_FK_Supplier]
        FOREIGN KEY ([FK_Supplier]) REFERENCES [T_Supplier] ([PK_Supplier])
        ON DELETE CASCADE ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_Blacklist_FK_Supplier')
    ALTER TABLE [T_Supplier_Blacklist] ADD CONSTRAINT [FK_T_Supplier_Blacklist_FK_Supplier]
        FOREIGN KEY ([FK_Supplier]) REFERENCES [T_Supplier] ([PK_Supplier])
        ON DELETE CASCADE ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Supplier_Completion_FK_Supplier')
    ALTER TABLE [T_Supplier_Completion] ADD CONSTRAINT [FK_T_Supplier_Completion_FK_Supplier]
        FOREIGN KEY ([FK_Supplier]) REFERENCES [T_Supplier] ([PK_Supplier])
        ON DELETE CASCADE ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Event_FK_ProductCategory')
    ALTER TABLE [T_Event] ADD CONSTRAINT [FK_T_Event_FK_ProductCategory]
        FOREIGN KEY ([FK_ProductCategory]) REFERENCES [C_ProductCategory] ([PK_ProductCategory])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Event_SupplierEntry_FK_Event')
    ALTER TABLE [T_Event_SupplierEntry] ADD CONSTRAINT [FK_T_Event_SupplierEntry_FK_Event]
        FOREIGN KEY ([FK_Event]) REFERENCES [T_Event] ([PK_Event])
        ON DELETE CASCADE ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Event_SupplierEntry_FK_Supplier')
    ALTER TABLE [T_Event_SupplierEntry] ADD CONSTRAINT [FK_T_Event_SupplierEntry_FK_Supplier]
        FOREIGN KEY ([FK_Supplier]) REFERENCES [T_Supplier] ([PK_Supplier])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Event_B2BMeeting_FK_Event')
    ALTER TABLE [T_Event_B2BMeeting] ADD CONSTRAINT [FK_T_Event_B2BMeeting_FK_Event]
        FOREIGN KEY ([FK_Event]) REFERENCES [T_Event] ([PK_Event])
        ON DELETE CASCADE ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Event_B2BMeeting_FK_Supplier')
    ALTER TABLE [T_Event_B2BMeeting] ADD CONSTRAINT [FK_T_Event_B2BMeeting_FK_Supplier]
        FOREIGN KEY ([FK_Supplier]) REFERENCES [T_Supplier] ([PK_Supplier])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Event_Note_FK_Event')
    ALTER TABLE [T_Event_Note] ADD CONSTRAINT [FK_T_Event_Note_FK_Event]
        FOREIGN KEY ([FK_Event]) REFERENCES [T_Event] ([PK_Event])
        ON DELETE CASCADE ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Event_Prospect_FK_Event')
    ALTER TABLE [T_Event_Prospect] ADD CONSTRAINT [FK_T_Event_Prospect_FK_Event]
        FOREIGN KEY ([FK_Event]) REFERENCES [T_Event] ([PK_Event])
        ON DELETE CASCADE ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Event_Prospect_FK_InterestedByUser')
    ALTER TABLE [T_Event_Prospect] ADD CONSTRAINT [FK_T_Event_Prospect_FK_InterestedByUser]
        FOREIGN KEY ([FK_InterestedByUser]) REFERENCES [C_User] ([PK_User])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Strategy_Entry_FK_Commodity')
    ALTER TABLE [T_Strategy_Entry] ADD CONSTRAINT [FK_T_Strategy_Entry_FK_Commodity]
        FOREIGN KEY ([FK_Commodity]) REFERENCES [C_Commodity] ([PK_Commodity])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_Strategy_MrlRequirement_FK_Commodity')
    ALTER TABLE [T_Strategy_MrlRequirement] ADD CONSTRAINT [FK_T_Strategy_MrlRequirement_FK_Commodity]
        FOREIGN KEY ([FK_Commodity]) REFERENCES [C_Commodity] ([PK_Commodity])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_User_RefreshToken_FK_User')
    ALTER TABLE [T_User_RefreshToken] ADD CONSTRAINT [FK_T_User_RefreshToken_FK_User]
        FOREIGN KEY ([FK_User]) REFERENCES [C_User] ([PK_User])
        ON DELETE CASCADE ON UPDATE NO ACTION;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_T_User_Notification_FK_User')
    ALTER TABLE [T_User_Notification] ADD CONSTRAINT [FK_T_User_Notification_FK_User]
        FOREIGN KEY ([FK_User]) REFERENCES [C_User] ([PK_User])
        ON DELETE CASCADE ON UPDATE NO ACTION;
GO

PRINT 'Llaves foráneas creadas. Continuar con 03_create_indexes.sql.';
GO
