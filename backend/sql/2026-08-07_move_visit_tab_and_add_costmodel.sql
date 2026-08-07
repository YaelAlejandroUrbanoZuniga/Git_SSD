-- Moves the Visit tab from Preliminary Evaluation to Supplier Evaluation, and
-- adds the new "Cost Model" document field to the Fundamentals tab.
--
-- Confirmed by the GSM business owner:
--   * Preliminary Evaluation keeps Overview → Capabilities.
--   * Supplier Evaluation becomes Competitiveness → Fundamentals → Visit.
--   * Fundamentals gains an optional Y/N "Cost Model" alongside RFQ/NDA/TC&Cs/…
--
-- IMPORTANT — only the tab's COMPLETION FLAG moves. The Visit *data* columns
-- (VisitDatePlanned, VisitDateCompleted, VisitParticipants, Strengths,
-- Weaknesses, Observations, Recommendations) deliberately STAY in
-- T_Supplier_PreliminaryData and keep their prelim_* names on the wire; the
-- Supplier Evaluation stage reads them from there. This is a tab-grouping
-- change, not a data-model change — do not migrate those columns.
--
-- What this script does, in order:
--   1. T_Supplier_EvaluationData  + CostModel NVARCHAR(5) NULL   (Y | N)
--   2. T_Supplier_EvaluationData  + TabVisit  BIT NOT NULL DEF 0
--   3. Backfill TabVisit from T_Supplier_PreliminaryData.TabVisit for suppliers
--      that have both satellite rows (so a visit already reported before this
--      change still shows as complete under Supplier Evaluation).
--   4. T_Supplier_PreliminaryData - TabVisit (dropping its DEFAULT first).
--
-- In TEST the schema change is applied by `npx prisma db push`; run THIS script
-- by hand on production, where db push is not used.
--
-- Idempotent: every statement is guarded, so re-running it is safe. Steps 3–4
-- reach the old T_Supplier_PreliminaryData.TabVisit through sp_executesql
-- because that column no longer exists on a second run, and a static reference
-- would fail to compile the batch.

-- ── 1. CostModel on the Supplier Evaluation satellite ───────────────────────
-- Nullable and optional, exactly like TcsSigned / TtcsSigned / NsrSigned /
-- SdaSigned. It is NOT part of the selectedForDevelopment gate (RFQ=Y && NDA=Y).
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[T_Supplier_EvaluationData]') AND name = N'CostModel'
)
BEGIN
    ALTER TABLE [T_Supplier_EvaluationData] ADD [CostModel] NVARCHAR(5) NULL;
END

-- ── 2. TabVisit on the Supplier Evaluation satellite ────────────────────────
-- The DEFAULT backfills existing rows with 0 in the same statement, so the
-- column can be NOT NULL immediately; step 3 then restores the real values.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[T_Supplier_EvaluationData]') AND name = N'TabVisit'
)
BEGIN
    ALTER TABLE [T_Supplier_EvaluationData]
        ADD [TabVisit] BIT NOT NULL
        CONSTRAINT [DF_SupplierEvalData_TabVisit] DEFAULT 0;
END

-- ── 3. Backfill from the old Preliminary flag ───────────────────────────────
-- Only for suppliers that have BOTH satellite rows; a supplier still in
-- Preliminary has no T_Supplier_EvaluationData row yet and needs no backfill
-- (its Visit tab starts incomplete when it reaches Supplier Evaluation).
-- Skipped entirely once the source column is gone, which makes a re-run a no-op.
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[T_Supplier_PreliminaryData]') AND name = N'TabVisit'
)
AND EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[T_Supplier_EvaluationData]') AND name = N'TabVisit'
)
BEGIN
    EXEC sp_executesql N'
        UPDATE se
           SET se.[TabVisit] = pre.[TabVisit]
          FROM [T_Supplier_EvaluationData] se
          INNER JOIN [T_Supplier_PreliminaryData] pre
                  ON pre.[FK_Supplier] = se.[FK_Supplier]
         WHERE se.[TabVisit] <> pre.[TabVisit];';
END

-- ── 4. Drop TabVisit from the Preliminary satellite ─────────────────────────
-- Its DEFAULT constraint has a Prisma-generated name, so look it up rather than
-- assuming one; the column cannot be dropped while the constraint references it.
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[T_Supplier_PreliminaryData]') AND name = N'TabVisit'
)
BEGIN
    DECLARE @constraint SYSNAME = (
        SELECT dc.name
          FROM sys.default_constraints dc
          INNER JOIN sys.columns c
                  ON c.object_id = dc.parent_object_id
                 AND c.column_id = dc.parent_column_id
         WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[T_Supplier_PreliminaryData]')
           AND c.name = N'TabVisit'
    );

    DECLARE @sql NVARCHAR(MAX);
    IF @constraint IS NOT NULL
    BEGIN
        SET @sql = N'ALTER TABLE [T_Supplier_PreliminaryData] DROP CONSTRAINT ' + QUOTENAME(@constraint) + N';';
        EXEC sp_executesql @sql;
    END

    EXEC sp_executesql N'ALTER TABLE [T_Supplier_PreliminaryData] DROP COLUMN [TabVisit];';
END
