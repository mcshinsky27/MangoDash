const ical = require("node-ical");
const Parser = require("rss-parser");
const rss = new Parser({ headers: { "User-Agent": "Mozilla/5.0 (MangoDash)" } });
const rssImg = new Parser({ headers: { "User-Agent": "Mozilla/5.0 (MangoDash)" },
  customFields: { item: [
    ["media:content", "media"], ["media:thumbnail", "thumb"], ["enclosure", "enc"], ["content:encoded", "contentFull"]
  ]}});
const cache = new Map();

async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttlMs) return hit.v;
  const v = await fn();
  cache.set(key, { t: Date.now(), v });
  return v;
}

const WMO = { 0:"Clear",1:"Mostly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",48:"Fog",
  51:"Drizzle",61:"Rain",63:"Rain",65:"Heavy rain",71:"Snow",73:"Snow",75:"Heavy snow",
  80:"Showers",95:"Thunderstorm" };

function zipLookup(zip, country) {
  const c = (country || "us").toLowerCase();
  return cached(`zip:${c}:${zip}`, 30 * 86400e3, async () => {
    const r = await fetch(`https://api.zippopotam.us/${c}/${zip}`);
    if (!r.ok) throw new Error("ZIP not found: " + zip);
    const d = await r.json();
    const p = d.places[0];
    return { lat: +p.latitude, lon: +p.longitude,
      name: `${p["place name"]}${p["state abbreviation"] ? ", " + p["state abbreviation"] : ""}` };
  });
}

const LEAGUES = {
  mlb: "baseball/mlb", nfl: "football/nfl", nba: "basketball/nba",
  nhl: "hockey/nhl", ncaaf: "football/college-football", mls: "soccer/usa.1"
};

// Named calendar colors accepted in widget JSON ("color": "green" etc.) so users
// don't have to remember hex codes. Unknown values (hex codes, any valid CSS
// color string) are passed through untouched by resolveColor().
const NAMED_COLORS = {
  red: "#ef4444", crimson: "#dc143c", maroon: "#7f1d1d", rose: "#f43f5e",
  pink: "#ec407a", magenta: "#d81b60",
  orange: "#f97316", amber: "#f59e0b", yellow: "#eab308", gold: "#d4a017",
  lime: "#84cc16", green: "#22c55e", emerald: "#10b981", olive: "#808000",
  teal: "#14b8a6", cyan: "#06b6d4", skyblue: "#0ea5e9",
  blue: "#3d9be9", navy: "#1e40af", indigo: "#6366f1",
  violet: "#8b5cf6", purple: "#a855f7",
  brown: "#a05a2c", tan: "#d2b48c",
  gray: "#9ca3af", grey: "#9ca3af", black: "#111827", white: "#f3f4f6"
};

// Resolve a calendar color from widget JSON to a usable CSS color string.
function resolveColor(c) {
  if (!c) return "";
  const key = String(c).trim().toLowerCase().replace(/\s+/g, "");
  return NAMED_COLORS[key] || String(c).trim();
}

module.exports = {
  // Hourly weather by zip: next N hours with temp/rain/icon data
  weatherhourly: async (cfg) => {
    let lat = cfg.lat, lon = cfg.lon, locName = cfg.title || "";
    if (cfg.zip) {
      const z = await module.exports.geocode(cfg);
      lat = z.lat; lon = z.lon; locName = z.name;
    }
    const hours = Math.min(24, cfg.hours || 12);
    return cached(`wxh:${lat},${lon},${cfg.unit},${hours}`, 15 * 60e3, async () => {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&hourly=temperature_2m,precipitation_probability,weather_code&forecast_hours=${hours}` +
        `&timezone=auto&temperature_unit=${cfg.unit === "F" ? "fahrenheit" : "celsius"}`;
      const d = await (await fetch(u)).json();
      return { location: locName,
        hours: d.hourly.time.map((t, i) => ({
          label: new Date(t).toLocaleTimeString([], { hour: "numeric" }),
          temp: Math.round(d.hourly.temperature_2m[i]),
          rain: d.hourly.precipitation_probability[i],
          desc: WMO[d.hourly.weather_code[i]] || "" })) };
    });
  },

  // Multi-league/multi-team scoreboard. cfg.picks = [{league:"mlb",team:"Braves"},{league:"nhl"}]
  multisports: async (cfg) => {
    const picks = (cfg.picks && cfg.picks.length) ? cfg.picks : [{ league: cfg.league || "mlb", team: cfg.team }];
    const byLeague = {};
    picks.forEach(p => {
      const lg = (p.league || "mlb").toLowerCase();
      (byLeague[lg] = byLeague[lg] || []).push((p.team || "").toLowerCase());
    });
    const out = [];
    for (const lg of Object.keys(byLeague)) {
      const p = LEAGUES[lg] || LEAGUES.mlb;
      const d = await cached(`sb:${lg}`, 2 * 60e3, async () =>
        (await fetch(`https://site.api.espn.com/apis/site/v2/sports/${p}/scoreboard`)).json());
      const teams = byLeague[lg].filter(Boolean);
      (d.events || []).forEach(e => {
        const comp = e.competitions[0].competitors;
        const home = comp.find(x => x.homeAway === "home"), away = comp.find(x => x.homeAway === "away");
        const names = [home.team.shortDisplayName, home.team.abbreviation,
                       away.team.shortDisplayName, away.team.abbreviation].map(s => (s || "").toLowerCase());
        if (teams.length && !teams.some(t => names.some(n => n.includes(t)))) return;
        let link = "";
        if (e.links && e.links.length) {
          const pick = e.links.find(l => (l.rel || []).includes("summary")) || e.links[0];
          link = pick ? pick.href : "";
        }
        out.push({ league: lg.toUpperCase(),
          status: e.status.type.shortDetail, live: e.status.type.state === "in",
          final: e.status.type.state === "post", link,
          home: { abbr: home.team.abbreviation, score: home.score || "0", logo: home.team.logo || "" },
          away: { abbr: away.team.abbreviation, score: away.score || "0", logo: away.team.logo || "" } });
      });
    }
    return out.slice(0, cfg.max || 10);
  },

  // Team list per league (feeds the admin dropdown picker)
  teams: (cfg) => cached("teams:" + cfg.league, 86400e3, async () => {
    const p = LEAGUES[(cfg.league || "mlb").toLowerCase()] || LEAGUES.mlb;
    const d = await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/${p}/teams?limit=200`)).json();
    const list = ((d.sports || [])[0]?.leagues || [])[0]?.teams || [];
    return list.map(t => ({ name: t.team.displayName, abbr: t.team.abbreviation }));
  }),

  // YouTube channel: last N videos via public RSS (no API key). cfg.channel = channel_id or @handle
  youtubeRss: (cfg) => cached("yt:" + cfg.channel, 30 * 60e3, async () => {
    let id = cfg.channel || "";
    if (id.startsWith("@") || !/^UC[\w-]{20,}$/.test(id)) { // resolve handle/custom name
      const html = await (await fetch(`https://www.youtube.com/${id.startsWith("@") ? id : "@" + id}`,
        { headers: { "User-Agent": "Mozilla/5.0" } })).text();
      const m = html.match(/"channelId":"(UC[\w-]+)"/);
      if (!m) throw new Error("Could not resolve channel. Use the channel_id (starts with UC).");
      id = m[1];
    }
    const feed = await rss.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`);
    return feed.items.slice(0, cfg.max || 10).map(v => {
      const vid = (v.id || "").split(":").pop();
      return { title: v.title, id: vid, thumb: `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`, date: v.pubDate };
    });
  }),

  // Home Assistant entity states (car data etc.). cfg: { url, token, entities: ["sensor.car_fuel", ...] }
  hass: async (cfg) => {
    if (!cfg.url || !cfg.token || !cfg.entities) throw new Error("Set url, token, entities in config");
    const out = [];
    for (const ent of cfg.entities) {
      try {
        const d = await (await fetch(`${cfg.url.replace(/\/$/, "")}/api/states/${ent}`,
          { headers: { Authorization: "Bearer " + cfg.token } })).json();
        out.push({ entity: ent, name: (d.attributes || {}).friendly_name || ent,
          state: d.state, unit: (d.attributes || {}).unit_of_measurement || "",
          icon: (d.attributes || {}).icon || "" });
      } catch (e) { out.push({ entity: ent, name: ent, state: "error", unit: "" }); }
    }
    return out;
  },

  weather: async (cfg) => {
    let lat = cfg.lat, lon = cfg.lon, locName = cfg.title || "";
    if (cfg.zip) {
      const z = await zipLookup(cfg.zip, cfg.country);
      lat = z.lat; lon = z.lon; locName = z.name;
    }
    const fd = Math.min(16, cfg.forecast_days || 5);
    return cached(`wx:${lat},${lon},${cfg.unit},${fd}`, 10 * 60e3, async () => {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m` +
        `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max` +
        `&forecast_days=${fd}&timezone=auto` +
        `&temperature_unit=${cfg.unit === "F" ? "fahrenheit" : "celsius"}`;
      const d = await (await fetch(u)).json();
      return {
        location: locName, zip: cfg.zip || null, lat, lon,
        temp: Math.round(d.current.temperature_2m),
        desc: WMO[d.current.weather_code] || "-",
        humidity: d.current.relative_humidity_2m,
        wind: d.current.wind_speed_10m,
        forecast: d.daily.time.slice(0, fd).map((t, i) => ({
          day: new Date(t + "T12:00:00").toLocaleDateString("en", { weekday: "short" }),
          date: new Date(t + "T12:00:00").toLocaleDateString("en", { month: "short", day: "numeric" }),
          hi: Math.round(d.daily.temperature_2m_max[i]),
          lo: Math.round(d.daily.temperature_2m_min[i]),
          rain: d.daily.precipitation_probability_max ? d.daily.precipitation_probability_max[i] : null,
          desc: WMO[d.daily.weather_code[i]] || ""
        }))
      };
    });
  },

  geocode: async (cfg) => cfg.zip ? await zipLookup(cfg.zip, cfg.country)
    : { lat: cfg.lat || 40.7, lon: cfg.lon || -74, name: cfg.title || "" },

  calendar: (cfg) => cached(`cal:${cfg.url}:${cfg.days}:${cfg.max}`, 5 * 60e3, async () => {
    const events = await ical.async.fromURL(cfg.url);
    const now = Date.now(), horizon = now + (cfg.days || 14) * 86400e3;
    return Object.values(events)
      .filter(e => e.type === "VEVENT" && e.start && e.start.getTime() < horizon &&
                   (e.end ? e.end.getTime() : e.start.getTime()) > now - 3600e3)
      .sort((a, b) => a.start - b.start)
      .slice(0, cfg.max || 10)
      .map(e => ({ title: e.summary, start: e.start, allday: e.datetype === "date" }));
  }),

  // Clock + Timeline widget: digital clock + a horizontal "day bar" that fills as the
  // day progresses, with events from one or more ICS calendars plotted along it and a
  // live countdown to the next (or current) event. cfg.calendars = [{url,name,color}, ...]
  // (cfg.url/title/color also accepted as a single-calendar shorthand for consistency
  // with the plain `calendar` widget). Recurring events (RRULE, incl. EXDATE and
  // RECURRENCE-ID overrides) are expanded using the rrule instance node-ical attaches
  // to each event, unlike the basic `calendar` widget above.
  clocktimeline: (cfg) => {
    const cals = (cfg.calendars && cfg.calendars.length) ? cfg.calendars
      : (cfg.url ? [{ url: cfg.url, name: cfg.title || "Calendar", color: cfg.color }] : []);
    // Cache key MUST include the full calendar configs (names + colors), not just
    // the URLs: two widgets (e.g. clocktimeline and clocktimeline_alt) can point at
    // the same calendars with different names/colors, and a URL-only key made the
    // second widget reuse the first widget's cached events — colors and all.
    return cached(`ctl:${JSON.stringify(cals)}:${cfg.horizonHours || ""}`, 5 * 60e3, async () => {
      if (!cals.length) throw new Error("Add at least one calendar: { calendars: [{ url, name, color }] }");
      const palette = ["#3d9be9", "#e8760e", "#4caf50", "#e91e63", "#9c27b0", "#ffc107", "#00bcd4"];
      const now = new Date();
      const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 86400e3);
      const horizon = new Date(now.getTime() + (cfg.horizonHours || 72) * 3600e3);
      const events = [];

      const addEvent = (start, end, title, allDay, name, color) => {
        if (!start || !end || end.getTime() <= dayStart.getTime() || start.getTime() >= horizon.getTime()) return;
        events.push({ title: title || "(untitled)", start: start.toISOString(), end: end.toISOString(),
          allDay: !!allDay, cal: name, color });
      };

      for (let i = 0; i < cals.length; i++) {
        const c = cals[i] || {};
        const color = resolveColor(c.color) || palette[i % palette.length];
        const name = c.name || c.title || `Calendar ${i + 1}`;
        try {
          const data = await ical.async.fromURL(c.url);
          Object.values(data).forEach(e => {
            if (e.type !== "VEVENT" || !e.start) return;
            const allDay = e.datetype === "date";
            if (e.rrule) {
              let occurrences = [];
              try { occurrences = e.rrule.between(dayStart, horizon, true); } catch (err) { occurrences = []; }
              const duration = (e.end ? e.end.getTime() : e.start.getTime() + 3600e3) - e.start.getTime();
              occurrences.forEach(d => {
                const key = d.toISOString().slice(0, 10);
                if (e.exdate && e.exdate[key]) return;
                let start = d, title = e.summary;
                if (e.recurrences && e.recurrences[key]) {
                  const rec = e.recurrences[key];
                  start = rec.start || d; title = rec.summary || title;
                }
                addEvent(start, new Date(start.getTime() + duration), title, allDay, name, color);
              });
            } else {
              addEvent(e.start, e.end || e.start, e.summary, allDay, name, color);
            }
          });
        } catch (err) {
          // Keep the warning visible for the rest of the day (not just the instant it failed).
          addEvent(now, dayEnd, `\u26a0 ${name}: failed to load`, true, name, "#b23b3b");
        }
      }
      events.sort((a, b) => new Date(a.start) - new Date(b.start));
      return { now: now.toISOString(), dayStart: dayStart.toISOString(), dayEnd: dayEnd.toISOString(),
        events: events.slice(0, cfg.max || 60) };
    });
  },

  // Multi-view calendar widget ("calendarmulti"): accepts any number of ICS feeds
  // (cfg.calendars = [{url, name, color}, ...]) — built for 5+, no hard limit. Each
  // feed is color-coded with the same named-color list (resolveColor) as the
  // clocktimeline widgets. The client renders day / 3-day / 7-day / 2-week /
  // month / 3-month views (cfg.defaultView picks the initial one) from a single
  // payload, so the horizon must cover the widest view (3 months ≈ 93 days) plus
  // look-back for month boxes that begin before today. Reuses the same
  // RRULE / EXDATE / RECURRENCE-ID expansion as clocktimeline above.
  calendarmulti: (cfg) => {
    const cals = (cfg.calendars && cfg.calendars.length) ? cfg.calendars
      : (cfg.url ? [{ url: cfg.url, name: cfg.title || "Calendar", color: cfg.color }] : []);
    // Cache key MUST include the full calendar configs (names + colors), not just
    // the URLs — same reason as clocktimeline: URL-only keys made two widgets
    // pointing at the same feeds reuse each other's cached names/colors.
    return cached(`calmulti:${JSON.stringify(cals)}`, 5 * 60e3, async () => {
      if (!cals.length) throw new Error("Add at least one calendar: { calendars: [{ url, name, color }] }");
      const palette = ["#3d9be9", "#e8760e", "#4caf50", "#e91e63", "#9c27b0", "#ffc107", "#00bcd4"];
      const now = new Date();
      const lookBack = new Date(now); lookBack.setDate(lookBack.getDate() - 31);
      const horizon = new Date(now); horizon.setDate(horizon.getDate() + 93);
      const warnEnd = new Date(now); warnEnd.setHours(23, 59, 59, 999);
      const events = [];

      const addEvent = (start, end, title, allDay, name, color) => {
        if (!start || !end || end.getTime() <= lookBack.getTime() || start.getTime() >= horizon.getTime()) return;
        events.push({ title: title || "(untitled)", start: start.toISOString(), end: end.toISOString(),
          allDay: !!allDay, cal: name, color });
      };

      for (let i = 0; i < cals.length; i++) {
        const c = cals[i] || {};
        const color = resolveColor(c.color) || palette[i % palette.length];
        const name = c.name || c.title || `Calendar ${i + 1}`;
        try {
          const data = await ical.async.fromURL(c.url);
          Object.values(data).forEach(e => {
            if (e.type !== "VEVENT" || !e.start) return;
            const allDay = e.datetype === "date";
            if (e.rrule) {
              let occurrences = [];
              try { occurrences = e.rrule.between(lookBack, horizon, true); } catch (err) { occurrences = []; }
              const duration = (e.end ? e.end.getTime() : e.start.getTime() + 3600e3) - e.start.getTime();
              occurrences.forEach(d => {
                const key = d.toISOString().slice(0, 10);
                if (e.exdate && e.exdate[key]) return;
                let start = d, title = e.summary;
                if (e.recurrences && e.recurrences[key]) {
                  const rec = e.recurrences[key];
                  start = rec.start || d; title = rec.summary || title;
                }
                addEvent(start, new Date(start.getTime() + duration), title, allDay, name, color);
              });
            } else {
              addEvent(e.start, e.end || e.start, e.summary, allDay, name, color);
            }
          });
        } catch (err) {
          // Keep the warning visible for the rest of the day (not just the instant it failed).
          addEvent(now, warnEnd, `\u26a0 ${name}: failed to load`, true, name, "#b23b3b");
        }
      }
      events.sort((a, b) => new Date(a.start) - new Date(b.start));
      return {
        now: now.toISOString(),
        // Echo back the resolved feed list so the client legend chips show the
        // same names/colors the events carry.
        calendars: cals.map((c, i) => ({
          name: c.name || c.title || `Calendar ${i + 1}`,
          color: resolveColor(c.color) || palette[i % palette.length]
        })),
        events: events.slice(0, cfg.max || 600)
      };
    });
  },

  news: (cfg) => cached(`rss:${cfg.url}`, 10 * 60e3, async () => {
    const feed = await rss.parseURL(cfg.url);
    return { title: cfg.title || feed.title,
      items: feed.items.slice(0, cfg.max || 6).map(i => ({ title: i.title, link: i.link, date: i.pubDate })) };
  }),

  // Full-panel visual news with images + links (NYT/BBC/etc.)
  newsvisual: (cfg) => cached(`rssv:${cfg.url}`, 10 * 60e3, async () => {
    const feed = await rssImg.parseURL(cfg.url);
    return { title: cfg.title || feed.title,
      items: feed.items.slice(0, cfg.max || 8).map(i => {
        let img = "";
        if (i.enc && i.enc.url) img = i.enc.url;
        else if (i.media && i.media.$ && i.media.$.url) img = i.media.$.url;
        else if (i.thumb && i.thumb.$ && i.thumb.$.url) img = i.thumb.$.url;
        if (!img) {
          const m = (i.contentFull || i.content || "").match(/<img[^>]+src="([^"]+)"/);
          if (m) img = m[1];
        }
        return { title: i.title, img, link: i.link || "", date: i.pubDate };
      })
    };
  }),

  stocks: (cfg) => cached(`stk2:${cfg.symbols}`, 5 * 60e3, async () => {
    const syms = cfg.symbols.split(",").map(s => s.trim()).filter(Boolean);
    const out = [];
    for (const s of syms) {
      try {
        const sym = s.replace(/\.us$/i, "").toUpperCase();
        const d = await (await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1mo&interval=1d`,
          { headers: { "User-Agent": "Mozilla/5.0" } })).json();
        const r = d.chart && d.chart.result && d.chart.result[0];
        if (!r) { out.push({ symbol: sym, error: "no data" }); continue; }
        const closes = (r.indicators.quote[0].close || []).filter(v => v != null);
        const price = r.meta.regularMarketPrice != null ? r.meta.regularMarketPrice : closes[closes.length - 1];
        const prev = r.meta.chartPreviousClose || closes[closes.length - 2] || price;
        out.push({ symbol: sym, price: +(+price).toFixed(2),
          change: +(((price - prev) / prev) * 100).toFixed(2), spark: closes });
      } catch (e) { out.push({ symbol: s, error: e.message }); }
    }
    return out;
  }),

  quote: () => cached("quote", 60 * 60e3, async () => {
    const d = await (await fetch("https://zenquotes.io/api/random")).json();
    return { text: d[0].q, author: d[0].a };
  }),

  // Sports with logos + gamecast/highlights link
  sports: (cfg) => cached(`sp:${cfg.league}:${cfg.team || ""}`, 2 * 60e3, async () => {
    const p = LEAGUES[(cfg.league || "mlb").toLowerCase()] || LEAGUES.mlb;
    const d = await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/${p}/scoreboard`)).json();
    let games = (d.events || []).map(e => {
      const comp = e.competitions[0].competitors;
      const home = comp.find(x => x.homeAway === "home"), away = comp.find(x => x.homeAway === "away");
      let link = "";
      if (e.links && e.links.length) {
        const pick = e.links.find(l => (l.rel || []).includes("summary")) ||
                     e.links.find(l => (l.rel || []).includes("desktop")) || e.links[0];
        link = pick ? pick.href : "";
      }
      return {
        status: e.status.type.shortDetail,
        live: e.status.type.state === "in",
        final: e.status.type.state === "post",
        link,
        home: { team: home.team.shortDisplayName, abbr: home.team.abbreviation,
                score: home.score || "0", logo: home.team.logo || "" },
        away: { team: away.team.shortDisplayName, abbr: away.team.abbreviation,
                score: away.score || "0", logo: away.team.logo || "" }
      };
    });
    if (cfg.team) {
      const t = cfg.team.toLowerCase();
      const mine = games.filter(g => [g.home.team, g.home.abbr, g.away.team, g.away.abbr]
        .some(s => (s || "").toLowerCase().includes(t)));
      if (mine.length) games = mine;
    }
    return { league: (cfg.league || "mlb").toUpperCase(), games: games.slice(0, cfg.max || 6) };
  }),

  recipe: (cfg) => {
    const day = Math.floor(Date.now() / 86400e3);
    const diet = (cfg.diet || "carnivore").toLowerCase();
    return cached(`rcp:${diet}:${day}`, 6 * 3600e3, async () => {
      const cats = diet === "vegetarian" ? ["Vegetarian"]
        : diet === "vegan" ? ["Vegan"]
        : ["Beef", "Chicken", "Pork", "Lamb", "Seafood"];
      const cat = cats[day % cats.length];
      const list = (await (await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?c=${cat}`)).json()).meals;
      const pick = list[day % list.length];
      const full = (await (await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${pick.idMeal}`)).json()).meals[0];
      const ingredients = [];
      for (let i = 1; i <= 20 && ingredients.length < 8; i++) {
        const ing = full[`strIngredient${i}`];
        if (ing && ing.trim()) ingredients.push(`${ing}${full[`strMeasure${i}`] ? " - " + full[`strMeasure${i}`].trim() : ""}`);
      }
      return { title: full.strMeal, img: full.strMealThumb, category: cat,
        area: full.strArea, url: full.strSource || full.strYoutube || "", ingredients };
    });
  },

  gphotos: (cfg) => cached(`gp:${cfg.album}`, 6 * 3600e3, async () => {
    const html = await (await fetch(cfg.album, { redirect: "follow" })).text();
    const urls = [...new Set(html.match(/https:\/\/lh3\.googleusercontent\.com\/pw\/[a-zA-Z0-9\-_]+/g) || [])];
    if (!urls.length) throw new Error("No photos found - make sure this is a public shared-album link");
    return urls.slice(0, cfg.max || 50).map(u => u + "=w1920-h1080");
  }),

  lakelevel: (cfg) => cached(`lake:${cfg.site || "04294500"}`, 30 * 60e3, async () => {
    const site = cfg.site || "04294500";
    const param = cfg.param || "62614";
    const iv = await (await fetch(
      `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${site}&parameterCd=${param}`)).json();
    const ts = iv.value.timeSeries[0];
    const vals = ts.values[0].value;
    const level = +vals[vals.length - 1].value;
    let history = [];
    try {
      const dv = await (await fetch(
        `https://waterservices.usgs.gov/nwis/dv/?format=json&sites=${site}&parameterCd=${param}&period=P7D`)).json();
      history = dv.value.timeSeries[0].values[0].value
        .map(v => ({ date: v.dateTime.slice(5, 10), level: +v.value }));
    } catch {}
    return { name: ts.sourceInfo.siteName, level, unit: "ft",
             flood: cfg.flood || 100, history };
  }),

  joke: () => cached("joke:" + Math.floor(Date.now() / 86400e3), 12 * 3600e3, async () => {
    const r = await fetch("https://icanhazdadjoke.com/",
      { headers: { Accept: "application/json", "User-Agent": "MangoDash (self-hosted family dashboard)" } });
    if (!r.ok) throw new Error("joke service HTTP " + r.status);
    const d = await r.json();
    if (!d.joke) throw new Error("joke service returned no joke");
    return { id: d.id, text: d.joke };
  }),

  // Top 10 movies. kind: "theater" (now playing) | "streaming" (flatrate digital only)
  movies: (cfg) => cached("tmdb:" + (cfg.kind || "theater"), 6 * 3600e3, async () => {
    const key = process.env.TMDB_API_KEY;
    if (!key) throw new Error("Add TMDB_API_KEY to .env (free key at themoviedb.org)");
    const url = cfg.kind === "streaming"
      ? `https://api.themoviedb.org/3/discover/movie?api_key=${key}&watch_region=US&with_watch_monetization_types=flatrate&sort_by=popularity.desc&include_adult=false`
      : `https://api.themoviedb.org/3/movie/now_playing?api_key=${key}&region=US`;
    const d = await (await fetch(url)).json();
    if (!d.results) throw new Error(d.status_message || "TMDB error");
    return d.results.slice(0, 10).map(m => ({
      id: m.id, title: m.title,
      poster: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : "",
      rating: (m.vote_average || 0).toFixed(1), year: (m.release_date || "").slice(0, 4) }));
  }),

   trailer: (cfg) => cached("tmdbtr:" + cfg.id, 86400e3, async () => {
     const key = process.env.TMDB_API_KEY;
     const d = await (await fetch(`https://api.themoviedb.org/3/movie/${cfg.id}/videos?api_key=${key}`)).json();
     const v = (d.results || []).find(x => x.site === "YouTube" && x.type === "Trailer") || (d.results || [])[0];
     return { key: v ? v.key : null };
   }),

  // YouTube widget: live stream or latest videos from a channel or playlist
  youtube: (cfg) => cached(`yt:${cfg.mode||'latest'}:${cfg.channelId||''}:${cfg.playlistId||''}:${cfg.max||10}`, 5 * 60e3, async () => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error("Add YOUTUBE_API_KEY to .env (YouTube Data API v3)");
    const max = cfg.max || 10;
    if (cfg.mode === "live") {
      if (!cfg.channelId) throw new Error("channelId required for live mode");
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(cfg.channelId)}&eventType=live&type=video&key=${apiKey}`;
      const d = await (await fetch(url)).json();
      if (!d.items || d.items.length === 0) return { mode: "live", live: false };
      const videoId = d.items[0].id.videoId;
      return { mode: "live", videoId };
    } else {
      // latest videos from channel or playlist
      let url;
      if (cfg.playlistId) {
        url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${max}&playlistId=${encodeURIComponent(cfg.playlistId)}&key=${apiKey}`;
      } else if (cfg.channelId) {
        url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(cfg.channelId)}&maxResults=${max}&order=date&type=video&key=${apiKey}`;
      } else {
        throw new Error("YouTube widget requires channelId or playlistId");
      }
      const d = await (await fetch(url)).json();
      const items = (d.items || []).map(item => {
        const videoId = item.id?.videoId || item.snippet?.resourceId?.videoId;
        return {
          videoId,
          title: item.snippet.title,
          thumb: item.snippet.thumbnails?.medium?.url,
          publishedAt: item.snippet.publishedAt,
        };
      });
      return { mode: "list", items };
    }
  }),

  // Simple iframe based Spotify player (no API)
  spotify_iframe: async (cfg) => {
    // cfg.url can be any Spotify embed link; default to Top Hits playlist
    const url = cfg?.url || "https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M";
    return { embedUrl: url };
  },
  // Helper to clear the server‑side cache (useful during troubleshooting)
  clearCache: () => {
    cache.clear();
    return { ok: true };
  }
};