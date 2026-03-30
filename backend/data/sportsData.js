const { v4: uuidv4 } = require('uuid');

const generateOdds = () => {
  const home = parseFloat((1.5 + Math.random() * 3).toFixed(2));
  const away = parseFloat((1.5 + Math.random() * 3).toFixed(2));
  const draw = parseFloat((2.5 + Math.random() * 2).toFixed(2));
  return { home, draw, away };
};

const initialEvents = [
  {
    id: uuidv4(),
    sport: 'Football',
    homeTeam: 'Manchester City',
    awayTeam: 'Arsenal',
    date: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
    odds: generateOdds(),
    status: 'upcoming',
    result: null,
  },
  {
    id: uuidv4(),
    sport: 'Football',
    homeTeam: 'Real Madrid',
    awayTeam: 'Barcelona',
    date: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    odds: generateOdds(),
    status: 'upcoming',
    result: null,
  },
  {
    id: uuidv4(),
    sport: 'Basketball',
    homeTeam: 'LA Lakers',
    awayTeam: 'Boston Celtics',
    date: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    odds: { home: generateOdds().home, draw: null, away: generateOdds().away },
    status: 'upcoming',
    result: null,
  },
  {
    id: uuidv4(),
    sport: 'Basketball',
    homeTeam: 'Golden State Warriors',
    awayTeam: 'Miami Heat',
    date: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(),
    odds: { home: generateOdds().home, draw: null, away: generateOdds().away },
    status: 'upcoming',
    result: null,
  },
  {
    id: uuidv4(),
    sport: 'Tennis',
    homeTeam: 'Djokovic',
    awayTeam: 'Alcaraz',
    date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    odds: { home: generateOdds().home, draw: null, away: generateOdds().away },
    status: 'upcoming',
    result: null,
  },
  {
    id: uuidv4(),
    sport: 'Tennis',
    homeTeam: 'Swiatek',
    awayTeam: 'Gauff',
    date: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    odds: { home: generateOdds().home, draw: null, away: generateOdds().away },
    status: 'upcoming',
    result: null,
  },
  {
    id: uuidv4(),
    sport: 'Football',
    homeTeam: 'Bayern Munich',
    awayTeam: 'Borussia Dortmund',
    date: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    odds: generateOdds(),
    status: 'upcoming',
    result: null,
  },
  {
    id: uuidv4(),
    sport: 'Basketball',
    homeTeam: 'Chicago Bulls',
    awayTeam: 'New York Knicks',
    date: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    odds: { home: generateOdds().home, draw: null, away: generateOdds().away },
    status: 'upcoming',
    result: null,
  },
];

module.exports = { initialEvents };
