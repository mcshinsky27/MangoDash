# API Reference Guide

## Authentication Endpoints

### Login
```
POST /api/login
Body: { "email": "user@example.com", "pass": "password" }
Response: { "ok": true, "token": "session_token" }
```

### Logout
```
POST /api/logout
Response: { "ok": true }
```

### Device Registration
```
POST /api/device/register
Body: { "id": "DEVICE_ID", "pair_code": "PAIR_CODE" }
Response: { "paired": true, "household_id": 123 }
```

## Dashboard Endpoints

### Get Dashboard
```
GET /api/dashboard
Response: { "name": "Home", "theme": "dark", "layout": [...] }
```

### Save Dashboard
```
POST /api/dashboard
Body: { "name": "Home", "theme": "dark", "layout": {...} }
Response: { "ok": true }
```

## Widget Data Endpoints

### Clock Timeline
```
GET /api/widget-data/clocktimeline
Query: { url, name, color, horizonHours }
Response: { events: [{ title, start, end, allDay, calendar }] }
```

### Weather Hourly
```
GET /api/widget-data/weatherhourly
Query: { zip, unit, hours }
Response: { location, hours: [{ label, temp, rain, icon }] }
```

### Movies
```
GET /api/widget-data/movies
Query: { kind: "theater" | "streaming" }
Response: [{ id, title, poster, rating, year }]
```

### Trailer
```
GET /api/widget-data/trailer
Query: { id: "movie_id" }
Response: { key: "youtube_video_id" }
```

### News
```
GET /api/widget-data/news
Query: { url, max }
Response: { title, items: [{ title, link, pubDate }] }
```

## Education Endpoints

### Classroom
```
GET /api/display/:deviceId/classroom
Response: { connected, courses: [{ name, id }], assignments: [{ title, dueDate }] }
```

### Gmail
```
GET /api/display/:deviceId/gmail
Response: { connected, messages: [{ subject, from, date }] }
```

### Google Docs
```
GET /api/display/:deviceId/gdocs
Response: { connected, docs: [{ name, url, mimeType }] }
```

### Connections Status
```
GET /api/connections
Response: { google: { connected, email, scopes, loginUrl }, googleConfigured }
```

## Jukebox Endpoints

### Playlist Metadata
```
GET /api/display/:deviceId/playlists/metadata
Query: { ids: "PL1,PL2,PL3" }
Response: { playlists: [{ id, title, trackCount, thumbnail }] }
```

### Load Tracks
```
GET /api/display/:deviceId/jukebox
Query: { playlist: "PLAYLIST_ID" }
Response: { provider, tracks: [{ name, uri, artist }], playlistCount }
```

### Play Track
```
POST /api/display/:deviceId/jukebox/play
Body: { uri: "youtube_video_id" }
Response: { ok: true }
```

## Member Management

### Get Members
```
GET /api/display/:deviceId/members
Response: [{ id, name, color, avatar, role, points, screen_minutes }]
```

### Add Member
```
POST /api/members
Body: { "name": "John", "color": "#e8760e", "avatar": "🙂", "role": "kid" }
Response: { ok: true, id: 123 }
```

## Chore Management

### Get Chores
```
GET /api/chores
Response: [{ id, title, member_id, points, schedule, status }]
```

### Complete Chore
```
PUT /api/chores/:id
Body: { "status": "completed" }
Response: { ok: true, pointsEarned: 10 }
```

## File Upload Endpoints

### Upload Photos
```
POST /api/photos
Content-Type: multipart/form-data
Body: files[]
Response: { ok: true, files: ["photo1.jpg", "photo2.jpg"] }
```

### Upload Documents
```
POST /api/docs
Content-Type: multipart/form-data
Body: files[]
Response: { ok: true, files: ["doc1.pdf", "doc2.pdf"] }
```

### List Documents
```
GET /api/docs
Response: ["doc1.pdf", "doc2.pdf"]
```

## Backup & Restore Endpoints

### Create Backup
```
POST /api/backup
Response: { folder: "mangodash-20261010-143022" }
```

### List Backups
```
GET /api/backups
Response: ["mangodash-20261009-120000", "mangodash-20261010-143022"]
```

### Restore Backup
```
POST /api/restore
Body: { folder: "mangodash-20261009-120000" }
Response: { ok: true }
```
