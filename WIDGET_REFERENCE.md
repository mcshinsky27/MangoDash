# Widget Reference Guide

## Calendar & Time Widgets

### 1. Calendar (`calendar`)
**Purpose**: Display upcoming events from iCal feed

**Configuration**:
```json
{
  "url": "https://YOUR-ICS-URL",
  "days": 14,
  "max": 8,
  "title": "Calendar"
}
```

**Google Calendar Setup**:
1. Go to Google Calendar → Settings
2. Select calendar → Integrate calendar
3. Copy "Secret address in iCal format"

### 2. Calendar Multi-Feed (`calendarmulti`)
**Purpose**: Multiple color-coded calendar feeds with multiple views

**Configuration**:
```json
{
  "title": "Calendar",
  "defaultView": "3sched",
  "calendars": [
    { "url": "https://YOUR-ICS-URL", "name": "Work", "color": "blue" },
    { "url": "https://YOUR-ICS-URL-2", "name": "Family", "color": "orange" }
  ]
}
```

**Available Views**: Day, 3 Day Schedule, 5 Day Schedule, 3 Days, 7 Days, 2 Weeks, Month

### 3. Clock Timeline (`clocktimeline`)
**Purpose**: Timeline view of today's schedule

**Configuration**:
```json
{
  "calendars": [
    { "url": "https://YOUR-ICS-URL", "name": "Work", "color": "#3d9be9" }
  ],
  "horizonHours": 72
}
```

### 4. Countdown (`countdown`)
**Configuration**: `{ "targetDate": "2026-12-25", "title": "Christmas" }`

---

## Education Widgets

### 5. Google Classroom (`classroom`)
**Configuration**: `{ "title": "Due Soon", "days": 14 }`
**Requirements**: Google OAuth connection

### 6. Gmail (`gmail`)
**Configuration**: `{ "title": "School Mail", "max": 8 }`
**Requirements**: Google OAuth connection

### 7. Google Docs (`gdocs`)
**Configuration**: `{ "title": "Recent Docs" }`
**Requirements**: Google OAuth connection

### 8. App Launcher (`launcher`)
**Configuration**: `{ "title": "School Apps" }`

### 9. Alma (`alma`)
**Configuration**: `{ "title": "Alma", "max": 6 }`
**How it Works**: Parses Alma digest emails from Gmail

### 10. ParentSquare (`parentsquare`)
**Configuration**: `{ "title": "ParentSquare", "max": 6 }`
**How it Works**: Parses ParentSquare digest emails from Gmail

### 11. Solitaire (`solitaire`)
**Configuration**: `{ "title": "Solitaire" }`

### 12. Minesweeper (`minesweeper`)
**Configuration**: `{ "title": "Minesweeper", "cols": 9, "rows": 9, "mines": 10 }`

---

## Weather Widgets

### 13. Weather (`weather`)
**Configuration**: `{ "zip": "10001", "unit": "F" }`
**Data Source**: Open-Meteo API (no key required)

### 14. Weather 10-Day (`weather10`)
**Configuration**: `{ "zip": "10001", "unit": "F" }`

### 15. Weather Hourly (`weatherhourly`)
**Configuration**: `{ "zip": "10001", "unit": "F", "hours": 12 }`

### 16. Weather Map (`weathermap`)
**Configuration**: `{ "zip": "10001", "overlay": "temp", "zoom": 7 }`

---

## Media Widgets

### 17. Movies (`movies`)
**Configuration**: `{ "title": "Top 10 In Theaters" }`
**API Required**: TMDB_API_KEY

### 18. Streaming Now (`streamnow`)
**Configuration**: `{ "title": "Top Streaming Now" }`
**API Required**: TMDB_API_KEY

### 19. Spotify (`spotify`)
**Configuration**: `{ "playlistId": "37i9dQZF1DXcBWIGoYBM5M", "title": "My Playlist" }`
**Requirements**: Spotify credentials in `.env`, device pairing

### 20. Spotify Iframe (`spotify_iframe`)
**Configuration**: `{ "url": "https://open.spotify.com/embed/playlist/..." }`

### 21. Spotify Playlist Selector (`spotify_playlist_selector`)
**Configuration**: `{ "title": "Music Selector", "defaultPlaylists": ["..."] }`

### 22. Jukebox (`jukebox`)
**Configuration**: `{ "title": "Jukebox" }`
**See**: [Jukebox System Guide](#jukebox-system)

### 23. YouTube (`youtube`)
**Configuration** (Live): `{ "mode": "live", "channelId": "UCxxx", "title": "Live Stream" }`
**Configuration** (Latest): `{ "mode": "latest", "channelId": "UCxxx", "max": 10 }`
**Configuration** (Playlist): `{ "playlistId": "PLxxx", "title": "My Playlist" }`
**API Required**: YOUTUBE_API_KEY

### 24. Photos (`photos`)
**Configuration**: `{ "title": "Family Photos" }`
**How to Add**: Admin panel → Photos section

### 25. Google Photos (`gphotos`)
**Configuration**: `{ "albumId": "xxx", "title": "Photos" }`

---

## Home & Family Widgets

### 26. Announcements (`announce`)
**Configuration**: `{ "title": "Announcements" }`

### 27. Ask the House (`askhouse`)
**Configuration**: `{ "title": "Ask the House" }`
**Requirements**: GEMINI_MODEL configured

### 28. Auction (`auction`)
**Configuration**: `{ "title": "Family Auction" }`

### 29. Birthdays (`birthdays`)
**Configuration**: `{ "title": "Birthdays" }`

### 30. Chore Chart (`chorechart`)
**Configuration**: `{ "title": "Chores" }`
**How to Add**: Admin panel → Chores section

### 31. Grocery (`grocery`)
**Configuration**: `{ "title": "Grocery List" }`

### 32. Kudos (`kudos`)
**Configuration**: `{ "title": "Kudos" }`

### 33. Meals (`meals`)
**Configuration**: `{ "title": "Meals This Week" }`

### 34. Packages (`packages`)
**Configuration**: `{ "title": "Packages" }`

### 35. Recipe (`recipe`)
**Configuration**: `{ "title": "Family Recipes" }`

### 36. Routine (`routine`)
**Configuration**: `{ "title": "Morning Routine" }`

### 37. Screen Time (`screentime`)
**Configuration**: `{ "title": "Screen Time" }`

### 38. Today's Lineup (`standup`)
**Configuration**: `{ "title": "Today's Lineup" }`

### 39. To-Do (`todo`)
**Configuration**: `{ "title": "To-Do List" }`

---

## News & Info Widgets

### 40. News (Visual) (`newsvisual`)
**Configuration**: `{ "url": "https://feeds.bbci.co.uk/news/rss.xml", "max": 8, "interval": 15 }`

### 41. Sports (`sports`)
**Configuration**: `{ "leagues": "mlb,nba,nfl,nhl", "title": "Sports" }`

### 42. Joke (`joke`)
**Configuration**: `{ "title": "Joke of the Day" }`

### 43. Quote (`quote`)
**Configuration**: `{ "title": "Quote of the Day" }`

### 44. Docs (Local) (`docs`)
**Configuration**: `{ "title": "Family Documents", "folder": "1" }`

### 45. Embed (`embed`)
**Configuration**: `{ "url": "https://example.com/embed", "title": "Embedded Content" }`

### 46. Stocks (`stocks`)
**Configuration**: `{ "symbols": "AAPL,GOOGL,MSFT", "title": "Stocks" }`
