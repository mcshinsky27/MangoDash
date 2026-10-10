// ================= Device identity & pairing =================
let deviceId = localStorage.getItem("mango-device");
if (!deviceId) {
  deviceId = Math.random().toString(36).slice(2, 10).toUpperCase();
  localStorage.setItem("mango-device", deviceId);
}
document.getElementById("devid").textContent = deviceId;

const gridEl = document.getElementById("grid");
const MOBILE = window.matchMedia("(max-width: 700px)").matches;
const PADDING = 12;
let gs = null;
let timers = [];
let pageTimer = null;
// Global media playback flags used by page rotation logic
window.spotifyPlaying = false;
window.youtubePlaying = false;
let saveDebounce = null;
let dashData = null;
let dashTheme = "dark";
let pageIdx = 0;
let dirtyPageRef = null;

// ---------------------------------------------------------------------------
// YouTube Iframe API loader – shared by all YouTube player widgets.
// Returns a promise that resolves with the global YT object once the API is
// ready. Subsequent calls reuse the same promise.
// ---------------------------------------------------------------------------
let ytApiReady = null;
function loadYouTubeAPI() {
  if (ytApiReady) return ytApiReady;
  ytApiReady = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
    } else {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstTag = document.getElementsByTagName('script')[0];
      firstTag.parentNode.insertBefore(tag, firstTag);
      window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    }
  });
  return ytApiReady;
}

async function post(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body || {})
  });
  return r.json();
}
const get = url => fetch(url).then(r => r.json());
const dev = p => `/api/display/${deviceId}/${p}`;
const api = (url, body) => post(url, body);

async function submitPair() {
  const code = document.getElementById("paircode").value.trim();
  const r = await post("/api/device/register", { id: deviceId, pair_code: code });
  if (r.paired) { document.getElementById("pairing").classList.add("hidden"); refresh(); }
  else alert("Invalid pair code.");
}

function normalizeLayout(raw) {
  let l;
  if (Array.isArray(raw)) l = { v: 2, pages: [{ name: "Page 1", secs: 0, widgets: raw }] };
  else if (raw && Array.isArray(raw.pages) && raw.pages.length) l = raw;
  else l = { v: 2, pages: [{ name: "Page 1", secs: 0, widgets: [] }] };
  l.pages.forEach((p, i) => { if (!p.id) p.id = "pg" + i; });
  return l;
}

let MEMBERS = [];
async function loadMembers() { try { MEMBERS = await get(dev("members")); } catch {} }
const member = id => MEMBERS.find(m => m.id === id) || { name: "?", color: "#888", avatar: "?" };
function pinPrompt(cb) { cb(prompt("Enter your PIN (blank if none):") || ""); }

function sparkline(values, w, h, color) {
  if (!values || values.length < 2) return "";
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const pts = values.map((v, i) =>
    `${(i / (values.length - 1) * w).toFixed(1)},${(h - (v - min) / range * h).toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="spark">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
}
function detectCarrier(num) {
  const n = (num || "").replace(/\s/g, "").toUpperCase();
  if (/^1Z/.test(n)) return { name: "UPS", color: "#8a5a00" };
  if (/^(9[2-5]\d{18,24}|420\d+)$/.test(n) || /^\d{20,22}$/.test(n)) return { name: "USPS", color: "#2a5db0" };
  if (/^\d{12}$/.test(n) || /^\d{15}$/.test(n)) return { name: "FedEx", color: "#5a2d82" };
  return { name: "?", color: "#666" };
}
function trailerOverlay(ytKey) {
  const o = document.createElement("div");
  o.className = "trailer-overlay";
  o.innerHTML = `<div class="trailer-box">
    <iframe src="https://www.youtube.com/embed/${ytKey}?autoplay=1" allow="autoplay; fullscreen"></iframe>
    <button class="trailer-close">CLOSE X</button></div>`;
  o.querySelector(".trailer-close").onclick = () => o.remove();
  document.body.appendChild(o);
}

// ---------------------------------------------------------------------------
// Clock + Timeline shared renderer (used by clocktimeline and clocktimeline_alt).
// Events on the day bar are packed into dynamic lanes (rows): each event is
// assigned the first row where it does not visually overlap any other event.
// Lane packing is computed from the RENDERED extents (left% / right%, which
// include the minimum marker width) — not just the raw times — so markers can
// never overlap on screen. The track grows to fit however many rows are needed.
// ---------------------------------------------------------------------------
function renderClockTimeline(el, data, cfg, isAlt = false) {
  const now = new Date();
  const fmtHM = d => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const fmtCountdown = ms => {
    ms = Math.max(0, ms);
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  };

  el.classList.toggle("ctl-compact", el.clientHeight > 0 && el.clientHeight < 170);
  const clockHtml = `<div class="ctl-clock">${fmtHM(now)}</div>
    <div class="ctl-date">${now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</div>`;

  if (!data) return `<div class="ctl-wrap"><div class="ctl-head"><div>${clockHtml}</div></div><div class="ctl-empty">Loading...</div></div>`;

  const dayStart = new Date(data.dayStart), dayEnd = new Date(data.dayEnd);
  const events = (data.events || []).map(e => ({ ...e, start: new Date(e.start), end: new Date(e.end) }));

  const current = events.find(e => !e.allDay && e.start <= now && e.end > now);
  const upcoming = events.filter(e => e.start > now).sort((a, b) => a.start - b.start)[0];
  let nextHtml = `<div class="ctl-next${current ? " ctl-now" : ""}">`;
  if (current) {
    nextHtml += `<div class="ctl-next-label">Happening now</div><div class="ctl-next-title">${current.title}</div><div class="ctl-next-count${isAlt ? " ctl-next-flash" : ""}">${fmtCountdown(current.end - now)} left</div>`;
  } else if (upcoming) {
    nextHtml += `<div class="ctl-next-label">Up next</div><div class="ctl-next-title">${upcoming.title}</div><div class="ctl-next-count">in ${fmtCountdown(upcoming.start - now)}</div>`;
  } else {
    nextHtml += `<div class="ctl-next-label">Up next</div><div class="ctl-next-title">No more events</div>`;
  }
  nextHtml += `</div>`;

  // ---- Day bar: dynamic non-overlapping lane (row) packing ----
  const dayMs = dayEnd - dayStart;
  const pctOfDay = ms => Math.min(100, Math.max(0, (ms / dayMs) * 100));
  const fillPct = pctOfDay(now - dayStart);

  const LANE_TOP = 6;    // px padding above first row
  const LANE_H = 12;     // marker height (matches .ctl-marker height in dash.css)
  const LANE_GAP = 4;    // px vertical gap between rows
  const LANE_STEP = LANE_H + LANE_GAP;
  const MIN_GAP_PCT = 0.25; // horizontal breathing room so adjacent markers never touch

  // Compute the rendered extent of every event that touches today.
  const todays = events
    .filter(e => e.end > dayStart && e.start < dayEnd)
    .map(e => {
      const s = Math.max(e.start.getTime(), dayStart.getTime());
      const en = Math.min(e.end.getTime(), dayEnd.getTime());
      const left = pctOfDay(s - dayStart);
      const width = Math.max(pctOfDay(en - s), e.allDay ? 2 : 0.8); // enforce min visual width
      return { ev: e, left, width, right: Math.min(100, left + width), lane: 0 };
    });

  // First-fit packing: sort by left edge (wider first on ties), then drop each
  // event into the first lane whose right-most marker ends before this one starts.
  todays.sort((a, b) => a.left - b.left || b.width - a.width);
  const laneRightEdge = []; // per-lane right-most rendered edge (in %)
  todays.forEach(item => {
    let lane = 0;
    while (lane < laneRightEdge.length && item.left < laneRightEdge[lane] + MIN_GAP_PCT) lane++;
    laneRightEdge[lane] = item.right;
    item.lane = lane;
  });
  const laneCount = Math.max(1, laneRightEdge.length);
  const trackHeight = LANE_TOP * 2 + laneCount * LANE_STEP - LANE_GAP;

  const markers = todays.map(({ ev: e, left, width, lane }) => {
    const categoryClass = e.category ? `ctl-category-${e.category}` : '';
    const isCurrent = !e.allDay && e.start <= now && e.end > now;
    const flashClass = (isAlt && isCurrent) ? " ctl-event-flash" : "";
    const top = LANE_TOP + lane * LANE_STEP;
    const tip = e.allDay ? `${e.title} (all day)` : `${e.title} (${fmtHM(e.start)}\u2013${fmtHM(e.end)})`;
    return `<div class="ctl-marker ${categoryClass}${flashClass}" style="left:${left}%; width:${width}%; top:${top}px; background:${e.color || '#3d9be9'}" title="${tip}">
      <span class="ctl-marker-label">${e.title}</span>
    </div>`;
  }).join("");

  const w = el.clientWidth || 400;
  const step = w < 260 ? 6 : w < 420 ? 4 : w < 650 ? 3 : w < 900 ? 2 : 1;
  let ticksHtml = "";
  for (let h = 0; h <= 24; h += step) {
    const hh = ((h % 24) + 24) % 24;
    const label = hh === 0 ? "12A" : hh === 12 ? "12P" : hh < 12 ? `${hh}A` : `${hh - 12}P`;
    const left = (h / 24) * 100;
    ticksHtml += `<div class="ctl-tick" style="left:${left}%"><span class="ctl-tick-label" style="left:0">${label}</span></div>`;
  }

  const barHtml = `<div class="ctl-wrapper">
    <div class="ctl-track" style="min-height:${trackHeight}px">
      <div class="ctl-grid">${ticksHtml}</div>
      <div class="ctl-events">${markers}</div>
      <div class="ctl-fill" style="width:${fillPct}%"></div>
      <div class="ctl-now-dot" style="left:${fillPct}%"></div>
    </div>
  </div>`;

  const chipSource = events.filter(e => e.end > now || (e.allDay && e.end > dayStart)).slice(0, 12);
  const chipsHtml = chipSource.length ? chipSource.map(e => {
    const isCurrent = !e.allDay && e.start <= now && e.end > now;
    const when = e.allDay ? "All day" : `${fmtHM(e.start)}\u2013${fmtHM(e.end)}`;
    const delta = e.allDay ? "" : fmtCountdown(e.start - now);
    const titlePrefix = e.source === "task" ? "\ud83d\udcc5 " : "";
    return `<div class="ctl-chip${isCurrent ? " ctl-current" : ""}" style="--chip-color:${e.color || '#3d9be9'}">
      <span class="ctl-chip-time">${when}</span>
      <span class="ctl-chip-title">${titlePrefix}${e.title}</span>
      ${e.cal ? `<span class="ctl-chip-cal">${e.cal}</span>` : ""}
      ${!e.allDay ? `<span class="ctl-chip-delta">${delta}</span>` : ""}
    </div>`;
  }).join("") : `<div class="ctl-empty">No upcoming events.</div>`;

  return `<div class="ctl-wrap">
    <div class="ctl-head"><div>${clockHtml}</div>${nextHtml}</div>
    ${barHtml}
    <div class="ctl-chips">${chipsHtml}</div>
  </div>`;
}

// ================= Widget renderers =================
const R = {
  clock: (el) => {
    const tick = () => {
      const n = new Date();
      el.innerHTML = `<div class="clock-time">${n.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}</div>
        <div class="clock-date">${n.toLocaleDateString([], {weekday:"long",month:"long",day:"numeric"})}</div>`;
    };
    tick(); return setInterval(tick, 1000);
  },
  weather: (el, cfg) => {
    const load = async () => {
      const d = await api("/api/widget-data/weather", cfg);
      if (d.error) { el.innerHTML = `<small>Weather error: ${d.error}</small>`; return; }
      const title = d.location || cfg.title || (cfg.zip ? `ZIP ${cfg.zip}` : "Weather");
      el.innerHTML = `<h3 class="wx-title">&#9925; ${title}</h3>` +
        `<div class="wx-now"><span class="wx-temp">${d.temp}&deg;</span>
        <span class="wx-desc">${d.desc}<br>&#128167;${d.humidity}% &#128168;${d.wind}</span></div>
        <div class="wx-fc">${d.forecast.slice(0, 5).map(f =>
          `<div><b>${f.day}</b><br>${f.hi}&deg;/${f.lo}&deg;<br><small>${f.desc}</small></div>`).join("")}</div>`;
    };
    load(); return setInterval(load, 10 * 60e3);
  },
  weather10: (el, cfg) => {
    const load = async () => {
      const d = await api("/api/widget-data/weather", Object.assign({}, cfg, { forecast_days: 10 }));
      if (d.error) { el.innerHTML = `<small>Weather error: ${d.error}</small>`; return; }
      el.innerHTML = `<h3>&#128198; 10-Day ${d.location ? "- " + d.location : ""}</h3>` +
        d.forecast.map(f => `<div class="wx10-row">
          <span class="wx10-day"><b>${f.day}</b> <small>${f.date}</small></span>
          <span class="wx10-desc">${f.desc}</span>
          <span class="wx10-rain">${f.rain != null ? "&#128167;" + f.rain + "%" : ""}</span>
          <span class="wx10-temp"><b>${f.hi}&deg;</b> / ${f.lo}&deg;</span></div>`).join("");
    };
    load(); return setInterval(load, 30 * 60e3);
  },
  // Hourly weather widget – shows next N hours (default 12) in a compact horizontal layout
  weatherhourly: (el, cfg) => {
    const load = async () => {
      // The backend expects {zip, unit, hours} – hours defaults to 12, max 24
      const d = await api("/api/widget-data/weatherhourly", cfg);
      if (d.error) { el.innerHTML = `<small>Weather error: ${d.error}</small>`; return; }
      const title = d.location || cfg.title || (cfg.zip ? `ZIP ${cfg.zip}` : "Hourly Weather");
      // Build a simple horizontal grid of hour cells
      const cells = d.hours.map(h => `
        <div class="wxh-cell">
          <div class="wxh-time">${h.label}</div>
          <div class="wxh-temp">${h.temp}&deg;</div>
          ${h.rain != null ? `<div class="wxh-rain">&#128167;${h.rain}%</div>` : ``}
          <div class="wxh-desc">${h.desc}</div>
        </div>`).join('');
      el.innerHTML = `<h3>&#128198; ${title}</h3><div class="wxh-grid">${cells}</div>`;
    };
    load();
    // Refresh hourly data every 30 minutes (same interval as 10-day widget)
    return setInterval(load, 30 * 60e3);
  },
  weathermap: (el, cfg) => {
    api("/api/widget-data/geocode", cfg).then(g => {
      if (g.error) { el.innerHTML = `<small>${g.error}</small>`; return; }
      const overlay = cfg.overlay || "temp";
      el.innerHTML = `<iframe style="width:100%;height:100%;border:0;border-radius:10px"
        src="https://embed.windy.com/embed2.html?lat=${g.lat}&lon=${g.lon}&detailLat=${g.lat}&detailLon=${g.lon}&zoom=${cfg.zoom || 7}&overlay=${overlay}&level=surface&marker=true&menu=&message=true&type=map&location=coordinates&metricWind=mph&metricTemp=%C2%B0F"></iframe>`;
    });
  },
  calendar: (el, cfg) => {
    const load = async () => {
      const evs = await api("/api/widget-data/calendar", cfg);
      if (evs.error) { el.innerHTML = `<small>Calendar error</small>`; return; }
      el.innerHTML = `<h3>&#128197; ${cfg.title || "Calendar"}</h3>` + evs.map(e => {
        const d = new Date(e.start);
        return `<div class="cal-ev"><span class="cal-when">${d.toLocaleDateString([], {month:"short",day:"numeric"})}
          ${e.allday ? "" : d.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}</span> ${e.title}</div>`;
      }).join("");
    };
    load(); return setInterval(load, 5 * 60e3);
  },
  calendar3: (el, cfg) => {
    const load = async () => {
      const evs = await api("/api/widget-data/calendar", Object.assign({}, cfg, { days: 3, max: 60 }));
      if (evs.error) { el.innerHTML = "<small>Calendar error</small>"; return; }
      const days = [...Array(3)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });
      el.innerHTML = `<h3>&#128197; ${cfg.title || "Next 3 Days"}</h3><div class="cal3">` +
        days.map((day, i) => {
          const key = day.toDateString();
          const list = evs.filter(e => new Date(e.start).toDateString() === key);
          return `<div class="cal3-col"><div class="cal3-head">${i === 0 ? "Today"
            : day.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</div>` +
            (list.map(e => `<div class="cal3-ev">${e.allday ? "" :
              new Date(e.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " "}${e.title}</div>`)
              .join("") || `<small>&mdash;</small>`) + `</div>`;
        }).join("") + `</div>`;
    };
    load(); return setInterval(load, 5 * 60e3);
  },
  // Clock + Timeline: big digital clock, a horizontal day-progress bar plotting events
  // from one or more calendars, and a live "now/next" countdown. Sizing is fully
  // container-relative (see .ctl-* rules in dash.css) so it adapts to any widget size.
  clocktimeline: (el, cfg) => {
    let data = null, ticks = 0;
    const REFRESH_EVERY_TICKS = 300;
    const load = async () => {
      const d = await api("/api/widget-data/clocktimeline", cfg);
      if (d.error) { el.innerHTML = `<small>Calendar error: ${d.error}</small>`; return; }
      data = d;
      render();
    };
    const render = () => { el.innerHTML = renderClockTimeline(el, data, cfg); };
    load();
    return setInterval(() => {
      render();
      if (++ticks % REFRESH_EVERY_TICKS === 0) load();
    }, 1000);
  },
  // Clock Timeline Alt – enhanced version with event labels, lane stacking, up-next list, flashing, etc.
  clocktimeline_alt: (el, cfg) => {
    let data = null, ticks = 0;
    const REFRESH_EVERY_TICKS = 300;
    const load = async () => {
      const d = await api("/api/widget-data/clocktimeline", cfg);
      if (d.error) { el.innerHTML = `<small>Calendar error: ${d.error}</small>`; return; }
      data = d;
      render();
    };
    const render = () => { el.innerHTML = renderClockTimeline(el, data, cfg, true); };
    load();
    return setInterval(() => {
      render();
      if (++ticks % REFRESH_EVERY_TICKS === 0) load();
    }, 1000);
  },

    news: (el, cfg) => {
      const load = async () => {
        const d = await api("/api/widget-data/news", cfg);
        if (d.error) { el.innerHTML = `<small>News error: ${d.error}</small>`; return; }
        el.innerHTML = `<h3>&#128240; ${d.title || "News"}</h3>` +
          d.items.map(i => `<div class="news-item">${i.title}</div>`).join("");
      };
      load(); return setInterval(load, 10 * 60e3);
    },

  // Full-panel hero rotator: image + headline, click opens story, rotates every cfg.interval secs
  newsvisual: (el, cfg) => {
    let items = [], i = 0, ticks = 0;
    const show = () => {
      if (!items.length) return;
      const it = items[i % items.length];
      const n = (i % items.length) + 1;
      i++;
       el.innerHTML = `<div class="hero" style="background-image:url('${it.img || ""}')">
         <div class="hero-grad"></div>
         <div class="hero-src">${cfg.title || "News"}</div>
         <div class="hero-title">${it.title}</div>
         <div class="hero-count">${n} / ${items.length}</div>
         <div class="hero-nav">
           <div class="nav left" title="Previous">&#9664;</div>
           <div class="nav right" title="Next">&#9654;</div>
         </div>
       </div>`;
       const heroDiv = el.querySelector('.hero');
       heroDiv.onclick = () => { if (it.link) window.open(it.link, '_blank'); };
       const leftNav = heroDiv.querySelector('.nav.left');
       const rightNav = heroDiv.querySelector('.nav.right');
       if (leftNav) {
         leftNav.onclick = (e) => {
           e.stopPropagation();
           // Move back one item (i points to next index, so step back two positions)
           i = (i - 2 + items.length) % items.length;
           show();
         };
       }
       if (rightNav) {
         rightNav.onclick = (e) => {
           e.stopPropagation();
           // Forward to next item (same as auto rotate)
           show();
         };
       }
    };
    const load = async () => {
      const d = await api("/api/widget-data/newsvisual", cfg);
      if (d.error) { el.innerHTML = `<small>News error: ${d.error}</small>`; return; }
      const withImg = d.items.filter(x => x.img);
      items = withImg.length ? withImg : d.items;
      show();
    };
    load();
    return setInterval(() => {
      show();
      if (++ticks % 40 === 0) load();   // refresh feed every ~40 rotations
    }, (cfg.interval || 15) * 1000);
  },

  ticker: (el, cfg) => {
    const load = async () => {
      const d = await api("/api/widget-data/news", Object.assign({ max: 15 }, cfg));
      if (d.error) { el.innerHTML = `<small>Ticker error: ${d.error}</small>`; return; }
      if (!d.items || !d.items.length) { el.innerHTML = `<small>Ticker: feed returned no items</small>`; return; }
      const items = d.items.map(i => `<span class="tk-item">&#9679; ${i.title}</span>`).join("");
      el.innerHTML = `<div class="ticker-wrap"><div class="ticker-move">${items}${items}</div></div>`;
      el.querySelector(".ticker-move").style.animationDuration = (cfg.speed || 60) + "s";
    };
    load(); return setInterval(load, 10 * 60e3);
  },

  stocks: (el, cfg) => {
    const load = async () => {
      const d = await api("/api/widget-data/stocks", cfg);
      if (d.error) { el.innerHTML = `<small>Stocks error: ${d.error}</small>`; return; }
      el.innerHTML = `<h3>&#128200; Markets</h3>` + d.map(s => {
        if (s.error) return `<div class="stk2"><b>${s.symbol}</b> <small>${s.error}</small></div>`;
        const up = s.change >= 0;
        return `<div class="stk2 ${up ? "up" : "down"}">
          <span class="stk2-sym"><b>${s.symbol}</b></span>
          <span class="stk2-spark">${sparkline(s.spark, 120, 30, up ? "#4caf50" : "#ef5350")}</span>
          <span class="stk2-price">${s.price}<br><small>${up ? "&#9650;" : "&#9660;"}${Math.abs(s.change)}%</small></span>
        </div>`;
      }).join("");
    };
    load(); return setInterval(load, 5 * 60e3);
  },
  todo: (el, cfg) => {
    const load = async () => {
      const items = (await get(dev("todos"))).filter(t => t.list_name === (cfg.list || "default"));
      el.innerHTML = `<h3>&#9989; ${cfg.title || "To-Do"}</h3>` + items.map(t =>
        `<div class="todo ${t.done ? "done" : ""}">${t.done ? "&#9745;" : "&#9744;"} ${t.text}</div>`).join("");
    };
    load(); return setInterval(load, 60e3);
  },
  photos: (el, cfg) => {
    let list = [], i = 0;
    const next = () => { if (list.length)
      el.innerHTML = `<img class="photo" src="${dev("photo/" + encodeURIComponent(list[i++ % list.length]))}">`; };
    get(dev("photos")).then(l => { list = l; next(); });
    return setInterval(next, (cfg.interval || 15) * 1000);
  },
  gphotos: (el, cfg) => {
    let list = [], i = 0;
    const next = () => { if (list.length)
      el.innerHTML = `<img class="photo" src="${list[i++ % list.length]}">`; };
    api("/api/widget-data/gphotos", cfg).then(l => {
      if (Array.isArray(l)) { list = l; next(); }
      else el.innerHTML = `<small>${l.error || "Album error"}</small>`;
    });
    return setInterval(next, (cfg.interval || 15) * 1000);
  },
  docs: (el, cfg) => {
    const files = cfg.files && cfg.files.length ? cfg.files : (cfg.file ? [cfg.file] : []);
    if (!files.length) { el.innerHTML = "<small>Set file or files in config (upload in Admin &gt; Documents).</small>"; return; }
    let i = 0;
    const show = () => {
      const f = files[i++ % files.length];
      const url = dev("doc/" + encodeURIComponent(f));
      if (/\.(jpe?g|png|gif|webp)$/i.test(f))
        el.innerHTML = `<img class="photo" src="${url}">`;
        else
          // Add zoom parameter so PDFs fill the widget area (page-fit scales to both width and height)
          // Adjusted to remove extra border/padding for tighter fit within the widget
          el.innerHTML = `<iframe src="${url}#toolbar=0&navpanes=0&zoom=page-fit" style="width:100%;height:100%;border:none;box-sizing:border-box;"></iframe>`;
    };
    show();
    if (files.length > 1) return setInterval(show, (cfg.interval || 30) * 1000);
  },
  // Birthday countdown widget – displays up to 30 upcoming birthdays with days left
  birthdays: (el, cfg) => {
    // Expect cfg.people as an array of {name: string, date: string}
    // date can be "YYYY-MM-DD" or "MM-DD"
    const people = Array.isArray(cfg.people) ? cfg.people : [];
    const title = cfg.title || "Upcoming Birthdays";
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const msPerDay = 24 * 60 * 60 * 1000;
    const render = () => {
      if (!people.length) {
        el.innerHTML = `<h3>${title}</h3><small>No birthdays configured.</small>`;
        return;
      }
      const now = new Date();
      const utcNow = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
      const items = people.map(p => {
        const name = p.name || "?";
        const raw = (p.date || "").trim();
        if (!raw) return null;
        const parts = raw.split("-");
        let month, day, birthYear = null;
        if (parts.length === 3) {
          // YYYY-MM-DD format – capture birth year for age calculation
          birthYear = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10);
          day = parseInt(parts[2], 10);
        } else if (parts.length === 2) {
          month = parseInt(parts[0], 10);
          day = parseInt(parts[1], 10);
        } else {
          return null;
        }
        if (isNaN(month) || isNaN(day)) return null;
        // Calculate next birthday date
        const thisYear = now.getFullYear();
        let next = new Date(thisYear, month - 1, day);
        if (next < now) next.setFullYear(thisYear + 1);
        const utcNext = Date.UTC(next.getFullYear(), next.getMonth(), next.getDate());
        const diffDays = Math.round((utcNext - utcNow) / msPerDay);
        // Determine age if birth year known
        const age = birthYear !== null ? next.getFullYear() - birthYear : null;
        return {
          name,
          month,
          day,
          diffDays,
          age,
          displayDate: `${monthNames[month - 1]} ${day}`
        };
      }).filter(Boolean);
      if (!items.length) {
        el.innerHTML = `<h3>${title}</h3><small>No valid birthdays.</small>`;
        return;
      }
      // Sort by soonest upcoming
      items.sort((a, b) => a.diffDays - b.diffDays);
      const rendered = items.slice(0, 30).map(item => {
        const emoji = item.diffDays === 0 ? "🎉" : "🎂";
        const daysText = item.diffDays === 0 ? "Today!" : `${item.diffDays} day${item.diffDays === 1 ? "" : "s"} left`;
        const ageBadge = item.age !== null ? `<span class="bday-age">${item.age}</span>` : '';
        return `<div class="birthday-item">
          <div class="bday-name">${item.name}</div>
          <div class="bday-date">${item.displayDate}</div>
          ${ageBadge}
          <div class="bday-remaining">${emoji} ${daysText}</div>
        </div>`;
      }).join("");
      el.innerHTML = `<h3>${title}</h3><div class="birthday-list">${rendered}</div>`;
    };
    // Initial render
    render();
    // Refresh hourly to keep countdown accurate
    return setInterval(render, 60 * 60e3);
  },
  quote: (el) => {
    const load = async () => {
      const d = await api("/api/widget-data/quote", {});
      el.innerHTML = `<div class="quote">"${d.text}"<br><small>&mdash; ${d.author}</small></div>`;
    };
    load(); return setInterval(load, 60 * 60e3);
  },
  joke: (el) => {
    const load = async () => {
      const d = await api("/api/widget-data/joke", {});
      if (d.error) { el.innerHTML = `<small>Joke error: ${d.error}</small>`; return; }
      const rates = await get(dev("joke-rate/" + d.id));
      el.innerHTML = `<h3>&#128514; Joke of the Day</h3>
        <div class="joke-text">${d.text}</div>
        <div class="joke-rate">
          <button class="jr-up">&#128077; ${rates.up || 0}</button>
          <button class="jr-down">&#128078; ${rates.down || 0}</button>
        </div>`;
      el.querySelector(".jr-up").onclick = async () => {
        await post(dev("joke-rate"), { id: d.id, up: true }); load(); };
      el.querySelector(".jr-down").onclick = async () => {
        await post(dev("joke-rate"), { id: d.id, up: false }); load(); };
    };
    load(); return setInterval(load, 60 * 60e3);
  },
  coindice: (el) => {
    el.innerHTML = `<h3>&#127922; Coin &amp; Dice</h3>
      <div class="cd-result" id="cd-out">?</div>
      <div class="cd-btns">
        <button class="cd-coin">&#129689; Flip Coin</button>
        <button class="cd-die">&#127922; Roll Die</button>
      </div>`;
    const out = el.querySelector("#cd-out");
    const animate = (finalText, frames) => {
      let n = 0;
      const t = setInterval(() => {
        out.textContent = frames[n++ % frames.length];
        out.classList.add("cd-spin");
      }, 90);
      setTimeout(() => { clearInterval(t); out.classList.remove("cd-spin");
        out.textContent = finalText; }, 1400);
    };
    el.querySelector(".cd-coin").onclick = () =>
      animate(Math.random() < 0.5 ? "HEADS" : "TAILS", ["HEADS", "TAILS"]);
    el.querySelector(".cd-die").onclick = () =>
      animate(String(1 + Math.floor(Math.random() * 6)), ["1","2","3","4","5","6"]);
  },
  askhouse: (el) => {
    el.innerHTML = `<h3>&#129302; Ask the House</h3>
      <div class="ask-answer" id="ask-out">Ask me anything - homework help, trivia, dinner ideas...</div>
      <div class="ask-row"><input class="ask-in" placeholder="Type a question...">
        <button class="ask-go">ASK</button></div>`;
    const input = el.querySelector(".ask-in"), out = el.querySelector("#ask-out");
    const go = async () => {
      const q = input.value.trim(); if (!q) return;
      out.textContent = "Thinking...";
      const d = await post(dev("ask"), { q });
      out.textContent = d.answer;
      input.value = "";
    };
    el.querySelector(".ask-go").onclick = go;
    input.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
  },
  packages: (el, cfg) => {
    const load = async () => {
      const items = (await get(dev("todos"))).filter(t => t.list_name === "packages");
      el.innerHTML = `<h3>&#128230; ${cfg.title || "Packages"}</h3>` + (items.map(t => {
        const parts = t.text.split("|");
        const label = parts[0].trim(), num = (parts[1] || parts[0]).trim();
        const c = detectCarrier(num);
        return `<div class="pkg-row ${t.done ? "done" : ""}">
          <span class="pkg-badge" style="background:${c.color}">${c.name}</span>
          <span class="pkg-label">${label}</span>
          <code class="pkg-num">${num}</code>
          ${t.done ? "&#9989;" : ""}</div>`;
      }).join("") || "<small>No packages. Add in Admin: label | tracking number</small>");
    };
    load(); return setInterval(load, 5 * 60e3);
  },
  movies: (el, cfg) => {
    const load = async () => {
      const d = await api("/api/widget-data/movies", cfg);
      if (d.error) { el.innerHTML = `<small>${d.error}</small>`; return; }
      el.innerHTML = `<h3>&#127916; ${cfg.title || (cfg.kind === "streaming" ? "Top Streaming Now" : "Top 10 In Theaters")}</h3>
        <div class="movie-grid">` + d.map((m, i) => `
          <div class="movie-card" data-id="${m.id}">
            <div class="movie-rank">${i + 1}</div>
            ${m.poster ? `<img src="${m.poster}">` : `<div class="movie-noposter">${m.title}</div>`}
            <div class="movie-meta">&#11088;${m.rating}</div>
          </div>`).join("") + `</div><small style="opacity:.5">Tap a poster for the trailer</small>`;
      el.querySelectorAll(".movie-card").forEach(c =>
        c.onclick = async () => {
          const t = await api("/api/widget-data/trailer", { id: c.dataset.id });
          if (t.key) trailerOverlay(t.key);
        });
    };
    load(); return setInterval(load, 6 * 3600e3);
  },
  streamnow: (el, cfg) => R.movies(el, Object.assign({ kind: "streaming" }, cfg)),
  youtube: async (el, cfg) => {
    // Use YouTube Iframe API for playlists (allows playback state detection).
    if (cfg.playlistId) {
      // Load the YouTube Iframe API (already defined elsewhere)
      await loadYouTubeAPI();
      const playerId = 'yt-player-' + Math.random().toString(36).substr(2,5);
      el.innerHTML = `<div id="${playerId}" style="width:100%;height:100%"></div>`;
      new YT.Player(playerId, {
        height: '100%',
        width: '100%',
        playerVars: {
          listType: 'playlist',
          list: cfg.playlistId,
          autoplay: cfg.autoplay ? 1 : 0,
        },
          events: {
            onStateChange: (e) => {
            // 1 = playing, 2 = paused, 0 = ended
            if (e.data === YT.PlayerState.PLAYING) {
              window.youtubePlaying = true;
              // Stop any pending page rotation and re-evaluate rotation logic
              clearTimeout(pageTimer);
              startCycle();
            } else if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
              window.youtubePlaying = false;
              // Resume normal page rotation after playback stops
              startCycle();
            }
            },
          },
      });
    } else if (cfg.channelId) {
      // Fallback for channel embeds – no playback state detection.
      const src = `https://www.youtube.com/embed?channel=${cfg.channelId}&autoplay=${cfg.autoplay ? 1 : 0}`;
      el.innerHTML = `<iframe src="${src}" style="width:100%;height:100%;border:0;" allow="autoplay; fullscreen"></iframe>`;
    } else {
      el.innerHTML = `<small>No YouTube source configured</small>`;
    }
  },
  duolingo: (el, cfg) => {
    const load = async () => {
      const d = await api("/api/widget-data/duolingo", cfg);
      if (d.error) { el.innerHTML = `<small>${d.error}</small>`; return; }
      el.innerHTML = `<h3>&#129413; Duolingo Streaks</h3>` + d.map(u => `
        <div class="duo-row"><b>${u.user}</b>
          ${u.streak == null ? "<small>not found</small>"
            : `<span class="duo-streak">&#128293; ${u.streak} days</span> <small>${u.xp} XP</small>`}
        </div>`).join("");
    };
    load(); return setInterval(load, 60 * 60e3);
  },
  countdown: (el, cfg) => {
    const tick = () => {
      const diff = new Date(cfg.target) - Date.now();
      const days = Math.floor(diff / 86400e3), hrs = Math.floor(diff % 86400e3 / 3600e3);
      el.innerHTML = `<h3>${cfg.title || "Countdown"}</h3><div class="clock-time">${days}d ${hrs}h</div>`;
    };
    tick(); return setInterval(tick, 60e3);
  },
  embed: (el, cfg) => {
    el.innerHTML = `<iframe src="${cfg.url}" style="width:100%;height:100%;border:0"></iframe>`;
  },
  weathercloud: (el, cfg) => {
    const load = () => {
      el.innerHTML = `<div style="display:flex;flex:1;align-items:center;justify-content:center">
        <img style="max-width:100%;max-height:100%;border-radius:8px"
          src="https://app.weathercloud.net/device/sticker/${cfg.device}?t=${Date.now()}"></div>`;
    };
    load(); return setInterval(load, 10 * 60e3);
  },
  sports: (el, cfg) => {
    const load = async () => {
      const d = await api("/api/widget-data/sports", cfg);
      if (d.error) { el.innerHTML = `<small>Scores error</small>`; return; }
      el.innerHTML = `<h3>&#127934; ${d.league}${cfg.team ? " - " + cfg.team : ""}</h3>` +
        (d.games.map(g => `
          <div class="sport-card ${g.live ? "live" : ""} ${g.link ? "clickable" : ""}">
            <div class="sport-team">${g.away.logo ? `<img src="${g.away.logo}">` : ""}
              <span>${g.away.abbr}</span><b>${g.away.score}</b></div>
           <div class="sport-mid">@<br><small>${g.live ? "&#128308;" : ""}${g.status}</small>
               ${g.live && g.link ? "<small class='sport-hl'>tap for live</small>" : ""}
               ${g.final && g.link ? "<small class='sport-hl'>tap for highlights</small>" : ""}</div>
            <div class="sport-team">${g.home.logo ? `<img src="${g.home.logo}">` : ""}
              <span>${g.home.abbr}</span><b>${g.home.score}</b></div>
          </div>`).join("") || "<small>No games today.</small>");
      el.querySelectorAll(".sport-card").forEach((c, idx) => {
        const g = d.games[idx];
        if (g && g.link) c.onclick = () => window.open(g.link, "_blank");
      });
    };
    load(); return setInterval(load, 2 * 60e3);
  },
  recipe: (el, cfg) => {
    const load = async () => {
      const d = await api("/api/widget-data/recipe", cfg);
      if (d.error) { el.innerHTML = `<small>Recipe error</small>`; return; }
      el.innerHTML = `<h3>&#127859; Recipe of the Day (${cfg.diet || "carnivore"})</h3>
        <div style="display:flex;gap:12px;flex:1;min-height:0">
          <img src="${d.img}" style="width:40%;object-fit:cover;border-radius:10px">
          <div style="overflow:auto"><b style="font-size:1.15rem">${d.title}</b>
            <div style="opacity:.6">${d.area} &middot; ${d.category}</div>
            ${d.ingredients.map(i => `<div class="todo">&#8226; ${i}</div>`).join("")}
          </div></div>`;
    };
    load(); return setInterval(load, 6 * 3600e3);
  },
  camera: (el, cfg) => {
    if (cfg.iframe) {
      el.innerHTML = `<iframe src="${cfg.iframe}" style="width:100%;height:100%;border:0" allow="autoplay"></iframe>`;
      return;
    }
    if (cfg.img) {
      const load = () => el.innerHTML =
        `<img class="photo" src="${cfg.img}${cfg.img.includes("?") ? "&" : "?"}t=${Date.now()}">`;
      load(); return setInterval(load, (cfg.refresh || 10) * 1000);
    }
    if (cfg.hls) {
      el.innerHTML = `<video muted autoplay playsinline
        style="width:100%;height:100%;object-fit:cover;border-radius:10px"></video>`;
      const video = el.querySelector("video");
      const start = () => {
        if (video.canPlayType("application/vnd.apple.mpegurl")) video.src = cfg.hls;
        else if (window.Hls && Hls.isSupported()) {
          const h = new Hls(); h.loadSource(cfg.hls); h.attachMedia(video);
        }
      };
      if (window.Hls || video.canPlayType("application/vnd.apple.mpegurl")) start();
      else {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/hls.js@1";
        s.onload = start; document.head.appendChild(s);
      }
      return;
    }
    el.innerHTML = "<small>Set iframe, img, or hls in config.</small>";
  },
    // Simple Spotify iframe widget (no auth required)
    spotify_iframe: async (el, cfg) => {
      // Retrieve the embed URL from the backend widget-data endpoint.
      // The server provides a default if none is configured.
      const data = await api("/api/widget-data/spotify_iframe", cfg);
      const embedUrl = data && data.embedUrl;
      if (!embedUrl) {
        // Show a helpful message if no URL is supplied.
        el.innerHTML = `<h3>🎧 Spotify (iframe)</h3><small>No Spotify embed URL configured.</small>`;
        // Return a dummy interval to keep the widget framework happy.
        return setInterval(() => {}, 60000);
      }
      // We're not able to detect playback state from the iframe, so page rotation
      // will not be paused automatically. This matches the "old way" where the
      // embed works independently of the server.
      const style = "width:100%;height:100%;border:none;border-radius:6px;background:#111;";
      el.innerHTML = `<h3>🎧 Spotify (iframe)</h3>` +
        `<iframe src="${embedUrl}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" style="${style}" loading="lazy"></iframe>`;
      // Dummy interval – other widgets return an interval for cleanup.
      return setInterval(() => {}, 60000);
    },
  lakelevel: (el, cfg) => {
    const load = async () => {
      const d = await api("/api/widget-data/lakelevel", cfg);
      if (d.error) { el.innerHTML = "<small>Lake data error</small>"; return; }
      const delta = (d.level - d.flood).toFixed(2);
      const min = Math.min(...d.history.map(h => h.level), d.level) - 0.2;
      const max = Math.max(...d.history.map(h => h.level), d.level) + 0.2;
      el.innerHTML = `<h3>&#127754; ${cfg.title || "Lake Champlain"}</h3>
        <div class="lake-now">${d.level.toFixed(2)} <small>${d.unit}</small></div>
        <div class="${d.level >= d.flood ? "dep-now" : "dep-ok"}">
          ${d.level >= d.flood ? "ABOVE" : Math.abs(delta) + " ft below"} flood stage (${d.flood} ft)</div>
        <div class="lake-bars">${d.history.map(h =>
          `<div class="lake-bar" title="${h.date}: ${h.level}"
            style="height:${Math.round((h.level - min) / (max - min) * 100)}%"></div>`).join("")}</div>
        <small style="opacity:.5">${d.name} - 7 day trend (USGS)</small>`;
    };
    load(); return setInterval(load, 30 * 60e3);
  },

  // ===== Family widgets =====
  chorechart: (el) => {
    const load = async () => {
      await loadMembers();
      const chores = await get(dev("chores"));
      const kids = MEMBERS.filter(m => m.role === "kid");
      el.innerHTML = `<h3>&#129529; Chore Chart</h3><div class="chore-cols">` +
        kids.map(k => `
          <div class="chore-col" style="border-top:4px solid ${k.color}">
            <div class="chore-kid">${k.avatar} <b>${k.name}</b>
              <span class="pts">&#11088;${k.points}</span>
              ${k.streak > 1 ? `<span class="streak">&#128293;${k.streak}</span>` : ""}</div>
            ${chores.filter(c => c.member_id === k.id && !c.is_bounty).map(c => `
              <div class="chore ${c.status}" data-id="${c.id}">
                ${c.status === "done" ? "&#9989;" : c.status === "pending" ? "&#8987;" : "&#11036;"}
                ${c.title} <small>+${c.points}&#11088;</small></div>`).join("") || "<small>All clear!</small>"}
          </div>`).join("") + `</div>`;
      el.querySelectorAll(".chore.open").forEach(c =>
        c.onclick = () => pinPrompt(pin => post(dev(`chores/${c.dataset.id}/complete`), { pin })));
    };
    load(); return setInterval(load, 60e3);
  },
  auction: (el) => {
    const load = async () => {
      await loadMembers();
      const bounties = (await get(dev("chores"))).filter(c => c.is_bounty && c.status === "open");
      el.innerHTML = `<h3>&#128176; Bounty Board</h3>` + (bounties.map(b => `
        <div class="bounty" data-id="${b.id}">${b.title}
          <span class="bounty-pts">+${b.points}&#11088;${b.screen_minutes ? ` +${b.screen_minutes}min&#128241;` : ""}</span>
          <button class="claim">CLAIM</button></div>`).join("") || "<small>No bounties right now.</small>");
      el.querySelectorAll(".bounty").forEach(b =>
        b.querySelector(".claim").onclick = () => {
          const kid = prompt("Who is claiming? Type your name:");
          const m = MEMBERS.find(x => x.name.toLowerCase() === (kid || "").toLowerCase());
          if (!m) return;
          pinPrompt(pin => post(dev(`chores/${b.dataset.id}/complete`), { member_id: m.id, pin }));
        });
    };
    load(); return setInterval(load, 60e3);
  },
  routine: (el) => {
    const load = async () => {
      await loadMembers();
      const now = new Date().toTimeString().slice(0, 5);
      const routines = (await get(dev("routines"))).filter(r => now >= r.time_start && now <= r.time_end);
      if (!routines.length) { el.innerHTML = `<h3>&#10024; Routines</h3><small>Nothing right now.</small>`; return; }
      el.innerHTML = routines.map(r => {
        const m = member(r.member_id);
        const pct = Math.round(r.checked.length / r.steps.length * 100);
        return `<div class="routine" style="border-left:4px solid ${m.color}">
          <b>${m.avatar} ${m.name} &mdash; ${r.name}</b>
          <div class="rt-bar"><div style="width:${pct}%;background:${m.color}"></div></div>
          ${r.steps.map((s, i) => `<div class="rt-step ${r.checked.includes(i) ? "done" : ""}"
              data-r="${r.id}" data-i="${i}">${r.checked.includes(i) ? "&#9989;" : "&#11036;"} ${s}</div>`).join("")}
          ${pct === 100 ? `<div class="rt-done">All done, ${m.name}!</div>` : ""}</div>`;
      }).join("");
      el.querySelectorAll(".rt-step:not(.done)").forEach(s =>
        s.onclick = () => post(dev(`routines/${s.dataset.r}/check/${s.dataset.i}`)));
    };
    load(); return setInterval(load, 60e3);
  },
  departures: (el) => {
    const load = async () => {
      await loadMembers();
      const deps = await get(dev("departures"));
      el.innerHTML = `<h3>&#128663; Departure Board</h3>` + (deps.slice(0, 6).map(d => {
        const m = member(d.member_id);
        const mins = Math.round((d.next_ts - d.leave_mins * 60e3 - Date.now()) / 60e3);
        const status = mins < 0 ? `<span class="dep-now">GO NOW</span>`
          : mins < 10 ? `<span class="dep-soon">leave in ${mins}m</span>`
          : `<span class="dep-ok">leave in ${mins}m</span>`;
        return `<div class="dep-row" style="border-left:4px solid ${m.color}">
          <span class="dep-time">${new Date(d.next_ts).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}</span>
          ${m.avatar} <b>${d.title}</b> ${status}</div>`;
      }).join("") || "<small>No departures scheduled.</small>");
    };
    load(); return setInterval(load, 30e3);
  },
  meals: (el) => {
    const load = async () => {
      const meals = await get(dev("meals"));
      const days = [...Array(5)].map((_, i) => {
        const d = new Date(Date.now() + i * 86400e3);
        const key = d.toISOString().slice(0, 10);
        const dinner = meals.find(m => m.date === key && m.slot === "dinner");
        return `<div class="meal-day"><b>${i === 0 ? "Today" : d.toLocaleDateString([], {weekday:"short"})}</b>
          <span>${dinner ? dinner.title : "&mdash;"}</span></div>`;
      }).join("");
      el.innerHTML = `<h3>&#127869; Dinners This Week</h3>${days}
        <button class="spin-btn">Can't decide? SPIN!</button><div class="spin-result"></div>`;
      el.querySelector(".spin-btn").onclick = async () => {
        const out = el.querySelector(".spin-result");
        const all = await get(dev("recipes"));
        let n = 0;
        const spin = setInterval(() => { out.textContent = (all[n++ % (all.length||1)] || {}).title || "..."; }, 80);
        setTimeout(async () => {
          clearInterval(spin);
          const pick = await get(dev("dinner-spin"));
          out.innerHTML = `<b class="spin-win">${pick.title}</b>`;
        }, 2500);
      };
    };
    load(); return setInterval(load, 5 * 60e3);
  },
  grocery: (el) => {
    const load = async () => {
      const items = await get(dev("grocery"));
      const cats = [...new Set(items.map(i => i.category))];
      el.innerHTML = `<h3>&#128722; Grocery List</h3>` + cats.map(c => `<div class="gro-cat">${c}</div>` +
        items.filter(i => i.category === c).map(i =>
          `<div class="gro-item ${i.done ? "done" : ""}" data-id="${i.id}">${i.done ? "&#9745;" : "&#9744;"} ${i.item}</div>`).join("")).join("");
      el.querySelectorAll(".gro-item").forEach(g =>
        g.onclick = () => post(dev(`grocery/${g.dataset.id}/toggle`)));
    };
    load(); return setInterval(load, 60e3);
  },
  kudos: (el) => {
    const load = async () => {
      await loadMembers();
      const list = await get(dev("kudos"));
      el.innerHTML = `<h3>&#128155; Kudos Wall</h3>` + list.slice(0, 5).map(k =>
        `<div class="kudo">${member(k.from_id).avatar} &rarr; ${member(k.to_id).avatar} <i>"${k.text}"</i></div>`).join("");
    };
    load(); return setInterval(load, 2 * 60e3);
  },
  announce: (el) => {
    const load = async () => {
      const a = await get(dev("announcements"));
      el.innerHTML = a.map(x => `<div class="announce">${x.emoji} ${x.text}</div>`).join("") || "";
    };
    load(); return setInterval(load, 60e3);
  },
  standup: (el, cfg) => {
    const load = async () => {
      await loadMembers();
      const [chores, deps] = await Promise.all([get(dev("chores")), get(dev("departures"))]);
      let hint = "";
      if (cfg.lat || cfg.zip) {
        const wx = await api("/api/widget-data/weather", cfg);
        if (!wx.error) hint = (wx.temp < 45 ? "Coat day!" : wx.temp < 65 ? "Light jacket" : "T-shirt weather")
          + (wx.desc.includes("Rain") ? " Bring umbrella!" : "");
      }
      el.innerHTML = `<h3>&#9728; Today's Lineup ${hint ? "&mdash; " + hint : ""}</h3>` +
        MEMBERS.map(m => {
          const myChores = chores.filter(c => c.member_id === m.id && c.status === "open").length;
          const myDeps = deps.filter(d => d.member_id === m.id && d.next_ts < Date.now() + 18 * 3600e3);
          return `<div class="standup-row" style="border-left:4px solid ${m.color}">
            <b>${m.avatar} ${m.name}</b>
            ${myDeps.map(d => `${d.title} @ ${new Date(d.next_ts).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}`).join(" ")}
            ${myChores ? `<span class="standup-chores">${myChores} chores</span>` : "chore-free!"}</div>`;
        }).join("");
    };
    load(); return setInterval(load, 5 * 60e3);
  },
  screentime: (el) => {
    const load = async () => {
      await loadMembers();
      el.innerHTML = `<h3>&#128241; Screen-Time Bank</h3>` +
        MEMBERS.filter(m => m.role === "kid").map(m =>
          `<div class="st-row"><span style="color:${m.color}">${m.avatar} ${m.name}</span>
            <b>${m.screen_minutes} min</b></div>`).join("");
    };
    load(); return setInterval(load, 60e3);
  }
};

// ================= GridStack rendering =================
function cellH() {
  return Math.max(40, Math.floor((window.innerHeight - PADDING * 2) / 8));
}

function renderPage() {
  timers.forEach(clearInterval); timers = [];
  if (gs) { try { gs.destroy(false); } catch {} gs = null; }
  gridEl.innerHTML = "";
  document.body.className = "display-body theme-" + dashTheme;

  gs = GridStack.init({
    column: MOBILE ? 1 : 12,
    cellHeight: MOBILE ? 90 : cellH(),
    margin: 6,
    float: !MOBILE,
    disableDrag: MOBILE,
    disableResize: MOBILE,
    resizable: { handles: "se" },
    draggable: { handle: ".grid-stack-item-content" }
  }, gridEl);

  const page = dashData.pages[pageIdx] || { widgets: [] };
  page.widgets.forEach((w, i) => {
    const item = gs.addWidget({ x: w.x, y: w.y, w: w.w, h: w.h, content: "" });
    item.dataset.idx = i;
    const content = item.querySelector(".grid-stack-item-content");
    content.classList.add("widget", "widget-" + w.type);
    const t = R[w.type] && R[w.type](content, w.config || {});
    if (t) timers.push(t);
  });

  gs.on("change", syncFromGrid);
  renderPageDots();
}

function syncFromGrid() {
  if (MOBILE) return;
  const page = dashData.pages[pageIdx];
  if (!page) return;
  gs.engine.nodes.forEach(n => {
    const w = page.widgets[+n.el.dataset.idx];
    if (w) { w.x = n.x; w.y = n.y; w.w = n.w; w.h = n.h; }
  });
  dirtyPageRef = page;
  clearTimeout(saveDebounce);
  saveDebounce = setTimeout(persistLayout, 1000);
  startCycle();
}

async function persistLayout() {
  if (!dirtyPageRef) return;
  try {
    await post(`/api/display/${deviceId}/layout`,
      { page_id: dirtyPageRef.id, widgets: dirtyPageRef.widgets });
  } catch (e) { console.error("Layout save failed", e); }
}

// ================= Page cycling =================
function startCycle() {
  clearTimeout(pageTimer);
  if (!dashData || dashData.pages.length <= 1) return;
  // If any media widget reports playing, defer page change
  if (window.spotifyPlaying || window.youtubePlaying) {
    pageTimer = setTimeout(startCycle, 1000);
    return;
  }
  const secs = Math.max(5, +dashData.pages[pageIdx].secs || 30);
  pageTimer = setTimeout(() => {
    pageIdx = (pageIdx + 1) % dashData.pages.length;
    renderPage();
    startCycle();
  }, secs * 1000);
}

function renderPageDots() {
  const dots = document.getElementById("pageDots");
  if (!dashData || dashData.pages.length <= 1) { dots.innerHTML = ""; return; }
  dots.innerHTML = dashData.pages.map((p, i) =>
    `<span class="dot ${i === pageIdx ? "on" : ""}" data-i="${i}"></span>`).join("");
  dots.querySelectorAll(".dot").forEach(d =>
    d.onclick = () => { pageIdx = +d.dataset.i; renderPage(); startCycle(); });
}

// ================= Refresh =================
async function refresh() {
  const reg = await post("/api/device/register", { id: deviceId });
  document.getElementById("pairing").classList.toggle("hidden", reg.paired);
  if (!reg.paired) return;
  const dash = await get(`/api/device/${deviceId}/dashboard`);
  if (dash.pending) return;
  dashTheme = dash.theme || "dark";
  dashData = normalizeLayout(dash.layout);
  if (pageIdx >= dashData.pages.length) pageIdx = 0;
  renderPage();
  startCycle();
  checkQuietHours();
}

window.addEventListener("resize", () => { if (gs && !MOBILE) gs.cellHeight(cellH()); });

// ================= Quiet hours & toasts =================
async function checkQuietHours() {
  try {
    const q = await get(dev("quiet-hours"));
    if (!q.enabled) { document.body.classList.remove("night-mode"); return; }
    const now = new Date().toTimeString().slice(0, 5);
    const inQuiet = q.start > q.end ? (now >= q.start || now < q.end) : (now >= q.start && now < q.end);
    document.body.classList.toggle("night-mode", inQuiet);
  } catch {}
}
setInterval(checkQuietHours, 60e3);

function showToast(text) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 6000);
}

// ================= WebSocket live updates =================
function connectWS() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}`);
  ws.onopen = () => ws.send(JSON.stringify({ device: deviceId }));
  ws.onmessage = (e) => {
    try { const m = JSON.parse(e.data); if (m.toast) showToast(m.toast); } catch {}
    refresh();
  };
  ws.onclose = () => setTimeout(connectWS, 5000);
}
connectWS();
refresh();
setInterval(refresh, 15 * 60e3);