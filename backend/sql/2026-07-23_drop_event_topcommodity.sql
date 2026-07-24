-- Drops the TopCommodity column from T_Event (Event.topCommodity, removed from
-- schema.prisma). GSM confirmed an event has no commodity as an attribute, so the
-- field is gone from the model, the DTO, the API schema and the frontend.
--
-- In TEST the column is dropped by `npx prisma db push`; run THIS script by hand on
-- production, where db push is not used.
--
-- Idempotent: only drops the column if it still exists. The column was a plain
-- NVARCHAR(100) NOT NULL with no default constraint, so no constraint drop is needed.
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[T_Event]') AND name = N'TopCommodity'
)
BEGIN
    ALTER TABLE [T_Event] DROP COLUMN [TopCommodity];
END
