# BetIQ – Autonomous Sports Betting Simulator

A full-stack sports betting simulator with a React frontend and Node.js/Express backend.

## Features

- Browse upcoming Football, Basketball, and Tennis events with live odds
- Place bets on any event with a custom stake
- Bankroll tracker with win rate, P&L, and pending bet stats
- Simulate event results to instantly settle bets
- Full bet history with outcomes and profit/loss
- Reset simulator to restore $1,000 starting bankroll

## Project Structure

```
Betbot/
├── backend/          # Node.js + Express API
│   ├── server.js     # Main server & all routes
│   └── data/
│       └── sportsData.js  # Simulated events
└── frontend/         # React + Vite + TailwindCSS
    └── src/
        ├── App.jsx
        └── components/
            ├── Bankroll.jsx
            ├── EventsList.jsx
            └── BetHistory.jsx
```

## Getting Started

### Backend

```bash
cd backend
npm install
npm run dev   # starts on http://localhost:5000
```

### Frontend

```bash
cd frontend
npm install
npm run dev   # starts on http://localhost:3000
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events` | List all events (filter by `?sport=` or `?status=`) |
| GET | `/api/events/:id` | Get single event |
| POST | `/api/events/:id/simulate` | Simulate result & settle bets |
| GET | `/api/bets` | List all bets |
| POST | `/api/bets` | Place a bet `{ eventId, selection, stake }` |
| GET | `/api/bankroll` | Get bankroll stats |
| POST | `/api/reset` | Reset all data |
