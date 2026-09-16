-- ===================================================================
-- App_Accounts_ChatJournal - every answer that Typebot ACCEPTED, in order, so a member who
-- abandons the registration halfway can come back a month later and carry on from the same
-- question instead of starting again.
--
-- WHY A JOURNAL AND NOT A CURSOR: Typebot's Chat API has no way to resume a public chat mid-flow.
-- Verified live against bot.choira.io - `startFrom: { type: 'group', groupId }` is accepted but
-- SILENTLY IGNORED on /api/v1/typebots/{publicId}/startChat (the response is identical to a normal
-- start, question 1). It only works on the /preview/ endpoint, which serves the DRAFT flow - so
-- returning members would get whatever half-finished edit is open in Studio while everyone else
-- gets the published one. Not acceptable for a rights society's intake.
--
-- So the position is restored by REPLAYING the answers into a fresh published-flow session, which
-- is verified to land on the identical block id.
--
-- WHY THE ANSWERS AREN'T ALREADY RECOVERABLE: of the flow's 131 input blocks, 38 have no
-- variableId at all - pure navigation choices ("(Individual) Author / Composer", "I Accept"). Their
-- answers are never stored in any column, yet they decide which branch the member is on. Without
-- them the path cannot be reproduced, so the existing App_Accounts columns are not enough.
--
-- WHAT IS STORED IS WHAT WAS SENT TO TYPEBOT, not what the member typed. The gates (email OTP,
-- work link, OCR confirmation, payment review) intercept and transform answers before the relay;
-- journaling the relayed value is what makes replay safe - no OTP is re-sent, no work link is
-- re-saved, no document is re-read.
--
-- Apply with:
--   sqlcmd -S tcp:localhost,1433 -U iprs_app -P iprs_app -C -d Dreamsoft_UAT -i scripts/add-chat-journal.sql
--
-- Then hand-add the matching model to prisma/schema.prisma and run `npx prisma generate` ONLY.
-- Do NOT run `prisma db push`: it doesn't know about the filtered unique indexes on App_Accounts
-- (scripts/add-unique-indexes.sql) and may drop them. The database is the source of truth here.
-- This script is idempotent, so re-running it is always safe.
-- ===================================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'App_Accounts_ChatJournal')
BEGIN
    CREATE TABLE dbo.App_Accounts_ChatJournal (
        JournalId    BIGINT IDENTITY(1,1) NOT NULL
                     CONSTRAINT PK_App_Accounts_ChatJournal PRIMARY KEY,
        AccountId    BIGINT         NOT NULL,
        -- Position in the conversation, 0-based. Replay is strictly ordered by this.
        TurnIndex    INT            NOT NULL,
        -- The Typebot block this answer was given to. Replay refuses to send an answer to a
        -- different block, which is how a republished flow is detected instead of corrupting it.
        BlockId      NVARCHAR(50)   NOT NULL,
        -- Null for the 38 navigation-only choices. Kept for debugging, never used to match.
        VariableId   NVARCHAR(50)   NULL,
        -- NVARCHAR(MAX): a file answer is a presigned S3 URL and routinely exceeds 500 characters.
        Answer       NVARCHAR(MAX)  NULL,
        -- JSON array. Separate from Answer because a file turn sends both, and Typebot rejects the
        -- turn if the shape doesn't match what its own widget sends.
        AttachedUrls NVARCHAR(MAX)  NULL,
        CreateDate   DATETIME       NOT NULL
                     CONSTRAINT DF_App_Accounts_ChatJournal_CreateDate DEFAULT (GETDATE())
    );
    PRINT 'Created App_Accounts_ChatJournal';
END
ELSE
    PRINT 'App_Accounts_ChatJournal already exists, skipping';
GO

-- One row per (member, turn). A retried write can never duplicate a turn or leave a hole, both of
-- which would silently replay the member into the wrong branch.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UQ_App_Accounts_ChatJournal_AccountId_TurnIndex'
      AND object_id = OBJECT_ID('dbo.App_Accounts_ChatJournal')
)
BEGIN
    CREATE UNIQUE INDEX UQ_App_Accounts_ChatJournal_AccountId_TurnIndex
        ON dbo.App_Accounts_ChatJournal (AccountId, TurnIndex);
    PRINT 'Created UQ_App_Accounts_ChatJournal_AccountId_TurnIndex';
END
ELSE
    PRINT 'UQ_App_Accounts_ChatJournal_AccountId_TurnIndex already exists, skipping';
GO

-- Every read is "the whole journal for this member, in order".
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_App_Accounts_ChatJournal_AccountId'
      AND object_id = OBJECT_ID('dbo.App_Accounts_ChatJournal')
)
BEGIN
    CREATE INDEX IX_App_Accounts_ChatJournal_AccountId ON dbo.App_Accounts_ChatJournal (AccountId);
    PRINT 'Created IX_App_Accounts_ChatJournal_AccountId';
END
ELSE
    PRINT 'IX_App_Accounts_ChatJournal_AccountId already exists, skipping';
GO
