-- Data fix (2026-07-23): revert "Citlaly Hernandez" from SSD back to Guest.
--
-- One-off correction of a single row in C_User — she was granted the SSD role by
-- mistake and must return to the least-privilege Guest role. This is a DATA fix,
-- not a schema change: run it by hand against MX_MFGIT_SSD_TEST (and later against
-- production, same script). It touches exactly one person.
--
-- Idempotent: the UPDATE only fires when the row is not already Guest, so running
-- it twice leaves the same state (the second run reports 0 rows affected).
--
-- ⚠ Yael: BEFORE trusting the change, confirm the verification SELECT at the end
-- returns EXACTLY ONE row, and that it is the correct person. If it returns 0
-- rows, the name is spelled/accented differently under this DB's collation —
-- broaden the pattern to N'%Citlaly%' and re-run. If it returns more than one
-- row, narrow the pattern (e.g. add the email) so only the intended user is hit.
--
-- Match note: N'%Citlaly%Hernandez%' matches the accented 'Hernández' too under
-- the default accent-insensitive collation; distinctive first name 'Citlaly'
-- keeps false matches unlikely.

SET NOCOUNT ON;

-- Guard: the Guest role must exist (it is seeded with the catalogs).
IF NOT EXISTS (SELECT 1 FROM [C_Role] WHERE [Name] = N'Guest')
BEGIN
    RAISERROR('C_Role has no ''Guest'' role — seed the role catalog before running this fix.', 16, 1);
    RETURN;
END

DECLARE @GuestRoleId INT = (SELECT PK_Role FROM [C_Role] WHERE [Name] = N'Guest');

UPDATE u
SET u.[FK_Role] = @GuestRoleId
FROM [C_User] u
WHERE u.[DisplayName] LIKE N'%Citlaly%Hernandez%'
  AND u.[FK_Role] <> @GuestRoleId;

-- Verification — must show the affected user now carrying the Guest role.
SELECT u.[Username], u.[DisplayName], u.[Email], ro.[Name] AS [Role]
FROM [C_User] u
JOIN [C_Role] ro ON ro.[PK_Role] = u.[FK_Role]
WHERE u.[DisplayName] LIKE N'%Citlaly%Hernandez%';
