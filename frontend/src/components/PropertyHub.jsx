import React, { useState } from 'react';
import { Cloud, Satellite, Shield, Home } from 'lucide-react';
import { NAV_ICONS } from '../assets/badges';
import WeatherVerification from '../features/weather/components/WeatherVerification';
import PropertyIntelligence from './PropertyIntelligence';
import DolDiscovery from './DolDiscovery';

const PropertyHub = () => {
  const [activeTab, setActiveTab] = useState('weather');

  return (
    <div className="min-h-screen page-enter">
      {/* Header */}
      <div className="bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-800/50 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <img src={NAV_ICONS.intel_hub} alt="Intel Hub" className="w-10 h-10 sm:w-12 sm:h-12 object-contain icon-3d-shadow" />
            <div>
              <h1 className="text-lg sm:text-xl font-tactical font-bold text-white tracking-wide text-glow-orange">INTEL HUB</h1>
              <p className="text-xs sm:text-sm text-zinc-500 font-mono uppercase tracking-wider">Weather & Property Intelligence</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded text-[10px] font-mono uppercase bg-green-500/10 text-green-400 border border-green-500/30 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Carrier-Defensible
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('discovery')}
            className={`px-4 py-2 rounded-lg text-sm font-mono uppercase flex items-center gap-1.5 transition-all ${
              activeTab === 'discovery'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                : 'text-zinc-400 border border-zinc-700/30 hover:text-zinc-200 hover:border-zinc-600/50'
            }`}
            data-testid="tab-discovery"
          >
            <Home className="w-4 h-4" />
            DOL Discovery
          </button>
          <button
            onClick={() => setActiveTab('weather')}
            className={`px-4 py-2 rounded-lg text-sm font-mono uppercase flex items-center gap-1.5 transition-all ${
              activeTab === 'weather'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                : 'text-zinc-400 border border-zinc-700/30 hover:text-zinc-200 hover:border-zinc-600/50'
            }`}
            data-testid="tab-weather"
          >
            <Cloud className="w-4 h-4" />
            Weather/DOL
          </button>
          <button
            onClick={() => setActiveTab('intel')}
            className={`px-4 py-2 rounded-lg text-sm font-mono uppercase flex items-center gap-1.5 transition-all ${
              activeTab === 'intel'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                : 'text-zinc-400 border border-zinc-700/30 hover:text-zinc-200 hover:border-zinc-600/50'
            }`}
            data-testid="tab-intel"
          >
            <Satellite className="w-4 h-4" />
            Property Intel
          </button>
        </div>
      </div>

      {/* Content */}
      <div>
        {activeTab === 'discovery' && <DolDiscovery embedded={true} />}
        {activeTab === 'weather' && <WeatherVerification embedded={true} />}
        {activeTab === 'intel' && <PropertyIntelligence embedded={true} />}
      </div>
    </div>
  );
};

export default PropertyHub;
