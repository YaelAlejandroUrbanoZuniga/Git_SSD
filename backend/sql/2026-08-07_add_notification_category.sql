-- Adds the domain-event CATEGORY to T_User_Notification.
--
-- Until now a notification carried only `Type` (error | warning | info), a
-- SEVERITY. Every domain event we raise is `info` except the blacklist, so the
-- panel rendered almost everything with the same blue circle-info icon.
--
-- `Category` answers a different question — WHAT happened — and is deliberately
-- a SEPARATE column instead of an overload of `Type`:
--   * `Type` keeps driving severity (and the existing rows keep their meaning);
--   * `Category` drives the icon + colour in the notification panel.
--
-- Values written by notificationsService.notifySsdTeam at the time this script ran:
--   supplier_created | stage_advanced | blacklisted | event_created | event_updated
-- (that function is now `notifyTeam`, and five more categories have since been
-- added — supplier_updated, strategy_updated, mrl_created/updated/deleted. They
-- needed no migration: the column is free-text NVARCHAR(30) and they all fit.
-- backend/README.md holds the current list; this header is the historical one.)
--
-- NULLABLE on purpose: every row created before this script has no category and
-- must keep rendering — the frontend falls back to the severity-based icon and
-- colour for a NULL or unknown value. No backfill is attempted: the old rows'
-- category cannot be reconstructed from free-text Spanish messages, and guessing
-- it would put wrong icons on real history.
--
-- In TEST the schema change is applied by `npx prisma db push`; run THIS script
-- by hand on production, where db push is not used.
--
-- Idempotent: the ALTER is guarded by sys.columns, so re-running it is safe.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[T_User_Notification]') AND name = N'Category'
)
BEGIN
    ALTER TABLE [T_User_Notification] ADD [Category] NVARCHAR(30) NULL;
END
