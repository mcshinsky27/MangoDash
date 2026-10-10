# Backup & Restore Guide

## Automated Backups

### Daily Backup Script

Schedule with Task Scheduler:
```powershell
schtasks /Create /TN MangoDashBackup /TR "powershell -ExecutionPolicy Bypass -File C:\MangoDash\backup.ps1" /SC DAILY /ST 03:00 /RU SYSTEM
```

### Manual Backup

```powershell
cd C:\MangoDash
.\backup.ps1
```

**Output**: `C:\MangoBackups\mangodash-YYYYMMDD-HHmm.zip`

### Custom Destination

```powershell
.\backup.ps1 -Dest D:\MyBackups
```

## Backup Contents

1. **Database Snapshot**: Consistent SQLite backup (WAL-safe)
2. **Photos**: All uploaded photos
3. **Documents**: All uploaded PDFs/docs
4. **Environment**: `.env` file (credentials)

## Backup Retention

- **Keeps**: Last 14 backups
- **Older**: Auto-deleted

## Restore Process

### Via Admin Panel

1. Admin panel → Backup/Restore bar
2. Select backup from dropdown
3. Click "Restore"
4. Service restarts automatically
5. Refresh browser after 8 seconds

### Via PowerShell

```powershell
cd C:\MangoDash
.\restore.ps1 -Backup "C:\MangoBackups\mangodash-20261010-143022.zip"
```

### Manual Restore

```powershell
# Stop service
Stop-Service -Name MangoDash

# Extract backup
Expand-Archive -Path "C:\MangoBackups\mangodash-20261010-143022.zip" -DestinationPath "C:\Temp\restore"

# Copy files
Copy-Item "C:\Temp\restore\*" -Destination "C:\MangoDash" -Recurse -Force

# Start service
Start-Service -Name MangoDash
```

## Backup Best Practices

1. **Daily automated backups** at 3 AM
2. **Offsite copies**: Copy zip to cloud storage
3. **Test restores**: Periodically verify backups work
4. **Pre-updates**: Manual backup before major changes

## Backup Script Details

The `backup.ps1` script:

1. **Creates consistent database snapshot** using better-sqlite3 backup API
2. **Copies photos and documents** directories
3. **Includes .env file** for full restore capability
4. **Zips everything** to timestamped archive
5. **Cleans up old backups** (keeps last 14)

## Restore Script Details

The `restore.ps1` script:

1. **Stops the MangoDash service**
2. **Extracts backup** to temporary location
3. **Overwrites all files** from backup
4. **Restarts the service**
5. **Logs the operation**
