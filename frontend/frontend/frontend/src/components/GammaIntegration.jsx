import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../shared/ui/card';
import { Button } from '../shared/ui/button';
import { Badge } from '../shared/ui/badge';
import {
  CheckCircle, XCircle, Loader2, RefreshCw,
  ExternalLink, AlertCircle, Presentation,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';

const GammaIntegration = () => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [syncs, setSyncs] = useState([]);
  const [syncingAll, setSyncingAll] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/gamma/status');
      if (res.ok) {
        setStatus(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch Gamma status:', err);
      toast.error('Failed to check Gamma connection');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSyncs = useCallback(async () => {
    try {
      const res = await apiGet('/api/gamma/databases');
      if (res.ok) {
        setSyncs(res.data.presentations || []);
      }
    } catch (err) {
      console.error('Failed to fetch syncs:', err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchSyncs();
  }, [fetchStatus, fetchSyncs]);

  const syncAllClaims = async () => {
    setSyncingAll(true);
    try {
      const res = await apiPost('/api/gamma/sync/all', {});
      if (res.ok) {
        toast.success(`Created ${res.data.synced} presentations!`);
        if (res.data.failed > 0) {
          toast.warning(`${res.data.failed} claims failed`);
        }
        await fetchSyncs();
      } else {
        toast.error(res.error || 'Failed to sync claims');
      }
    } catch (err) {
      toast.error('Failed to sync claims');
    } finally {
      setSyncingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 bg-zinc-950 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <svg className="w-10 h-10" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="#FF6B00"/>
            <path d="M30 65 L40 45 L50 65 L60 45 L70 65" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="40" cy="45" r="4" fill="#fff"/>
            <circle cx="50" cy="65" r="4" fill="#fff"/>
            <circle cx="60" cy="45" r="4" fill="#fff"/>
          </svg>
          <div>
            <h1 className="text-3xl font-tactical font-bold text-white tracking-wide text-glow-orange">GAMMA INTEGRATION</h1>
            <p className="text-zinc-400">AI-powered presentation generation for claims</p>
          </div>
        </div>
      </div>

      {/* Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-zinc-100">Connection Status</CardTitle>
            <Button variant="outline" size="sm" onClick={fetchStatus}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {status?.connected ? (
            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="font-medium text-green-400">Connected to Gamma</span>
              </div>
              <div className="text-sm text-green-300 space-y-1">
                <p><strong>API:</strong> Gamma v1.0 (public-api.gamma.app)</p>
                {status.theme_count > 0 && (
                  <p><strong>Themes Available:</strong> {status.theme_count}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-5 h-5 text-red-400" />
                <span className="font-medium text-red-400">Not Connected</span>
              </div>
              <p className="text-sm text-red-300 mb-3">
                {status?.message || 'Gamma API key not configured'}
              </p>
              {!status?.configured && (
                <div className="mt-2 p-3 bg-red-500/15 rounded text-sm text-red-300">
                  <strong>Setup:</strong> Get your API key from{' '}
                  <a
                    href="https://gamma.app/settings/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded"
                  >
                    gamma.app/settings/api
                  </a>{' '}
                  (requires Pro plan), then set <code className="bg-red-500/20 px-1 rounded">GAMMA_API_KEY</code> in your .env file.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Presentation className="w-5 h-5 text-orange-600" />
            How Gamma Works in Eden
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-zinc-300">
            <p>
              Gamma generates professional presentation decks from your claim data.
              You can create decks from any claim&apos;s detail page using the
              <strong> Generate Deck</strong> button.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                <h4 className="font-semibold text-blue-400 mb-1">Client Decks</h4>
                <ul className="text-blue-300 text-xs space-y-1">
                  <li>Client Update — Status overview for homeowner</li>
                  <li>Settlement Review — For client approval</li>
                  <li>Final Settlement — Celebratory closing deck</li>
                </ul>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
                <h4 className="font-semibold text-purple-400 mb-1">Internal Decks</h4>
                <ul className="text-purple-300 text-xs space-y-1">
                  <li>Rep Performance — Sales/adjuster review</li>
                  <li>Ministry Report — Kingdom impact report</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {status?.connected && (
        <>
          {/* Bulk Sync */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-zinc-100 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-orange-600" />
                Bulk Generate
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Generate Client Update decks for all claims at once
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={syncAllClaims}
                disabled={syncingAll}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                {syncingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Decks...
                  </>
                ) : (
                  <>
                    <Presentation className="w-4 h-4 mr-2" />
                    Generate Decks for All Claims
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Recent Presentations */}
          {syncs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-zinc-100 flex items-center gap-2">
                  <Presentation className="w-5 h-5 text-orange-600" />
                  Recent Presentations
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  Presentations generated from claims
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {syncs.map((sync, i) => (
                    <div
                      key={sync.claim_id || i}
                      className="p-3 rounded-lg border border-zinc-700/50 hover:border-orange-500/50 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-medium text-zinc-100 text-sm">
                          {sync.claim_id}
                        </h4>
                        <p className="text-xs text-zinc-500">
                          Synced: {sync.last_synced ? new Date(sync.last_synced).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-500/15 text-green-400 border-green-500/30">
                          Generated
                        </Badge>
                        {(sync.gamma_url || sync.edit_url) && (
                          <a
                            href={sync.edit_url || sync.gamma_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-orange-600 hover:text-orange-700 focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded"
                            aria-label="Open presentation in Gamma"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Setup Info */}
      {!status?.connected && (
        <Card className="border-yellow-500/30 bg-yellow-500/10">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-400 mb-2">
                  Setup Instructions
                </h4>
                <ol className="text-sm text-yellow-300 list-decimal list-inside space-y-1.5">
                  <li>Go to <strong>gamma.app</strong> and sign in (Pro plan required)</li>
                  <li>Navigate to <strong>Settings &gt; API</strong></li>
                  <li>Generate an API key</li>
                  <li>Add <code className="bg-yellow-500/20 px-1 rounded">GAMMA_API_KEY=your_key_here</code> to your backend .env file</li>
                  <li>Restart the backend server</li>
                  <li>Click <strong>Refresh</strong> above to verify the connection</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GammaIntegration;
