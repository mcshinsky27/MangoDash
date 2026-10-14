## jukebox-header-above-video - v1.6 (2026-10-13)

### Summary
Moved YouTube header bar from overlay position to above the video.

### Key Changes
- **Header Relocation**: Header bar now sits above video instead of overlaying
- **Fixed Sizing**: Video maintains full 16:9 aspect ratio
- **Better Visibility**: SKIP and X buttons fully visible without covering video

### Technical Changes
- `.video-screen`: Added `flex-direction: column` for vertical stacking
- `.screen-header`: Changed from `position: absolute` to static flex item with `height: 45px`
- `#yt-player-container`: Uses `height: calc(100% - 45px)` to fill remaining space

### Files Modified
- `public/jukebox.html` - Updated CSS for header positioning
- `VERSION_HISTORY.md` - Added v1.6-header-above entry
- `JUKEBOX_GUIDE.md` - Updated Free Play Mode section
- `NOTES.md` - Added v1.6 summary

### Backup Files Created
- jukebox.html.v8_header_above_video_20261013 - Initial header-above layout
- jukebox.html.v8a_header_above_fixed_size_20261013 - Fixed video sizing
- jukebox.html.v9_final_header_above_20261013 - Final working copy

### Validation
- Header bar positioned above video (verified)
- Video maintains full 16:9 size (verified)
- SKIP and X buttons fully visible (verified)
- No JavaScript errors in console (verified)

---
## jukebox-freeplay-enhanced - SKIP Button & 5-Second Countdown (2026-10-13)

### Features Added

**1. SKIP Button for Free Play**
- Blue SKIP button added to YouTube video screen header
- Click to skip current song and start 5-second countdown to next
- Free Play cycle continues uninterrupted

**2. 5-Second Flashing Countdown**
- Changed Free Play gap from 15s to 5s
- Display shows countdown: 5s to 1s
- Middle notification bar flashes yellow every second
- Auto-cleanup when song starts or Free Play stops

### Files Modified
- public/jukebox.html - Added SKIP button, countdown function, flash animation

### Backups Created
- jukebox.html.v5_skip_button_20261013
- jukebox.html.v5a_skip_fix_20261013
- jukebox.html.v6_5sec_countdown_flash_20261013
- jukebox.html.v6a_yellow_flash_20261013
- jukebox.html.v7_final_20261013

### Validation
- All features verified working by user
- No JavaScript errors
- GitHub committed and pushed

---
# MangoDash â€” Project Notes

## jukebox-freeplay-fix â€” Complete (2026-10-10)

### Problem
Free Play mode was cutting songs off after 15 seconds instead of playing them in full.

### Solution
Modified three functions in `public/jukebox.html`:

1. **`onStateChange` handler** - Now starts 15s timer when song ENDS (not when it starts)
2. **`playNextFreePlayTrack()`** - Removed the auto-schedule timer (only plays one song)
3. **`stopYt()`** - Added `skipFreePlayTimer` param to reset button when manually closing

### Restore Command (if corrupted)
```powershell
Copy-Item -Path "C:\MangoDash\public\jukebox.html.bak_working_freeplay_fixed" -Destination "C:\MangoDash\public\jukebox.html" -Force
```

### Backup Location
- Working copy: `C:\MangoDash\public\jukebox.html.bak_working_freeplay_fixed`

---

## calendarmulti â€” Schedule (Agenda-style) views added (2026-09-15)

### What changed
- **Two new views** in the dropdown: **"3 Day Schedule" (`3sched`)** and
  **"5 Day Schedule" (`5sched`)** â€” Google-Agenda-style **stacked days**: each
  day gets its own header row (uppercase, today in orange) followed by its
  event rows (colored bar + time range + title + calendar name). Reuses the
  existing `agendaHtml()` day-loop, so the single "Day Schedule" look is
  preserved â€” just repeated across 3 or 5 days. â€¹ â€º navigates a full 3/5-day
  span per step.
- **Default view is now `3sched`** (3 Day Schedule). `cfg.defaultView` in the
  widget JSON still overrides it (accepted ids: day / 3sched / 5sched / 3day /
  7day / 2week / month); invalid ids fall back to `3sched`.
- Admin default template (`public/js/admin.js`) updated to
  `defaultView: "3sched"` for newly added widgets.
- CSS (`public/css/dash.css`): `.calv-agenda` flex wrapper added; multi-day
  variant `.calv-agenda-multi` gets larger day headers and more day separation
  (container-relative `clamp()` sizing).

### Key code locations
- `public/js/display.js` â€” `calendarmulti` factory: `VIEWS` list (line ~594),
  default-view guard (line ~608), `periodRange()` 3sched/5sched branch
  (line ~644), render dispatch (line ~786)
- `public/css/dash.css` â€” `.calv-agenda*` rules (line ~579+)
- `public/js/admin.js` â€” default `calendarmulti` config (line ~36)

### Backups
- `public/js/display.js.bak.pre-scheduleviews`,
  `public/css/dash.css.bak.pre-scheduleviews`,
  `public/js/admin.js.bak.pre-scheduleviews`

### Validation & ops
- **VERIFIED WORKING by user (2026-09-15):** 3 Day / 5 Day Schedule views,
  default view, and dropdown switching all confirmed live on the dashboard.
- `node --check public/js/display.js` and `admin.js` â€” pass; `dash.css` braces balanced
- Front-end only â€” hard-refresh with Ctrl+F5; no service restart needed

## calendarmulti widget redesign â€” COMPLETE (2026-09-15)

### Final decisions
- **3-month view removed entirely.** User scrolls month-to-month using the
  existing â€¹ â€º navigation. The month range logic is now the final fallback in
  the period helper. Dropdown views: Day / 3 Days / 7 Days / 2 Weeks / Month.
- **Cell views (2week / month) and column views (3day / 7day)** render event
  pills with start time + title (feed-colored, all-day marked). Days over the
  pill cap show a clickable **"+N more"** toggle that expands that day inline,
  showing all its events; it flips to "âˆ’ less" to collapse. State lives in
  `expandedDay` (per-day key) inside the widget factory + re-render.

### Key code locations
- `public/js/display.js` â€” `calendarmulti` factory (~line 576+):
  - `VIEWS`, `DAY_MAX_PILLS = 8` (column views), `CELL_MAX_PILLS = 3` (2week/month grids)
  - `dayKey()` / `expandedDay` â€” drill-down expand/collapse state
  - `moreHtml()` â€” renders "+N more" / "âˆ’ less" toggle
  - `cellGridHtml()` â€” shared 7-col grid; `maxPills` caps pills per cell
  - Drill-down click binding after each render (`.calv-more[data-day]`)
- `public/css/dash.css`:
  - `.calv-more` (+ hover), `.calv-more.calv-less` â€” clickable toggle styles
  - `.calv-cell.expanded`, `.calv-col.expanded { overflow-y: auto }` â€” expansion
  - Light-theme variants (`.theme-light .calv-more:hover`, `.theme-light .calv-cell.expanded`)

### Backups
- `public/js/display.js.bak.calv2`, `public/css/dash.css.bak.calv2` â€” pre-removal round
- `public/js/display.js.bak.pre-calendarmulti`, `public/css/dash.css.bak.pre-calendarmulti` â€” original pre-redesign

### Validation & ops
- `node --check public/js/display.js` â€” passes (exit 0)
- Repo-wide grep confirmed zero `3month` / `threeMonth` / `calv-mini` references remain
- Changes are **front-end only** â€” hard-refresh with Ctrl+F5; no
  `Restart-Service -Name MangoDash` needed
- Safety: a stale saved config with `defaultView: "3month"` falls back to the
  Day view (`VIEWS.some(...) ? ... : "day"` guard) â€” no errors

