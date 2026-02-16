/**
 * GifPicker — Expanded GIF library with search and categories
 */

import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';

const GIF_LIBRARY = [
  // Approval & Success
  { id: 'thumbs-up', label: 'Thumbs Up', tags: ['approval', 'good', 'done', 'yes'], category: 'reactions', url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif' },
  { id: 'great-job', label: 'Great Job', tags: ['win', 'great', 'success', 'congrats'], category: 'reactions', url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif' },
  { id: 'celebrate', label: 'Celebrate', tags: ['celebrate', 'hype', 'team', 'party'], category: 'reactions', url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif' },
  { id: 'high-five', label: 'High Five', tags: ['team', 'highfive', 'great', 'win'], category: 'reactions', url: 'https://media.giphy.com/media/3oEjHV0z8S7WM4MwnK/giphy.gif' },
  { id: 'applause', label: 'Applause', tags: ['clap', 'bravo', 'amazing', 'well done'], category: 'reactions', url: 'https://media.giphy.com/media/nbvFVPiEiJH6JOGIok/giphy.gif' },
  { id: 'mic-drop', label: 'Mic Drop', tags: ['mic', 'drop', 'boss', 'done'], category: 'reactions', url: 'https://media.giphy.com/media/3o7qDEq2bMbcbPRQ2c/giphy.gif' },

  // Work & Hustle
  { id: 'on-it', label: 'On It', tags: ['working', 'confirm', 'roger', 'copy'], category: 'work', url: 'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif' },
  { id: 'let-go', label: "Let's Go", tags: ['go', 'push', 'energy', 'hype'], category: 'work', url: 'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif' },
  { id: 'typing', label: 'Typing', tags: ['working', 'typing', 'busy'], category: 'work', url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif' },
  { id: 'hustle', label: 'Hustle', tags: ['run', 'hustle', 'fast', 'grind'], category: 'work', url: 'https://media.giphy.com/media/3oKIPjzfv0sI2p7fDW/giphy.gif' },
  { id: 'focus', label: 'Focus', tags: ['focus', 'concentrate', 'work'], category: 'work', url: 'https://media.giphy.com/media/IPbS5R4fSUl5S/giphy.gif' },
  { id: 'salute', label: 'Salute', tags: ['salute', 'roger', 'copy', 'sir'], category: 'work', url: 'https://media.giphy.com/media/rHR8qP1mC5V3G/giphy.gif' },

  // Emotion & Reaction
  { id: 'wow', label: 'Wow', tags: ['wow', 'reaction', 'surprised', 'shock'], category: 'emotions', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif' },
  { id: 'facepalm', label: 'Facepalm', tags: ['fail', 'facepalm', 'ugh', 'really'], category: 'emotions', url: 'https://media.giphy.com/media/XsUtdIeJ0MWMo/giphy.gif' },
  { id: 'thinking', label: 'Thinking', tags: ['think', 'hmm', 'consider', 'wonder'], category: 'emotions', url: 'https://media.giphy.com/media/a5viI92PAF89q/giphy.gif' },
  { id: 'laugh', label: 'Laughing', tags: ['laugh', 'lol', 'funny', 'haha'], category: 'emotions', url: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif' },
  { id: 'mind-blown', label: 'Mind Blown', tags: ['mindblown', 'shocked', 'whoa'], category: 'emotions', url: 'https://media.giphy.com/media/xT0xeJpnrWC3xWRBe0/giphy.gif' },
  { id: 'no-way', label: 'No Way', tags: ['no', 'nope', 'refuse', 'disagree'], category: 'emotions', url: 'https://media.giphy.com/media/spfi6nabVuq5y/giphy.gif' },

  // Greetings & Social
  { id: 'wave', label: 'Wave', tags: ['hi', 'hello', 'wave', 'hey'], category: 'social', url: 'https://media.giphy.com/media/xUPGGDNsLvqsBOhuU0/giphy.gif' },
  { id: 'thank-you', label: 'Thank You', tags: ['thanks', 'thank', 'grateful', 'appreciate'], category: 'social', url: 'https://media.giphy.com/media/osjgQPWRx3cac/giphy.gif' },
  { id: 'welcome', label: 'Welcome', tags: ['welcome', 'new', 'join', 'onboard'], category: 'social', url: 'https://media.giphy.com/media/l0MYGb1LuZ3n7dRnO/giphy.gif' },
  { id: 'cheers', label: 'Cheers', tags: ['cheers', 'toast', 'drink', 'celebrate'], category: 'social', url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif' },
  { id: 'deal', label: 'Deal', tags: ['deal', 'handshake', 'agree', 'done'], category: 'social', url: 'https://media.giphy.com/media/l0HlDDyxBfSaPpU88/giphy.gif' },
  { id: 'coffee', label: 'Coffee', tags: ['coffee', 'morning', 'break', 'caffeine'], category: 'social', url: 'https://media.giphy.com/media/DrJm6F9poo4aA/giphy.gif' },
];

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'reactions', label: 'Reactions' },
  { id: 'work', label: 'Work' },
  { id: 'emotions', label: 'Emotions' },
  { id: 'social', label: 'Social' },
];

const GifPicker = ({ onSelect, onClose }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  const filtered = useMemo(() => {
    let gifs = GIF_LIBRARY;
    if (category !== 'all') {
      gifs = gifs.filter((g) => g.category === category);
    }
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      gifs = gifs.filter(
        (g) =>
          g.label.toLowerCase().includes(q) ||
          g.tags.some((t) => t.includes(q))
      );
    }
    return gifs;
  }, [query, category]);

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 mx-4 bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl overflow-hidden z-30 max-h-[380px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">GIFs</h4>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search GIFs..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/40 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500/40"
            autoFocus
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`px-2 py-1 rounded-md text-[10px] font-mono uppercase whitespace-nowrap transition-colors ${
              category === cat.id
                ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:bg-zinc-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-hide">
        <div className="grid grid-cols-3 gap-2">
          {filtered.map((gif) => (
            <button
              key={gif.id}
              onClick={() => onSelect(gif.url, '')}
              className="relative rounded-lg overflow-hidden border border-zinc-800 hover:border-orange-500/40 transition-all group aspect-square"
            >
              <img
                src={gif.url}
                alt={gif.label}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                <span className="text-[10px] text-white font-medium">{gif.label}</span>
              </div>
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="text-xs text-zinc-500 text-center py-6 font-mono">No GIFs found</p>
        )}
      </div>
    </div>
  );
};

export default GifPicker;
