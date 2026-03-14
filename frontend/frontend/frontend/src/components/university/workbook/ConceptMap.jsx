import React from 'react';
import { Network } from 'lucide-react';

const ConceptMap = ({ data }) => {
  const { center_concept, connections } = data.content_payload;

  const domainColors = {
    leadership: { bg: 'bg-blue-950/30', border: 'border-blue-600/40', text: 'text-blue-300', dot: 'bg-blue-500' },
    accountability: { bg: 'bg-purple-950/30', border: 'border-purple-600/40', text: 'text-purple-300', dot: 'bg-purple-500' },
    communication: { bg: 'bg-emerald-950/30', border: 'border-emerald-600/40', text: 'text-emerald-300', dot: 'bg-emerald-500' },
    execution: { bg: 'bg-amber-950/30', border: 'border-amber-600/40', text: 'text-amber-300', dot: 'bg-amber-500' },
  };

  return (
    <div className="col-span-full rounded-xl border border-zinc-700/50 bg-zinc-800/60 overflow-hidden">
      <div className="bg-zinc-900/80 px-6 py-4 border-b border-zinc-700/30 flex items-center gap-3">
        <Network className="w-5 h-5 text-orange-500" />
        <span className="text-orange-500 font-mono text-[10px] tracking-[0.3em] uppercase">Concept Map</span>
      </div>

      <div className="p-6">
        <div className="flex flex-col items-center">
          <div className="rounded-xl bg-gradient-to-br from-orange-600/20 to-orange-800/10 border border-orange-500/40 px-8 py-5 text-center mb-8">
            <p className="text-orange-300 font-bold text-lg">{center_concept}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl">
            {connections.map((conn, i) => {
              const domain = conn.domain?.toLowerCase() || 'leadership';
              const colors = domainColors[domain] || domainColors.leadership;

              return (
                <div
                  key={i}
                  className={`rounded-lg border ${colors.border} ${colors.bg} p-5`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                    <span className={`font-mono text-[10px] tracking-[0.3em] uppercase ${colors.text}`}>
                      {conn.domain}
                    </span>
                  </div>
                  <p className="text-zinc-300 text-sm font-medium mb-1">{conn.connection_label}</p>
                  <p className="text-zinc-500 text-xs leading-relaxed">{conn.explanation}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConceptMap;
