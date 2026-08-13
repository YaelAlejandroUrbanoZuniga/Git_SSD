-- Backfills [Category] on rows written before 2026-08-07, when the column
-- didn't exist yet (see 2026-08-07_add_notification_category.sql).
--
-- These rows don't need guessing: notifySsdTeam (backend/src/services/
-- notificationsService.ts, since renamed `notifyTeam`) wrote one of five fixed
-- message templates, one per call site --
--   eventsService.ts:      'Nuevo evento registrado: ...'   -> event_created
--                           'Evento actualizado: ...'        -> event_updated
--   suppliersService.ts:   'Nuevo proveedor registrado: ...' -> supplier_created
--   trackerService.ts:     '... avanzó de X a Y'             -> stage_advanced
--                           '... fue movido a Blacklisted: ...' -> blacklisted
--
-- so the template a row's [Message] matches identifies its category exactly.
-- [Link] is used as a secondary tie-breaker (each call site also writes a
-- distinct link prefix) to guard against a supplier/event name that happens
-- to contain another template's trigger words.
--
-- Only touches WHERE [Category] IS NULL, so re-running this script is a
-- no-op the second time (idempotent). Rows matching no pattern are left
-- NULL on purpose -- the frontend's severity-based fallback already renders
-- them correctly, and this script never invents or deletes rows.

UPDATE [T_User_Notification]
SET [Category] = 'supplier_created'
WHERE [Category] IS NULL
  AND [Message] LIKE N'Nuevo proveedor registrado: %'
  AND [Link] LIKE N'/suppliers/supplier/%';

UPDATE [T_User_Notification]
SET [Category] = 'stage_advanced'
WHERE [Category] IS NULL
  AND [Message] LIKE N'% avanzó de % a %'
  AND [Link] LIKE N'/tracker/supplier/%';

UPDATE [T_User_Notification]
SET [Category] = 'blacklisted'
WHERE [Category] IS NULL
  AND [Message] LIKE N'% fue movido a Blacklisted: %'
  AND [Link] LIKE N'/tracker/blacklisted/supplier/%';

UPDATE [T_User_Notification]
SET [Category] = 'event_created'
WHERE [Category] IS NULL
  AND [Message] LIKE N'Nuevo evento registrado: %'
  AND [Link] LIKE N'/events/%';

UPDATE [T_User_Notification]
SET [Category] = 'event_updated'
WHERE [Category] IS NULL
  AND [Message] LIKE N'Evento actualizado: %'
  AND [Link] LIKE N'/events/%';
