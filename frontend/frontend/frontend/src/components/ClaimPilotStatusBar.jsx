import React, { useState } from 'react';

const AGENTS = [
  { name: 'ClaimMonitor', icon: '\u{1F50D}', status: 'active' },
  { name: 'VisionAnalyzer', icon: '\u{1F4F8}', status: 'active' },
  { name: 'IntakeParser', icon: '\u{1F4E5}', status: 'ready' },
  { name: 'EvidenceScorer', icon: '\u{1F4CA}', status: 'active' },
  { name: 'NegotiationCopilot', icon: '\u{1F91D}', status: 'ready' },
  { name: 'StatuteMatcher', icon: '\u2696\uFE0F', status: 'active' },
  { name: 'PredictiveAnalytics', icon: '\u{1F4C8}', status: 'ready' },
  { name: 'EstimateEngine', icon: '\u{1F4B0}', status: 'ready' },
];

const ACTIVE_COUNT = AGENTS.filter((a) => a.status === 'active').length;
const TOTAL_COUNT = AGENTS.length;

export default function ClaimPilotStatusBar() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-zinc-900/80 border border-zinc-800/60 rounded-xl hover:border-orange-500/20 transition-all group"
        aria-expanded={expanded}
        aria-controls="claimpilot-agents-panel"
      >
        <div className="relative flex-shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
          <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping opacity-30" />
        </div>
        <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
          ClaimPilot Active
        </span>
        <span className="text-xs text-zinc-600" aria-hidden="true">&mdash;</span>
        <span className="text-xs text-zinc-500">
          {TOTAL_COUNT} agents monitoring your claims
        </span>
        <svg
          className={`w-4 h-4 text-zinc-600 ml-auto transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div
          id="claimpilot-agents-panel"
          className="mt-2 p-4 bg-zinc-900/60 border border-zinc-800/40 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 animate-slide-in-bottom"
        >
          {AGENTS.map((agent) => (
            <div
              key={agent.name}
              className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800/40"
            >
              <span aria-label={agent.name}>{agent.icon}</span>
              <div>
                <div className="text-[11px] text-zinc-300 font-mono leading-tight">
                  {agent.name}
                </div>
                <div
                  className={`text-[9px] font-mono uppercase ${
                    agent.status === 'active' ? 'text-green-500' : 'text-zinc-600'
                  }`}
                >
                  {agent.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
