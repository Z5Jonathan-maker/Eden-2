/**
 * ChatSearch — Search overlay with filters (Cmd+K trigger)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, X, Filter, MessageSquare, FileText, Hash, User,
} from 'lucide-react';

const formatTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ChatSearch = ({ onSearch, onClose, onNavigate, channels = [] }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [channelFilter, setChannelFilter] = useState('');
  const [senderFilter, setSenderFilter] = useState('');
  const [hasFile, setHasFile] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keyboard shortcut to close
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const doSearch = useCallback(async (q) => {
    if (!q.trim() && !channelFilter && !senderFilter && !hasFile) {
      setResults([]);
      return;
    }
    setLoading(true);
    const res = await onSearch({
      q: q.trim(),
      channelId: channelFilter,
      sender: senderFilter,
      hasFile,
    });
    if (res?.ok) setResults(res.data?.results || []);
    setLoading(false);
  }, [onSearch, channelFilter, senderFilter, hasFile]);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 400);
  };

  const handleResultClick = (msg) => {
    onNavigate(msg.channel_id, msg.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/50">
          <Search className="w-5 h-5 text-zinc-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search messages, files, people..."
            className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1.5 rounded-lg transition-colors ${
              showFilters ? 'text-orange-400 bg-orange-500/10' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="px-4 py-3 border-b border-zinc-800/30 flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Hash className="w-3.5 h-3.5 text-zinc-500" />
              <select
                value={channelFilter}
                onChange={(e) => { setChannelFilter(e.target.value); doSearch(query); }}
                className="bg-zinc-800 border border-zinc-700/50 text-xs text-zinc-300 rounded-md px-2 py-1 focus:outline-none"
              >
                <option value="">All channels</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>{ch.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                value={senderFilter}
                onChange={(e) => setSenderFilter(e.target.value)}
                placeholder="Sender name"
                className="bg-zinc-800 border border-zinc-700/50 text-xs text-zinc-300 rounded-md px-2 py-1 w-28 focus:outline-none"
                onBlur={() => doSearch(query)}
              />
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={hasFile}
                onChange={(e) => { setHasFile(e.target.checked); doSearch(query); }}
                className="rounded border-zinc-600 bg-zinc-800 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-xs text-zinc-400">Has file</span>
            </label>
          </div>
        )}

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="spinner-tactical w-6 h-6" />
            </div>
          ) : results.length > 0 ? (
            <div className="py-1">
              {results.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => handleResultClick(msg)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-zinc-800/40 transition-colors"
                >
                  <div className="w-7 h-7 rounded bg-zinc-800 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-zinc-400 mt-0.5">
                    {(msg.sender_name || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-sm font-medium text-zinc-200">{msg.sender_name}</span>
                      <span className="text-[10px] text-zinc-600 font-mono">in #{msg.channel_name}</span>
                      <span className="text-[10px] text-zinc-600 font-mono ml-auto flex-shrink-0">{formatTime(msg.created_at)}</span>
                    </div>
                    <p className="text-sm text-zinc-400 truncate">
                      {msg.type === 'attachment' && <FileText className="w-3 h-3 inline mr-1 text-blue-400" />}
                      {msg.body}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : query.trim() ? (
            <div className="flex flex-col items-center py-8">
              <MessageSquare className="w-8 h-8 text-zinc-700 mb-2" />
              <p className="text-xs text-zinc-500 font-mono">No results found</p>
            </div>
          ) : (
            <div className="flex flex-col items-center py-8">
              <Search className="w-8 h-8 text-zinc-700 mb-2" />
              <p className="text-xs text-zinc-500 font-mono">Type to search messages</p>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-zinc-800/30 flex items-center gap-4">
          <span className="text-[10px] text-zinc-600 font-mono">ESC to close</span>
          <span className="text-[10px] text-zinc-600 font-mono">Click result to navigate</span>
        </div>
      </div>
    </div>
  );
};

export default ChatSearch;
