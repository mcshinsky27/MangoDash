const ical = require("node-ical");
const Parser = require("rss-parser");
const rss = new Parser();
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

module.exports = {
  weather: (cfg) => cached(`wx:${cfg.lat},${cfg.lon},${cfg.unit}`, 10 * 60e3, async () => {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${cfg.lat}&longitude=${cfg.lon}` +
      `&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto` +
      `&temperature_unit=${cfg.unit === "F" ? "fahrenheit" : "celsius"}`;
    const d = await (await fetch(u)).json();
    return {
      temp: Math.round(d.current.temperature_2m),
      desc: WMO[d.current.weather_code] || "-",
      humidity: d.current.relative_humidity_2m,
      wind: d.current.wind_speed_10m,
      forecast: d.daily.time.slice(0, 5).map((t, i) => ({
        day: new Date(t).toLocaleDateString("en", { weekday: "short" }),
        hi: Math.round(d.daily.temperature_2m_max[i]),
        lo: Math.round(d.daily.temperature_2m_min[i]),
        desc: WMO[d.daily.weather_code[i]] || ""
      }))
    };
  }),

  calendar: (cfg) => cached(`cal:${cfg.url}`, 5 * 60e3, async () => {
    const events = await ical.async.fromURL(cfg.url);
    const now = Date.now(), horizon = now + (cfg.days || 14) * 86400e3;
    return Object.values(events)
      .filter(e => e.type === "VEVENT" && e.start && e.start.getTime() < horizon &&
                   (e.end ? e.end.getTime() : e.start.getTime()) > now - 3600e3)
      .sort((a, b) => a.start - b.start)
      .slice(0, cfg.max || 10)
      .map(e => ({ title: e.summary, start: e.start, allday: e.datetype === "date" }));
  }),

  news: (cfg) => cached(`rss:${cfg.url}`, 10 * 60e3, async () => {
    const feed = await rss.parseURL(cfg.url);
    return { title: feed.title,
      items: feed.items.slice(0, cfg.max || 6).map(i => ({ title: i.title, date: i.pubDate })) };
  }),

  stocks: (cfg) => cached(`stk:${cfg.symbols}`, 5 * 60e3, async () => {
    const syms = cfg.symbols.split(",").map(s => s.trim());
    return Promise.all(syms.map(async s => {
      const csv = await (await fetch(`https://stooq.com/q/l/?s=${s}&f=sd2t2ohlcv&h&e=csv`)).text();
      const row = csv.trim().split("\n")[1];
      const c = row.split(",");
      return { symbol: c[0], open: +c[3], close: +c[6],
               change: (((+c[6] - +c[3]) / +c[3]) * 100).toFixed(2) };
    }));
  }),

  quote: () => cached("quote", 60 * 60e3, async () => {
    const d = await (await fetch("https://zenquotes.io/api/random")).json();
    return { text: d[0].q, author: d[0].a };
  })
};