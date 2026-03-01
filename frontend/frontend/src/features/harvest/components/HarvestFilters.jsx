/**
 * HarvestFilters - Filter panel for map pin statuses
 *
 * Renders filter toggle button and expandable filter panel.
 * Uses flex-wrap for mobile responsiveness.
 */
import React from 'react';
import { Filter, ChevronUp, ChevronDown } from 'lucide-react';

/** 6-pin filter configuration */
export const FILTER_OPTIONS = [
  { code: 'NA', label: 'No Answer', color: '#FBBF24' },
  { code: 'NI', label: 'Not Interested', color: '#EF4444' },
  { code: 'RN', label: 'Renter', color: '#F97316' },
  { code: 'FU', label: 'Follow Up', color: '#8B5CF6' },
  { code: 'AP', label: 'Appointment', color: '#3B82F6' },
  { code: 'DL', label: 'Deal', color: '#10B981' },
];

const ALL_CODES = FILTER_OPTIONS.map((f) => f.code);

const HarvestFilters = ({ showFilters, setShowFilters, activeFilters, setActiveFilters }) => {
  const toggleFilter = (code) => {
    setActiveFilters((prev) =>
      prev.includes(code) ? prev.filter((f) => f !== code) : [...prev, code]
    );
  };

  const selectAll = () => setActiveFilters(ALL_CODES);
  const clearAll = () => setActiveFilters([]);

  return (
    <>
      {/* Filter toggle button */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="bg-zinc-900/85 backdrop-blur-lg rounded-lg px-3 py-2 border border-zinc-700/50 flex items-center gap-1.5 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
        data-testid="toggle-filters"
      >
        <Filter className="w-4 h-4" />
        <span className="text-xs font-mono hidden sm:inline">Filter</span>
        {showFilters ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>

      {/* Expandable filter panel */}
      {showFilters && (
        <div
          className="absolute top-full right-0 mt-2 bg-zinc-900/90 backdrop-blur-lg rounded-xl p-3 border border-zinc-700/50 min-w-[220px] sm:min-w-[260px]"
          data-testid="filter-panel"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
              Status
            </span>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-[10px] text-orange-400 hover:underline font-mono focus-visible:ring-2 focus-visible:ring-orange-500/60"
                data-testid="select-all-filters"
              >
                All
              </button>
              <span className="text-zinc-700">|</span>
              <button
                onClick={clearAll}
                className="text-[10px] text-zinc-400 hover:underline font-mono focus-visible:ring-2 focus-visible:ring-orange-500/60"
                data-testid="clear-all-filters"
              >
                None
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_OPTIONS.map(({ code, label, color }) => (
              <button
                key={code}
                onClick={() => toggleFilter(code)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-mono uppercase transition-all focus-visible:ring-2 focus-visible:ring-orange-500/60 ${
                  activeFilters.includes(code)
                    ? 'text-white shadow-sm'
                    : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/30'
                }`}
                style={activeFilters.includes(code) ? { backgroundColor: color } : {}}
                data-testid={`filter-${code}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default HarvestFilters;
