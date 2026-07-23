-- Adds the CurrentLevel column to T_Supplier_IntelexData
-- (IntelexData.currentLevel in schema.prisma).
--
-- NVARCHAR(20) NOT NULL, default 'Investigate': the explicit sub-status of a
-- supplier inside the Intelex Handoff stage. It advances through
-- Investigate → L0 → L1 → L2 → L3 → L4 → Completed as each level's "Real" date
-- is captured (the backend enforces the ordering). Existing Intelex rows adopt
-- the default 'Investigate', which is correct: nothing tracked their level
-- before, so they start at the beginning of the sequence.
--
-- In TEST the column is created by `npx prisma db push`; run THIS script by hand
-- on production, where db push is not used.
--
-- Idempotent: only adds the column if it does not already exist. The DEFAULT
-- constraint backfills every existing row with 'Investigate' in the same
-- statement, so the column can be NOT NULL immediately.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[T_Supplier_IntelexData]') AND name = N'CurrentLevel'
)
BEGIN
    ALTER TABLE [T_Supplier_IntelexData]
        ADD [CurrentLevel] NVARCHAR(20) NOT NULL
        CONSTRAINT [DF_IntelexData_CurrentLevel] DEFAULT N'Investigate';
END
