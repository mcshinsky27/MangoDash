# MangoDash — Comprehensive Documentation

**Version:** 3.0.0  
**Last Updated:** 2026-10-10  
**Repository:** https://github.com/mcshinsky27/MangoDash

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Installation & Deployment](#installation--deployment)
4. [Configuration & Environment Variables](#configuration--environment-variables)
5. [Authentication & Security](#authentication--security)
6. [Widget Reference](#widget-reference)
7. [Education Suite](#education-suite)
8. [Jukebox System](#jukebox-system)
9. [API Reference](#api-reference)
10. [Database Schema](#database-schema)
11. [Backup & Restore](#backup--restore)
12. [Troubleshooting](#troubleshooting)
13. [Development Guide](#development-guide)

---

## Overview

MangoDash is a self-hosted family dashboard system designed for multi-household deployments. It provides a centralized platform for:

- **Family Organization**: Calendars, chores, packages, meals, to-dos, announcements
- **Education Integration**: Google Classroom, Gmail, Google Docs, Alma, ParentSquare
- **Media Entertainment**: Spotify, YouTube, Jukebox, Movies, Photos
- **News & Information**: RSS feeds, weather, sports, stocks, local information
- **Home Management**: Screen time, routines, screen rotation, multi-device support

### Key Features

- **Multi-Household Support**: Isolated family units with shared server infrastructure
- **Device Pairing**: Displays authenticate via pair codes for secure access
- **Real-time Updates**: WebSocket connections for live data synchronization
- **Responsive Design**: Works on Windows kiosks, Fire tablets, E-ink Kindles
- **Cloudflare Tunnel**: Optional remote access without port forwarding
- **Backup System**: Automated daily backups with point-in-time restore

### Tech Stack

- **Backend**: Node.js 20+, Express 4.19, SQLite3 (better-sqlite3)
- **Frontend**: Vanilla JavaScript, GridStack.js for dashboard layout
- **Real-time**: WebSocket (ws library)
- **Authentication**: bcryptjs, cookie-parser, session tokens
- **External APIs**: Google OAuth 2.0, Spotify Web API, YouTube Data API, TMDB, Open-Meteo
- **External APIs**: Google OAuth 2.0, Spotify Web API, YouTube Data API, TMDB, Open-Meteo

---

## System Architecture

### Directory Structure

```
C:\MangoDash\
├── server/
│   ├── server.js           # Main Express application
│   ├── widgets.js          # Widget data providers
│   └── education.js        # Google OAuth & education integrations
├── public/
│   ├── admin.html          # Dashboard administration interface
│   ├── display.html        # Main display view
│   ├── jukebox.html        # Retro jukebox interface
│   ├── connect.html        # Connections portal (Google auth)
│   ├── login.html          # Authentication page
│   ├── css/
│   │   └── dash.css        # Global styles
│   └── js/
│       ├── admin.js        # Admin panel logic
│       ├── display.js      # Display rendering logic
│       └── apps.js         # App catalog (education suite)
├── data/
│   ├── mangodash.db        # SQLite database
│   ├── photos/             # User-uploaded photos
│   ├── docs/               # User-uploaded PDFs/documents
│   └── cache.json          # API cache
├── logs/                   # Service logs
├── Backup/                 # Historical backup snapshots
├── .env                    # Environment configuration
├── package.json            # Node.js dependencies
├── install.ps1             # Windows installer script
└── backup.ps1              # Backup automation script
```

### Component Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Admin UI   │────▶│  Express API │◀───▶│  SQLite DB  │
│ (admin.html)│     │ (server.js)  │     │             │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Widgets    │
                    │   (widgets.js)
                    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ External APIs│
                    │ Google/Spotify│
                    │ YouTube/TMDB │
                    └──────────────┘

┌─────────────┐     ┌──────────────┐
│ Display     │────▶│  WebSocket   │
│ (display.html)    │  (real-time) │
└─────────────┘     └──────────────┘
```

---

## Installation & Deployment

### Windows Server Installation

#### Prerequisites
- Windows Server 2016+ or Windows 10/11
- Administrator privileges
- Internet connection (for initial setup)

#### Step-by-Step Installation

1. **Copy Files to Server** - Copy project folder to C:\MangoDash

2. **Run Installer (Elevated PowerShell)**
   ```powershell
   # Basic LAN installation
   cd C:\MangoDash
   .\install.ps1

   # With Cloudflare Tunnel for remote access
   .\install.ps1 -CloudflareToken "eyJ...your-tunnel-token"
   ```

3. **Note Server Admin Credentials** - Displayed in console and stored in `.env`

#### Installation Script Details

The `install.ps1` script performs:
1. **Node.js Installation** - Checks for existing, installs LTS via winget/MSI
2. **Dependency Installation** - `npm install --no-audit --no-fund`
3. **Service Setup (NSSM)** - Registers as Windows service with auto-start
4. **Firewall Configuration** - Opens port 8080
5. **Cloudflare Tunnel (Optional)** - Enables remote access without port forwarding

### Access URLs

- **Login/Admin**: `http://SERVER:8080/login.html`
- **Displays**: `http://SERVER:8080/display.html`
- **E-ink Lite**: `http://SERVER:8080/lite/PAIRCODE`
- **Admin Panel**: `http://SERVER:8080/admin.html` (after login)

### Multi-Family Deployment

1. Server admin logs into admin panel
2. Generates "new household" invite codes
3. Relatives sign up at `/login.html` with code
4. Each household gets isolated data and dashboards