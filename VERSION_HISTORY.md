## v18-ignition-songchoreo (2026-10-15)
**Feature: Power-on ignition sequence + song-change choreography**

### Status
- Built and verified on dev (`C:\MangoDash-dev`, port 8081). **Not yet promoted to production.**

### Power-on Ignition (CSS only)
- One-shot boot sequence on page load: chrome side-walls → left "MUSIC FOR MILLIONS" neon → green progress window → right "WURLITZER ✳ ZODIAC" → cabinet back wall → song board → keypad
- Neon-flicker dip in the `ignite` keyframe (dim → re-brighten) mimics a real lamp warming up
- Staggered via `animation-delay` + `animation-fill-mode: backwards` — zero JS
- `prefers-reduced-motion: reduce` disables the sequence entirely

### Song-Change Choreography
- New `songChangePulse()`: one-shot `.changing` class on `.juke` (1.5s window, reflow-retriggered so back-to-back selections replay)
  - Cabinet back-wall brightness **thump** (`cabThump`, peaks 2.0) as the board slants back
  - ZODIAC crest **bounce** (`crestThump`, scale 1.14) on the revealed band
- Mechanism record window now actually reveals: `.mech.on .win` drops in from above with a springy `winDrop` (delayed .35s so the slant leads); the 45 fades onto the platter (`discIn`) while spinning at 33rpm
- Selected track card flashes bright (`cardFlash`) when it gains `.playing`
- Spotify remote-poll path fires the same ceremony when a new track appears from a paired device (`lastPollTrack` change detection), and resets on stop

### Notes
- Latent gap fixed: `.mech .win` was `display: none` with no rule ever showing it — the record window was invisible in all previous versions
- JS additions are ceremony-only (class toggles + one poll-state variable); no playback logic touched

### Tuning Knobs
- Ignition pacing: delays in the `.marquee .mfm / .progwin / .cabback / .rack / .keys` rules (0.3s → 1.85s)
- Thump strength: `cabThump` 30% keyframe (`brightness(2)`)
- Drop spring: `winDrop` `cubic-bezier(.34,1.56,.64,1)` and `.35s` delay

### Validation
- `node --check` on extracted script: OK
- Dev :8081 serves HTTP 200 with all 8 new markers (`ignite`, `winDrop`, `cabThump`, `crestThump`, `cardFlash`, `discIn`, `songChangePulse`, `let lastPollTrack`)

### Backup Files Created
- jukebox.html.v18_ignition_songchoreo_20261015 — pre-edit checkpoint (= v17 promoted state, hash C1C669…3B25)
- jukebox.html.bak-preignitefix-20261016 — state before the ignition robustness fix (hash 7CEA3D…5763)

### ✅ VERIFIED in browser 2026-10-16 — ignition confirmed by owner ("that worked").
### 🚀 PROMOTED to production 2026-10-16 — `:8080` verified serving v18 (HTTP 200, all markers present).
- Pre-promotion production backup: `C:\MangoDash\public\jukebox.html.bak-prev18promote-20261016` (hash C1C669…3B25 = v17 promoted state)
- Production file now byte-identical to dev final checkpoint (hash 502D34…FC37B)

### v18.1 — Boot message + extended startup (2026-10-16)
- Startup sequence stretched ~2.9s → ~4s (longer staggered flicker)
- New boot message overlaid on the dark opening: green glowing monospace **`starting up the wurlitzer▌`** with blinking block cursor — tells viewers the dark opening is intentional, not a page stall
- Message fades in at ~0.25s while cabinet is black, fades out ~3.4–4.0s as the last neon lands; `pointer-events: none`, `visibility: hidden` after fade (zero interaction impact)
- Dev tested on `:8081`; promoted to production same day (HTTP 200, all markers verified on `:8080`)
- Production backup before this change: `jukebox.html.bak-prebootmsg-20261016` (hash 502D34…FC37B = v18 final); production now hash 98E5A7…DC98B
- Dev backup: `jukebox.html.bak-bootmsg-20261016` (hash 502D34…FC37B)

### Fix 2026-10-16 (ignition robustness)
- Root cause of "no visible ignition" on the dev machine: `prefers-reduced-motion: reduce` was active (Windows Animation effects off), and the first build killed the whole sequence with `animation: none`
- Ignition sequence now gated on `.juke.boot` class in the markup (present at first paint, higher specificity, no JS dependency for the animation itself)
- New load-time console diagnostic: `[ZODIAC v18] HH:MM:SS | reduced-motion: … | ignition: RUNNING (N animations)` — one line tells you exactly what the page did on load
- **Owner decision (2026-10-16): full staggered flicker is FORCED regardless of `prefers-reduced-motion`** — no media-query fallback for the ignition (noted in-CSS). A gentle `bootFade` fallback was briefly added, then removed with this decision
- Backup of the state before the force-ignite change: `jukebox.html.bak-forceignite-20261016` (hash 4C86F0…D7B49)

---
## v17-3d-zodiac-cabback (2026-10-15)
**Feature: Full 3D depth treatment + ZODIAC cabinet back wall with ambient color drift**

### Status
- **Promoted to production** 2026-10-15 23:43 (`Backup/promote-2026-10-15_23-43-38`); production :8080 hash-verified against dev.

### 3D Depth Overhaul (CSS only)
- Cabinet: chrome side-wall trim, section joint shadows, darker cabinet base
- Marquee: MFM badges and progress window raised beveled bezels over deep inset screens; hover glow keeps bevel, click presses down
- Song board: **vertical (0deg) at rest**; existing 28deg slant-back on playback unchanged; track cards lift on hover / press in on click; brass rails with cylindrical shading, recessed letter tabs
- Keypad: 5deg lean toward operator, real keycap thickness (deeper pedestal, hover lift, full press-down), chrome specular trim, coin slot plate with depth
- Mechanism window: beveled steel frame, deeper recess

### ZODIAC Back Wall (revealed when the board slants back)
- New `.cabback` layer behind the rack: dark cabinet interior, chrome lip at the opening
- Glowing sun crest + ZODIAC wordmark centered in the revealed band
- Cabinet lamp brightens while slanted via pure CSS `:has(.rack.slanted)` — zero JS changes
- Ambient glow slowly drifts through the spectrum: gold → coral → magenta → violet → blue → teal → green → gold (75s cycle, ~32% opacity, radial-masked)

### Tuning Knobs
- Fade speed: `75s` in `@keyframes cabfade` animation
- Glow intensity: `opacity: .32` on `.cabback::after`
- Crest position/size: `.cabback-crest` top / `clamp()` sizes

### Validation
- Dev :8081 serves all new CSS/markup markers; production :8080 verified untouched
- All changes CSS-only; no JS logic touched

### Backup Files Created
- jukebox.html.v17_3d_zodiac_cabback_20261015 — current (3D + ZODIAC cabback + color drift)
- jukebox.html.bak-3d-2026-10-15 — 3D version prior to the ZODIAC back wall
- jukebox.html.bak — pre-3D version

---
## v11-zodiac-history-fix (2026-10-13)
**Fix: Separate Wurlitzer Zodiac History Modal from Playlist Selector**

### Issues Fixed

**1. Button Conflict**
- Previously, clicking MFM button opened both modals simultaneously
- Zodiac button (right) had no click handler

**2. Image Display**
- Added fallback content if image fails to load
- Improved image CSS with proper display properties

### Changes Made

**JavaScript Updates**
- Separated click handlers for each MFM button
- Left button (MUSIC FOR MILLIONS) → Opens playlist selector
- Right button (WURLITZER ☉ ZODIAC) → Opens history modal
- Added `stopPropagation` to prevent event bubbling

**Image Improvements**
- Updated image URL to reliable source
- Added onerror fallback showing decorative text
- Added CSS for missing/broken images

### Validation
- Zodiac button opens history modal only (verified)
- MFM button opens playlist selector only (verified)
- No double modal popups (verified)
- Image displays or shows fallback (verified)

### Backup Files Created
- jukebox.html.v11_zodiac_history_fix_20261013 - Fixed version

---
## v10-zodiac-history (2026-10-13)
**Feature: Wurlitzer Zodiac History Modal**

### Changes

**1. History Modal Added**
- Click "MUSIC FOR MILLIONS" button to view Wurlitzer Zodiac history
- Graphically styled modal with vintage aesthetics
- Includes historical image of Wurlitzer Zodiac jukebox

**2. Content Sections**
- Musical Innovation overview
- Interactive timeline (1959-Today)
- Design features list
- Heritage footer

**3. Visual Features**
- Golden border and accents
- Timeline with year markers
- Smooth modal animations
- Close button with rotation effect

### Backup Files Created
- jukebox.html.v10_zodiac_history_20261013 - Final working copy

### Validation
- Modal opens on MFM button click (verified)
- Image displays correctly (verified)
- Timeline renders properly (verified)
- Close button works (verified)
- Escape key closes modal (verified)
- Click outside closes modal (verified)

---
## v10-zodiac-history (2026-10-13)
**Feature: Wurlitzer Zodiac History Modal**

### Changes

**1. History Modal Added**
- Click "MUSIC FOR MILLIONS" button to view Wurlitzer Zodiac history
- Graphically styled modal with vintage aesthetics
- Includes historical image of Wurlitzer Zodiac jukebox

**2. Content Sections**
- Musical Innovation overview
- Interactive timeline (1959-Today)
- Design features list
- Heritage footer

**3. Visual Features**
- Golden border and accents
- Timeline with year markers
- Smooth modal animations
- Close button with rotation effect

### Backup Files Created
- jukebox.html.v10_zodiac_history_20261013 - Final working copy

### Validation
- Modal opens on MFM button click (verified)
- Image displays correctly (verified)
- Timeline renders properly (verified)
- Close button works (verified)
- Escape key closes modal (verified)
- Click outside closes modal (verified)

---

## v1.6-header-above (2026-10-13)
**Feature: YouTube Header Bar Positioned Above Video**

### Changes

**1. Header Bar Relocation**
- Moved YouTube screen header from overlay position to above the video
- Header now sits cleanly above the YouTube player with no overlap
- SKIP and X buttons are fully visible without covering video content

**2. Layout Improvements**
- Video maintains full 16:9 aspect ratio size
- Header bar has fixed 45px height with darker background
- Player container uses calc(100% - 45px) to fill remaining space

### Technical Changes
- `.video-screen`: Added `flex-direction: column` for vertical stacking
- `.screen-header`: Changed from `position: absolute` to static flex item
- `#yt-player-container`: Uses `height: calc(100% - 45px)` for proper sizing

### Before vs After
| Before | After |
|--------|-------|
| Header overlaying top of video | Header above video |
| Buttons covered video content | Buttons fully visible |
| Video partially obscured | Full video visible |

### Backup Files Created
- jukebox.html.v8_header_above_video_20261013 - Initial header-above layout
- jukebox.html.v8a_header_above_fixed_size_20261013 - Fixed video sizing
- jukebox.html.v9_final_header_above_20261013 - Final working copy (this version)

### Validation
- Header bar positioned above video (verified)
- Video maintains full 16:9 size (verified)
- SKIP and X buttons fully visible (verified)
- No JavaScript errors in console (verified)

---

## v1.6-header-above (2026-10-13)
**Feature: YouTube Header Bar Positioned Above Video**

### Changes

**1. Header Bar Relocation**
- Moved YouTube screen header from overlay position to above the video
- Header now sits cleanly above the YouTube player with no overlap
- SKIP and X buttons are fully visible without covering video content

**2. Layout Improvements**
- Video maintains full 16:9 aspect ratio size
- Header bar has fixed 45px height with darker background
- Player container uses calc(100% - 45px) to fill remaining space

### Technical Changes
- `.video-screen`: Added `flex-direction: column` for vertical stacking
- `.screen-header`: Changed from `position: absolute` to static flex item
- `#yt-player-container`: Uses `height: calc(100% - 45px)` for proper sizing

### Before vs After
| Before | After |
|--------|-------|
| Header overlaying top of video | Header above video |
| Buttons covered video content | Buttons fully visible |
| Video partially obscured | Full video visible |

### Backup Files Created
- jukebox.html.v8_header_above_video_20261013 - Initial header-above layout
- jukebox.html.v8a_header_above_fixed_size_20261013 - Fixed video sizing
- jukebox.html.v9_final_header_above_20261013 - Final working copy (this version)

### Validation
- Header bar positioned above video (verified)
- Video maintains full 16:9 size (verified)
- SKIP and X buttons fully visible (verified)
- No JavaScript errors in console (verified)

---
## v1.5-freeplay-enhanced (2026-10-13)
**Feature: SKIP Button + 5-Second Flashing Countdown for Free Play Mode**

### New Features

**1. SKIP Button for Free Play**
- New blue SKIP button appears next to the close (X) button on YouTube video screen
- Allows skipping current song while keeping Free Play cycle active
- Returns to main screen and starts countdown to next song

**2. 5-Second Countdown with Visual Flash**
- Changed gap from 15 seconds to 5 seconds between songs
- Display shows countdown: FREE PLAY NEXT SONG IN 5s to 1s
- Middle notification bar flashes yellow every second during countdown
- Creates eye-catching visual warning before next song plays

### Behavior Comparison

| Action | Before v1.5 | After v1.5 |
|--------|-------------|------------|
| Song ends naturally | 15s countdown, static display | 5s countdown, yellow flash |
| Click SKIP button | N/A | 5s countdown, yellow flash, Free Play continues |
| Click X button | Free Play stops | Free Play stops (unchanged) |
| Display message | NEXT SONG IN 15s | NEXT SONG IN 5s with countdown |

### Backup Files Created
- jukebox.html.v5_skip_button_20261013 - SKIP button feature
- jukebox.html.v5a_skip_fix_20261013 - Fixed countdown message display
- jukebox.html.v6_5sec_countdown_flash_20261013 - 5-second countdown with flash
- jukebox.html.v6a_yellow_flash_20261013 - Yellow color flash
- jukebox.html.v7_final_20261013 - Final working copy (this version)

### Validation
- SKIP button appears correctly on video screen (verified)
- Countdown shows 5 to 1 (verified)
- Yellow flash animation pulses every second (verified)
- Free Play continues after SKIP (verified)
- Free Play stops when closing with X button (verified)
- No JavaScript errors in console

---
## v1.5-freeplay-enhanced (2026-10-13)
**Feature: SKIP Button + 5-Second Flashing Countdown for Free Play Mode**

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â¯ New Features

**1. SKIP Button for Free Play**
- New blue "SKIP" button appears next to the close (X) button on YouTube video screen
- Allows skipping current song while keeping Free Play cycle active
- Returns to main screen and starts countdown to next song

**2. 5-Second Countdown with Visual Flash**
- Changed gap from 15 seconds to 5 seconds between songs
- Display shows countdown: "FREE PLAY ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ NEXT SONG IN 5s" ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 4s ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 3s ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 2s ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 1s
- Middle notification bar flashes yellow every second during countdown
- Creates eye-catching visual warning before next song plays

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â§ Technical Changes

**File: `public/jukebox.html`**

**1. Added SKIP Button HTML (line ~669):**
```html
<button type="button" class="screen-skip" id="screen-skip-btn">SKIP</button>
```

**2. Added Flash Animation CSS (line ~24-31):**
```css
@keyframes progFlash {
  0%, 100% { 
    opacity: 1; 
    color: #9fe870;
    text-shadow: 0 0 8px #9fe870;
  }
  50% { 
    opacity: 1; 
    color: #ffd700;
    text-shadow: 0 0 12px #ffd700;
  }
}
.progwin.flash {
  animation: progFlash 1s ease-in-out infinite;
}
```

**3. Updated Free Play Configuration (line ~1011):**
```javascript
const FREEPLAY_GAP_MS = 5000; // 5 seconds between songs
```

**4. New `startFreePlayCountdown()` Function (line ~1056-1090):**
- Creates 5-second countdown with visual flash
- Updates display every second: 5s ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 4s ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 3s ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 2s ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 1s
- Adds/removes flash class for yellow pulse effect
- Auto-cleanup when countdown completes or Free Play stops

**5. Updated `stopYt()` Function (line ~899-925):**
- Changed from boolean parameter to mode string ('close' | 'skip')
- 'skip' mode: starts countdown, keeps Free Play running
- 'close' mode: stops Free Play completely

**6. Updated `stopFreePlay()` Function (line ~1030-1054):**
- Added cleanup for `freePlayCountdownInterval`
- Added removal of flash class when stopping Free Play

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÂ¯Ã‚Â¿Ã‚Â½ Behavior Comparison

| Action | Before v1.5 | After v1.5 |
|--------|-------------|------------|
| **Song ends naturally** | 15s countdown, static display | **5s countdown, yellow flash** |
| **Click SKIP button** | N/A | **5s countdown, yellow flash, Free Play continues** |
| **Click X button** | Free Play stops | **Free Play stops (unchanged)** |
| **Display message** | "NEXT SONG IN 15s" | **"NEXT SONG IN 5s" with countdown** |

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œA Backup Files Created
- `public/jukebox.html.v5_skip_button_20261013` - SKIP button feature
- `public/jukebox.html.v5a_skip_fix_20261013` - Fixed countdown message display
- `public/jukebox.html.v6_5sec_countdown_flash_20261013` - 5-second countdown with flash
- `public/jukebox.html.v6a_yellow_flash_20261013` - Yellow color flash
- `public/jukebox.html.v7_final_20261013` - Final working copy (this version)

### ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ Validation
- SKIP button appears correctly on video screen (verified)
- Countdown shows 5 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 4 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 3 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 2 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 1 (verified)
- Yellow flash animation pulses every second (verified)
- Free Play continues after SKIP (verified)
- Free Play stops when closing with X button (verified)
- No JavaScript errors in console

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Âµ User Experience
**Before v1.5:**
- 15-second gap between songs (feels slow)
- Static display during countdown (easy to miss)
- No way to skip song without stopping Free Play

**After v1.5:**
- 5-second gap (faster pace)
- Flashing yellow countdown (hard to miss)
- SKIP button for quick song skipping
- Full control over Free Play experience

---
# MangoDash Version History

## v1.4-freeplay-fixed (2026-10-10)
**Bug Fix: Free Play Mode - Full Song Playback with 15-Second Gap**

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã‚Âº Problem Identified
Previous Free Play implementation had a critical flaw: songs would play for only 15 seconds before forcibly switching to the next track, cutting music mid-song. This was caused by a timer that started immediately when a song began playing, rather than waiting for the song to complete naturally.

### ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ Solution Implemented
Free Play mode now correctly:
1. **Plays the full song** - YouTube video plays to completion without interruption
2. **Shows countdown** - Displays "FREE PLAY ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ NEXT SONG IN 15s" when song ends
3. **15-second gap** - Waits 15 seconds after song completion
4. **Auto-plays next** - Randomly selects and plays next song from loaded playlist queue
5. **Manual override preserved** - Clicking X button immediately stops Free Play and resets button to "FREE PLAY"

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â§ Technical Changes

**File: `public/jukebox.html`**

**1. Modified `onStateChange` handler (line ~820-830):**
```javascript
onStateChange: e => {
  if (e.data === YT.PlayerState.ENDED) {
    stopYt(false);  // false = don't skip Free Play timer
    if (freePlayActive) {
      setProg("FREE PLAY ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ NEXT SONG IN 15s");
      freePlayTimer = setTimeout(() => {
        if (freePlayActive) playNextFreePlayTrack();
      }, FREEPLAY_GAP_MS);  // 15000ms = 15 seconds
    }
  }
  notifyPlaying(e.data === YT.PlayerState.PLAYING);
}
```

**2. Removed timer from `playNextFreePlayTrack()` (line ~971-994):**
- Function now only selects and plays a random song
- No longer schedules the next song (that's handled by `onStateChange`)
- Reduced from ~30 lines to ~23 lines

**3. Updated `stopYt()` function (line ~848-861):**
```javascript
function stopYt(skipFreePlayTimer) {
  // ... existing cleanup code ...
  if (skipFreePlayTimer && freePlayActive) {
    stopFreePlay();  // Reset button text when manually closing
  }
  setProg("MAKE SELECTION");
}
```
- Added `skipFreePlayTimer` parameter
- When X button is clicked: `stopYt(true)` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ calls `stopFreePlay()` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ button resets to "FREE PLAY"
- When song ends naturally: `stopYt(false)` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ timer starts for next song

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â Backup Files Created
- `public/jukebox.html.bak_freeplay_fix` - Original broken version (before fix)
- `public/jukebox.html.bak_working_freeplay_fixed` - Current working version (this fix)

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚Â§Ãƒâ€šÃ‚Âª How to Restore If Context Lost
If this fix is accidentally overwritten or corrupted, restore using PowerShell:

```powershell
# Restore from working backup
Copy-Item -Path "C:\MangoDash\public\jukebox.html.bak_working_freeplay_fixed" -Destination "C:\MangoDash\public\jukebox.html" -Force

# Or manually apply the three changes listed above
```

### ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ Validation
- Songs play to completion (verified by user)
- 15-second gap between songs (verified by user)
- Button correctly resets to "FREE PLAY" when manually closing video (verified by user)
- No JavaScript errors in console
- File structure intact (1195 lines, ends correctly)

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Âµ User Experience
**Before Fix:**
- Song plays 15 seconds ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ forcibly cuts off ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ next song starts
- Frustrating, incomplete music experience

**After Fix:**
- Song plays full duration ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ 15-second pause ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ next song starts
- Natural jukebox behavior, complete songs

---

## v1.3-playlists-enhanced (2026-10-08)
**Feature: Dynamic Top 10 Music Playlists & Improved Playlist Selector Typography**

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â° New Features
- **Truly Dynamic Top 10 Playlists** - Automatically fetches trending music content from YouTube's API
- **Real-Time Ranking Updates** - Playlist IDs change when YouTube's trending music changes (every 24-hour refresh)
- **24-Hour Smart Cache** - Refreshes metadata AND playlist IDs every 24 hours to conserve API quota
- **TRENDING Badge** - Visual indicator for top 10 playlists to distinguish from static library
- **Improved Typography** - Playlist titles now wrap properly with larger, more readable fonts
- **Merged Playlist View** - Top 10 trending playlists displayed first, followed by static library

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â Bug Fixes
- **Fixed Text Truncation** - Playlist titles now wrap across multiple lines instead of being cut off with ellipsis
- **Consistent Font Sizing** - All playlist titles use responsive clamp() sizing for better readability
- **Better Grid Layout** - Improved spacing and alignment in playlist selector modal

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ Technical Changes

**Server (`server/server.js`):**
- **Dynamic Fetch Logic**: Queries YouTube's `videos.list?chart=mostPopular&categoryId=10` for trending music videos
- **Channel Extraction**: Extracts unique music channels from trending videos
- **Playlist Discovery**: Fetches upload playlists from trending channels + official YouTube Music playlists
- **Smart Caching**: Stores both playlist data AND IDs in `data/cache.json` for 24-hour expiration
- **Change Detection**: Tracks playlist IDs to detect when rankings change
- **Fallback System**: Returns static list if YouTube API fails
- **New Response Format**: Includes `dynamic`, `cached`, `playlistIds`, and `refreshedAt` fields

**Frontend (`public/jukebox.html`):**
- Updated `initPlaylistSelector()` to fetch merged playlists from API
- Added TRENDING badge styling and rendering logic
- Improved `.playlist-title` CSS with text wrapping and clamp() sizing
- Added `.playlist-title-wrapper` and `.playlist-title-badge` CSS classes
- Modified grid sorting to show trending playlists first

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾ How Dynamic Updates Work

**Every 24 Hours (or when cache expires):**

1. **Fetch Trending Music Videos**: YouTube API returns top 50 trending music videos (category ID = 10)
2. **Extract Channels**: Get unique channel IDs from trending videos
3. **Get Playlists**: Fetch upload playlists from each trending channel
4. **Add Official Music**: Include playlists from YouTube's official Music channel
5. **Limit to Top 10**: Take first 10 playlists from combined results
6. **Cache Results**: Store playlist data AND IDs for 24 hours
7. **Return to Frontend**: Send playlists with `dynamic: true` flag

**When Rankings Change:**
- If trending music shifts (new artists/videos trending), the channel IDs will be different
- This results in different upload playlists being fetched
- The playlist IDs in the cache will differ from previous day
- Next refresh will show the new trending playlists

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Âµ Response Format

```json
{
  "playlists": [
    {
      "id": "UUxxxxxxxxxxx",
      "title": "Artist Name - Uploads",
      "description": "Latest uploads from Artist Name",
      "thumbnail": "https://...",
      "trackCount": 0,
      "trending": true,
      "source": "channel_uploads"
    }
  ],
  "cached": false,
  "playlistIds": ["UU1", "UU2", ...],
  "dynamic": true,
  "refreshedAt": "2026-10-08T12:00:00.000Z"
}
```

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â¨ Visual Enhancements
- **TRENDING Badge** - Red gradient badge with white text and shadow
- **Text Wrapping** - Titles display up to 3 lines with proper line height
- **Responsive Font** - clamp(14px, 1.5vw, 18px) for optimal readability
- **Sorted Display** - Trending playlists appear at top of grid
- **Fallback Thumbnails** - Graceful handling of missing playlist images

---

## v1.2-coin-slot-realistic (2026-10-07)
**Feature: Realistic Coin Slot with Venmo Payment**

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â° New Features
- **Realistic Coin Slot** - Chrome plate with vertical slot, INSERT COIN plate, and coin exit (like arcade machines)
- **Interactive Animation** - Coin drops through slot when clicked with sound effects
- **Payment Modal** - Beautiful vintage-styled Venmo payment popup
- **Audio Feedback** - Coin drop sound + cheerful major chord chime
- **Hidden Until Hover** - Subtle until user interacts
- **Responsive Positioning** - Coin slot now properly positioned on the right side of the lower chrome bar using flexbox

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â Bug Fixes
- **Fixed Coin Slot Positioning** - Changed from absolute positioning to flexbox layout to ensure the coin slot stays within the `.keyrow` container and appears on the right side like the Free Play button
- **Removed Overflow Issues** - Coin slot no longer overlaps or extends outside the lower chrome bar on any screen size

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â° How It Works
1. **Coin slot visible** - Chrome plate with vertical slot on lower right chrome bar
2. **Hover** - Plate glows with subtle white highlight
3. **Click** - Coin drops through slot animation + metal clunk sound
4. **Modal pops up** - Vintage jukebox-styled payment window
5. **Click Venmo button** - Opens venmo.com/RobMc27 in new tab
6. **Close** - Click X, click outside, or press Escape

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â¨ Visual Design

**Coin Slot:**
- Chrome plate (70x120px) with textured metallic finish
- Four corner screws for authentic look
- Top: Circular coin entry with vertical slot (45mm diameter)
- Middle: Embossed "INSERT COIN" plate with raised lettering
- Bottom: Coin exit slot with metal lip
- Realistic gradients and shadows for 3D effect
- Noise texture overlay for metallic surface
- Hover: Subtle white glow around plate

**Payment Modal:**
- Dark gradient background (#1a1a2e ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ #16213e)
- Gold border with glow
- Rotating radial gradient overlay
- Header: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂªÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ THANK YOU! ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂªÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢" in gold
- Amount: "ONE QUARTER" in gold gradient text
- Message: "For this fine musical entertainment"
- Venmo button: Bright blue gradient, large and clickable
- Handle: "@RobMc27" displayed below
- Close button: Top right, rotates on hover

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€¦Ã‚Â  Sound Effects

**Coin Drop:**
- Metal clunk with lowpass filter
- 150ms duration
- Pitch around 1200Hz

**Payment Chime:**
- Major chord (C-E-G: 523Hz, 659Hz, 784Hz)
- Three sine waves staggered
- 1.5 second decay
- Cheerful, celebratory feel

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ Technical Changes

**File:** `public/jukebox.html`

**CSS Changes (Lines 239-247):**
- `.coin-slot` - Changed from `position: absolute` to `display: flex` with `margin-left: auto` for right-side positioning
- Removed `bottom`, `right`, `z-index`, and `transform-origin` properties
- Added `align-items: flex-end`, `justify-content: center`, and `flex-shrink: 0` for proper flex layout

**HTML Changes:**
- Removed hardcoded coin slot from HTML (was at lines 990-1003)
- Coin slot is now dynamically created via JavaScript and appended to the end of `.keyrow`

**JavaScript Changes (Lines 1205-1224):**
- Added coin slot creation code after the DIGITS.forEach loop
- Coin slot is now the last child of `.keyrow`, ensuring it appears on the right side
- Maintains all existing functionality (click handler, drop animation, sound effects)

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â¯ User Experience

**Discovery:**
- Subtle brass slot on right side
- Hover reveals coin emoji
- "INSERT QUARTER" label
- Inviting glow effect

**Interaction:**
- Satisfying coin drop sound
- Visual drop animation
- 300ms delay before modal (anticipation)
- Cheerful chime on modal open
- Clear call-to-action button

**Accessibility:**
- Keyboard support (Escape to close)
- Click outside to close
- Clear close button
- Screen reader friendly

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¡ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Use Cases

**Monetization:**
- Passive donation mechanism
- Vintage jukebox aesthetic
- Fun, non-intrusive
- Easy Venmo integration

**Event Entertainment:**
- Adds vintage charm
- Interactive element
- Conversation starter
- Professional polish

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â Configuration

**Venmo Link:**
```html
<a href="https://venmo.com/RobMc27" class="payment-btn" target="_blank">
```

**Sound Timing:**
```javascript
const coinDropDelay = 300; // ms before modal shows
const chimeDuration = 1500; // ms chord decay
```

### ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚Â­Ãƒâ€šÃ‚Â Future Enhancements
- [ ] Multiple coin denominations (nickel, dime, quarter)
- [ ] Different payment methods (PayPal, CashApp)
- [ ] Coin collection counter
- [ ] Customizable donation amount
- [ ] Animated confetti on payment
- [ ] Sound customization

---

## v1.1-freeplay (2026-10-07)
**Feature: Free Play Mode with 15-Second Intervals**

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â° New Features
- **Free Play Button** - Automatic continuous playback with random song selection
- **15-Second Gaps** - Professional DJ-like pauses between full songs
- **Smart Queue Management** - Shuffles all loaded tracks at start
- **Visual Feedback** - Button pulses gold when active, turns red during playback
- **Progress Tracking** - Shows "FREE PLAY ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ X/200" in progress window
- **Auto-Cancel on Close** - YouTube window close stops Free Play immediately
- **Manual Override** - Any manual selection cancels Free Play

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Âµ How It Works
1. **Click "FREE PLAY"** - Button turns red and shows "STOP"
2. **First song plays immediately** - All tracks shuffled into queue
3. **Song plays to completion** - Full track plays
4. **15-second gap** - Progress shows "FREE PLAY ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ WAITING 15s..."
5. **Next random song plays** - From remaining queue
6. **Repeat** - Until queue empty or user stops

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂºÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â User Controls
- **Start:** Click "FREE PLAY" button (gold, pulsing)
- **Stop:** Click "STOP" button (red, solid)
- **Cancel:** Close YouTube window or make manual selection

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ Technical Changes
**File:** `public/jukebox.html`

**CSS Added (Lines 209-234):**
- `.key.freeplay` - Gold button with pulse animation
- `.key.freeplay.active` - Red button when active
- `@keyframes freeplayPulse` - Glowing effect

**JavaScript Added (Lines 882-886):**
- Free Play button creation in keypad
- Toggles between "FREE PLAY" and "STOP" states

**JavaScript Added (Lines 1345-1481):**
- `toggleFreePlay()` - Start/stop handler
- `startFreePlay()` - Initialize queue, play first song
- `stopFreePlay()` - Clear timer, reset state
- `playNextFreePlayTrack()` - Play next random song
- Hooked into `stopYt()` - 15-second gap timer
- Hooked into `select()` - Cancel on manual selection

**Configuration:**
```javascript
const FREEPLAY_GAP_MS = 15000; // 15 seconds between songs
```

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â¨ Visual Design
**Button States:**
- **Inactive:** Gold gradient, pulsing glow, shows "FREE PLAY"
- **Active:** Red gradient, solid, shows "STOP"
- **Hover:** Enhanced glow, slight lift effect

**Progress Display:**
- During playback: "FREE PLAY ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ 23/200"
- During gap: "FREE PLAY ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ WAITING 15s..."
- After stop: "MAKE SELECTION"

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â§ Integration Points
- **YouTube Player:** Hooks into `onStateChange` ENDED event
- **Spotify:** Uses existing polling for progress monitoring
- **Manual Selection:** Overrides Free Play automatically
- **YouTube Close:** Cancels Free Play immediately

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â¡ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Use Cases
- **Event Background Music** - Continuous entertainment
- **Demo Mode** - Showcase playlist variety
- **Hands-Off Operation** - Set it and forget it
- **Quick Previews** - 15s gap gives taste of each song

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â Known Behaviors
- Queue shuffles once at start (no reshuffling)
- Songs play to completion (no skipping)
- 15-second gap is fixed (not configurable yet)
- Manual interaction stops Free Play

### ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚Â­Ãƒâ€šÃ‚Â Future Enhancements
- [ ] Configurable gap duration (fast/normal/slow)
- [ ] Loop mode (reshuffle when queue empty)
- [ ] Skip/next button
- [ ] Volume fade between songs
- [ ] Current song display in progress window
- [ ] Pause/resume functionality

---

## v1.0-playlist-selector (2026-10-07)
**Major Feature: Playlist Selector with Multi-Playlist Support**

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â° New Features
- **Animated Playlist Selector Modal** - Beautiful dropdown interface when clicking "MUSIC FOR MILLIONS"
- **Multi-Playlist Selection** - Users can select 1-25 playlists to populate the jukebox
- **Dynamic YouTube API Integration** - Automatically fetches playlist titles and track counts
- **Pre-Selected Defaults** - Configurable default playlists that load on first use
- **Live Selection Counter** - Shows "X PLAYLISTS ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ Y TRACKS" in real-time
- **Enhanced Visual Effects** - Smooth animations, hover states, and pulse feedback

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ Technical Changes
**Server (`server/server.js`):**
- Added `/api/display/:deviceId/playlists/metadata` endpoint
- Fetches YouTube playlist data securely (hides API key)
- Returns playlist titles, track counts, and thumbnails

**Frontend (`public/jukebox.html`):**
- Added playlist selector modal HTML structure
- Added 326 lines of CSS for modal styling and animations
- Added 186 lines of JavaScript for playlist management
- Configured 8 YouTube playlists in library
- Set 2 default pre-selected playlists

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Âµ Playlist Configuration
**Available Playlists:**
1. PLOHoVaTp8R7d3L_pjuwIa6nRh4tH5nI4x ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ (default)
2. PLOHoVaTp8R7f9GV4HW3joHrz4Oq16QBph ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ (default)
3. PLr_3_vOUiFjDDLaRNKmAnqbc-uzgRdfNu
4. PL2N_sVGOb3clqyWSLspkp8BAv4FBfBaxH
5. PLkqz3S84Tw-TPCtKs1vw8AnRcGhms67h3
6. PLK1Ccv_vyLIw5E8zWwZt1OlmMIvO4mrwD
7. PLAxT_DkSwQLuq9R351Vp9kVGbE4TiMzQ6
8. PLplXQ2cg9B_o1X-Knd5wgbAi-YDTSbmy-

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â§ Bug Fixes
- Fixed multi-playlist loading (comma-separated IDs)
- Fixed "forbidden" error on public endpoint
- Added support for full YouTube URLs with playlist IDs
- Fixed "MUSIC FOR MILLIONS" box click handler (added missing `id="seeburg"`)

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€¦Ã‚Â¡ Documentation
- Created `PLAYLIST_SELECTOR_GUIDE.md` - Complete user and developer guide
- Created `MULTI_PLAYLIST_GUIDE.md` - Multi-playlist loading documentation
- Created `DEPLOYMENT_GUIDE.md` - Production deployment instructions
- Created `VERSION_HISTORY.md` - This file

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã‚Â½Ãƒâ€šÃ‚Â¨ Visual Enhancements
- Modal fade-in with scale and slide animations
- Loading spinner for YouTube API calls
- Playlist item hover effects with shimmer
- Selection pulse animation
- Responsive design for mobile and desktop
- Enhanced "MUSIC FOR MILLIONS" box with hover indicator

### ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â URLs
**Default (empty jukebox):**
```
https://dash.mcshinsky.com/jukebox.html
```

**Pre-loaded with defaults:**
```
https://dash.mcshinsky.com/jukebox.html?playlist=PLOHoVaTp8R7d3L_pjuwIa6nRh4tH5nI4x,PLOHoVaTp8R7f9GV4HW3joHrz4Oq16QBph
```

---

## Previous Versions
*Version history prior to v1.0-playlist-selector not documented*

---

**Last Updated:** 2026-10-07  
**Status:** ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ Production Ready  
**Next Milestone:** TBD
