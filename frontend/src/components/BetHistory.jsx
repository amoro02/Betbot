import React from 'react';

const statusStyle = {
  pending: 'bg-yellow-100 text-yellow-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-600',
};

const BetHistory = ({ bets, loading }) => {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  if (bets.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 text-center text-gray-400 border border-dashed border-gray-200">
        No bets placed yet. Head to Events to place your first bet!
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {[...bets].reverse().map(bet => (
        <div key={bet.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
          <div className="flex-1 min-w-0 mr-3">
            <p className="font-semibold text-gray-800 text-sm truncate">
              {bet.event ? `${bet.event.homeTeam} vs ${bet.event.awayTeam}` : 'Unknown Event'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Pick: <span className="font-medium text-gray-600 capitalize">{bet.selection}</span>
              {' · '}Odds: <span className="font-medium text-gray-600">{bet.odds.toFixed(2)}</span>
              {' · '}{new Date(bet.placedAt).toLocaleString()}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-gray-700">${bet.stake.toFixed(2)}</p>
            {bet.profit !== null && (
              <p className={`text-xs font-semibold ${bet.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {bet.profit >= 0 ? `+$${bet.profit.toFixed(2)}` : `-$${Math.abs(bet.profit).toFixed(2)}`}
              </p>
            )}
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyle[bet.status]}`}>
              {bet.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BetHistory;
