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
  Wrench,
  ChevronRight,
  Target,
  Crosshair,
  Hammer,
  Droplets,
  Zap,
  ClipboardList,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';

// ==================== TOOLKITS DATA ====================
// Scenario-based statute bundles for new adjusters
// Operational relevance notes only — NOT legal advice.
const TOOLKITS = [
  {
    id: 'roof-replacement',
    title: 'Roof Replacement / Scope Disputes',
    icon: Hammer,
    color: 'orange',
    why: 'When the carrier agrees there is roof damage but disputes full replacement vs. repair.',
    carrierMove: 'Approve partial repair, deny full replacement, argue "matching" not required.',
    ourMove: 'Cite statutes requiring uniform appearance, duty to inspect, and roof coverage provisions. Document with photos + measurements.',
    statutes: [
      { section: '627.70152', name: 'Uniform & Consistent Repairs (Matching)' },
      { section: '627.712', name: 'Residential Roof Coverage' },
      { section: '627.70151', name: 'Insurer Duty to Inspect Property' },
      { section: '627.7011', name: 'Insurer Duties to Policyholders' },
    ],
  },
  {
    id: 'matching-appearance',
    title: 'Matching / Uniform Appearance',
    icon: Target,
    color: 'blue',
    why: 'When the carrier replaces damaged areas but refuses to match adjacent undamaged areas.',
    carrierMove: 'Pay to replace only damaged shingles/siding, creating mismatched appearance.',
    ourMove: 'Florida Statute 627.70152 requires repairs that are uniform and reasonably consistent in appearance. Document the mismatch with side-by-side photos.',
    statutes: [
      { section: '627.70152', name: 'Uniform & Consistent Repairs (Matching)' },
      { section: '627.70151', name: 'Insurer Duty to Inspect Property' },
      { section: '627.7011', name: 'Insurer Duties to Policyholders' },
    ],
  },
  {
    id: 'ordinance-law',
    title: 'Ordinance & Law / Code Upgrades',
    icon: Gavel,
    color: 'purple',
    why: 'When repairs trigger building code compliance that exceeds the original construction standard.',
    carrierMove: 'Estimate to old code standards, deny code upgrade costs as "betterment."',
    ourMove: 'Invoke Ordinance & Law coverage under 627.706. Document current code requirements vs. original installation.',
    statutes: [
      { section: '627.706', name: 'Ordinance or Law Coverage' },
      { section: '627.7065', name: 'Building Code Compliance' },
      { section: '627.7011', name: 'Insurer Duties to Policyholders' },
    ],
  },
  {
    id: 'delay-no-response',
    title: 'Delay / No Coverage Determination',
    icon: Clock,
    color: 'red',
    why: 'When the carrier fails to acknowledge, investigate, or make a coverage determination within statutory timelines.',
    carrierMove: 'Delay acknowledgment, extend investigation indefinitely, ignore deadlines.',
    ourMove: 'Reference statutory timelines: 7-day acknowledgment (627.70131), 14-day updates, 60/90-day pay/deny (627.70132). Document every missed deadline.',
    statutes: [
      { section: '627.70131', name: 'Duty to Acknowledge Claims (7 days)' },
      { section: '627.70132', name: 'Processing & Pay/Deny Deadlines (60/90 days)' },
      { section: '627.7015', name: 'Unfair Claim Settlement Practices' },
      { section: '627.7017', name: 'Notice of Claim Requirements' },
    ],
  },
  {
    id: 'underpayment-scope',
    title: 'Underpayment / Missing Scope Items',
    icon: DollarSign,
    color: 'green',
    why: 'When the carrier\'s estimate is missing line items or using below-market pricing.',
    carrierMove: 'Issue incomplete estimate, use carrier-modified pricing below market.',
    ourMove: 'Submit supplement under 627.70153. Track owed vs. paid. Cite unfair settlement practices if carrier ignores evidence.',
    statutes: [
      { section: '627.70153', name: 'Supplemental Claims' },
      { section: '627.7015', name: 'Unfair Claim Settlement Practices' },
      { section: '627.7011', name: 'Insurer Duties to Policyholders' },
      { section: '627.70152', name: 'Uniform & Consistent Repairs (Matching)' },
    ],
  },
  {
    id: 'water-damage',
    title: 'Water Damage / Tear-Out',
    icon: Droplets,
    color: 'cyan',
    why: 'When the carrier limits water damage scope, denies tear-out, or argues maintenance exclusion.',
    carrierMove: 'Limit scope to visible damage, deny exploratory tear-out, claim maintenance.',
    ourMove: 'Document moisture readings, establish cause with Tier 1 evidence. Cite duty to inspect (627.70151) and temporary repair coverage (627.708).',
    statutes: [
      { section: '627.70151', name: 'Insurer Duty to Inspect Property' },
      { section: '627.708', name: 'Coverage for Temporary Repairs' },
      { section: '627.70153', name: 'Supplemental Claims' },
      { section: '627.7011', name: 'Insurer Duties to Policyholders' },
    ],
  },
  {
    id: 'pa-compliance',
    title: 'Public Adjuster Compliance',
    icon: Shield,
    color: 'zinc',
    why: 'Know the rules that govern your license, fees, contracts, and conduct.',
    carrierMove: 'Challenge PA authority, question contract validity, allege fee violations.',
    ourMove: 'Maintain strict compliance: proper contracts (626.8796), fee limits (626.854), bond requirements (626.865), ethical conduct (626.8795).',
    statutes: [
      { section: '626.854', name: 'PA Definition, Prohibitions & Fee Caps' },
      { section: '626.8796', name: 'PA Contract Requirements' },
      { section: '626.865', name: 'PA Qualifications & $50k Bond' },
      { section: '626.8795', name: 'Conflict of Interest Prohibition' },
      { section: '626.8651', name: 'PA Apprentice Requirements' },
    ],
  },
];

const TOOLKIT_COLORS = {
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-300', badge: 'bg-orange-500/20 text-orange-300' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300', badge: 'bg-blue-500/20 text-blue-300' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-300', badge: 'bg-purple-500/20 text-purple-300' },
  red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300', badge: 'bg-red-500/20 text-red-300' },
  green: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-300', badge: 'bg-green-500/20 text-green-300' },
  cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-300', badge: 'bg-cyan-500/20 text-cyan-300' },
  zinc: { bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', text: 'text-zinc-300', badge: 'bg-zinc-500/20 text-zinc-300' },
};

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
  const [activeTab, setActiveTab] = useState('toolkits');
  const [copied, setCopied] = useState(false);
  const [selectedToolkit, setSelectedToolkit] = useState(null);

  // Argument Builder state
  const [argGoal, setArgGoal] = useState('');
  const [argEvidence, setArgEvidence] = useState({ photos: false, aerials: false, moisture: false, contractor: false, weather: false });
  const [argCarrierMove, setArgCarrierMove] = useState('');
  const [argOurMove, setArgOurMove] = useState('');
  const [argDeadline, setArgDeadline] = useState('');
  const [argOutput, setArgOutput] = useState('');

  const fetchOverview = useCallback(async () => {
    try {
      const res = await apiGet('/api/knowledge-base/florida-laws');
      if (res.ok) setOverview(res.data);
    } catch (err) {
      console.error('Failed to fetch overview:', err);
    }
  }, []);

  const fetchDbStatutes = useCallback(async () => {
    try {
      const res = await apiGet('/api/statutes/?limit=100');
      if (res.ok) setDbStatutes(res.data.statutes || []);
    } catch (err) {
      console.error('Failed to fetch DB statutes:', err);
    }
  }, []);

  const fetchDbStatus = useCallback(async () => {
    try {
      const res = await apiGet('/api/statutes/status');
      if (res.ok) setDbStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch DB status:', err);
    }
  }, []);

  const fetchUpdates = useCallback(async () => {
    try {
      const res = await apiGet('/api/knowledge-base/florida-laws/updates');
      if (res.ok) setUpdates(res.data.updates || []);
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
      const res = await apiGet(`/api/statutes/section/${sectionNumber}`);
      if (res.ok) {
        setSelectedStatute(res.data);
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
      const res = await apiGet(`/api/statutes/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        // Enrich results with toolkit tags (only match by statute number, not loose keywords)
        const enriched = (res.data.results || []).map(result => {
          const matchingToolkits = TOOLKITS.filter(tk =>
            tk.statutes.some(s => s.section === result.section_number)
          );
          return { ...result, toolkitTags: matchingToolkits.map(tk => tk.title) };
        });
        setSearchResults(enriched);
      }
    } catch (err) {
      console.error('Search failed:', err);
      toast.error('Search failed');
    }
  };

  const triggerFullScrape = async () => {
    setScraping(true);
    try {
      const res = await apiPost('/api/statutes/scrape?year=2025', {});
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
        <Card className="border-orange-500/30">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-100">Search Results for "{searchQuery}"</CardTitle>
          </CardHeader>
          <CardContent>
            {searchResults.length === 0 ? (
              <p className="text-zinc-500">No results found in database. Try different keywords or check the Toolkits tab for scenario-based search.</p>
            ) : (
              <div className="space-y-3">
                {searchResults.map((result, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between p-3 border border-zinc-700 rounded-lg hover:border-blue-500/40 cursor-pointer transition-all"
                    onClick={() => fetchStatuteDetail(result.section_number)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          §{result.section_number}
                        </Badge>
                        <span className="font-medium text-zinc-200">{result.heading}</span>
                      </div>
                      <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{result.excerpt}</p>
                      {result.toolkitTags?.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {result.toolkitTags.map((tag, j) => (
                            <Badge key={j} className="bg-orange-500/10 text-orange-300 text-[10px] border border-orange-500/20">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0 mt-1" />
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
        <Card className="border-zinc-700">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    §{selectedStatute.section_number}, {selectedStatute.year} Fla. Stat.
                  </Badge>
                  {/* Integrity status chip */}
                  {selectedStatute.status === 'complete' || (selectedStatute.body_length > 200) ? (
                    <Badge className="bg-green-500/20 text-green-300 border border-green-500/30">
                      <CheckCircle className="w-3 h-3 mr-1" /> Complete
                    </Badge>
                  ) : selectedStatute.status === 'history_only' || (selectedStatute.body_length < 100 && selectedStatute.body_text?.startsWith('History')) ? (
                    <Badge className="bg-red-500/20 text-red-300 border border-red-500/30">
                      <AlertCircle className="w-3 h-3 mr-1" /> Incomplete — History Only
                    </Badge>
                  ) : (
                    <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                      <AlertTriangle className="w-3 h-3 mr-1" /> Partial
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-zinc-100">
                  {selectedStatute.heading || `Section ${selectedStatute.section_number}`}
                </CardTitle>
                <CardDescription>{selectedStatute.chapter}</CardDescription>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyStatuteText(selectedStatute.body_text)}
                  className="border-zinc-700"
                >
                  {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  {copied ? 'Copied!' : 'Copy Verbatim'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyStatuteText(`§${selectedStatute.section_number}, ${selectedStatute.year} Fla. Stat.`)}
                  className="border-zinc-700"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Citation
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedStatute(null)} className="border-zinc-700">
                  Back
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Verbatim integrity warning if incomplete */}
            {(selectedStatute.status === 'history_only' || (selectedStatute.body_length < 100)) && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 text-red-300 font-medium">
                  <AlertCircle className="w-4 h-4" />
                  INCOMPLETE STATUTE TEXT
                </div>
                <p className="text-red-300/80 mt-1">
                  This statute may only contain the History line. Click "Scrape All Statutes" to re-fetch the full text.
                </p>
              </div>
            )}

            {/* Verbatim label */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 text-yellow-300 font-medium">
                <Scale className="w-4 h-4" />
                VERBATIM STATUTE TEXT
              </div>
              <p className="text-yellow-300/70 mt-1">
                Exact text as published by the Florida Legislature. Not legal advice — operational reference only.
              </p>
            </div>

            {/* Body Text */}
            <ScrollArea className="h-[500px] border border-zinc-700 rounded-lg p-4 bg-zinc-950/50">
              <pre className="whitespace-pre-wrap text-sm text-zinc-200 font-mono leading-relaxed">
                {selectedStatute.body_text}
              </pre>
            </ScrollArea>

            {/* History (collapsible) */}
            {selectedStatute.history && (
              <details className="border border-zinc-700 rounded-lg">
                <summary className="px-4 py-2 text-sm text-zinc-400 cursor-pointer hover:text-zinc-200 font-mono uppercase">
                  History
                </summary>
                <div className="px-4 pb-3 text-xs text-zinc-500 font-mono">
                  {selectedStatute.history}
                </div>
              </details>
            )}

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
              {selectedStatute.body_length > 0 && (
                <span className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  {selectedStatute.body_length?.toLocaleString()} chars
                </span>
              )}
              {selectedStatute.source_url && (
                <a
                  href={selectedStatute.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  Online Sunshine
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="toolkits" data-testid="tab-toolkits">
              <Wrench className="w-4 h-4 mr-2" />
              Toolkits
            </TabsTrigger>
            <TabsTrigger value="database" data-testid="tab-database">
              <Database className="w-4 h-4 mr-2" />
              All Statutes ({dbStatutes.length})
            </TabsTrigger>
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Hash className="w-4 h-4 mr-2" />
              Key Numbers
            </TabsTrigger>
            <TabsTrigger value="builder" data-testid="tab-builder">
              <ClipboardList className="w-4 h-4 mr-2" />
              Argument Builder
            </TabsTrigger>
            <TabsTrigger value="updates" data-testid="tab-updates">
              <AlertTriangle className="w-4 h-4 mr-2" />
              2026 Updates ({updates.length})
            </TabsTrigger>
          </TabsList>

          {/* Toolkits Tab - Scenario-Based Entry */}
          <TabsContent value="toolkits" className="mt-6">
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-4">
              Operational relevance notes. Not legal advice.
            </p>

            {selectedToolkit ? (
              <div className="space-y-4">
                <Button variant="outline" size="sm" onClick={() => setSelectedToolkit(null)} className="border-zinc-700 mb-2">
                  ← All Toolkits
                </Button>
                {(() => {
                  const tk = TOOLKITS.find(t => t.id === selectedToolkit);
                  if (!tk) return null;
                  const colors = TOOLKIT_COLORS[tk.color];
                  const Icon = tk.icon;
                  return (
                    <Card className={`${colors.border} border`}>
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${colors.bg}`}>
                            <Icon className={`w-6 h-6 ${colors.text}`} />
                          </div>
                          <div>
                            <CardTitle className="text-zinc-100">{tk.title}</CardTitle>
                            <CardDescription>{tk.why}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                            <p className="text-[10px] font-mono uppercase text-red-400 mb-1">Common Carrier Move</p>
                            <p className="text-sm text-zinc-300">{tk.carrierMove}</p>
                          </div>
                          <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                            <p className="text-[10px] font-mono uppercase text-green-400 mb-1">Our Move</p>
                            <p className="text-sm text-zinc-300">{tk.ourMove}</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] font-mono uppercase text-zinc-500 mb-2">Relevant Statutes</p>
                          <div className="space-y-2">
                            {tk.statutes.map(s => (
                              <div
                                key={s.section}
                                className="flex items-center justify-between p-3 border border-zinc-700 rounded-lg hover:border-blue-500/40 cursor-pointer transition-all"
                                onClick={() => {
                                  fetchStatuteDetail(s.section);
                                  setSelectedToolkit(null);
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">§{s.section}</Badge>
                                  <span className="text-sm text-zinc-300">{s.name}</span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-zinc-600" />
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {TOOLKITS.map(tk => {
                  const colors = TOOLKIT_COLORS[tk.color];
                  const Icon = tk.icon;
                  return (
                    <Card
                      key={tk.id}
                      className={`cursor-pointer hover:shadow-lg transition-all border-zinc-700 hover:${colors.border}`}
                      onClick={() => setSelectedToolkit(tk.id)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${colors.bg}`}>
                            <Icon className={`w-5 h-5 ${colors.text}`} />
                          </div>
                          <CardTitle className="text-base text-zinc-200">{tk.title}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-zinc-400 mb-3">{tk.why}</p>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <Scale className="w-3 h-3" />
                          {tk.statutes.length} statutes
                          <ChevronRight className="w-3 h-3 ml-auto" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

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
                  {dbStatutes.map((statute) => {
                    const isComplete = statute.status === 'complete' || (statute.body_length > 200);
                    const isHistoryOnly = statute.status === 'history_only' || (statute.body_length > 0 && statute.body_length < 100);
                    return (
                      <Card
                        key={statute.id}
                        className={`cursor-pointer hover:shadow-md transition-all ${isHistoryOnly ? 'border-red-500/30 hover:border-red-500/50' : 'border-zinc-700 hover:border-blue-500/40'}`}
                        onClick={() => fetchStatuteDetail(statute.section_number)}
                        data-testid={`db-statute-${statute.section_number}`}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                  §{statute.section_number}
                                </Badge>
                                {isComplete && (
                                  <Badge className="bg-green-500/20 text-green-300 text-[10px] px-1.5 py-0">
                                    <CheckCircle className="w-2.5 h-2.5 mr-0.5" /> OK
                                  </Badge>
                                )}
                                {isHistoryOnly && (
                                  <Badge className="bg-red-500/20 text-red-300 text-[10px] px-1.5 py-0">
                                    <AlertCircle className="w-2.5 h-2.5 mr-0.5" /> Incomplete
                                  </Badge>
                                )}
                              </div>
                              <CardTitle className="text-base text-zinc-200">
                                {statute.heading || 'View Statute'}
                              </CardTitle>
                            </div>
                            <ExternalLink className="w-4 h-4 text-zinc-600 flex-shrink-0" />
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
                    );
                  })}
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

          {/* Argument Builder Tab */}
          <TabsContent value="builder" className="mt-6">
            <Card className="border-zinc-700">
              <CardHeader>
                <CardTitle className="text-zinc-100 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-orange-400" />
                  Internal Argument Builder
                </CardTitle>
                <CardDescription>
                  Structure an internal claim note or email skeleton. No legal citations or statute interpretation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-[11px] font-mono text-zinc-500 uppercase">Goal</label>
                  <Input
                    value={argGoal}
                    onChange={e => setArgGoal(e.target.value)}
                    placeholder="e.g., Support full roof replacement, recover withheld depreciation..."
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-zinc-500 uppercase mb-2 block">Evidence Checklist</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {[
                      { key: 'photos', label: 'Damage Photos (3-angle)' },
                      { key: 'aerials', label: 'Historical Aerials' },
                      { key: 'moisture', label: 'Moisture Readings' },
                      { key: 'contractor', label: 'Contractor Estimate' },
                      { key: 'weather', label: 'Weather Data / NOAA' },
                    ].map(item => (
                      <label key={item.key} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={argEvidence[item.key]}
                          onChange={e => setArgEvidence(prev => ({ ...prev, [item.key]: e.target.checked }))}
                          className="accent-orange-500"
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-[11px] font-mono text-zinc-500 uppercase">Carrier Move</label>
                    <Input
                      value={argCarrierMove}
                      onChange={e => setArgCarrierMove(e.target.value)}
                      placeholder="e.g., Denied full replacement, approved repair only..."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-mono text-zinc-500 uppercase">Our Move</label>
                    <Input
                      value={argOurMove}
                      onChange={e => setArgOurMove(e.target.value)}
                      placeholder="e.g., Submit supplement with evidence-aligned scope..."
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-mono text-zinc-500 uppercase">Response Deadline</label>
                  <Input
                    type="date"
                    value={argDeadline}
                    onChange={e => setArgDeadline(e.target.value)}
                    className="mt-1 w-48"
                  />
                </div>

                <Button
                  className="bg-orange-500/15 text-orange-300 border border-orange-500/30 hover:bg-orange-500/25"
                  onClick={() => {
                    const checkedEvidence = Object.entries(argEvidence)
                      .filter(([, v]) => v)
                      .map(([k]) => ({
                        photos: 'Damage photos (3-angle documentation)',
                        aerials: 'Historical aerial imagery',
                        moisture: 'Moisture readings with dry standard comparison',
                        contractor: 'Contractor estimate / scope',
                        weather: 'Weather data / NOAA reports',
                      }[k]));

                    const note = [
                      `INTERNAL CLAIM NOTE`,
                      `Date: ${new Date().toLocaleDateString()}`,
                      ``,
                      `GOAL: ${argGoal || '[Not specified]'}`,
                      ``,
                      `EVIDENCE ON FILE:`,
                      ...(checkedEvidence.length > 0 ? checkedEvidence.map(e => `  ✓ ${e}`) : ['  [No evidence checked]']),
                      ``,
                      `CARRIER POSITION: ${argCarrierMove || '[Not specified]'}`,
                      ``,
                      `OUR POSITION: ${argOurMove || '[Not specified]'}`,
                      ``,
                      `DEADLINE: ${argDeadline ? new Date(argDeadline).toLocaleDateString() : '[Not set]'}`,
                      ``,
                      `NEXT STEPS:`,
                      `  1. Verify all evidence is documented and organized`,
                      `  2. Submit structured supplement / response by deadline`,
                      `  3. If no response by deadline, escalate per doctrine`,
                      ``,
                      `---`,
                      `This is an internal operational note. Not legal advice.`,
                    ].join('\n');

                    setArgOutput(note);
                  }}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Generate Note
                </Button>

                {argOutput && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-mono text-zinc-500 uppercase">Generated Note</label>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-zinc-700"
                        onClick={() => {
                          navigator.clipboard.writeText(argOutput);
                          toast.success('Note copied to clipboard');
                        }}
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copy
                      </Button>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm text-zinc-200 font-mono leading-relaxed bg-zinc-950/50 border border-zinc-700 rounded-lg p-4">
                      {argOutput}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
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
