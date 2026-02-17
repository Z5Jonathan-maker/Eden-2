import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Calendar, HardDrive, Loader2, Link2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../shared/ui/button';
import { apiGet } from '../lib/api';
import GmailTab from '../components/workspace/GmailTab';
import CalendarTab from '../components/workspace/CalendarTab';
import DriveTab from '../components/workspace/DriveTab';

const TABS = [
  { id: 'mail', label: 'Mail', icon: Mail },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'drive', label: 'Drive', icon: HardDrive },
];

const WorkspacePage = () => {
  const [activeTab, setActiveTab] = useState('mail');
  const [connected, setConnected] = useState(null); // null = loading
  const [connecting, setConnecting] = useState(false);

  const checkConnection = useCallback(async () => {
    try {
      const res = await apiGet('/api/oauth/status/google');
      if (res.ok) {
        setConnected(res.data.connected);
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await apiGet('/api/oauth/google/connect');
      if (res.ok && res.data?.auth_url) {
        window.location.href = res.data.auth_url;
      } else {
        toast.error('Google OAuth not configured. Contact administrator.');
      }
    } catch {
      toast.error('Failed to connect Google');
    } finally {
      setConnecting(false);
    }
  };

  // Loading state
  if (connected === null) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  // Not connected — prompt
  if (!connected) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-10 h-10 text-orange-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Connect Google Workspace</h1>
          <p className="text-zinc-400 mb-6">
            Link your Google account to access Gmail, Calendar, and Drive directly within Eden.
          </p>
          <Button
            onClick={handleConnect}
            disabled={connecting}
            className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 text-base"
          >
            {connecting ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <Link2 className="w-5 h-5 mr-2" />
            )}
            Connect Google Account
          </Button>
          <p className="text-xs text-zinc-500 mt-4">
            Grants access to Gmail, Calendar &amp; Drive. You can disconnect anytime in Settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header with tabs */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-orange-500 text-orange-400'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            Google connected
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'mail' && <GmailTab />}
        {activeTab === 'calendar' && <CalendarTab />}
        {activeTab === 'drive' && <DriveTab />}
      </div>
    </div>
  );
};

export default WorkspacePage;
