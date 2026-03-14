/**
 * HarvestLeaderboard - Enzy-style leaderboard with podium + ranked list
 *
 * Features:
 * - Period filter (Today / Week / Month / All Time)
 * - Top-3 podium with medal avatars
 * - Scrollable ranked list for remaining players
 * - Responsive text (text-xs sm:text-sm) and podium scaling
 */
import React from 'react';
import {
  Trophy,
  RefreshCw,
  TrendingUp,
  ChevronDown,
} from 'lucide-react';

const PERIODS = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'all', label: 'All Time' },
];

// ---- Sub-components ----

const PodiumAvatar = ({ player, actualRank }) => {
  const ringColor =
    actualRank === 1
      ? 'ring-4 ring-amber-400'
      : actualRank === 2
        ? 'ring-4 ring-zinc-400'
        : 'ring-4 ring-orange-400';

  const medal = actualRank === 1 ? '\uD83E\uDD47' : actualRank === 2 ? '\uD83E\uDD48' : '\uD83E\uDD49';
  const pillarClass =
    actualRank === 1
      ? 'harvest-podium-1st'
      : actualRank === 2
        ? 'harvest-podium-2nd'
        : 'harvest-podium-3rd';

  return (
    <div className="harvest-podium-step">
      <div className="relative">
        <div
          className={`harvest-podium-avatar ${ringColor}`}
          style={{
            backgroundColor: `hsl(${((player.user_id?.charCodeAt(0) || 0) * 30) % 360}, 70%, 45%)`,
          }}
        >
          <div className="w-full h-full flex items-center justify-center text-white text-lg sm:text-2xl font-tactical font-bold">
            {(player.user_name || player.name || '?').charAt(0).toUpperCase()}
          </div>
        </div>
        <span className="absolute -bottom-1 -right-1 text-base sm:text-xl">{medal}</span>
      </div>
      <p className="text-xs sm:text-sm font-tactical font-semibold text-white mt-2 truncate max-w-[70px] sm:max-w-[80px]">
        {player.user_name || player.name}
      </p>
      <p className="text-[10px] sm:text-xs text-zinc-400 font-mono">
        {player.points || 0} pts
      </p>
      <div className={pillarClass}>
        <span className="text-sm sm:text-lg font-tactical">{actualRank}</span>
      </div>
    </div>
  );
};

const RankRow = ({ entry, rank }) => {
  const getTrendIcon = (trend) => {
    if (trend > 0) return <TrendingUp className="w-3 h-3 text-emerald-500" />;
    if (trend < 0) return <ChevronDown className="w-3 h-3 text-red-500" />;
    return null;
  };

  return (
    <div
      className="card-tactical flex items-center gap-2 sm:gap-3 p-3 sm:p-4 harvest-animate-in"
      style={{ animationDelay: `${(rank - 4) * 0.05}s` }}
    >
      <div
        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-tactical font-bold text-xs sm:text-sm ${
          rank <= 3
            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
            : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/30'
        }`}
      >
        {rank}
      </div>

      <div
        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-tactical font-semibold shrink-0"
        style={{
          backgroundColor: `hsl(${((entry.user_id?.charCodeAt(0) || 0) * 30) % 360}, 60%, 45%)`,
        }}
      >
        {(entry.user_name || entry.name || '?').charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-tactical font-semibold text-white truncate text-xs sm:text-sm">
          {entry.user_name || entry.name}
        </p>
        <p className="text-[10px] sm:text-xs text-zinc-400 font-mono">
          {entry.visits || entry.total_visits || 0} doors
        </p>
      </div>

      <div className="text-right flex items-center gap-1 sm:gap-2 shrink-0">
        <div className="flex flex-col items-end">
          <p className="font-tactical font-bold text-orange-400 text-sm sm:text-lg">
            {entry.points || 0}
          </p>
          <p className="text-[10px] sm:text-xs text-zinc-500 font-mono">pts</p>
        </div>
        {getTrendIcon(entry.trend)}
      </div>
    </div>
  );
};

// ---- Main Component ----

const HarvestLeaderboard = ({
  leaderboard,
  period,
  setPeriod,
  loading,
  fetchLeaderboard,
}) => {
  const podiumPlayers = leaderboard.slice(0, 3);
  const restOfLeaderboard = leaderboard.slice(3);

  const getPodiumOrder = () => {
    if (podiumPlayers.length < 3) return podiumPlayers;
    return [podiumPlayers[1], podiumPlayers[0], podiumPlayers[2]];
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/95">
      {/* Period Filter */}
      <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-2 bg-zinc-900 border-b border-zinc-700/50">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex-1 flex bg-zinc-800/50 rounded-full p-1 border border-zinc-700/30 overflow-x-auto">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`flex-1 py-1.5 sm:py-2 px-2 sm:px-3 text-xs sm:text-sm font-mono uppercase tracking-wider rounded-full transition-all duration-200 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                  period === p.value
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'text-zinc-400 hover:text-zinc-300'
                }`}
                data-testid={`period-${p.value}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchLeaderboard}
            disabled={loading}
            className="w-9 h-9 sm:w-10 sm:h-10 bg-zinc-800/50 rounded-full flex items-center justify-center hover:bg-zinc-700/50 border border-zinc-700/30 transition-all active:scale-95 shrink-0 focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
            aria-label="Refresh leaderboard"
            data-testid="refresh-leaderboard"
          >
            <RefreshCw className={`w-4 h-4 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto harvest-content bg-zinc-900/95">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="spinner-tactical w-8 h-8" />
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-zinc-800/50 rounded-full flex items-center justify-center mb-4 border border-zinc-700/30">
              <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-zinc-600" />
            </div>
            <p className="text-base sm:text-lg font-tactical font-bold text-white uppercase">
              No Rankings Yet
            </p>
            <p className="text-xs sm:text-sm text-zinc-400 font-mono mt-1">
              Start knocking doors to climb the leaderboard!
            </p>
          </div>
        ) : (
          <>
            {/* Podium */}
            {podiumPlayers.length >= 3 && (
              <div className="px-3 sm:px-4 pt-4 sm:pt-6 pb-3 sm:pb-4 bg-gradient-to-b from-zinc-900 to-zinc-900/95">
                <div className="harvest-podium">
                  {getPodiumOrder().map((player, displayIdx) => {
                    const actualRank = displayIdx === 1 ? 1 : displayIdx === 0 ? 2 : 3;
                    return (
                      <PodiumAvatar
                        key={player.user_id || displayIdx}
                        player={player}
                        actualRank={actualRank}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ranked list */}
            <div className="px-3 sm:px-4 space-y-2 pb-4">
              {(podiumPlayers.length < 3 ? leaderboard : restOfLeaderboard).map(
                (entry, idx) => {
                  const rank = podiumPlayers.length < 3 ? idx + 1 : idx + 4;
                  return (
                    <RankRow key={entry.user_id || idx} entry={entry} rank={rank} />
                  );
                }
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HarvestLeaderboard;
