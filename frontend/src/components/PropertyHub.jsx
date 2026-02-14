import React, { useState, useRef, useCallback } from 'react';
import { Satellite, Shield, Home, Building2 } from 'lucide-react';
import { NAV_ICONS } from '../assets/badges';
import DolDiscovery from './DolDiscovery';
import PropertyIntelligence from './PropertyIntelligence';
import PermitsPanel from './intel/PermitsPanel';
import ReportGenerator from './intel/ReportGenerator';

const TABS = [
  { key: 'discovery', label: 'DOL Discovery',     icon: Home,      description: 'Find carrier-defensible dates' },
  { key: 'intel',     label: 'Property Imagery',   icon: Satellite, description: 'Historical aerial footage' },
  { key: 'permits',   label: 'Permits',            icon: Building2, description: 'Building permit history' },
];

const PropertyHub = () => {
  const [activeTab, setActiveTab] = useState('discovery');

  // Refs to pull data from each tab for report generation
  const dolDataRef = useRef({});
  const imageryDataRef = useRef({});
  const permitsDataRef = useRef({});

  const getDolData = useCallback(() => dolDataRef.current, []);
  const getImageryData = useCallback(() => imageryDataRef.current, []);
  const getPermitsData = useCallback(() => permitsDataRef.current, []);

  return (
    <div className="min-h-screen page-enter flex flex-col">
      {/* Header */}
      <div className="bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-800/50 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <img src={NAV_ICONS.intel_hub} alt="Intel Hub" className="w-10 h-10 sm:w-12 sm:h-12 object-contain icon-3d-shadow" />
            <div>
              <h1 className="text-lg sm:text-xl font-tactical font-bold text-white tracking-wide text-glow-orange">INTEL HUB</h1>
              <p className="text-xs sm:text-sm text-zinc-500 font-mono uppercase tracking-wider">DOL Discovery · Imagery · Permits</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded text-[10px] font-mono uppercase bg-green-500/10 text-green-400 border border-green-500/30 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Carrier-Defensible
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 rounded-lg text-sm font-mono uppercase flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === key
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                  : 'text-zinc-400 border border-zinc-700/30 hover:text-zinc-200 hover:border-zinc-600/50'
              }`}
              data-testid={`tab-${key}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1">
        {activeTab === 'discovery' && (
          <div className="flex flex-col min-h-full">
            <div className="flex-1">
              <DolDiscovery embedded onDataChange={(d) => { dolDataRef.current = d; }} />
            </div>
            <ReportGenerator context="dol_discovery" getData={getDolData} />
          </div>
        )}
        {activeTab === 'intel' && (
          <div className="flex flex-col min-h-full">
            <div className="flex-1">
              <PropertyIntelligence embedded onDataChange={(d) => { imageryDataRef.current = d; }} />
            </div>
            <ReportGenerator context="property_imagery" getData={getImageryData} />
          </div>
        )}
        {activeTab === 'permits' && (
          <div className="flex flex-col min-h-full">
            <div className="flex-1">
              <PermitsPanel onDataChange={(d) => { permitsDataRef.current = d; }} />
            </div>
            <ReportGenerator context="permits" getData={getPermitsData} />
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyHub;
