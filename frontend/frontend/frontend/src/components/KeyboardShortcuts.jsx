import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Keyboard } from 'lucide-react';

const SHORTCUT_GROUPS = [
  {
    title: 'Global',
    shortcuts: [
      { keys: ['Ctrl', 'K'], description: 'Command Palette' },
      { keys: ['?'], description: 'This help' },
      { keys: ['G', 'then', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'then', 'C'], description: 'Go to Claims' },
      { keys: ['G', 'then', 'E'], description: 'Go to Eve AI' },
    ],
  },
  {
    title: 'Claims List',
    shortcuts: [
      { keys: ['/'], description: 'Focus search' },
      { keys: ['N'], description: 'New claim' },
      { keys: ['1', '2', '3'], description: 'Switch view mode' },
    ],
  },
  {
    title: 'Eve AI',
    shortcuts: [
      { keys: ['Enter'], description: 'Send message' },
    ],
  },
  {
    title: 'Workspace',
    shortcuts: [
      { keys: ['Alt', '1', '2', '3'], description: 'Switch tabs' },
    ],
  },
];

const KeyBadge = ({ label }) => {
  const isSeparator = label === 'then';

  if (isSeparator) {
    return (
      <span className="text-[10px] text-zinc-500 font-mono mx-0.5">then</span>
    );
  }

  return (
    <kbd className="inline-flex items-center justify-center bg-zinc-800 border border-zinc-600 rounded px-2 py-0.5 text-xs font-mono text-zinc-300 shadow-sm min-w-[24px] text-center">
      {label}
    </kbd>
  );
};

const KeyboardShortcuts = () => {
  const [isOpen, setIsOpen] = useState(false);
  const overlayRef = useRef(null);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && isOpen) {
      setIsOpen(false);
      return;
    }

    // Open on '?' — ignore if user is typing in an input/textarea
    const tag = e.target.tagName;
    const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;

    if (e.key === '?' && !isEditable && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    }
  }, [isOpen]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) {
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div className="bg-[#1a1a1a] border border-zinc-700/50 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <Keyboard className="w-4 h-4 text-orange-400" />
            </div>
            <h2 className="text-base font-tactical font-bold text-white tracking-wide">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-orange-500/60"
            aria-label="Close shortcuts"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-widest mb-3">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm text-zinc-300">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                      {shortcut.keys.map((key, idx) => (
                        <KeyBadge key={`${key}-${idx}`} label={key} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
            Press <KeyBadge label="?" /> to toggle
          </span>
          <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
            <KeyBadge label="Esc" /> to close
          </span>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcuts;
