# MangoDash v3 — Self-Hosted Family Dashboard

**Complete Documentation Suite** 📚

Welcome to MangoDash! This document provides a quick start. For detailed information, see our comprehensive documentation guides:

- 📘 **[COMPREHENSIVE_GUIDE.md](COMPREHENSIVE_GUIDE.md)** - Complete system overview and architecture
- ⚙️ **[CONFIGURATION_GUIDE.md](CONFIGURATION_GUIDE.md)** - Environment variables and API setup
- 📱 **[WIDGET_REFERENCE.md](WIDGET_REFERENCE.md)** - All 46+ widgets with configuration examples
- 🎵 **[JUKEBOX_GUIDE.md](JUKEBOX_GUIDE.md)** - Jukebox system documentation
- 🔌 **[API_REFERENCE.md](API_REFERENCE.md)** - Complete API endpoint reference
- 💾 **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Database structure reference
- 💿 **[BACKUP_RESTORE_GUIDE.md](BACKUP_RESTORE_GUIDE.md)** - Backup and restore procedures
- 🔧 **[TROUBLESHOOTING_GUIDE.md](TROUBLESHOOTING_GUIDE.md)** - Common issues and solutions

---

## Quick Start

### Install (Windows Server 2025)

1. Copy this folder to the server
2. Elevated PowerShell:
   ```powershell
   .\install.ps1
   ```
   Or with Cloudflare Tunnel (remote access, Starlink-safe):
   ```powershell
   .\install.ps1 -CloudflareToken "eyJ...your-tunnel-token"
   ```
3. Note the SERVER ADMIN password printed (also in `C:\MangoDash\.env`)

### URLs

- **Login/Admin**: `http://SERVER:8080/login.html`
- **Displays**: `http://SERVER:8080/display.html` (enter household pair code once)
- **E-ink lite**: `http://SERVER:8080/lite/PAIRCODE` (old Kindle browsers)
- **Admin Panel**: `http://SERVER:8080/admin.html` (after login)

### Cloudflare Tunnel (Remote Access Without Port Forwarding)

1. Add a domain to a free Cloudflare account
2. Zero Trust > Networks > Tunnels > Create tunnel > copy token
3. Re-run install.ps1 with `-CloudflareToken`
4. In the tunnel, add Public Hostname: `dash.yourdomain.com` → `http://localhost:8080`

### Multi-Family Support

Server admin generates "new household" invite codes in the Admin panel. Relatives sign up at `/login.html` with the code and get an isolated household.

### Screens

- **Windows AIO**: `msedge --kiosk http://SERVER:8080/display.html --edge-kiosk-type=fullscreen`
- **Fire tablet**: Fully Kiosk Browser → display URL
- **E-ink Kindle**: bookmark `/lite/PAIRCODE`

---

## Documentation Quick Links

### For New Users
1. [Configuration Guide](CONFIGURATION_GUIDE.md) - Set up API keys
2. [Widget Reference](WIDGET_REFERENCE.md) - Choose widgets for your dashboard
3. [Comprehensive Guide](COMPREHENSIVE_GUIDE.md) - Learn the system

### For Administrators
1. [Backup & Restore Guide](BACKUP_RESTORE_GUIDE.md) - Protect your data
2. [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md) - Solve problems
3. [Database Schema](DATABASE_SCHEMA.md) - Understand data structure

### For Developers
1. [API Reference](API_REFERENCE.md) - Integrate with MangoDash
2. [Comprehensive Guide](COMPREHENSIVE_GUIDE.md#development-guide) - Build new widgets

### Special Features
1. [Jukebox Guide](JUKEBOX_GUIDE.md) - Retro music player system
2. [Education Suite](COMPREHENSIVE_GUIDE.md#education-suite) - Google integration

---

## Widget Categories

MangoDash includes 46+ widgets across these categories:

- 📅 **Calendar & Time** (7 widgets): Calendars, clocks, countdowns
- 🎓 **Education** (8 widgets): Classroom, Gmail, Docs, Alma, ParentSquare, games
- 🌤️ **Weather** (4 widgets): Current, hourly, 10-day, maps
- 🎬 **Media** (8 widgets): Spotify, YouTube, Jukebox, Movies, Photos
- 🏠 **Home & Family** (14 widgets): Chores, meals, packages, announcements, more
- 📰 **News & Info** (6 widgets): News, sports, stocks, jokes, quotes

---

## Tech Stack

- **Backend**: Node.js 20+, Express 4.19, SQLite3 (better-sqlite3)
- **Frontend**: Vanilla JavaScript, GridStack.js
- **Real-time**: WebSocket (ws)
- **Auth**: bcryptjs, cookie-parser
- **APIs**: Google OAuth 2.0, Spotify, YouTube, TMDB, Open-Meteo

---

## Repository

🔗 **GitHub**: https://github.com/mcshinsky27/MangoDash

---

*For complete documentation, see the guides listed above.*