# MangoDash v3 — Self-Hosted Family Dashboard

## Install (Windows Server 2025)
1. Copy this folder to the server.
2. Elevated PowerShell:
     .\install.ps1
   or with Cloudflare Tunnel (remote access, Starlink-safe):
     .\install.ps1 -CloudflareToken "eyJ...your-tunnel-token"
3. Note the SERVER ADMIN password printed (also in C:\MangoDash\.env).

## URLs
- Login/Admin : http://SERVER:8080/login.html
- Displays    : http://SERVER:8080/display.html  (enter household pair code once)
- E-ink lite  : http://SERVER:8080/lite/PAIRCODE (old Kindle browsers)

## Cloudflare Tunnel (remote access without port forwarding)
1. Add a domain to a free Cloudflare account.
2. Zero Trust > Networks > Tunnels > Create tunnel > copy token.
3. Re-run install.ps1 with -CloudflareToken.
4. In the tunnel, add Public Hostname: dash.yourdomain.com -> http://localhost:8080

## Multi-family
Server admin generates "new household" invite codes in the Admin panel.
Relatives sign up at /login.html with the code and get an isolated household.

## Screens
- Windows AIO: msedge --kiosk http://SERVER:8080/display.html --edge-kiosk-type=fullscreen
- Fire tablet: Fully Kiosk Browser -> display URL
- E-ink Kindle: bookmark /lite/PAIRCODE