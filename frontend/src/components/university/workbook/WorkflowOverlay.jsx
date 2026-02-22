import React, { useState } from 'react';
import { Layers, MapPin, Search, FileText, MessageSquare, Scale, Users } from 'lucide-react';

const phaseIcons = {
  door_knocking: MapPin,
  inspections: Search,
  documentation: FileText,
  client_communication: MessageSquare,
  carrier_negotiation: Scale,
  internal_accountability: Users,
};

const phaseLabels = {
  door_knocking: 'Door Knocking',
  inspections: 'Inspections',
  documentation: 'Documentation',
  client_communication: 'Client Communication',
  carrier_negotiation: 'Carrier Negotiation',
  internal_accountability: 'Internal Accountability',
};

const WorkflowOverlay = ({ data }) => {
  const { principle_name, phases } = data.content_payload;
  const [activePhase, setActivePhase] = useState(0);

  return (
    <div className="col-span-full rounded-xl border border-zinc-700/50 bg-zinc-800/60 overflow-hidden">
      <div className="bg-zinc-900/80 px-6 py-4 border-b border-zinc-700/30 flex items-center gap-3">
        <Layers className="w-5 h-5 text-orange-500" />
        <span className="text-orange-500 font-mono text-[10px] tracking-[0.3em] uppercase">Workflow Overlay</span>
        {principle_name && (
          <span className="text-zinc-400 text-sm ml-2">{principle_name}</span>
        )}
      </div>

      <div className="flex flex-col md:flex-row">
        <div className="md:w-56 border-b md:border-b-0 md:border-r border-zinc-700/30 bg-zinc-900/40">
          {phases.map((phase, i) => {
            const IconComponent = phaseIcons[phase.phase_id] || Layers;
            const isActive = activePhase === i;

            return (
              <button
                key={i}
                onClick={() => setActivePhase(i)}
                className={`w-full text-left px-5 py-4 flex items-center gap-3 transition-colors border-b border-zinc-800/50 last:border-b-0 ${
                  isActive
                    ? 'bg-orange-600/10 border-l-2 border-l-orange-500'
                    : 'hover:bg-zinc-800/50 border-l-2 border-l-transparent'
                }`}
              >
                <IconComponent className={`w-4 h-4 ${isActive ? 'text-orange-500' : 'text-zinc-500'}`} />
                <span className={`text-sm ${isActive ? 'text-orange-300 font-medium' : 'text-zinc-400'}`}>
                  {phaseLabels[phase.phase_id] || phase.phase_id}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 p-6">
          {phases[activePhase] && (
            <div className="space-y-4">
              <h4 className="text-white font-semibold text-base">
                {phaseLabels[phases[activePhase].phase_id] || phases[activePhase].phase_id}
              </h4>
              <p className="text-zinc-300 text-sm leading-relaxed">
                {phases[activePhase].application}
              </p>
              {phases[activePhase].tactical_note && (
                <div className="bg-orange-950/15 border border-orange-800/20 rounded-lg p-4">
                  <span className="text-orange-500 font-mono text-[10px] tracking-[0.2em] uppercase block mb-1">
                    Tactical Note
                  </span>
                  <p className="text-zinc-300 text-sm">{phases[activePhase].tactical_note}</p>
                </div>
              )}
              {phases[activePhase].do_this && (
                <div className="bg-green-950/10 border border-green-800/20 rounded-lg p-4">
                  <span className="text-green-500 font-mono text-[10px] tracking-[0.2em] uppercase block mb-1">
                    Do This
                  </span>
                  <p className="text-zinc-300 text-sm">{phases[activePhase].do_this}</p>
                </div>
              )}
              {phases[activePhase].avoid_this && (
                <div className="bg-red-950/10 border border-red-800/20 rounded-lg p-4">
                  <span className="text-red-500 font-mono text-[10px] tracking-[0.2em] uppercase block mb-1">
                    Avoid This
                  </span>
                  <p className="text-zinc-300 text-sm">{phases[activePhase].avoid_this}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowOverlay;
