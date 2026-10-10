#Requires -RunAsAdministrator
<#  MangoDash backup: consistent DB snapshot + photos + docs + .env
    Usage:  .\backup.ps1                     -> C:\MangoBackups\mangodash-YYYYMMDD-HHmm.zip
            .\backup.ps1 -Dest D:\Backups    -> custom destination folder
    Schedule it: schtasks /Create /TN MangoDashBackup /TR "powershell -ExecutionPolicy Bypass -File C:\MangoDash\backup.ps1" /SC DAILY /ST 03:00 /RU SYSTEM
#>
param([string]$Dest = "C:\MangoBackups")

$ErrorActionPreference = "Stop"
$InstallDir = "C:\MangoDash"
$Stamp = Get-Date -Format "yyyyMMdd-HHmm"
$Work = Join-Path $env:TEMP "mango-backup-$Stamp"

New-Item -ItemType Directory -Path $Dest -Force | Out-Null
New-Item -ItemType Directory -Path "$Work\data" -Force | Out-Null

# 1. Consistent SQLite snapshot using the app's own driver (safe while service runs)
Push-Location $InstallDir
node -e "const db=require('better-sqlite3')('data/mangodash.db',{readonly:true}); db.backup(process.argv[1]).then(()=>{console.log('db snapshot ok');process.exit(0)}).catch(e=>{console.error(e);process.exit(1)});" "$Work\data\mangodash.db".Replace('\','/')
if ($LASTEXITCODE -ne 0) { throw "Database snapshot failed" }
Pop-Location

# 2. Photos, docs, .env
if (Test-Path "$InstallDir\data\photos") { Copy-Item "$InstallDir\data\photos" "$Work\data\photos" -Recurse }
if (Test-Path "$InstallDir\data\docs")   { Copy-Item "$InstallDir\data\docs"   "$Work\data\docs"   -Recurse }
Copy-Item "$InstallDir\.env" "$Work\.env"

# 3. Zip + prune old backups (keep 14)
$Zip = Join-Path $Dest "mangodash-$Stamp.zip"
Compress-Archive -Path "$Work\*" -DestinationPath $Zip
Remove-Item $Work -Recurse -Force
Get-ChildItem $Dest -Filter "mangodash-*.zip" | Sort-Object CreationTime -Descending |
  Select-Object -Skip 14 | Remove-Item -Force
Write-Host "Backup complete: $Zip" -ForegroundColor Green