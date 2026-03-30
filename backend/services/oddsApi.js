const https = require('https');

const BASE_URL = 'api.the-odds-api.com';
const API_KEY = process.env.ODDS_API_KEY;

// Sports to fetch — covers Football, Basketball, and American Football
const SPORTS = [
  { key: 'soccer_epl',              label: 'Football',    hasDraw: true  },
  { key: 'soccer_spain_la_liga',    label: 'Football',    hasDraw: true  },
  { key: 'soccer_germany_bundesliga',label: 'Football',   hasDraw: true  },
  { key: 'basketball_nba',          label: 'Basketball',  hasDraw: false },
  { key: 'americanfootball_nfl',    label: 'American Football', hasDraw: false },
];

function get(path) {
  return new Promise((resolve, reject) => {
    const options = { hostname: BASE_URL, path, method: 'GET' };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch {
          reject(new Error('Failed to parse Odds API response'));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Average decimal odds across all bookmakers for a given outcome name
function avgOdds(bookmakers, outcomeName) {
  const prices = [];
  for (const bm of bookmakers) {
    for (const market of bm.markets || []) {
      if (market.key !== 'h2h') continue;
      const outcome = market.outcomes.find(o => o.name === outcomeName);
      if (outcome) prices.push(outcome.price);
    }
  }
  if (!prices.length) return null;
  return parseFloat((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2));
}

// Map a raw Odds API event to our internal format
function mapEvent(raw, sportMeta) {
  const homeOdds = avgOdds(raw.bookmakers, raw.home_team);
  const awayOdds = avgOdds(raw.bookmakers, raw.away_team);

  // Draw exists for soccer — look for "Draw" outcome
  let drawOdds = null;
  if (sportMeta.hasDraw) {
    drawOdds = avgOdds(raw.bookmakers, 'Draw');
  }

  // Skip events with no odds data
  if (!homeOdds || !awayOdds) return null;

  return {
    id: raw.id,
    sport: sportMeta.label,
    sportKey: raw.sport_key,
    homeTeam: raw.home_team,
    awayTeam: raw.away_team,
    date: raw.commence_time,
    odds: { home: homeOdds, draw: drawOdds, away: awayOdds },
    status: 'upcoming',
    result: null,
    bookmakerCount: raw.bookmakers.length,
  };
}

async function fetchEvents() {
  const allEvents = [];
  let remaining = null;

  for (const sport of SPORTS) {
    const path = `/v4/sports/${sport.key}/odds?apiKey=${API_KEY}&regions=eu,uk&markets=h2h&oddsFormat=decimal&dateFormat=iso`;
    try {
      const { status, body, headers } = await get(path);
      remaining = headers['x-requests-remaining'];

      if (status !== 200) {
        console.warn(`Odds API ${sport.key}: HTTP ${status} — ${body.message || 'unknown error'}`);
        continue;
      }

      const mapped = body
        .map(raw => mapEvent(raw, sport))
        .filter(Boolean)
        .slice(0, 6); // cap per sport to keep quota usage low

      allEvents.push(...mapped);
      console.log(`Odds API: ${mapped.length} events for ${sport.key} (${remaining} requests remaining)`);
    } catch (err) {
      console.error(`Odds API fetch failed for ${sport.key}:`, err.message);
    }
  }

  return { events: allEvents, remaining };
}

module.exports = { fetchEvents };
