/* ============================================================================
   01_create_tables.sql
   SSD Tracker Management App — Nexteer Automotive / GSM

   Crea las 36 tablas del modelo, en 7 dominios.

   Generado automáticamente desde backend/prisma/schema.prisma (rama dev,
   commit 25df003). schema.prisma es la fuente de verdad del modelo; este
   script es su traducción a DDL de SQL Server. Si el schema cambia, este
   archivo se regenera — no se edita a mano.

   EXCEPCIÓN, 2026-08-24: las 15 columnas de perfil alineadas con el MS Form
   externo se agregaron a mano a T_Supplier_CompanyInfo (+5),
   T_Supplier_TechnicalInfo (+3) y T_Supplier_CommercialInfo (+7), porque
   producción todavía no existe y tiene que nacer con ellas. Están en
   schema.prisma con el mismo nombre, tipo y ancho, así que una regeneración
   futura las reproduce; si regeneras, verifica que sigan aquí. Motivo del
   cambio: ../CAMBIOS_ESQUEMA.md.

   EXCEPCIÓN, 2026-08-31: [SsdLeader] y [SdeLeader] se agregaron a mano a
   T_Supplier_PreliminaryData (+2) por la misma razón — producción todavía no
   existe y tiene que nacer con ellas. También están en schema.prisma.

   Si regeneras, verifica que 06 siga esperando 461 columnas.

   Idempotente: cada CREATE TABLE está protegido por OBJECT_ID, así que
   re-ejecutar el script completo no falla ni destruye nada. NO actualiza una
   tabla que ya exista con una forma distinta — para eso van los scripts
   fechados de backend/sql/.

   Las llaves foráneas van en 02, los índices en 03. Por eso el orden de
   creación de tablas aquí es indistinto y sigue el orden lógico del modelo,
   no el de dependencias.

   NOTAS DE MODELADO (heredadas de las limitaciones de Prisma en SQL Server):
    - No hay ENUM: los vocabularios controlados (etapa, rol, sub-estado,
      commodity) son NVARCHAR validados en la capa de servicio
      (backend/src/domain/constants.ts).
    - No hay JSON: los objetos de tabs completados y los volúmenes por año se
      aplanan en columnas escalares.
    - Muchos campos "fecha" son NVARCHAR porque el contrato del frontend
      transporta valores no-fecha ('2031', 'TBC', '-'). Solo los timestamps de
      sistema (CreatedDt, UpdatedDt, ExpiresDt, StageEnteredAt) son DATETIME2.
============================================================================ */

USE [MX_MFGIT_SSD];
GO


/* ------------------------------------------------------------------------
   DOMINIO 0 — Catálogos (C_)
------------------------------------------------------------------------ */

IF OBJECT_ID(N'[C_Commodity]', N'U') IS NULL
BEGIN
    CREATE TABLE [C_Commodity] (
        [PK_Commodity] INT IDENTITY(1,1) NOT NULL,
        [Name] NVARCHAR(100) NOT NULL,
        [CreatedBy] NVARCHAR(100) NOT NULL,
        [CreatedDt] DATETIME2 NOT NULL CONSTRAINT [DF_C_Commodity_CreatedDt] DEFAULT CURRENT_TIMESTAMP,
        [UpdatedBy] NVARCHAR(100) NULL,
        [UpdatedDt] DATETIME2 NULL,
        CONSTRAINT [PK_C_Commodity] PRIMARY KEY CLUSTERED ([PK_Commodity]),
        CONSTRAINT [UQ_C_Commodity_Name] UNIQUE NONCLUSTERED ([Name])
    );
END
GO

IF OBJECT_ID(N'[C_Stage]', N'U') IS NULL
BEGIN
    CREATE TABLE [C_Stage] (
        [PK_Stage] INT IDENTITY(1,1) NOT NULL,
        [Name] NVARCHAR(50) NOT NULL,
        [SortOrder] INT NOT NULL,
        [CreatedBy] NVARCHAR(100) NOT NULL,
        [CreatedDt] DATETIME2 NOT NULL CONSTRAINT [DF_C_Stage_CreatedDt] DEFAULT CURRENT_TIMESTAMP,
        [UpdatedBy] NVARCHAR(100) NULL,
        [UpdatedDt] DATETIME2 NULL,
        CONSTRAINT [PK_C_Stage] PRIMARY KEY CLUSTERED ([PK_Stage]),
        CONSTRAINT [UQ_C_Stage_Name] UNIQUE NONCLUSTERED ([Name])
    );
END
GO

IF OBJECT_ID(N'[C_SupplierStatus]', N'U') IS NULL
BEGIN
    CREATE TABLE [C_SupplierStatus] (
        [PK_SupplierStatus] INT IDENTITY(1,1) NOT NULL,
        [Name] NVARCHAR(20) NOT NULL,
        [CreatedBy] NVARCHAR(100) NOT NULL,
        [CreatedDt] DATETIME2 NOT NULL CONSTRAINT [DF_C_SupplierStatus_CreatedDt] DEFAULT CURRENT_TIMESTAMP,
        [UpdatedBy] NVARCHAR(100) NULL,
        [UpdatedDt] DATETIME2 NULL,
        CONSTRAINT [PK_C_SupplierStatus] PRIMARY KEY CLUSTERED ([PK_SupplierStatus]),
        CONSTRAINT [UQ_C_SupplierStatus_Name] UNIQUE NONCLUSTERED ([Name])
    );
END
GO

IF OBJECT_ID(N'[C_SubStatus]', N'U') IS NULL
BEGIN
    CREATE TABLE [C_SubStatus] (
        [PK_SubStatus] INT IDENTITY(1,1) NOT NULL,
        [Name] NVARCHAR(30) NOT NULL,
        [CreatedBy] NVARCHAR(100) NOT NULL,
        [CreatedDt] DATETIME2 NOT NULL CONSTRAINT [DF_C_SubStatus_CreatedDt] DEFAULT CURRENT_TIMESTAMP,
        [UpdatedBy] NVARCHAR(100) NULL,
        [UpdatedDt] DATETIME2 NULL,
        CONSTRAINT [PK_C_SubStatus] PRIMARY KEY CLUSTERED ([PK_SubStatus]),
        CONSTRAINT [UQ_C_SubStatus_Name] UNIQUE NONCLUSTERED ([Name])
    );
END
GO

IF OBJECT_ID(N'[C_Sla]', N'U') IS NULL
BEGIN
    CREATE TABLE [C_Sla] (
        [PK_Sla] INT IDENTITY(1,1) NOT NULL,
        [Name] NVARCHAR(10) NOT NULL,
        [ColorHex] NVARCHAR(7) NULL,
        [CreatedBy] NVARCHAR(100) NOT NULL,
        [CreatedDt] DATETIME2 NOT NULL CONSTRAINT [DF_C_Sla_CreatedDt] DEFAULT CURRENT_TIMESTAMP,
        [UpdatedBy] NVARCHAR(100) NULL,
        [UpdatedDt] DATETIME2 NULL,
        CONSTRAINT [PK_C_Sla] PRIMARY KEY CLUSTERED ([PK_Sla]),
        CONSTRAINT [UQ_C_Sla_Name] UNIQUE NONCLUSTERED ([Name])
    );
END
GO

IF OBJECT_ID(N'[C_ProductCategory]', N'U') IS NULL
BEGIN
    CREATE TABLE [C_ProductCategory] (
        [PK_ProductCategory] INT IDENTITY(1,1) NOT NULL,
        [Name] NVARCHAR(10) NOT NULL,
        [CreatedBy] NVARCHAR(100) NOT NULL,
        [CreatedDt] DATETIME2 NOT NULL CONSTRAINT [DF_C_ProductCategory_CreatedDt] DEFAULT CURRENT_TIMESTAMP,
        [UpdatedBy] NVARCHAR(100) NULL,
        [UpdatedDt] DATETIME2 NULL,
        CONSTRAINT [PK_C_ProductCategory] PRIMARY KEY CLUSTERED ([PK_ProductCategory]),
        CONSTRAINT [UQ_C_ProductCategory_Name] UNIQUE NONCLUSTERED ([Name])
    );
END
GO

IF OBJECT_ID(N'[C_ConfidenceLevel]', N'U') IS NULL
BEGIN
    CREATE TABLE [C_ConfidenceLevel] (
        [PK_ConfidenceLevel] INT IDENTITY(1,1) NOT NULL,
        [Code] NVARCHAR(3) NOT NULL,
        [Label] NVARCHAR(20) NOT NULL,
        [SortOrder] INT NOT NULL,
        [CreatedBy] NVARCHAR(100) NOT NULL,
        [CreatedDt] DATETIME2 NOT NULL CONSTRAINT [DF_C_ConfidenceLevel_CreatedDt] DEFAULT CURRENT_TIMESTAMP,
        [UpdatedBy] NVARCHAR(100) NULL,
        [UpdatedDt] DATETIME2 NULL,
        CONSTRAINT [PK_C_ConfidenceLevel] PRIMARY KEY CLUSTERED ([PK_ConfidenceLevel]),
        CONSTRAINT [UQ_C_ConfidenceLevel_Code] UNIQUE NONCLUSTERED ([Code]),
        CONSTRAINT [UQ_C_ConfidenceLevel_Label] UNIQUE NONCLUSTERED ([Label])
    );
END
GO

IF OBJECT_ID(N'[C_ImmexStatus]', N'U') IS NULL
BEGIN
    CREATE TABLE [C_ImmexStatus] (
        [PK_ImmexStatus] INT IDENTITY(1,1) NOT NULL,
        [Name] NVARCHAR(20) NOT NULL,
        [CreatedBy] NVARCHAR(100) NOT NULL,
        [CreatedDt] DATETIME2 NOT NULL CONSTRAINT [DF_C_ImmexStatus_CreatedDt] DEFAULT CURRENT_TIMESTAMP,
        [UpdatedBy] NVARCHAR(100) NULL,
        [UpdatedDt] DATETIME2 NULL,
        CONSTRAINT [PK_C_ImmexStatus] PRIMARY KEY CLUSTERED ([PK_ImmexStatus]),
        CONSTRAINT [UQ_C_ImmexStatus_Name] UNIQUE NONCLUSTERED ([Name])
    );
END
GO

IF OBJECT_ID(N'[C_Role]', N'U') IS NULL
BEGIN
    CREATE TABLE [C_Role] (
        [PK_Role] INT IDENTITY(1,1) NOT NULL,
        [Name] NVARCHAR(20) NOT NULL,
        [CreatedBy] NVARCHAR(100) NOT NULL,
        [CreatedDt] DATETIME2 NOT NULL CONSTRAINT [DF_C_Role_CreatedDt] DEFAULT CURRENT_TIMESTAMP,
        [UpdatedBy] NVARCHAR(100) NULL,
        [UpdatedDt] DATETIME2 NULL,
        CONSTRAINT [PK_C_Role] PRIMARY KEY CLUSTERED ([PK_Role]),
        CONSTRAINT [UQ_C_Role_Name] UNIQUE NONCLUSTERED ([Name])
    );
END
GO

IF OBJECT_ID(N'[C_User]', N'U') IS NULL
BEGIN
    CREATE TABLE [C_User] (
        [PK_User] NVARCHAR(50) NOT NULL,
        [Username] NVARCHAR(100) NOT NULL,
        [DisplayName] NVARCHAR(100) NOT NULL,
        [Email] NVARCHAR(200) NULL,
        [AdObjectId] NVARCHAR(100) NULL,
        [FK_Role] INT NOT NULL,
        [SupervisorName] NVARCHAR(100) NULL,
        [CreatedDt] DATETIME2 NOT NULL CONSTRAINT [DF_C_User_CreatedDt] DEFAULT CURRENT_TIMESTAMP,
        [LastLoginDt] DATETIME2 NULL,
        CONSTRAINT [PK_C_User] PRIMARY KEY CLUSTERED ([PK_User]),
        CONSTRAINT [UQ_C_User_Username] UNIQUE NONCLUSTERED ([Username])
    );
END
GO


/* ------------------------------------------------------------------------
   DOMINIO 1 — Supplier (núcleo)
------------------------------------------------------------------------ */

IF OBJECT_ID(N'[T_Supplier]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Supplier] (
        [PK_Supplier] NVARCHAR(50) NOT NULL,
        [Folio] NVARCHAR(50) NOT NULL,
        [Name] NVARCHAR(200) NOT NULL,
        [FK_SupplierStatus] INT NOT NULL,
        [FK_Stage] INT NOT NULL,
        [StageBeforeExit] NVARCHAR(50) NULL,
        [ScoutingPhase] NVARCHAR(20) NULL,
        [EntrySource] NVARCHAR(30) NOT NULL,
        [FK_Commodity] INT NOT NULL,
        [FK_ProductCategory] INT NOT NULL,
        [ProductType] NVARCHAR(200) NOT NULL,
        [Country] NVARCHAR(100) NOT NULL,
        [ManufacturingAddress] NVARCHAR(300) NOT NULL,
        [Buyer] NVARCHAR(100) NOT NULL,
        [ScoutingInput] NVARCHAR(200) NOT NULL,
        [DaysInStage] INT NOT NULL CONSTRAINT [DF_T_Supplier_DaysInStage] DEFAULT 0,
        [DaysSinceParkingLot] INT NULL,
        [DocsPercent] INT NOT NULL CONSTRAINT [DF_T_Supplier_DocsPercent] DEFAULT 0,
        [FK_Sla] INT NOT NULL,
        [FK_GlobalSla] INT NULL,
        [FK_SubStatus] INT NULL,
        [OnboardingDate] NVARCHAR(30) NOT NULL,
        [StageEnteredAt] DATETIME2 NULL,
        [PreEvalStartDate] NVARCHAR(30) NULL,
        [InitialQuoteSubmitted] BIT NOT NULL CONSTRAINT [DF_T_Supplier_InitialQuoteSubmitted] DEFAULT 0,
        [QadPrice] NVARCHAR(50) NULL,
        [SavingExpected] NVARCHAR(50) NULL,
        [Tooling] NVARCHAR(50) NULL,
        [SelectedForDevelopment] BIT NOT NULL CONSTRAINT [DF_T_Supplier_SelectedForDevelopment] DEFAULT 0,
        [InvestigateRecordNumber] NVARCHAR(100) NULL,
        [IntelexDate] NVARCHAR(30) NULL,
        [CreatedDt] DATETIME2 NOT NULL CONSTRAINT [DF_T_Supplier_CreatedDt] DEFAULT CURRENT_TIMESTAMP,
        [UpdatedDt] DATETIME2 NOT NULL CONSTRAINT [DF_T_Supplier_UpdatedDt] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [PK_T_Supplier] PRIMARY KEY CLUSTERED ([PK_Supplier]),
        CONSTRAINT [UQ_T_Supplier_Folio] UNIQUE NONCLUSTERED ([Folio])
    );
END
GO

IF OBJECT_ID(N'[T_Supplier_CompanyInfo]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Supplier_CompanyInfo] (
        [FK_Supplier] NVARCHAR(50) NOT NULL,
        [FullName] NVARCHAR(300) NOT NULL,
        [DunsNumber] NVARCHAR(50) NOT NULL,
        [TaxIdNumber] NVARCHAR(50) NULL,
        [RecommendedBy] NVARCHAR(100) NULL,
        [RecommenderDept] NVARCHAR(100) NULL,
        [CompanyType] NVARCHAR(50) NOT NULL,
        [FoundedYear] INT NOT NULL,
        [Headquarters] NVARCHAR(300) NOT NULL,
        [Website] NVARCHAR(300) NOT NULL,
        [Phone] NVARCHAR(50) NOT NULL,
        [ContactEmail] NVARCHAR(200) NOT NULL,
        [ContactName] NVARCHAR(100) NOT NULL,
        -- Respuestas del MS Form externo (2026-08-24). Las cuatro primeras son
        -- gemelas deliberadas de columnas homónimas en T_Supplier_PreliminaryData.
        [HqCity] NVARCHAR(100) NULL,
        [HqCountry] NVARCHAR(100) NULL,
        [ManufacturingCity] NVARCHAR(100) NULL,
        [GeneralManager] NVARCHAR(100) NULL,
        [FirstContactWithNexteer] BIT NULL,
        CONSTRAINT [PK_T_Supplier_CompanyInfo] PRIMARY KEY CLUSTERED ([FK_Supplier])
    );
END
GO

IF OBJECT_ID(N'[T_Supplier_TechnicalInfo]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Supplier_TechnicalInfo] (
        [FK_Supplier] NVARCHAR(50) NOT NULL,
        [Technology] NVARCHAR(200) NOT NULL,
        [MachineryType] NVARCHAR(200) NOT NULL,
        [ProcessMethod] NVARCHAR(200) NOT NULL,
        [PressCapacity] NVARCHAR(100) NOT NULL,
        [Materials] NVARCHAR(300) NOT NULL,
        [ComplementaryOperations] NVARCHAR(300) NULL,
        [SafetyCritical] BIT NOT NULL CONSTRAINT [DF_T_Supplier_TechnicalInfo_SafetyCritical] DEFAULT 0,
        [SafetyExperience] BIT NOT NULL CONSTRAINT [DF_T_Supplier_TechnicalInfo_SafetyExperience] DEFAULT 0,
        [Certifications] NVARCHAR(300) NOT NULL,
        [KnowsCQIs] BIT NOT NULL CONSTRAINT [DF_T_Supplier_TechnicalInfo_KnowsCQIs] DEFAULT 0,
        -- Respuestas del MS Form externo (2026-08-24); gemelas deliberadas de
        -- columnas homónimas en T_Supplier_PreliminaryData.
        [ToolingDesign] NVARCHAR(100) NULL,
        [RawMaterialIndex] NVARCHAR(200) NULL,
        [Applications] NVARCHAR(300) NULL,
        CONSTRAINT [PK_T_Supplier_TechnicalInfo] PRIMARY KEY CLUSTERED ([FK_Supplier])
    );
END
GO

IF OBJECT_ID(N'[T_Supplier_CommercialInfo]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Supplier_CommercialInfo] (
        [FK_Supplier] NVARCHAR(50) NOT NULL,
        [AnnualRevenue] NVARCHAR(50) NOT NULL,
        [ProductionVolume] NVARCHAR(100) NOT NULL,
        [Employees] INT NOT NULL,
        [Facilities] INT NOT NULL,
        [TopCustomers] NVARCHAR(300) NOT NULL,
        [FK_ImmexStatus] INT NOT NULL,
        [ExportCapability] NVARCHAR(300) NOT NULL,
        [Strengths] NVARCHAR(1000) NOT NULL,
        [Weaknesses] NVARCHAR(1000) NOT NULL,
        [Observations] NVARCHAR(1000) NOT NULL,
        [Recommendations] NVARCHAR(1000) NOT NULL,
        [Priority] INT NOT NULL CONSTRAINT [DF_T_Supplier_CommercialInfo_Priority] DEFAULT 2,
        [PrimaryDriver] NVARCHAR(100) NOT NULL,
        [FK_ConfidenceLevel] INT NOT NULL,
        -- Respuestas del MS Form externo (2026-08-24). Las tres primeras son
        -- gemelas deliberadas de columnas homónimas en T_Supplier_PreliminaryData;
        -- las cuatro últimas son nuevas. [ExportCapability] arriba se conserva y
        -- se sigue derivando ('true'/'false') a partir de las dos de exportación.
        [Footprint] NVARCHAR(100) NULL,
        [YearsInMexico] INT NULL,
        [Market] NVARCHAR(100) NULL,
        [BusinessSector] NVARCHAR(100) NULL,
        [AutomotivePercent] INT NULL,
        [ExportLocalContentPercent] INT NULL,
        [ExportDestinationCountries] NVARCHAR(300) NULL,
        CONSTRAINT [PK_T_Supplier_CommercialInfo] PRIMARY KEY CLUSTERED ([FK_Supplier])
    );
END
GO

IF OBJECT_ID(N'[T_Supplier_Document]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Supplier_Document] (
        [PK_Supplier_Document] INT IDENTITY(1,1) NOT NULL,
        [FK_Supplier] NVARCHAR(50) NOT NULL,
        [Name] NVARCHAR(100) NOT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [Date] NVARCHAR(30) NULL,
        [Link] NVARCHAR(500) NULL,
        CONSTRAINT [PK_T_Supplier_Document] PRIMARY KEY CLUSTERED ([PK_Supplier_Document])
    );
END
GO

IF OBJECT_ID(N'[T_Supplier_Note]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Supplier_Note] (
        [PK_Supplier_Note] NVARCHAR(80) NOT NULL,
        [FK_Supplier] NVARCHAR(50) NOT NULL,
        [Text] NVARCHAR(2000) NOT NULL,
        [Author] NVARCHAR(100) NOT NULL,
        [FK_AuthorUser] NVARCHAR(50) NULL,
        [Role] NVARCHAR(50) NOT NULL,
        [Date] NVARCHAR(30) NOT NULL,
        [FK_Stage] INT NOT NULL,
        [CreatedDt] DATETIME2 NOT NULL CONSTRAINT [DF_T_Supplier_Note_CreatedDt] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [PK_T_Supplier_Note] PRIMARY KEY CLUSTERED ([PK_Supplier_Note])
    );
END
GO

IF OBJECT_ID(N'[T_Supplier_History]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Supplier_History] (
        [PK_Supplier_History] INT IDENTITY(1,1) NOT NULL,
        [FK_Supplier] NVARCHAR(50) NOT NULL,
        [Date] NVARCHAR(30) NOT NULL,
        [Action] NVARCHAR(500) NOT NULL,
        [User] NVARCHAR(100) NOT NULL,
        [Role] NVARCHAR(50) NOT NULL,
        [Note] NVARCHAR(500) NULL,
        [FK_StageFrom] INT NULL,
        [FK_StageTo] INT NULL,
        [CreatedDt] DATETIME2 NOT NULL CONSTRAINT [DF_T_Supplier_History_CreatedDt] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [PK_T_Supplier_History] PRIMARY KEY CLUSTERED ([PK_Supplier_History])
    );
END
GO

IF OBJECT_ID(N'[T_Supplier_Part]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Supplier_Part] (
        [PK_Supplier_Part] INT IDENTITY(1,1) NOT NULL,
        [FK_Supplier] NVARCHAR(50) NOT NULL,
        [PartNumber] NVARCHAR(100) NOT NULL,
        [PartDescription] NVARCHAR(300) NOT NULL,
        [Pl] NVARCHAR(50) NOT NULL,
        [PeakVolume] INT NOT NULL,
        [Program] NVARCHAR(100) NOT NULL,
        [Eop] NVARCHAR(20) NOT NULL,
        [TargetPrice] FLOAT(53) NOT NULL,
        [RfqPrice] FLOAT(53) NOT NULL,
        [FK_ConfidenceLevel] INT NOT NULL,
        CONSTRAINT [PK_T_Supplier_Part] PRIMARY KEY CLUSTERED ([PK_Supplier_Part])
    );
END
GO

IF OBJECT_ID(N'[T_Supplier_PrelimPart]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Supplier_PrelimPart] (
        [PK_Supplier_PrelimPart] INT IDENTITY(1,1) NOT NULL,
        [FK_Supplier] NVARCHAR(50) NOT NULL,
        [PartNumber] NVARCHAR(100) NOT NULL,
        [PartDescription] NVARCHAR(300) NOT NULL,
        [Pl] NVARCHAR(50) NOT NULL,
        [AnnualPeakVolume] INT NULL,
        [Program] NVARCHAR(100) NOT NULL,
        [Eop] NVARCHAR(20) NOT NULL,
        [InitialQuote] FLOAT(53) NULL,
        [QadPrice] FLOAT(53) NULL,
        [Delta] FLOAT(53) NULL,
        [Tooling] FLOAT(53) NULL,
        [SavingExpected] FLOAT(53) NULL,
        [FK_ConfidenceLevel] INT NULL,
        CONSTRAINT [PK_T_Supplier_PrelimPart] PRIMARY KEY CLUSTERED ([PK_Supplier_PrelimPart])
    );
END
GO


/* ------------------------------------------------------------------------
   DOMINIO 2 — Satélites por etapa (1:1 con T_Supplier)
------------------------------------------------------------------------ */

IF OBJECT_ID(N'[T_Supplier_ScoutingData]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Supplier_ScoutingData] (
        [FK_Supplier] NVARCHAR(50) NOT NULL,
        [TabScoutingEvent] BIT NOT NULL CONSTRAINT [DF_T_Supplier_ScoutingData_TabScoutingEvent] DEFAULT 0,
        [TabSupplierInfo] BIT NOT NULL CONSTRAINT [DF_T_Supplier_ScoutingData_TabSupplierInfo] DEFAULT 0,
        [TabAttendees] BIT NOT NULL CONSTRAINT [DF_T_Supplier_ScoutingData_TabAttendees] DEFAULT 0,
        [TabAgenda] BIT NOT NULL CONSTRAINT [DF_T_Supplier_ScoutingData_TabAgenda] DEFAULT 0,
        [TabNextStep] BIT NOT NULL CONSTRAINT [DF_T_Supplier_ScoutingData_TabNextStep] DEFAULT 0,
        [B2bStatus] NVARCHAR(5) NULL,
        [B2bWhoAttends] NVARCHAR(300) NULL,
        [B2bManager] NVARCHAR(100) NULL,
        [B2bBuyer] NVARCHAR(100) NULL,
        [B2bComments] NVARCHAR(1000) NULL,
        [AgendaStatus] NVARCHAR(50) NULL,
        [AgendaTeamsLink] NVARCHAR(500) NULL,
        [AgendaScheduledDate] NVARCHAR(30) NULL,
        [AgendaTimezone] NVARCHAR(20) NULL,
        [AgendaStand] NVARCHAR(50) NULL,
        [AgendaStartTime] NVARCHAR(20) NULL,
        [AgendaEndTime] NVARCHAR(20) NULL,
        [AgendaDuration] NVARCHAR(20) NULL,
        [SelectedForParking] BIT NULL,
        [SelectionReason] NVARCHAR(1000) NULL,
        CONSTRAINT [PK_T_Supplier_ScoutingData] PRIMARY KEY CLUSTERED ([FK_Supplier])
    );
END
GO

IF OBJECT_ID(N'[T_Supplier_ParkingData]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Supplier_ParkingData] (
        [FK_Supplier] NVARCHAR(50) NOT NULL,
        [OnboardingDate] NVARCHAR(30) NULL,
        [Timeless] BIT NOT NULL CONSTRAINT [DF_T_Supplier_ParkingData_Timeless] DEFAULT 0,
        [DateToMovePreliminary] NVARCHAR(30) NULL,
        [ScoutingInput] NVARCHAR(200) NULL,
        [FK_SubStatus] INT NULL,
        [IsRecommendation] BIT NOT NULL CONSTRAINT [DF_T_Supplier_ParkingData_IsRecommendation] DEFAULT 0,
        [Buyer] NVARCHAR(100) NULL,
        [CompanyName] NVARCHAR(200) NULL,
        [B2bMeeting] NVARCHAR(5) NULL,
        [Name1] NVARCHAR(100) NULL,
        [Website] NVARCHAR(300) NULL,
        [Email1] NVARCHAR(200) NULL,
        [Phone] NVARCHAR(50) NULL,
        [Commodity] NVARCHAR(100) NULL,
        [ProductType] NVARCHAR(200) NULL,
        [ManufacturingCountry] NVARCHAR(100) NULL,
        [ManufacturingAddress] NVARCHAR(300) NULL,
        [AdditionalComments] NVARCHAR(2000) NULL,
        [HasTabs] BIT NOT NULL CONSTRAINT [DF_T_Supplier_ParkingData_HasTabs] DEFAULT 0,
        [TabOverview] BIT NOT NULL CONSTRAINT [DF_T_Supplier_ParkingData_TabOverview] DEFAULT 0,
        [TabContact] BIT NOT NULL CONSTRAINT [DF_T_Supplier_ParkingData_TabContact] DEFAULT 0,
        [TabDetails] BIT NOT NULL CONSTRAINT [DF_T_Supplier_ParkingData_TabDetails] DEFAULT 0,
        CONSTRAINT [PK_T_Supplier_ParkingData] PRIMARY KEY CLUSTERED ([FK_Supplier])
    );
END
GO

IF OBJECT_ID(N'[T_Supplier_PreliminaryData]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Supplier_PreliminaryData] (
        [FK_Supplier] NVARCHAR(50) NOT NULL,
        [HasTabs] BIT NOT NULL CONSTRAINT [DF_T_Supplier_PreliminaryData_HasTabs] DEFAULT 0,
        [TabOverview] BIT NOT NULL CONSTRAINT [DF_T_Supplier_PreliminaryData_TabOverview] DEFAULT 0,
        [TabCapabilities] BIT NOT NULL CONSTRAINT [DF_T_Supplier_PreliminaryData_TabCapabilities] DEFAULT 0,
        [StartDate] NVARCHAR(30) NULL,
        [Priority] INT NULL,
        [ScoutingInput] NVARCHAR(200) NULL,
        [Buyer] NVARCHAR(100) NULL,
        [Commodity] NVARCHAR(100) NULL,
        [PrimaryDriver] NVARCHAR(100) NULL,
        -- Líderes de la etapa (2026-08-31). Guardan el NOMBRE como texto, no un
        -- FK a C_User: dar de baja a un usuario no debe romper el histórico, y
        -- SDE Leader es texto libre por definición. Ambas opcionales.
        [SsdLeader] NVARCHAR(100) NULL,
        [SdeLeader] NVARCHAR(100) NULL,
        [CompanyName] NVARCHAR(300) NULL,
        [DunsNumber] NVARCHAR(50) NULL,
        [HqAddress] NVARCHAR(300) NULL,
        [HqCity] NVARCHAR(100) NULL,
        [HqCountry] NVARCHAR(100) NULL,
        [ManufacturingAddress] NVARCHAR(300) NULL,
        [ManufacturingCity] NVARCHAR(100) NULL,
        [ManufacturingCountry] NVARCHAR(100) NULL,
        [CompanyType] NVARCHAR(50) NULL,
        [FoundedYear] INT NULL,
        [Footprint] NVARCHAR(100) NULL,
        [YearsInMexico] INT NULL,
        [Facilities] INT NULL,
        [Employees] INT NULL,
        [AnnualRevenue] NVARCHAR(50) NULL,
        [ProductionVolume] NVARCHAR(100) NULL,
        [MainTechnology] NVARCHAR(200) NULL,
        [PressCapacity] NVARCHAR(100) NULL,
        [GeneralManager] NVARCHAR(100) NULL,
        [Market] NVARCHAR(100) NULL,
        [TopCustomers] NVARCHAR(300) NULL,
        [ExportCapability] NVARCHAR(300) NULL,
        [Certifications] NVARCHAR(300) NULL,
        [FK_ImmexStatus] INT NULL,
        [PlanToGetIMMEX] NVARCHAR(5) NULL,
        [MachineryType] NVARCHAR(200) NULL,
        [ProcessingMethod] NVARCHAR(200) NULL,
        [ComplementaryOps] NVARCHAR(300) NULL,
        [ToolingDesign] NVARCHAR(100) NULL,
        [Materials] NVARCHAR(300) NULL,
        [RawMaterialIndex] NVARCHAR(200) NULL,
        [Applications] NVARCHAR(300) NULL,
        CONSTRAINT [PK_T_Supplier_PreliminaryData] PRIMARY KEY CLUSTERED ([FK_Supplier])
    );
END
GO

IF OBJECT_ID(N'[T_Supplier_EvaluationData]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Supplier_EvaluationData] (
        [FK_Supplier] NVARCHAR(50) NOT NULL,
        [HasTabs] BIT NOT NULL CONSTRAINT [DF_T_Supplier_EvaluationData_HasTabs] DEFAULT 0,
        [TabCompetitiveness] BIT NOT NULL CONSTRAINT [DF_T_Supplier_EvaluationData_TabCompetitiveness] DEFAULT 0,
        [TabFundamentals] BIT NOT NULL CONSTRAINT [DF_T_Supplier_EvaluationData_TabFundamentals] DEFAULT 0,
        [TabVisit] BIT NOT NULL CONSTRAINT [DF_T_Supplier_EvaluationData_TabVisit] DEFAULT 0,
        [RfqReceived] NVARCHAR(5) NULL,
        [NdaSigned] NVARCHAR(5) NULL,
        [TcsSigned] NVARCHAR(5) NULL,
        [TtcsSigned] NVARCHAR(5) NULL,
        [NsrSigned] NVARCHAR(5) NULL,
        [SdaSigned] NVARCHAR(5) NULL,
        [CostModel] NVARCHAR(5) NULL,
        [VisitDatePlanned] NVARCHAR(30) NULL,
        [VisitDateCompleted] NVARCHAR(30) NULL,
        [VisitParticipants] NVARCHAR(300) NULL,
        [Strengths] NVARCHAR(1000) NULL,
        [Weaknesses] NVARCHAR(1000) NULL,
        [Observations] NVARCHAR(1000) NULL,
        [Recommendations] NVARCHAR(1000) NULL,
        CONSTRAINT [PK_T_Supplier_EvaluationData] PRIMARY KEY CLUSTERED ([FK_Supplier])
    );
END
GO

IF OBJECT_ID(N'[T_Supplier_IntelexData]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Supplier_IntelexData] (
        [FK_Supplier] NVARCHAR(50) NOT NULL,
        [HasTabs] BIT NOT NULL CONSTRAINT [DF_T_Supplier_IntelexData_HasTabs] DEFAULT 0,
        [TabRecord] BIT NOT NULL CONSTRAINT [DF_T_Supplier_IntelexData_TabRecord] DEFAULT 0,
        [TabTimeline] BIT NOT NULL CONSTRAINT [DF_T_Supplier_IntelexData_TabTimeline] DEFAULT 0,
        [TabEfficiency] BIT NOT NULL CONSTRAINT [DF_T_Supplier_IntelexData_TabEfficiency] DEFAULT 0,
        [Saved] BIT NOT NULL CONSTRAINT [DF_T_Supplier_IntelexData_Saved] DEFAULT 0,
        [CurrentLevel] NVARCHAR(20) NOT NULL CONSTRAINT [DF_T_Supplier_IntelexData_CurrentLevel] DEFAULT 'Investigate',
        [RecordCreationDate] NVARCHAR(30) NULL,
        [InvestigateRecordNumber] NVARCHAR(100) NULL,
        [InvestigateExpected] NVARCHAR(30) NULL,
        [InvestigateReal] NVARCHAR(30) NULL,
        [L0Expected] NVARCHAR(30) NULL,
        [L0Real] NVARCHAR(30) NULL,
        [L1Expected] NVARCHAR(30) NULL,
        [L1Real] NVARCHAR(30) NULL,
        [L2Expected] NVARCHAR(30) NULL,
        [L2Real] NVARCHAR(30) NULL,
        [L3Expected] NVARCHAR(30) NULL,
        [L3Real] NVARCHAR(30) NULL,
        [L4Expected] NVARCHAR(30) NULL,
        [L4Real] NVARCHAR(30) NULL,
        [EfficiencyL0] FLOAT(53) NULL,
        [EfficiencyL1] FLOAT(53) NULL,
        [EfficiencyL2] FLOAT(53) NULL,
        [EfficiencyL3] FLOAT(53) NULL,
        [EfficiencyL4] FLOAT(53) NULL,
        [EfficiencyGlobal] FLOAT(53) NULL,
        CONSTRAINT [PK_T_Supplier_IntelexData] PRIMARY KEY CLUSTERED ([FK_Supplier])
    );
END
GO


/* ------------------------------------------------------------------------
   DOMINIO 3 — Ramas de salida
------------------------------------------------------------------------ */

IF OBJECT_ID(N'[T_Supplier_Blacklist]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Supplier_Blacklist] (
        [FK_Supplier] NVARCHAR(50) NOT NULL,
        [RejectedBy] NVARCHAR(100) NOT NULL,
        [RejectionDate] NVARCHAR(30) NOT NULL,
        [RejectionReason] NVARCHAR(2000) NOT NULL,
        [CreatedDt] DATETIME2 NOT NULL CONSTRAINT [DF_T_Supplier_Blacklist_CreatedDt] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [PK_T_Supplier_Blacklist] PRIMARY KEY CLUSTERED ([FK_Supplier])
    );
END
GO

IF OBJECT_ID(N'[T_Supplier_Completion]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Supplier_Completion] (
        [FK_Supplier] NVARCHAR(50) NOT NULL,
        [CompletedDate] NVARCHAR(30) NOT NULL,
        [CompletedBy] NVARCHAR(100) NOT NULL,
        [CreatedDt] DATETIME2 NOT NULL CONSTRAINT [DF_T_Supplier_Completion_CreatedDt] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [PK_T_Supplier_Completion] PRIMARY KEY CLUSTERED ([FK_Supplier])
    );
END
GO


/* ------------------------------------------------------------------------
   DOMINIO 4 — Events
------------------------------------------------------------------------ */

IF OBJECT_ID(N'[T_Event]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Event] (
        [PK_Event] NVARCHAR(50) NOT NULL,
        [Name] NVARCHAR(300) NOT NULL,
        [DateStart] NVARCHAR(30) NOT NULL,
        [DateEnd] NVARCHAR(30) NOT NULL,
        [Location] NVARCHAR(200) NOT NULL,
        [Organizer] NVARCHAR(100) NOT NULL,
        [ContactName] NVARCHAR(100) NULL,
        [ContactEmail] NVARCHAR(200) NULL,
        [ContactPhone] NVARCHAR(50) NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [Description] NVARCHAR(2000) NOT NULL,
        [FK_ProductCategory] INT NOT NULL,
        [Objective] NVARCHAR(2000) NOT NULL,
        [TopCountry] NVARCHAR(100) NOT NULL,
        CONSTRAINT [PK_T_Event] PRIMARY KEY CLUSTERED ([PK_Event])
    );
END
GO

IF OBJECT_ID(N'[T_Event_SupplierEntry]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Event_SupplierEntry] (
        [PK_Event_SupplierEntry] INT IDENTITY(1,1) NOT NULL,
        [FK_Event] NVARCHAR(50) NOT NULL,
        [FK_Supplier] NVARCHAR(50) NOT NULL,
        [B2bMeeting] BIT NOT NULL CONSTRAINT [DF_T_Event_SupplierEntry_B2bMeeting] DEFAULT 0,
        [Status] NVARCHAR(20) NOT NULL,
        [Result] NVARCHAR(20) NOT NULL,
        CONSTRAINT [PK_T_Event_SupplierEntry] PRIMARY KEY CLUSTERED ([PK_Event_SupplierEntry]),
        CONSTRAINT [UQ_T_Event_SupplierEntry_FK_Event_FK_Supplier] UNIQUE NONCLUSTERED ([FK_Event], [FK_Supplier])
    );
END
GO

IF OBJECT_ID(N'[T_Event_B2BMeeting]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Event_B2BMeeting] (
        [PK_Event_B2BMeeting] INT IDENTITY(1,1) NOT NULL,
        [FK_Event] NVARCHAR(50) NOT NULL,
        [FK_Supplier] NVARCHAR(50) NULL,
        [Time] NVARCHAR(30) NOT NULL,
        [Stand] NVARCHAR(50) NOT NULL,
        [CompanyName] NVARCHAR(200) NOT NULL,
        [Commodity] NVARCHAR(100) NOT NULL,
        [AttendeeManager] NVARCHAR(100) NOT NULL,
        [AttendeeBuyer] NVARCHAR(100) NOT NULL,
        [Duration] NVARCHAR(20) NOT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        CONSTRAINT [PK_T_Event_B2BMeeting] PRIMARY KEY CLUSTERED ([PK_Event_B2BMeeting])
    );
END
GO

IF OBJECT_ID(N'[T_Event_Note]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Event_Note] (
        [PK_Event_Note] NVARCHAR(80) NOT NULL,
        [FK_Event] NVARCHAR(50) NOT NULL,
        [Text] NVARCHAR(2000) NOT NULL,
        [Author] NVARCHAR(100) NOT NULL,
        [FK_AuthorUser] NVARCHAR(50) NULL,
        [Role] NVARCHAR(50) NOT NULL,
        [Date] NVARCHAR(30) NOT NULL,
        [CreatedDt] DATETIME2 NOT NULL CONSTRAINT [DF_T_Event_Note_CreatedDt] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [PK_T_Event_Note] PRIMARY KEY CLUSTERED ([PK_Event_Note])
    );
END
GO

IF OBJECT_ID(N'[T_Event_Prospect]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Event_Prospect] (
        [PK_Event_Prospect] INT IDENTITY(1,1) NOT NULL,
        [FK_Event] NVARCHAR(50) NOT NULL,
        [CompanyName] NVARCHAR(200) NOT NULL,
        [ProductType] NVARCHAR(200) NULL,
        [Website] NVARCHAR(100) NULL,
        [InterestedBy] NVARCHAR(100) NULL,
        [FK_InterestedByUser] NVARCHAR(50) NULL,
        [InterestedDt] DATETIME2 NULL,
        [B2bScheduled] BIT NOT NULL CONSTRAINT [DF_T_Event_Prospect_B2bScheduled] DEFAULT 0,
        [B2bDateTime] NVARCHAR(30) NULL,
        [B2bLocation] NVARCHAR(100) NULL,
        [B2bSetBy] NVARCHAR(100) NULL,
        [B2bSetDt] DATETIME2 NULL,
        [SourceFileName] NVARCHAR(255) NULL,
        [FK_ImportBatch] NVARCHAR(50) NOT NULL,
        [ImportedBy] NVARCHAR(100) NOT NULL,
        [ImportedDt] DATETIME2 NOT NULL CONSTRAINT [DF_T_Event_Prospect_ImportedDt] DEFAULT CURRENT_TIMESTAMP,
        [UpdatedDt] DATETIME2 NOT NULL,
        CONSTRAINT [PK_T_Event_Prospect] PRIMARY KEY CLUSTERED ([PK_Event_Prospect]),
        CONSTRAINT [UQ_EventProspect_Event_Company] UNIQUE NONCLUSTERED ([FK_Event], [CompanyName])
    );
END
GO


/* ------------------------------------------------------------------------
   DOMINIO 5 — Strategy / MRL
------------------------------------------------------------------------ */

IF OBJECT_ID(N'[T_Strategy_Entry]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Strategy_Entry] (
        [PK_Strategy_Entry] NVARCHAR(50) NOT NULL,
        [FK_Commodity] INT NOT NULL,
        [Needs2026] INT NOT NULL,
        [Needs2027] INT NULL,
        [Needs2028] INT NULL,
        [Needs2029] INT NULL,
        [Needs2030] INT NULL,
        [Needs2031] INT NULL,
        [CreatedBy] NVARCHAR(100) NOT NULL,
        [UpdatedAt] NVARCHAR(30) NOT NULL,
        CONSTRAINT [PK_T_Strategy_Entry] PRIMARY KEY CLUSTERED ([PK_Strategy_Entry]),
        CONSTRAINT [UQ_T_Strategy_Entry_FK_Commodity] UNIQUE NONCLUSTERED ([FK_Commodity])
    );
END
GO

IF OBJECT_ID(N'[T_Strategy_MrlRequirement]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Strategy_MrlRequirement] (
        [PK_Strategy_MrlRequirement] NVARCHAR(50) NOT NULL,
        [BuyerName] NVARCHAR(100) NOT NULL,
        [FK_Commodity] INT NOT NULL,
        [NexteerProductLine] NVARCHAR(50) NOT NULL,
        [Vol2026] INT NULL,
        [Vol2027] INT NULL,
        [Vol2028] INT NULL,
        [Vol2029] INT NULL,
        [Vol2030] INT NULL,
        [Vol2031] INT NULL,
        [PartNumber] NVARCHAR(100) NOT NULL,
        [PartDescription] NVARCHAR(300) NOT NULL,
        [MainMaterialsSpecTech] NVARCHAR(500) NOT NULL,
        [PeakVolume] INT NULL,
        [Program] NVARCHAR(100) NOT NULL,
        [Eop] NVARCHAR(20) NOT NULL,
        [TargetPrice] FLOAT(53) NULL,
        [Priority] INT NOT NULL,
        [PrimaryDriver] NVARCHAR(100) NOT NULL,
        [KeyManufacturingCapabilities] NVARCHAR(500) NOT NULL,
        [SafetyCriticalPart] BIT NOT NULL CONSTRAINT [DF_T_Strategy_MrlRequirement_SafetyCriticalPart] DEFAULT 0,
        [SupplierExperienceInSafetyRequired] BIT NOT NULL CONSTRAINT [DF_T_Strategy_MrlRequirement_SupplierExperienceInSafetyRequired] DEFAULT 0,
        [Certifications] NVARCHAR(300) NOT NULL,
        [KnowsCQIs] BIT NOT NULL CONSTRAINT [DF_T_Strategy_MrlRequirement_KnowsCQIs] DEFAULT 0,
        CONSTRAINT [PK_T_Strategy_MrlRequirement] PRIMARY KEY CLUSTERED ([PK_Strategy_MrlRequirement])
    );
END
GO


/* ------------------------------------------------------------------------
   DOMINIO 6 — Sistema (sesiones, notificaciones, auditoría)
------------------------------------------------------------------------ */

IF OBJECT_ID(N'[T_User_RefreshToken]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_User_RefreshToken] (
        [PK_User_RefreshToken] NVARCHAR(50) NOT NULL,
        [TokenHash] NVARCHAR(128) NOT NULL,
        [FK_User] NVARCHAR(50) NOT NULL,
        [ExpiresDt] DATETIME2 NOT NULL,
        [RevokedDt] DATETIME2 NULL,
        [CreatedDt] DATETIME2 NOT NULL CONSTRAINT [DF_T_User_RefreshToken_CreatedDt] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [PK_T_User_RefreshToken] PRIMARY KEY CLUSTERED ([PK_User_RefreshToken]),
        CONSTRAINT [UQ_T_User_RefreshToken_TokenHash] UNIQUE NONCLUSTERED ([TokenHash])
    );
END
GO

IF OBJECT_ID(N'[T_User_Notification]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_User_Notification] (
        [PK_User_Notification] NVARCHAR(50) NOT NULL,
        [Message] NVARCHAR(500) NOT NULL,
        [Type] NVARCHAR(20) NOT NULL,
        [Category] NVARCHAR(30) NULL,
        [Read] BIT NOT NULL CONSTRAINT [DF_T_User_Notification_Read] DEFAULT 0,
        [Link] NVARCHAR(300) NULL,
        [FK_User] NVARCHAR(50) NOT NULL,
        [CreatedDt] DATETIME2 NOT NULL CONSTRAINT [DF_T_User_Notification_CreatedDt] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [PK_T_User_Notification] PRIMARY KEY CLUSTERED ([PK_User_Notification])
    );
END
GO

IF OBJECT_ID(N'[T_Audit_Log]', N'U') IS NULL
BEGIN
    CREATE TABLE [T_Audit_Log] (
        [PK_Audit_Log] NVARCHAR(50) NOT NULL,
        [RequestId] NVARCHAR(20) NULL,
        [Action] NVARCHAR(100) NOT NULL,
        [FK_User] NVARCHAR(50) NULL,
        [UserEmail] NVARCHAR(200) NULL,
        [EntityType] NVARCHAR(50) NULL,
        [EntityId] NVARCHAR(50) NULL,
        [Detail] NVARCHAR(1000) NULL,
        [CreatedDt] DATETIME2 NOT NULL CONSTRAINT [DF_T_Audit_Log_CreatedDt] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [PK_T_Audit_Log] PRIMARY KEY CLUSTERED ([PK_Audit_Log])
    );
END
GO

PRINT 'Tablas creadas. Continuar con 02_create_foreign_keys.sql.';
GO
