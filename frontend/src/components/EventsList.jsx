import React, { useState } from 'react';

const SPORT_ICONS = {
  Football: '⚽',
  Basketball: '🏀',
  Tennis: '🎾',
};

const OddsButton = ({ label, odds, selected, onClick, disabled }) => {
  if (!odds) return null;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center px-3 py-2 rounded-lg border text-sm font-semibold transition-all
        ${selected
          ? 'bg-blue-600 border-blue-600 text-white shadow-md scale-105'
          : 'bg-white border-gray-200 text-gray-700 hover:border-blue-400 hover:bg-blue-50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <span className="text-xs font-normal text-inherit opacity-70">{label}</span>
      <span>{odds.toFixed(2)}</span>
    </button>
  );
};

const EventCard = ({ event, onAddToBetSlip }) => {
  const [selected, setSelected] = useState(null);
  const [stake, setStake] = useState('');
  const [placing, setPlacing] = useState(false);
  const [message, setMessage] = useState(null);

  const isCompleted = event.status === 'completed';

  const handleSelect = (sel) => {
    if (isCompleted) return;
    setSelected(sel === selected ? null : sel);
    setMessage(null);
  };

  const handlePlaceBet = async () => {
    if (!selected || !stake || isNaN(stake) || parseFloat(stake) <= 0) {
      setMessage({ type: 'error', text: 'Select an outcome and enter a valid stake.' });
      return;
    }
    setPlacing(true);
    setMessage(null);
    try {
      const res = await fetch('http://localhost:5000/api/bets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, selection: selected, stake: parseFloat(stake) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage({ type: 'success', text: `Bet placed! Balance: $${data.bankroll.toFixed(2)}` });
      setSelected(null);
      setStake('');
      onAddToBetSlip();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setPlacing(false);
    }
  };

  const timeLabel = new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`bg-white rounded-xl shadow-sm border p-4 transition-all hover:shadow-md
      ${isCompleted ? 'opacity-70 border-gray-200' : 'border-gray-100'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          {SPORT_ICONS[event.sport]} {event.sport}
        </span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
          ${isCompleted ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
          {isCompleted ? `Result: ${event.result}` : `Kicks off ${timeLabel}`}
        </span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <span className="font-bold text-gray-800 text-sm">{event.homeTeam}</span>
        <span className="text-xs text-gray-400 font-medium">vs</span>
        <span className="font-bold text-gray-800 text-sm">{event.awayTeam}</span>
      </div>

      <div className="flex gap-2 mb-3">
        <OddsButton
          label={event.homeTeam.split(' ').slice(-1)[0]}
          odds={event.odds.home}
          selected={selected === 'home'}
          onClick={() => handleSelect('home')}
          disabled={isCompleted}
        />
        {event.odds.draw && (
          <OddsButton
            label="Draw"
            odds={event.odds.draw}
            selected={selected === 'draw'}
            onClick={() => handleSelect('draw')}
            disabled={isCompleted}
          />
        )}
        <OddsButton
          label={event.awayTeam.split(' ').slice(-1)[0]}
          odds={event.odds.away}
          selected={selected === 'away'}
          onClick={() => handleSelect('away')}
          disabled={isCompleted}
        />
      </div>

      {selected && !isCompleted && (
        <div className="flex gap-2 mt-2">
          <input
            type="number"
            min="1"
            placeholder="Stake ($)"
            value={stake}
            onChange={e => setStake(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handlePlaceBet}
            disabled={placing}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {placing ? '...' : 'Place Bet'}
          </button>
        </div>
      )}

      {message && (
        <p className={`text-xs mt-2 font-medium ${message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
};

const EventsList = ({ events, loading, onBetPlaced, onSimulate }) => {
  const [filter, setFilter] = useState('All');
  const sports = ['All', 'Football', 'Basketball', 'Tennis'];

  const filtered = filter === 'All' ? events : events.filter(e => e.sport === filter);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {sports.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
              ${filter === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'}`}
          >
            {s !== 'All' && SPORT_ICONS[s]} {s}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-8">No events available.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map(event => (
            <div key={event.id} className="relative">
              <EventCard event={event} onAddToBetSlip={onBetPlaced} />
              {event.status === 'upcoming' && (
                <button
                  onClick={() => onSimulate(event.id)}
                  className="absolute top-4 right-4 text-xs text-gray-400 hover:text-blue-500 underline"
                >
                  Simulate
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventsList;
