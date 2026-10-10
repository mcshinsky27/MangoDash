# Troubleshooting Guide

## Common Issues

### Service Won't Start

**Symptoms**: Service stopped, error log present

**Diagnosis**:
```powershell
Get-Service -Name MangoDash
Get-Content C:\MangoDash\service_error.log -Tail 50
```

**Solutions**:
1. Check `.env` file exists and is valid
2. Verify port 8080 not in use
3. Check Node.js is installed: `node --version`
4. Reinstall dependencies: `cd C:\MangoDash && npm install`

### Can't Access Dashboard

**Symptoms**: Browser shows "connection refused"

**Diagnosis**:
```powershell
# Check service is running
Get-Service -Name MangoDash

# Check firewall rule
Get-NetFirewallRule -DisplayName "MangoDash"

# Test local access
curl http://localhost:8080/login.html
```

**Solutions**:
1. Start service: `Start-Service -Name MangoDash`
2. Add firewall rule: `.\install.ps1`
3. Check port in `.env`: `PORT=8080`

### Spotify Widget Not Working

**Symptoms**: "Spotify not connected" error

**Diagnosis**:
1. Check `.env` has SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET
2. Verify Google OAuth connected at `/connect.html`
3. Check Spotify device is online and signed in

**Solutions**:
1. Reconnect Google at `/connect.html`
2. Open Spotify on a device (phone, computer)
3. Verify API credentials are correct

### YouTube/Jukebox Not Loading

**Symptoms**: "Forbidden" or "API error"

**Diagnosis**:
1. Check YOUTUBE_API_KEY in `.env`
2. Verify YouTube Data API v3 is enabled
3. Check API quota at https://console.developers.google.com

**Solutions**:
1. Add/verify YOUTUBE_API_KEY in `.env`
2. Enable YouTube Data API v3 in Google Cloud Console
3. Wait for quota reset (midnight PST) or request limit increase

### Google Classroom Not Showing Data

**Symptoms**: "Not connected" or empty list

**Diagnosis**:
1. Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in `.env`
2. Verify Classroom API is enabled
3. Check OAuth consent screen is configured

**Solutions**:
1. Reconnect at `/connect.html`
2. Ensure school Google account has Classroom access
3. Verify redirect URI in Google Cloud Console

### Database Corruption

**Symptoms**: Errors accessing data, missing records

**Diagnosis**:
```powershell
# Check database integrity
cd C:\MangoDash
node -e "const db=require('better-sqlite3')('data/mangodash.db'); console.log(db.prepare('SELECT 1').get());"
```

**Solutions**:
1. Restore from backup (see Backup & Restore guide)
2. Delete WAL files: `Remove-Item data/mangodash.db-*`
3. Rebuild database from scratch (last resort)

### Page Rotation Not Working

**Symptoms**: Dashboard stuck on one page

**Diagnosis**:
1. Check multiple pages exist in dashboard config
2. Verify `rotate_secs` is set (minimum 5 seconds)
3. Check if media is playing (Spotify/YouTube hold rotation)

**Solutions**:
1. Admin panel → Pages → Set "Show this page for X seconds"
2. Stop media playback if it's holding rotation
3. Refresh display page (Ctrl+F5)

## Log Locations

- **Service stdout**: `C:\MangoDash\logs\out.log`
- **Service stderr**: `C:\MangoDash\logs\err.log`
- **Error log**: `C:\MangoDash\service_error.log`

## Browser Console

- Open DevTools (F12)
- Console tab for JavaScript errors
- Network tab for API failures

## Service Commands

```powershell
# Check status
Get-Service -Name MangoDash

# Start service
Start-Service -Name MangoDash

# Stop service
Stop-Service -Name MangoDash

# Restart service
Restart-Service -Name MangoDash

# View logs
Get-Content C:\MangoDash\logs\out.log -Tail 100 -Wait
```
