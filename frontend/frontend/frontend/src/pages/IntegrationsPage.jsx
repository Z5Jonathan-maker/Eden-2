/**
 * IntegrationsPage - Admin settings for external service integrations
 * 
 * Shows connection status for:
 * - Google (Calendar, Drive, Slides)
 * - Gamma (Presentations)
 * - SignNow (Contracts)
 * - Stripe (Payments)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../shared/ui/card';
import { Button } from '../shared/ui/button';
import { Badge } from '../shared/ui/badge';
import { toast } from 'sonner';
import {
  Calendar, FileText, PenTool, CreditCard,
  Check, X, Loader2, ExternalLink, RefreshCw,
  Plug, Link2, Unlink, ChevronRight
} from 'lucide-react';
import { apiGet, apiDelete, API_URL } from '../lib/api';

const IntegrationCard = ({ 
  name, 
  icon: Icon, 
  connected, 
  scopes = [], 
  availableScopes = [],
  oauthRequired,
  onConnect,
  onDisconnect,
  loading,
  description,
  color = "blue"
}) => {
  const colorClasses = {
    blue: "bg-[#1a1a1a] border-blue-500/30",
    green: "bg-[#1a1a1a] border-green-500/30",
    purple: "bg-[#1a1a1a] border-purple-500/30",
    orange: "bg-[#1a1a1a] border-orange-500/30"
  };

  const iconColorClasses = {
    blue: "bg-blue-500/20 text-blue-400",
    green: "bg-green-500/20 text-green-400",
    purple: "bg-purple-500/20 text-purple-400",
    orange: "bg-orange-500/20 text-orange-400"
  };

  return (
    <Card className={`${colorClasses[color]} border-2 transition-all duration-200 hover:shadow-lg hover:shadow-orange-500/5 hover:border-orange-500/20`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${iconColorClasses[color]}`}>
              <Icon className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{name}</h3>
              <p className="text-sm text-zinc-400 mt-1">{description}</p>
              
              {/* Scopes */}
              {availableScopes.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {availableScopes.map(scope => (
                    <Badge
                      key={scope}
                      variant={scopes.includes(scope) ? "default" : "outline"}
                      className={scopes.includes(scope) ? "bg-green-600" : "text-zinc-500 border-zinc-700"}
                    >
                      {scope}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            {/* Status Badge */}
            <Badge
              className={connected ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/35" : "bg-zinc-800/60 text-zinc-400 border border-zinc-700"}
            >
              {connected ? (
                <><Check className="w-3 h-3 mr-1" /> Connected</>
              ) : (
                <><X className="w-3 h-3 mr-1" /> Not Connected</>
              )}
            </Badge>
            
            {/* Action Button */}
            {oauthRequired ? (
              connected ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDisconnect}
                  disabled={loading}
                  className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4 mr-1" />}
                  Disconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={onConnect}
                  disabled={loading}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4 mr-1" />}
                  Connect
                </Button>
              )
            ) : (
              <span className="text-xs text-zinc-500">
                {connected ? "API Key configured" : "API Key required"}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const IntegrationsPage = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiGet('/api/integrations/status');

      if (res.ok) {
        setStatus(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch integrations status:', err);
      toast.error('Failed to load integrations status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Handle Google Connect — uses the real OAuth flow from /api/oauth/google/connect
  const handleGoogleConnect = async () => {
    setActionLoading(prev => ({ ...prev, google: true }));

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
    } finally {
      setActionLoading(prev => ({ ...prev, google: false }));
    }
  };

  // Handle Disconnect
  const handleDisconnect = async (provider) => {
    setActionLoading(prev => ({ ...prev, [provider]: true }));

    try {
      const res = await apiDelete(`/api/integrations/disconnect/${provider}`);

      if (res.ok) {
        toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} disconnected`);
        fetchStatus();
      } else {
        toast.error('Failed to disconnect');
      }
    } catch (err) {
      console.error('Disconnect error:', err);
      toast.error('Failed to disconnect');
    } finally {
      setActionLoading(prev => ({ ...prev, [provider]: false }));
    }
  };

  const integrationCount = 4;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Tactical Header */}
      <div className="bg-[#1a1a1a] border-b border-orange-500/20 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-500/10 border border-orange-500/30 rounded-xl flex items-center justify-center">
                <Plug className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight text-zinc-50">INTEGRATIONS</h1>
                  <span className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-400">{integrationCount} SERVICES</span>
                </div>
                <p className="text-sm text-zinc-500 mt-0.5">External service connections &amp; OAuth management</p>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={fetchStatus} className="border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-orange-500/40 hover:text-zinc-100">
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="space-y-4">
          {/* Google */}
          <IntegrationCard
            name="Google Workspace"
            icon={Calendar}
            connected={status?.google?.connected}
            scopes={status?.google?.scopes || []}
            availableScopes={status?.google?.available_scopes || []}
            oauthRequired={true}
            onConnect={handleGoogleConnect}
            onDisconnect={() => handleDisconnect('google')}
            loading={actionLoading.google}
            description="Calendar for appointments, Drive for documents, Slides for presentations"
            color="blue"
          />

          {/* Gamma */}
          <IntegrationCard
            name="Gamma"
            icon={FileText}
            connected={status?.gamma?.connected}
            oauthRequired={false}
            description="AI-powered presentation generation from inspection reports"
            color="purple"
          />

          {/* SignNow */}
          <IntegrationCard
            name="SignNow"
            icon={PenTool}
            connected={status?.signnow?.connected}
            oauthRequired={true}
            onConnect={async () => {
              setActionLoading(prev => ({ ...prev, signnow: true }));
              try {
                const res = await apiGet('/api/oauth/signnow/connect');
                if (res.ok && res.data?.auth_url) {
                  window.location.href = res.data.auth_url;
                } else {
                  toast.error(res.error || 'SignNow OAuth not configured. Contact administrator.');
                }
              } catch (err) {
                toast.error('Failed to connect SignNow');
              } finally {
                setActionLoading(prev => ({ ...prev, signnow: false }));
              }
            }}
            onDisconnect={() => handleDisconnect('signnow')}
            loading={actionLoading.signnow}
            description="Electronic signatures for contracts and agreements"
            color="green"
          />

          {/* Stripe */}
          <IntegrationCard
            name="Stripe"
            icon={CreditCard}
            connected={status?.stripe?.connected}
            oauthRequired={false}
            description="Payment processing for client invoices"
            color="orange"
          />
        </div>

        {/* Integration Info */}
        <div className="mt-8 p-4 bg-[#1a1a1a] border border-orange-500/20 rounded-lg">
          <h3 className="text-[10px] font-bold tracking-widest text-orange-500 uppercase mb-3">Integration Notes</h3>
          <ul className="text-sm text-zinc-400 space-y-1">
            <li>• <strong>Google:</strong> Connects Calendar, Drive, and Slides with one OAuth flow</li>
            <li>• <strong>Gamma:</strong> Requires API key in server environment (GAMMA_API_KEY)</li>
            <li>• <strong>SignNow:</strong> OAuth connect requires SIGNNOW_CLIENT_ID and SIGNNOW_CLIENT_SECRET in server environment</li>
            <li>• <strong>Stripe:</strong> Requires API keys in server environment</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage;
