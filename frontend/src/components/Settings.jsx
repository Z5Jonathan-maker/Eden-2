import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { 
  CheckCircle, XCircle, Settings as SettingsIcon, Key, Mail, 
  Loader2, Building2, ExternalLink, LogOut, Link2, AlertCircle,
  Database, FileText, MapPin, Camera, Play
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { PAGE_ICONS } from '../assets/badges';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Settings = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [oauthStatuses, setOauthStatuses] = useState({
    google: { connected: false, user_email: null },
    signnow: { connected: false, user_email: null },
    notion: { connected: false, user_email: null }
  });
  const [oauthConfigured, setOauthConfigured] = useState({
    google: false,
    signnow: false,
    notion: false
  });
  const [connectingProvider, setConnectingProvider] = useState(null);
  
  const [emailStatus, setEmailStatus] = useState({ configured: false, senderEmail: '' });
  const [companySettings, setCompanySettings] = useState({
    company_name: '',
    university_name: '',
    tagline: ''
  });
  const [testEmail, setTestEmail] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [companySaving, setCompanySaving] = useState(false);
  
  // Demo Mode state
  const [demoMode, setDemoMode] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoStats, setDemoStats] = useState(null);

  const getToken = () => localStorage.getItem('eden_token');

  useEffect(() => {
    // Check for OAuth callback result
    const oauthProvider = searchParams.get('oauth');
    const oauthStatus = searchParams.get('status');
    
    if (oauthProvider && oauthStatus === 'success') {
      toast.success(`Successfully connected to ${oauthProvider}!`);
      // Clean up URL
      window.history.replaceState({}, '', '/settings');
    }
    
    fetchAllData();
  }, [searchParams]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchOAuthStatus(),
      fetchEmailStatus(),
      fetchCompanySettings()
    ]);
    setLoading(false);
  };

  const fetchOAuthStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/oauth/status`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setOauthStatuses(data.statuses || {});
        setOauthConfigured(data.configured || {});
      }
    } catch (err) {
      console.error('Failed to fetch OAuth status:', err);
    }
  };

  const fetchEmailStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/email/status`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setEmailStatus({ configured: data.configured, senderEmail: data.sender_email });
      }
    } catch (err) {
      console.error('Failed to fetch email status:', err);
    }
  };

  const fetchCompanySettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings/company`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setCompanySettings({
          company_name: data.company_name || '',
          university_name: data.university_name || '',
          tagline: data.tagline || ''
        });
      }
    } catch (err) {
      console.error('Failed to fetch company settings:', err);
    }
  };

  const initiateOAuth = async (provider) => {
    setConnectingProvider(provider);
    
    try {
      const res = await fetch(`${API_URL}/api/oauth/${provider}/connect`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        // Redirect to OAuth provider
        window.location.href = data.auth_url;
      } else {
        const error = await res.json();
        toast.error(error.detail || `Failed to connect to ${provider}`);
        setConnectingProvider(null);
      }
    } catch (err) {
      toast.error(`Failed to initiate ${provider} connection`);
      setConnectingProvider(null);
    }
  };

  const disconnectOAuth = async (provider) => {
    if (!window.confirm(`Disconnect from ${provider}?`)) return;
    
    try {
      const res = await fetch(`${API_URL}/api/oauth/${provider}/disconnect`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        toast.success(`Disconnected from ${provider}`);
        fetchOAuthStatus();
      } else {
        toast.error(`Failed to disconnect from ${provider}`);
      }
    } catch (err) {
      toast.error(`Failed to disconnect from ${provider}`);
    }
  };

  const saveCompanySettings = async () => {
    setCompanySaving(true);
    try {
      const res = await fetch(`${API_URL}/api/settings/company`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify(companySettings)
      });
      
      if (res.ok) {
        toast.success('Company settings saved!');
      } else {
        toast.error('Failed to save company settings');
      }
    } catch (err) {
      toast.error('Error saving company settings');
    } finally {
      setCompanySaving(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail) {
      toast.error('Please enter an email address');
      return;
    }
    
    setEmailSending(true);
    try {
      const res = await fetch(`${API_URL}/api/email/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ to_email: testEmail })
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Test email sent!');
      } else {
        toast.error(data.detail || 'Failed to send email');
      }
    } catch (err) {
      toast.error('Error sending test email');
    } finally {
      setEmailSending(false);
    }
  };

  // Demo Mode functions
  const checkDemoStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/claims/?include_archived=false&limit=100`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const claims = await res.json();
        const demoClaims = claims.filter(c => c.is_demo);
        setDemoMode(demoClaims.length > 0);
        if (demoClaims.length > 0) {
          setDemoStats({ claims: demoClaims.length });
        }
      }
    } catch (err) {
      console.error('Failed to check demo status:', err);
    }
  };

  const toggleDemoMode = async () => {
    setDemoLoading(true);
    try {
      if (demoMode) {
        // Clear demo data
        const res = await fetch(`${API_URL}/api/demo/clear`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${getToken()}` }
        });
        if (res.ok) {
          const data = await res.json();
          setDemoMode(false);
          setDemoStats(null);
          toast.success(`Demo mode disabled. Cleared ${data.deleted?.claims || 0} demo claims.`);
        } else {
          toast.error('Failed to clear demo data');
        }
      } else {
        // Seed demo data
        const res = await fetch(`${API_URL}/api/demo/seed`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success') {
            setDemoMode(true);
            setDemoStats(data.data);
            toast.success(`Demo mode enabled! Created ${data.data?.claims || 0} sample claims, ${data.data?.pins || 0} pins.`);
          } else if (data.status === 'skipped') {
            setDemoMode(true);
            toast.info('Demo data already exists');
          }
        } else {
          toast.error('Failed to seed demo data');
        }
      }
    } catch (err) {
      toast.error('Error toggling demo mode');
    } finally {
      setDemoLoading(false);
    }
  };

  // Check demo status on mount
  useEffect(() => {
    checkDemoStatus();
  }, []);

  const renderOAuthCard = (provider, title, description, icon, scopes) => {
    const status = oauthStatuses[provider] || {};
    const isConfigured = oauthConfigured[provider];
    const isConnected = status.connected;
    const isConnecting = connectingProvider === provider;

    return (
      <div className="card-tactical p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-zinc-800/50 rounded-lg border border-zinc-700/30">
              {icon}
            </div>
            <div>
              <h4 className="font-tactical font-bold text-white uppercase">{title}</h4>
              <p className="text-zinc-500 text-sm font-mono">{description}</p>
            </div>
          </div>
          <Badge variant={isConnected ? 'default' : 'secondary'} className={isConnected ? 'bg-green-600 text-white' : 'bg-zinc-700 text-zinc-400'}>
            {isConnected ? 'Connected' : 'Not Connected'}
          </Badge>
        </div>
        <div className="space-y-4">
          {isConnected ? (
            <>
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="font-medium text-green-400">Connected</span>
                </div>
                {status.user_email && (
                  <p className="text-sm text-green-400/80">
                    Account: {status.user_email}
                  </p>
                )}
                {status.connected_at && (
                  <p className="text-xs text-green-400/60 mt-1">
                    Connected: {new Date(status.connected_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              
              <Button 
                variant="outline" 
                onClick={() => disconnectOAuth(provider)}
                className="w-full text-red-400 border-red-500/30 hover:bg-red-500/10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Disconnect {title}
              </Button>
            </>
          ) : (
            <>
              {!isConfigured && (
                <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-400">OAuth Not Configured</p>
                      <p className="text-xs text-yellow-400/70 mt-1">
                        Admin needs to add {title} OAuth credentials (Client ID & Secret) to enable this integration.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/30">
                <p className="text-sm font-medium text-zinc-300 mb-2">What you&apos;ll get:</p>
                <ul className="text-sm text-zinc-500 space-y-1">
                  {scopes.map((scope, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      {scope}
                    </li>
                  ))}
                </ul>
              </div>
              
              <Button 
                onClick={() => initiateOAuth(provider)}
                disabled={!isConfigured || isConnecting}
                className="w-full btn-tactical"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 mr-2" />
                    Connect with {title}
                  </>
                )}
              </Button>
              
              {isConfigured && (
                <p className="text-xs text-center text-zinc-600">
                  You&apos;ll be redirected to {title} to authorize access
                </p>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen bg-tactical-animated">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="p-8 bg-tactical-animated min-h-screen page-enter">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <img 
            src={PAGE_ICONS.settings_gear} 
            alt="Settings" 
            className="w-14 h-14 object-contain animate-glow-breathe"
            style={{ filter: 'drop-shadow(0 0 15px rgba(249, 115, 22, 0.5))' }}
          />
          <div>
            <h1 className="text-3xl font-tactical font-bold text-white uppercase tracking-wide text-glow-orange">Settings & Integrations</h1>
            <p className="text-zinc-500 font-mono">Connect your accounts with one click using OAuth</p>
          </div>
        </div>
      </div>

      {/* Status Overview */}
      <div className="card-tactical p-5 mb-6">
        <div className="mb-4">
          <h3 className="font-tactical font-bold text-white uppercase tracking-wide text-lg">Integration Status</h3>
          <p className="text-zinc-500 font-mono text-sm">Quick overview of your connected services</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { key: 'google', label: 'Google Workspace' },
            { key: 'signnow', label: 'SignNow' },
            { key: 'notion', label: 'Notion' },
            { key: 'email', label: 'Email (SMTP)', isEmail: true }
          ].map(({ key, label, isEmail }) => {
            const connected = isEmail ? emailStatus.configured : oauthStatuses[key]?.connected;
            return (
              <div key={key} className="flex items-center space-x-2 p-3 bg-zinc-800/30 rounded border border-zinc-700/30">
                {connected ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-zinc-600" />
                )}
                <div>
                  <p className="text-sm font-medium text-white">{label}</p>
                  <Badge variant={connected ? 'default' : 'secondary'} className={`text-xs ${connected ? 'bg-green-600 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
                    {connected ? 'Connected' : 'Not Connected'}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Configuration Tabs */}
      <Tabs defaultValue="oauth" className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-zinc-800/50 border border-zinc-700/30">
          <TabsTrigger value="oauth" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-zinc-400">OAuth Integrations</TabsTrigger>
          <TabsTrigger value="email" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-zinc-400">Email Setup</TabsTrigger>
          <TabsTrigger value="company" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-zinc-400">Company</TabsTrigger>
          <TabsTrigger value="demo" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-zinc-400">Demo Mode</TabsTrigger>
          <TabsTrigger value="guide" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-zinc-400">Setup Guide</TabsTrigger>
        </TabsList>

        {/* OAuth Integrations Tab */}
        <TabsContent value="oauth" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Google OAuth */}
            {renderOAuthCard(
              'google',
              'Google Workspace',
              'Gmail, Drive, and Calendar integration',
              <svg className="w-8 h-8" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>,
              ['Send emails via Gmail', 'Store files in Google Drive', 'Sync with Google Calendar', 'Access contact information']
            )}
            
            {/* SignNow OAuth */}
            {renderOAuthCard(
              'signnow',
              'SignNow',
              'Electronic signatures for contracts',
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-gray-900 font-bold text-xs">SN</span>
              </div>,
              ['Send documents for e-signature', 'Track signature status', 'Download signed documents', 'Create signature templates']
            )}
            
            {/* Notion OAuth */}
            {renderOAuthCard(
              'notion',
              'Notion',
              'Sync claims data to Notion databases',
              <svg className="w-8 h-8" viewBox="0 0 100 100">
                <path d="M6.017 4.313l55.333 -4.087c6.797 -0.583 8.543 -0.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277 -1.553 6.807 -6.99 7.193L24.467 99.967c-4.08 0.193 -6.023 -0.39 -8.16 -3.113L3.3 79.94c-2.333 -3.113 -3.3 -5.443 -3.3 -8.167V11.113c0 -3.497 1.553 -6.413 6.017 -6.8z" fill="#fff"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M61.35 0.227l-55.333 4.087C1.553 4.7 0 7.617 0 11.113v60.66c0 2.723 0.967 5.053 3.3 8.167l13.007 16.913c2.137 2.723 4.08 3.307 8.16 3.113l64.257 -3.89c5.433 -0.387 6.99 -2.917 6.99 -7.193V20.64c0 -2.21 -0.873 -2.847 -3.443 -4.733L74.167 3.143c-4.273 -3.107 -6.02 -3.5 -12.817 -2.917zM25.92 19.523c-5.247 0.353 -6.437 0.433 -9.417 -1.99L8.927 11.507c-0.77 -0.78 -0.383 -1.753 1.557 -1.947l53.193 -3.887c4.467 -0.39 6.793 1.167 8.54 2.527l9.123 6.61c0.39 0.197 1.36 1.36 0.193 1.36l-54.933 3.307 -0.68 0.047zM19.803 88.3V30.367c0 -2.53 0.777 -3.697 3.103 -3.893L86 22.78c2.14 -0.193 3.107 1.167 3.107 3.693v57.547c0 2.53 -0.39 4.67 -3.883 4.863l-60.377 3.5c-3.493 0.193 -5.043 -0.97 -5.043 -4.083zm59.6 -54.827c0.387 1.75 0 3.5 -1.75 3.7l-2.91 0.577v42.773c-2.527 1.36 -4.853 2.137 -6.797 2.137 -3.107 0 -3.883 -0.973 -6.21 -3.887l-19.03 -29.94v28.967l6.02 1.363s0 3.5 -4.857 3.5l-13.39 0.777c-0.39 -0.78 0 -2.723 1.357 -3.11l3.497 -0.97v-38.3L30.48 40.667c-0.39 -1.75 0.58 -4.277 3.3 -4.473l14.367 -0.967 19.8 30.327v-26.83l-5.047 -0.58c-0.39 -2.143 1.163 -3.7 3.103 -3.89l13.4 -0.78z" fill="#000"/>
              </svg>,
              ['Sync claims to Notion database', 'Export reports to Notion', 'Link documents and notes', 'Collaborate with team']
            )}
          </div>
          
          <div className="card-tactical p-5 mt-6">
            <div className="flex items-start gap-3">
              <Key className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-white mb-1">Admin Setup Required</h4>
                <p className="text-sm text-zinc-400">
                  To enable OAuth integrations, an administrator needs to configure OAuth credentials in the backend environment:
                </p>
                <div className="mt-3 p-3 bg-zinc-900/50 rounded font-mono text-xs overflow-x-auto text-zinc-400 border border-zinc-700/30">
                  <div className="text-orange-500"># Google OAuth</div>
                  <div>GOOGLE_CLIENT_ID=your-client-id</div>
                  <div>GOOGLE_CLIENT_SECRET=your-client-secret</div>
                  <div className="mt-2 text-orange-500"># SignNow OAuth</div>
                  <div>SIGNNOW_CLIENT_ID=your-client-id</div>
                  <div>SIGNNOW_CLIENT_SECRET=your-client-secret</div>
                  <div className="mt-2 text-orange-500"># Notion OAuth</div>
                  <div>NOTION_CLIENT_ID=your-client-id</div>
                  <div>NOTION_CLIENT_SECRET=your-client-secret</div>
                  <div className="mt-2 text-orange-500"># Base URL for callbacks</div>
                  <div>BASE_URL=https://your-domain.com</div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Email Setup Tab */}
        <TabsContent value="email" className="mt-6">
          <div className="card-tactical p-5">
            <div className="flex items-center space-x-2 mb-4">
              <Mail className="w-5 h-5 text-orange-500" />
              <h3 className="font-tactical font-bold text-white uppercase">Email Notifications (Gmail SMTP)</h3>
            </div>
            <p className="text-zinc-500 font-mono text-sm mb-4">Send email notifications to clients when claims are updated</p>
            
            <div className="space-y-4">
              <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                <h4 className="font-semibold text-blue-400 mb-2">Setup Instructions:</h4>
                <ol className="text-sm text-zinc-400 space-y-2 list-decimal list-inside">
                  <li>Go to your Google Account → Security</li>
                  <li>Enable 2-Step Verification (if not already)</li>
                  <li>Go to Security → App passwords → Select Mail and generate</li>
                  <li>Copy the 16-character app password</li>
                  <li>Add to backend .env:</li>
                </ol>
                <div className="mt-2 p-2 bg-zinc-900/50 rounded font-mono text-xs text-zinc-400">
                  GMAIL_USER=your-email@gmail.com<br/>
                  GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
                </div>
              </div>

              {emailStatus.configured ? (
                <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="font-medium text-green-400">Gmail SMTP configured</span>
                  </div>
                  <p className="text-sm text-green-400/80 mt-1">
                    Sender: {emailStatus.senderEmail}
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                    <span className="text-yellow-400">Email service not configured</span>
                  </div>
                  <p className="text-sm text-yellow-400/80 mt-1">
                    Add GMAIL_USER and GMAIL_APP_PASSWORD to backend .env
                  </p>
                </div>
              )}

              <div className="border-t border-zinc-700/30 pt-4">
                <h4 className="font-medium text-white mb-3">Send Test Email</h4>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="recipient@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="bg-zinc-800/50 border-zinc-700/30 text-white placeholder:text-zinc-600"
                  />
                  <Button 
                    onClick={sendTestEmail}
                    disabled={emailSending || !emailStatus.configured}
                    className="btn-tactical"
                  >
                    {emailSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Send Test'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Company Tab */}
        <TabsContent value="company" className="mt-6">
          <div className="card-tactical p-5">
            <div className="flex items-center space-x-2 mb-4">
              <Building2 className="w-5 h-5 text-orange-500" />
              <h3 className="font-tactical font-bold text-white uppercase">Company Settings</h3>
            </div>
            <p className="text-zinc-500 font-mono text-sm mb-4">Configure your firm&apos;s branding and internal naming</p>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company_name" className="text-zinc-300">Company Name</Label>
                <Input
                  id="company_name"
                  placeholder="Your Firm Name"
                  value={companySettings.company_name}
                  onChange={(e) => setCompanySettings(prev => ({ ...prev, company_name: e.target.value }))}
                  className="bg-zinc-800/50 border-zinc-700/30 text-white placeholder:text-zinc-600"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="university_name" className="text-zinc-300">Doctrine/University Display Name</Label>
                <Input
                  id="university_name"
                  placeholder="e.g., 'Acme Claims University'"
                  value={companySettings.university_name}
                  onChange={(e) => setCompanySettings(prev => ({ ...prev, university_name: e.target.value }))}
                  className="bg-zinc-800/50 border-zinc-700/30 text-white placeholder:text-zinc-600"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tagline" className="text-zinc-300">Company Tagline</Label>
                <Input
                  id="tagline"
                  placeholder="e.g., 'Excellence in Claims'"
                  value={companySettings.tagline}
                  onChange={(e) => setCompanySettings(prev => ({ ...prev, tagline: e.target.value }))}
                  className="bg-zinc-800/50 border-zinc-700/30 text-white placeholder:text-zinc-600"
                />
              </div>

              {(user?.role === 'admin' || user?.role === 'manager') ? (
                <Button 
                  onClick={saveCompanySettings} 
                  disabled={companySaving}
                  className="btn-tactical"
                >
                  {companySaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Company Settings'
                  )}
                </Button>
              ) : (
                <p className="text-sm text-zinc-500 italic">
                  Only administrators and managers can modify company settings.
                </p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Demo Mode Tab */}
        <TabsContent value="demo" className="mt-6">
          <div className="card-tactical p-5">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${demoMode ? 'bg-green-500' : 'bg-zinc-600'}`} />
                  <h3 className="font-tactical font-bold text-white uppercase">Demo Mode</h3>
                </div>
                {demoMode && (
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
                    ACTIVE
                  </span>
                )}
              </div>
              <p className="text-zinc-500 font-mono text-sm">
                Enable demo mode to populate sample data for testing and onboarding new users
              </p>
            </div>
            <div className="space-y-6">
              {/* Status Banner */}
              {demoMode && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-green-400">Demo Mode is Active</h4>
                      <p className="text-sm text-green-400/80 mt-1">
                        Sample data has been added to your account. New users will see example claims, 
                        canvassing pins, and inspection sessions to help them understand the platform.
                      </p>
                      {demoStats && (
                        <div className="flex gap-4 mt-3 text-sm">
                          <span className="text-green-400">
                            <strong>{demoStats.claims || 0}</strong> sample claims
                          </span>
                          <span className="text-green-400">
                            <strong>{demoStats.pins || 0}</strong> map pins
                          </span>
                          <span className="text-green-400">
                            <strong>{demoStats.sessions || 0}</strong> inspection sessions
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!demoMode && (
                <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Database className="w-5 h-5 text-zinc-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-white">Demo Mode is Disabled</h4>
                      <p className="text-sm text-zinc-400 mt-1">
                        Enable demo mode to populate your account with sample data. This is useful for:
                      </p>
                      <ul className="text-sm text-zinc-500 mt-2 space-y-1 list-disc list-inside">
                        <li>Training new team members</li>
                        <li>Demonstrating features to clients</li>
                        <li>Testing workflows before going live</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* What Gets Created */}
              <div className="space-y-3">
                <h4 className="font-medium text-white">What demo mode includes:</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/30">
                    <div className="flex items-center gap-2 text-white font-medium mb-1">
                      <FileText className="w-4 h-4 text-orange-500" />
                      Sample Claims
                    </div>
                    <p className="text-sm text-zinc-500">
                      10 realistic claims with varied statuses, loss types, and client info
                    </p>
                  </div>
                  <div className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/30">
                    <div className="flex items-center gap-2 text-white font-medium mb-1">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      Canvassing Pins
                    </div>
                    <p className="text-sm text-zinc-500">
                      20 pins in Miami area with various disposition statuses
                    </p>
                  </div>
                  <div className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/30">
                    <div className="flex items-center gap-2 text-white font-medium mb-1">
                      <Camera className="w-4 h-4 text-green-500" />
                      Inspection Sessions
                    </div>
                    <p className="text-sm text-zinc-500">
                      5 inspection sessions linked to sample claims
                    </p>
                  </div>
                </div>
              </div>

              {/* Toggle Button */}
              <div className="pt-4 border-t border-zinc-700/30">
                <Button 
                  onClick={toggleDemoMode}
                  disabled={demoLoading}
                  className={`w-full ${demoMode ? 'bg-red-600 hover:bg-red-700' : 'btn-tactical'}`}
                  data-testid="demo-mode-toggle"
                >
                  {demoLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {demoMode ? 'Clearing Demo Data...' : 'Setting Up Demo Data...'}
                    </>
                  ) : demoMode ? (
                    <>
                      <XCircle className="w-4 h-4 mr-2" />
                      Disable Demo Mode
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Enable Demo Mode
                    </>
                  )}
                </Button>
                
                {demoMode && (
                  <p className="text-xs text-center text-zinc-600 mt-2">
                    Disabling will permanently remove all demo data marked with is_demo: true
                  </p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Setup Guide Tab */}
        <TabsContent value="guide" className="mt-6">
          <div className="card-tactical p-5">
            <h3 className="font-tactical font-bold text-white uppercase mb-2">OAuth Setup Guide</h3>
            <p className="text-zinc-500 font-mono text-sm mb-6">How to configure OAuth for each provider</p>
            
            <div className="space-y-6">
              {/* Google */}
              <div className="space-y-2">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google Workspace
                </h4>
                <ol className="text-sm text-zinc-400 list-decimal list-inside space-y-1 ml-7">
                  <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">Google Cloud Console</a></li>
                  <li>Create a new project or select existing</li>
                  <li>Enable Gmail, Drive, and Calendar APIs</li>
                  <li>Go to Credentials → Create OAuth Client ID</li>
                  <li>Add authorized redirect URI: <code className="bg-zinc-800/50 px-1 rounded text-zinc-300">YOUR_DOMAIN/api/oauth/google/callback</code></li>
                  <li>Copy Client ID and Secret to backend .env</li>
                </ol>
              </div>

              {/* SignNow */}
              <div className="space-y-2">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                    <span className="text-white font-bold text-[8px]">SN</span>
                  </div>
                  SignNow
                </h4>
                <ol className="text-sm text-zinc-400 list-decimal list-inside space-y-1 ml-7">
                  <li>Go to <a href="https://www.signnow.com/developers" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">SignNow Developer Portal</a></li>
                  <li>Create a new application</li>
                  <li>Add redirect URI: <code className="bg-zinc-800/50 px-1 rounded text-zinc-300">YOUR_DOMAIN/api/oauth/signnow/callback</code></li>
                  <li>Copy Client ID and Secret to backend .env</li>
                </ol>
              </div>

              {/* Notion */}
              <div className="space-y-2">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 100 100">
                    <path d="M6.017 4.313l55.333 -4.087c6.797 -0.583 8.543 -0.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277 -1.553 6.807 -6.99 7.193L24.467 99.967c-4.08 0.193 -6.023 -0.39 -8.16 -3.113L3.3 79.94c-2.333 -3.113 -3.3 -5.443 -3.3 -8.167V11.113c0 -3.497 1.553 -6.413 6.017 -6.8z" fill="#fff"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M61.35 0.227l-55.333 4.087C1.553 4.7 0 7.617 0 11.113v60.66c0 2.723 0.967 5.053 3.3 8.167l13.007 16.913c2.137 2.723 4.08 3.307 8.16 3.113l64.257 -3.89c5.433 -0.387 6.99 -2.917 6.99 -7.193V20.64c0 -2.21 -0.873 -2.847 -3.443 -4.733L74.167 3.143c-4.273 -3.107 -6.02 -3.5 -12.817 -2.917z" fill="#fff"/>
                  </svg>
                  Notion
                </h4>
                <ol className="text-sm text-zinc-400 list-decimal list-inside space-y-1 ml-7">
                  <li>Go to <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">Notion Integrations</a></li>
                  <li>Create new integration (Public type for OAuth)</li>
                  <li>Add redirect URI: <code className="bg-zinc-800/50 px-1 rounded text-zinc-300">YOUR_DOMAIN/api/oauth/notion/callback</code></li>
                  <li>Copy OAuth Client ID and Secret to backend .env</li>
                </ol>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
