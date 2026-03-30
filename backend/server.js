require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { initialEvents } = require('./data/sportsData');
const aiRoutes = require('./routes/ai');
const { fetchEvents } = require('./services/oddsApi');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/api/ai', aiRoutes);

// In-memory store
const store = {
  events: [],
  bets: [],
  bankroll: 1000.00,
  lastFetched: null,
  oddsApiRemaining: null,
};

// Load real odds from The Odds API, fall back to simulated data on failure
async function loadEvents() {
  console.log('Fetching live odds from The Odds API...');
  try {
    const { events, remaining } = await fetchEvents();
    if (events.length > 0) {
      // Preserve status/result for events already in the store (e.g. simulated)
      store.events = events.map(e => {
        const existing = store.events.find(x => x.id === e.id);
        return existing ? { ...e, status: existing.status, result: existing.result } : e;
      });
      store.lastFetched = new Date().toISOString();
      store.oddsApiRemaining = remaining;
      console.log(`Loaded ${events.length} live events. API requests remaining: ${remaining}`);
    } else {
      throw new Error('No events returned from Odds API');
    }
  } catch (err) {
    console.warn('Odds API unavailable, using simulated events:', err.message);
    if (store.events.length === 0) {
      store.events = [...initialEvents];
    }
  }
}

// ── Events ──────────────────────────────────────────────────────────────────

app.get('/api/events', (req, res) => {
  const { sport, status } = req.query;
  let events = store.events;
  if (sport) events = events.filter(e => e.sport.toLowerCase() === sport.toLowerCase());
  if (status) events = events.filter(e => e.status === status);
  res.json(events);
});

app.get('/api/events/:id', (req, res) => {
  const event = store.events.find(e => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json(event);
});

// Refresh events from Odds API
app.post('/api/events/refresh', async (req, res) => {
  await loadEvents();
  res.json({
    message: `Loaded ${store.events.length} events`,
    lastFetched: store.lastFetched,
    oddsApiRemaining: store.oddsApiRemaining,
  });
});

// Simulate an event result and settle related bets
app.post('/api/events/:id/simulate', (req, res) => {
  const event = store.events.find(e => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (event.status === 'completed') return res.status(400).json({ error: 'Event already completed' });

  const outcomes = event.odds.draw ? ['home', 'draw', 'away'] : ['home', 'away'];
  const result = outcomes[Math.floor(Math.random() * outcomes.length)];

  event.status = 'completed';
  event.result = result;

  const settled = [];
  store.bets
    .filter(b => b.eventId === event.id && b.status === 'pending')
    .forEach(bet => {
      if (bet.selection === result) {
        const profit = parseFloat((bet.stake * bet.odds - bet.stake).toFixed(2));
        bet.status = 'won';
        bet.profit = profit;
        store.bankroll = parseFloat((store.bankroll + bet.stake + profit).toFixed(2));
      } else {
        bet.status = 'lost';
        bet.profit = -bet.stake;
      }
      settled.push(bet);
    });

  res.json({ event, settledBets: settled });
});

// ── Bets ─────────────────────────────────────────────────────────────────────

app.get('/api/bets', (req, res) => {
  const bets = store.bets.map(bet => {
    const event = store.events.find(e => e.id === bet.eventId);
    return { ...bet, event };
  });
  res.json(bets);
});

app.post('/api/bets', (req, res) => {
  const { eventId, selection, stake } = req.body;

  if (!eventId || !selection || stake === undefined) {
    return res.status(400).json({ error: 'eventId, selection, and stake are required' });
  }
  if (typeof stake !== 'number' || stake <= 0) {
    return res.status(400).json({ error: 'stake must be a positive number' });
  }
  if (stake > store.bankroll) {
    return res.status(400).json({ error: 'Insufficient bankroll' });
  }

  const event = store.events.find(e => e.id === eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (event.status !== 'upcoming') return res.status(400).json({ error: 'Event is not open for betting' });

  const oddsValue = event.odds[selection];
  if (!oddsValue) return res.status(400).json({ error: `Invalid selection "${selection}" for this event` });

  const bet = {
    id: uuidv4(),
    eventId,
    selection,
    odds: oddsValue,
    stake: parseFloat(stake.toFixed(2)),
    status: 'pending',
    profit: null,
    placedAt: new Date().toISOString(),
  };

  store.bets.push(bet);
  store.bankroll = parseFloat((store.bankroll - stake).toFixed(2));

  res.status(201).json({ bet, bankroll: store.bankroll });
});

// ── Bankroll ──────────────────────────────────────────────────────────────────

app.get('/api/bankroll', (req, res) => {
  const totalWon  = store.bets.filter(b => b.status === 'won').reduce((s, b) => s + b.profit, 0);
  const totalLost = store.bets.filter(b => b.status === 'lost').reduce((s, b) => s + Math.abs(b.profit), 0);

  res.json({
    balance: store.bankroll,
    totalStaked: parseFloat(store.bets.filter(b => b.status === 'pending').reduce((s, b) => s + b.stake, 0).toFixed(2)),
    totalWon: parseFloat(totalWon.toFixed(2)),
    totalLost: parseFloat(totalLost.toFixed(2)),
    betsPlaced: store.bets.length,
    betsWon: store.bets.filter(b => b.status === 'won').length,
    betsLost: store.bets.filter(b => b.status === 'lost').length,
    betsPending: store.bets.filter(b => b.status === 'pending').length,
    lastFetched: store.lastFetched,
    oddsApiRemaining: store.oddsApiRemaining,
  });
});

// Reset bets and bankroll (events keep their live odds)
app.post('/api/reset', (req, res) => {
  store.bets = [];
  store.bankroll = 1000.00;
  store.events.forEach(e => { e.status = 'upcoming'; e.result = null; });
  res.json({ message: 'Reset successful', bankroll: store.bankroll });
});

// ── Serve frontend (production / Replit) ──────────────────────────────────────
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────

loadEvents().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BetIQ running on http://0.0.0.0:${PORT}`);
  });
});
