# MangoDash — Project Notes

## jukebox-freeplay-fix — Complete (2026-10-10)

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

## calendarmulti — Schedule (Agenda-style) views added (2026-09-15)

### What changed
- **Two new views** in the dropdown: **"3 Day Schedule" (`3sched`)** and
  **"5 Day Schedule" (`5sched`)** — Google-Agenda-style **stacked days**: each
  day gets its own header row (uppercase, today in orange) followed by its
  event rows (colored bar + time range + title + calendar name). Reuses the
  existing `agendaHtml()` day-loop, so the single "Day Schedule" look is
  preserved — just repeated across 3 or 5 days. ‹ › navigates a full 3/5-day
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
- `public/js/display.js` — `calendarmulti` factory: `VIEWS` list (line ~594),
  default-view guard (line ~608), `periodRange()` 3sched/5sched branch
  (line ~644), render dispatch (line ~786)
- `public/css/dash.css` — `.calv-agenda*` rules (line ~579+)
- `public/js/admin.js` — default `calendarmulti` config (line ~36)

### Backups
- `public/js/display.js.bak.pre-scheduleviews`,
  `public/css/dash.css.bak.pre-scheduleviews`,
  `public/js/admin.js.bak.pre-scheduleviews`

### Validation & ops
- **VERIFIED WORKING by user (2026-09-15):** 3 Day / 5 Day Schedule views,
  default view, and dropdown switching all confirmed live on the dashboard.
- `node --check public/js/display.js` and `admin.js` — pass; `dash.css` braces balanced
- Front-end only — hard-refresh with Ctrl+F5; no service restart needed

## calendarmulti widget redesign — COMPLETE (2026-09-15)

### Final decisions
- **3-month view removed entirely.** User scrolls month-to-month using the
  existing ‹ › navigation. The month range logic is now the final fallback in
  the period helper. Dropdown views: Day / 3 Days / 7 Days / 2 Weeks / Month.
- **Cell views (2week / month) and column views (3day / 7day)** render event
  pills with start time + title (feed-colored, all-day marked). Days over the
  pill cap show a clickable **"+N more"** toggle that expands that day inline,
  showing all its events; it flips to "− less" to collapse. State lives in
  `expandedDay` (per-day key) inside the widget factory + re-render.

### Key code locations
- `public/js/display.js` — `calendarmulti` factory (~line 576+):
  - `VIEWS`, `DAY_MAX_PILLS = 8` (column views), `CELL_MAX_PILLS = 3` (2week/month grids)
  - `dayKey()` / `expandedDay` — drill-down expand/collapse state
  - `moreHtml()` — renders "+N more" / "− less" toggle
  - `cellGridHtml()` — shared 7-col grid; `maxPills` caps pills per cell
  - Drill-down click binding after each render (`.calv-more[data-day]`)
- `public/css/dash.css`:
  - `.calv-more` (+ hover), `.calv-more.calv-less` — clickable toggle styles
  - `.calv-cell.expanded`, `.calv-col.expanded { overflow-y: auto }` — expansion
  - Light-theme variants (`.theme-light .calv-more:hover`, `.theme-light .calv-cell.expanded`)

### Backups
- `public/js/display.js.bak.calv2`, `public/css/dash.css.bak.calv2` — pre-removal round
- `public/js/display.js.bak.pre-calendarmulti`, `public/css/dash.css.bak.pre-calendarmulti` — original pre-redesign

### Validation & ops
- `node --check public/js/display.js` — passes (exit 0)
- Repo-wide grep confirmed zero `3month` / `threeMonth` / `calv-mini` references remain
- Changes are **front-end only** — hard-refresh with Ctrl+F5; no
  `Restart-Service -Name MangoDash` needed
- Safety: a stale saved config with `defaultView: "3month"` falls back to the
  Day view (`VIEWS.some(...) ? ... : "day"` guard) — no errors
