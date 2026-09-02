-- ===================================================================
-- App_Accounts_Alias - the names a member is credited under.
--
-- WHY A TABLE AND NOT A COLUMN: a member can be credited under several names (legal name, stage
-- name, an abbreviation), and no existing column can hold a list. App_Accounts.AccountAlias is a
-- single NVarChar(200) that is already the target of the flow's own stage-name question *and* the
-- company path's traderName - writing a list there would destroy real data. Detail3-Detail12 are
-- unused by this app but AGENTS.md records that their meaning in the wider IPRS system is
-- unverified, so they are not free to repurpose either.
--
-- `Source` records where the name came from, because that determines whether a match against it
-- counts as evidence:
--   'flow'      - asked during registration, before the member saw any song credits
--   'work-link' - supplied at the work-link step, AFTER we showed them the credits: a claim, not a
--                 check. A match against one of these is stored as chat:name-unverified.
--   'staff'     - entered by a human reviewer
--
-- Apply with:
--   sqlcmd -S tcp:localhost,1433 -U iprs_app -P iprs_app -C -d Dreamsoft_UAT -i scripts/add-alias-table.sql
--
-- Then hand-add the matching model to prisma/schema.prisma and run `npx prisma generate` ONLY.
-- Do NOT run `prisma db push`: it doesn't know about the filtered unique indexes on App_Accounts
-- (scripts/add-unique-indexes.sql) and may drop them. The database is the source of truth here.
-- This script is idempotent, so re-running it is always safe.
-- ===================================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'App_Accounts_Alias')
BEGIN
    CREATE TABLE dbo.App_Accounts_Alias (
        AliasId    BIGINT IDENTITY(1,1) NOT NULL
                   CONSTRAINT PK_App_Accounts_Alias PRIMARY KEY,
        AccountId  BIGINT         NOT NULL,
        AliasName  NVARCHAR(200)  NOT NULL,
        Source     NVARCHAR(50)   NULL,
        CreateDate DATETIME       NOT NULL
                   CONSTRAINT DF_App_Accounts_Alias_CreateDate DEFAULT (GETDATE())
    );
    PRINT 'Created App_Accounts_Alias';
END
ELSE
    PRINT 'App_Accounts_Alias already exists, skipping';
GO

-- One row per (member, name). Makes "have we already stored this name?" a database guarantee
-- rather than something every caller has to remember to check.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UQ_App_Accounts_Alias_AccountId_AliasName'
      AND object_id = OBJECT_ID('dbo.App_Accounts_Alias')
)
BEGIN
    CREATE UNIQUE INDEX UQ_App_Accounts_Alias_AccountId_AliasName
        ON dbo.App_Accounts_Alias (AccountId, AliasName);
    PRINT 'Created UQ_App_Accounts_Alias_AccountId_AliasName';
END
ELSE
    PRINT 'UQ_App_Accounts_Alias_AccountId_AliasName already exists, skipping';
GO

-- Lookups are always "every alias for this member".
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_App_Accounts_Alias_AccountId'
      AND object_id = OBJECT_ID('dbo.App_Accounts_Alias')
)
BEGIN
    CREATE INDEX IX_App_Accounts_Alias_AccountId ON dbo.App_Accounts_Alias (AccountId);
    PRINT 'Created IX_App_Accounts_Alias_AccountId';
END
ELSE
    PRINT 'IX_App_Accounts_Alias_AccountId already exists, skipping';
GO
