// Temporary script to test sports widget HTML generation after modification
const d = {
  league: 'MLB',
  games: [
    {
      status: 'Live',
      live: true,
      final: false,
      link: 'https://example.com',
      away: { abbr: 'NY', score: '5', logo: '' },
      home: { abbr: 'LA', score: '3', logo: '' }
    },
    {
      status: 'Final',
      live: false,
      final: true,
      link: 'https://example.com/final',
      away: { abbr: 'CH', score: '2', logo: '' },
      home: { abbr: 'SF', score: '7', logo: '' }
    }
  ]
};
const cfg = {};
const html = `<h3>&#127934; ${d.league}${cfg.team ? " - " + cfg.team : ""}</h3>` +
  (d.games.map(g => `
    <div class="sport-card ${g.live ? "live" : ""} ${g.link ? "clickable" : ""}">
      <div class="sport-team">${g.away.logo ? `<img src="${g.away.logo}">` : ""}
        <span>${g.away.abbr}</span><b>${g.away.score}</b></div>
      <div class="sport-mid">@<br><small>${g.live ? "&#128308;" : ""}${g.status}</small>
        ${g.live && g.link ? "<small class='sport-hl'>tap for live</small>" : ""}
        ${g.final && g.link ? "<small class='sport-hl'>tap for highlights</small>" : ""}</div>
      <div class="sport-team">${g.home.logo ? `<img src="${g.home.logo}">` : ""}
        <span>${g.home.abbr}</span><b>${g.home.score}</b></div>
    </div>`).join('') || '<small>No games today.</small>';

console.log(html);