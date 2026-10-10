require("dotenv").config();
// ------------------------------------------------------------
// Imported core modules
// ------------------------------------------------------------
const http = require("http");
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
// (Duplicate imports removed – the required modules are already imported at the top of the file.)
// const cors = require("cors"); // Disabled: cors module not installed, not used currently.
// Gemini model to use for AskHouse. Can be overridden via GEMINI_MODEL env var.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
// ------------------------------------------------------------
// Service robustness helpers – log any uncaught errors to a file
// so that the Windows Service can be diagnosed without a console.
// ------------------------------------------------------------
process.on('uncaughtException', err => {
  const logPath = path.join(__dirname, '..', 'service_error.log');
  try { fs.appendFileSync(logPath, `[${new Date().toISOString()}] UncaughtException: ${err.stack || err}\n`); } catch (_) {}
});
process.on('unhandledRejection', err => {
  const logPath = path.join(__dirname, '..', 'service_error.log');
  try { fs.appendFileSync(logPath, `[${new Date().toISOString()}] UnhandledRejection: ${err.stack || err}\n`); } catch (_) {}
});
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const Database = require("better-sqlite3");
const { WebSocketServer } = require("ws");
const multer = require("multer");
const widgets = require("./widgets");

const PORT = process.env.PORT || 8080;
const DATA = path.join(__dirname, "..", "data");
fs.mkdirSync(path.join(DATA, "photos"), { recursive: true });
fs.mkdirSync(path.join(DATA, "docs"), { recursive: true });
fs.mkdirSync(path.join(DATA, "tmp"), { recursive: true });
const db = new Database(path.join(DATA, "mangodash.db"));
db.pragma("journal_mode = WAL");

// ================= SCHEMA =================
db.exec(`
CREATE TABLE IF NOT EXISTS households (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, pair_code TEXT UNIQUE, created INTEGER);
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, household_id INTEGER, email TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL, display_name TEXT, role TEXT DEFAULT 'parent', created INTEGER);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER, expires INTEGER);
CREATE TABLE IF NOT EXISTS invites (code TEXT PRIMARY KEY, household_id INTEGER, role TEXT DEFAULT 'parent', used INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS dashboards (id INTEGER PRIMARY KEY AUTOINCREMENT, household_id INTEGER, name TEXT NOT NULL, theme TEXT DEFAULT 'dark', layout TEXT DEFAULT '[]');
CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, household_id INTEGER, name TEXT DEFAULT 'New Display', dashboard_id INTEGER, rotate_ids TEXT DEFAULT '', rotate_secs INTEGER DEFAULT 60, kind TEXT DEFAULT 'full', last_seen INTEGER);
CREATE TABLE IF NOT EXISTS members (id INTEGER PRIMARY KEY AUTOINCREMENT, household_id INTEGER, name TEXT, color TEXT DEFAULT '#e8760e', avatar TEXT DEFAULT '🙂', role TEXT DEFAULT 'kid', pin TEXT DEFAULT '', points INTEGER DEFAULT 0, screen_minutes INTEGER DEFAULT 0, streak INTEGER DEFAULT 0, streak_date TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS chores (id INTEGER PRIMARY KEY AUTOINCREMENT, household_id INTEGER, title TEXT, member_id INTEGER, points INTEGER DEFAULT 10, screen_minutes INTEGER DEFAULT 0, schedule TEXT DEFAULT 'daily', rotate INTEGER DEFAULT 0, is_bounty INTEGER DEFAULT 0, status TEXT DEFAULT 'open', done_date TEXT DEFAULT '', claimed_by INTEGER);
CREATE TABLE IF NOT EXISTS routines (id INTEGER PRIMARY KEY AUTOINCREMENT, household_id INTEGER, member_id INTEGER, name TEXT, time_start TEXT DEFAULT '06:30', time_end TEXT DEFAULT '08:30', steps TEXT DEFAULT '[]');
CREATE TABLE IF NOT EXISTS routine_checks (routine_id INTEGER, step_idx INTEGER, date TEXT, PRIMARY KEY (routine_id, step_idx, date));
CREATE TABLE IF NOT EXISTS meals (household_id INTEGER, date TEXT, slot TEXT, title TEXT, recipe_url TEXT DEFAULT '', PRIMARY KEY (household_id, date, slot));
CREATE TABLE IF NOT EXISTS recipes (id INTEGER PRIMARY KEY AUTOINCREMENT, household_id INTEGER, title TEXT, url TEXT DEFAULT '', tags TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS grocery (id INTEGER PRIMARY KEY AUTOINCREMENT, household_id INTEGER, item TEXT, category TEXT DEFAULT 'Other', added_by INTEGER, done INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS events_local (id INTEGER PRIMARY KEY AUTOINCREMENT, household_id INTEGER, member_id INTEGER, title TEXT, when_ts INTEGER, leave_mins INTEGER DEFAULT 15, repeat_weekly TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS kudos (id INTEGER PRIMARY KEY AUTOINCREMENT, household_id INTEGER, from_id INTEGER, to_id INTEGER, text TEXT, created INTEGER);
CREATE TABLE IF NOT EXISTS announcements (id INTEGER PRIMARY KEY AUTOINCREMENT, household_id INTEGER, text TEXT, emoji TEXT DEFAULT '📣', expires INTEGER);
CREATE TABLE IF NOT EXISTS rewards (id INTEGER PRIMARY KEY AUTOINCREMENT, household_id INTEGER, title TEXT, cost INTEGER);
CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY AUTOINCREMENT, household_id INTEGER, list_name TEXT DEFAULT 'default', text TEXT, done INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS settings (household_id INTEGER, key TEXT, value TEXT, PRIMARY KEY (household_id, key));`);

function genCode() { return crypto.randomBytes(3).toString("hex").toUpperCase(); }
const today = () => new Date().toISOString().slice(0, 10);
const dow = () => new Date().toLocaleDateString("en", { weekday: "short" });

// Bootstrap server admin
if (!db.prepare("SELECT COUNT(*) c FROM users").get().c) {
  const hh = db.prepare("INSERT INTO households (name,pair_code,created) VALUES (?,?,?)")
    .run("My Family", genCode(), Date.now());
  db.prepare("INSERT INTO users (household_id,email,pass_hash,display_name,role,created) VALUES (?,?,?,?,?,?)")
    .run(hh.lastInsertRowid, process.env.SERVER_ADMIN_EMAIL || "admin@local",
         bcrypt.hashSync(process.env.SERVER_ADMIN_PASSWORD || "changeme123", 10),
         "Server Admin", "serveradmin", Date.now());
  db.prepare("INSERT INTO dashboards (household_id,name) VALUES (?,?)")
    .run(hh.lastInsertRowid, "Family Dashboard");
  console.log("Bootstrapped first household + server admin.");
}

// Helper to extract Spotify playlist ID or URI
function parsePlaylistId(s) {
  if (!s) return null;
  const m = String(s).match(/playlist[\/\:]([A-Za-z0-9]+)/);
  return m ? m[1] : String(s).trim();
}

// Helper to extract YouTube playlist ID
function parseYouTubePlaylistId(s) {
  if (!s) return null;
  const m = String(s).match(/[&?]list=([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  if (/^(PL|UU|LL|FL|RD|OLAK5uy_)[A-Za-z0-9_-]+$/.test(String(s).trim())) {
    return String(s).trim();
  }
  return null;
}

// Fetch YouTube playlist tracks sequentially (up to 200)
async function fetchYouTubePlaylistTracks(playlistId, apiKey) {
  const tracks = [];
  let nextPageToken = "";
  for (let page = 0; page < 4; page++) {
    let url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${encodeURIComponent(playlistId)}&key=${apiKey}`;
    if (nextPageToken) {
      url += `&pageToken=${encodeURIComponent(nextPageToken)}`;
    }
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || "YouTube API error");
    }
    const d = await res.json();
    if (!d.items || d.items.length === 0) break;
    d.items.forEach(item => {
      const videoId = item.snippet?.resourceId?.videoId;
      if (!videoId) return;
      let name = item.snippet.title || "";
      if (name === "Deleted video" || name === "Private video") return;
      let artist = item.snippet.videoOwnerChannelTitle || item.snippet.channelTitle || "YouTube";
      
      // Split artist and title if possible
      if (name.includes(" - ")) {
        const parts = name.split(" - ");
        artist = parts[0].trim();
        name = parts.slice(1).join(" - ").trim();
      } else if (name.includes(" – ")) {
        const parts = name.split(" – ");
        artist = parts[0].trim();
        name = parts.slice(1).join(" – ").trim();
      }
      
      // Strip common promotional strings like "(Official Video)", "[Audio]" etc.
      name = name.replace(/\s*[([].*?(official|video|audio|lyrics|hd|4k|clip|music).*?[\])]/gi, "").trim();
      
      tracks.push({
        name: name || "Unknown Song",
        uri: videoId,
        artist: artist || "Unknown Artist"
      });
    });
    nextPageToken = d.nextPageToken;
    if (!nextPageToken) break;
  }
  return tracks;
}

// ================= APP =================
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "..", "public")));

// Login rate limit
const attempts = new Map();
function tooMany(ip) {
  const a = attempts.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - a.t > 15 * 60e3) { a.n = 0; a.t = Date.now(); attempts.set(ip, a); }
  return a.n >= 10;
}
function recordFail(ip) {
  const a = attempts.get(ip) || { n: 0, t: Date.now() };
  a.n++; attempts.set(ip, a);
}

// ---------- Auth ----------
app.post("/api/signup", (req, res) => {
  const { email, password, name, invite } = req.body;
  const inv = db.prepare("SELECT * FROM invites WHERE code=? AND used=0").get((invite || "").toUpperCase());
  if (!inv) return res.status(403).json({ error: "Valid invite code required" });
  if (!email || !password || password.length < 8)
    return res.status(400).json({ error: "Email + 8-char password required" });
  let hhId = inv.household_id;
  if (!hhId) {
    hhId = db.prepare("INSERT INTO households (name,pair_code,created) VALUES (?,?,?)")
      .run((name || "New") + "'s Family", genCode(), Date.now()).lastInsertRowid;
    db.prepare("INSERT INTO dashboards (household_id,name) VALUES (?,?)").run(hhId, "Family Dashboard");
  }
  try {
    db.prepare("INSERT INTO users (household_id,email,pass_hash,display_name,role,created) VALUES (?,?,?,?,?,?)")
      .run(hhId, email.toLowerCase(), bcrypt.hashSync(password, 10), name, inv.role, Date.now());
  } catch { return res.status(400).json({ error: "Email already registered" }); }
  db.prepare("UPDATE invites SET used=1 WHERE code=?").run(inv.code);
  res.json({ ok: true });
});

app.post("/api/login", (req, res) => {
  if (tooMany(req.ip)) return res.status(429).json({ error: "Too many attempts. Wait 15 min." });
  const u = db.prepare("SELECT * FROM users WHERE email=?").get((req.body.email || "").toLowerCase());
  if (!u || !bcrypt.compareSync(req.body.password || "", u.pass_hash)) {
    recordFail(req.ip);
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(token, u.id, Date.now() + 30 * 86400e3);
  res.cookie("mango", token, { httpOnly: true, sameSite: "lax", maxAge: 30 * 86400e3 });
  res.json({ ok: true, role: u.role });
});
app.post("/api/logout", (req, res) => {
  db.prepare("DELETE FROM sessions WHERE token=?").run(req.cookies.mango || "");
  res.clearCookie("mango"); res.json({ ok: true });
});

function auth(req, res, next) {
  const s = db.prepare("SELECT * FROM sessions WHERE token=? AND expires>?")
    .get(req.cookies.mango || "", Date.now());
  if (!s) return res.status(401).json({ error: "login required" });
  req.user = db.prepare("SELECT * FROM users WHERE id=?").get(s.user_id);
  req.hh = req.user.household_id;
  next();
}
function serverAdmin(req, res, next) {
  req.user.role === "serveradmin" ? next() : res.status(403).json({ error: "server admin only" });
}
function deviceHH(req, res, next) {
  const dev = db.prepare("SELECT * FROM devices WHERE id=?").get(req.params.deviceId || "");
  if (!dev || !dev.household_id) return res.status(403).json({ error: "unpaired device" });
  req.hh = dev.household_id; req.device = dev;
  next();
}

app.get("/api/me", auth, (req, res) => {
  const hh = db.prepare("SELECT * FROM households WHERE id=?").get(req.hh);
  res.json({ email: req.user.email, name: req.user.display_name, role: req.user.role,
             household: hh.name, pair_code: hh.pair_code });
});

// ---------- Invites / households ----------
app.post("/api/admin/invites", auth, serverAdmin, (req, res) => {
  const code = genCode();
  db.prepare("INSERT INTO invites (code,household_id,role) VALUES (?,?,?)")
    .run(code, req.body.household_id || null, req.body.role || "parent");
  res.json({ code });
});
app.get("/api/admin/households", auth, serverAdmin, (req, res) =>
  res.json(db.prepare(`SELECT h.*, COUNT(u.id) users FROM households h
    LEFT JOIN users u ON u.household_id=h.id GROUP BY h.id`).all()));
app.post("/api/invites", auth, (req, res) => {
  const code = genCode();
  db.prepare("INSERT INTO invites (code,household_id,role) VALUES (?,?,?)")
    .run(code, req.hh, req.body.role || "parent");
  res.json({ code });
});
app.get("/api/invites", auth, (req, res) => {
  let rows = db.prepare("SELECT * FROM invites WHERE used=0 AND household_id=?").all(req.hh);
  if (req.user.role === "serveradmin")
    rows = rows.concat(db.prepare("SELECT * FROM invites WHERE used=0 AND household_id IS NULL").all());
  res.json(rows);
});
app.delete("/api/invites/:code", auth, (req, res) => {
  const inv = db.prepare("SELECT * FROM invites WHERE code=?").get(req.params.code.toUpperCase());
  if (!inv) return res.status(404).json({ error: "not found" });
  if (inv.household_id !== req.hh && req.user.role !== "serveradmin")
    return res.status(403).json({ error: "not yours" });
  db.prepare("DELETE FROM invites WHERE code=?").run(inv.code);
  res.json({ ok: true });
});

// ---------- Device pairing ----------
app.post("/api/device/register", (req, res) => {
  const { id, pair_code, kind } = req.body;
  if (!id) return res.status(400).json({ error: "id required" });
  let dev = db.prepare("SELECT * FROM devices WHERE id=?").get(id);
  if (!dev) {
    db.prepare("INSERT INTO devices (id,kind,last_seen) VALUES (?,?,?)").run(id, kind || "full", Date.now());
    dev = db.prepare("SELECT * FROM devices WHERE id=?").get(id);
  }
  db.prepare("UPDATE devices SET last_seen=? WHERE id=?").run(Date.now(), id);
  if (pair_code && !dev.household_id) {
    const hh = db.prepare("SELECT * FROM households WHERE pair_code=?").get(pair_code.toUpperCase());
    if (hh) {
      const dash = db.prepare("SELECT id FROM dashboards WHERE household_id=? LIMIT 1").get(hh.id);
      db.prepare("UPDATE devices SET household_id=?, dashboard_id=? WHERE id=?")
        .run(hh.id, dash ? dash.id : null, id);
      dev = db.prepare("SELECT * FROM devices WHERE id=?").get(id);
    }
  }
    res.json({ paired: !!dev.household_id });
  });
  app.get("/api/device/:deviceId/dashboard", deviceHH, (req, res) => {
    const d = db.prepare("SELECT * FROM dashboards WHERE id=? AND household_id=?")
      .get(req.device.dashboard_id, req.hh);
    if (!d) return res.json({ pending: true });
    res.json({ ...d, layout: JSON.parse(d.layout),
               rotate_ids: req.device.rotate_ids, rotate_secs: req.device.rotate_secs });
  });

  // ---------- Dashboards & devices ----------
app.get("/api/dashboards", auth, (req, res) =>
  res.json(db.prepare("SELECT * FROM dashboards WHERE household_id=?").all(req.hh)
    .map(d => ({ ...d, layout: JSON.parse(d.layout) }))));
app.post("/api/dashboards", auth, (req, res) => {
  const r = db.prepare("INSERT INTO dashboards (household_id,name) VALUES (?,?)")
    .run(req.hh, req.body.name || "Dashboard");
  res.json({ id: r.lastInsertRowid });
});
app.put("/api/dashboards/:id", auth, (req, res) => {
  db.prepare("UPDATE dashboards SET name=?,theme=?,layout=? WHERE id=? AND household_id=?")
    .run(req.body.name, req.body.theme, JSON.stringify(req.body.layout), req.params.id, req.hh);
  broadcast(req.hh, { type: "reload" }); res.json({ ok: true });
});
app.delete("/api/dashboards/:id", auth, (req, res) => {
  db.prepare("DELETE FROM dashboards WHERE id=? AND household_id=?").run(req.params.id, req.hh);
  res.json({ ok: true });
});
app.get("/api/devices", auth, (req, res) =>
  res.json(db.prepare("SELECT * FROM devices WHERE household_id=?").all(req.hh)));
app.put("/api/devices/:id", auth, (req, res) => {
  db.prepare("UPDATE devices SET name=?,dashboard_id=?,rotate_ids=?,rotate_secs=? WHERE id=? AND household_id=?")
    .run(req.body.name, req.body.dashboard_id, req.body.rotate_ids || "",
         req.body.rotate_secs || 60, req.params.id, req.hh);
    res.json({ ok: true });
  });
  app.delete("/api/devices/:id", auth, (req, res) => {
    db.prepare("DELETE FROM devices WHERE id=? AND household_id=?").run(req.params.id, req.hh);
    res.json({ ok: true });
  });

  // ---------- Spotify ----------
  const spotifyTokens = new Map();

  // ---------------------------------------------------------------------------
  // Clear stored Spotify token and cached in‑memory token for the household.
  // This endpoint is hit by the Spotify widget's "Reconnect" button and can be
  // used manually when scopes have changed or a refresh token has been revoked.
  // It deletes the persisted refresh token and removes any cached access token.
  // ---------------------------------------------------------------------------
  app.get("/api/spotify/clear", auth, (req, res) => {
    // Remove the refresh token from the settings table (if it exists)
    db.prepare("DELETE FROM settings WHERE household_id=? AND key='spotify_refresh'").run(req.hh);
    // Remove the cached access token for this household
    spotifyTokens.delete(req.hh);
    res.json({ ok: true, message: "Spotify token cleared. Re-login required." });
  });

  app.get("/api/spotify/login", (req, res) => {
    if (!process.env.SPOTIFY_CLIENT_ID) return res.send("Set SPOTIFY_CLIENT_ID/SECRET in .env first.");
    // Resolve the household either from the browser session (auth cookie) or,
    // for kiosk/display screens that have no household login, from the paired
    // device id passed as ?device=<deviceId>. Without this, display screens
    // could never start the OAuth flow themselves.
    let hh = null;
    const s = db.prepare("SELECT * FROM sessions WHERE token=? AND expires>?")
      .get(req.cookies.mango || "", Date.now());
    if (s) {
      const u = db.prepare("SELECT * FROM users WHERE id=?").get(s.user_id);
      if (u) hh = u.household_id;
    }
    if (!hh && req.query.device) {
      const dev = db.prepare("SELECT * FROM devices WHERE id=?").get(String(req.query.device));
      if (dev && dev.household_id) hh = dev.household_id;
    }
    if (!hh) return res.status(401).send("Not authorized to connect Spotify. Open the dashboard from a paired device or log in first.");
    // BASE_URL must match the redirect URI registered in the Spotify Developer
    // Dashboard; req.get("host") can differ (LAN name, proxy) and would fail.
    const base = process.env.BASE_URL ? process.env.BASE_URL.replace(/\/+$/, "")
      : `${req.protocol}://${req.get("host")}`;
    const redirect = `${base}/api/spotify/callback`;
    res.redirect("https://accounts.spotify.com/authorize?" + new URLSearchParams({
      client_id: process.env.SPOTIFY_CLIENT_ID,
      response_type: "code",
      redirect_uri: redirect,
      scope: "user-read-currently-playing user-read-playback-state user-modify-playback-state playlist-read-private playlist-read-collaborative",
      state: String(hh)
    }));
  });

  // OAuth callback: exchange the authorization code for tokens, persist the
  // refresh token for the household that started the flow (passed back via
  // `state`), then land on a friendly page that closes itself when opened as
  // a popup by a widget's "Log in to Spotify" button.
  app.get("/api/spotify/callback", async (req, res) => {
    const base = process.env.BASE_URL ? process.env.BASE_URL.replace(/\/+$/, "")
      : `${req.protocol}://${req.get("host")}`;
    const redirect = `${base}/api/spotify/callback`;
    if (req.query.error) {
      return res.status(400).send("<h2>Spotify auth cancelled:</h2><pre>" +
        String(req.query.error) + "</pre><p>You can close this window.</p>");
    }
    // Validate the household `state` we passed to Spotify in the authorize URL.
    // Without this check, a missing/non-numeric state became NaN -> stored as
    // household_id NULL in SQLite, which silently accumulates orphan refresh
    // tokens that INSERT OR REPLACE can never dedupe (NULL != NULL in a PK).
    const hh = Number(req.query.state);
    if (!Number.isInteger(hh) || hh <= 0) {
      return res.status(400).send("<h2>Spotify auth failed:</h2><pre>state_mismatch: missing or invalid household state. Start the login from the dashboard (Log in to Spotify button), not from a bookmarked URL.</pre><p>You can close this window.</p>");
    }
    try {
      const r = await fetch("https://accounts.spotify.com/api/token", { method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ":" +
            process.env.SPOTIFY_CLIENT_SECRET).toString("base64") },
        body: new URLSearchParams({ grant_type: "authorization_code",
          code: req.query.code, redirect_uri: redirect }) });
      const tok = await r.json();
      if (!r.ok || !tok.refresh_token) {
        return res.status(400).send("<h2>Spotify auth failed:</h2><pre>" +
          JSON.stringify(tok) + "</pre><p>You can close this window.</p>");
      }
      db.prepare("INSERT OR REPLACE INTO settings VALUES (?,?,?)")
        .run(hh, "spotify_refresh", tok.refresh_token);
      spotifyTokens.delete(hh);
      // A fresh login clears any "session expired" marker left behind by a
      // previously revoked refresh token.
      db.prepare("DELETE FROM settings WHERE household_id=? AND key='spotify_expired'").run(hh);
      // Landing page: if opened via window.open (widget flow) it self-closes;
      // otherwise offer a link back to the dashboard.
      res.send(`<!doctype html><html><head><meta charset="utf-8">
<title>Spotify Connected</title>
<style>body{font-family:"Segoe UI",system-ui,sans-serif;background:#0e1117;color:#e6e6e6;
display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.box{text-align:center;padding:40px}.ok{font-size:48px;margin-bottom:12px}
h2{margin:0 0 8px}p{opacity:.7;margin:0 0 24px}
a.btn{display:inline-block;background:#1db954;color:#fff;text-decoration:none;
padding:12px 28px;border-radius:10px;font-weight:600}
a.btn:hover{filter:brightness(1.1)}</style></head>
<body><div class="box"><div class="ok">&#127925;</div>
<h2>Spotify connected!</h2>
<p>Full-track playback is now enabled for your widgets. You can close this tab.</p>
<a class="btn" href="/">Back to Dashboard</a></div>
<script>
// Tell the opener (the dashboard widget) the moment OAuth completes so it can
// reload its Spotify embed with the fresh browser session. The widget also
// polls for popup close as a fallback, so a lost message is not fatal.
try { if (window.opener) window.opener.postMessage({ source: "mangodash", type: "spotify-connected" }, "*"); } catch (e) {}
setTimeout(function(){ try { window.close(); } catch (e) {} }, 2500);
</script></body></html>`);
    } catch (e) {
      res.status(500).send("<h2>Spotify auth error:</h2><pre>" + e.message + "</pre>");
    }
  });

  // ---------- Spotify playback control ----------

  // ---------------------------------------------------------------------------
  // Build the absolute URL that a client must visit to start the Spotify OAuth
  // flow for the current request. Widgets will use this when `spotifyAccess`
  // returns no token, allowing the UI to redirect the user seamlessly.
  // ---------------------------------------------------------------------------
  function spotifyLoginUrl(req) {
    // The login endpoint already handles redirect URIs and scopes. Keep the
    // device id in the URL so kiosk screens without a household session can
    // still complete the OAuth flow (see /api/spotify/login).
    const base = process.env.BASE_URL ? process.env.BASE_URL.replace(/\/+$/, "")
      : `${req.protocol}://${req.get("host")}`;
    const dev = req.params && req.params.deviceId ? `?device=${encodeURIComponent(req.params.deviceId)}` : "";
    return `${base}/api/spotify/login${dev}`;
  }
async function resolveSpotifyDeviceId(at, requestedDeviceId) {
  if (requestedDeviceId) return requestedDeviceId;
  try {
    const r = await fetch("https://api.spotify.com/v1/me/player/devices", {
      headers: { Authorization: "Bearer " + at },
    });
    if (!r.ok) return null;
    const data = await r.json();
    const devices = data.devices || [];
    if (!devices.length) return null;
    const active = devices.find(d => d.is_active);
    if (active) return active.id;
    return devices[0].id;
  } catch (e) {
    return null;
  }
}

async function parseSpotifyError(resObj) {
  try {
    const txt = await resObj.text();
    try {
      const json = JSON.parse(txt);
      if (json.error && json.error.message) return json.error.message;
      if (json.error_description) return json.error_description;
      return JSON.stringify(json);
    } catch {
      return txt || `HTTP ${resObj.status}`;
    }
  } catch (e) {
    return `HTTP ${resObj.status}`;
  }
}

// ---------------------------------------------------------------------------
// Spotify token handling helper
// ---------------------------------------------------------------------------
// Returns a valid access token for the given household (hh). Tokens are cached
// in memory (spotifyTokens map) and refreshed using the stored refresh token.
// If no refresh token exists or the refresh fails, null is returned.
async function spotifyAccess(hh) {
  // Return cached token if still fresh (≈50 minutes left of the 1‑hour expiry)
  const hit = spotifyTokens.get(hh);
  if (hit && Date.now() < hit.exp) return hit.at;

  // Retrieve stored refresh token for this household
  const row = db
    .prepare(
      "SELECT value FROM settings WHERE household_id=? AND key='spotify_refresh'"
    )
    .get(hh);
  if (!row) return null;

  // Exchange the refresh token for a fresh access token
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(
          process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET
        ).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: row.value,
    }),
  });
  const d = await r.json();
  if (!d.access_token) {
    // Per Spotify's refresh-token guide: invalid_grant means the refresh token
    // is expired, revoked, or otherwise invalid. Discard it (with a marker so
    // /status can explain "session expired" to the UI) instead of silently
    // returning null on every request forever.
    if (d.error === "invalid_grant") {
      db.prepare("DELETE FROM settings WHERE household_id=? AND key='spotify_refresh'").run(hh);
      db.prepare("INSERT OR REPLACE INTO settings VALUES (?,?,?)").run(hh, "spotify_expired", "1");
      spotifyTokens.delete(hh);
    }
    return null;
  }

  // Spotify may rotate the refresh token on refresh; the docs say to keep the
  // newest one when it is returned.
  if (d.refresh_token && d.refresh_token !== row.value) {
    db.prepare("INSERT OR REPLACE INTO settings VALUES (?,?,?)")
      .run(hh, "spotify_refresh", d.refresh_token);
  }

  // Cache token (valid ~1 hour; use 50‑minute expiry for safety)
  spotifyTokens.set(hh, { at: d.access_token, exp: Date.now() + 50 * 60e3 });
  return d.access_token;
}
app.get("/api/display/:deviceId/spotify/devices", deviceHH, async (req, res) => {
  try {
    const at = await spotifyAccess(req.hh);
    if (!at) return res.json({ connected: false, devices: [], loginUrl: spotifyLoginUrl(req) });
    const r = await fetch("https://api.spotify.com/v1/me/player/devices", {
      headers: { Authorization: "Bearer " + at },
    });
    if (!r.ok) return res.json({ connected: true, devices: [] });
    const data = await r.json();
    res.json({ connected: true, devices: data.devices || [] });
  } catch (e) {
    res.json({ connected: false, error: e.message });
  }
});

// Get the user's playlists for UI selection
app.get("/api/display/:deviceId/spotify/playlists", deviceHH, async (req, res) => {
  try {
    const at = await spotifyAccess(req.hh);
    if (!at) return res.json({ connected: false, playlists: [], loginUrl: spotifyLoginUrl(req) });
    const r = await fetch("https://api.spotify.com/v1/me/playlists?limit=50", {
      headers: { Authorization: "Bearer " + at },
    });
    if (!r.ok) {
      // Return detailed error info for debugging (truncate body to avoid huge payloads)
      let errBody = null;
      try {
        const txt = await r.text();
        errBody = txt.length > 200 ? txt.slice(0, 200) + "..." : txt;
      } catch (_) {
        // ignore parsing errors
      }
      return res.json({ connected: true, playlists: [], error: { status: r.status, body: errBody } });
    }
    const data = await r.json();
    const playlists = (data.items || []).map(p => ({
      id: p.id,
      name: p.name,
      uri: p.uri,
      images: p.images,
    }));
    res.json({ connected: true, playlists });
  } catch (e) {
    res.json({ connected: false, error: e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/display/:deviceId/spotify/status
// Returns a simple JSON indicating whether a valid Spotify token exists for the
// household.  If not, the response includes `loginUrl` so the UI can prompt the
// user to authenticate via the OAuth flow.
// ---------------------------------------------------------------------------
app.get("/api/display/:deviceId/spotify/status", deviceHH, async (req, res) => {
  try {
    const at = await spotifyAccess(req.hh);
    if (at) {
      res.json({ connected: true });
    } else {
      // Distinguish "session expired/revoked" (token was discarded) from
      // "never connected" so the UI can show a targeted message.
      const expired = db.prepare("SELECT 1 FROM settings WHERE household_id=? AND key='spotify_expired'").get(req.hh);
      res.json(expired
        ? { connected: false, expired: true,
            reason: "Spotify session expired or was revoked — log in again to reconnect.",
            loginUrl: spotifyLoginUrl(req) }
        : { connected: false, loginUrl: spotifyLoginUrl(req) });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Current playback state for the full Spotify widget (now-playing card).
// GET /api/display/:deviceId/spotify
app.get("/api/display/:deviceId/spotify", deviceHH, async (req, res) => {
  try {
    const at = await spotifyAccess(req.hh);
    if (!at) {
      const expired = db.prepare("SELECT 1 FROM settings WHERE household_id=? AND key='spotify_expired'").get(req.hh);
      return res.json(expired
        ? { connected: false, expired: true, loginUrl: spotifyLoginUrl(req) }
        : { connected: false, loginUrl: spotifyLoginUrl(req) });
    }
    const r = await fetch("https://api.spotify.com/v1/me/player/currently-playing",
      { headers: { Authorization: "Bearer " + at } });
    if (r.status === 204) return res.json({ connected: true, playing: false });
    if (!r.ok) return res.json({ connected: true, playing: false, error: "HTTP " + r.status });
    const d = await r.json();
    res.json({ connected: true, playing: d.is_playing,
      track: d.item && d.item.name,
      artist: d.item && d.item.artists.map(a => a.name).join(", "),
      art: d.item && d.item.album && d.item.album.images[0] && d.item.album.images[0].url,
      progress: d.progress_ms, duration: d.item && d.item.duration_ms });
  } catch (e) { res.json({ connected: false, error: e.message, loginUrl: spotifyLoginUrl(req) });
  }
});

// Start/resume playback, optionally with a specific context (playlist/album/track)
app.put("/api/display/:deviceId/spotify/play", deviceHH, async (req, res) => {
  try {
    const at = await spotifyAccess(req.hh);
    if (!at) return res.status(400).json({ error: "Spotify not connected", loginUrl: spotifyLoginUrl(req) });
    const { uri, device_id } = req.body || {};
    const targetDevId = await resolveSpotifyDeviceId(at, device_id);

    let url = "https://api.spotify.com/v1/me/player/play";
    if (targetDevId) url += `?device_id=${encodeURIComponent(targetDevId)}`;

    let body = null;
    if (uri) {
      body = {};
      if (/^spotify:(track|episode):/.test(uri)) {
        body.uris = [uri];
      } else {
        body.context_uri = uri;
      }
    }

    const opts = {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + at,
        "Content-Type": "application/json",
      },
    };
    if (body) opts.body = JSON.stringify(body);

    const r = await fetch(url, opts);
    if (r.status === 204 || r.status === 200) return res.json({ ok: true });
    const err = await parseSpotifyError(r);
    res.status(r.status).json({ error: err });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Pause playback
app.put("/api/display/:deviceId/spotify/pause", deviceHH, async (req, res) => {
  try {
    const at = await spotifyAccess(req.hh);
    if (!at) return res.status(400).json({ error: "Spotify not connected", loginUrl: spotifyLoginUrl(req) });
    const targetDevId = await resolveSpotifyDeviceId(at, req.body?.device_id);
    let url = "https://api.spotify.com/v1/me/player/pause";
    if (targetDevId) url += `?device_id=${encodeURIComponent(targetDevId)}`;

    const r = await fetch(url, {
      method: "PUT",
      headers: { Authorization: "Bearer " + at, "Content-Type": "application/json" },
    });
    if (r.status === 204 || r.status === 200) return res.json({ ok: true });
    const err = await parseSpotifyError(r);
    res.status(r.status).json({ error: err });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Skip to next track
app.post("/api/display/:deviceId/spotify/next", deviceHH, async (req, res) => {
  try {
    const at = await spotifyAccess(req.hh);
    if (!at) return res.status(400).json({ error: "Spotify not connected", loginUrl: spotifyLoginUrl(req) });
    const targetDevId = await resolveSpotifyDeviceId(at, req.body?.device_id);
    let url = "https://api.spotify.com/v1/me/player/next";
    if (targetDevId) url += `?device_id=${encodeURIComponent(targetDevId)}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: "Bearer " + at, "Content-Type": "application/json" },
    });
    if (r.status === 204 || r.status === 200) return res.json({ ok: true });
    const err = await parseSpotifyError(r);
    res.status(r.status).json({ error: err });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Go to previous track
app.post("/api/display/:deviceId/spotify/previous", deviceHH, async (req, res) => {
  try {
    const at = await spotifyAccess(req.hh);
    if (!at) return res.status(400).json({ error: "Spotify not connected", loginUrl: spotifyLoginUrl(req) });
    const targetDevId = await resolveSpotifyDeviceId(at, req.body?.device_id);
    let url = "https://api.spotify.com/v1/me/player/previous";
    if (targetDevId) url += `?device_id=${encodeURIComponent(targetDevId)}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: "Bearer " + at, "Content-Type": "application/json" },
    });
    if (r.status === 204 || r.status === 200) return res.json({ ok: true });
    const err = await parseSpotifyError(r);
    res.status(r.status).json({ error: err });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Widget data proxy ----------
function crud(name, table, cols) {
  app.get(`/api/${name}`, auth, (req, res) =>
    res.json(db.prepare(`SELECT * FROM ${table} WHERE household_id=?`).all(req.hh)));
  app.post(`/api/${name}`, auth, (req, res) => {
    const vals = cols.map(c => req.body[c] !== undefined ? req.body[c] : null);
    db.prepare(`INSERT INTO ${table} (household_id,${cols.join(",")}) VALUES (?${",?".repeat(cols.length)})`)
      .run(req.hh, ...vals);
    broadcast(req.hh, { type: "reload" });
    res.json({ ok: true });
  });

// Get playlist tracks (up to 200) for given playlist ID(s).
// Supports comma-separated Spotify and YouTube playlist IDs.
app.get("/api/display/:deviceId/jukebox", deviceHH, async (req, res) => {
  try {
    const playlistParam = req.query.playlist || "";
    if (!playlistParam) return res.json({ error: "No playlist configured." });

    const playlistIds = playlistParam.split(",").map(p => p.trim()).filter(p => p);
    const tracks = [];
    const warnings = [];
    let provider = null;
    const apiKey = process.env.YOUTUBE_API_KEY;

    let at = null;
    try {
      at = await spotifyAccess(req.hh);
    } catch (e) {
      console.warn("Spotify access failed during jukebox fetch:", e.message);
    }

    for (const pid of playlistIds) {
      if (tracks.length >= 200) break;

      const ytPid = parseYouTubePlaylistId(pid);
      if (ytPid) {
        if (!apiKey) {
          warnings.push(`YouTube API key not configured for playlist: ${pid}`);
          continue;
        }
        try {
          const ytTracks = await fetchYouTubePlaylistTracks(ytPid, apiKey);
          if (!provider) provider = "youtube";
          tracks.push(...ytTracks);
        } catch (err) {
          warnings.push(`Failed to load YouTube playlist ${pid}: ${err.message}`);
        }
      } else {
        const spotifyPid = parsePlaylistId(pid);
        if (!spotifyPid) {
          warnings.push(`Invalid playlist ID format: ${pid}`);
          continue;
        }
        if (!at) {
          warnings.push(`Spotify not connected — cannot load playlist: ${pid}`);
          continue;
        }
        try {
          if (!provider) provider = "spotify";
          for (let off = 0; off < 200; off += 100) {
            if (tracks.length >= 200) break;
            const d = await (await fetch(
              `https://api.spotify.com/v1/playlists/${spotifyPid}/tracks?limit=100&offset=${off}&fields=items(track(name,uri,artists(name))),total`,
              { headers: { Authorization: "Bearer " + at } }
            )).json();

            if (d.error) {
              warnings.push(`Spotify API error for ${pid}: ${d.error.message}`);
              break;
            }

            (d.items || []).forEach(i => {
              if (i.track && tracks.length < 200) {
                tracks.push({
                  name: i.track.name,
                  uri: i.track.uri,
                  artist: i.track.artists.map(a => a.name).join(", ")
                });
              }
            });

            if (!d.items || d.items.length < 100) break;
          }
        } catch (err) {
          warnings.push(`Failed to load Spotify playlist ${pid}: ${err.message}`);
        }
      }
    }

    res.json({
      provider: provider || "youtube",
      tracks: tracks.slice(0, 200),
      playlistCount: playlistIds.length,
      warnings: warnings.length > 0 ? warnings : undefined
    });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// Play a single track URI on the user's Spotify player (or first available device).
app.post("/api/display/:deviceId/jukebox/play", deviceHH, async (req, res) => {
  try {
    const at = await spotifyAccess(req.hh);
    if (!at) return res.json({ ok: false, error: "Spotify not connected", loginUrl: spotifyLoginUrl(req) });

    const H = { Authorization: "Bearer " + at, "Content-Type": "application/json" };
    const body = { uris: [req.body.uri] };
    let r = await fetch("https://api.spotify.com/v1/me/player/play", {
      method: "PUT",
      headers: H,
      body: JSON.stringify(body)
    });

    // If no active device, try to wake the most recent one.
    if (r.status === 404) {
      const devs = await (await fetch("https://api.spotify.com/v1/me/player/devices", { headers: H })).json();
      const d = (devs.devices || [])[0];
      if (!d) return res.json({ ok: false, error: "No Spotify device found. Open Spotify once on any device." });

      r = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${d.id}`, {
        method: "PUT",
        headers: H,
        body: JSON.stringify(body)
      });
    }

    res.json({ ok: r.status < 300 });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// Search Spotify library (public search – no special scope needed)
// Example: GET /api/display/<deviceId>/spotify/search?q=beatles&type=track,artist,playlist
app.get("/api/display/:deviceId/spotify/search", deviceHH, async (req, res) => {
  try {
    const at = await spotifyAccess(req.hh);
    if (!at) return res.json({ connected: false, loginUrl: spotifyLoginUrl(req) });
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ error: "missing q query" });
    const types = (req.query.type || "track,playlist,episode,artist");
    // Spotify expects the query ('q') parameter before type/limit. Preserve that order.
    const r = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(types)}`, {
      headers: { Authorization: "Bearer " + at },
    });
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });
    const data = await r.json();
    res.json({ connected: true, results: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

  app.put(`/api/${name}/:id`, auth, (req, res) => {
    const sets = cols.filter(c => c in req.body);
    if (!sets.length) return res.json({ ok: true });
    db.prepare(`UPDATE ${table} SET ${sets.map(c => c + "=?").join(",")} WHERE id=? AND household_id=?`)
      .run(...sets.map(c => req.body[c]), req.params.id, req.hh);
    broadcast(req.hh, { type: "reload" }); res.json({ ok: true });
  });
  app.delete(`/api/${name}/:id`, auth, (req, res) => {
    db.prepare(`DELETE FROM ${table} WHERE id=? AND household_id=?`).run(req.params.id, req.hh);
    broadcast(req.hh, { type: "reload" }); res.json({ ok: true });
  });
}
crud("members", "members", ["name","color","avatar","role","pin","points","screen_minutes"]);
crud("chores", "chores", ["title","member_id","points","screen_minutes","schedule","rotate","is_bounty","status","claimed_by","done_date"]);
crud("routines", "routines", ["member_id","name","time_start","time_end","steps"]);
crud("recipes", "recipes", ["title","url","tags"]);
crud("grocery", "grocery", ["item","category","added_by","done"]);
crud("departures", "events_local", ["member_id","title","when_ts","leave_mins","repeat_weekly"]);
crud("kudos", "kudos", ["from_id","to_id","text","created"]);
crud("announcements", "announcements", ["text","emoji","expires"]);
crud("rewards", "rewards", ["title","cost"]);
crud("todos", "todos", ["list_name","text","done"]);
// Simple endpoint to retrieve a fresh access token for the Web Playback SDK (if needed by the UI)
app.get("/api/display/:deviceId/spotify/token", deviceHH, async (req, res) => {
  try {
    const at = await spotifyAccess(req.hh);
    if (!at) return res.status(400).json({ error: "Spotify not connected", loginUrl: spotifyLoginUrl(req) });
    res.json({ access_token: at });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Education suite (Google OAuth + school apps) ----------
require("./education").register(app, { db, auth, deviceHH });

// ---------- Widget data proxy ----------
app.post("/api/widget-data/:type", async (req, res) => {
  try {
    const fn = widgets[req.params.type];
    if (!fn) return res.status(404).json({ error: "unknown widget" });
    // Pass request body as config. Provide db in case widget needs DB access.
    const result = await fn(req.body || {}, db);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Cache control ----------
// Allows an authenticated user to clear the server‑side widget cache.
app.post("/api/clear-cache", auth, (req, res) => {
  try {
    if (typeof widgets.clearCache === "function") {
      widgets.clearCache();
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Meals ----------
app.get("/api/meals", auth, (req, res) =>
  res.json(db.prepare("SELECT * FROM meals WHERE household_id=? AND date>=? ORDER BY date")
    .all(req.hh, req.query.start || today())));
app.put("/api/meals", auth, (req, res) => {
  db.prepare("INSERT OR REPLACE INTO meals VALUES (?,?,?,?,?)")
    .run(req.hh, req.body.date, req.body.slot, req.body.title, req.body.recipe_url || "");
  broadcast(req.hh, { type: "reload" }); res.json({ ok: true });
});

// ---------- Quiet hours ----------
app.get("/api/quiet-hours", auth, (req, res) => {
  const row = db.prepare("SELECT value FROM settings WHERE household_id=? AND key='quiet_hours'").get(req.hh);
  res.json(row ? JSON.parse(row.value) : { start: "21:30", end: "06:00", enabled: false });
});
app.put("/api/quiet-hours", auth, (req, res) => {
  db.prepare("INSERT OR REPLACE INTO settings VALUES (?,'quiet_hours',?)")
    .run(req.hh, JSON.stringify(req.body));
  broadcast(req.hh, { type: "reload" }); res.json({ ok: true });
});

// ---------- Approvals ----------
app.get("/api/approvals", auth, (req, res) =>
  res.json(db.prepare("SELECT * FROM chores WHERE status='pending' AND household_id=?").all(req.hh)));
app.post("/api/approvals/:id", auth, (req, res) => {
  const c = db.prepare("SELECT * FROM chores WHERE id=? AND household_id=?").get(req.params.id, req.hh);
  if (!c) return res.status(404).json({ error: "not found" });
  if (req.body.approve) {
    db.prepare("UPDATE chores SET status='done' WHERE id=?").run(c.id);
    db.prepare("UPDATE members SET points=points+?,screen_minutes=screen_minutes+? WHERE id=?")
      .run(c.points, c.screen_minutes, c.claimed_by);
    const remaining = db.prepare("SELECT COUNT(*) n FROM chores WHERE member_id=? AND status='open' AND household_id=?")
      .get(c.claimed_by, req.hh).n;
    if (remaining === 0)
      db.prepare("UPDATE members SET streak=streak+1, streak_date=? WHERE id=?").run(today(), c.claimed_by);
  } else db.prepare("UPDATE chores SET status='open',claimed_by=NULL WHERE id=?").run(c.id);
  broadcast(req.hh, { type: "reload" }); res.json({ ok: true });
});

// ---------- Display mirrors ----------
const mirror = (route, sql) =>
  app.get(`/api/display/:deviceId/${route}`, deviceHH, (req, res) =>
    res.json(db.prepare(sql).all(req.hh)));
mirror("members", "SELECT id,name,color,avatar,role,points,screen_minutes,streak FROM members WHERE household_id=?");
mirror("chores", "SELECT * FROM chores WHERE household_id=?");
mirror("grocery", "SELECT * FROM grocery WHERE household_id=? ORDER BY category,done");
mirror("kudos", "SELECT * FROM kudos WHERE household_id=? ORDER BY created DESC LIMIT 10");
mirror("rewards", "SELECT * FROM rewards WHERE household_id=?");
mirror("recipes", "SELECT * FROM recipes WHERE household_id=?");
mirror("meals", "SELECT * FROM meals WHERE household_id=?");
mirror("todos", "SELECT * FROM todos WHERE household_id=?");
app.get("/api/display/:deviceId/announcements", deviceHH, (req, res) =>
  res.json(db.prepare("SELECT * FROM announcements WHERE household_id=? AND expires>?").all(req.hh, Date.now())));
app.get("/api/display/:deviceId/routines", deviceHH, (req, res) => {
  res.json(db.prepare("SELECT * FROM routines WHERE household_id=?").all(req.hh).map(r => ({
    ...r, steps: JSON.parse(r.steps),
    checked: db.prepare("SELECT step_idx FROM routine_checks WHERE routine_id=? AND date=?")
      .all(r.id, today()).map(x => x.step_idx)
  })));
});
app.get("/api/display/:deviceId/departures", deviceHH, (req, res) => {
  const now = Date.now(), upcoming = [];
  db.prepare("SELECT * FROM events_local WHERE household_id=?").all(req.hh).forEach(e => {
    let ts = e.when_ts;
    if (e.repeat_weekly) {
      const days = e.repeat_weekly.split(",");
      for (let i = 0; i < 8; i++) {
        const d = new Date(now + i * 86400e3);
        if (days.includes(d.toLocaleDateString("en", { weekday: "short" }))) {
          const t = new Date(e.when_ts);
          d.setHours(t.getHours(), t.getMinutes(), 0, 0);
          if (d.getTime() > now - 3600e3) { ts = d.getTime(); break; }
        }
      }
    }
    if (ts > now - 3600e3 && ts < now + 36 * 3600e3) upcoming.push({ ...e, next_ts: ts });
  });
  res.json(upcoming.sort((a, b) => a.next_ts - b.next_ts));
});
app.get("/api/display/:deviceId/quiet-hours", deviceHH, (req, res) => {
  const row = db.prepare("SELECT value FROM settings WHERE household_id=? AND key='quiet_hours'").get(req.hh);
  res.json(row ? JSON.parse(row.value) : { enabled: false });
});
app.get("/api/display/:deviceId/dinner-spin", deviceHH, (req, res) => {
  const all = db.prepare("SELECT * FROM recipes WHERE household_id=?").all(req.hh);
  if (!all.length) return res.json({ title: "Add recipes in Admin first!" });
  res.json(all[Math.floor(Math.random() * all.length)]);
});

// ---------- Display actions ----------
app.post("/api/display/:deviceId/chores/:id/complete", deviceHH, (req, res) => {
  const c = db.prepare("SELECT * FROM chores WHERE id=? AND household_id=?").get(req.params.id, req.hh);
  if (!c) return res.status(404).json({ error: "not found" });
  const mid = c.is_bounty ? req.body.member_id : c.member_id;
  const m = db.prepare("SELECT * FROM members WHERE id=? AND household_id=?").get(mid, req.hh);
  if (m && m.pin && m.pin !== (req.body.pin || "")) return res.status(403).json({ error: "wrong PIN" });
  db.prepare("UPDATE chores SET status='pending',claimed_by=?,done_date=? WHERE id=?").run(mid, today(), c.id);
  broadcast(req.hh, { type: "reload" }); res.json({ ok: true });
});
app.post("/api/display/:deviceId/routines/:rid/check/:idx", deviceHH, (req, res) => {
  db.prepare("INSERT OR REPLACE INTO routine_checks VALUES (?,?,?)")
    .run(req.params.rid, req.params.idx, today());
  broadcast(req.hh, { type: "reload" }); res.json({ ok: true });
});
app.post("/api/display/:deviceId/grocery/:id/toggle", deviceHH, (req, res) => {
  db.prepare("UPDATE grocery SET done = 1-done WHERE id=? AND household_id=?").run(req.params.id, req.hh);
  broadcast(req.hh, { type: "reload" }); res.json({ ok: true });
});

// Display saves ONE page's geometry; server merges it into the stored layout.
app.post("/api/display/:deviceId/layout", deviceHH, (req, res) => {
  if (!req.device.dashboard_id) return res.status(400).json({ error: "no dashboard assigned" });
  const row = db.prepare("SELECT layout FROM dashboards WHERE id=? AND household_id=?")
    .get(req.device.dashboard_id, req.hh);
  if (!row) return res.status(404).json({ error: "dashboard not found" });
  let layout = JSON.parse(row.layout);
  if (Array.isArray(layout)) layout = { v: 2, pages: [{ name: "Page 1", secs: 0, widgets: layout }] };
  layout.pages.forEach((p, i) => { if (!p.id) p.id = "pg" + i; });
  if (req.body.page_id && Array.isArray(req.body.widgets)) {
    const p = layout.pages.find(x => x.id === req.body.page_id);
    if (!p) return res.status(404).json({ error: "page not found" });
    p.widgets = req.body.widgets;
  } else if (req.body.layout) {
    layout = req.body.layout;
  } else return res.status(400).json({ error: "page_id + widgets required" });
  db.prepare("UPDATE dashboards SET layout=? WHERE id=? AND household_id=?")
    .run(JSON.stringify(layout), req.device.dashboard_id, req.hh);
  res.json({ ok: true });
});

// ---------- Ask the house (Gemini preferred, Anthropic fallback) ----------
app.post("/api/display/:deviceId/ask", deviceHH, async (req, res) => {
  const q = String(req.body.q || "").slice(0, 500);
  const sys = "You are a friendly household assistant on a family wall display. Answer briefly (2-4 sentences), family-friendly, helpful for kids and adults.";
  try {
    if (process.env.GEMINI_API_KEY) {
      console.log("AskHouse: using Gemini model", GEMINI_MODEL);
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: sys }] },
            contents: [{ parts: [{ text: q }] }],
            generationConfig: { maxOutputTokens: 300 } }) });
      const d = await r.json();
      const t = d.candidates && d.candidates[0] && d.candidates[0].content &&
                d.candidates[0].content.parts && d.candidates[0].content.parts[0].text;
      return res.json({ answer: t || ("Gemini error: " + JSON.stringify(d.error || d).slice(0, 200)) });
    }
    if (process.env.ANTHROPIC_API_KEY) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-3-5-haiku-latest", max_tokens: 300,
          system: sys, messages: [{ role: "user", content: q }] }) });
      const d = await r.json();
      return res.json({ answer: d.content && d.content[0] ? d.content[0].text : "Sorry, I could not answer that." });
    }
    res.json({ answer: "Add GEMINI_API_KEY (free at aistudio.google.com) or ANTHROPIC_API_KEY to the server .env." });
  } catch (e) { res.json({ answer: "Assistant error: " + e.message }); }
});

// ---------- Joke ratings ----------
app.get("/api/display/:deviceId/joke-rate/:id", deviceHH, (req, res) => {
  const row = db.prepare("SELECT value FROM settings WHERE household_id=? AND key=?")
    .get(req.hh, "jokerate:" + req.params.id);
  res.json(row ? JSON.parse(row.value) : { up: 0, down: 0 });
});
app.post("/api/display/:deviceId/joke-rate", deviceHH, (req, res) => {
  const key = "jokerate:" + (req.body.id || "x");
  const row = db.prepare("SELECT value FROM settings WHERE household_id=? AND key=?").get(req.hh, key);
  const v = row ? JSON.parse(row.value) : { up: 0, down: 0 };
  if (req.body.up) v.up++; else v.down++;
  db.prepare("INSERT OR REPLACE INTO settings VALUES (?,?,?)").run(req.hh, key, JSON.stringify(v));
  res.json(v);
});



// ---------- Photos ----------
const upload = multer({ dest: path.join(DATA, "tmp") });
app.post("/api/photos", auth, upload.array("photos"), (req, res) => {
  const dir = path.join(DATA, "photos", String(req.hh));
  fs.mkdirSync(dir, { recursive: true });
  req.files.forEach(f => fs.renameSync(f.path, path.join(dir, path.basename(f.originalname))));
  broadcast(req.hh, { type: "reload" }); res.json({ ok: true });
});
app.get("/api/display/:deviceId/photos", deviceHH, (req, res) => {
  const dir = path.join(DATA, "photos", String(req.hh));
  res.json(fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /\.(jpe?g|png|gif|webp)$/i.test(f)) : []);
});
app.get("/api/display/:deviceId/photo/:name", deviceHH, (req, res) => {
  const file = path.join(DATA, "photos", String(req.hh), path.basename(req.params.name));
  fs.existsSync(file) ? res.sendFile(file) : res.status(404).end();
});

// ---------- Documents ----------
const docsDir = hh => path.join(DATA, "docs", String(hh));
app.post("/api/docs", auth, upload.array("docs"), (req, res) => {
  fs.mkdirSync(docsDir(req.hh), { recursive: true });
  req.files.forEach(f => fs.renameSync(f.path, path.join(docsDir(req.hh), path.basename(f.originalname))));
  broadcast(req.hh, { type: "reload" }); res.json({ ok: true });
});
app.get("/api/docs", auth, (req, res) => {
  const dir = docsDir(req.hh);
  res.json(fs.existsSync(dir) ? fs.readdirSync(dir) : []);
});
app.delete("/api/docs/:name", auth, (req, res) => {
  const file = path.join(docsDir(req.hh), path.basename(req.params.name));
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ ok: true });
});
app.get("/api/display/:deviceId/docs", deviceHH, (req, res) => {
  const dir = docsDir(req.hh);
  res.json(fs.existsSync(dir) ? fs.readdirSync(dir) : []);
});
app.get("/api/display/:deviceId/doc/:name", deviceHH, (req, res) => {
  const file = path.join(docsDir(req.hh), path.basename(req.params.name));
  fs.existsSync(file) ? res.sendFile(file) : res.status(404).end();
});

// ---------- E-ink lite mode ----------
app.get("/lite/:code", (req, res) => {
  const hh = db.prepare("SELECT * FROM households WHERE pair_code=?").get(req.params.code.toUpperCase());
  if (!hh) return res.send("<h1>Bad pair code</h1>");
  const chores = db.prepare("SELECT * FROM chores WHERE household_id=? AND status='open'").all(hh.id);
  const members = db.prepare("SELECT * FROM members WHERE household_id=?").all(hh.id);
  const groc = db.prepare("SELECT * FROM grocery WHERE household_id=? AND done=0").all(hh.id);
  const name = id => (members.find(m => m.id === id) || {}).name || "";
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
<meta http-equiv="refresh" content="120">
<style>body{font-family:Georgia,serif;background:#fff;color:#000;padding:16px;font-size:22px}
h1{border-bottom:3px solid #000}h2{margin-top:20px}li{margin:6px 0}</style></head><body>
<h1>${hh.name} - ${new Date().toLocaleDateString([], {weekday:"long",month:"long",day:"numeric"})}</h1>
<h2>Chores Today</h2><ul>${chores.map(c => `<li>&#9744; <b>${name(c.member_id)}</b>: ${c.title}</li>`).join("") || "<li>All done!</li>"}</ul>
<h2>Grocery List</h2><ul>${groc.map(g => `<li>&#9744; ${g.item}</li>`).join("") || "<li>Empty</li>"}</ul>
<p style="font-size:14px">Updated ${new Date().toLocaleTimeString()}</p></body></html>`);
});

// ---------- Chore reset scheduler ----------
const yesterday = () => new Date(Date.now() - 86400e3).toISOString().slice(0, 10);
function resetChores() {
  db.prepare("SELECT * FROM chores WHERE status='done' AND schedule!='once'").all().forEach(c => {
    if (c.done_date === today()) return;
    const due = c.schedule === "daily" ||
      (c.schedule === "weekdays" && !["Sat","Sun"].includes(dow())) ||
      (c.schedule.startsWith("weekly:") && c.schedule.split(":")[1] === dow());
    if (!due) return;
    let next = c.member_id;
    if (c.rotate) {
      const kids = db.prepare("SELECT id FROM members WHERE role='kid' AND household_id=? ORDER BY id").all(c.household_id);
      if (kids.length) {
        const idx = kids.findIndex(k => k.id === c.member_id);
        next = kids[(idx + 1) % kids.length].id;
      }
    }
    db.prepare("UPDATE chores SET status='open', member_id=?, claimed_by=NULL WHERE id=?").run(next, c.id);
  });
  db.prepare("SELECT * FROM members WHERE role='kid'").all().forEach(m => {
    if (m.streak_date && m.streak_date < yesterday())
      db.prepare("UPDATE members SET streak=0 WHERE id=?").run(m.id);
  });
}
setInterval(resetChores, 60 * 60e3);
resetChores();
setInterval(() => db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now()), 86400e3);

// ---------- HTTP + WS ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    try {
      const m = JSON.parse(raw);
      if (m.device) {
        const d = db.prepare("SELECT household_id FROM devices WHERE id=?").get(m.device);
        if (d) ws.hh = d.household_id;
      }
    } catch {}
  });
});
function broadcast(hh, msg) {
  wss.clients.forEach(c => c.readyState === 1 && (c.hh === hh || !c.hh) && c.send(JSON.stringify(msg)));
}
 // ----- Backup & Restore Endpoints -----
  const { execSync, spawn } = require('child_process');
 const BACKUP_ROOT = path.join(__dirname, '..', 'Backup');
 const NssmPath = path.join(__dirname, '..', 'tools', 'nssm.exe');

 // Helper middleware to ensure the request is from a server admin
 function requireAdmin(req, res, next) {
   if (!req.user || req.user.role !== 'serveradmin') {
     return res.status(403).json({ error: 'Forbidden: admin only' });
   }
   next();
 }

 // Create a timestamped folder backup of the entire project (excluding the Backup folder itself)
 app.post('/api/backup', auth, requireAdmin, async (req, res) => {
   try {
     const now = new Date();
     // Format: YYYY-MM-DD-HHMMSS
     const stamp = now.toISOString().replace(/[:T]/g, '-').slice(0, 19);
     const dest = path.join(BACKUP_ROOT, stamp);
     await fs.promises.mkdir(dest, { recursive: true });
   const src = path.join(__dirname, '..');
   // Copy each top‑level entry (except the Backup folder) into the destination.
   const entries = await fs.promises.readdir(src, { withFileTypes: true });
   for (const entry of entries) {
     if (entry.name === 'Backup') continue; // skip the backup directory itself
     const srcPath = path.join(src, entry.name);
     const destPath = path.join(dest, entry.name);
     await fs.promises.cp(srcPath, destPath, { recursive: true, force: true });
   }
     res.json({ ok: true, folder: stamp });
   } catch (e) {
     console.error('Backup failed', e);
     res.status(500).json({ error: e.message });
   }
 });

 // List all backup folders (newest first). If the backup root does not exist yet, create it and return an empty list.
 app.get('/api/backups', auth, requireAdmin, async (req, res) => {
   try {
     const entries = await fs.promises.readdir(BACKUP_ROOT, { withFileTypes: true }).catch(async (err) => {
       if (err.code === 'ENOENT') {
         // Backup folder missing – create it and treat as empty.
         await fs.promises.mkdir(BACKUP_ROOT, { recursive: true });
         return [];
       }
       throw err;
     });
     const dirs = entries.filter(d => d.isDirectory()).map(d => d.name);
     dirs.sort((a, b) => b.localeCompare(a)); // descending (newest first)
     res.json(dirs);
   } catch (e) {
     console.error('Listing backups failed', e);
     res.status(500).json({ error: e.message });
   }
 });

 // Restore from a selected backup folder. Stops the service, copies files, then starts the service.
 app.post('/api/restore', auth, requireAdmin, async (req, res) => {
   const { folder } = req.body;
   if (!folder) return res.status(400).json({ error: 'Missing folder name' });
   const src = path.join(BACKUP_ROOT, folder);
   try {
     const stat = await fs.promises.stat(src);
     if (!stat.isDirectory()) throw new Error('Backup folder not found');
   } catch (e) {
     return res.status(400).json({ error: 'Backup folder not found' });
   }
   try {
     // Stop the MangoDash service using nssm
     execSync(`"${NssmPath}" stop MangoDash`);
   } catch (e) {
     // ignore errors if service already stopped
   }
   try {
     const dest = path.join(__dirname, '..');
     await fs.promises.cp(src, dest, { recursive: true, force: true });
   } catch (e) {
     // Try to restart service if copy fails
     try { execSync(`"${NssmPath}" start MangoDash`); } catch (_) {}
     console.error('Restore copy failed', e);
     return res.status(500).json({ error: e.message });
   }
   try {
     execSync(`"${NssmPath}" start MangoDash`);
   } catch (e) {
     console.error('Failed to start service after restore', e);
   }
   res.json({ ok: true });
   // Note: client may need to refresh after the service restarts.
 });

// ================= JUKEBOX PLAYLISTS =================

function getFallbackPlaylists() {
  return [
    { id: "PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI", title: "Top 100 Songs United States", description: "Top popular songs in the US.", thumbnail: null, trackCount: 100, trending: true, source: "fallback" },
    { id: "PL4fGSI1pDJn61unMfmrUSz68RT8IFFnks", title: "Daily Top Music Videos - United States", description: "Daily top videos in the US.", thumbnail: null, trackCount: 100, trending: true, source: "fallback" },
    { id: "PL4fGSI1pDJn69On1f-8NAvX_CYlx7QyZc", title: "Top 100 Music Videos United States", description: "Weekly top videos in the US.", thumbnail: null, trackCount: 100, trending: true, source: "fallback" },
    { id: "PL4fGSI1pDJn77aK7sAW2AT0oOzo5inWY8", title: "Top 50 Pop Music Videos United States", description: "Top Pop music videos in the US.", thumbnail: null, trackCount: 50, trending: true, source: "fallback" },
    { id: "PL4fGSI1pDJn4fmCoF1vKHLtivI0f9yHiF", title: "Top 50 Hip Hop Music Videos United States", description: "Top Hip Hop music videos in the US.", thumbnail: null, trackCount: 50, trending: true, source: "fallback" },
    { id: "PL4fGSI1pDJn4EBsWVeFpcSAVOFMfhyipg", title: "Top 50 Country & Americana Music Videos", description: "Top Country & Americana music videos in the US.", thumbnail: null, trackCount: 50, trending: true, source: "fallback" },
    { id: "PL4fGSI1pDJn5LOptOQixqnzXNGjNXAgYY", title: "Top 50 Rock Music Videos United States", description: "Top Rock music videos in the US.", thumbnail: null, trackCount: 50, trending: true, source: "fallback" },
    { id: "PL4fGSI1pDJn4rBU0RHnR6-b1_uE20CzRH", title: "Top 50 Dance & Electronic Music Videos", description: "Top Dance music videos in the US.", thumbnail: null, trackCount: 50, trending: true, source: "fallback" },
    { id: "PL4fGSI1pDJn4w4wTTgOmP_S80PoCtbGrL", title: "Top 50 Hard Rock & Metal Music Videos", description: "Top Metal music videos in the US.", thumbnail: null, trackCount: 50, trending: true, source: "fallback" },
    { id: "PL4fGSI1pDJn4lISEuwIR4tT5JVua7Gyi7", title: "Weekly Top Songs on Shorts - United States", description: "Weekly top songs on Shorts in the US.", thumbnail: null, trackCount: 49, trending: true, source: "fallback" }
  ];
}

// Get Top 10 USA Music Playlists
app.get("/api/jukebox/playlists/top-music", async (req, res) => {
  try {
    const CACHE_KEY = "top_music_playlists_cache";
    const CACHE_PATH = path.join(DATA, "cache.json");
    let cache = { data: null, timestamp: 0, playlistIds: [] };
    if (fs.existsSync(CACHE_PATH)) {
      try {
        const cached = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
        cache = cached[CACHE_KEY] || cache;
      } catch (e) {}
    }

    const now = Date.now();
    const CACHE_DURATION = 24 * 60 * 60 * 1000;
    if (cache.data && cache.playlistIds && cache.playlistIds.length > 0 && (now - cache.timestamp < CACHE_DURATION)) {
      return res.json({ playlists: cache.data, cached: true, playlistIds: cache.playlistIds });
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return res.json({ playlists: getFallbackPlaylists(), cached: false, playlistIds: getFallbackPlaylists().map(p => p.id), dynamic: false });
    }

    const chartsChannelId = "UCrKZcyOJVWnJ60zM1XWllNw";
    let playlists = [];
    let url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&channelId=${chartsChannelId}&maxResults=50&key=${apiKey}`;
    
    for (let page = 0; page < 2; page++) {
      const response = await fetch(url);
      if (!response.ok) break;
      const data = await response.json();
      if (!data.items || data.items.length === 0) break;
      playlists.push(...data.items);
      if (data.nextPageToken) {
        url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&channelId=${chartsChannelId}&maxResults=50&pageToken=${data.nextPageToken}&key=${apiKey}`;
      } else {
        break;
      }
    }

    let filteredPlaylists = playlists
      .filter(p => p.id && p.id.startsWith("PL"))
      .filter(p => {
        const title = (p.snippet?.title || "").toLowerCase();
        return title.includes("united states") || title.includes(" us ") || title.includes(" us -") || title.includes(" us") || title.includes("global");
      })
      .slice(0, 10)
      .map(p => ({
        id: p.id,
        title: p.snippet.title,
        description: p.snippet.description || "",
        thumbnail: p.snippet.thumbnails?.high?.url || p.snippet.thumbnails?.medium?.url || p.snippet.thumbnails?.default?.url || null,
        trackCount: p.contentDetails?.itemCount || 0,
        trending: true,
        source: "youtube_charts_dynamic"
      }));

    if (filteredPlaylists.length < 10) {
      const fallback = getFallbackPlaylists();
      const existingIds = new Set(filteredPlaylists.map(p => p.id));
      for (const p of fallback) {
        if (filteredPlaylists.length >= 10) break;
        if (!existingIds.has(p.id)) filteredPlaylists.push(p);
      }
    }

    const playlistIds = filteredPlaylists.map(p => p.id);
    let cacheData = {};
    if (fs.existsSync(CACHE_PATH)) {
      try { cacheData = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")); } catch (e) {}
    }
    cacheData[CACHE_KEY] = { data: filteredPlaylists, timestamp: now, playlistIds };
    try {
      fs.writeFileSync(CACHE_PATH, JSON.stringify(cacheData, null, 2));
    } catch (e) {
      console.error("Failed to write cache:", e);
    }

    res.json({ playlists: filteredPlaylists, cached: false, playlistIds, dynamic: true, refreshedAt: new Date(now).toISOString() });
  } catch (e) {
    console.error("Error fetching top music playlists:", e);
    res.json({ playlists: getFallbackPlaylists(), cached: false, playlistIds: getFallbackPlaylists().map(p => p.id), dynamic: false, error: e.message });
  }
});

// Public YouTube-only jukebox endpoint (for unpaired devices)
app.get("/api/jukebox", async (req, res) => {
  try {
    const playlistParam = req.query.playlist || "";
    if (!playlistParam) return res.json({ error: "No playlist configured." });

    const playlistIds = playlistParam.split(",").map(p => p.trim()).filter(p => p);
    const tracks = [];
    const warnings = [];
    const apiKey = process.env.YOUTUBE_API_KEY;

    for (const pid of playlistIds) {
      if (tracks.length >= 200) break;

      const ytPid = parseYouTubePlaylistId(pid);
      if (ytPid) {
        if (!apiKey) {
          warnings.push(`YouTube API key not configured for playlist: ${pid}`);
          continue;
        }
        try {
          const ytTracks = await fetchYouTubePlaylistTracks(ytPid, apiKey);
          tracks.push(...ytTracks);
        } catch (err) {
          warnings.push(`Failed to load YouTube playlist ${pid}: ${err.message}`);
        }
      } else {
        warnings.push(`Spotify playlist not supported on public/unpaired jukebox: ${pid}`);
      }
    }

    res.json({
      provider: "youtube",
      tracks: tracks.slice(0, 200),
      playlistCount: playlistIds.length,
      warnings: warnings.length > 0 ? warnings : undefined
    });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// Common handler for playlist metadata
async function getPlaylistsMetadata(req, res) {
  try {
    const ids = (req.query.ids || "").split(",").map(p => p.trim()).filter(p => p);
    if (ids.length === 0) {
      return res.json({ playlists: [] });
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return res.json({ error: "YouTube API key not configured", playlists: [] });
    }

    const playlists = [];
    const batchSize = 50;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=${encodeURIComponent(batch.join(","))}&key=${apiKey}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        const items = (data.items || []).map(p => ({
          id: p.id,
          title: p.snippet.title,
          description: p.snippet.description || "",
          thumbnail: p.snippet.thumbnails?.high?.url || p.snippet.thumbnails?.medium?.url || p.snippet.thumbnails?.default?.url || null,
          trackCount: p.contentDetails?.itemCount || 0,
          trending: false,
          source: "user_library"
        }));
        playlists.push(...items);
      } else {
        console.error("YouTube API metadata error:", response.status);
      }
    }

    res.json({ playlists });
  } catch (e) {
    console.error("Error fetching playlist metadata:", e);
    res.json({ error: e.message, playlists: [] });
  }
}

// Get playlist metadata by IDs (public)
app.get("/api/jukebox/playlists/metadata", getPlaylistsMetadata);

// Get playlist metadata by IDs (paired device)
app.get("/api/display/:deviceId/playlists/metadata", deviceHH, getPlaylistsMetadata);



  server.listen(PORT, () => console.log(`MangoDash v3 running on :${PORT}`));
  // Graceful error handling for server startup (e.g., port already in use)
  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} already in use. Server cannot start.`);
    } else {
      console.error('Server listen error:', err);
    }
    process.exit(1);
  });