/**
 * Leaderboard Tab Component for Harvest
 */

import React from 'react';
import { Avatar, AvatarFallback } from '../../../shared/ui/avatar';
import { Trophy, Crown, Flame } from 'lucide-react';
import RankBadge from './RankBadge';
import './HarvestAnimations.css';

const LeaderboardTab = ({ leaderboard, leaderboardPeriod, setLeaderboardPeriod, myStats }) => {
  const periods = ['day', 'week', 'month', 'all_time'];

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <div className="flex-1 overflow-auto bg-zinc-950 p-3 sm:p-4">
      {/* Period Selector */}
      <div className="flex justify-center gap-2 mb-4">
        {periods.map((period) => (
          <button
            key={period}
            onClick={() => setLeaderboardPeriod(period)}
            className={`px-3 py-1.5 rounded-full text-xs font-tactical uppercase transition-all ${
              leaderboardPeriod === period
                ? 'bg-orange-500 text-zinc-900'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-700'
            }`}
          >
            {period === 'all_time' ? 'All Time' : period.charAt(0).toUpperCase() + period.slice(1)}
          </button>
        ))}
      </div>

      {/* My Stats Card */}
      {myStats && (
        <div className="bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-400 text-xs font-tactical uppercase">Your Stats</p>
              <p className="text-white text-2xl font-tactical font-bold">
                {myStats.today_points || 0} pts today
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-orange-400">
                <Flame className="w-4 h-4" />
                <span className="font-bold">{myStats.streak || 0}</span>
                <span className="text-xs">day streak</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-900 px-5 py-2 rounded-full font-tactical font-bold shadow-lg">
          <Trophy className="w-5 h-5" />
          LEADERBOARD
        </div>
        <p className="text-zinc-500 text-sm font-mono mt-2">
          {leaderboardPeriod === 'day' && "Today's Top Performers"}
          {leaderboardPeriod === 'week' && "This Week's Top Performers"}
          {leaderboardPeriod === 'month' && "This Month's Top Performers"}
          {leaderboardPeriod === 'all_time' && 'All-Time Champions'}
        </p>
      </div>

      {leaderboard.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-400 font-tactical">No activity yet</p>
          <p className="text-zinc-500 text-sm mt-2 font-mono">Start knocking to earn points!</p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          <div className="flex justify-center items-end gap-4 mb-8">
            {/* 2nd Place */}
            {leaderboard[1] && (
              <PodiumPosition entry={leaderboard[1]} position={2} getInitials={getInitials} />
            )}

            {/* 1st Place */}
            {leaderboard[0] && (
              <div className="text-center -mt-6 harvest-bp-card harvest-grid-overlay">
                <Crown className="w-8 h-8 text-amber-400 mx-auto mb-1" />
                <Avatar className="w-20 h-20 border-4 border-amber-400 mx-auto ring-4 ring-amber-400/30">
                  <AvatarFallback className="bg-gradient-to-br from-amber-400 to-orange-500 text-white font-bold text-xl">
                    {getInitials(leaderboard[0]?.user_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="mt-2 flex justify-center">
                  <RankBadge rank={1} justRankedUp={leaderboard[0]?.change > 0} label="Leader" />
                </div>
                <div className="bg-amber-400 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold mx-auto -mt-4 relative z-10">
                  1
                </div>
                <p className="text-white font-bold mt-2 text-lg">
                  {leaderboard[0]?.user_name?.split(' ')[0] || 'Unknown'}
                </p>
                <p className="text-green-400 font-bold text-xl">{leaderboard[0]?.score || 0} pts</p>
                <StreakBadges entry={leaderboard[0]} />
              </div>
            )}

            {/* 3rd Place */}
            {leaderboard[2] && (
              <PodiumPosition entry={leaderboard[2]} position={3} getInitials={getInitials} />
            )}
          </div>

          {/* Rest of Leaderboard */}
          <div className="space-y-2">
            {leaderboard.slice(3).map((entry, idx) => (
              <LeaderboardRow
                key={entry.user_id || idx}
                entry={entry}
                rank={idx + 4}
                getInitials={getInitials}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// Podium position (2nd/3rd place)
const PodiumPosition = ({ entry, position, getInitials }) => {
  const borderColor = position === 2 ? 'border-gray-400' : 'border-amber-700';
  const bgGradient =
    position === 2
      ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-700'
      : 'bg-gradient-to-br from-amber-600 to-amber-800 text-white';
  const positionBg = position === 2 ? 'bg-gray-400' : 'bg-amber-700';

  return (
    <div className="text-center harvest-bp-card harvest-grid-overlay">
      <Avatar className={`w-16 h-16 border-4 ${borderColor} mx-auto`}>
        <AvatarFallback className={`${bgGradient} font-bold text-lg`}>
          {getInitials(entry?.user_name)}
        </AvatarFallback>
      </Avatar>
      <div className="mt-2 flex justify-center">
        <RankBadge rank={position} justRankedUp={entry?.change > 0} label="Rank" />
      </div>
      <div
        className={`${positionBg} text-white w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm mx-auto -mt-3 relative z-10`}
      >
        {position}
      </div>
      <p className="text-white font-medium mt-2">{entry?.user_name?.split(' ')[0] || 'Unknown'}</p>
      <p className="text-green-400 font-bold">{entry?.score || 0} pts</p>
      <StreakBadges entry={entry} />
    </div>
  );
};

// Streak and badges display
const StreakBadges = ({ entry }) => (
  <div className="flex items-center justify-center gap-1 text-zinc-500 text-xs mt-1">
    {entry?.streak > 0 && (
      <span className="flex items-center gap-0.5 text-orange-400">
        <Flame className="w-3 h-3" />
        {entry.streak}
      </span>
    )}
    {entry?.badges?.map((b, i) => (
      <span key={i}>{b}</span>
    ))}
  </div>
);

// Leaderboard row (4th place and below)
const LeaderboardRow = ({ entry, rank, getInitials }) => (
  <div
    className={`flex items-center gap-4 rounded-xl p-4 harvest-bp-card harvest-grid-overlay ${
      entry.is_current_user ? 'bg-orange-500/20 border border-orange-500/30' : 'bg-zinc-900'
    }`}
  >
    <span className="text-zinc-500 font-bold w-6">{entry.rank || rank}</span>
    <Avatar className="w-10 h-10">
      <AvatarFallback
        className={`${entry.is_current_user ? 'bg-orange-500' : 'bg-gray-700'} text-white font-medium`}
      >
        {getInitials(entry.user_name)}
      </AvatarFallback>
    </Avatar>
    <div className="flex-1">
      <p className="text-white font-medium">
        {entry.user_name || 'Unknown'}
        {entry.is_current_user && <span className="text-orange-400 text-xs ml-2">(You)</span>}
      </p>
      <StreakBadges entry={entry} />
    </div>
    <p className="text-green-400 font-bold">{entry.score || 0} pts</p>
  </div>
);

export default LeaderboardTab;
