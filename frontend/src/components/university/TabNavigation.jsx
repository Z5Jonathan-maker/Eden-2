/**
 * University Module - Tab Navigation Component
 * Tactical Military Style
 */

import React from 'react';
import { Button } from '../../shared/ui/button';
import { BookOpen, FileText, PlayCircle, Award, FolderOpen, Library } from 'lucide-react';

const TABS = [
  { id: 'courses', label: 'Courses', icon: BookOpen },
  { id: 'articles', label: 'Articles', icon: FileText },
  { id: 'videos', label: 'Videos', icon: PlayCircle },
  { id: 'certificates', label: 'My Certificates', icon: Award },
  { id: 'library', label: 'Library', icon: Library }
];

export const TabNavigation = ({ activeTab, setActiveTab, onTabChange, showFirmContent }) => {
  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-mono uppercase tracking-wider transition-all ${
              isActive 
                ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]' 
                : 'bg-zinc-800/50 text-zinc-400 hover:text-white border border-zinc-700/30 hover:border-zinc-600'
            }`}
          >
            <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
            {tab.label}
          </button>
        );
      })}
      
      {showFirmContent && (
        <button
          onClick={() => handleTabClick('firm')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-mono uppercase tracking-wider transition-all ${
            activeTab === 'firm'
              ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]' 
              : 'bg-zinc-800/50 text-zinc-400 hover:text-white border border-zinc-700/30 hover:border-zinc-600'
          }`}
        >
          <FolderOpen className="w-3 h-3 sm:w-4 sm:h-4" />
          Firm Content
        </button>
      )}
    </div>
  );
};

export default TabNavigation;
