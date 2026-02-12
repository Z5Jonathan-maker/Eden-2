import React from 'react';
import { Satellite, Shield } from 'lucide-react';
import { NAV_ICONS } from '../assets/badges';
import PropertyIntelligence from './PropertyIntelligence';

const PropertyHub = () => {
  return (
    <div className="min-h-screen page-enter">
      {/* Header */}
      <div className="bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-800/50 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <img src={NAV_ICONS.intel_hub} alt="Intel Hub" className="w-10 h-10 sm:w-12 sm:h-12 object-contain icon-3d-shadow" />
            <div>
              <h1 className="text-lg sm:text-xl font-tactical font-bold text-white tracking-wide text-glow-orange">INTEL HUB</h1>
              <p className="text-xs sm:text-sm text-zinc-500 font-mono uppercase tracking-wider">Property Intel + DOL Discovery</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded text-[10px] font-mono uppercase bg-green-500/10 text-green-400 border border-green-500/30 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Carrier-Defensible
          </span>
        </div>
        <div className="px-3 py-2 rounded-lg text-sm font-mono uppercase flex items-center gap-1.5 text-zinc-300 border border-zinc-700/40 w-fit">
          <Satellite className="w-4 h-4 text-orange-400" />
          Unified Property Intelligence
        </div>
      </div>

      {/* Content */}
      <div>
        <PropertyIntelligence embedded={true} />
      </div>
    </div>
  );
};

export default PropertyHub;
