# Multi-Playlist Support - Deployment Guide

## Current Status
✅ **Local Implementation Complete** - All code changes are ready in `c:\MangoDash`
⚠️ **Production Server Needs Update** - The server at `dash.mcshinsky.com` is running old code

## Issue Diagnosis

When testing the URL:
```
https://dash.mcshinsky.com/jukebox.html?playlist=PLr_3_vOUiFjDDLaRNKmAnqbc-uzgRdfNu,PL2N_sVGOb3clqyWSLspkp8BAv4FBfBaxH
```

The API returned:
```json
{"error":"Spotify playlists require a paired device. Add ?device=xxx parameter."}
```

**Root Cause:** The production server is running the OLD code that doesn't support comma-separated playlist IDs. It treats the entire string `PL...,PL...` as a single playlist ID, which:
1. Doesn't match YouTube's pattern (because of the comma)
2. Falls through to Spotify logic
3. Returns the "requires paired device" error

## Deployment Steps

### Option 1: Manual File Copy (Quick)

1. **Copy updated files to production server:**
   ```
   server/server.js
   public/jukebox.html
   ```

2. **Restart the Node.js server:**
   ```bash
   # Stop the running server (Ctrl+C or kill process)
   # Then restart:
   npm start
   # or
   node server/server.js
   ```

### Option 2: Git Pull (If using Git)

```bash
cd /path/to/mangodash
git pull
npm start
```

### Option 3: PM2 (If using PM2)

```bash
cd /path/to/mangodash
git pull  # or copy files
pm2 restart all
```

## Testing After Deployment

### Test 1: Single YouTube Playlist (Backward Compatibility)
```
https://dash.mcshinsky.com/jukebox?playlist=PLr_3_vOUiFjDDLaRNKmAnqbc-uzgRdfNu
```
**Expected:** Loads tracks, shows "MAKE SELECTION"

### Test 2: Multiple YouTube Playlists
```
https://dash.mcshinsky.com/jukebox?playlist=PLr_3_vOUiFjDDLaRNKmAnqbc-uzgRdfNu,PL2N_sVGOb3clqyWSLspkp8BAv4FBfBaxH
```
**Expected:** Loads tracks from both playlists, shows "2 PLAYLISTS LOADED  X TRACKS"

### Test 3: API Direct Test
```bash
curl "https://dash.mcshinsky.com/api/jukebox?playlist=PLr_3_vOUiFjDDLaRNKmAnqbc-uzgRdfNu,PL2N_sVGOb3clqyWSLspkp8BAv4FBfBaxH"
```
**Expected:** Returns JSON with `playlistCount: 2` and tracks array

## Files Changed

### 1. `server/server.js`
- **Lines 756-847:** Updated `/api/display/:deviceId/jukebox` endpoint
- **Lines 884-932:** Updated `/api/jukebox` endpoint

### 2. `public/jukebox.html`
- **Lines 455-487:** Added multi-playlist display logic in `loadTracks()` function

## What Changed

### Before (Old Code):
```javascript
const playlistParam = req.query.playlist;
if (!playlistParam) return res.json({ error: "No playlist configured." });

const ytPid = parseYouTubePlaylistId(playlistParam);  // Fails with comma-separated
if (ytPid) {
  // Load single YouTube playlist
}
// Falls through to Spotify...
```

### After (New Code):
```javascript
const playlistParam = req.query.playlist || "";
const playlistIds = playlistParam.split(",").map(p => p.trim()).filter(p => p);

for (const pid of playlistIds) {
  const ytPid = parseYouTubePlaylistId(pid);  // Now checks each ID individually
  if (ytPid) {
    // Load YouTube playlist
  } else {
    // Load Spotify playlist
  }
}
```

## Verification Checklist

After deploying, verify:
- [ ] Single playlist URLs still work
- [ ] Multiple playlist URLs load tracks from all playlists
- [ ] "N PLAYLISTS LOADED" message appears for multiple playlists
- [ ] Track count is correct (up to 200 total)
- [ ] No "forbidden" or "requires paired device" errors for YouTube playlists

## Rollback Plan

If issues occur, restore the old files:
1. Revert `server/server.js` to previous version
2. Revert `public/jukebox.html` to previous version
3. Restart the server

## Contact

If you need help deploying, check the server logs at:
```
/var/log/mangodash/  # or wherever your server logs are stored
```

Look for errors during startup or when accessing the jukebox endpoint.