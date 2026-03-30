import React, { useState, useRef, useEffect } from 'react';

const API = 'http://localhost:5000/api';
const SESSION_ID = `session_${Date.now()}`;

const CONFIDENCE_COLOR = {
  High: 'text-green-600 bg-green-50 border-green-200',
  Medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  Low: 'text-red-500 bg-red-50 border-red-200',
};

const Message = ({ role, text }) => (
  <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
    {role === 'model' && (
      <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold mr-2 shrink-0 mt-0.5">
        AI
      </div>
    )}
    <div
      className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
        ${role === 'user'
          ? 'bg-blue-600 text-white rounded-br-sm'
          : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
        }`}
    >
      {text}
    </div>
  </div>
);

// ── Recommend Panel ────────────────────────────────────────────────────────
export const RecommendCard = ({ event, onBet }) => {
  const [rec, setRec] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRec = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/ai/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRec(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      {!rec && !loading && (
        <button
          onClick={fetchRec}
          className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          <span>✨</span> Get AI Recommendation
        </button>
      )}
      {loading && (
        <p className="text-xs text-gray-400 animate-pulse">Gemini is analyzing...</p>
      )}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
      {rec && (
        <div className={`rounded-lg border p-3 text-xs ${CONFIDENCE_COLOR[rec.confidence] || 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold uppercase tracking-wide">
              AI Pick: <span className="capitalize">{rec.pick}</span>
            </span>
            <span className="font-semibold">{rec.confidence} confidence · {rec.suggestedStake} stake</span>
          </div>
          <p className="leading-relaxed opacity-90">{rec.reasoning}</p>
          <button
            onClick={() => onBet(rec.pick)}
            className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded-lg font-semibold transition-colors"
          >
            Bet on this pick
          </button>
        </div>
      )}
    </div>
  );
};

// ── Auto-Bet Panel ─────────────────────────────────────────────────────────
export const AutoBetPanel = ({ events, bankrollStats, onBetsPlaced }) => {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleAutoBet = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      // Get AI bet selections
      const aiRes = await fetch(`${API}/ai/auto-bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events, bankroll: bankrollStats.balance, maxStakePercent: 10 }),
      });
      const { bets: suggestions, maxStake } = await aiRes.json();
      if (!aiRes.ok) throw new Error(suggestions.error);

      if (!suggestions.length) {
        setResult({ placed: [], message: 'Gemini found no value bets at this time.' });
        return;
      }

      // Place each bet
      const placed = [];
      for (const s of suggestions) {
        const betRes = await fetch(`${API}/bets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId: s.eventId, selection: s.selection, stake: s.stake }),
        });
        const betData = await betRes.json();
        if (betRes.ok) placed.push({ ...s, bet: betData.bet });
      }

      setResult({ placed, message: `Gemini placed ${placed.length} bet${placed.length !== 1 ? 's' : ''}.` });
      onBetsPlaced();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-gray-800">Auto-Bet Mode</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Gemini analyzes all upcoming events and places bets autonomously (max 10% bankroll per bet).
          </p>
        </div>
        <button
          onClick={handleAutoBet}
          disabled={running}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2 rounded-lg transition-colors"
        >
          {running ? 'Analyzing...' : '✨ Run Auto-Bet'}
        </button>
      </div>

      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}

      {result && (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-medium text-gray-700">{result.message}</p>
          {result.placed.map((s, i) => {
            const event = events.find(e => e.id === s.eventId);
            return (
              <div key={i} className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs">
                <p className="font-semibold text-blue-800">
                  {event ? `${event.homeTeam} vs ${event.awayTeam}` : s.eventId}
                  {' '}&rarr; <span className="capitalize">{s.selection}</span> @ ${s.stake.toFixed(2)}
                </p>
                <p className="text-blue-600 mt-0.5">{s.reasoning}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Chat Interface ─────────────────────────────────────────────────────────
const AIAdvisor = ({ bankrollStats }) => {
  const [messages, setMessages] = useState([
    { role: 'model', text: "Hi! I'm BetIQ, your AI betting advisor powered by Gemini. Ask me to analyze a match, explain odds, or suggest a betting strategy!" },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);
    try {
      const res = await fetch(`${API}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: SESSION_ID, context: bankrollStats }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages(prev => [...prev, { role: 'model', text: data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', text: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const SUGGESTIONS = [
    'What betting strategy should I use?',
    'Explain implied probability from odds',
    'What is value betting?',
    'How should I manage my bankroll?',
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col" style={{ height: '520px' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">AI</div>
        <div>
          <p className="font-semibold text-gray-800 text-sm">BetIQ Advisor</p>
          <p className="text-xs text-green-500">Powered by Gemini</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.map((m, i) => <Message key={i} role={m.role} text={m.text} />)}
        {loading && (
          <div className="flex justify-start mb-3">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold mr-2 shrink-0">AI</div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-sm">
              <span className="flex gap-1">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex gap-2 flex-wrap">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => { setInput(s); }}
              className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Ask about any match or strategy..."
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default AIAdvisor;
