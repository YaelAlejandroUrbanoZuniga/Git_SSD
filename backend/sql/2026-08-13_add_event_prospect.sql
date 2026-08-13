-- Creates T_Event_Prospect — pre-event supplier PROSPECTS for a scouting event.
--
-- WHY A NEW TABLE AND NOT AN EXISTING ONE
--
-- SSD receives, from the event organizer, the list of companies expected to
-- attend a scouting event, and needs Buyers/PMs/SQD to mark which ones are
-- worth a B2B meeting BEFORE the event happens. Those companies are prospects,
-- not suppliers.
--
--   * NOT T_Supplier. A supplier only exists once it fills the external form on
--     event day. Inserting prospects there would inflate the tracker stage
--     counts, the Home KPIs and the Reports weekly snapshots, and would start an
--     SLA clock on a company that may never show up. Every one of those numbers
--     is read by the business as "real pipeline"; a prospect is not pipeline.
--   * NOT T_Event_SupplierEntry. That junction requires an existing
--     T_Supplier row (FK_Supplier is NOT NULL), which is exactly what a prospect
--     does not have.
--
-- So this table hangs off T_Event alone. Its only optional FK to another entity
-- is FK_InterestedByUser -> C_User.
--
-- THE INTEREST RULE (enforced in eventProspectsService.ts, not by constraints)
--
-- Interest is a single marker, NOT a tri-state Interested/NotInterested/Pending:
--   * a prospect starts UNMARKED (all three Interested* columns NULL);
--   * any of SSD/PM/Buyer/SQD may mark it, which records WHO and WHEN;
--   * ONLY the person who marked it may unmark it — a second person trying to
--     mark it gets a 409, and someone else trying to unmark it gets a 403.
--     Nothing silently overwrites an interest already recorded;
--   * there is no "not interested" value to store. A prospect that stays
--     unmarked is meaningful information (nobody wanted it) and is never
--     deleted for being unmarked.
--
-- FK_ImportBatch is one UUID per Excel import call, stamped on every row that
-- call created OR updated. It exists so SSD can delete "the import I just did by
-- mistake" without touching prospects loaded into the same event by a different
-- import.
--
-- In TEST the schema change is applied by `npx prisma db push`; run THIS script
-- by hand on production, where db push is not used.
--
-- Idempotent: the table, both FKs and all three indexes are guarded, so
-- re-running the whole script is a no-op.

IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE object_id = OBJECT_ID(N'[dbo].[T_Event_Prospect]')
)
BEGIN
    CREATE TABLE [dbo].[T_Event_Prospect] (
        [PK_Event_Prospect]   INT             IDENTITY(1,1) NOT NULL,
        [FK_Event]            NVARCHAR(50)    NOT NULL,
        [CompanyName]         NVARCHAR(200)   NOT NULL,
        [ProductType]         NVARCHAR(200)   NULL,
        [Website]             NVARCHAR(100)   NULL,
        [InterestedBy]        NVARCHAR(100)   NULL,
        [FK_InterestedByUser] NVARCHAR(50)    NULL,
        [InterestedDt]        DATETIME2       NULL,
        [B2bScheduled]        BIT             NOT NULL CONSTRAINT [DF_EventProspect_B2bScheduled] DEFAULT (0),
        [B2bDateTime]         NVARCHAR(30)    NULL,
        [B2bLocation]         NVARCHAR(100)   NULL,
        [B2bSetBy]            NVARCHAR(100)   NULL,
        [B2bSetDt]            DATETIME2       NULL,
        [SourceFileName]      NVARCHAR(255)   NULL,
        [FK_ImportBatch]      NVARCHAR(50)    NOT NULL,
        [ImportedBy]          NVARCHAR(100)   NOT NULL,
        [ImportedDt]          DATETIME2       NOT NULL CONSTRAINT [DF_EventProspect_ImportedDt] DEFAULT (SYSDATETIME()),
        [UpdatedDt]           DATETIME2       NOT NULL CONSTRAINT [DF_EventProspect_UpdatedDt] DEFAULT (SYSDATETIME()),
        CONSTRAINT [PK_T_Event_Prospect] PRIMARY KEY CLUSTERED ([PK_Event_Prospect] ASC)
    );
END

-- Deleting an event takes its prospects with it: a prospect has no meaning
-- outside the event it was imported for.
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_EventProspect_Event'
)
BEGIN
    ALTER TABLE [dbo].[T_Event_Prospect]
        ADD CONSTRAINT [FK_EventProspect_Event]
        FOREIGN KEY ([FK_Event]) REFERENCES [dbo].[T_Event] ([PK_Event])
        ON DELETE CASCADE;
END

-- Nullable and deliberately WITHOUT cascade: deleting a user must never delete
-- (nor silently clear) the interest they recorded — that history is the point.
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_EventProspect_InterestedByUser'
)
BEGIN
    ALTER TABLE [dbo].[T_Event_Prospect]
        ADD CONSTRAINT [FK_EventProspect_InterestedByUser]
        FOREIGN KEY ([FK_InterestedByUser]) REFERENCES [dbo].[C_User] ([PK_User])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
END

-- One row per company per event — the key the Excel import upserts on, so a
-- re-import updates the existing prospect instead of duplicating it.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UQ_EventProspect_Event_Company'
      AND object_id = OBJECT_ID(N'[dbo].[T_Event_Prospect]')
)
BEGIN
    CREATE UNIQUE INDEX [UQ_EventProspect_Event_Company]
        ON [dbo].[T_Event_Prospect] ([FK_Event] ASC, [CompanyName] ASC);
END

-- Listing the prospects of one event is the only read path the UI has.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_EventProspect_Event'
      AND object_id = OBJECT_ID(N'[dbo].[T_Event_Prospect]')
)
BEGIN
    CREATE INDEX [IX_EventProspect_Event]
        ON [dbo].[T_Event_Prospect] ([FK_Event] ASC);
END

-- Undoing a mis-import is a delete by batch id, so that column needs its own index.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_EventProspect_ImportBatch'
      AND object_id = OBJECT_ID(N'[dbo].[T_Event_Prospect]')
)
BEGIN
    CREATE INDEX [IX_EventProspect_ImportBatch]
        ON [dbo].[T_Event_Prospect] ([FK_ImportBatch] ASC);
END
