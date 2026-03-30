import React, { useState, useEffect, useCallback } from 'react';
import Bankroll from './components/Bankroll';
import EventsList from './components/EventsList';
import BetHistory from './components/BetHistory';
import AIAdvisor, { AutoBetPanel } from './components/AIAdvisor';

const API = 'http://localhost:5000/api';
const TABS = ['Events', 'My Bets', 'AI Advisor'];

export default function App() {
  const [tab, setTab] = useState('Events');
  const [events, setEvents] = useState([]);
  const [bets, setBets] = useState([]);
  const [bankrollStats, setBankrollStats] = useState({});
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingBets, setLoadingBets] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`${API}/events`);
      setEvents(await res.json());
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  const fetchBets = useCallback(async () => {
    try {
      const res = await fetch(`${API}/bets`);
      setBets(await res.json());
    } finally {
      setLoadingBets(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/bankroll`);
      setBankrollStats(await res.json());
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    fetchBets();
    fetchStats();
  }, [fetchEvents, fetchBets, fetchStats]);

  const handleBetPlaced = () => {
    fetchBets();
    fetchStats();
  };

  const handleSimulate = async (eventId) => {
    await fetch(`${API}/events/${eventId}/simulate`, { method: 'POST' });
    fetchEvents();
    fetchBets();
    fetchStats();
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all bets and restore $1,000 bankroll?')) return;
    await fetch(`${API}/reset`, { method: 'POST' });
    fetchEvents();
    fetchBets();
    fetchStats();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-900 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">BetIQ</h1>
            <p className="text-blue-300 text-xs">Sports Betting Simulator · Powered by Gemini AI</p>
          </div>
          <button
            onClick={handleReset}
            className="text-xs text-blue-300 hover:text-white border border-blue-600 hover:border-blue-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            Reset Simulator
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Bankroll */}
        <Bankroll stats={bankrollStats} loading={loadingStats} />

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px
                ${tab === t
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t === 'AI Advisor' && '✨ '}
              {t}
              {t === 'My Bets' && bets.length > 0 && (
                <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
                  {bets.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === 'Events' && (
          <EventsList
            events={events}
            loading={loadingEvents}
            onBetPlaced={handleBetPlaced}
            onSimulate={handleSimulate}
          />
        )}
        {tab === 'My Bets' && (
          <BetHistory bets={bets} loading={loadingBets} />
        )}
        {tab === 'AI Advisor' && (
          <div className="space-y-5">
            <AutoBetPanel
              events={events}
              bankrollStats={bankrollStats}
              onBetsPlaced={handleBetPlaced}
            />
            <AIAdvisor bankrollStats={bankrollStats} />
          </div>
        )}
      </main>
    </div>
  );
}
