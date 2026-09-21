-- ===================================================================
-- SUPERSEDED - DO NOT RUN. Kept only as a record of why this column briefly existed.
--
-- This column was added because the meaning of IPRS's own EntityType codes (CP/PR/SP) was
-- unknown, and guessing it was the exact mistake that caused the ApplicantPath/RollTypeIds bugs.
-- IPRS's team has since confirmed them - CP = Company, PR = Partnership, SP = Sole Proprietor
-- (their six member categories are Individual / Sole Proprietor / Partnership / Company /
-- NRI Individual / NRI Company, i.e. AccountRegType + EntityType together). The answer now maps
-- straight onto their EntityType column, so this one was dropped and nothing reads or writes it.
-- See src/modules/registration/services/memberRoleCodes.js.
--
-- Original description follows.
--
-- App_Accounts.EntityTypeDetail - the Owner/Publisher path's entity-type answer, verbatim:
--   "Corporate (Pvt Ltd/Ltd Company)" | "Partnership" | "sole proprietry consern"
--
-- WHY THIS IS NEEDED: prod's real App_Accounts.EntityType is NVARCHAR(10) and holds a short
-- 2-letter code (CP/PR/SP, confirmed against IPRS's real mraai_uat database) that some other
-- IPRS system presumably reads. This app was writing the free-text Typebot answer straight into
-- that column and had locally widened it to NVARCHAR(50) to fit - the same failure mode
-- ApplicantPath/RollTypeIds hit: overloading a column prod treats as a controlled code with
-- unrelated free text. This column gives the free-text answer its own place, so EntityType can
-- go back to matching prod's real NVARCHAR(10) width and semantics.
--
-- Apply with:
--   sqlcmd -S tcp:localhost,1433 -U iprs_app -P iprs_app -C -d Dreamsoft_UAT -i scripts/add-entity-type-detail-column.sql
--
-- Then hand-add EntityTypeDetail to prisma/schema.prisma's AppAccounts model and run
-- `npx prisma generate` ONLY. Do NOT run `prisma db push` - see CLAUDE.md/AGENTS.md.
-- This script is idempotent, so re-running it is always safe.
--
-- NOT done here (separate decision, needs IPRS input): whether to also populate the real
-- EntityType 2-letter code (CP/PR/SP) by mapping the free-text answer - see melodic-wibbling-
-- squid.md's plan section B.5.
-- ===================================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.App_Accounts') AND name = 'EntityTypeDetail'
)
BEGIN
    ALTER TABLE dbo.App_Accounts ADD EntityTypeDetail NVARCHAR(50) NULL;
    PRINT 'Added App_Accounts.EntityTypeDetail';
END
ELSE
    PRINT 'App_Accounts.EntityTypeDetail already exists, skipping';
GO
