# Multi-Playlist Jukebox Support

## Overview
The jukebox now supports loading songs from multiple playlists simultaneously, populating the 200 available slots with tracks from all selected playlists.

## Usage

### URL Format
Add comma-separated playlist IDs to the jukebox URL:

**Single Playlist:**
```
http://localhost:3000/jukebox?playlist=PLx123abc
```

**Multiple Playlists:**
```
http://localhost:3000/jukebox?playlist=PLx123abc,PLy456def,PLz789ghi
```

### Supported Playlist Types

#### YouTube Playlists
- Use YouTube playlist IDs (e.g., `PLx123abc`)
- Multiple YouTube playlists can be combined
- Example: `?playlist=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf,PLrAXtmErZgOdP_8GztsuKi9nrraNbKFp4`

#### Spotify Playlists (Requires Device Pairing)
- Use Spotify playlist IDs or URIs
- Multiple Spotify playlists can be combined
- Mix Spotify and YouTube playlists together
- Example: `?playlist=37i9dQZF1DXcBWIGoYBM5M,5FVd6KXrgO9B3JPmC8OPst`

### URL with Device Pairing (Spotify)
```
http://localhost:3000/jukebox?device=your-device-id&playlist=37i9dQZF1DXcBWIGoYBM5M,5FVd6KXrgO9B3JPmC8OPst
```

## Features

### Track Limit
- Maximum 200 tracks total (fits jukebox card layout)
- Tracks are loaded in order from the provided playlists
- Once 200 tracks are reached, remaining playlists are skipped

### Error Resilience
- If one playlist fails to load, others continue to load
- Warnings are displayed in the console and briefly shown on screen
- Partial results are returned even if some playlists fail

### Visual Indicators
- **Single Playlist:** Displays "MAKE SELECTION" when ready
- **Multiple Playlists:** Displays "N PLAYLISTS LOADED  X TRACKS" for 3 seconds
- **Warnings:** Any loading issues are shown briefly before returning to selection prompt

## Example Scenarios

### Scenario 1: Combine Two YouTube Playlists
```
http://localhost:3000/jukebox?playlist=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf,PLrAXtmErZgOdP_8GztsuKi9nrraNbKFp4
```
**Result:** Loads up to 200 songs from both playlists, displays "2 PLAYLISTS LOADED  200 TRACKS"

### Scenario 2: Three Spotify Playlists (Paired Device)
```
http://localhost:3000/jukebox?device=abc123&playlist=37i9dQZF1DXcBWIGoYBM5M,5FVd6KXrgO9B3JPmC8OPst,37i9dQZF1DX0XUsuxWHRQd
```
**Result:** Loads up to 200 songs from all three playlists, displays "3 PLAYLISTS LOADED  200 TRACKS"

### Scenario 3: Mixed YouTube and Spotify
```
http://localhost:3000/jukebox?device=abc123&playlist=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf,37i9dQZF1DXcBWIGoYBM5M
```
**Result:** Loads from both playlists, prioritizing YouTube first, then Spotify

### Scenario 4: One Playlist Fails
```
http://localhost:3000/jukebox?playlist=PLvalid123,PLinvalid456,PLvalid789
```
**Result:** Loads from valid playlists, shows warning for invalid one, displays track count from successful loads

## Backend Changes

### API Endpoints Updated
1. **`/api/display/:deviceId/jukebox`** - Paired device endpoint (Spotify + YouTube)
2. **`/api/jukebox`** - Public endpoint (YouTube only)

### Response Format
```json
{
  "provider": "spotify",
  "tracks": [...],
  "playlistCount": 3,
  "warnings": ["Failed to load playlist: invalid_id"]
}
```

## Technical Details

### Playlist ID Parsing
- Comma-separated values are split and trimmed
- Empty values are filtered out
- Each playlist ID is validated before loading

### Loading Order
1. Playlists are processed in the order provided
2. Tracks are accumulated until 200 is reached
3. First successful provider sets the response provider type

### Error Handling
- YouTube API key missing → Warning, skip playlist
- Spotify not connected → Warning, skip remaining playlists
- Invalid playlist ID → Warning, continue with next
- API errors → Warning, continue with next

## Testing Checklist

- [x] Single playlist still works (backward compatibility)
- [x] Multiple YouTube playlists load correctly
- [x] Multiple Spotify playlists load correctly
- [x] Mixed YouTube + Spotify playlists work
- [x] 200 track limit is enforced
- [x] Warnings display for failed playlists
- [x] Playlist count indicator shows on screen
- [x] Console logs show detailed information

## Notes

- URLs with many playlist IDs may become long, but well within browser limits
- Track order follows playlist order (first playlist's tracks appear first)
- Duplicate tracks across playlists are not deduplicated (may appear multiple times)
- For best results, use playlists with non-overlapping track lists
