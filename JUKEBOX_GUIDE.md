# Jukebox System Guide

## Overview

The Jukebox is a retro-styled YouTube music player with vintage Wurlitzer aesthetics. It features a 5x8 selection grid, Free Play mode, and authentic sound effects.

## Access

- **Widget**: Add "Jukebox" widget to dashboard
- **Direct URL**: `http://SERVER:8080/jukebox.html`
- **Pre-loaded**: `http://SERVER:8080/jukebox.html?playlist=PLAYLIST_ID`

## Features

### Selection Grid

- **5 columns × 8 rows** = 40 selection buttons
- **Two tracks per button** (Side A / Side B)
- **Visual feedback**: Light up on selection
- **Selection codes**: Number + Letter (e.g., "1A", "5B")

### Playlist System

**YouTube Playlists**:
- Load via URL parameter
- Support multiple playlists (comma-separated)
- Max 200 tracks total
- Auto-fetch metadata (titles, track counts)

**Configuration** (in `jukebox.html`):
```javascript
const PLAYLIST_LIBRARY = [
  "PLOHoVaTp8R7d3L_pjuwIa6nRh4tH5nI4x",
  "PLOHoVaTp8R7f9GV4HW3joHrz4Oq16QBph",
  // Add more playlist IDs
];

const DEFAULT_SELECTED_PLAYLISTS = [
  "PLOHoVaTp8R7d3L_pjuwIa6nRh4tH5nI4x",
  "PLOHoVaTp8R7f9GV4HW3joHrz4Oq16QBph"
];
```

### Free Play Mode (v1.6 - Header Above Video)

**Activation**:
- Click "FREE PLAY" button
- Shuffles all loaded tracks
- Plays continuously with 5-second gaps between songs

**Behavior**:
1. Song plays to completion
2. 5-second countdown displayed with yellow flash animation
3. Display shows: "FREE PLAY NEXT SONG IN 5s" counting down to 1s
4. Next random song auto-plays after countdown
5. Stops on manual interaction (X button or STOP button)

**Skip Controls**:
- **SKIP button**: Appears on YouTube video screen header bar (blue button)
  - Header bar sits **above** the video (not overlaying)
  - Click during playback to skip current song
  - Starts 5-second countdown to next song
  - Free Play cycle continues uninterrupted
- **X button**: Appears on YouTube video screen header bar (right side)
  - Stop immediately, stops Free Play completely
- **STOP button**: Exit Free Play mode, resets button to "FREE PLAY"

**Visual Effects**:
- Middle notification bar flashes yellow every second during countdown
- Countdown updates: 5s to 4s to 3s to 2s to 1s
- Flash stops when next song starts
- **Header bar**: Fixed 45px height, sits above video with no overlap

**Video Layout**:
- Header bar positioned **above** YouTube video (v1.6+)
- Video maintains full 16:9 aspect ratio
- SKIP and X buttons fully visible without covering video content

### Sound Effects

Authentic jukebox sounds (Web Audio API):
- **Coin drop**: When payment made
- **Motor hum**: Background noise
- **Selection beep**: Button press
- **Record drop**: Mechanical sounds
- **Needle drop**: Vinyl crackle

### Visual Effects

- **Glass distortion**: CSS 3D transform
- **Brass rails**: Gradient styling
- **Marquee display**: LED-style text
- **Selection lights**: Per-button LEDs
- **Coin animation**: Falling coin overlay

## API Endpoints

**Load Playlists**:
```
GET /api/display/:deviceId/playlists/metadata?ids=PL1,PL2,PL3
```

**Load Tracks**:
```
GET /api/display/:deviceId/jukebox?playlist=PLAYLIST_ID
```

**Play Track**:
```
POST /api/display/:deviceId/jukebox/play
Body: { "uri": "youtube_video_id" }
```

## Troubleshooting

**"Forbidden" Error**:
- Ensure YouTube API key is set
- Check playlist is public (not private)

**Tracks Not Loading**:
- Verify playlist ID format
- Check YouTube API quota limits

## URL Parameters

**Load specific playlists**:
```
/jukebox.html?playlist=PLxxx1,PLxxx2,PLxxx3
```

**Pre-load with defaults**:
```
/jukebox.html?playlist=PLOHoVaTp8R7d3L_pjuwIa6nRh4tH5nI4x,PLOHoVaTp8R7f9GV4HW3joHrz4Oq16QBph
```
