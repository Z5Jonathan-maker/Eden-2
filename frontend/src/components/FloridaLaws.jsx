/**
 * FloridaLaws.jsx - Florida Public Adjusting Laws Reference
 * Displays verbatim statutes from Online Sunshine database
 * Includes admin controls for scraping and database management
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../shared/ui/card';
import { Badge } from '../shared/ui/badge';
import { Button } from '../shared/ui/button';
import { Input } from '../shared/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../shared/ui/tabs';
import { ScrollArea } from '../shared/ui/scroll-area';
import {
  Scale,
  FileText,
  AlertCircle,
  Search,
  ExternalLink,
  Clock,
  DollarSign,
  Shield,
  Users,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Gavel,
  BookOpen,
  Hash,
  Download,
  RefreshCw,
  Database,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = import.meta.env.REACT_APP_BACKEND_URL;

const FloridaLaws = () => {
  // Static data state
  const [overview, setOverview] = useState(null);
  const [updates, setUpdates] = useState([]);

  // Database-backed statute state
  const [dbStatutes, setDbStatutes] = useState([]);
  const [dbStatus, setDbStatus] = useState(null);
  const [selectedStatute, setSelectedStatute] = useState(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [activeTab, setActiveTab] = useState('database');
  const [copied, setCopied] = useState(false);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/knowledge-base/florida-laws`);
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
      }
    } catch (err) {
      console.error('Failed to fetch overview:', err);
    }
  }, []);

  const fetchDbStatutes = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/statutes/?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setDbStatutes(data.statutes || []);
      }
    } catch (err) {
      console.error('Failed to fetch DB statutes:', err);
    }
  }, []);

  const fetchDbStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/statutes/status`);
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch DB status:', err);
    }
  }, []);

  const fetchUpdates = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/knowledge-base/florida-laws/updates`);
      if (res.ok) {
        const data = await res.json();
        setUpdates(data.updates || []);
      }
    } catch (err) {
      console.error('Failed to fetch updates:', err);
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchOverview(), fetchDbStatutes(), fetchDbStatus(), fetchUpdates()]);
    setLoading(false);
  }, [fetchOverview, fetchDbStatutes, fetchDbStatus, fetchUpdates]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const fetchStatuteDetail = async (sectionNumber) => {
    try {
      const res = await fetch(`${API_URL}/api/statutes/section/${sectionNumber}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedStatute(data);
      } else {
        toast.error(`Could not load Sec. ${sectionNumber}`);
      }
    } catch (err) {
      console.error('Failed to fetch statute detail:', err);
      toast.error('Failed to load statute');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    try {
      const res = await fetch(
        `${API_URL}/api/statutes/search?q=${encodeURIComponent(searchQuery)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results);
      }
    } catch (err) {
      console.error('Search failed:', err);
      toast.error('Search failed');
    }
  };

  const triggerFullScrape = async () => {
    setScraping(true);
    try {
      const res = await fetch(`${API_URL}/api/statutes/scrape?year=2025`, { method: 'POST' });
      if (res.ok) {
        toast.success('Scraping started! This runs in background.');
        // Poll for updates
        setTimeout(() => {
          fetchDbStatus();
          fetchDbStatutes();
        }, 5000);
        setTimeout(() => {
          fetchDbStatus();
          fetchDbStatutes();
        }, 15000);
        setTimeout(() => {
          fetchDbStatus();
          fetchDbStatutes();
          setScraping(false);
        }, 30000);
      } else {
        toast.error('Failed to start scraping');
        setScraping(false);
      }
    } catch (err) {
      console.error('Scrape failed:', err);
      toast.error('Scrape request failed');
      setScraping(false);
    }
  };

  const copyStatuteText = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Statute text copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const KeyNumberCard = ({ icon: Icon, label, value, color }) => (
    <div className={`p-4 rounded-lg border ${color}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 page-enter" data-testid="florida-laws-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-tactical font-bold text-white flex items-center gap-2 tracking-wide">
            <img
              src="/icons/laws.png"
              alt="Laws"
              className="w-10 h-10 object-contain icon-3d-shadow"
            />
            Florida Laws
          </h1>
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">
            Verbatim statutes from Online Sunshine
          </p>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <Input
            placeholder="Search statutes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-64"
            data-testid="law-search-input"
          />
          <Button onClick={handleSearch} size="icon" variant="outline">
            <Search className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Database Status Banner */}
      {dbStatus && (
        <Card className="bg-zinc-900/50 border-blue-500/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <Database className="w-8 h-8 text-blue-400" />
                <div>
                  <p className="font-semibold text-blue-400">Statute Database</p>
                  <p className="text-sm text-blue-400">
                    {dbStatus.total_statutes} statutes stored | Chapter 626:{' '}
                    {dbStatus.coverage?.['626']} | Chapter 627: {dbStatus.coverage?.['627']}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    fetchDbStatutes();
                    fetchDbStatus();
                  }}
                  className="border-blue-300"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  onClick={triggerFullScrape}
                  disabled={scraping}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {scraping ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                      Scraping...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-1" />
                      Scrape All Statutes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      {searchResults && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="text-lg">Search Results for "{searchQuery}"</CardTitle>
          </CardHeader>
          <CardContent>
            {searchResults.length === 0 ? (
              <p className="text-zinc-500">No results found in database</p>
            ) : (
              <div className="space-y-3">
                {searchResults.map((result, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between p-3 border rounded-lg hover:bg-orange-50 cursor-pointer"
                    onClick={() => fetchStatuteDetail(result.section_number)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-100 text-blue-400">
                          Sec. {result.section_number}
                        </Badge>
                        <span className="font-medium">{result.heading}</span>
                      </div>
                      <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{result.excerpt}</p>
                    </div>
                    <Badge variant="outline">Score: {result.score?.toFixed(1)}</Badge>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchResults(null)}
              className="mt-4"
            >
              Clear Search
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Statute Detail View */}
      {selectedStatute ? (
        <Card className="border-blue-200">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <Badge className="bg-blue-100 text-blue-400 mb-2">
                  Sec. {selectedStatute.section_number}, {selectedStatute.year} Fla. Stat.
                </Badge>
                <CardTitle>
                  {selectedStatute.heading || `Section ${selectedStatute.section_number}`}
                </CardTitle>
                <CardDescription>{selectedStatute.chapter}</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyStatuteText(selectedStatute.body_text)}
                >
                  {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  {copied ? 'Copied!' : 'Copy Text'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedStatute(null)}>
                  Back
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Verbatim Text Warning */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 text-yellow-800 font-medium">
                <AlertCircle className="w-4 h-4" />
                VERBATIM STATUTE TEXT
              </div>
              <p className="text-yellow-700 mt-1">
                This is the exact text as published by the Florida Legislature. Do not modify for
                legal citations.
              </p>
            </div>

            {/* Body Text */}
            <ScrollArea className="h-[400px] border rounded-lg p-4 bg-zinc-800/30">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
                {selectedStatute.body_text}
              </pre>
            </ScrollArea>

            {/* Metadata */}
            <div className="flex items-center gap-4 text-sm text-zinc-500 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Year: {selectedStatute.year}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Verified:{' '}
                {selectedStatute.last_verified
                  ? new Date(selectedStatute.last_verified).toLocaleDateString()
                  : 'N/A'}
              </span>
              {selectedStatute.source_url && (
                <a
                  href={selectedStatute.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  Official Source (Online Sunshine)
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="database" data-testid="tab-database">
              <Database className="w-4 h-4 mr-2" />
              Statute Database ({dbStatutes.length})
            </TabsTrigger>
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Hash className="w-4 h-4 mr-2" />
              Key Numbers
            </TabsTrigger>
            <TabsTrigger value="updates" data-testid="tab-updates">
              <AlertTriangle className="w-4 h-4 mr-2" />
              2026 Updates ({updates.length})
            </TabsTrigger>
          </TabsList>

          {/* Database Tab - Verbatim Statutes */}
          <TabsContent value="database" className="mt-6">
            {dbStatutes.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-zinc-300">No Statutes in Database</h3>
                  <p className="text-zinc-500 mt-1 mb-4">
                    Click "Scrape All Statutes" to fetch from Online Sunshine
                  </p>
                  <Button onClick={triggerFullScrape} disabled={scraping}>
                    <Download className="w-4 h-4 mr-2" />
                    Scrape All Statutes
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-zinc-400">
                  Click any statute to view the verbatim text as published by the Florida
                  Legislature.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {dbStatutes.map((statute) => (
                    <Card
                      key={statute.id}
                      className="cursor-pointer hover:shadow-md transition-all hover:border-blue-300"
                      onClick={() => fetchStatuteDetail(statute.section_number)}
                      data-testid={`db-statute-${statute.section_number}`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <Badge className="bg-blue-100 text-blue-400 mb-1">
                              Sec. {statute.section_number}
                            </Badge>
                            <CardTitle className="text-base">
                              {statute.heading || 'View Statute'}
                            </CardTitle>
                          </div>
                          <ExternalLink className="w-4 h-4 text-gray-400" />
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-xs text-zinc-500">
                          Verified:{' '}
                          {statute.last_verified
                            ? new Date(statute.last_verified).toLocaleDateString()
                            : 'N/A'}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Overview Tab - Key Numbers */}
          <TabsContent value="overview" className="mt-6 space-y-6">
            {overview?.key_numbers && (
              <>
                <h3 className="text-lg font-semibold text-white">Quick Reference Numbers</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <KeyNumberCard
                    icon={DollarSign}
                    label="Max Fee (Standard)"
                    value={overview.key_numbers.max_fee_standard}
                    color="bg-green-50 border-green-200 text-green-700"
                  />
                  <KeyNumberCard
                    icon={AlertCircle}
                    label="Max Fee (Emergency)"
                    value={overview.key_numbers.max_fee_emergency}
                    color="bg-yellow-50 border-yellow-200 text-yellow-700"
                  />
                  <KeyNumberCard
                    icon={Shield}
                    label="Surety Bond"
                    value={`$${overview.key_numbers.surety_bond?.toLocaleString()}`}
                    color="bg-blue-50 border-blue-200 text-blue-400"
                  />
                  <KeyNumberCard
                    icon={Calendar}
                    label="Rescission Period"
                    value={`${overview.key_numbers.contract_rescission_days} days`}
                    color="bg-purple-50 border-purple-200 text-purple-700"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <KeyNumberCard
                    icon={Clock}
                    label="Claim Acknowledgment"
                    value={`${overview.key_numbers.claim_acknowledgment_days} days`}
                    color="bg-orange-50 border-orange-200 text-orange-700"
                  />
                  <KeyNumberCard
                    icon={CheckCircle}
                    label="Pay/Deny Deadline"
                    value={`${overview.key_numbers.claim_pay_deny_days} days`}
                    color="bg-red-50 border-red-200 text-red-700"
                  />
                  <KeyNumberCard
                    icon={BookOpen}
                    label="CE Hours (Biennial)"
                    value={`${overview.key_numbers.ce_hours_biennial} hrs`}
                    color="bg-indigo-50 border-indigo-200 text-indigo-700"
                  />
                  <KeyNumberCard
                    icon={Users}
                    label="Max Apprentices"
                    value={overview.key_numbers.max_apprentices_per_firm}
                    color="bg-pink-50 border-pink-200 text-pink-700"
                  />
                </div>

                {/* Resources */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Official Resources</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {overview.resources?.map((resource, i) => (
                        <a
                          key={i}
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 border rounded-lg hover:bg-zinc-800/30 transition-colors"
                        >
                          <p className="font-medium text-white">{resource.type}</p>
                          <p className="text-sm text-zinc-400">{resource.description}</p>
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Updates Tab */}
          <TabsContent value="updates" className="mt-6">
            <div className="space-y-4">
              <Card className="bg-yellow-50 border-yellow-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    Pending 2026 Legislation
                  </CardTitle>
                  <CardDescription>
                    Bills currently advancing that may affect public adjusters
                  </CardDescription>
                </CardHeader>
              </Card>

              {updates.map((update) => (
                <Card key={update.id} data-testid={`update-card-${update.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{update.bill}</CardTitle>
                        <CardDescription>{update.summary}</CardDescription>
                      </div>
                      <Badge
                        className={
                          update.status?.includes('advancing')
                            ? 'bg-yellow-100 text-yellow-700'
                            : update.status?.includes('Passed')
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-zinc-300'
                        }
                      >
                        {update.status?.includes('advancing')
                          ? 'In Progress'
                          : update.status?.includes('Passed')
                            ? 'Passed'
                            : 'Introduced'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-zinc-300 mb-3">{update.details}</p>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-zinc-500">{update.status}</span>
                      {update.source_url && (
                        <a
                          href={update.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Bill
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default FloridaLaws;
