-- ===================================================================
-- App_Accounts_Payment - transaction records for member onboarding payments.
--
-- Stores PayU payment transactions, gateway references (mihpayid), status,
-- amount, and verification payload.
--
-- Apply with:
--   sqlcmd -S tcp:localhost,1433 -U iprs_app -P iprs_app -C -d Dreamsoft_UAT -i scripts/add-payment-table.sql
--
-- Then hand-add the matching model to prisma/schema.prisma and run `npx prisma generate` ONLY.
-- Do NOT run `prisma db push`: it doesn't know about the filtered unique indexes on App_Accounts
-- (scripts/add-unique-indexes.sql) and may drop them.
-- This script is idempotent, so re-running it is always safe.
-- ===================================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'App_Accounts_Payment')
BEGIN
    CREATE TABLE dbo.App_Accounts_Payment (
        PaymentId      BIGINT IDENTITY(1,1) NOT NULL
                       CONSTRAINT PK_App_Accounts_Payment PRIMARY KEY,
        AccountId      BIGINT         NOT NULL,
        TxnId          NVARCHAR(100)  NOT NULL,
        MihPayId       NVARCHAR(100)  NULL,
        Amount         FLOAT          NOT NULL,
        Currency       NVARCHAR(10)   NOT NULL CONSTRAINT DF_App_Accounts_Payment_Currency DEFAULT ('INR'),
        Status         NVARCHAR(50)   NOT NULL CONSTRAINT DF_App_Accounts_Payment_Status DEFAULT ('PENDING'),
        PaymentMode    NVARCHAR(50)   NULL,
        BankRefNo      NVARCHAR(100)  NULL,
        ProductInfo    NVARCHAR(255)  NULL,
        CustomerName   NVARCHAR(100)  NULL,
        CustomerEmail  NVARCHAR(100)  NULL,
        CustomerPhone  NVARCHAR(50)   NULL,
        PayuResponse   NVARCHAR(MAX)  NULL,
        ErrorMessage   NVARCHAR(500)  NULL,
        CreateDate     DATETIME       NOT NULL CONSTRAINT DF_App_Accounts_Payment_CreateDate DEFAULT (GETDATE()),
        ModifedDate    DATETIME       NOT NULL CONSTRAINT DF_App_Accounts_Payment_ModifedDate DEFAULT (GETDATE())
    );
    PRINT 'Created App_Accounts_Payment';
END
ELSE
    PRINT 'App_Accounts_Payment already exists, skipping';
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UQ_App_Accounts_Payment_TxnId'
      AND object_id = OBJECT_ID('dbo.App_Accounts_Payment')
)
BEGIN
    CREATE UNIQUE INDEX UQ_App_Accounts_Payment_TxnId
        ON dbo.App_Accounts_Payment (TxnId);
    PRINT 'Created UQ_App_Accounts_Payment_TxnId';
END
ELSE
    PRINT 'UQ_App_Accounts_Payment_TxnId already exists, skipping';
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_App_Accounts_Payment_AccountId'
      AND object_id = OBJECT_ID('dbo.App_Accounts_Payment')
)
BEGIN
    CREATE INDEX IX_App_Accounts_Payment_AccountId ON dbo.App_Accounts_Payment (AccountId);
    PRINT 'Created IX_App_Accounts_Payment_AccountId';
END
ELSE
    PRINT 'IX_App_Accounts_Payment_AccountId already exists, skipping';
GO
