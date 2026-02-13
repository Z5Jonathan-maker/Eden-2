import React, { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { LeaderboardEntry } from './types';

interface Props {
  entry: LeaderboardEntry & { rank: number; rankScore: number };
}

const LeaderboardRow: React.FC<Props> = ({ entry }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const changeIcon =
    entry.change > 0 ? (
      <ArrowUpRight className="h-3 w-3 text-emerald-300" />
    ) : entry.change < 0 ? (
      <ArrowDownRight className="h-3 w-3 text-rose-300" />
    ) : (
      <Minus className="h-3 w-3 text-zinc-500" />
    );

  const changeLabel = entry.change > 0 ? `+${entry.change}` : `${entry.change}`;

  return (
    <div
      className={`bp-leader-row bp-hover-glow p-3 ${entry.rank <= 3 ? `bp-top-${entry.rank}` : ''} ${entry.change > 0 ? 'bp-rank-up' : ''} ${mounted ? 'bp-row-mounted' : ''}`}
      style={{ animationDelay: `${Math.min((entry.rank || 1) * 40, 280)}ms` }}
    >
      <div className="grid items-center gap-3 md:grid-cols-[60px_52px_1fr_auto_auto_auto]">
        <div className="text-center">
          <p className="text-xs font-mono uppercase tracking-wider text-zinc-500">Rank</p>
          <p className="text-xl font-bold text-white">#{entry.rank}</p>
        </div>
        <img
          src={entry.avatarUrl}
          alt={entry.name}
          className="h-12 w-12 rounded-full border border-zinc-700 bg-zinc-900 object-contain p-1"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{entry.name}</p>
          <p className="truncate text-xs text-zinc-400">{entry.title}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">XP</p>
          <p className="text-sm font-semibold text-cyan-300">{entry.totalXp.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            Tier / Score
          </p>
          <p className="text-sm font-semibold text-amber-300">
            T{entry.tierLevel} • {Math.round(entry.rankScore)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Delta</p>
          <p className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-300">
            {changeIcon}
            {changeLabel}
          </p>
        </div>
      </div>
      <div className="mt-2 grid gap-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500 md:grid-cols-4">
        <span>Missions {entry.missionsCompleted}</span>
        <span>Rewards {entry.rewardsClaimed}</span>
        <span>Daily streak {entry.streakDaily}</span>
        <span>Weekly streak {entry.streakWeekly}</span>
      </div>
    </div>
  );
};

export default LeaderboardRow;
