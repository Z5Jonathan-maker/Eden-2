/**
 * Adam Module - Header Component
 * Tactical Military Style with 3D Icon
 */

import React from 'react';
import {
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertCircle,
  Shield,
  Target,
} from 'lucide-react';
import { PAGE_ICONS } from '../../assets/badges';

const GATE_CONFIG = {
  clear: { bg: 'bg-green-500', text: 'CLEAR TO RELEASE', Icon: CheckCircle2 },
  warning: { bg: 'bg-yellow-500', text: 'REVIEW REQUIRED', Icon: AlertTriangle },
  blocked: { bg: 'bg-red-500', text: 'RELEASE BLOCKED', Icon: XCircle },
};

const TAB_ICONS = {
  dashboard: Target,
  centurion: Shield,
  tests: Zap,
  reports: AlertTriangle,
};

export const AdamHeader = ({ cqilMetrics, activeTab, setActiveTab }) => {
  const releaseGate = cqilMetrics?.release_gate || 'unknown';
  const gateInfo = GATE_CONFIG[releaseGate] || {
    bg: 'bg-zinc-700',
    text: 'UNKNOWN',
    Icon: AlertCircle,
  };
  const GateIcon = gateInfo.Icon;

  const tabs = ['dashboard', 'centurion', 'tests', 'reports'];

  const systemScore = cqilMetrics?.overall_score;

  return (
    <div className="bg-[#1a1a1a] border-b border-zinc-700/50 px-6 py-5 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img
            src={PAGE_ICONS.qa_shield}
            alt="QA Shield"
            width={56}
            height={56}
            className="w-14 h-14 object-contain animate-glow-breathe"
            style={{ filter: 'drop-shadow(0 0 15px rgba(249, 115, 22, 0.5))' }}
          />
          <div>
            <h1 className="text-2xl font-tactical font-bold text-white uppercase tracking-wide text-glow-orange flex items-center gap-3">
              QA Command
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono bg-green-500/15 text-green-400 border border-green-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                ONLINE
              </span>
            </h1>
            <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest mt-1">
              CQIL Dashboard & Automated Testing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* System Score */}
          {systemScore != null && (
            <div className="text-center px-4 py-2 rounded-lg bg-zinc-900/60 border border-zinc-700/50">
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Score</p>
              <p className={`text-2xl font-bold font-mono ${systemScore >= 80 ? 'text-green-400' : systemScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                {systemScore}
              </p>
            </div>
          )}

          {/* Release Gate Status */}
          {cqilMetrics && (
            <div className={`px-4 py-2.5 rounded-lg flex items-center gap-2 ${gateInfo.bg}`}>
              <GateIcon className="w-5 h-5 text-black" />
              <span className="font-tactical font-bold text-sm text-black uppercase">
                {gateInfo.text}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mt-5">
        {tabs.map((tab) => {
          const TabIcon = TAB_ICONS[tab];
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 rounded-t-lg text-sm font-mono uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === tab
                  ? 'bg-[#0a0a0a] text-orange-500 border-t border-l border-r border-orange-500/30'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
              }`}
            >
              <TabIcon className="w-4 h-4" />
              {tab}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AdamHeader;
