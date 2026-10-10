#Requires -RunAsAdministrator
<#  MangoDash restore: lay a backup zip onto this install (new or existing).
    New-server flow: run install.ps1 first (prereqs+service), then this.
    Usage: .\restore.ps1 -BackupZip C:\MangoBackups\mangodash-20250818-0300.zip
#>
param([Parameter(Mandatory=$true)][string]$BackupZip)

$ErrorActionPreference = "Stop"
$InstallDir = "C:\MangoDash"
if (-not (Test-Path $BackupZip)) { throw "Backup zip not found: $BackupZip" }
if (-not (Test-Path "$InstallDir\server\server.js")) {
  throw "MangoDash is not installed. Run install.ps1 first, then re-run restore.ps1."
}

Write-Host "Stopping MangoDash service..." -ForegroundColor Yellow
Stop-Service MangoDash -ErrorAction SilentlyContinue
Start-Sleep 2

$Work = Join-Path $env:TEMP "mango-restore"
if (Test-Path $Work) { Remove-Item $Work -Recurse -Force }
Expand-Archive $BackupZip -DestinationPath $Work

# Safety copy of current data before overwrite
if (Test-Path "$InstallDir\data\mangodash.db") {
  $safety = "$InstallDir\data\pre-restore-$(Get-Date -Format yyyyMMdd-HHmm)"
  New-Item -ItemType Directory -Path $safety -Force | Out-Null
  Copy-Item "$InstallDir\data\mangodash.db" $safety
}

# Remove WAL/SHM so the restored DB starts clean, then overlay backup
Remove-Item "$InstallDir\data\mangodash.db*" -Force -ErrorAction SilentlyContinue
Copy-Item "$Work\data\*" "$InstallDir\data\" -Recurse -Force
if (Test-Path "$Work\.env") { Copy-Item "$Work\.env" "$InstallDir\.env" -Force }
Remove-Item $Work -Recurse -Force

Start-Service MangoDash
Write-Host "Restore complete. Service started." -ForegroundColor Green
Write-Host "Verify at http://localhost:8080/login.html"