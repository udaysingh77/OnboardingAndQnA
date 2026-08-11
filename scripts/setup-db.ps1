# ==================================================================
# Setup local SQL Server (SQLEXPRESS01) for IPRS:
#   1. Enable TCP/IP + static port on the instance
#   2. Enable SQL Server (mixed-mode) authentication
#   3. Start SQL Browser
#   4. Restart the instance to apply (one-time, brief)
#   5. Create the app DB + 'iprs_app' SQL login
#   6. Write DATABASE_URL to .env
# Prereq: SQL Server 2017+ installed, instance registered as service
#         'MSSQL$SQLEXPRESS01'. RUN AS ADMINISTRATOR.
# Run: powershell -ExecutionPolicy Bypass -File scripts/setup-db.ps1
# ==================================================================
[CmdletBinding()]
param(
    [string]$InstanceName = 'SQLEXPRESS01',
    [string]$DbName       = 'Dreamsoft_UAT',
    [string]$AppUser      = 'iprs_app',
    [string]$AppPass      = 'iprs_app',
    [int]$SqlPort         = 1433
)

$ErrorActionPreference = 'Stop'

# --- 0. Elevation check ---
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error 'This script must run from an elevated (Administrator) PowerShell. Registry edits + service restart require it.'
}

# --- 1. Locate sqlcmd ---
$sqlcmdCmd = Get-Command sqlcmd -ErrorAction SilentlyContinue
if ($sqlcmdCmd) { $sqlcmd = $sqlcmdCmd.Source }
if (-not $sqlcmd) {
    $candidate = 'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn\SQLCMD.EXE'
    if (Test-Path $candidate) { $sqlcmd = $candidate }
}
if (-not $sqlcmd) { Write-Error 'sqlcmd.exe not found. Install SQL Server tools or add it to PATH.' }

# --- 2. Resolve instance registry ID (e.g. MSSQL17.SQLEXPRESS01) ---
$instKey = 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL'
$instanceId = (Get-ItemProperty -Path $instKey -ErrorAction SilentlyContinue).$InstanceName
if (-not $instanceId) { Write-Error "Instance '$InstanceName' not found under $instKey." }
$svcName = "MSSQL`$$InstanceName"

# --- 3. Ensure the SQL Server service is running ---
$svc = Get-Service -Name $svcName -ErrorAction SilentlyContinue
if (-not $svc) { Write-Error "Service '$svcName' not found. Install SQL Server with instance name '$InstanceName' first." }
if ($svc.Status -ne 'Running') { Write-Host "Starting '$svcName'..."; Start-Service -Name $svcName; Start-Sleep -Seconds 3 }

# --- 4. Enable TCP/IP + static port on the instance ---
$tcpKey = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$instanceId\MSSQLServer\SuperSocketNetLib\Tcp"
if (Test-Path $tcpKey) {
    Write-Host "Enabling TCP/IP on $InstanceName (port $SqlPort)..."
    Set-ItemProperty -Path $tcpKey -Name 'Enabled' -Value 1
    $ipAll = "$tcpKey\IPAll"
    if (Test-Path $ipAll) {
        Set-ItemProperty -Path $ipAll -Name 'TcpPort' -Value "$SqlPort"
        Set-ItemProperty -Path $ipAll -Name 'TcpDynamicPorts' -Value ''
    }
} else {
    Write-Warning "TCP/IP registry key not found: $tcpKey"
}

# --- 5. Enable SQL Server (mixed-mode) authentication ---
$loginModeKey = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$instanceId\MSSQLServer"
if (Test-Path $loginModeKey) {
    Write-Host 'Enabling SQL Server + Windows Authentication (LoginMode=2)...'
    Set-ItemProperty -Path $loginModeKey -Name 'LoginMode' -Value 2
} else {
    Write-Warning "MSSQLServer registry key not found: $loginModeKey"
}

# --- 6. Start SQL Browser (needed for named-instance resolution) ---
$browser = Get-Service -Name 'SQLBrowser' -ErrorAction SilentlyContinue
if ($browser) {
    Write-Host 'Starting SQL Browser service...'
    if ($browser.StartType -ne 'Automatic') { Set-Service -Name 'SQLBrowser' -StartupType Automatic }
    if ($browser.Status -ne 'Running') { Start-Service -Name 'SQLBrowser' }
} else {
    Write-Warning 'SQLBrowser service not found; named-instance resolution may fail (use port directly).'
}

# --- 7. Restart the instance to apply TCP/LoginMode changes ---
Write-Host "Restarting '$svcName' to apply network/auth settings..."
Restart-Service -Name $svcName -Force
Start-Sleep -Seconds 8

# --- 8. Create DB + SQL login (idempotent) ---
$conn = "tcp:localhost,$SqlPort"
Write-Host "Creating database '$DbName' and login '$AppUser'..."
$setupSql = @"
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'$AppUser')
    CREATE LOGIN [$AppUser] WITH PASSWORD = N'$AppPass', CHECK_POLICY = OFF, DEFAULT_DATABASE = [master];
IF DB_ID(N'$DbName') IS NULL
    CREATE DATABASE [$DbName];
"@
& $sqlcmd -S $conn -E -b -C -Q $setupSql
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to create login/database (exit $LASTEXITCODE)." }

$grantSql = @"
USE [$DbName];
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$AppUser')
    CREATE USER [$AppUser] FOR LOGIN [$AppUser];
ALTER ROLE db_owner ADD MEMBER [$AppUser];
"@
& $sqlcmd -S $conn -E -b -C -Q $grantSql
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to grant db_owner (exit $LASTEXITCODE)." }

# --- 9. Write DATABASE_URL into .env ---
$url = "sqlserver://localhost:$SqlPort;database=$DbName;user=$AppUser;password=$AppPass;encrypt=true;trustServerCertificate=true;"
$line = "DATABASE_URL=""$url"""
$envFile = Join-Path $PSScriptRoot '..\.env'

if (Test-Path $envFile) {
    $content = Get-Content -Path $envFile -Raw
    if ($content -match '(?m)^DATABASE_URL=.*$') {
        $content = $content -replace '(?m)^DATABASE_URL=.*$', $line
        Set-Content -Path $envFile -Value $content -Encoding utf8
    } else {
        Add-Content -Path $envFile -Value "`n$line" -Encoding utf8
    }
} else {
    Set-Content -Path $envFile -Value "$line`n" -Encoding utf8
}

Write-Host ''
Write-Host "Done. DATABASE_URL set to: $url"
Write-Host ''
Write-Host "Next steps:"
Write-Host "  1) Import the schema:"
Write-Host "     & `"$sqlcmd`" -S `"$conn`" -U $AppUser -P $AppPass -C -i `"$(Join-Path $PSScriptRoot 'mra_cleaned.sql')`""
Write-Host "  2) Regenerate the Prisma client:"
Write-Host "     npx prisma db pull"
Write-Host "     npm run prisma:generate"
