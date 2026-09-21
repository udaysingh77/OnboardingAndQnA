-- ===================================================================
-- App_Accounts_RegPayment - IPRS's REAL registration-payment table, confirmed to already exist
-- and be actively used in production (mraai_uat, 102 rows at time of writing - real PayU
-- transactions for "IPRS Member Registration" at the same fee amounts this app charges).
--
-- WHY THIS SCRIPT EXISTS: our local Dreamsoft_UAT dev DB never had this table (it only ever had
-- the 13 tables imported from scripts/mra_cleaned.sql), and this app had independently invented
-- its own App_Accounts_Payment table for the same purpose without knowing this one existed. This
-- script creates a LOCAL copy matching prod's real column-for-column shape (confirmed against
-- mraai_uat via INFORMATION_SCHEMA.COLUMNS), so local dev now writes to the same table shape
-- prod actually uses. App_Accounts_Payment/scripts/add-payment-table.sql is superseded by this.
--
-- PaymentStatus semantics (confirmed with IPRS, not guessed): 0 = success, 1 = not yet confirmed
-- (covers both pending and failed). The row is created at 1 the moment the payment is initiated
-- and only becomes 0 once PayU confirms success - which is exactly how IPRS's own scheduler reads
-- this table: every ~3 hours it re-checks the rows still sitting at 1 and flips the ones that have
-- since succeeded to 0. payment.service.js's verifyPaymentStatus() is the on-demand equivalent.
--
-- Apply with:
--   sqlcmd -S tcp:localhost,1433 -U iprs_app -P iprs_app -C -d Dreamsoft_UAT -i scripts/add-regpayment-table.sql
--
-- Then hand-add AppAccountsRegPayment to prisma/schema.prisma and run `npx prisma generate` ONLY.
-- This script is idempotent, so re-running it is always safe.
-- ===================================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'App_Accounts_RegPayment')
BEGIN
    CREATE TABLE dbo.App_Accounts_RegPayment (
        PaymentRecieptId   BIGINT IDENTITY(1,1) NOT NULL,
        AccountId          BIGINT NOT NULL,
        TransactionNo      NVARCHAR(100) NULL,
        PaymentRecieptNo   NVARCHAR(100) NULL,
        PaymentStatus      TINYINT NULL,
        PaymentGatewayResponse NVARCHAR(500) NULL,
        PaymentBankName    NVARCHAR(100) NULL,
        PaymentDate        DATETIME NULL,
        ResponseNo         NVARCHAR(100) NULL,
        ResponseString     NVARCHAR(MAX) NULL,
        LastTransactionNo  NVARCHAR(100) NULL,
        LastResponseNo     NVARCHAR(100) NULL,
        LastResponseString NVARCHAR(MAX) NULL,
        PaymentAmount      MONEY NULL,
        PaidAmount         NVARCHAR(100) NULL,
        CreateDate         DATETIME NULL,
        CreatedBy          NVARCHAR(100) NULL,
        ModifedBy          NVARCHAR(100) NULL,
        ModifedDate        DATETIME NULL,
        CONSTRAINT PK_App_Accounts_RegPayment PRIMARY KEY CLUSTERED (PaymentRecieptId)
    );
    CREATE INDEX IX_App_Accounts_RegPayment_AccountId ON dbo.App_Accounts_RegPayment(AccountId);
    CREATE UNIQUE INDEX UQ_App_Accounts_RegPayment_TransactionNo ON dbo.App_Accounts_RegPayment(TransactionNo) WHERE TransactionNo IS NOT NULL;
    PRINT 'Created App_Accounts_RegPayment';
END
ELSE
    PRINT 'App_Accounts_RegPayment already exists, skipping';
GO
