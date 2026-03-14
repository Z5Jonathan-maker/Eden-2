import React, { useMemo } from 'react';
import LeaderboardRow from './LeaderboardRow';
import { LeaderboardEntry } from './types';

interface Props {
  entries: LeaderboardEntry[];
}

const calculateRankScore = (e: LeaderboardEntry) =>
  e.totalXp * 0.6 +
  e.missionsCompleted * 0.25 +
  e.rewardsClaimed * 0.1 +
  e.streakDaily * 0.03 +
  e.streakWeekly * 0.02;

const LeaderboardTab: React.FC<Props> = ({ entries }) => {
  const ranked = useMemo(() => {
    return [...entries]
      .map((entry) => ({ ...entry, rankScore: calculateRankScore(entry) }))
      .sort((a, b) => b.rankScore - a.rankScore)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  }, [entries]);

  return (
    <section className="space-y-3">
      {ranked.map((entry) => (
        <LeaderboardRow key={entry.id} entry={entry} />
      ))}
      {!ranked.length && (
        <p className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-4 text-sm text-zinc-500">
          No operators on leaderboard yet.
        </p>
      )}
    </section>
  );
};

export default LeaderboardTab;
