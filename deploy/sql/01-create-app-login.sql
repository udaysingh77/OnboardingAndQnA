-- Least-privilege login for the API. Run as sa against the server, once.
-- Replace the password before running; the deployed value lives in
-- /root/mssql-app-password.txt on the host, not in this repo.
USE [master];
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = Niprs_app)
  CREATE LOGIN [iprs_app] WITH PASSWORD = NREPLACE_WITH_DB_PASSWORD, CHECK_POLICY = OFF;
GO

USE [Dreamsoft_UAT];
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = Niprs_app)
  CREATE USER [iprs_app] FOR LOGIN [iprs_app];
GO

ALTER ROLE db_owner ADD MEMBER [iprs_app];
GO
