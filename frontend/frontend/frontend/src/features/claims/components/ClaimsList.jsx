import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '@/lib/api';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  Loader2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Check,
  ChevronDown,
  FolderOpen,
  Target,
  ChevronRight,
  Kanban,
  List,
  BarChart3,
  CheckSquare,
  Square,
  Archive,
  UserPlus,
  ArrowRightLeft,
  X,
  Download,
} from 'lucide-react';
import { NAV_ICONS } from '../../../assets/badges';
import ClaimsPipeline from './ClaimsPipeline';
import GardenDashboard from './GardenDashboard';
import { exportClaimsCsv } from '@/lib/exportCsv';

const VIEW_MODES = { list: 'list', pipeline: 'pipeline', dashboard: 'dashboard' };
const ITEMS_PER_PAGE = 25;

const ClaimsList = () => {
  const navigate = useNavigate();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortField, setSortField] = useState('updated_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const sortDropdownRef = useRef(null);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('garden_view') || VIEW_MODES.list);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchAction, setBatchAction] = useState(null); // null, 'archive', 'status', 'assign'
  const [batchValue, setBatchValue] = useState('');
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Status count badges (computed from unfiltered claims)
  const statusCounts = useMemo(() => {
    const counts = { All: claims.length };
    claims.forEach(claim => {
      const status = claim.status || 'Unknown';
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [claims]);

  // Keyboard shortcut: "/" to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        document.querySelector('[data-testid="claims-search-input"]')?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
        setShowSortDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchClaims = useCallback(async () => {
    try {
      setLoading(true);
      const query = filterStatus && filterStatus !== 'All' ? `?filter_status=${encodeURIComponent(filterStatus)}` : '';
      const res = await apiGet(`/api/claims/${query}`);

      if (!res.ok) {
        throw new Error(res.error || 'Failed to fetch claims');
      }

      setClaims(Array.isArray(res.data) ? res.data : []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const sortOptions = [
    { field: 'updated_at', direction: 'desc', label: 'Date Updated (Newest)' },
    { field: 'updated_at', direction: 'asc', label: 'Date Updated (Oldest)' },
    { field: 'client_name', direction: 'asc', label: 'Client Name (A-Z)' },
    { field: 'client_name', direction: 'desc', label: 'Client Name (Z-A)' },
    { field: 'estimated_value', direction: 'desc', label: 'Value (Highest)' },
    { field: 'estimated_value', direction: 'asc', label: 'Value (Lowest)' },
    { field: 'date_of_loss', direction: 'desc', label: 'Date of Loss (Newest)' },
    { field: 'date_of_loss', direction: 'asc', label: 'Date of Loss (Oldest)' },
  ];

  const handleSortSelect = (option) => {
    setSortField(option.field);
    setSortDirection(option.direction);
    setShowSortDropdown(false);
    setCurrentPage(1);
  };

  const getCurrentSortLabel = () => {
    const current = sortOptions.find(
      (opt) => opt.field === sortField && opt.direction === sortDirection
    );
    return current?.label || 'Sort';
  };

  const sortedAndFilteredClaims = claims
    .filter((claim) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        claim.client_name?.toLowerCase().includes(searchLower) ||
        claim.claim_number?.toLowerCase().includes(searchLower) ||
        claim.property_address?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle different field types
      if (sortField === 'estimated_value') {
        aVal = aVal || 0;
        bVal = bVal || 0;
      } else if (sortField === 'updated_at' || sortField === 'date_of_loss') {
        aVal = new Date(aVal || 0).getTime();
        bVal = new Date(bVal || 0).getTime();
      } else {
        aVal = (aVal || '').toString().toLowerCase();
        bVal = (bVal || '').toString().toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

  // ── Pagination ──
  const totalPages = Math.ceil(sortedAndFilteredClaims.length / ITEMS_PER_PAGE);
  const paginatedClaims = sortedAndFilteredClaims.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset to page 1 when filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  // ── Multi-select helpers ──
  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === sortedAndFilteredClaims.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedAndFilteredClaims.map(c => c.id)));
    }
  };

  const clearSelection = () => { setSelectedIds(new Set()); setBatchAction(null); setBatchValue(''); };

  const handleBatchExecute = async () => {
    if (selectedIds.size === 0) return;
    const action = batchAction === 'archive' ? 'archive' : batchAction === 'status' ? 'status_change' : batchAction === 'assign' ? 'assign' : null;
    if (!action) return;
    if (action !== 'archive' && !batchValue) { toast.error('Select a value'); return; }
    setBatchProcessing(true);
    try {
      const res = await apiPost('/api/claims/batch', {
        claim_ids: Array.from(selectedIds),
        action,
        value: batchValue || null,
      });
      if (res.ok) {
        toast.success(`${res.data.success} claims updated${res.data.failed ? `, ${res.data.failed} failed` : ''}`);
        clearSelection();
        fetchClaims();
      } else {
        toast.error(res.error || 'Batch operation failed');
      }
    } catch {
      toast.error('Batch operation failed');
    } finally {
      setBatchProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'In Progress': 'badge-rare',
      'Under Review': 'badge-epic',
      Approved: 'badge-legendary',
      Denied: 'badge-mythic',
      Completed: 'badge-uncommon',
      Closed: 'badge-common',
      Archived: 'badge-common',
      New: 'badge-common',
    };
    return badges[status] || 'badge-common';
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      High: 'badge-mythic',
      Medium: 'badge-legendary',
      Low: 'badge-uncommon',
    };
    return badges[priority] || 'badge-common';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="p-3 sm:p-4 md:p-8 min-h-screen page-enter">
      {/* Header */}
      <div className="mb-4 sm:mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <img
              src={NAV_ICONS.garden}
              alt="Garden"
              width={40}
              height={40}
              className="w-10 h-10 sm:w-12 sm:h-12 object-contain icon-3d-shadow"
            />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-tactical font-bold text-white tracking-wide text-glow-orange">
              THE GARDEN
            </h1>
          </div>
          <p className="text-zinc-400 font-mono text-xs sm:text-sm uppercase tracking-wider">
            Track and manage all property claims
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* View Mode Toggle */}
          <div className="flex rounded border border-zinc-700/50 overflow-hidden">
            {[
              { mode: VIEW_MODES.list, icon: List, label: 'List' },
              { mode: VIEW_MODES.pipeline, icon: Kanban, label: 'Pipeline' },
              { mode: VIEW_MODES.dashboard, icon: BarChart3, label: 'Metrics' },
            ].map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => { setViewMode(mode); localStorage.setItem('garden_view', mode); }}
                className={`px-3 py-2 text-xs font-mono uppercase flex items-center gap-1.5 transition-all focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                  viewMode === mode
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50'
                }`}
                title={label}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <button
            className="px-3 py-2.5 rounded border border-zinc-700/50 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 text-sm flex items-center gap-2 transition-all focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
            onClick={() => {
              const toExport = selectedIds.size > 0
                ? sortedAndFilteredClaims.filter(c => selectedIds.has(c.id))
                : sortedAndFilteredClaims;
              exportClaimsCsv(toExport);
              toast.success(`Exported ${toExport.length} claims to CSV`);
            }}
            disabled={loading || sortedAndFilteredClaims.length === 0}
            title={selectedIds.size > 0 ? `Export ${selectedIds.size} selected` : 'Export all visible'}
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <button
            className="btn-tactical px-5 py-2.5 text-sm flex items-center gap-2 justify-center focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
            onClick={() => navigate('/claims/new')}
            data-testid="new-claim-btn"
          >
            <Plus className="w-4 h-4" />
            <span>New Mission</span>
          </button>
        </div>
      </div>

      {/* Filters - Tactical Style */}
      <div
        className="card-tactical p-3 sm:p-4 md:p-5 mb-4 sm:mb-6 animate-fade-in-up"
        style={{ animationDelay: '0.1s' }}
      >
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500 w-5 h-5" />
            <input
              placeholder="Search claims... (press / to focus)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-tactical w-full pl-10 py-2.5 focus:ring-2 focus:ring-orange-500/40"
              data-testid="claims-search-input"
            />
          </div>
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
            {['All', 'New', 'In Progress', 'Under Review', 'Approved', 'Denied', 'Completed', 'Closed', 'Archived'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded text-xs font-mono uppercase tracking-wider whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                  filterStatus === status
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                    : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:border-orange-500/30 hover:text-zinc-200'
                }`}
                size="sm"
                data-testid={`filter-${status.toLowerCase().replace(' ', '-')}`}
              >
                {status} <span className="ml-1 text-[10px] opacity-70">({statusCounts[status] || 0})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 md:mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-mono">{error}</span>
          <button
            onClick={fetchClaims}
            className="ml-auto text-sm text-zinc-400 hover:text-orange-400 focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Dashboard View */}
      {viewMode === VIEW_MODES.dashboard && (
        <div className="animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <GardenDashboard />
        </div>
      )}

      {/* Pipeline View */}
      {viewMode === VIEW_MODES.pipeline && (
        <div className="card-tactical p-5 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <ClaimsPipeline claims={sortedAndFilteredClaims} loading={loading} onRefresh={fetchClaims} />
        </div>
      )}

      {/* Batch Action Bar */}
      {selectedIds.size > 0 && (
        <div className="card-tactical p-3 mb-4 flex flex-wrap items-center gap-3 animate-fade-in-up border-orange-500/30">
          <div className="flex items-center gap-2 text-sm text-orange-400 font-mono">
            <CheckSquare className="w-4 h-4" />
            {selectedIds.size} selected
          </div>
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <button
              onClick={() => { setBatchAction('archive'); setBatchValue(''); }}
              className={`px-3 py-1.5 rounded text-xs font-mono uppercase border transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${batchAction === 'archive' ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'text-zinc-400 border-zinc-700/50 hover:border-red-500/30'}`}
            >
              <Archive className="w-3.5 h-3.5" /> Archive
            </button>
            <button
              onClick={() => setBatchAction('status')}
              className={`px-3 py-1.5 rounded text-xs font-mono uppercase border transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${batchAction === 'status' ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'text-zinc-400 border-zinc-700/50 hover:border-blue-500/30'}`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" /> Status
            </button>
            <button
              onClick={() => setBatchAction('assign')}
              className={`px-3 py-1.5 rounded text-xs font-mono uppercase border transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${batchAction === 'assign' ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' : 'text-zinc-400 border-zinc-700/50 hover:border-purple-500/30'}`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Assign
            </button>
            {batchAction === 'status' && (
              <select className="input-tactical px-2 py-1.5 text-xs focus:ring-2 focus:ring-orange-500/40" value={batchValue} onChange={e => setBatchValue(e.target.value)}>
                <option value="">Pick status...</option>
                {['New', 'In Progress', 'Under Review', 'Approved', 'Denied', 'Completed', 'Closed'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {batchAction === 'assign' && (
              <input className="input-tactical px-2 py-1.5 text-xs w-40 focus:ring-2 focus:ring-orange-500/40" placeholder="Assignee name..." value={batchValue} onChange={e => setBatchValue(e.target.value)} />
            )}
          </div>
          <div className="flex items-center gap-2">
            {batchAction && (
              <button
                onClick={handleBatchExecute}
                disabled={batchProcessing || (batchAction !== 'archive' && !batchValue)}
                className="btn-tactical px-4 py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
              >
                {batchProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Apply
              </button>
            )}
            <button onClick={clearSelection} className="text-zinc-500 hover:text-zinc-300 p-1.5 focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900" aria-label="Clear selection">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Claims List - Tactical Style */}
      {viewMode !== VIEW_MODES.list ? null :
      <div className="card-tactical p-3 sm:p-5 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button onClick={selectAll} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-500 hover:text-orange-400 transition-colors focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900" title="Select all" aria-label="Select all">
              {selectedIds.size === sortedAndFilteredClaims.length && sortedAndFilteredClaims.length > 0
                ? <CheckSquare className="w-5 h-5 text-orange-400" />
                : <Square className="w-5 h-5" />
              }
            </button>
            <Target className="w-5 h-5 text-orange-500" />
            <span className="font-tactical font-bold text-white uppercase text-sm tracking-wide">
              {sortedAndFilteredClaims.length} Targets
            </span>
          </div>
          <div className="relative" ref={sortDropdownRef}>
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="px-3 py-2 rounded border border-zinc-700/50 bg-zinc-800/50 text-zinc-300 text-xs font-mono uppercase flex items-center gap-2 hover:border-orange-500/30 focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
              data-testid="sort-btn"
            >
              {sortDirection === 'asc' ? (
                <ArrowUp className="w-3 h-3" />
              ) : (
                <ArrowDown className="w-3 h-3" />
              )}
              {getCurrentSortLabel()}
              <ChevronDown
                className={`w-3 h-3 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Sort Dropdown - Tactical Style */}
            {showSortDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-zinc-900 border border-zinc-700/50 rounded-lg shadow-xl z-50">
                <div className="py-1">
                  {sortOptions.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSortSelect(option)}
                      className={`w-full px-4 py-2 text-left text-xs font-mono uppercase tracking-wider flex items-center justify-between focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                        sortField === option.field && sortDirection === option.direction
                          ? 'bg-orange-500/10 text-orange-400'
                          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                      }`}
                      data-testid={`sort-option-${option.field}-${option.direction}`}
                    >
                      {option.label}
                      {sortField === option.field && sortDirection === option.direction && (
                        <Check className="w-3 h-3 text-orange-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-5 bg-zinc-800/30 rounded-lg border border-zinc-700/30">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-5 w-32 bg-zinc-700/50 rounded animate-pulse" />
                  <div className="h-5 w-20 bg-zinc-700/50 rounded-full animate-pulse" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-4 bg-zinc-800/50 rounded animate-pulse" />
                  <div className="h-4 bg-zinc-800/50 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedAndFilteredClaims.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4 border border-zinc-700/50">
              <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {searchTerm ? (
              <>
                <h3 className="text-lg font-semibold text-zinc-300 mb-2">No claims matching &ldquo;{searchTerm}&rdquo;</h3>
                <p className="text-sm text-zinc-500 max-w-sm">Try a different search term or clear the search.</p>
                <button onClick={() => setSearchTerm('')} className="btn-tactical px-6 py-3 text-sm mt-6 focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900">
                  <X className="w-4 h-4 mr-2 inline" /> Clear Search
                </button>
              </>
            ) : filterStatus !== 'All' ? (
              <>
                <h3 className="text-lg font-semibold text-zinc-300 mb-2">No {filterStatus} claims</h3>
                <p className="text-sm text-zinc-500 max-w-sm">There are no claims with the &ldquo;{filterStatus}&rdquo; status right now.</p>
                <button onClick={() => setFilterStatus('All')} className="btn-tactical px-6 py-3 text-sm mt-6 focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900">
                  <X className="w-4 h-4 mr-2 inline" /> Clear Filter
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-zinc-300 mb-2">No claims found</h3>
                <p className="text-sm text-zinc-500 max-w-sm">Get started by creating your first mission.</p>
                <button onClick={() => navigate('/claims/new')} className="btn-tactical px-6 py-3 text-sm mt-6 focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900">
                  <Plus className="w-4 h-4 mr-2 inline" /> Create First Mission
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-3 px-3 sm:-mx-0 sm:px-0">
          <div className="space-y-3 min-w-[320px]">
            {paginatedClaims.map((claim, index) => (
              <div
                key={claim.id}
                className={`group p-4 md:p-5 bg-zinc-800/30 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-all duration-200 border stagger-item interactive-card focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${selectedIds.has(claim.id) ? 'border-orange-500/50 bg-orange-500/5' : 'border-zinc-700/30 hover:border-orange-500/30'}`}
                tabIndex={0}
                role="button"
                onClick={() => navigate(`/claims/${claim.id}`)}
                data-testid={`claim-item-${claim.id}`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <button
                        onClick={(e) => toggleSelect(claim.id, e)}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-500 hover:text-orange-400 transition-colors mr-1 flex-shrink-0 focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                        aria-label={selectedIds.has(claim.id) ? 'Deselect claim' : 'Select claim'}
                      >
                        {selectedIds.has(claim.id) ? <CheckSquare className="w-5 h-5 text-orange-400" /> : <Square className="w-5 h-5" />}
                      </button>
                      {(() => {
                        const daysSinceUpdate = Math.floor((Date.now() - new Date(claim.updated_at).getTime()) / (1000 * 60 * 60 * 24));
                        const dotColor = daysSinceUpdate > 14 ? 'bg-red-500' : daysSinceUpdate >= 7 ? 'bg-yellow-500' : 'bg-green-500';
                        const dotLabel = daysSinceUpdate > 14 ? 'Stalled' : daysSinceUpdate >= 7 ? 'Aging' : 'Active';
                        return <span className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0`} title={dotLabel} />;
                      })()}
                      <span className="font-tactical font-bold text-base text-white group-hover:text-orange-400 transition-colors">
                        {claim.claim_number}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${getStatusBadge(claim.status)}`}
                      >
                        {claim.status}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${getPriorityBadge(claim.priority)}`}
                      >
                        {claim.priority}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-mono text-zinc-500 uppercase mb-1">Client</p>
                        <p className="text-sm font-medium text-zinc-200 truncate">{claim.client_name}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-mono text-zinc-500 uppercase mb-1">Location</p>
                        <p className="text-sm text-zinc-300 truncate">{claim.property_address}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-mono text-zinc-500 uppercase mb-1">Date of Loss</p>
                        <p className="text-sm text-zinc-300">{claim.date_of_loss}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-mono text-zinc-500 uppercase mb-1">Type</p>
                        <p className="text-sm text-zinc-300 truncate">{claim.claim_type}</p>
                      </div>
                      {claim.carrier && (
                        <div className="min-w-0">
                          <p className="text-[10px] font-mono text-zinc-500 uppercase mb-1">Carrier</p>
                          <p className="text-sm text-zinc-300 truncate">{claim.carrier}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 font-mono">
                      <span>
                        Policy: <span className="text-zinc-400">{claim.policy_number}</span>
                      </span>
                      <span>
                        Updated:{' '}
                        <span className="text-zinc-400">{formatDate(claim.updated_at)}</span>
                      </span>
                      {claim.assigned_to && (
                        <span>
                          Assigned: <span className="text-zinc-400">{claim.assigned_to}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-left md:text-right flex-shrink-0 flex items-center gap-3">
                    <div>
                      <p className="text-xl md:text-2xl font-tactical font-bold text-orange-400">
                        ${((claim.estimated_value || 0) / 1000).toFixed(0)}K
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono uppercase mt-1">
                        Est. Value
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-orange-500 transition-colors hidden md:block" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && !loading && (
          <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-4 border-t border-zinc-700/30 gap-3">
            <p className="text-xs text-zinc-500 font-mono">
              {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, sortedAndFilteredClaims.length)} of {sortedAndFilteredClaims.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
                className="min-w-[44px] min-h-[44px] px-3 py-2 rounded border border-zinc-700/50 text-xs font-mono uppercase text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                .reduce((acc, page, idx, arr) => {
                  if (idx > 0 && page - arr[idx - 1] > 1) acc.push('...');
                  acc.push(page);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-zinc-600 text-xs">...</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setCurrentPage(item)}
                      aria-label={`Page ${item}`}
                      aria-current={currentPage === item ? 'page' : undefined}
                      className={`min-w-[44px] min-h-[44px] px-3 py-2 rounded-lg text-sm font-mono transition-all focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                        currentPage === item
                          ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/20'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                aria-label="Next page"
                className="min-w-[44px] min-h-[44px] px-3 py-2 rounded border border-zinc-700/50 text-xs font-mono uppercase text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>}
    </div>
  );
};

export default ClaimsList;
