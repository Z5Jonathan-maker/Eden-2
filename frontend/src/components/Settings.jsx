import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  Mail,
  Shield,
  UserCog,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../shared/ui/button';
import { Input } from '../shared/ui/input';
import { Label } from '../shared/ui/label';
import { Switch } from '../shared/ui/switch';
import { useAuth } from '../context/AuthContext';
import ProfileCard from './settings/ProfileCard';
import IntegrationCard from './settings/IntegrationCard';
import StatusBadge from './settings/StatusBadge';
import './settings/settings.css';
import { apiGet, apiPut, apiDelete, getAuthToken } from '@/lib/api';

const DEFAULT_OAUTH_STATUS = {
  google: { connected: false, user_email: null, scopes: [] },
  signnow: { connected: false, user_email: null, scopes: [] },
};

const DEFAULT_OAUTH_CONFIG = {
  google: false,
  signnow: false,
};

const GOOGLE_SCOPE_CHECKS = {
  gmail: [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
  ],
  calendar: ['https://www.googleapis.com/auth/calendar'],
  drive: ['https://www.googleapis.com/auth/drive.file'],
};

const readNotificationPrefs = () => {
  try {
    const raw = localStorage.getItem('eden_settings_notifications');
    if (!raw) {
      return {
        emailDigests: true,
        contractAlerts: true,
        systemWarnings: true,
      };
    }
    return JSON.parse(raw);
  } catch (_error) {
    return {
      emailDigests: true,
      contractAlerts: true,
      systemWarnings: true,
    };
  }
};

const Settings = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [oauthStatuses, setOauthStatuses] = useState(DEFAULT_OAUTH_STATUS);
  const [oauthConfigured, setOauthConfigured] = useState(DEFAULT_OAUTH_CONFIG);
  const [gammaEnabled, setGammaEnabled] = useState(false);
  const [gammaLoading, setGammaLoading] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState(null);
  const [successProvider, setSuccessProvider] = useState(null);

  const [companySettings, setCompanySettings] = useState({
    company_name: '',
    university_name: '',
    tagline: '',
  });
  const [companySaving, setCompanySaving] = useState(false);
  const [profilePhone] = useState(user?.phone || '');

  const [notificationPrefs, setNotificationPrefs] = useState(readNotificationPrefs);
  const [aiMetrics, setAiMetrics] = useState(null);
  const [loadingAiMetrics, setLoadingAiMetrics] = useState(false);
  const [aiMetricsError, setAiMetricsError] = useState('');
  const [aiRouting, setAiRouting] = useState(null);
  const [loadingAiRouting, setLoadingAiRouting] = useState(false);
  const [savingAiRouting, setSavingAiRouting] = useState(false);
  const [aiProviderHealth, setAiProviderHealth] = useState(null);
  const [loadingAiProviderHealth, setLoadingAiProviderHealth] = useState(false);
  const providerOptions = useMemo(
    () => [
      { value: 'openai', label: 'OpenAI' },
      { value: 'anthropic', label: 'Anthropic' },
      { value: 'ollama', label: 'Ollama (Local)' },
    ],
    []
  );

  useEffect(() => {
    localStorage.setItem('eden_settings_notifications', JSON.stringify(notificationPrefs));
  }, [notificationPrefs]);

  const fetchOAuthStatus = useCallback(async () => {
    try {
      const res = await apiGet('/api/oauth/status');
      if (!res.ok) return;

      setOauthStatuses({
        google: res.data.statuses?.google || DEFAULT_OAUTH_STATUS.google,
        signnow: res.data.statuses?.signnow || DEFAULT_OAUTH_STATUS.signnow,
      });
      setOauthConfigured({
        google: Boolean(res.data.configured?.google),
        signnow: Boolean(res.data.configured?.signnow),
      });
    } catch (error) {
      console.error('Failed to fetch OAuth status:', error);
    }
  }, []);

  const fetchGammaStatus = useCallback(async () => {
    setGammaLoading(true);
    try {
      const res = await apiGet('/api/gamma/status');

      if (!res.ok) {
        setGammaEnabled(false);
        return;
      }

      setGammaEnabled(Boolean(res.data.enabled));
    } catch (error) {
      setGammaEnabled(false);
      console.error('Failed to fetch Gamma status:', error);
    } finally {
      setGammaLoading(false);
    }
  }, []);

  const fetchCompanySettings = useCallback(async () => {
    try {
      const res = await apiGet('/api/settings/company');
      if (!res.ok) return;

      setCompanySettings({
        company_name: res.data.company_name || '',
        university_name: res.data.university_name || '',
        tagline: res.data.tagline || '',
      });
    } catch (error) {
      console.error('Failed to fetch company settings:', error);
    }
  }, []);

  const fetchAiMetrics = useCallback(async () => {
    const canViewAi = user?.role === 'admin' || user?.role === 'manager';
    if (!canViewAi) {
      setAiMetrics(null);
      setAiMetricsError('');
      return;
    }

    setLoadingAiMetrics(true);
    setAiMetricsError('');
    try {
      const res = await apiGet('/api/ai/task/metrics?days=7');
      if (!res.ok) {
        throw new Error(res.error || 'Failed to load AI metrics');
      }
      setAiMetrics(res.data);
    } catch (error) {
      setAiMetrics(null);
      setAiMetricsError(error.message || 'Failed to load AI metrics');
    } finally {
      setLoadingAiMetrics(false);
    }
  }, [user?.role]);

  const fetchAiRouting = useCallback(async () => {
    const canViewAi = user?.role === 'admin' || user?.role === 'manager';
    if (!canViewAi) {
      setAiRouting(null);
      return;
    }
    setLoadingAiRouting(true);
    try {
      const res = await apiGet('/api/ai/routing-config');
      if (!res.ok) {
        throw new Error(res.error || 'Failed to load AI routing config');
      }
      setAiRouting(res.data);
    } catch (error) {
      toast.error(error.message || 'Failed to load AI routing config');
      setAiRouting(null);
    } finally {
      setLoadingAiRouting(false);
    }
  }, [user?.role]);

  const fetchAiProviderHealth = useCallback(async () => {
    const canViewAi = user?.role === 'admin' || user?.role === 'manager';
    if (!canViewAi) {
      setAiProviderHealth(null);
      return;
    }
    setLoadingAiProviderHealth(true);
    try {
      const res = await apiGet('/api/ai/providers/health');
      if (!res.ok) {
        throw new Error(res.error || 'Failed to load provider health');
      }
      setAiProviderHealth(res.data);
    } catch (error) {
      setAiProviderHealth(null);
      toast.error(error.message || 'Failed to load provider health');
    } finally {
      setLoadingAiProviderHealth(false);
    }
  }, [user?.role]);

  const saveAiRouting = useCallback(async () => {
    if (!aiRouting?.config) return;
    setSavingAiRouting(true);
    try {
      const res = await apiPut('/api/ai/routing-config', {
        fallback_enabled: Boolean(aiRouting.config.fallback_enabled),
        task_provider_order: aiRouting.config.task_provider_order || {},
      });

      if (!res.ok) {
        throw new Error(res.error || 'Failed to save AI routing config');
      }
      setAiRouting((prev) => (prev ? { ...prev, config: res.data.config || prev.config } : prev));
      toast.success('AI routing updated');
    } catch (error) {
      toast.error(error.message || 'Failed to save AI routing config');
    } finally {
      setSavingAiRouting(false);
    }
  }, [aiRouting]);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchOAuthStatus(),
      fetchCompanySettings(),
      fetchGammaStatus(),
      fetchAiMetrics(),
      fetchAiRouting(),
      fetchAiProviderHealth(),
    ]);
    setLoading(false);
  }, [fetchOAuthStatus, fetchCompanySettings, fetchGammaStatus, fetchAiMetrics, fetchAiRouting, fetchAiProviderHealth]);

  useEffect(() => {
    const oauthProvider = searchParams.get('oauth');
    const oauthStatus = searchParams.get('status');

    if (oauthProvider && oauthStatus === 'success') {
      setSuccessProvider(oauthProvider);
      toast.success(`Connected ${oauthProvider}.`);
      window.history.replaceState({}, '', '/settings');
      setTimeout(() => setSuccessProvider(null), 2200);
    }

    fetchAllData();
  }, [searchParams, fetchAllData]);

  const initiateOAuth = async (provider) => {
    setConnectingProvider(provider);
    try {
      const res = await apiGet(`/api/oauth/${provider}/connect`);

      if (!res.ok) {
        toast.error(res.error || `Failed to connect ${provider}.`);
        return;
      }

      if (!res.data.auth_url) {
        toast.error(`Missing authorization URL for ${provider}.`);
        return;
      }

      window.location.href = res.data.auth_url;
    } catch (error) {
      toast.error(`Failed to start ${provider} connection.`);
    } finally {
      setConnectingProvider(null);
    }
  };

  const disconnectOAuth = async (provider) => {
    try {
      const res = await apiDelete(`/api/oauth/${provider}/disconnect`);

      if (!res.ok) {
        toast.error(`Failed to disconnect ${provider}.`);
        return;
      }

      toast.success(`${provider} disconnected.`);
      fetchOAuthStatus();
    } catch (error) {
      toast.error(`Failed to disconnect ${provider}.`);
    }
  };

  const saveCompanySettings = async () => {
    setCompanySaving(true);
    try {
      const res = await apiPut('/api/settings/company', companySettings);

      if (!res.ok) {
        toast.error('Failed to save profile settings.');
        return;
      }

      toast.success('Profile settings saved.');
    } catch (error) {
      toast.error('Error saving profile settings.');
    } finally {
      setCompanySaving(false);
    }
  };

  const googleServiceHealth = useMemo(() => {
    const connected = Boolean(oauthStatuses.google?.connected);
    const scopes = oauthStatuses.google?.scopes || [];
    const hasScope = (serviceScopes) => {
      if (!connected) return false;
      return serviceScopes.some((scope) => scopes.includes(scope));
    };

    const gmail = hasScope(GOOGLE_SCOPE_CHECKS.gmail);
    const calendar = hasScope(GOOGLE_SCOPE_CHECKS.calendar);
    const drive = hasScope(GOOGLE_SCOPE_CHECKS.drive);

    let healthTone = 'red';
    let healthLabel = 'Health: invalid';

    if (connected && oauthConfigured.google && gmail && calendar && drive) {
      healthTone = 'green';
      healthLabel = 'Health: valid';
    } else if (connected && oauthConfigured.google) {
      healthTone = 'yellow';
      healthLabel = 'Health: expiring soon';
    }

    return {
      details: [
        { label: 'Gmail', value: gmail ? 'Connected' : 'Not Connected' },
        { label: 'Calendar', value: calendar ? 'Connected' : 'Not Connected' },
        { label: 'Drive', value: drive ? 'Connected' : 'Not Connected' },
      ],
      healthTone,
      healthLabel,
    };
  }, [oauthConfigured.google, oauthStatuses.google]);

  const signNowConnected = Boolean(oauthStatuses.signnow?.connected);
  const signNowConfigured = Boolean(oauthConfigured.signnow);

  const signNowHealth = useMemo(() => {
    if (signNowConnected && signNowConfigured) {
      return { tone: 'green', label: 'Health: valid' };
    }
    if (signNowConfigured) {
      return { tone: 'yellow', label: 'Health: reconnect required' };
    }
    return { tone: 'red', label: 'Health: invalid' };
  }, [signNowConnected, signNowConfigured]);

  const roleLabel = user?.role ? user.role.toUpperCase() : 'OPERATOR';
  const canViewAiOps = user?.role === 'admin' || user?.role === 'manager';
  const permissions = useMemo(() => {
    const isAdmin = user?.role === 'admin';
    const isManager = user?.role === 'manager';

    return [
      { label: 'User management', enabled: isAdmin },
      { label: 'Contract authority', enabled: isAdmin || isManager || user?.role === 'adjuster' },
      { label: 'Integration management', enabled: isAdmin || isManager },
      { label: 'Audit exports', enabled: isAdmin },
    ];
  }, [user?.role]);

  if (loading) {
    return (
      <div className="settings-shell flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="settings-shell">
      <div className="settings-wrapper">
        <header className="settings-fade-in">
          <h1 className="text-2xl font-semibold text-slate-100">Settings</h1>
          <p className="mt-1 text-sm text-slate-400">
            Operator control panel for profile, integrations, notifications, permissions, and security.
          </p>
        </header>

        <section className="settings-section">
          <h2 className="settings-section-title">Operator Profile</h2>
          <div className="settings-divider" />
          <div className="mt-4 grid gap-4 lg:grid-cols-[2fr,1fr]">
            <ProfileCard
              name={user?.full_name || user?.name || ''}
              role={roleLabel}
              email={user?.email || ''}
              phone={profilePhone}
              onEditProfile={() => toast.info('Edit profile flow ready for wiring.')}
            />

            <article className="settings-card settings-fade-in">
              <h3 className="text-sm font-semibold text-slate-100">Company Profile</h3>
              <div className="mt-3 space-y-3">
                <div>
                  <Label className="text-xs text-slate-400">Company Name</Label>
                  <Input
                    value={companySettings.company_name}
                    onChange={(event) =>
                      setCompanySettings((prev) => ({ ...prev, company_name: event.target.value }))
                    }
                    className="mt-1 border-slate-700 bg-slate-900/70 text-slate-100"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-400">Documentation</Label>
                  <Input
                    value={companySettings.university_name}
                    onChange={(event) =>
                      setCompanySettings((prev) => ({ ...prev, university_name: event.target.value }))
                    }
                    className="mt-1 border-slate-700 bg-slate-900/70 text-slate-100"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-400">Tagline</Label>
                  <Input
                    value={companySettings.tagline}
                    onChange={(event) =>
                      setCompanySettings((prev) => ({ ...prev, tagline: event.target.value }))
                    }
                    className="mt-1 border-slate-700 bg-slate-900/70 text-slate-100"
                  />
                </div>
                <Button
                  onClick={saveCompanySettings}
                  disabled={companySaving}
                  variant="outline"
                  className="w-full border-slate-600 bg-slate-800/50 text-slate-100 hover:border-slate-500"
                >
                  {companySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save Profile
                </Button>
              </div>
            </article>
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">Integrations</h2>
          <div className="settings-divider" />
          <div className="settings-grid">
            <IntegrationCard
              icon={<Mail className="h-5 w-5" />}
              title="Google Workspace"
              description="Gmail, Calendar, and Drive connectivity for operations workflow."
              status={oauthStatuses.google?.connected ? 'connected' : 'not_connected'}
              statusLabel={oauthStatuses.google?.connected ? 'Connected' : 'Not Connected'}
              healthLabel={googleServiceHealth.healthLabel}
              healthTone={googleServiceHealth.healthTone}
              details={googleServiceHealth.details}
              successPulse={successProvider === 'google'}
              primaryAction={{
                label: oauthStatuses.google?.connected ? 'Reconnect Google' : 'Connect Google',
                onClick: () => initiateOAuth('google'),
                loading: connectingProvider === 'google',
                disabled: !oauthConfigured.google,
              }}
              secondaryAction={
                oauthStatuses.google?.connected
                  ? {
                      label: 'Disconnect',
                      onClick: () => disconnectOAuth('google'),
                    }
                  : undefined
              }
              footerLink={{
                href: 'https://admin.google.com',
                label: 'Manage in Google Admin',
              }}
            />

            <IntegrationCard
              icon={<KeyRound className="h-5 w-5" />}
              title="SignNow"
              description="Contract signing pipeline health and signing readiness."
              status={
                !signNowConfigured ? 'error' : signNowConnected ? 'connected' : 'warning'
              }
              statusLabel={
                !signNowConfigured ? 'Not Connected' : signNowConnected ? 'Connected' : 'Reconnect Required'
              }
              healthLabel={signNowHealth.label}
              healthTone={signNowHealth.tone}
              details={[
                { label: 'API key status', value: signNowConfigured ? 'Configured' : 'Missing' },
                {
                  label: 'Template sync status',
                  value: signNowConnected ? 'Ready' : 'Pending connection',
                },
                {
                  label: 'Webhook status',
                  value: signNowConnected ? 'Pending verification' : 'Not configured',
                },
              ]}
              successPulse={successProvider === 'signnow'}
              primaryAction={{
                label: signNowConnected ? 'Reconnect SignNow' : 'Connect SignNow',
                onClick: () => initiateOAuth('signnow'),
                loading: connectingProvider === 'signnow',
                disabled: !signNowConfigured,
              }}
              secondaryAction={
                signNowConnected
                  ? {
                      label: 'Disconnect',
                      onClick: () => disconnectOAuth('signnow'),
                    }
                  : undefined
              }
            />

            <IntegrationCard
              icon={<ExternalLink className="h-5 w-5" />}
              title="Gamma"
              description="Knowledge Base, Documentation, and Training Modules access point."
              status={gammaEnabled ? 'connected' : 'not_connected'}
              statusLabel={gammaEnabled ? 'Connected' : 'Not Connected'}
              healthLabel={gammaEnabled ? 'Health: valid' : 'Health: invalid'}
              healthTone={gammaEnabled ? 'green' : 'red'}
              details={[
                { label: 'Knowledge Base', value: gammaEnabled ? 'Available' : 'Unavailable' },
                { label: 'Documentation', value: gammaEnabled ? 'Available' : 'Unavailable' },
                { label: 'Training Modules', value: gammaEnabled ? 'Available' : 'Unavailable' },
              ]}
              primaryAction={{
                label: gammaLoading ? 'Checking status' : 'Open Gamma',
                onClick: () => window.open('https://gamma.app', '_blank', 'noopener,noreferrer'),
                loading: gammaLoading,
              }}
            />
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">Notifications</h2>
          <div className="settings-divider" />
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <article className="settings-card settings-fade-in">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100">Email Digests</h3>
                <Switch
                  checked={notificationPrefs.emailDigests}
                  onCheckedChange={(checked) =>
                    setNotificationPrefs((prev) => ({ ...prev, emailDigests: checked }))
                  }
                />
              </div>
              <p className="text-xs text-slate-400">Daily summary of claims and contracts.</p>
            </article>

            <article className="settings-card settings-fade-in">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100">Contract Alerts</h3>
                <Switch
                  checked={notificationPrefs.contractAlerts}
                  onCheckedChange={(checked) =>
                    setNotificationPrefs((prev) => ({ ...prev, contractAlerts: checked }))
                  }
                />
              </div>
              <p className="text-xs text-slate-400">Signature and delivery updates from SignNow.</p>
            </article>

            <article className="settings-card settings-fade-in">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100">System Warnings</h3>
                <Switch
                  checked={notificationPrefs.systemWarnings}
                  onCheckedChange={(checked) =>
                    setNotificationPrefs((prev) => ({ ...prev, systemWarnings: checked }))
                  }
                />
              </div>
              <p className="text-xs text-slate-400">Receive alerts for integration failures or auth issues.</p>
            </article>
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">Permissions</h2>
          <div className="settings-divider" />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <article className="settings-card settings-fade-in">
              <div className="mb-3 flex items-center gap-2">
                <UserCog className="h-4 w-4 text-slate-300" />
                <h3 className="text-sm font-semibold text-slate-100">Role Overview</h3>
              </div>
              <p className="text-sm text-slate-300">Current role: {roleLabel}</p>
              <p className="mt-1 text-xs text-slate-400">
                Access below is derived from your current operator role.
              </p>
            </article>

            <article className="settings-card settings-fade-in">
              <div className="mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-slate-300" />
                <h3 className="text-sm font-semibold text-slate-100">Access Matrix</h3>
              </div>
              <div className="space-y-2">
                {permissions.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-md border border-slate-700/50 bg-slate-900/45 px-3 py-2">
                    <span className="text-sm text-slate-300">{item.label}</span>
                    <StatusBadge status={item.enabled ? 'connected' : 'not_connected'} label={item.enabled ? 'Allowed' : 'Restricted'} />
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">Security</h2>
          <div className="settings-divider" />
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <article className="settings-card settings-fade-in">
              <div className="mb-2 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-slate-300" />
                <h3 className="text-sm font-semibold text-slate-100">Password</h3>
              </div>
              <p className="text-xs text-slate-400">Rotate credentials on a regular cycle.</p>
              <Button
                variant="outline"
                className="mt-3 w-full border-slate-600 bg-slate-800/50 text-slate-100 hover:border-slate-500"
                onClick={() => toast.info('Password reset flow can be linked here.')}
              >
                Reset Password
              </Button>
            </article>

            <article className="settings-card settings-fade-in">
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-slate-300" />
                <h3 className="text-sm font-semibold text-slate-100">Two-Factor Authentication</h3>
              </div>
              <p className="text-xs text-slate-400">Protect this operator account with step-up verification.</p>
              <Button
                variant="outline"
                className="mt-3 w-full border-slate-600 bg-slate-800/50 text-slate-100 hover:border-slate-500"
                onClick={() => toast.info('2FA setup endpoint can be connected here.')}
              >
                Configure 2FA
              </Button>
            </article>

            <article className="settings-card settings-fade-in">
              <div className="mb-2 flex items-center gap-2">
                <Bell className="h-4 w-4 text-slate-300" />
                <h3 className="text-sm font-semibold text-slate-100">Session Health</h3>
              </div>
              <div className="rounded-md border border-slate-700/50 bg-slate-900/45 p-3 text-xs text-slate-300">
                <p>Current account: {user?.email || 'Unknown'}</p>
                <p className="mt-1">Auth token: {getAuthToken() ? 'Active' : 'Missing'}</p>
              </div>
              {!getAuthToken() ? (
                <div className="mt-2 flex items-start gap-2 text-xs text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
                  <span>Token not detected. Re-authentication recommended.</span>
                </div>
              ) : null}
            </article>
          </div>
        </section>

        {canViewAiOps ? (
          <section className="settings-section">
            <h2 className="settings-section-title">AI Operations</h2>
            <div className="settings-divider" />
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <article className="settings-card settings-fade-in">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-100">Gateway Health</h3>
                  {loadingAiMetrics ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : aiMetricsError ? (
                    <StatusBadge status="error" label="Error" />
                  ) : (
                    <StatusBadge
                      status={(aiMetrics?.alerts || []).length ? 'warning' : 'connected'}
                      label={(aiMetrics?.alerts || []).length ? 'Attention' : 'Healthy'}
                    />
                  )}
                </div>
                {aiMetricsError ? (
                  <p className="text-xs text-red-300">{aiMetricsError}</p>
                ) : (
                  <div className="space-y-1 text-xs text-slate-300">
                    <p>Total calls (7d): {aiMetrics?.total_calls ?? 0}</p>
                    <p>Success rate: {aiMetrics?.success_rate ?? 0}%</p>
                    <p>Failure rate: {aiMetrics?.failure_rate ?? 0}%</p>
                    <p>Gateway fallbacks: {aiMetrics?.gateway?.fallback_rate ?? 0}%</p>
                  </div>
                )}
              </article>

              <article className="settings-card settings-fade-in">
                <h3 className="mb-2 text-sm font-semibold text-slate-100">Latency + Cost</h3>
                <div className="space-y-1 text-xs text-slate-300">
                  <p>p50 latency: {aiMetrics?.latency_ms?.p50 ?? 0}ms</p>
                  <p>p95 latency: {aiMetrics?.latency_ms?.p95 ?? 0}ms</p>
                  <p>Estimated cost (7d): ${Number(aiMetrics?.cost_usd?.total || 0).toFixed(4)}</p>
                  <p>
                    Today budget: ${Number(aiMetrics?.budget?.today_spend_usd || 0).toFixed(4)} / ${Number(aiMetrics?.budget?.daily_limit_usd || 0).toFixed(2)}
                    {' '}({Number(aiMetrics?.budget?.today_utilization_pct || 0).toFixed(1)}%)
                  </p>
                </div>
              </article>

              <article className="settings-card settings-fade-in">
                <h3 className="mb-2 text-sm font-semibold text-slate-100">Top Activity</h3>
                <div className="space-y-2 text-xs text-slate-300">
                  <div>
                    <p className="mb-1 text-slate-400">By provider</p>
                    {aiMetrics?.by_provider && Object.keys(aiMetrics.by_provider).length > 0 ? (
                      Object.entries(aiMetrics.by_provider)
                        .slice(0, 3)
                        .map(([provider, count]) => (
                          <p key={provider}>
                            {provider}: {count}
                          </p>
                        ))
                    ) : (
                      <p>No provider activity</p>
                    )}
                  </div>
                  <div>
                    <p className="mb-1 text-slate-400">By task</p>
                    {aiMetrics?.by_task && Object.keys(aiMetrics.by_task).length > 0 ? (
                      Object.entries(aiMetrics.by_task)
                        .slice(0, 3)
                        .map(([task, count]) => (
                          <p key={task}>
                            {task}: {count}
                          </p>
                        ))
                    ) : (
                      <p>No task activity</p>
                    )}
                  </div>
                </div>
              </article>

              <article className="settings-card settings-fade-in md:col-span-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-100">AI Routing Controls</h3>
                  <Button
                    size="sm"
                    onClick={saveAiRouting}
                    disabled={savingAiRouting || loadingAiRouting || !aiRouting?.config}
                    className="text-xs"
                  >
                    {savingAiRouting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                    Save Routing
                  </Button>
                </div>
                {loadingAiRouting ? (
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading routing config...
                  </div>
                ) : !aiRouting?.config ? (
                  <p className="text-xs text-slate-400">Routing config unavailable.</p>
                ) : (
                  <div className="space-y-3 text-xs text-slate-300">
                    {(() => {
                      const ollamaHealth = aiProviderHealth?.providers?.ollama;
                      const ollamaHealthy = Boolean(ollamaHealth?.healthy);
                      const primaryOllamaTasks = Object.entries(aiRouting.config.task_provider_order || {})
                        .filter(([, order]) => Array.isArray(order) && order[0] === 'ollama')
                        .map(([task]) => task);
                      if (primaryOllamaTasks.length > 0 && !ollamaHealthy) {
                        return (
                          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-200">
                            Ollama is configured as primary for {primaryOllamaTasks.length} task(s), but local health is not ready.
                            {' '}({ollamaHealth?.detail || 'unavailable'})
                          </div>
                        );
                      }
                      return null;
                    })()}
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(aiRouting.providers_available || {}).map(([provider, enabled]) => {
                        const health = aiProviderHealth?.providers?.[provider];
                        const healthy = health?.healthy;
                        const detail = health?.detail;
                        return (
                        <span
                          key={`provider-availability-${provider}`}
                          className={`rounded border px-2 py-1 text-[10px] uppercase ${
                            enabled && healthy
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                              : enabled
                              ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                              : 'border-slate-700/60 bg-slate-900/40 text-slate-400'
                          }`}
                        >
                          {provider}: {enabled ? (healthy ? 'healthy' : 'degraded') : 'off'}
                          {detail ? ` (${String(detail).slice(0, 40)})` : ''}
                        </span>
                        );
                      })}
                    </div>
                    {loadingAiProviderHealth && (
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Refreshing provider health...
                      </div>
                    )}
                    <div className="flex items-center justify-between rounded-md border border-slate-700/50 bg-slate-900/45 px-3 py-2">
                      <span>Hard fallback enabled</span>
                      <Switch
                        checked={Boolean(aiRouting.config.fallback_enabled)}
                        onCheckedChange={(checked) =>
                          setAiRouting((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  config: { ...prev.config, fallback_enabled: checked },
                                }
                              : prev
                          )
                        }
                      />
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {Object.entries(aiRouting.config.task_provider_order || {}).map(([task, order]) => {
                        const currentOrder = Array.isArray(order) ? order : ['openai', 'anthropic'];
                        const primary = currentOrder[0] || 'openai';
                        const secondary = currentOrder[1] || providerOptions.find((opt) => opt.value !== primary)?.value || 'openai';
                        return (
                          <div key={task} className="rounded-md border border-slate-700/50 bg-slate-900/45 p-3">
                            <p className="mb-2 font-mono text-[11px] uppercase text-slate-200">{task}</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-[10px] text-slate-500">Primary</Label>
                                <select
                                  value={primary}
                                  onChange={(event) => {
                                    const nextPrimary = event.target.value;
                                    const fallbackOption = providerOptions.find((opt) => opt.value !== nextPrimary)?.value || 'openai';
                                    const nextSecondary = nextPrimary === secondary ? fallbackOption : secondary;
                                    setAiRouting((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            config: {
                                              ...prev.config,
                                              task_provider_order: {
                                                ...prev.config.task_provider_order,
                                                [task]: [nextPrimary, nextSecondary],
                                              },
                                            },
                                          }
                                        : prev
                                    );
                                  }}
                                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                                >
                                  {providerOptions.map((opt) => (
                                    <option key={`${task}-primary-${opt.value}`} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <Label className="text-[10px] text-slate-500">Secondary</Label>
                                <select
                                  value={secondary}
                                  onChange={(event) => {
                                    const nextSecondary = event.target.value;
                                    const fallbackOption = providerOptions.find((opt) => opt.value !== nextSecondary)?.value || 'openai';
                                    const nextPrimary = nextSecondary === primary ? fallbackOption : primary;
                                    setAiRouting((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            config: {
                                              ...prev.config,
                                              task_provider_order: {
                                                ...prev.config.task_provider_order,
                                                [task]: [nextPrimary, nextSecondary],
                                              },
                                            },
                                          }
                                        : prev
                                    );
                                  }}
                                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                                >
                                  {providerOptions.map((opt) => (
                                    <option key={`${task}-secondary-${opt.value}`} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </article>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
};

export default Settings;
