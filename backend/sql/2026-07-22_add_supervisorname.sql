-- Adds the SupervisorName column to C_User (User.supervisorName in schema.prisma).
--
-- Nullable NVARCHAR(100): the supervisor/manager name arrives from LDAP on real
-- login (info.supervisorName) and may be null for some users. In TEST the column
-- is created by `npx prisma db push`; run THIS script by hand on production,
-- where db push is not used.
--
-- Idempotent: only adds the column if it does not already exist.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[C_User]') AND name = N'SupervisorName'
)
BEGIN
    ALTER TABLE [C_User] ADD [SupervisorName] NVARCHAR(100) NULL;
END
