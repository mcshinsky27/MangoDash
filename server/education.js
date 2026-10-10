// ---------------------------------------------------------------------------
// MangoDash Education suite – Google OAuth + school-app data endpoints.
//
// Follows the established Spotify pattern:
//   - Household-level OAuth: a parent completes the flow once, tokens are
//     stored in the `settings` table keyed by household_id, and paired
//     displays fetch data via device-scoped endpoints (deviceHH middleware).
//   - One Google grant covers all Google widgets (Classroom, Gmail, Docs);
//     Alma & ParentSquare are fed by parsing their digest emails from Gmail.
// ---------------------------------------------------------------------------
"use strict";

const googleTokens = new Map(); // hh -> { at, exp }
const dataCache = new Map();    // url-ish key -> { t, v }

async function cached(key, ttlMs, fn) {
  const hit = dataCache.get(key);
  if (hit && Date.now() - hit.t < ttlMs) return hit.v;
  const v = await fn();
  dataCache.set(key, { t: Date.now(), v });
  return v;
}

// All scopes requested in one consent screen so one connect powers every
// Google widget. access_type=offline + prompt=consent guarantees a refresh
// token is issued even on repeat connections.
const GOOGLE_SCOPES = [
  "openid", "email", "profile",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.student-submissions.students.readonly",
  "https://www.googleapis.com/auth/classroom.announcements.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.readonly"
].join(" ");

function googleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function setting(hh, key) {
  const row = db.prepare("SELECT value FROM settings WHERE household_id=? AND key=?").get(hh, key);
  return row ? row.value : null;
}

function setSetting(hh, key, value) {
  db.prepare("INSERT OR REPLACE INTO settings (household_id,key,value) VALUES (?,?,?)").run(hh, key, value);
}

function clearSettings(hh, keys) {
  const stmt = db.prepare("DELETE FROM settings WHERE household_id=? AND key=?");
  keys.forEach(k => stmt.run(hh, k));
}

// Exchange the stored refresh token for a fresh access token (cached ~50 min).
async function googleAccess(hh) {
  const hit = googleTokens.get(hh);
  if (hit && Date.now() < hit.exp) return hit.at;
  const refresh = setting(hh, "google_refresh");
  if (!refresh) return null;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refresh
    })
  });
  const d = await r.json();
  if (!d.access_token) {
    // invalid_grant = revoked or expired consent; drop the token and flag it
    // so /api/connections can explain "session expired" instead of failing forever.
    if (d.error === "invalid_grant") {
      clearSettings(hh, ["google_refresh", "google_email", "google_scopes"]);
      setSetting(hh, "google_expired", "1");
      googleTokens.delete(hh);
    }
    return null;
  }
  googleTokens.set(hh, { at: d.access_token, exp: Date.now() + 50 * 60e3 });
  return d.access_token;
}

async function gapi(hh, url) {
  const at = await googleAccess(hh);
  if (!at) throw new Error("Google not connected");
  const r = await fetch(url, { headers: { Authorization: "Bearer " + at } });
  if (!r.ok) {
    let body = "";
    try { body = (await r.text()).slice(0, 200); } catch (_) {}
    throw new Error(`Google API ${r.status}: ${body}`);
  }
  return r.json();
}

function fmtDue(dueDate, dueTime) {
  if (!dueDate) return null;
  const h = (dueTime && Number.isInteger(dueTime.hours)) ? dueTime.hours : 23;
  const m = (dueTime && Number.isInteger(dueTime.minutes)) ? dueTime.minutes : 59;
  return new Date(dueDate.year, dueDate.month - 1, dueDate.day, h, m).getTime();
}

// ---------- Data fetchers ----------

async function fetchClassroom(hh) {
  return cached(`edu:cr:${hh}`, 5 * 60e3, async () => {
    const d = await gapi(hh, "https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&pageSize=20");
    const courses = (d.courses || []).map(c => ({
      id: c.id, name: c.name, section: c.section || "", link: c.alternateLink || ""
    }));
    // Due-soon: pull recent coursework per course (capped so large course
    // loads stay fast) and keep only items with a due date in the next 14 days.
    const dueSoon = [];
    const horizon = Date.now() + 14 * 86400e3;
    for (const c of courses.slice(0, 8)) {
      try {
        const w = await gapi(hh, `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(c.id)}/courseWork?pageSize=20`);
        for (const item of (w.courseWork || [])) {
          const due = fmtDue(item.dueDate, item.dueTime);
          if (due && due > Date.now() - 86400e3 && due < horizon) {
            dueSoon.push({ course: c.name, title: item.title || "Untitled", due, link: item.alternateLink || c.link });
          }
        }
      } catch (_) { /* per-course failures shouldn't kill the widget */ }
    }
    dueSoon.sort((a, b) => a.due - b.due);
    return { courses, dueSoon: dueSoon.slice(0, 12) };
  });
}

function parseSender(hdrs) {
  const from = (hdrs.find(h => h.name.toLowerCase() === "from") || {}).value || "";
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/) || [null, from, from];
  return { name: m[1] ? m[1].replace(/"/g, "") : m[2], email: (m[2] || "").toLowerCase() };
}

async function fetchGmailMessages(hh, max) {
  return cached(`edu:gm:${hh}:${max}`, 5 * 60e3, async () => {
    const list = await gapi(hh, `https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=${max}`);
    const msgs = [];
    for (const m of (list.messages || [])) {
      try {
        const full = await gapi(hh, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
        const hdrs = full.payload && full.payload.headers || [];
        const sender = parseSender(hdrs);
        const dateHdr = (hdrs.find(h => h.name.toLowerCase() === "date") || {}).value || "";
        msgs.push({
          id: m.id,
          fromName: sender.name, fromEmail: sender.email,
          subject: (hdrs.find(h => h.name.toLowerCase() === "subject") || {}).value || "(no subject)",
          date: Date.parse(dateHdr) || 0,
          snippet: full.snippet || ""
        });
      } catch (_) { /* skip unreadable message */ }
    }
    return msgs;
  });
}

// Alma / ParentSquare push everything to email, so the Gmail digest is the
// hub: categorize recent school mail by sender domain. Patterns are env-
// configurable because schools use varying Alma/ParentSquare sender domains.
function senderMatches(text, patterns) {
  const list = (patterns || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return list.some(p => text.includes(p));
}

async function fetchDigest(hh) {
  return cached(`edu:dg:${hh}`, 5 * 60e3, async () => {
    const msgs = await fetchGmailMessages(hh, 30);
    const almaP = process.env.ALMA_SENDER_PATTERNS || "alma";
    const psP = process.env.PARENTSQUARE_SENDER_PATTERNS || "parentsquare";
    const pick = p => msgs.filter(m =>
      senderMatches(m.fromEmail, p) || senderMatches(m.subject.toLowerCase(), p));
    return {
      connected: true,
      alma: pick(almaP).slice(0, 8),
      parentsquare: pick(psP).slice(0, 8),
      lastSync: Date.now()
    };
  });
}

async function fetchGdocs(hh) {
  return cached(`edu:gd:${hh}`, 10 * 60e3, async () => {
    const q = encodeURIComponent("mimeType='application/vnd.google-apps.document'");
    const d = await gapi(hh, `https://www.googleapis.com/drive/v3/files?orderBy=modifiedByMeTime desc&q=${q}&pageSize=10&fields=files(id,name,webViewLink,modifiedTime)`);
    return (d.files || []).map(f => ({ id: f.id, name: f.name, link: f.webViewLink || "", modifiedTime: f.modifiedTime }));
  });
}

// ---------- Registration ----------

module.exports.register = (app, { db, auth, deviceHH }) => {

  // ---- OAuth: start (household-level, like /api/spotify/login) ----
  app.get("/api/google/login", auth, (req, res) => {
    if (!googleConfigured()) return res.send("Set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET in .env first.");
    const redirect = `${req.protocol}://${req.get("host")}/api/google/callback`;
    const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirect,
      response_type: "code",
      scope: GOOGLE_SCOPES,
      access_type: "offline",
      prompt: "consent",
      state: String(req.hh)
    });
    res.redirect(url);
  });

  // ---- OAuth: callback ----
  app.get("/api/google/callback", async (req, res) => {
    if (!req.query.code || !req.query.state) return res.send("Google auth failed: missing code/state.");
    const hh = +req.query.state;
    const redirect = `${req.protocol}://${req.get("host")}/api/google/callback`;
    try {
      const r = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: req.query.code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirect,
          grant_type: "authorization_code"
        })
      });
      const tok = await r.json();
      if (!tok.refresh_token) return res.send("<h2>Google auth failed: no refresh token returned. Reconnect and make sure to allow all scopes.</h2>");
      setSetting(hh, "google_refresh", tok.refresh_token);
      setSetting(hh, "google_scopes", tok.scope || GOOGLE_SCOPES);
      clearSettings(hh, ["google_expired"]);
      // Fetch account email so the portal can show which account is connected.
      try {
        const ui = await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
          headers: { Authorization: "Bearer " + tok.access_token }
        })).json();
        if (ui.email) setSetting(hh, "google_email", ui.email);
      } catch (_) {}
      res.send("<h2>Google connected &#127891;</h2><p>All education widgets are live. You can close this window.</p>");
    } catch (e) {
      res.send("<h2>Google auth failed</h2><pre>" + (e.message || e) + "</pre>");
    }
  });

  // ---- Connections status (portal) ----
  app.get("/api/connections", auth, (req, res) => {
    const connected = !!setting(req.hh, "google_refresh");
    const expired = !!setting(req.hh, "google_expired");
    res.json({
      google: {
        connected: connected && !expired,
        expired,
        email: setting(req.hh, "google_email") || "",
        scopes: setting(req.hh, "google_scopes") || "",
        loginUrl: "/api/google/login"
      },
      googleConfigured: googleConfigured()
    });
  });

  app.post("/api/connections/google/disconnect", auth, (req, res) => {
    clearSettings(req.hh, ["google_refresh", "google_email", "google_scopes", "google_expired"]);
    googleTokens.delete(req.hh);
    dataCache.clear();
    res.json({ ok: true });
  });

  // ---- Device-scoped data endpoints (paired displays, like Spotify's) ----
  app.get("/api/display/:deviceId/classroom", deviceHH, async (req, res) => {
    try {
      const at = await googleAccess(req.hh);
      if (!at) return res.json({ connected: false, loginUrl: "/api/google/login" });
      res.json(Object.assign({ connected: true }, await fetchClassroom(req.hh)));
    } catch (e) { res.json({ connected: true, error: e.message }); }
  });

  app.get("/api/display/:deviceId/gmail", deviceHH, async (req, res) => {
    try {
      const at = await googleAccess(req.hh);
      if (!at) return res.json({ connected: false, loginUrl: "/api/google/login" });
      res.json({ connected: true, messages: await fetchGmailMessages(req.hh, 15) });
    } catch (e) { res.json({ connected: true, error: e.message }); }
  });

  app.get("/api/display/:deviceId/gdocs", deviceHH, async (req, res) => {
    try {
      const at = await googleAccess(req.hh);
      if (!at) return res.json({ connected: false, loginUrl: "/api/google/login" });
      res.json({ connected: true, docs: await fetchGdocs(req.hh) });
    } catch (e) { res.json({ connected: true, error: e.message }); }
  });

  app.get("/api/display/:deviceId/digest", deviceHH, async (req, res) => {
    try {
      const at = await googleAccess(req.hh);
      if (!at) return res.json({ connected: false, loginUrl: "/api/google/login" });
      res.json(await fetchDigest(req.hh));
    } catch (e) { res.json({ connected: true, error: e.message }); }
  });

  // App dock data: live Google connection state for badges on the launcher.
  app.get("/api/display/:deviceId/edulinks", deviceHH, async (req, res) => {
    const connected = !!setting(req.hh, "google_refresh") && !setting(req.hh, "google_expired");
    res.json({
      googleConnected: connected,
      googleEmail: setting(req.hh, "google_email") || "",
      loginUrl: "/api/google/login"
    });
  });
};