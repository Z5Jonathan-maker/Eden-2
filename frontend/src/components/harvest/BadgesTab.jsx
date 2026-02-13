/**
 * Badges Tab Component for Harvest
 */

import React from 'react';
import { Badge } from '../shared/ui/badge';
import { Award } from 'lucide-react';

const DEFAULT_BADGES = [
  { icon: '🌱', name: 'First Fruits', desc: 'First signed contract' },
  { icon: '🚪', name: '100 Club', desc: '100 doors in one day' },
  { icon: '🔥', name: 'On Fire', desc: '5-day knock streak' },
  { icon: '🌾', name: 'Abundant', desc: '10 appointments/week' },
  { icon: '🏆', name: 'Top Harvester', desc: '#1 weekly ranking' },
  { icon: '💎', name: 'Diamond', desc: '50 signed contracts' },
  { icon: '🦅', name: 'Early Bird', desc: 'First knock before 8am' },
  { icon: '🌙', name: 'Night Owl', desc: 'Knock after 7pm' },
  { icon: '💯', name: 'Century', desc: '100 total signed' },
];

const RARITY_STYLES = {
  legendary: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  epic: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  rare: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  uncommon: 'bg-green-500/20 text-green-400 border-green-500/30',
  common: 'bg-gray-500/20 text-gray-600 border-gray-500/30',
};

const BadgesTab = ({ badges }) => {
  const hasBadges = badges?.badges?.length > 0;

  return (
    <div className="flex-1 overflow-auto bg-zinc-950 p-3 sm:p-4">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-5 py-2 rounded-full font-tactical font-bold shadow-lg">
          <Award className="w-5 h-5" />
          BADGES
        </div>
        <p className="text-zinc-500 text-sm font-mono mt-2">
          {badges?.earned_count || 0} / {badges?.total_count || 10} earned
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {hasBadges
          ? badges.badges.map((badge) => <BadgeCard key={badge.id} badge={badge} />)
          : DEFAULT_BADGES.map((badge, i) => (
              <div
                key={i}
                className="text-center p-3 sm:p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/30 opacity-60 grayscale"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-2 rounded-full bg-zinc-800 flex items-center justify-center text-2xl sm:text-3xl">
                  {badge.icon}
                </div>
                <p className="text-zinc-400 font-tactical text-xs sm:text-sm">{badge.name}</p>
                <p className="text-zinc-600 text-[10px] sm:text-xs mt-1">{badge.desc}</p>
              </div>
            ))}
      </div>
    </div>
  );
};

const BadgeCard = ({ badge }) => {
  const earned = badge.earned;

  return (
    <div
      className={`text-center p-3 sm:p-4 rounded-xl transition-all ${
        earned
          ? 'bg-zinc-800 border border-amber-500/30 ring-1 ring-amber-500/20'
          : 'bg-zinc-800/50 border border-zinc-700/30 opacity-60 grayscale'
      }`}
    >
      <div
        className={`w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-2 rounded-full flex items-center justify-center text-2xl sm:text-3xl ${
          earned
            ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/30'
            : 'bg-zinc-700'
        }`}
      >
        {badge.icon || '🏅'}
      </div>
      <p className={`font-tactical text-xs sm:text-sm ${earned ? 'text-white' : 'text-zinc-500'}`}>
        {badge.name}
      </p>
      <p className="text-zinc-500 text-[10px] sm:text-xs mt-1 line-clamp-2">{badge.description}</p>
      {earned && badge.earned_at && <p className="text-green-400 text-xs mt-2">✓ Earned</p>}
      {!earned && badge.points_bonus > 0 && (
        <p className="text-amber-400/60 text-xs mt-2">+{badge.points_bonus} pts</p>
      )}
      {badge.rarity && (
        <Badge
          className={`mt-2 text-[10px] ${RARITY_STYLES[badge.rarity] || RARITY_STYLES.common}`}
        >
          {badge.rarity}
        </Badge>
      )}
    </div>
  );
};

export default BadgesTab;
