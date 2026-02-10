import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Progress } from './ui/progress';
import { ScrollArea } from './ui/scroll-area';
import { 
  Scale, Upload, FileText, AlertTriangle, CheckCircle, 
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw, Sparkles,
  Download, Eye, Trash2, BarChart3, TrendingUp, FileWarning,
  ChevronRight, Filter, Search, X, PenTool
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount || 0);
};

// Variance indicator component
const VarianceIndicator = ({ value, showPercent = false, baseValue = 0 }) => {
  if (value === 0) {
    return <span className="text-zinc-500 flex items-center gap-1"><Minus className="w-3 h-3" /> Match</span>;
  }
  
  const isPositive = value > 0;
  const percent = baseValue > 0 ? ((value / baseValue) * 100).toFixed(1) : 0;
  
  return (
    <span className={`flex items-center gap-1 font-medium ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
      {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
      {formatCurrency(Math.abs(value))}
      {showPercent && <span className="text-xs opacity-75">({percent}%)</span>}
    </span>
  );
};

// Impact badge component
const ImpactBadge = ({ impact }) => {
  const colors = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-gray-100 text-zinc-400 border-zinc-700/30'
  };
  
  return (
    <Badge variant="outline" className={colors[impact] || colors.low}>
      {impact?.toUpperCase()}
    </Badge>
  );
};

export default function Scales() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('upload');
  const [estimates, setEstimates] = useState([]);
  const [comparisons, setComparisons] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Upload state
  const [carrierFile, setCarrierFile] = useState(null);
  const [contractorFile, setContractorFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Comparison state
  const [selectedCarrier, setSelectedCarrier] = useState(null);
  const [selectedContractor, setSelectedContractor] = useState(null);
  const [activeComparison, setActiveComparison] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterImpact, setFilterImpact] = useState('all');

  // Fetch data
  const fetchEstimates = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/scales/estimates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEstimates(data);
      }
    } catch (error) {
      console.error('Error fetching estimates:', error);
    }
  }, [token]);

  const fetchComparisons = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/scales/comparisons`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setComparisons(data);
      }
    } catch (error) {
      console.error('Error fetching comparisons:', error);
    }
  }, [token]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/scales/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [token]);

  useEffect(() => {
    fetchEstimates();
    fetchComparisons();
    fetchStats();
  }, [fetchEstimates, fetchComparisons, fetchStats]);

  // Upload estimate
  const uploadEstimate = async (file, estimateType) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('estimate_type', estimateType);

    const res = await fetch(`${API}/api/scales/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Upload failed');
    }

    const data = await res.json();
    
    // Show warning if no line items were parsed
    if (data.warning) {
      toast.warning(data.warning, { duration: 8000 });
    }
    
    return data;
  };

  // Handle upload both estimates
  const handleUploadBoth = async () => {
    if (!carrierFile || !contractorFile) {
      toast.error('Please select both carrier and contractor estimates');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      setUploadProgress(25);
      const carrier = await uploadEstimate(carrierFile, 'carrier');
      
      setUploadProgress(50);
      const contractor = await uploadEstimate(contractorFile, 'contractor');
      
      setUploadProgress(75);
      
      // Check for parsing issues
      let hasIssues = false;
      if (carrier.line_item_count === 0) {
        toast.error(`Carrier estimate "${carrier.file_name}" has no line items. This may not be a valid Xactimate estimate.`, { duration: 6000 });
        hasIssues = true;
      }
      if (contractor.line_item_count === 0) {
        toast.error(`Contractor estimate "${contractor.file_name}" has no line items. This may not be a valid Xactimate estimate.`, { duration: 6000 });
        hasIssues = true;
      }
      
      // Refresh estimates list
      await fetchEstimates();
      await fetchStats();
      
      setUploadProgress(100);
      
      // Auto-select for comparison
      setSelectedCarrier(carrier.id);
      setSelectedContractor(contractor.id);
      
      if (hasIssues) {
        toast.warning('Some files may not be valid Xactimate estimates. Comparison results may be incomplete.');
      } else {
        toast.success('Estimates uploaded successfully!');
      }
      setCarrierFile(null);
      setContractorFile(null);
      setActiveTab('compare');
      
    } catch (error) {
      toast.error(error.message || 'Failed to upload estimates');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Run comparison
  const runComparison = async () => {
    if (!selectedCarrier || !selectedContractor) {
      toast.error('Please select both estimates to compare');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/scales/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          carrier_estimate_id: selectedCarrier,
          contractor_estimate_id: selectedContractor
        })
      });

      if (!res.ok) {
        throw new Error('Comparison failed');
      }

      const comparison = await res.json();
      setActiveComparison(comparison);
      await fetchComparisons();
      await fetchStats();
      setActiveTab('results');
      toast.success('Comparison complete!');
      
    } catch (error) {
      toast.error(error.message || 'Failed to compare estimates');
    } finally {
      setLoading(false);
    }
  };

  // Run AI analysis
  const runAIAnalysis = async (focus = 'comprehensive') => {
    if (!activeComparison) return;

    setAnalyzing(true);
    try {
      const res = await fetch(`${API}/api/scales/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          comparison_id: activeComparison.id,
          analysis_focus: focus
        })
      });

      if (!res.ok) {
        throw new Error('Analysis failed');
      }

      const analysis = await res.json();
      setAiAnalysis(analysis);
      toast.success('AI analysis complete!');
      
    } catch (error) {
      toast.error(error.message || 'Failed to run AI analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  // Generate dispute letter
  const generateDisputeLetter = async () => {
    if (!activeComparison) return;

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/scales/dispute-letter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          comparison_id: activeComparison.id,
          item_ids: []  // Will use all high-impact items
        })
      });

      if (!res.ok) {
        throw new Error('Failed to generate letter');
      }

      const result = await res.json();
      
      // Download as text file
      const blob = new Blob([result.dispute_letter], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dispute-letter-${activeComparison.id.slice(0, 8)}.txt`;
      a.click();
      
      toast.success('Dispute letter generated!');
      
    } catch (error) {
      toast.error(error.message || 'Failed to generate dispute letter');
    } finally {
      setLoading(false);
    }
  };

  // Load existing comparison
  const loadComparison = async (comparisonId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/scales/comparisons/${comparisonId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const comparison = await res.json();
        setActiveComparison(comparison);
        setAiAnalysis(null);
        setActiveTab('results');
      }
    } catch (error) {
      toast.error('Failed to load comparison');
    } finally {
      setLoading(false);
    }
  };

  // Delete estimate
  const deleteEstimate = async (estimateId) => {
    if (!window.confirm('Are you sure you want to delete this estimate?')) return;

    try {
      const res = await fetch(`${API}/api/scales/estimates/${estimateId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        await fetchEstimates();
        toast.success('Estimate deleted');
      }
    } catch (error) {
      toast.error('Failed to delete estimate');
    }
  };

  // Filter comparison items
  const getFilteredItems = (items) => {
    if (!items) return [];
    
    return items.filter(item => {
      const matchesSearch = searchTerm === '' || 
        (item.carrier_item?.description?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.contractor_item?.description?.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesImpact = filterImpact === 'all' || item.impact === filterImpact;
      
      return matchesSearch && matchesImpact;
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 page-enter" data-testid="scales-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <img src="/icons/scales.png" alt="Scales" className="w-10 h-10 sm:w-12 sm:h-12 object-contain icon-3d-shadow" />
          <div>
            <h1 className="text-xl sm:text-2xl font-tactical font-bold text-white tracking-wide text-glow-orange">SCALES</h1>
            <p className="text-sm sm:text-base text-zinc-500 font-mono uppercase tracking-wider">Xactimate Estimate Comparison</p>
          </div>
        </div>
        
        {stats && (
          <div className="grid grid-cols-3 gap-2 sm:gap-6 text-xs sm:text-sm">
            <div className="text-center">
              <p className="text-lg sm:text-2xl font-tactical font-bold text-blue-400">{stats.estimates_uploaded}</p>
              <p className="text-zinc-500 font-mono text-xs">Estimates</p>
            </div>
            <div className="text-center">
              <p className="text-lg sm:text-2xl font-tactical font-bold text-purple-400">{stats.comparisons_completed}</p>
              <p className="text-zinc-500 font-mono text-xs">Comparisons</p>
            </div>
            <div className="text-center">
              <p className="text-lg sm:text-2xl font-tactical font-bold text-green-400 truncate">
                {formatCurrency(stats.total_variance_identified)}
              </p>
              <p className="text-zinc-500 font-mono text-xs">Variance</p>
            </div>
          </div>
        )}
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="w-4 h-4" /> Upload
          </TabsTrigger>
          <TabsTrigger value="compare" className="flex items-center gap-2">
            <Scale className="w-4 h-4" /> Compare
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2" disabled={!activeComparison}>
            <BarChart3 className="w-4 h-4" /> Results
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <FileText className="w-4 h-4" /> History
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Carrier Upload */}
            <Card className="border-2 border-dashed border-zinc-700/30 hover:border-indigo-300 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-indigo-700">
                  <FileWarning className="w-5 h-5" />
                  Carrier Estimate
                </CardTitle>
                <CardDescription>Upload the insurance carrier&apos;s Xactimate estimate</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <label 
                    className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-zinc-700/50 rounded-lg cursor-pointer hover:bg-zinc-800/30 transition-colors"
                    data-testid="carrier-upload-zone"
                  >
                    {carrierFile ? (
                      <div className="text-center">
                        <FileText className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
                        <p className="font-medium text-white">{carrierFile.name}</p>
                        <p className="text-sm text-zinc-500">{(carrierFile.size / 1024).toFixed(1)} KB</p>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="mt-2"
                          onClick={(e) => { e.preventDefault(); setCarrierFile(null); }}
                        >
                          <X className="w-4 h-4 mr-1" /> Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="w-10 h-10 text-zinc-400 mx-auto mb-2" />
                        <p className="text-zinc-400">Click to upload carrier PDF</p>
                        <p className="text-sm text-zinc-400">or drag and drop</p>
                      </div>
                    )}
                    <Input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => setCarrierFile(e.target.files?.[0] || null)}
                      data-testid="carrier-file-input"
                    />
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Contractor Upload */}
            <Card className="border-2 border-dashed border-zinc-700/30 hover:border-emerald-300 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-700">
                  <FileText className="w-5 h-5" />
                  Contractor Estimate
                </CardTitle>
                <CardDescription>Upload the contractor or PA&apos;s Xactimate estimate</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <label 
                    className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-zinc-700/50 rounded-lg cursor-pointer hover:bg-zinc-800/30 transition-colors"
                    data-testid="contractor-upload-zone"
                  >
                    {contractorFile ? (
                      <div className="text-center">
                        <FileText className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                        <p className="font-medium text-white">{contractorFile.name}</p>
                        <p className="text-sm text-zinc-500">{(contractorFile.size / 1024).toFixed(1)} KB</p>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="mt-2"
                          onClick={(e) => { e.preventDefault(); setContractorFile(null); }}
                        >
                          <X className="w-4 h-4 mr-1" /> Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="w-10 h-10 text-zinc-400 mx-auto mb-2" />
                        <p className="text-zinc-400">Click to upload contractor PDF</p>
                        <p className="text-sm text-zinc-400">or drag and drop</p>
                      </div>
                    )}
                    <Input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => setContractorFile(e.target.files?.[0] || null)}
                      data-testid="contractor-file-input"
                    />
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upload Progress & Actions */}
          {uploading && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading and parsing estimates...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={handleUploadBoth}
              disabled={!carrierFile || !contractorFile || uploading}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              data-testid="upload-and-compare-btn"
            >
              {uploading ? (
                <><RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Processing...</>
              ) : (
                <><Scale className="w-5 h-5 mr-2" /> Upload & Compare</>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* Compare Tab */}
        <TabsContent value="compare" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Select Carrier Estimate */}
            <Card>
              <CardHeader>
                <CardTitle className="text-indigo-700">Select Carrier Estimate</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {estimates.filter(e => e.estimate_type === 'carrier').map(est => (
                      <div
                        key={est.id}
                        onClick={() => setSelectedCarrier(est.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedCarrier === est.id 
                            ? 'border-indigo-500 bg-indigo-50' 
                            : 'border-zinc-700/30 hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-white">{est.file_name}</p>
                            <p className="text-sm text-zinc-500">{est.line_item_count} line items</p>
                          </div>
                          <p className="font-semibold text-indigo-600">{formatCurrency(est.total_rcv)}</p>
                        </div>
                      </div>
                    ))}
                    {estimates.filter(e => e.estimate_type === 'carrier').length === 0 && (
                      <p className="text-center text-zinc-500 py-8">No carrier estimates uploaded</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Select Contractor Estimate */}
            <Card>
              <CardHeader>
                <CardTitle className="text-emerald-700">Select Contractor Estimate</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {estimates.filter(e => e.estimate_type === 'contractor' || e.estimate_type === 'pa').map(est => (
                      <div
                        key={est.id}
                        onClick={() => setSelectedContractor(est.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedContractor === est.id 
                            ? 'border-emerald-500 bg-emerald-50' 
                            : 'border-zinc-700/30 hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-white">{est.file_name}</p>
                            <p className="text-sm text-zinc-500">{est.line_item_count} line items</p>
                          </div>
                          <p className="font-semibold text-emerald-600">{formatCurrency(est.total_rcv)}</p>
                        </div>
                      </div>
                    ))}
                    {estimates.filter(e => e.estimate_type !== 'carrier').length === 0 && (
                      <p className="text-center text-zinc-500 py-8">No contractor estimates uploaded</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={runComparison}
              disabled={!selectedCarrier || !selectedContractor || loading}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              data-testid="run-comparison-btn"
            >
              {loading ? (
                <><RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Comparing...</>
              ) : (
                <><Scale className="w-5 h-5 mr-2" /> Run Comparison</>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-6">
          {activeComparison && (
            <>
              {/* Summary Cards */}
              <div className="grid md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
                  <CardContent className="pt-6">
                    <p className="text-sm text-indigo-600 font-medium">Carrier Total</p>
                    <p className="text-2xl font-bold text-indigo-900">
                      {formatCurrency(activeComparison.summary?.carrier_total)}
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
                  <CardContent className="pt-6">
                    <p className="text-sm text-emerald-600 font-medium">Contractor Total</p>
                    <p className="text-2xl font-bold text-emerald-900">
                      {formatCurrency(activeComparison.summary?.contractor_total)}
                    </p>
                  </CardContent>
                </Card>
                
                <Card className={`bg-gradient-to-br ${
                  activeComparison.total_variance > 0 
                    ? 'from-amber-50 to-amber-100 border-amber-200' 
                    : 'from-red-50 to-red-100 border-red-200'
                }`}>
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium opacity-80">Total Variance</p>
                    <p className="text-2xl font-bold">
                      <VarianceIndicator 
                        value={activeComparison.total_variance} 
                        showPercent 
                        baseValue={activeComparison.summary?.carrier_total}
                      />
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <CardContent className="pt-6">
                    <p className="text-sm text-purple-600 font-medium">High Impact Items</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {activeComparison.summary?.high_impact_items || 0}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => runAIAnalysis('comprehensive')}
                  disabled={analyzing}
                  className="bg-gradient-to-r from-violet-600 to-purple-600"
                  data-testid="ai-analysis-btn"
                >
                  {analyzing ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> AI Analysis</>
                  )}
                </Button>
                
                <Button variant="outline" onClick={generateDisputeLetter} disabled={loading}>
                  <PenTool className="w-4 h-4 mr-2" /> Generate Dispute Letter
                </Button>
                
                <Button variant="outline" onClick={() => runAIAnalysis('missing_items')}>
                  <AlertTriangle className="w-4 h-4 mr-2" /> Analyze Missing Items
                </Button>
              </div>

              {/* AI Analysis Results */}
              {aiAnalysis && (
                <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-700">
                      <Sparkles className="w-5 h-5" />
                      AI Analysis
                      <Badge variant="outline" className="ml-2">{aiAnalysis.analysis_focus}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-sm text-zinc-300 bg-zinc-800/50 p-4 rounded-lg border">
                        {aiAnalysis.analysis}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Category Variances */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Category Variances
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {activeComparison.category_variances?.slice(0, 10).map((cat, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-white">{cat.category_name}</p>
                          <p className="text-sm text-zinc-500">{cat.category}</p>
                        </div>
                        <div className="text-right flex items-center gap-6">
                          <div>
                            <p className="text-sm text-zinc-500">Carrier</p>
                            <p className="font-medium">{formatCurrency(cat.carrier_total)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-zinc-500">Contractor</p>
                            <p className="font-medium">{formatCurrency(cat.contractor_total)}</p>
                          </div>
                          <div className="min-w-[120px]">
                            <p className="text-sm text-zinc-500">Variance</p>
                            <VarianceIndicator value={cat.variance} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Line Item Comparison */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <CardTitle>Line Item Details</CardTitle>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <Input
                          placeholder="Search items..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9 w-64"
                        />
                      </div>
                      <select
                        value={filterImpact}
                        onChange={(e) => setFilterImpact(e.target.value)}
                        className="border rounded-md px-3 py-2 text-sm"
                      >
                        <option value="all">All Impact</option>
                        <option value="high">High Impact</option>
                        <option value="medium">Medium Impact</option>
                        <option value="low">Low Impact</option>
                      </select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="missing" className="w-full">
                    <TabsList className="mb-4">
                      <TabsTrigger value="missing" className="flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        Missing ({activeComparison.summary?.missing_count || 0})
                      </TabsTrigger>
                      <TabsTrigger value="modified" className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        Modified ({activeComparison.summary?.modified_count || 0})
                      </TabsTrigger>
                      <TabsTrigger value="matched" className="flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Matched ({activeComparison.summary?.matched_count || 0})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="missing">
                      <ScrollArea className="h-96">
                        <div className="space-y-2">
                          {getFilteredItems(activeComparison.missing_items).map((item, idx) => (
                            <div key={idx} className="p-4 bg-red-50 border border-red-100 rounded-lg">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                                      {item.contractor_item?.category || 'N/A'}
                                    </Badge>
                                    <ImpactBadge impact={item.impact} />
                                  </div>
                                  <p className="font-medium text-white mt-2">
                                    {item.contractor_item?.description || 'Unknown Item'}
                                  </p>
                                  <p className="text-sm text-zinc-400 mt-1">
                                    {item.contractor_item?.quantity} {item.contractor_item?.unit} @ {formatCurrency(item.contractor_item?.unit_price)}/unit
                                  </p>
                                  {item.notes && (
                                    <p className="text-sm text-red-600 mt-1 italic">{item.notes}</p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-zinc-500">Missing Amount</p>
                                  <p className="text-xl font-bold text-red-600">
                                    {formatCurrency(item.total_diff)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                          {getFilteredItems(activeComparison.missing_items).length === 0 && (
                            <p className="text-center text-zinc-500 py-8">No missing items found</p>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="modified">
                      <ScrollArea className="h-96">
                        <div className="space-y-2">
                          {getFilteredItems(activeComparison.modified_items).map((item, idx) => (
                            <div key={idx} className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                                      {item.carrier_item?.category || 'N/A'}
                                    </Badge>
                                    <ImpactBadge impact={item.impact} />
                                    <Badge variant="outline">{item.variance_type}</Badge>
                                  </div>
                                  <p className="font-medium text-white mt-2">
                                    {item.carrier_item?.description || 'Unknown Item'}
                                  </p>
                                  <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                                    <div>
                                      <p className="text-zinc-500">Carrier</p>
                                      <p>{item.carrier_item?.quantity} {item.carrier_item?.unit} @ {formatCurrency(item.carrier_item?.unit_price)} = {formatCurrency(item.carrier_item?.total)}</p>
                                    </div>
                                    <div>
                                      <p className="text-zinc-500">Contractor</p>
                                      <p>{item.contractor_item?.quantity} {item.contractor_item?.unit} @ {formatCurrency(item.contractor_item?.unit_price)} = {formatCurrency(item.contractor_item?.total)}</p>
                                    </div>
                                  </div>
                                  {item.notes && (
                                    <p className="text-sm text-amber-700 mt-2 italic">{item.notes}</p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-zinc-500">Variance</p>
                                  <VarianceIndicator value={item.total_diff} />
                                </div>
                              </div>
                            </div>
                          ))}
                          {getFilteredItems(activeComparison.modified_items).length === 0 && (
                            <p className="text-center text-zinc-500 py-8">No modified items found</p>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="matched">
                      <ScrollArea className="h-96">
                        <div className="space-y-2">
                          {getFilteredItems(activeComparison.matched_items).map((item, idx) => (
                            <div key={idx} className="p-4 bg-green-50 border border-green-100 rounded-lg">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                                      {item.carrier_item?.category || 'N/A'}
                                    </Badge>
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  </div>
                                  <p className="font-medium text-white mt-2">
                                    {item.carrier_item?.description || 'Unknown Item'}
                                  </p>
                                  <p className="text-sm text-zinc-400 mt-1">
                                    {item.carrier_item?.quantity} {item.carrier_item?.unit} @ {formatCurrency(item.carrier_item?.unit_price)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-zinc-500">Amount</p>
                                  <p className="font-semibold text-green-600">
                                    {formatCurrency(item.carrier_item?.total)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                          {getFilteredItems(activeComparison.matched_items).length === 0 && (
                            <p className="text-center text-zinc-500 py-8">No matched items</p>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Recommendation */}
              {activeComparison.summary?.recommendation && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <TrendingUp className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                      <div>
                        <p className="font-semibold text-blue-900">Recommendation</p>
                        <p className="text-blue-800 mt-1">{activeComparison.summary.recommendation}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {!activeComparison && (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <Scale className="w-16 h-16 text-zinc-500 mx-auto mb-4" />
                <p className="text-zinc-500 text-lg">No comparison loaded</p>
                <p className="text-zinc-400 mt-1">Upload and compare estimates to see results</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab('upload')}>
                  <Upload className="w-4 h-4 mr-2" /> Upload Estimates
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Uploaded Estimates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {estimates.map(est => (
                    <div key={est.id} className={`flex items-center justify-between p-4 rounded-lg ${
                      est.line_item_count === 0 ? 'bg-amber-50 border border-amber-200' : 'bg-zinc-800/30'
                    }`}>
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          est.line_item_count === 0 
                            ? 'bg-amber-100' 
                            : est.estimate_type === 'carrier' 
                              ? 'bg-indigo-100' 
                              : 'bg-emerald-100'
                        }`}>
                          {est.line_item_count === 0 ? (
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                          ) : (
                            <FileText className={`w-5 h-5 ${
                              est.estimate_type === 'carrier' ? 'text-indigo-600' : 'text-emerald-600'
                            }`} />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-white">{est.file_name}</p>
                          <p className="text-sm text-zinc-500">
                            {est.estimate_type.toUpperCase()} • {est.line_item_count} items • {formatCurrency(est.total_rcv)}
                          </p>
                          {est.line_item_count === 0 && (
                            <p className="text-xs text-amber-600 mt-1">
                              ⚠️ No line items - may not be valid Xactimate format
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => deleteEstimate(est.id)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {estimates.length === 0 && (
                    <p className="text-center text-zinc-500 py-8">No estimates uploaded yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Comparison History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {comparisons.map(comp => (
                    <div 
                      key={comp.id} 
                      className="flex items-center justify-between p-4 bg-zinc-800/30 rounded-lg hover:bg-zinc-800/60 cursor-pointer transition-colors"
                      onClick={() => loadComparison(comp.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Scale className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {comp.carrier_estimate?.file_name || 'Comparison'} vs {comp.contractor_estimate?.file_name || 'Estimate'}
                          </p>
                          <p className="text-sm text-zinc-500">
                            Variance: <VarianceIndicator value={comp.total_variance} />
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-400" />
                    </div>
                  ))}
                  {comparisons.length === 0 && (
                    <p className="text-center text-zinc-500 py-8">No comparisons yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
