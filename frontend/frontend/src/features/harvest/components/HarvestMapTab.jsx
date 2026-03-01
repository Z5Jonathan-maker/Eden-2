/**
 * HarvestMapTab - Map view with filters, GO FIELD button, and stats footer
 *
 * Wraps the existing HarvestMap component with the action bar and stat footer.
 * Full-width on mobile with reduced height for stats footer.
 */
import React, { useState } from 'react';
import HarvestMap from '../../../components/HarvestMap';
import HarvestFilters, { FILTER_OPTIONS } from './HarvestFilters';
import HarvestStatsFooter from './HarvestStatsFooter';
import { Crosshair } from 'lucide-react';

const ALL_CODES = FILTER_OPTIONS.map((f) => f.code);

const HarvestMapTab = ({ myStats, onPinStatusChange, onEnterFieldMode }) => {
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState(ALL_CODES);

  return (
    <div className="h-full flex flex-col">
      {/* Top bar: GO FIELD + Filter */}
      <div className="absolute top-3 right-3 z-[1100] flex items-center gap-2">
        {/* GO FIELD MODE button */}
        <button
          onClick={onEnterFieldMode}
          className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-3 sm:px-4 py-2 flex items-center gap-1.5 sm:gap-2 font-bold text-xs sm:text-sm shadow-lg active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
          data-testid="enter-field-mode"
        >
          <Crosshair className="w-4 h-4" />
          <span className="hidden sm:inline">GO FIELD</span>
          <span className="sm:hidden">GO</span>
        </button>

        {/* Filter controls */}
        <HarvestFilters
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          activeFilters={activeFilters}
          setActiveFilters={setActiveFilters}
        />
      </div>

      {/* Map — full width, flex-1 height */}
      <div className="flex-1 relative min-h-0 w-full">
        <HarvestMap onPinStatusChange={onPinStatusChange} activeFilters={activeFilters} />
      </div>

      {/* Stats Footer */}
      <HarvestStatsFooter myStats={myStats} />
    </div>
  );
};

export default HarvestMapTab;
