-- ===================================================================
-- One account per phone number, one account per email.
--
-- App_Accounts ships with only PK_AccountMaster (AccountId); nothing stops two rows sharing an
-- AccountMobile or an AccountEmail. The application normalizes both (see src/utils/phone.js and
-- registration.service.js's saveConversationField) and checks before writing, but only these
-- indexes actually make it impossible - including for two requests racing each other, and for
-- anything writing to this database that isn't this backend.
--
-- WHY FILTERED: SQL Server treats NULL as a value in a unique index and allows only ONE NULL row.
-- Most accounts have no email until they reach that step in the chat, so an unfiltered unique index
-- on AccountEmail would reject the second such account outright. The WHERE clause excludes NULL and
-- '' so any number of accounts may have no email / no mobile yet, while any *actual* value is unique.
--
-- WHY NOT IN schema.prisma: Prisma cannot express a filtered index. An @unique attribute would
-- generate exactly the broken unfiltered form above, so the schema deliberately carries neither.
-- The trade-off: `prisma db push` doesn't know these exist and may drop them - re-run this script
-- after any push. It is idempotent, so running it again is always safe.
--
-- Apply with:
--   sqlcmd -S tcp:localhost,1433 -U iprs_app -P iprs_app -C -d Dreamsoft_UAT -i scripts/add-unique-indexes.sql
--
-- If creation FAILS with "The CREATE UNIQUE INDEX statement terminated because a duplicate key was
-- found", the table already contains duplicates. Find them first - do not force the index:
--   SELECT AccountMobile, COUNT(*) FROM App_Accounts
--    WHERE AccountMobile IS NOT NULL AND AccountMobile <> ''
--    GROUP BY AccountMobile HAVING COUNT(*) > 1;
--   SELECT AccountEmail, COUNT(*) FROM App_Accounts
--    WHERE AccountEmail IS NOT NULL AND AccountEmail <> ''
--    GROUP BY AccountEmail HAVING COUNT(*) > 1;
-- ===================================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UQ_App_Accounts_AccountMobile' AND object_id = OBJECT_ID('dbo.App_Accounts')
)
BEGIN
    CREATE UNIQUE INDEX UQ_App_Accounts_AccountMobile
        ON dbo.App_Accounts (AccountMobile)
        WHERE AccountMobile IS NOT NULL AND AccountMobile <> '';
    PRINT 'Created UQ_App_Accounts_AccountMobile';
END
ELSE
    PRINT 'UQ_App_Accounts_AccountMobile already exists, skipping';
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UQ_App_Accounts_AccountEmail' AND object_id = OBJECT_ID('dbo.App_Accounts')
)
BEGIN
    CREATE UNIQUE INDEX UQ_App_Accounts_AccountEmail
        ON dbo.App_Accounts (AccountEmail)
        WHERE AccountEmail IS NOT NULL AND AccountEmail <> '';
    PRINT 'Created UQ_App_Accounts_AccountEmail';
END
ELSE
    PRINT 'UQ_App_Accounts_AccountEmail already exists, skipping';
GO
