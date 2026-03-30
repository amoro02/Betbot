const https = require('https');

const API_KEY = process.env.API_FOOTBALL_KEY;
const HOST = 'v3.football.api-sports.io';

// Cache: team IDs and stats are expensive — stay within 100 req/day free limit
const teamIdCache = {};       // name → id  (never expires)
const statsCache = {};        // teamId → { data, fetchedAt }
const h2hCache = {};          // "id1-id2" → { data, fetchedAt }
const STATS_TTL = 60 * 60 * 1000; // 1 hour

function get(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      path,
      method: 'GET',
      headers: { 'x-apisports-key': API_KEY },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Failed to parse API-Football response')); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function getTeamId(name) {
  if (teamIdCache[name]) return teamIdCache[name];
  const data = await get(`/teams?name=${encodeURIComponent(name)}`);
  const team = data.response?.[0]?.team;
  if (team) {
    teamIdCache[name] = team.id;
    return team.id;
  }
  return null;
}

// Returns W/D/L form string and goal stats from last 5 fixtures
async function getTeamForm(teamId) {
  const now = Date.now();
  if (statsCache[teamId] && now - statsCache[teamId].fetchedAt < STATS_TTL) {
    return statsCache[teamId].data;
  }

  const data = await get(`/fixtures?team=${teamId}&last=5&status=FT`);
  const fixtures = data.response || [];

  const form = fixtures.map(f => {
    const isHome = f.teams.home.id === teamId;
    const winner = isHome ? f.teams.home.winner : f.teams.away.winner;
    const draw = f.teams.home.winner === null && f.teams.away.winner === null;
    const goalsFor = isHome ? f.goals.home : f.goals.away;
    const goalsAgainst = isHome ? f.goals.away : f.goals.home;
    return { result: draw ? 'D' : winner ? 'W' : 'L', goalsFor, goalsAgainst };
  });

  const formStr = form.map(f => f.result).join('');
  const avgGoalsFor = form.length
    ? (form.reduce((s, f) => s + f.goalsFor, 0) / form.length).toFixed(1)
    : null;
  const avgGoalsAgainst = form.length
    ? (form.reduce((s, f) => s + f.goalsAgainst, 0) / form.length).toFixed(1)
    : null;

  const result = { form: formStr, avgGoalsFor, avgGoalsAgainst, matches: form.length };
  statsCache[teamId] = { data: result, fetchedAt: now };
  return result;
}

async function getH2H(teamId1, teamId2) {
  const key = [teamId1, teamId2].sort().join('-');
  const now = Date.now();
  if (h2hCache[key] && now - h2hCache[key].fetchedAt < STATS_TTL) {
    return h2hCache[key].data;
  }

  const data = await get(`/fixtures/headtohead?h2h=${teamId1}-${teamId2}&last=5`);
  const fixtures = data.response || [];

  let wins1 = 0, wins2 = 0, draws = 0;
  for (const f of fixtures) {
    if (f.teams.home.winner === null && f.teams.away.winner === null) { draws++; continue; }
    const homeWon = f.teams.home.winner;
    const homeId = f.teams.home.id;
    if (homeWon && homeId === teamId1) wins1++;
    else if (homeWon && homeId === teamId2) wins2++;
    else if (!homeWon && homeId === teamId1) wins2++;
    else wins1++;
  }

  const result = { team1Wins: wins1, team2Wins: wins2, draws, total: fixtures.length };
  h2hCache[key] = { data: result, fetchedAt: now };
  return result;
}

// Main entry point: returns a rich context string for an event
async function getMatchContext(homeTeam, awayTeam) {
  try {
    const [homeId, awayId] = await Promise.all([
      getTeamId(homeTeam),
      getTeamId(awayTeam),
    ]);

    if (!homeId || !awayId) return null;

    const [homeForm, awayForm, h2h] = await Promise.all([
      getTeamForm(homeId),
      getTeamForm(awayId),
      getH2H(homeId, awayId),
    ]);

    const lines = [];
    if (homeForm.matches > 0) {
      lines.push(`${homeTeam} last 5: ${homeForm.form} (avg ${homeForm.avgGoalsFor} scored, ${homeForm.avgGoalsAgainst} conceded)`);
    }
    if (awayForm.matches > 0) {
      lines.push(`${awayTeam} last 5: ${awayForm.form} (avg ${awayForm.avgGoalsFor} scored, ${awayForm.avgGoalsAgainst} conceded)`);
    }
    if (h2h.total > 0) {
      lines.push(`H2H last ${h2h.total}: ${homeTeam} ${h2h.team1Wins}W – ${h2h.draws}D – ${h2h.team2Wins}W ${awayTeam}`);
    }

    return lines.length ? lines.join('\n') : null;
  } catch (err) {
    console.warn(`footballStats: could not fetch context for ${homeTeam} vs ${awayTeam}:`, err.message);
    return null;
  }
}

module.exports = { getMatchContext };
