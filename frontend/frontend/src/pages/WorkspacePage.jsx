import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail, Calendar, HardDrive, Loader2, Link2, CheckCircle2,
  Shield, ArrowRight, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiGet } from '../lib/api';
import GmailTab from '../components/workspace/GmailTab';
import CalendarTab from '../components/workspace/CalendarTab';
import DriveTab from '../components/workspace/DriveTab';

const TABS = [
  { id: 'mail', label: 'Mail', icon: Mail, shortcut: '1' },
  { id: 'calendar', label: 'Calendar', icon: Calendar, shortcut: '2' },
  { id: 'drive', label: 'Drive', icon: HardDrive, shortcut: '3' },
];

const WorkspacePage = () => {
  const [activeTab, setActiveTab] = useState(() => {
    const saved = sessionStorage.getItem('eden-workspace-tab');
    return saved && TABS.find(t => t.id === saved) ? saved : 'mail';
  });
  const [connected, setConnected] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const checkConnection = useCallback(async () => {
    try {
      const res = await apiGet('/api/oauth/status/google');
      setConnected(res.ok ? res.data.connected : false);
    } catch { setConnected(false); }
  }, []);

  useEffect(() => { checkConnection(); }, [checkConnection]);

  // Persist active tab
  useEffect(() => { sessionStorage.setItem('eden-workspace-tab', activeTab); }, [activeTab]);

  // Keyboard shortcuts: Alt+1/2/3
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
  if (connected === null) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-orange-500" />
          <span className="text-xs text-zinc-600 font-medium">Connecting to Google...</span>
        </div>
      </div>
    );
  }

  /* ─── Not connected ─── */
  if (!connected) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950">
        <div className="text-center max-w-md px-6">
          {/* Animated icon stack */}
          <div className="flex items-center justify-center gap-3 mb-8">
            {[Mail, Calendar, HardDrive].map((Icon, i) => (
              <div key={i}
                className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center"
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
    <div className="h-full flex flex-col bg-zinc-950">
      {/* ── Tab bar ── */}
      <div className="border-b border-zinc-800/70 bg-zinc-900/30">
        <div className="flex items-center justify-between px-4">
          <div className="flex items-center">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2.5 px-5 py-3 text-sm font-medium transition-all duration-150
                    ${isActive
                      ? 'text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-orange-400' : ''}`} />
                  {tab.label}
                  <span className="text-[10px] text-zinc-600 font-mono ml-0.5 hidden sm:inline">
                    {tab.shortcut}
                  </span>
                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-orange-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span className="text-emerald-400 text-[11px] font-medium">Connected</span>
            </div>
          </div>
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
