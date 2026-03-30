import React from 'react';

const StatCard = ({ label, value, color = 'text-white' }) => (
  <div className="bg-white/10 rounded-lg p-4 text-center">
    <p className="text-blue-200 text-xs uppercase tracking-wide mb-1">{label}</p>
    <p className={`text-xl font-bold ${color}`}>{value}</p>
  </div>
);

const Bankroll = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 rounded-xl p-6 animate-pulse">
        <div className="h-8 bg-white/20 rounded w-40 mx-auto mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white/10 rounded-lg p-4 h-16" />
          ))}
        </div>
      </div>
    );
  }

  const roi =
    stats.betsPlaced > 0
      ? (((stats.totalWon - stats.totalLost) / (stats.totalWon + stats.totalLost || 1)) * 100).toFixed(1)
      : '0.0';

  const winRate =
    stats.betsPlaced > 0
      ? (((stats.betsWon / (stats.betsWon + stats.betsLost || 1)) * 100).toFixed(1))
      : '0.0';

  return (
    <div className="bg-gradient-to-r from-blue-700 to-blue-900 rounded-xl p-6 shadow-lg">
      <div className="text-center mb-5">
        <p className="text-blue-200 text-sm uppercase tracking-widest mb-1">Current Balance</p>
        <p className="text-4xl font-extrabold text-white">${stats.balance?.toFixed(2)}</p>
        {stats.lastFetched && (
          <p className="text-blue-300 text-xs mt-1">
            Live odds · updated {new Date(stats.lastFetched).toLocaleTimeString()}
            {stats.oddsApiRemaining != null && ` · ${stats.oddsApiRemaining} API calls left`}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Bets Placed" value={stats.betsPlaced} />
        <StatCard
          label="Win Rate"
          value={`${winRate}%`}
          color={parseFloat(winRate) >= 50 ? 'text-green-300' : 'text-red-300'}
        />
        <StatCard
          label="Net P&L"
          value={`$${(stats.totalWon - stats.totalLost).toFixed(2)}`}
          color={stats.totalWon >= stats.totalLost ? 'text-green-300' : 'text-red-300'}
        />
        <StatCard label="Pending" value={stats.betsPending} color="text-yellow-300" />
      </div>
    </div>
  );
};

export default Bankroll;
