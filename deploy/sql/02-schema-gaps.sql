-- Gaps between mra.sql (the schema export) and what prisma/schema.prisma expects.
-- Run against Dreamsoft_UAT after loading mra.sql.

-- Prisma models 131 columns on App_Accounts; mra.sql creates 130.
-- Type taken from prisma/schema.prisma: PANNo String? @db.NVarChar(10)
IF COL_LENGTH(Ndbo.App_Accounts, NPANNo) IS NULL
  ALTER TABLE [dbo].[App_Accounts] ADD [PANNo] NVARCHAR(10) NULL;
GO

-- STILL OUTSTANDING - needs the full export, cannot be reconstructed here.
--
-- Five foreign keys in mra.sql fail because their target tables are absent:
--   App_Company          <- App_Accounts.BusinessUnitId, .BranchId, App_BookMaster x2
--   App_GeneralMaster    <- App_Accounts.PreferredLanguageId, App_Geographical x2
--   App_Users            <- App_BookMaster.AuthorisedSignatoryUserId
--   App_EmailSMSConfig   <- App_EmailSMSSchedule
--   App_EmailSMTP        <- App_EmailSMSSchedule
--
-- Four functions and one procedure called by the 17 stored procedures are absent:
--   dbo.RemoveSpecialChars, dbo.CSVToTable, dbo.App_NumericOnly,
--   dbo.GetStateBookId, App_FormatWithZero
--
-- The API is unaffected: it uses Prisma, not these procedures.
