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
  Settings, Link2, Unlink, ChevronRight
} from 'lucide-react';
import { api, API_URL } from '../lib/api';

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
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    purple: "bg-purple-50 border-purple-200",
    orange: "bg-orange-50 border-orange-200"
  };

  const iconColorClasses = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    purple: "bg-purple-100 text-purple-600",
    orange: "bg-orange-100 text-orange-600"
  };

  return (
    <Card className={`${colorClasses[color]} border-2 transition-all hover:shadow-md`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${iconColorClasses[color]}`}>
              <Icon className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{name}</h3>
              <p className="text-sm text-gray-600 mt-1">{description}</p>
              
              {/* Scopes */}
              {availableScopes.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {availableScopes.map(scope => (
                    <Badge 
                      key={scope}
                      variant={scopes.includes(scope) ? "default" : "outline"}
                      className={scopes.includes(scope) ? "bg-green-500" : "text-gray-400"}
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
              className={connected ? "bg-green-500" : "bg-gray-400"}
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
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4 mr-1" />}
                  Disconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={onConnect}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4 mr-1" />}
                  Connect
                </Button>
              )
            ) : (
              <span className="text-xs text-gray-500">
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
      const res = await fetch(`${API_URL}/api/integrations/status`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
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

  // Handle Google Connect
  const handleGoogleConnect = async () => {
    setActionLoading(prev => ({ ...prev, google: true }));
    
    try {
      // Get auth URL from backend
      const redirectUri = `${window.location.origin}/settings/integrations/callback`;
      
      const res = await fetch(
        `${API_URL}/api/integrations/google/auth-url?redirect_uri=${encodeURIComponent(redirectUri)}&scopes=calendar,drive`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      
      if (res.ok) {
        const data = await res.json();
        // Redirect to OAuth URL
        window.location.href = data.auth_url;
      } else {
        toast.error('Failed to get auth URL');
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
      const res = await fetch(`${API_URL}/api/integrations/disconnect/${provider}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Settings className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Integrations</h1>
                <p className="text-sm text-gray-500">Connect external services</p>
              </div>
            </div>
            
            <Button variant="outline" size="sm" onClick={fetchStatus}>
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
            onConnect={() => toast.info('SignNow OAuth not yet implemented')}
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
        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h3 className="font-semibold text-amber-900 mb-2">Integration Notes</h3>
          <ul className="text-sm text-amber-800 space-y-1">
            <li>• <strong>Google:</strong> Connects Calendar, Drive, and Slides with one OAuth flow</li>
            <li>• <strong>Gamma:</strong> Requires API key in server environment (GAMMA_API_KEY)</li>
            <li>• <strong>SignNow:</strong> Full OAuth implementation coming soon</li>
            <li>• <strong>Stripe:</strong> Requires API keys in server environment</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage;
