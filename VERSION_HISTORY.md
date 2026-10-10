# MangoDash Version History

## v1.4-freeplay-fixed (2026-10-10)
**Bug Fix: Free Play Mode - Full Song Playback with 15-Second Gap**

### 🐛 Problem Identified
Previous Free Play implementation had a critical flaw: songs would play for only 15 seconds before forcibly switching to the next track, cutting music mid-song. This was caused by a timer that started immediately when a song began playing, rather than waiting for the song to complete naturally.

### ✅ Solution Implemented
Free Play mode now correctly:
1. **Plays the full song** - YouTube video plays to completion without interruption
2. **Shows countdown** - Displays "FREE PLAY • NEXT SONG IN 15s" when song ends
3. **15-second gap** - Waits 15 seconds after song completion
4. **Auto-plays next** - Randomly selects and plays next song from loaded playlist queue
5. **Manual override preserved** - Clicking X button immediately stops Free Play and resets button to "FREE PLAY"

### 🔧 Technical Changes

**File: `public/jukebox.html`**

**1. Modified `onStateChange` handler (line ~820-830):**
```javascript
onStateChange: e => {
  if (e.data === YT.PlayerState.ENDED) {
    stopYt(false);  // false = don't skip Free Play timer
    if (freePlayActive) {
      setProg("FREE PLAY • NEXT SONG IN 15s");
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
- When X button is clicked: `stopYt(true)` → calls `stopFreePlay()` → button resets to "FREE PLAY"
- When song ends naturally: `stopYt(false)` → timer starts for next song

### 📁 Backup Files Created
- `public/jukebox.html.bak_freeplay_fix` - Original broken version (before fix)
- `public/jukebox.html.bak_working_freeplay_fixed` - Current working version (this fix)

### 🧪 How to Restore If Context Lost
If this fix is accidentally overwritten or corrupted, restore using PowerShell:

```powershell
# Restore from working backup
Copy-Item -Path "C:\MangoDash\public\jukebox.html.bak_working_freeplay_fixed" -Destination "C:\MangoDash\public\jukebox.html" -Force

# Or manually apply the three changes listed above
```

### ✅ Validation
- Songs play to completion (verified by user)
- 15-second gap between songs (verified by user)
- Button correctly resets to "FREE PLAY" when manually closing video (verified by user)
- No JavaScript errors in console
- File structure intact (1195 lines, ends correctly)

### 🎵 User Experience
**Before Fix:**
- Song plays 15 seconds → forcibly cuts off → next song starts
- Frustrating, incomplete music experience

**After Fix:**
- Song plays full duration → 15-second pause → next song starts
- Natural jukebox behavior, complete songs

---

## v1.3-playlists-enhanced (2026-10-08)
**Feature: Dynamic Top 10 Music Playlists & Improved Playlist Selector Typography**

### 🎉 New Features
- **Truly Dynamic Top 10 Playlists** - Automatically fetches trending music content from YouTube's API
- **Real-Time Ranking Updates** - Playlist IDs change when YouTube's trending music changes (every 24-hour refresh)
- **24-Hour Smart Cache** - Refreshes metadata AND playlist IDs every 24 hours to conserve API quota
- **TRENDING Badge** - Visual indicator for top 10 playlists to distinguish from static library
- **Improved Typography** - Playlist titles now wrap properly with larger, more readable fonts
- **Merged Playlist View** - Top 10 trending playlists displayed first, followed by static library

### 📝 Bug Fixes
- **Fixed Text Truncation** - Playlist titles now wrap across multiple lines instead of being cut off with ellipsis
- **Consistent Font Sizing** - All playlist titles use responsive clamp() sizing for better readability
- **Better Grid Layout** - Improved spacing and alignment in playlist selector modal

### 📋 Technical Changes

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

### 🔄 How Dynamic Updates Work

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

### 🎵 Response Format

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

### 🎨 Visual Enhancements
- **TRENDING Badge** - Red gradient badge with white text and shadow
- **Text Wrapping** - Titles display up to 3 lines with proper line height
- **Responsive Font** - clamp(14px, 1.5vw, 18px) for optimal readability
- **Sorted Display** - Trending playlists appear at top of grid
- **Fallback Thumbnails** - Graceful handling of missing playlist images

---

## v1.2-coin-slot-realistic (2026-10-07)
**Feature: Realistic Coin Slot with Venmo Payment**

### 🎉 New Features
- **Realistic Coin Slot** - Chrome plate with vertical slot, INSERT COIN plate, and coin exit (like arcade machines)
- **Interactive Animation** - Coin drops through slot when clicked with sound effects
- **Payment Modal** - Beautiful vintage-styled Venmo payment popup
- **Audio Feedback** - Coin drop sound + cheerful major chord chime
- **Hidden Until Hover** - Subtle until user interacts
- **Responsive Positioning** - Coin slot now properly positioned on the right side of the lower chrome bar using flexbox

### 📝 Bug Fixes
- **Fixed Coin Slot Positioning** - Changed from absolute positioning to flexbox layout to ensure the coin slot stays within the `.keyrow` container and appears on the right side like the Free Play button
- **Removed Overflow Issues** - Coin slot no longer overlaps or extends outside the lower chrome bar on any screen size

### 🎰 How It Works
1. **Coin slot visible** - Chrome plate with vertical slot on lower right chrome bar
2. **Hover** - Plate glows with subtle white highlight
3. **Click** - Coin drops through slot animation + metal clunk sound
4. **Modal pops up** - Vintage jukebox-styled payment window
5. **Click Venmo button** - Opens venmo.com/RobMc27 in new tab
6. **Close** - Click X, click outside, or press Escape

### 🎨 Visual Design

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
- Dark gradient background (#1a1a2e → #16213e)
- Gold border with glow
- Rotating radial gradient overlay
- Header: "🪙 THANK YOU! 🪙" in gold
- Amount: "ONE QUARTER" in gold gradient text
- Message: "For this fine musical entertainment"
- Venmo button: Bright blue gradient, large and clickable
- Handle: "@RobMc27" displayed below
- Close button: Top right, rotates on hover

### 🔊 Sound Effects

**Coin Drop:**
- Metal clunk with lowpass filter
- 150ms duration
- Pitch around 1200Hz

**Payment Chime:**
- Major chord (C-E-G: 523Hz, 659Hz, 784Hz)
- Three sine waves staggered
- 1.5 second decay
- Cheerful, celebratory feel

### 📋 Technical Changes

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

### 🎯 User Experience

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

### 🚀 Use Cases

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

### 📝 Configuration

**Venmo Link:**
```html
<a href="https://venmo.com/RobMc27" class="payment-btn" target="_blank">
```

**Sound Timing:**
```javascript
const coinDropDelay = 300; // ms before modal shows
const chimeDuration = 1500; // ms chord decay
```

### ⭐ Future Enhancements
- [ ] Multiple coin denominations (nickel, dime, quarter)
- [ ] Different payment methods (PayPal, CashApp)
- [ ] Coin collection counter
- [ ] Customizable donation amount
- [ ] Animated confetti on payment
- [ ] Sound customization

---

## v1.1-freeplay (2026-10-07)
**Feature: Free Play Mode with 15-Second Intervals**

### 🎉 New Features
- **Free Play Button** - Automatic continuous playback with random song selection
- **15-Second Gaps** - Professional DJ-like pauses between full songs
- **Smart Queue Management** - Shuffles all loaded tracks at start
- **Visual Feedback** - Button pulses gold when active, turns red during playback
- **Progress Tracking** - Shows "FREE PLAY • X/200" in progress window
- **Auto-Cancel on Close** - YouTube window close stops Free Play immediately
- **Manual Override** - Any manual selection cancels Free Play

### 🎵 How It Works
1. **Click "FREE PLAY"** - Button turns red and shows "STOP"
2. **First song plays immediately** - All tracks shuffled into queue
3. **Song plays to completion** - Full track plays
4. **15-second gap** - Progress shows "FREE PLAY • WAITING 15s..."
5. **Next random song plays** - From remaining queue
6. **Repeat** - Until queue empty or user stops

### 🎛️ User Controls
- **Start:** Click "FREE PLAY" button (gold, pulsing)
- **Stop:** Click "STOP" button (red, solid)
- **Cancel:** Close YouTube window or make manual selection

### 📋 Technical Changes
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

### 🎨 Visual Design
**Button States:**
- **Inactive:** Gold gradient, pulsing glow, shows "FREE PLAY"
- **Active:** Red gradient, solid, shows "STOP"
- **Hover:** Enhanced glow, slight lift effect

**Progress Display:**
- During playback: "FREE PLAY • 23/200"
- During gap: "FREE PLAY • WAITING 15s..."
- After stop: "MAKE SELECTION"

### 🔧 Integration Points
- **YouTube Player:** Hooks into `onStateChange` ENDED event
- **Spotify:** Uses existing polling for progress monitoring
- **Manual Selection:** Overrides Free Play automatically
- **YouTube Close:** Cancels Free Play immediately

### 🚀 Use Cases
- **Event Background Music** - Continuous entertainment
- **Demo Mode** - Showcase playlist variety
- **Hands-Off Operation** - Set it and forget it
- **Quick Previews** - 15s gap gives taste of each song

### 📝 Known Behaviors
- Queue shuffles once at start (no reshuffling)
- Songs play to completion (no skipping)
- 15-second gap is fixed (not configurable yet)
- Manual interaction stops Free Play

### ⭐ Future Enhancements
- [ ] Configurable gap duration (fast/normal/slow)
- [ ] Loop mode (reshuffle when queue empty)
- [ ] Skip/next button
- [ ] Volume fade between songs
- [ ] Current song display in progress window
- [ ] Pause/resume functionality

---

## v1.0-playlist-selector (2026-10-07)
**Major Feature: Playlist Selector with Multi-Playlist Support**

### 🎉 New Features
- **Animated Playlist Selector Modal** - Beautiful dropdown interface when clicking "MUSIC FOR MILLIONS"
- **Multi-Playlist Selection** - Users can select 1-25 playlists to populate the jukebox
- **Dynamic YouTube API Integration** - Automatically fetches playlist titles and track counts
- **Pre-Selected Defaults** - Configurable default playlists that load on first use
- **Live Selection Counter** - Shows "X PLAYLISTS • Y TRACKS" in real-time
- **Enhanced Visual Effects** - Smooth animations, hover states, and pulse feedback

### 📋 Technical Changes
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

### 🎵 Playlist Configuration
**Available Playlists:**
1. PLOHoVaTp8R7d3L_pjuwIa6nRh4tH5nI4x ✓ (default)
2. PLOHoVaTp8R7f9GV4HW3joHrz4Oq16QBph ✓ (default)
3. PLr_3_vOUiFjDDLaRNKmAnqbc-uzgRdfNu
4. PL2N_sVGOb3clqyWSLspkp8BAv4FBfBaxH
5. PLkqz3S84Tw-TPCtKs1vw8AnRcGhms67h3
6. PLK1Ccv_vyLIw5E8zWwZt1OlmMIvO4mrwD
7. PLAxT_DkSwQLuq9R351Vp9kVGbE4TiMzQ6
8. PLplXQ2cg9B_o1X-Knd5wgbAi-YDTSbmy-

### 🔧 Bug Fixes
- Fixed multi-playlist loading (comma-separated IDs)
- Fixed "forbidden" error on public endpoint
- Added support for full YouTube URLs with playlist IDs
- Fixed "MUSIC FOR MILLIONS" box click handler (added missing `id="seeburg"`)

### 📚 Documentation
- Created `PLAYLIST_SELECTOR_GUIDE.md` - Complete user and developer guide
- Created `MULTI_PLAYLIST_GUIDE.md` - Multi-playlist loading documentation
- Created `DEPLOYMENT_GUIDE.md` - Production deployment instructions
- Created `VERSION_HISTORY.md` - This file

### 🎨 Visual Enhancements
- Modal fade-in with scale and slide animations
- Loading spinner for YouTube API calls
- Playlist item hover effects with shimmer
- Selection pulse animation
- Responsive design for mobile and desktop
- Enhanced "MUSIC FOR MILLIONS" box with hover indicator

### 🔗 URLs
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
**Status:** ✅ Production Ready  
**Next Milestone:** TBD