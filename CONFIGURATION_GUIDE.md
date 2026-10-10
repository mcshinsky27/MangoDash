# Configuration & Environment Variables Guide

## Environment File Location

`C:\MangoDash\.env`

## Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | HTTP server port | `8080` |
| `SESSION_SECRET` | Session encryption key (32+ chars) | `8bs41xg2mkzalp76wqrniyutvjf3od5e0hc9` |
| `SERVER_ADMIN_EMAIL` | Server admin login email | `admin@local` |
| `SERVER_ADMIN_PASSWORD` | Server admin login password | `O4xqncCPa6ILHKJs2` |

## Optional Variables (API Keys)

| Variable | Purpose | Required For | Get At |
|----------|---------|--------------|--------|
| `SPOTIFY_CLIENT_ID` | Spotify Web API | Spotify widget | https://developer.spotify.com/dashboard |
| `SPOTIFY_CLIENT_SECRET` | Spotify Web API | Spotify widget | https://developer.spotify.com/dashboard |
| `TMDB_API_KEY` | Movie database API | Movies/Streaming widget | https://www.themoviedb.org/settings/api |
| `YOUTUBE_API_KEY` | YouTube Data API v3 | YouTube widget, Jukebox | https://console.developers.google.com |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 | Education suite | https://console.developers.google.com |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 | Education suite | https://console.developers.google.com |
| `GEMINI_MODEL` | AI model for AskHouse | Ask the House widget | https://aistudio.google.com |
| `ALMA_SENDER_PATTERNS` | Email patterns for Alma | Alma widget (optional) | - |
| `PARENTSQUARE_SENDER_PATTERNS` | Email patterns for ParentSquare | ParentSquare widget (optional) | - |

## Setting Up API Keys

### Spotify
1. Create app at https://developer.spotify.com/dashboard
2. Set Redirect URI to: `http://YOUR-SERVER:8080/api/google/callback`
3. Copy Client ID and Secret to `.env`

### Google
1. Create project at https://console.developers.google.com
2. Enable APIs: Classroom, Gmail, Drive, Calendar
3. Create OAuth 2.0 credentials
4. Add authorized redirect URI: `http://YOUR-SERVER:8080/api/google/callback`
5. Copy Client ID and Secret to `.env`

### TMDB (The Movie Database)
1. Create account at https://www.themoviedb.org
2. Request API key (Settings → API)
3. Copy key to `.env`

### YouTube
1. Create project at https://console.developers.google.com
2. Enable YouTube Data API v3
3. Create API key
4. Copy key to `.env`

## Customizing Email Digest Patterns

For Alma and ParentSquare widgets that parse digest emails:

```env
# .env
ALMA_SENDER_PATTERNS=noreply@alma.school,notifications@alma.school
PARENTSQUARE_SENDER_PATTERNS=no-reply@parentsquare.com,notifications@parentsquare.com
```
