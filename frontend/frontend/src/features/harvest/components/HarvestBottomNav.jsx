/**
 * HarvestBottomNav - Mobile-first bottom tab navigation
 *
 * 5-tab bar: Map, Today, Ranks, Challenges, Profile.
 * Highlights active tab with orange accent.
 */
import React from 'react';
import {
  Map as MapIcon,
  Trophy,
  Target,
  User,
  Calendar,
} from 'lucide-react';

const TABS = [
  { id: 'map', label: 'Map', icon: MapIcon },
  { id: 'today', label: 'Today', icon: Calendar },
  { id: 'leaderboard', label: 'Ranks', icon: Trophy },
  { id: 'challenges', label: 'Challenges', icon: Target },
  { id: 'profile', label: 'Profile', icon: User },
];

const HarvestBottomNav = ({ activeTab, setActiveTab }) => (
  <div className="bg-zinc-900 border-t border-zinc-700/50 px-1 py-1 safe-area-inset-bottom">
    <div className="grid grid-cols-5 max-w-lg mx-auto">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex flex-col items-center justify-center py-1.5 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
              isActive
                ? 'bg-orange-500/10 text-orange-400'
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
            data-testid={`harvest-${tab.id}-tab`}
          >
            <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-orange-400' : ''}`} />
            <span
              className={`text-[9px] sm:text-[10px] font-mono uppercase tracking-wider ${
                isActive ? 'text-orange-400' : ''
              }`}
            >
              {tab.label}
            </span>
            {isActive && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-orange-500 rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  </div>
);

export default HarvestBottomNav;
