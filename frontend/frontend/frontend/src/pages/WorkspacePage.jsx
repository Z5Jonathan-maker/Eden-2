import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail, Calendar, HardDrive, Loader2, Shield, ArrowRight,
  Sparkles, ChevronDown, ChevronUp, WifiOff, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiGet } from '../lib/api';
import GmailTab from '../components/workspace/GmailTab';
import CalendarTab from '../components/workspace/CalendarTab';
import DriveTab from '../components/workspace/DriveTab';

/* ─── Mock overview data ─── */
// TODO: Wire to real APIs — replace with live data from /api/gmail/unread-count,
// /api/calendar/today, /api/drive/recent-count
const MOCK_OVERVIEW = {
  unreadEmails: 12,
  todayEvents: 3,
  nextEvent: { title: 'Claims Review Sync', time: '2:00 PM' },
  recentFiles: 7,
};

const TABS = [
  { id: 'mail', label: 'Mail', icon: Mail, shortcut: '1', badgeKey: 'unreadEmails' },
  { id: 'calendar', label: 'Calendar', icon: Calendar, shortcut: '2', badgeKey: 'todayEvents' },
  { id: 'drive', label: 'Drive', icon: HardDrive, shortcut: '3', badgeKey: 'recentFiles' },
];

/* ─── Badge Component ─── */
const TabBadge = ({ count }) => {
  if (!count || count <= 0) return null;
  const display = count > 99 ? '99+' : count;
  return (
    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold leading-none text-white bg-orange-500 rounded-full">
      {display}
    </span>
  );
};

/* ─── Today's Overview Strip ─── */
const OverviewStrip = ({ data, collapsed, onToggle }) => (
  <div className="border-b border-zinc-800/50">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-1.5 text-[10px] uppercase tracking-[0.15em] text-zinc-500 hover:text-zinc-400 transition-colors"
    >
      <span className="font-semibold">Today&apos;s Overview</span>
      {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
    </button>

    {!collapsed && (
      <div className="grid grid-cols-3 gap-3 px-4 pb-3">
        {/* Unread Emails */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-zinc-900/60 border border-zinc-800/50 rounded-lg">
          <div className="w-8 h-8 rounded-md bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
            <Mail className="w-4 h-4 text-orange-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-tight">{data.unreadEmails}</p>
            <p className="text-[11px] text-zinc-500 leading-tight">unread emails</p>
          </div>
        </div>

        {/* Today's Events */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-zinc-900/60 border border-zinc-800/50 rounded-lg">
          <div className="w-8 h-8 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-4 h-4 text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-tight">{data.todayEvents} events</p>
            <p className="text-[11px] text-zinc-500 leading-tight truncate">
              {data.nextEvent
                ? <>Next: <span className="text-zinc-400">{data.nextEvent.title}</span> at {data.nextEvent.time}</>
                : 'No upcoming'}
            </p>
          </div>
        </div>

        {/* Recent Files */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-zinc-900/60 border border-zinc-800/50 rounded-lg">
          <div className="w-8 h-8 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-tight">{data.recentFiles}</p>
            <p className="text-[11px] text-zinc-500 leading-tight">recent files</p>
          </div>
        </div>
      </div>
    )}
  </div>
);

/* ─── Connection Status Indicator ─── */
const ConnectionIndicator = ({ connected, needsReconnect }) => {
  if (connected && !needsReconnect) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-emerald-400 text-[11px] font-medium">LINKED</span>
      </div>
    );
  }
  if (needsReconnect) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
        <WifiOff className="w-3 h-3 text-amber-400" />
        <span className="text-amber-400 text-[11px] font-medium">STALE</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
      <WifiOff className="w-3 h-3 text-red-400" />
      <span className="text-red-400 text-[11px] font-medium">OFFLINE</span>
    </div>
  );
};

const WorkspacePage = () => {
  const [activeTab, setActiveTab] = useState(() => {
    const saved = sessionStorage.getItem('eden-workspace-tab');
    return saved && TABS.find(t => t.id === saved) ? saved : 'mail';
  });
  const [connected, setConnected] = useState(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connError, setConnError] = useState(null);
  const [overviewCollapsed, setOverviewCollapsed] = useState(() => {
    return sessionStorage.getItem('eden-workspace-overview') === 'collapsed';
  });

  const [overview] = useState(MOCK_OVERVIEW); // TODO: Replace with real API calls

  const checkConnection = useCallback(async () => {
    try {
      const res = await apiGet('/api/oauth/status/google', { cache: false });
      if (res.ok) {
        setConnected(res.data.connected);
        setNeedsReconnect(res.data.needs_reconnect || res.data.token_stale || false);
        setConnError(null);
      } else {
        setConnected(false);
        setConnError(res.status === 401 ? 'auth' : res.error || 'Failed to check connection');
      }
    } catch {
      setConnected(false);
      setConnError('Cannot reach server — it may be starting up. Try again in 30s.');
    }
  }, []);

  useEffect(() => { checkConnection(); }, [checkConnection]);
  useEffect(() => { sessionStorage.setItem('eden-workspace-tab', activeTab); }, [activeTab]);
  useEffect(() => {
    sessionStorage.setItem('eden-workspace-overview', overviewCollapsed ? 'collapsed' : 'expanded');
  }, [overviewCollapsed]);

  useEffect(() => {
    const handler = (e) => {
      if (e.altKey && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault();
        setActiveTab(TABS[parseInt(e.key) - 1].id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await apiGet('/api/oauth/google/connect');
      if (res.ok && res.data?.auth_url) {
        window.location.href = res.data.auth_url;
      } else {
        toast.error(res.error || 'Google OAuth not configured. Contact administrator.');
      }
    } catch (err) {
      console.error('Google connect error:', err);
      toast.error('Failed to connect Google');
    } finally { setConnecting(false); }
  };

  /* ─── Loading ─── */
  if (connected === null && !connError) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-orange-500" />
          <span className="text-xs text-zinc-600 font-medium tracking-wide">ESTABLISHING UPLINK...</span>
        </div>
      </div>
    );
  }

  /* ─── Connection error (server unreachable) ─── */
  if (connected === null && connError) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-full bg-red-950/50 border border-red-800/30 flex items-center justify-center mx-auto mb-6">
            <WifiOff className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Connection Failed</h1>
          <p className="text-zinc-400 mb-6 leading-relaxed text-sm">{connError}</p>
          <button onClick={checkConnection}
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-medium rounded-full transition-all shadow-lg">
            <ArrowRight className="w-4 h-4" />
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  /* ─── Needs reconnect (token stale) ─── */
  if (connected && needsReconnect) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-full bg-amber-950/50 border border-amber-800/30 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Google Session Expired</h1>
          <p className="text-zinc-400 mb-6 leading-relaxed text-sm">
            Your Google access has expired. Reconnect to continue using Gmail, Calendar, and Drive.
          </p>
          <button onClick={handleConnect} disabled={connecting}
            className="inline-flex items-center gap-3 px-6 py-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-medium rounded-full transition-all shadow-lg group">
            {connecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Reconnect Google
          </button>
        </div>
      </div>
    );
  }

  /* ─── Not connected ─── */
  if (!connected) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center max-w-md px-6">
          <div className="flex items-center justify-center gap-3 mb-8">
            {[Mail, Calendar, HardDrive].map((Icon, i) => (
              <div key={i}
                className="w-14 h-14 rounded-2xl bg-[#1a1a1a] border border-zinc-800 flex items-center justify-center"
                style={{ animationDelay: `${i * 100}ms` }}>
                <Icon className="w-6 h-6 text-orange-500" />
              </div>
            ))}
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Google Workspace</h1>
          <p className="text-zinc-400 mb-8 leading-relaxed">
            Access your Gmail, Calendar, and Drive — all within Eden.
            Your data stays synced in real-time.
          </p>
          <button onClick={handleConnect} disabled={connecting}
            className="inline-flex items-center gap-3 px-8 py-3.5 bg-white hover:bg-zinc-100 disabled:opacity-50 text-zinc-900 font-medium rounded-full transition-all shadow-lg shadow-white/10 hover:shadow-white/20 group">
            {connecting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Sign in with Google
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <div className="flex items-center justify-center gap-4 mt-8 text-[11px] text-zinc-600">
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Secure OAuth 2.0</span>
            <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> Real-time sync</span>
          </div>
          <p className="text-[10px] text-zinc-700 mt-4">
            Grants access to Gmail, Calendar & Drive. Disconnect anytime in Settings.
          </p>
        </div>
      </div>
    );
  }

  /* ─── Connected — main workspace ─── */
  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* ── Tactical Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/70 bg-[#0a0a0a]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-orange-500 rounded-full" />
            <h1 className="text-sm font-bold tracking-[0.2em] text-zinc-200 uppercase">Workspace</h1>
          </div>
          <span className="text-[10px] text-zinc-600 font-mono tracking-wider">GMAIL / CAL / DRIVE</span>
        </div>
        <ConnectionIndicator connected={connected} needsReconnect={needsReconnect} />
      </div>

      {/* ── Today's Overview Strip ── */}
      <OverviewStrip
        data={overview}
        collapsed={overviewCollapsed}
        onToggle={() => setOverviewCollapsed(prev => !prev)}
      />

      {/* ── Tab bar ── */}
      <div className="border-b border-zinc-800/70 bg-[#0f0f0f]">
        <div className="flex items-center px-4">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const badgeCount = overview[tab.badgeKey] || 0;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-150 group
                  ${isActive
                    ? 'text-white'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                  }`}
              >
                <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-orange-400' : 'group-hover:text-zinc-400'}`} />
                {tab.label}
                <TabBadge count={badgeCount} />
                <span className="text-[9px] text-zinc-600 font-mono ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">
                  Alt+{tab.shortcut}
                </span>
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-orange-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'mail' && <GmailTab />}
        {activeTab === 'calendar' && <CalendarTab />}
        {activeTab === 'drive' && <DriveTab />}
      </div>
    </div>
  );
};

export default WorkspacePage;
