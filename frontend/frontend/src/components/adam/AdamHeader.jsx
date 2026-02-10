/**
 * Adam Module - Header Component
 * Tactical Military Style with 3D Icon
 */

import React from 'react';
import { Zap, CheckCircle2, AlertTriangle, XCircle, AlertCircle, Shield, Target } from 'lucide-react';
import { PAGE_ICONS } from '../../assets/badges';

const GATE_CONFIG = {
  clear: { bg: 'bg-green-500', text: 'CLEAR TO RELEASE', Icon: CheckCircle2 },
  warning: { bg: 'bg-yellow-500', text: 'REVIEW REQUIRED', Icon: AlertTriangle },
  blocked: { bg: 'bg-red-500', text: 'RELEASE BLOCKED', Icon: XCircle }
};

export const AdamHeader = ({ cqilMetrics, activeTab, setActiveTab }) => {
  const releaseGate = cqilMetrics?.release_gate || 'unknown';
  const gateInfo = GATE_CONFIG[releaseGate] || { bg: 'bg-zinc-700', text: 'UNKNOWN', Icon: AlertCircle };
  const GateIcon = gateInfo.Icon;

  const tabs = ['dashboard', 'centurion', 'tests', 'reports'];

  return (
    <div className="bg-zinc-900/80 border-b border-zinc-700/30 px-6 py-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img 
            src={PAGE_ICONS.qa_shield} 
            alt="QA Shield" 
            className="w-14 h-14 object-contain animate-glow-breathe"
            style={{ filter: 'drop-shadow(0 0 15px rgba(249, 115, 22, 0.5))' }}
          />
          <div>
            <h1 className="text-2xl font-tactical font-bold text-white uppercase tracking-wide text-glow-orange">Adam — QA Runner</h1>
            <p className="text-zinc-500 text-sm font-mono uppercase tracking-wider">CQIL Dashboard & Automated Testing</p>
          </div>
        </div>
        
        {/* Release Gate Status */}
        {cqilMetrics && (
          <div className={`px-4 py-2 rounded-lg flex items-center gap-2 ${gateInfo.bg}`}>
            <GateIcon className="w-5 h-5 text-black" />
            <span className="font-tactical font-bold text-sm text-black uppercase">{gateInfo.text}</span>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mt-4">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t-lg text-sm font-mono uppercase tracking-wider transition-all ${
              activeTab === tab 
                ? 'bg-zinc-800 text-orange-500 border-t border-l border-r border-orange-500/30' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
};

export default AdamHeader;
