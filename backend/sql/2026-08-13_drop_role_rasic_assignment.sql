-- Drops T_Role_RasicAssignment (RoleRasicAssignment scaffold removed from
-- schema.prisma). The 32-activity RASIC matrix was never adopted as the
-- permission model — the app uses a flat SSD-write / everyone-else-read model
-- plus two named write exceptions instead — so the table has no reader/writer
-- and was never seeded.
--
-- In TEST the table is dropped by `npx prisma db push`; run THIS script by
-- hand on production, where db push is not used.
--
-- Idempotent: only drops the table (and its FKs, dropped implicitly with it)
-- if it still exists.
IF EXISTS (
    SELECT 1 FROM sys.tables WHERE name = N'T_Role_RasicAssignment'
)
BEGIN
    DROP TABLE [T_Role_RasicAssignment];
END
