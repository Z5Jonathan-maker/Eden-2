/**
 * ReactionBar — Quick reaction buttons for messages
 * Lightweight component; the main emoji picker lives inside MessageBubble's hover actions.
 */

import React from 'react';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '👀', '🙌'];

const ReactionBar = ({ onSelect, className = '' }) => (
  <div className={`flex gap-1 ${className}`}>
    {QUICK_EMOJIS.map((emoji) => (
      <button
        key={emoji}
        onClick={() => onSelect(emoji)}
        className="p-1.5 hover:bg-zinc-800 rounded text-lg transition-colors"
      >
        {emoji}
      </button>
    ))}
  </div>
);

export default ReactionBar;
