-- Adds the AUTHOR BY ID to T_Supplier_Note and T_Event_Note.
--
-- Until now, "only the original author may edit or delete this note" was checked
-- in notesService against `Author`, a DISPLAY NAME:
--
--     if (note.author !== actor.displayName) throw new ForbiddenError(...)
--
-- That is not an identity. Two employees who share a display name could edit and
-- delete each other's notes, and — more common in practice — anyone whose name
-- changed in Active Directory lost access to their own notes, because
-- authService refreshes `DisplayName` from AD on EVERY login while the note kept
-- the old spelling.
--
-- `FK_AuthorUser` is the real identity. The check becomes id-first with the name
-- as a documented fallback, exactly like T_Event_Prospect.FK_InterestedByUser
-- already does for prospect interest (eventProspectsService.isInterestOwner).
--
-- NULLABLE on purpose, and NOT backfilled:
--   * every note written before this script has no id to recover — `Author` is a
--     free-text display name, and matching it back to a C_User row would be a
--     guess that could hand someone else's note to the wrong person;
--   * notes written while AUTH_OPTIONAL=true come from the demo identity, which
--     has no C_User row at all, so the FK could not hold its id even today.
-- For both cases `Author` remains the fallback, which is the behaviour those
-- notes already had. See notesService.isNoteOwner.
--
-- In TEST the schema change is applied by `npx prisma db push`; run THIS script
-- by hand on production, where db push is not used.
--
-- Idempotent: each ALTER is guarded by sys.columns, and each FK by
-- sys.foreign_keys, so re-running it is safe.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[T_Supplier_Note]') AND name = N'FK_AuthorUser'
)
BEGIN
    ALTER TABLE [T_Supplier_Note] ADD [FK_AuthorUser] NVARCHAR(50) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_SupplierNote_AuthorUser'
)
BEGIN
    ALTER TABLE [T_Supplier_Note]
        ADD CONSTRAINT [FK_SupplierNote_AuthorUser]
        FOREIGN KEY ([FK_AuthorUser]) REFERENCES [C_User]([PK_User])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[T_Event_Note]') AND name = N'FK_AuthorUser'
)
BEGIN
    ALTER TABLE [T_Event_Note] ADD [FK_AuthorUser] NVARCHAR(50) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_EventNote_AuthorUser'
)
BEGIN
    ALTER TABLE [T_Event_Note]
        ADD CONSTRAINT [FK_EventNote_AuthorUser]
        FOREIGN KEY ([FK_AuthorUser]) REFERENCES [C_User]([PK_User])
        ON DELETE NO ACTION ON UPDATE NO ACTION;
END
GO
