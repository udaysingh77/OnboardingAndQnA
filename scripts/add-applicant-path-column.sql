-- ===================================================================
-- App_Accounts.ApplicantPath - which of the 4 fee-determining paths a member chose:
--   (Individual) Author / Composer | (NRI) Author / Composer
--   Owner/Publisher                | (NRI) Owner/Publisher
--
-- WHY THIS IS NEEDED: this choice-input block (Group #3 of the Typebot flow) branches the
-- conversation but originally had no Typebot variable assigned, so the answer was never
-- persisted anywhere - the same failure mode Territory hit before it got a variable (see
-- AGENTS.md). payu/feeSchedule.js was keyed on RollTypeIds under the wrong assumption that this
-- was where the answer ended up; RollTypeIds actually stores a different, later question
-- ("Lyricist"/"Composer"/"Both", Group #5), so every real member's fee lookup failed with
-- REGISTRATION_INCOMPLETE. The Typebot flow was republished with a variable
-- (vjxwoc559admtu01nvecsfrbe, "applicantPath") wired to this block; this column is where the
-- backend now persists it, via conversationFieldMap.js.
--
-- Apply with:
--   sqlcmd -S tcp:localhost,1433 -U iprs_app -P iprs_app -C -d Dreamsoft_UAT -i scripts/add-applicant-path-column.sql
--
-- Then hand-add ApplicantPath to prisma/schema.prisma's AppAccounts model and run
-- `npx prisma generate` ONLY. Do NOT run `prisma db push` - see CLAUDE.md/AGENTS.md.
-- This script is idempotent, so re-running it is always safe.
-- ===================================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.App_Accounts') AND name = 'ApplicantPath'
)
BEGIN
    ALTER TABLE dbo.App_Accounts ADD ApplicantPath NVARCHAR(50) NULL;
    PRINT 'Added App_Accounts.ApplicantPath';
END
ELSE
    PRINT 'App_Accounts.ApplicantPath already exists, skipping';
GO
