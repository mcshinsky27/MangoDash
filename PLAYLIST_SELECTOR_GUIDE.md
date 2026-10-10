# Playlist Selector - User Guide

## Overview
The jukebox now features a beautiful, animated playlist selector that allows users to choose from a curated list of YouTube playlists. The selector drops down when clicking "MUSIC FOR MILLIONS" and supports multi-selection to fill the 200-song jukebox slots.

## Features

### ✨ Visual Highlights
- **Animated Modal:** Smooth fade-in with scale and slide effects
- **Loading Spinner:** Shows while fetching playlist data from YouTube API
- **Playlist Grid:** Responsive 2-3 column layout
- **Selection Feedback:** Checkboxes with pulse animation
- **Live Counter:** Shows selected playlists and total track count
- **Enhanced Seeburg Box:** Hover effect with dropdown indicator

### 🎯 User Flow
1. **Click "MUSIC FOR MILLIONS"** - Modal drops down with animation
2. **View Playlists** - Fetches titles and track counts from YouTube
3. **Select Playlists** - Click any playlists (1-25) to select/deselect
4. **See Summary** - Live counter shows "X PLAYLISTS • Y TRACKS"
5. **Load Jukebox** - Click button to populate jukebox with selected playlists
6. **Confirmation** - Display shows "N PLAYLISTS LOADED • X TRACKS"

## Configuration

### Playlist Library
Edit `PLAYLIST_LIBRARY` array in `jukebox.html` (line ~1124):

```javascript
const PLAYLIST_LIBRARY = [
  "PLOHoVaTp8R7d3L_pjuwIa6nRh4tH5nI4x",
  "PLOHoVaTp8R7f9GV4HW3joHrz4Oq16QBph",
  "PLr_3_vOUiFjDDLaRNKmAnqbc-uzgRdfNu",
  // Add more playlist IDs here
];
```

### Default Selection
Edit `DEFAULT_SELECTED_PLAYLISTS` array (line ~1135):

```javascript
const DEFAULT_SELECTED_PLAYLISTS = [
  "PLOHoVaTp8R7d3L_pjuwIa6nRh4tH5nI4x",
  "PLOHoVaTp8R7f9GV4HW3joHrz4Oq16QBph"
];
```

## Technical Details

### API Endpoint
**Server:** `/api/display/:deviceId/playlists/metadata?ids=PL1,PL2,PL3`

**Response:**
```json
{
  "playlists": [
    {
      "id": "PLOHoVaTp8R7d3L_pjuwIa6nRh4tH5nI4x",
      "title": "Playlist Title",
      "trackCount": 127,
      "thumbnail": "https://i.ytimg.com/..."
    }
  ]
}
```

### YouTube API Usage
- Fetches playlist metadata on modal open
- Requires `YOUTUBE_API_KEY` environment variable
- Uses `playlistItems` endpoint for track counts
- Caches results in memory for duration of session

### File Changes

**Modified Files:**
1. `server/server.js` - Added playlist metadata endpoint
2. `public/jukebox.html` - Added modal HTML, CSS, and JavaScript

**Lines Added:**
- Server: ~34 lines (endpoint)
- HTML: ~26 lines (modal structure)
- CSS: ~326 lines (styling and animations)
- JavaScript: ~186 lines (logic and state management)

## Customization

### Styling
All CSS variables and colors can be customized in the `<style>` section:
- Primary color: `#c9a227` (gold)
- Background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)`
- Border: `2px solid #c9a227`

### Adding More Playlists
Simply add new playlist IDs to the `PLAYLIST_LIBRARY` array:

```javascript
const PLAYLIST_LIBRARY = [
  "PLOHoVaTp8R7d3L_pjuwIa6nRh4tH5nI4x",
  "PLOHoVaTp8R7f9GV4HW3joHrz4Oq16QBph",
  "PLr_3_vOUiFjDDLaRNKmAnqbc-uzgRdfNu",
  "PL2N_sVGOb3clqyWSLspkp8BAv4FBfBaxH",
  "PLkqz3S84Tw-TPCtKs1vw8AnRcGhms67h3",
  "PLK1Ccv_vyLIw5E8zWwZt1OlmMIvO4mrwD",
  "PLAxT_DkSwQLuq9R351Vp9kVGbE4TiMzQ6",
  "PLplXQ2cg9B_o1X-Knd5wgbAi-YDTSbmy-",
  "YOUR_NEW_PLAYLIST_ID_HERE"  // Add this
];
```

### Removing Playlists
Just remove the ID from the `PLAYLIST_LIBRARY` array.

## Troubleshooting

### Modal Not Opening
- Check that `#seeburg` element exists in HTML
- Verify JavaScript console for errors
- Ensure `initPlaylistSelector()` is called

### Playlists Not Loading
- Verify `YOUTUBE_API_KEY` is set in environment
- Check YouTube API quota limits
- Test endpoint directly: `/api/display/{deviceId}/playlists/metadata?ids=PL...`

### Wrong Track Counts
- YouTube API may cache data
- Playlist owner may have hidden track count
- Verify playlist is public (not private)

## Browser Compatibility
- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari
- ⚠️ IE11 (not supported - uses modern CSS/JS)

## Mobile Responsive
The modal automatically adjusts for smaller screens:
- Single column playlist grid
- Full-width load button
- Reduced padding and font sizes
- Touch-friendly tap targets

## Future Enhancements
Potential additions:
- [ ] Playlist thumbnails in grid
- [ ] Search/filter playlists
- [ ] Categories/groups
- [ ] Save user preferences
- [ ] Preload next playlist batch
- [ ] Export/import playlist configurations

## Support
For issues or questions, check:
1. Browser console for errors
2. Network tab for API failures
3. Server logs for endpoint errors
4. YouTube API quota status

---

**Last Updated:** 2026-10-07
**Version:** 1.0