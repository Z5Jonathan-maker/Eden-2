import React, { useMemo, useState } from 'react';

const STATUS_CONFIG = {
  'New': { color: '#3b82f6', label: 'New' },
  'In Progress': { color: '#f97316', label: 'In Progress' },
  'Under Review': { color: '#eab308', label: 'Under Review' },
  'Approved': { color: '#22c55e', label: 'Approved' },
  'Denied': { color: '#ef4444', label: 'Denied' },
  'Completed': { color: '#10b981', label: 'Completed' },
  'Closed': { color: '#6b7280', label: 'Closed' },
};

const MIN_SEGMENT_PERCENT = 3;

const StatusDistribution = ({ claims = [] }) => {
  const [hoveredStatus, setHoveredStatus] = useState(null);

  const segments = useMemo(() => {
    if (claims.length === 0) return [];

    const counts = {};
    for (const claim of claims) {
      const status = claim.status || 'New';
      counts[status] = (counts[status] || 0) + 1;
    }

    const total = claims.length;
    return Object.entries(STATUS_CONFIG)
      .filter(([status]) => counts[status] > 0)
      .map(([status, config]) => {
        const count = counts[status];
        const rawPercent = (count / total) * 100;
        const displayPercent = Math.max(rawPercent, MIN_SEGMENT_PERCENT);
        return {
          status,
          count,
          percent: rawPercent,
          width: displayPercent,
          color: config.color,
          label: config.label,
        };
      });
  }, [claims]);

  if (claims.length === 0) {
    return (
      <div className="card-tactical p-4 sm:p-5 shadow-tactical">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-scale-pulse" />
          <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">
            Status Distribution
          </h3>
        </div>
        <div className="h-8 rounded-lg bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center">
          <span className="text-xs font-mono text-zinc-500">No claims data</span>
        </div>
      </div>
    );
  }

  const totalWidth = segments.reduce((sum, s) => sum + s.width, 0);

  return (
    <div className="card-tactical p-4 sm:p-5 shadow-tactical">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-scale-pulse" />
          <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">
            Status Distribution
          </h3>
        </div>
        <span className="text-[10px] font-mono text-zinc-500 uppercase">
          {claims.length} total
        </span>
      </div>

      {/* Stacked bar */}
      <div className="relative h-8 sm:h-10 rounded-lg overflow-hidden bg-zinc-800/50 border border-zinc-700/30 flex">
        {segments.map((segment, i) => {
          const normalizedWidth = (segment.width / totalWidth) * 100;
          return (
            <div
              key={segment.status}
              className="relative h-full transition-all duration-300 cursor-pointer group"
              style={{
                width: `${normalizedWidth}%`,
                backgroundColor: segment.color,
                opacity: hoveredStatus && hoveredStatus !== segment.status ? 0.4 : 1,
              }}
              onMouseEnter={() => setHoveredStatus(segment.status)}
              onMouseLeave={() => setHoveredStatus(null)}
            >
              {/* Tooltip */}
              <div
                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10"
              >
                <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
                  <p className="text-xs font-tactical font-bold text-white">{segment.label}</p>
                  <p className="text-[10px] font-mono text-zinc-400">
                    {segment.count} claim{segment.count !== 1 ? 's' : ''} ({segment.percent.toFixed(1)}%)
                  </p>
                </div>
                <div
                  className="w-2 h-2 bg-zinc-900 border-b border-r border-zinc-700 rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1"
                />
              </div>

              {/* Segment divider */}
              {i > 0 && (
                <div className="absolute left-0 top-0 bottom-0 w-px bg-zinc-900/50" />
              )}

              {/* Inline label for wide segments */}
              {normalizedWidth > 12 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-mono font-bold text-white/90 drop-shadow-sm">
                    {segment.count}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {segments.map((segment) => (
          <div
            key={segment.status}
            className="flex items-center gap-1.5 cursor-pointer transition-opacity duration-200"
            style={{ opacity: hoveredStatus && hoveredStatus !== segment.status ? 0.4 : 1 }}
            onMouseEnter={() => setHoveredStatus(segment.status)}
            onMouseLeave={() => setHoveredStatus(null)}
          >
            <div
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: segment.color }}
            />
            <span className="text-[10px] font-mono text-zinc-400">
              {segment.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatusDistribution;
