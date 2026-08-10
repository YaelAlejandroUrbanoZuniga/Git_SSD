-- Recreates the two filtered unique indexes on C_User (User.email /
-- User.adObjectId in schema.prisma) as a versioned script.
--
-- These indexes already exist in MX_MFGIT_SSD_TEST — they were created by hand
-- during development and never captured in this repo. Both columns are
-- nullable and NOT @unique in schema.prisma on purpose: a plain SQL Server
-- UNIQUE constraint only tolerates a single NULL, which would break on the
-- 2nd user with no email or no AD objectGUID yet. Real uniqueness (when the
-- value IS present) is enforced by these MANUAL filtered indexes instead,
-- which is why all lookups in code use findFirst, never findUnique/upsert.
--
-- MANDATORY at promotion time: without these indexes on MX_MFGIT_SSD, the
-- real P2002 bug (duplicate NULL AdObjectId) described in
-- SSD_Modelo_BD_MX_MFGIT_SSD_v2.docx comes back.
--
-- This script only documents/recreates a state that already exists in TEST;
-- it is not needed there, only in PROD during promotion.
--
-- Idempotent: only creates each index if it does not already exist.

-- ── Email filtered unique index ─────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[dbo].[C_User]') AND name = N'UQ_C_User_Email_Filtered'
)
BEGIN
    CREATE UNIQUE INDEX [UQ_C_User_Email_Filtered]
        ON [C_User] ([Email])
        WHERE [Email] IS NOT NULL;
END

-- ── AdObjectId filtered unique index ────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[dbo].[C_User]') AND name = N'UQ_C_User_AdObjectId_Filtered'
)
BEGIN
    CREATE UNIQUE INDEX [UQ_C_User_AdObjectId_Filtered]
        ON [C_User] ([AdObjectId])
        WHERE [AdObjectId] IS NOT NULL;
END
