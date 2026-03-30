require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initialEvents } = require('./data/sportsData');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/api/ai', aiRoutes);

// In-memory store
const store = {
  events: [...initialEvents],
  bets: [],
  bankroll: 1000.00,
};

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

// Simulate an event result and settle related bets
app.post('/api/events/:id/simulate', (req, res) => {
  const event = store.events.find(e => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (event.status === 'completed') return res.status(400).json({ error: 'Event already completed' });

  const outcomes = event.odds.draw
    ? ['home', 'draw', 'away']
    : ['home', 'away'];
  const result = outcomes[Math.floor(Math.random() * outcomes.length)];

  event.status = 'completed';
  event.result = result;

  // Settle all pending bets on this event
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

  if (!eventId || !selection || !stake) {
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

  const { v4: uuidv4 } = require('uuid');
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
  const totalStaked = store.bets
    .filter(b => b.status === 'pending')
    .reduce((sum, b) => sum + b.stake, 0);

  const totalWon = store.bets
    .filter(b => b.status === 'won')
    .reduce((sum, b) => sum + b.profit, 0);

  const totalLost = store.bets
    .filter(b => b.status === 'lost')
    .reduce((sum, b) => sum + Math.abs(b.profit), 0);

  res.json({
    balance: store.bankroll,
    totalStaked: parseFloat(totalStaked.toFixed(2)),
    totalWon: parseFloat(totalWon.toFixed(2)),
    totalLost: parseFloat(totalLost.toFixed(2)),
    betsPlaced: store.bets.length,
    betsWon: store.bets.filter(b => b.status === 'won').length,
    betsLost: store.bets.filter(b => b.status === 'lost').length,
    betsPending: store.bets.filter(b => b.status === 'pending').length,
  });
});

// Reset bankroll and bets (for testing)
app.post('/api/reset', (req, res) => {
  store.bets = [];
  store.bankroll = 1000.00;
  store.events.forEach(e => { e.status = 'upcoming'; e.result = null; });
  res.json({ message: 'Reset successful', bankroll: store.bankroll });
});

app.listen(PORT, () => {
  console.log(`BetIQ API running on http://localhost:${PORT}`);
});
