import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { NAV_ICONS } from '../../../assets/badges';
import ClaimsPipeline from './ClaimsPipeline';
import GardenDashboard from './GardenDashboard';

const VIEW_MODES = { list: 'list', pipeline: 'pipeline', dashboard: 'dashboard' };

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

      setClaims(res.data || []);
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
              className="w-10 h-10 sm:w-12 sm:h-12 object-contain icon-3d-shadow"
            />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-tactical font-bold text-white tracking-wide text-glow-orange">
              THE GARDEN
            </h1>
          </div>
          <p className="text-zinc-500 font-mono text-xs sm:text-sm uppercase tracking-wider">
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
                className={`px-3 py-2 text-xs font-mono uppercase flex items-center gap-1.5 transition-all ${
                  viewMode === mode
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                }`}
                title={label}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <button
            className="btn-tactical px-5 py-2.5 text-sm flex items-center gap-2 justify-center"
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
              placeholder="Search by claim ID, client name, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-tactical w-full pl-10 py-2.5"
              data-testid="claims-search-input"
            />
          </div>
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
            {['All', 'New', 'In Progress', 'Under Review', 'Approved', 'Denied', 'Completed', 'Closed', 'Archived'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded text-xs font-mono uppercase tracking-wider whitespace-nowrap transition-all ${
                  filterStatus === status
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                    : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:border-orange-500/30 hover:text-zinc-200'
                }`}
                size="sm"
                data-testid={`filter-${status.toLowerCase().replace(' ', '-')}`}
              >
                {status}
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
            className="ml-auto text-sm text-zinc-400 hover:text-orange-400"
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
              className={`px-3 py-1.5 rounded text-xs font-mono uppercase border transition-all flex items-center gap-1.5 ${batchAction === 'archive' ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'text-zinc-400 border-zinc-700/50 hover:border-red-500/30'}`}
            >
              <Archive className="w-3.5 h-3.5" /> Archive
            </button>
            <button
              onClick={() => setBatchAction('status')}
              className={`px-3 py-1.5 rounded text-xs font-mono uppercase border transition-all flex items-center gap-1.5 ${batchAction === 'status' ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'text-zinc-400 border-zinc-700/50 hover:border-blue-500/30'}`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" /> Status
            </button>
            <button
              onClick={() => setBatchAction('assign')}
              className={`px-3 py-1.5 rounded text-xs font-mono uppercase border transition-all flex items-center gap-1.5 ${batchAction === 'assign' ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' : 'text-zinc-400 border-zinc-700/50 hover:border-purple-500/30'}`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Assign
            </button>
            {batchAction === 'status' && (
              <select className="input-tactical px-2 py-1.5 text-xs" value={batchValue} onChange={e => setBatchValue(e.target.value)}>
                <option value="">Pick status...</option>
                {['New', 'In Progress', 'Under Review', 'Approved', 'Denied', 'Completed', 'Closed'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {batchAction === 'assign' && (
              <input className="input-tactical px-2 py-1.5 text-xs w-40" placeholder="Assignee name..." value={batchValue} onChange={e => setBatchValue(e.target.value)} />
            )}
          </div>
          <div className="flex items-center gap-2">
            {batchAction && (
              <button
                onClick={handleBatchExecute}
                disabled={batchProcessing || (batchAction !== 'archive' && !batchValue)}
                className="btn-tactical px-4 py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {batchProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Apply
              </button>
            )}
            <button onClick={clearSelection} className="text-zinc-500 hover:text-zinc-300 p-1.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Claims List - Tactical Style */}
      {viewMode !== VIEW_MODES.list ? null :
      <div className="card-tactical p-5 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button onClick={selectAll} className="text-zinc-500 hover:text-orange-400 transition-colors" title="Select all">
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
              className="px-3 py-2 rounded border border-zinc-700/50 bg-zinc-800/50 text-zinc-300 text-xs font-mono uppercase flex items-center gap-2 hover:border-orange-500/30"
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
                      className={`w-full px-4 py-2 text-left text-xs font-mono uppercase tracking-wider flex items-center justify-between ${
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
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-700/50">
              <AlertCircle className="w-8 h-8 text-zinc-600" />
            </div>
            <h3 className="text-lg font-tactical font-bold text-white mb-2 uppercase">
              No Targets Found
            </h3>
            <p className="text-zinc-500 mb-6 max-w-sm mx-auto font-mono text-sm">
              Initialize your first mission to begin operations
            </p>
            <button
              onClick={() => navigate('/claims/new')}
              className="btn-tactical px-6 py-3 text-sm"
            >
              <Plus className="w-4 h-4 mr-2 inline" />
              Create First Mission
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedAndFilteredClaims.map((claim, index) => (
              <div
                key={claim.id}
                className={`group p-4 md:p-5 bg-zinc-800/30 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-all duration-200 border stagger-item interactive-card ${selectedIds.has(claim.id) ? 'border-orange-500/50 bg-orange-500/5' : 'border-zinc-700/30 hover:border-orange-500/30'}`}
                onClick={() => navigate(`/claims/${claim.id}`)}
                data-testid={`claim-item-${claim.id}`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <button
                        onClick={(e) => toggleSelect(claim.id, e)}
                        className="text-zinc-500 hover:text-orange-400 transition-colors mr-1 flex-shrink-0"
                      >
                        {selectedIds.has(claim.id) ? <CheckSquare className="w-4 h-4 text-orange-400" /> : <Square className="w-4 h-4" />}
                      </button>
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Client</p>
                        <p className="text-sm font-medium text-zinc-200 truncate">
                          {claim.client_name}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">
                          Location
                        </p>
                        <p className="text-sm text-zinc-300 truncate">{claim.property_address}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">
                          Date of Loss
                        </p>
                        <p className="text-sm text-zinc-300">{claim.date_of_loss}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Type</p>
                        <p className="text-sm text-zinc-300 truncate">{claim.claim_type}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 font-mono">
                      <span>
                        Policy: <span className="text-zinc-400">{claim.policy_number}</span>
                      </span>
                      <span>
                        Updated:{' '}
                        <span className="text-zinc-400">{formatDate(claim.updated_at)}</span>
                      </span>
                    </div>
                  </div>

                  <div className="text-left md:text-right flex-shrink-0 flex items-center gap-3">
                    <div>
                      <p className="text-xl md:text-2xl font-tactical font-bold text-orange-400">
                        ${((claim.estimated_value || 0) / 1000).toFixed(0)}K
                      </p>
                      <p className="text-[10px] text-zinc-600 font-mono uppercase mt-1">
                        Est. Value
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-orange-500 transition-colors hidden md:block" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>}
    </div>
  );
};

export default ClaimsList;
