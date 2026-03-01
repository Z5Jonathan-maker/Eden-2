/**
 * HarvestStatsFooter - Compact stats bar below the map
 *
 * Shows today/week counts, streak, and deals on a single row.
 * Responsive text sizing for small screens.
 */
import React from 'react';

const HarvestStatsFooter = ({ myStats }) => (
  <div className="bg-zinc-900 border-t border-zinc-800/50 px-2 sm:px-3 py-1.5">
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-zinc-400 font-mono text-[10px] sm:text-xs">
          TODAY{' '}
          <span className="text-white font-bold">{myStats.today || 0}</span>
        </span>
        <span className="text-zinc-400 font-mono text-[10px] sm:text-xs">
          WEEK{' '}
          <span className="text-white font-bold">{myStats.week || 0}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        {myStats.streak > 0 && (
          <span className="text-orange-400 font-bold text-[10px] sm:text-xs">
            {'\uD83D\uDD25'}{myStats.streak}
          </span>
        )}
        <span className="text-zinc-400 font-mono text-[10px] sm:text-xs">
          DEALS{' '}
          <span className="text-green-400 font-bold">
            {myStats.signed || myStats.deals || 0}
          </span>
        </span>
      </div>
    </div>
  </div>
);

export default HarvestStatsFooter;
