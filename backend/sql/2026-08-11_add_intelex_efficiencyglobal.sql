-- Adds `EfficiencyGlobal` to T_Supplier_IntelexData: the handoff's aggregated
-- efficiency, alongside the five per-level ones (EfficiencyL0..EfficiencyL4)
-- that already exist.
--
-- Context — this ships together with a change to HOW the five per-level values
-- are computed. Until now efficiency was `planned days / actual days`, both
-- measured from the record creation date as a common anchor, which is not the
-- metric the GSM team actually uses and in practice only ever produced 0% or
-- 100%. It is now the team's Excel formula: each level's delay against ITS OWN
-- Expected date (delay = Real - Expected, in days) through a stepped penalty
-- (<=5 days → 0.95, then down to a 0.50 floor past 25 days). See
-- backend/src/domain/intelexEfficiency.ts — the formula lives there, in five
-- explicit branches mirroring the Excel.
--
-- `EfficiencyGlobal` is the plain average of the levels that HAVE a value;
-- levels with no dates yet are skipped, not counted as zero, so the column is
-- NULL until at least one level has both its Expected and Real dates.
--
-- The column is FLOAT NULL, exactly like the five it joins. No backfill: the
-- six values are rewritten by suppliersService.updateSupplier every time any
-- Intelex date is saved, so existing rows pick up the new scale (and gain their
-- global) the next time their Timeline tab is saved. Backfilling here would
-- have to reimplement the stepped formula in T-SQL — a second copy of the
-- business rule that could silently drift from the domain module.
--
-- In TEST the schema change is applied by `npx prisma db push`; run THIS script
-- by hand on production, where db push is not used.
--
-- Idempotent: the ALTER is guarded, so re-running it is safe.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[T_Supplier_IntelexData]') AND name = N'EfficiencyGlobal'
)
BEGIN
    ALTER TABLE [T_Supplier_IntelexData] ADD [EfficiencyGlobal] FLOAT NULL;
END
