import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  Target,
  Zap,
  Brain,
  Map,
  GraduationCap,
  Briefcase,
  Camera,
  FileSignature,
  Eye,
  Scale,
  TrendingUp,
  MapPin,
  Database,
  Shield,
  Award,
  BarChart,
  Settings,
  Plus,
  Sparkles,
  Users,
  ArrowRight,
  Command,
  MessageSquare,
  FileText,
  HardDrive,
  UserCog,
  Mail,
  Clock,
} from 'lucide-react';
import { apiGet } from '../lib/api';

// ---------------------------------------------------------------------------
// Icon registry — maps string keys to Lucide components
// ---------------------------------------------------------------------------
const ICON_MAP = {
  LayoutDashboard,
  Target,
  Zap,
  Brain,
  Map,
  GraduationCap,
  Briefcase,
  Camera,
  FileSignature,
  Eye,
  Scale,
  TrendingUp,
  MapPin,
  Database,
  Shield,
  Award,
  BarChart,
  Settings,
  Plus,
  Sparkles,
  Users,
  Command,
  MessageSquare,
  FileText,
  HardDrive,
  UserCog,
  Mail,
};

// ---------------------------------------------------------------------------
// Static page & action definitions
// ---------------------------------------------------------------------------
const PAGES = [
  { label: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard', category: 'Navigation' },
  { label: 'Garden (Claims)', path: '/claims', icon: 'Target', category: 'Navigation' },
  { label: 'Eve AI', path: '/eve', icon: 'Zap', category: 'Navigation' },
  { label: 'ClaimPilot', path: '/claimpilot', icon: 'Brain', category: 'Navigation' },
  { label: 'Harvest', path: '/canvassing', icon: 'Map', category: 'Navigation' },
  { label: 'University', path: '/university', icon: 'GraduationCap', category: 'Navigation' },
  { label: 'Workspace', path: '/workspace', icon: 'Briefcase', category: 'Navigation' },
  { label: 'Inspections', path: '/inspections', icon: 'Camera', category: 'Navigation' },
  { label: 'Contracts', path: '/contracts', icon: 'FileSignature', category: 'Navigation' },
  { label: 'Vision Board', path: '/vision', icon: 'Eye', category: 'Navigation' },
  { label: 'Scales', path: '/scales', icon: 'Scale', category: 'Navigation' },
  { label: 'Sales Ops', path: '/sales', icon: 'TrendingUp', category: 'Navigation' },
  { label: 'Property Intel', path: '/property', icon: 'MapPin', category: 'Navigation' },
  { label: 'Data Ops', path: '/data', icon: 'Database', category: 'Navigation' },
  { label: 'Florida Laws', path: '/florida-laws', icon: 'Shield', category: 'Navigation' },
  { label: 'Battle Pass', path: '/battle-pass', icon: 'Award', category: 'Navigation' },
  { label: 'Performance', path: '/performance', icon: 'BarChart', category: 'Navigation' },
  { label: 'Comms', path: '/comms/chat', icon: 'MessageSquare', category: 'Navigation' },
  { label: 'Documents', path: '/documents', icon: 'FileText', category: 'Navigation' },
  { label: 'Storage', path: '/storage', icon: 'HardDrive', category: 'Navigation' },
  { label: 'Settings', path: '/settings', icon: 'Settings', category: 'Navigation' },
  { label: 'New Claim', path: '/claims/new', icon: 'Plus', category: 'Actions' },
  { label: 'Ask Eve AI', path: '/eve', icon: 'Sparkles', category: 'Actions' },
  { label: 'View Experts', path: '/experts', icon: 'Users', category: 'Actions' },
  { label: 'Email Intel', path: '/email-intelligence', icon: 'Mail', category: 'Actions' },
];

// ---------------------------------------------------------------------------
// Persistence helpers for "recently visited"
// ---------------------------------------------------------------------------
const RECENT_KEY = 'eden_cmd_recent_v1';
const MAX_RECENT = 6;

const loadRecent = () => {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveRecent = (path) => {
  try {
    const prev = loadRecent().filter((p) => p !== path);
    const next = [path, ...prev].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — ignore
  }
};

// ---------------------------------------------------------------------------
// Fuzzy match — simple substring + token matching
// ---------------------------------------------------------------------------
const fuzzyMatch = (query, text) => {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  // Token match: every word in query appears somewhere in text
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((tok) => t.includes(tok));
};

// ---------------------------------------------------------------------------
// Debounce hook
// ---------------------------------------------------------------------------
const useDebounce = (value, delay) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [claimResults, setClaimResults] = useState([]);
  const [searchingClaims, setSearchingClaims] = useState(false);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();

  const debouncedQuery = useDebounce(query, 250);

  // ---- Global shortcut: Ctrl+K / Cmd+K ----
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ---- Focus input when opened ----
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setClaimResults([]);
      // Slight delay to let animation start
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // ---- Search claims via API ----
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setClaimResults([]);
      return;
    }

    let cancelled = false;
    const fetchClaims = async () => {
      setSearchingClaims(true);
      try {
        const data = await apiGet(`/api/claims/?search=${encodeURIComponent(debouncedQuery)}&limit=5`);
        if (!cancelled) {
          const claims = Array.isArray(data) ? data : data?.results ?? data?.data ?? [];
          setClaimResults(claims.slice(0, 5));
        }
      } catch {
        if (!cancelled) setClaimResults([]);
      } finally {
        if (!cancelled) setSearchingClaims(false);
      }
    };
    fetchClaims();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // ---- Build flat results list ----
  const results = useMemo(() => {
    const items = [];
    const q = query.trim();

    if (!q) {
      // Show recently visited pages
      const recentPaths = loadRecent();
      const recentItems = recentPaths
        .map((p) => PAGES.find((pg) => pg.path === p))
        .filter(Boolean)
        .map((pg) => ({ ...pg, category: 'Recent' }));
      if (recentItems.length > 0) {
        items.push(...recentItems);
      }
      // Also show all navigation items when empty
      items.push(...PAGES.filter((p) => p.category === 'Navigation'));
      items.push(...PAGES.filter((p) => p.category === 'Actions'));
      return items;
    }

    // Filter pages by fuzzy match
    const matchedPages = PAGES.filter((p) => fuzzyMatch(q, p.label));
    const nav = matchedPages.filter((p) => p.category === 'Navigation');
    const actions = matchedPages.filter((p) => p.category === 'Actions');

    if (nav.length > 0) items.push(...nav);
    if (actions.length > 0) items.push(...actions);

    // Add claim search results
    if (claimResults.length > 0) {
      claimResults.forEach((claim) => {
        items.push({
          label: `${claim.claim_number || claim.claimNumber || 'Claim'} — ${claim.client_name || claim.clientName || claim.insured_name || 'Unknown'}`,
          path: `/claims/${claim._id || claim.id}`,
          icon: 'Target',
          category: 'Claims',
        });
      });
    }

    return items;
  }, [query, claimResults]);

  // ---- Keep selected index in bounds ----
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length, query]);

  // ---- Scroll selected item into view ----
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${selectedIndex}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // ---- Select handler ----
  const handleSelect = useCallback(
    (item) => {
      if (!item) return;
      saveRecent(item.path);
      navigate(item.path);
      setOpen(false);
    },
    [navigate],
  );

  // ---- Keyboard navigation ----
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      }
    },
    [results, selectedIndex, handleSelect],
  );

  if (!open) return null;

  // ---- Group results by category for display ----
  const grouped = [];
  let lastCat = null;
  results.forEach((item, idx) => {
    if (item.category !== lastCat) {
      grouped.push({ type: 'header', category: item.category, key: `h-${item.category}` });
      lastCat = item.category;
    }
    grouped.push({ type: 'item', item, idx, key: `i-${idx}` });
  });

  const isMac = navigator.platform?.toUpperCase().includes('MAC');
  const shortcutLabel = isMac ? '\u2318K' : 'Ctrl+K';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-xl bg-[#1a1a1a] border border-zinc-700/50 rounded-xl shadow-2xl overflow-hidden animate-cmd-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60">
          <Search className="w-5 h-5 text-zinc-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, claims, actions..."
            className="flex-1 bg-transparent text-lg font-mono text-zinc-100 placeholder-zinc-500 outline-none"
            aria-label="Command palette search"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[11px] font-mono text-zinc-400">
            {shortcutLabel}
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto overscroll-contain py-2">
          {grouped.length === 0 && query.trim() && !searchingClaims && (
            <div className="px-4 py-8 text-center text-sm font-mono text-zinc-500">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {searchingClaims && claimResults.length === 0 && query.trim().length >= 2 && (
            <div className="px-4 py-3 text-xs font-mono text-zinc-500 flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              Searching claims...
            </div>
          )}

          {grouped.map((entry) => {
            if (entry.type === 'header') {
              return (
                <div
                  key={entry.key}
                  className="px-4 pt-3 pb-1 text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-widest select-none"
                >
                  {entry.category === 'Recent' && (
                    <Clock className="inline-block w-3 h-3 mr-1 -mt-0.5" />
                  )}
                  {entry.category}
                </div>
              );
            }

            const { item, idx } = entry;
            const isSelected = idx === selectedIndex;
            const IconComp = ICON_MAP[item.icon] || ArrowRight;

            return (
              <button
                key={entry.key}
                data-idx={idx}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 ${
                  isSelected
                    ? 'bg-orange-500/10 border-l-2 border-orange-500'
                    : 'border-l-2 border-transparent hover:bg-orange-500/5'
                }`}
              >
                <IconComp
                  className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-orange-400' : 'text-zinc-500'}`}
                />
                <span
                  className={`flex-1 text-sm font-medium truncate ${
                    isSelected ? 'text-zinc-100' : 'text-zinc-300'
                  }`}
                >
                  {item.label}
                </span>
                <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider flex-shrink-0">
                  {item.category}
                </span>
                {isSelected && <ArrowRight className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-zinc-800/60 text-[10px] font-mono text-zinc-600">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-500">&uarr;&darr;</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-500">Enter</kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-500">Esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
