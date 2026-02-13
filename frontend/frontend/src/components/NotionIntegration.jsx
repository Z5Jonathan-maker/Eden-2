import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  CheckCircle, XCircle, Loader2, Database, RefreshCw, 
  ExternalLink, AlertCircle, FolderPlus, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { NAV_ICONS } from '../assets/badges';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const NotionIntegration = () => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [databases, setDatabases] = useState([]);
  const [pages, setPages] = useState([]);
  const [selectedParent, setSelectedParent] = useState('');
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedDatabase, setSelectedDatabase] = useState('');

  const getToken = () => localStorage.getItem('eden_token');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/notion/status`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        
        if (data.connected) {
          await Promise.all([fetchDatabases(), fetchPages()]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch Notion status:', err);
      toast.error('Failed to connect to Notion');
    } finally {
      setLoading(false);
    }
  };

  const fetchDatabases = async () => {
    try {
      const res = await fetch(`${API_URL}/api/notion/databases`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setDatabases(data.databases || []);
      }
    } catch (err) {
      console.error('Failed to fetch databases:', err);
    }
  };

  const fetchPages = async () => {
    try {
      const res = await fetch(`${API_URL}/api/notion/pages`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setPages(data.pages || []);
      }
    } catch (err) {
      console.error('Failed to fetch pages:', err);
    }
  };

  const createDatabase = async () => {
    if (!selectedParent) {
      toast.error('Please select a parent page');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/api/notion/databases/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          parent_page_id: selectedParent,
          title: 'Eden Claims'
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        toast.success('Claims database created in Notion!');
        await fetchDatabases();
        setSelectedDatabase(data.database_id);
      } else {
        toast.error(data.detail || 'Failed to create database');
      }
    } catch (err) {
      toast.error('Failed to create database');
    } finally {
      setCreating(false);
    }
  };

  const syncAllClaims = async () => {
    if (!selectedDatabase) {
      toast.error('Please select a database first');
      return;
    }

    setSyncing(true);
    try {
      const res = await fetch(`${API_URL}/api/notion/sync/all?database_id=${selectedDatabase}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` }
      });

      const data = await res.json();
      
      if (res.ok) {
        toast.success(`Synced ${data.synced} claims to Notion!`);
        if (data.failed > 0) {
          toast.warning(`${data.failed} claims failed to sync`);
        }
      } else {
        toast.error(data.detail || 'Failed to sync claims');
      }
    } catch (err) {
      toast.error('Failed to sync claims');
    } finally {
      setSyncing(false);
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
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <svg className="w-10 h-10" viewBox="0 0 100 100">
            <path d="M6.017 4.313l55.333 -4.087c6.797 -0.583 8.543 -0.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277 -1.553 6.807 -6.99 7.193L24.467 99.967c-4.08 0.193 -6.023 -0.39 -8.16 -3.113L3.3 79.94c-2.333 -3.113 -3.3 -5.443 -3.3 -8.167V11.113c0 -3.497 1.553 -6.413 6.017 -6.8z" fill="#fff"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M61.35 0.227l-55.333 4.087C1.553 4.7 0 7.617 0 11.113v60.66c0 2.723 0.967 5.053 3.3 8.167l13.007 16.913c2.137 2.723 4.08 3.307 8.16 3.113l64.257 -3.89c5.433 -0.387 6.99 -2.917 6.99 -7.193V20.64c0 -2.21 -0.873 -2.847 -3.443 -4.733L74.167 3.143c-4.273 -3.107 -6.02 -3.5 -12.817 -2.917z" fill="#000"/>
          </svg>
          <div>
            <h1 className="text-3xl font-tactical font-bold text-white tracking-wide text-glow-orange">NOTION INTEGRATION</h1>
            <p className="text-gray-600">Sync your claims data to Notion databases</p>
          </div>
        </div>
      </div>

      {/* Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="dark:text-gray-900">Connection Status</CardTitle>
            <Button variant="outline" size="sm" onClick={fetchStatus}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {status?.connected ? (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-800">Connected to Notion</span>
              </div>
              <div className="text-sm text-green-700 space-y-1">
                <p><strong>Bot Name:</strong> {status.bot_name}</p>
                <p><strong>Workspace:</strong> {status.workspace_name}</p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="font-medium text-red-800">Not Connected</span>
              </div>
              <p className="text-sm text-red-700">
                {status?.message || 'Notion integration token not configured'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {status?.connected && (
        <>
          {/* Important Note */}
          {pages.length === 0 && databases.length === 0 && (
            <Card className="mb-6 border-yellow-200 bg-yellow-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-yellow-800 mb-2">
                      Share a Page with Eden Claims
                    </h4>
                    <p className="text-sm text-yellow-700 mb-3">
                      The integration doesn't have access to any pages yet. To use this integration:
                    </p>
                    <ol className="text-sm text-yellow-700 list-decimal list-inside space-y-1">
                      <li>Open any page in Notion where you want to store claims</li>
                      <li>Click the <strong>"..."</strong> menu in the top right</li>
                      <li>Click <strong>"Connections"</strong> → <strong>"Connect to"</strong></li>
                      <li>Search for <strong>"Eden Claims"</strong> and select it</li>
                      <li>Click the <strong>Refresh</strong> button above</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Existing Databases */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="dark:text-gray-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-orange-600" />
                Available Databases
              </CardTitle>
              <CardDescription className="dark:text-gray-600">
                Select a database to sync claims or create a new one
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {databases.length > 0 ? (
                <div className="space-y-2">
                  {databases.map((db) => (
                    <div 
                      key={db.id}
                      onClick={() => setSelectedDatabase(db.id)}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedDatabase === db.id 
                          ? 'border-orange-500 bg-orange-50' 
                          : 'border-gray-200 hover:border-orange-300:border-orange-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{db.title}</h4>
                          <p className="text-xs text-gray-500 mt-1">
                            Last edited: {new Date(db.last_edited_time).toLocaleDateString()}
                          </p>
                        </div>
                        {selectedDatabase === db.id && (
                          <Badge className="bg-orange-600">Selected</Badge>
                        )}
                      </div>
                      {db.url && (
                        <a 
                          href={db.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-orange-600 hover:underline mt-2 inline-flex items-center gap-1"
                        >
                          Open in Notion <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No databases found. Create one below or share an existing database with the Eden Claims integration.
                </p>
              )}

              {selectedDatabase && (
                <div className="pt-4 border-t">
                  <Button 
                    onClick={syncAllClaims}
                    disabled={syncing}
                    className="w-full bg-orange-600 hover:bg-orange-700"
                  >
                    {syncing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Syncing Claims...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Sync All Claims to Notion
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Create New Database */}
          {pages.length > 0 && (
            <Card className="dark:bg-white">
              <CardHeader>
                <CardTitle className="dark:text-gray-900 flex items-center gap-2">
                  <FolderPlus className="w-5 h-5 text-orange-600" />
                  Create Claims Database
                </CardTitle>
                <CardDescription className="dark:text-gray-600">
                  Create a new database in Notion with all the right fields for claims
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Parent Page
                  </label>
                  <select
                    value={selectedParent}
                    onChange={(e) => setSelectedParent(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900"
                  >
                    <option value="">Select a page...</option>
                    {pages.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.title || 'Untitled'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">
                    Database will include these fields:
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Claim Number
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Client Name
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Status
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Carrier
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Policy Number
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Loss Type
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Date of Loss
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Claim Amount
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Address
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Contact Info
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={createDatabase}
                  disabled={!selectedParent || creating}
                  className="w-full bg-orange-600 hover:bg-orange-700"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Database...
                    </>
                  ) : (
                    <>
                      <FolderPlus className="w-4 h-4 mr-2" />
                      Create Eden Claims Database
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default NotionIntegration;
