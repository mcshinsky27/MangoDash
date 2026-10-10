#Requires -RunAsAdministrator
param([string]$CloudflareToken = "", [int]$Port = 8080)
$ErrorActionPreference = "Stop"
$InstallDir = "C:\MangoDash"
$SvcName = "MangoDash"
Write-Host "=== MangoDash v3 Installer ===" -ForegroundColor Cyan

if ($PSScriptRoot -ne $InstallDir) {
    Write-Host "Copying files to $InstallDir..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Copy-Item "$PSScriptRoot\*" $InstallDir -Recurse -Force
}
foreach ($d in @("$InstallDir\data","$InstallDir\data\photos","$InstallDir\tools","$InstallDir\logs")) {
    New-Item -ItemType Directory -Path $d -Force | Out-Null
}

# Node.js LTS
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Node.js LTS..." -ForegroundColor Yellow
    try { winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent }
    catch {
        $msi = "$env:TEMP\node.msi"
        Invoke-WebRequest "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi" -OutFile $msi
        Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn" -Wait
    }
    $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [Environment]::GetEnvironmentVariable("Path","User")
}
Write-Host "Node: $(node -v)" -ForegroundColor Green

# NSSM
$Nssm = "$InstallDir\tools\nssm.exe"
if (-not (Test-Path $Nssm)) {
    $zip = "$env:TEMP\nssm.zip"
    Invoke-WebRequest "https://nssm.cc/release/nssm-2.24.zip" -OutFile $zip
    Expand-Archive $zip "$env:TEMP\nssm" -Force
    Copy-Item "$env:TEMP\nssm\nssm-2.24\win64\nssm.exe" $Nssm
}

# .env
if (-not (Test-Path "$InstallDir\.env")) {
    $pw  = -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 16 | ForEach-Object {[char]$_})
    $sec = -join ((48..57)+(97..122) | Get-Random -Count 48 | ForEach-Object {[char]$_})
    "PORT=$Port`nSESSION_SECRET=$sec`nSERVER_ADMIN_EMAIL=admin@local`nSERVER_ADMIN_PASSWORD=$pw" |
        Out-File "$InstallDir\.env" -Encoding ascii
    Write-Host ">>> SERVER ADMIN LOGIN: admin@local / $pw" -ForegroundColor Magenta
}

Push-Location $InstallDir
npm install --no-audit --no-fund
Pop-Location

if (-not (Get-NetFirewallRule -DisplayName "MangoDash" -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName "MangoDash" -Direction Inbound -Protocol TCP `
        -LocalPort $Port -Action Allow -Profile Any | Out-Null
}

$NodeExe = (Get-Command node).Source
& $Nssm stop $SvcName 2>$null; & $Nssm remove $SvcName confirm 2>$null
& $Nssm install $SvcName $NodeExe "$InstallDir\server\server.js"
& $Nssm set $SvcName AppDirectory $InstallDir
& $Nssm set $SvcName Start SERVICE_AUTO_START
& $Nssm set $SvcName AppStdout "$InstallDir\logs\out.log"
& $Nssm set $SvcName AppStderr "$InstallDir\logs\err.log"
& $Nssm set $SvcName AppRotateFiles 1
& $Nssm set $SvcName AppRotateBytes 1048576
& $Nssm set $SvcName AppExit Default Restart
& $Nssm set $SvcName AppRestartDelay 5000
Start-Service $SvcName

if ($CloudflareToken) {
    Write-Host "Installing cloudflared (Cloudflare Tunnel)..." -ForegroundColor Yellow
    $Cfd = "$InstallDir\tools\cloudflared.exe"
    if (-not (Test-Path $Cfd)) {
        Invoke-WebRequest "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $Cfd
    }
    & $Cfd service uninstall 2>$null
    & $Cfd service install $CloudflareToken
    Start-Service cloudflared -ErrorAction SilentlyContinue
    Write-Host "Tunnel service running." -ForegroundColor Green
} else {
    Write-Host "LAN-only mode. Re-run with -CloudflareToken to enable remote access." -ForegroundColor Yellow
}
Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Cyan
Write-Host "Login    : http://$($env:COMPUTERNAME):$Port/login.html"
Write-Host "Displays : http://$($env:COMPUTERNAME):$Port/display.html"
Write-Host "E-ink    : http://$($env:COMPUTERNAME):$Port/lite/PAIRCODE"