import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Shield, AlertTriangle, Clock, CalendarDays, CheckCircle2,
  ChevronDown, ChevronUp, RefreshCw, Zap, Filter, Search,
  Calendar as CalendarIcon, List, ArrowUpDown, AlertCircle,
  ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import { apiGet, apiPost } from '../lib/api';
import { Card, CardContent } from '../shared/ui/card';
import { Button } from '../shared/ui/button';
import { Badge } from '../shared/ui/badge';
import { Input } from '../shared/ui/input';
import { ScrollArea } from '../shared/ui/scroll-area';
import { Skeleton } from '../shared/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '../shared/ui/dialog';

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  overdue:  { label: 'Overdue',  bg: 'bg-red-500/15',    text: 'text-red-400',     border: 'border-red-500/30',     dot: 'bg-red-500' },
  due_soon: { label: 'Due Soon', bg: 'bg-amber-500/15',  text: 'text-amber-400',   border: 'border-amber-500/30',   dot: 'bg-amber-500' },
  on_track: { label: 'On Track', bg: 'bg-green-500/15',  text: 'text-green-400',   border: 'border-green-500/30',   dot: 'bg-green-500' },
  met:      { label: 'Met',      bg: 'bg-emerald-500/15',text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
};

const DEADLINE_TYPES = [
  { key: 'all',                    label: 'All' },
  { key: 'carrier_decision',      label: 'Carrier Decision' },
  { key: 'supplement_followup',   label: 'Supplement Follow-up' },
  { key: 'statute_of_limitations', label: 'Statute of Limitations' },
  { key: 'notice_of_intent',      label: 'Notice of Intent' },
  { key: 'appraisal_demand',      label: 'Appraisal Demand' },
  { key: 'proof_of_loss',         label: 'Proof of Loss' },
  { key: 'mediation',             label: 'Mediation' },
  { key: 'custom',                label: 'Custom' },
];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeStatus(dueDate) {
  if (!dueDate) return 'on_track';
  const now = new Date();
  const due = new Date(dueDate);
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 7) return 'due_soon';
  return 'on_track';
}

function daysRemaining(dueDate) {
  if (!dueDate) return null;
  const now = new Date();
  const due = new Date(dueDate);
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Sub-components ───────────────────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, color, subtext }) {
  return (
    <Card tactical className="flex-1 min-w-[140px]">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-zinc-100">{value}</p>
          <p className="text-xs text-zinc-500">{label}</p>
          {subtext && <p className="text-[10px] text-zinc-600 mt-0.5">{subtext}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function AlertBanner({ overdue, dueSoon }) {
  if (overdue === 0 && dueSoon === 0) return null;
  return (
    <div className="space-y-2">
      {overdue > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300 font-medium">
            {overdue} deadline{overdue !== 1 ? 's' : ''} overdue
          </p>
        </div>
      )}
      {dueSoon > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
          <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-300 font-medium">
            {dueSoon} deadline{dueSoon !== 1 ? 's' : ''} due this week
          </p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.on_track;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${config.bg} ${config.text} ${config.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function DaysRemainingCell({ days }) {
  if (days === null || days === undefined) return <span className="text-zinc-600">--</span>;
  if (days < 0) {
    return <span className="text-red-400 font-bold">{Math.abs(days)}d overdue</span>;
  }
  if (days === 0) {
    return <span className="text-red-400 font-bold">Due today</span>;
  }
  if (days <= 7) {
    return <span className="text-amber-400 font-semibold">{days}d</span>;
  }
  return <span className="text-zinc-300">{days}d</span>;
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyDeadlines({ filterLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 border border-white/5 flex items-center justify-center mb-4">
        <CheckCircle2 className="w-7 h-7 text-emerald-500" />
      </div>
      <h3 className="text-lg font-semibold text-zinc-300 mb-1">All clear</h3>
      <p className="text-sm text-zinc-500 max-w-sm">
        No {filterLabel !== 'All' ? filterLabel.toLowerCase() : ''} deadlines found.
      </p>
    </div>
  );
}

// ── Deadline Detail Modal ────────────────────────────────────────────────────

function DeadlineDetailModal({ deadline, open, onOpenChange }) {
  const queryClient = useQueryClient();

  const ackMutation = useMutation({
    mutationFn: () => apiPost(`/api/compliance/alerts/${deadline?.id || deadline?._id}/acknowledge`),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success('Deadline acknowledged');
        queryClient.invalidateQueries({ queryKey: ['compliance'] });
        onOpenChange(false);
      } else {
        toast.error(res.error || 'Failed to acknowledge');
      }
    },
    onError: () => toast.error('Network error'),
  });

  if (!deadline) return null;

  const status = deadline.status || computeStatus(deadline.due_date);
  const days = daysRemaining(deadline.due_date);
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.on_track;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <Shield className="w-5 h-5 text-orange-400" />
            Deadline Detail
          </DialogTitle>
          <DialogDescription>
            {deadline.deadline_type?.replace(/_/g, ' ') || 'Compliance deadline'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <DetailField label="Claim" value={`#${deadline.claim_number || deadline.claim_id || '--'}`} />
            <DetailField label="Client" value={deadline.client_name || '--'} />
            <DetailField label="Type" value={(deadline.deadline_type || '').replace(/_/g, ' ')} />
            <DetailField label="Statute Ref" value={deadline.statute_ref || '--'} />
            <DetailField label="Due Date" value={formatDate(deadline.due_date)} />
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">Status</p>
              <StatusBadge status={status} />
            </div>
          </div>
          {deadline.notes && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">Notes</p>
              <p className="text-sm text-zinc-300 bg-zinc-900/60 rounded-lg border border-white/5 p-3">
                {deadline.notes}
              </p>
            </div>
          )}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${config.bg} border ${config.border}`}>
            <span className={`${config.text} font-semibold text-sm`}>
              {days !== null ? (days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'Due today' : `${days} days remaining`) : 'No due date'}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="tacticalGhost" onClick={() => onOpenChange(false)}>Close</Button>
          {status !== 'met' && (
            <Button
              variant="tactical"
              disabled={ackMutation.isPending}
              onClick={() => ackMutation.mutate()}
            >
              {ackMutation.isPending ? 'Acknowledging...' : 'Acknowledge'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailField({ label, value }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
      <p className="text-sm text-zinc-200 font-medium capitalize">{value}</p>
    </div>
  );
}

// ── Auto-Generate Modal ──────────────────────────────────────────────────────

function AutoGenerateModal({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [claimId, setClaimId] = useState('');

  const mutation = useMutation({
    mutationFn: (id) => apiPost(`/api/compliance/auto-generate/${id}`),
    onSuccess: (res) => {
      if (res.ok) {
        const count = res.data?.deadlines_created || 'FL statutory';
        toast.success(`Generated ${count} deadlines`);
        queryClient.invalidateQueries({ queryKey: ['compliance'] });
        onOpenChange(false);
        setClaimId('');
      } else {
        toast.error(res.error || 'Failed to auto-generate');
      }
    },
    onError: () => toast.error('Network error'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <Zap className="w-5 h-5 text-orange-400" /> Auto-Generate Deadlines
          </DialogTitle>
          <DialogDescription>
            Auto-create all Florida statutory deadlines for a claim.
          </DialogDescription>
        </DialogHeader>
        <div>
          <label className="text-xs font-medium text-zinc-400 mb-1 block">Claim ID</label>
          <Input
            value={claimId}
            onChange={(e) => setClaimId(e.target.value)}
            placeholder="Enter claim ID"
          />
        </div>
        <DialogFooter>
          <Button variant="tacticalGhost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="tactical"
            disabled={!claimId.trim() || mutation.isPending}
            onClick={() => mutation.mutate(claimId.trim())}
          >
            {mutation.isPending ? 'Generating...' : 'Generate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Mini Calendar ────────────────────────────────────────────────────────────

function MiniCalendar({ deadlines }) {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const deadlinesByDate = useMemo(() => {
    const map = {};
    (deadlines || []).forEach((d) => {
      if (!d.due_date) return;
      const key = new Date(d.due_date).toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }, [deadlines]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    // Leading blanks
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [currentMonth]);

  const today = new Date().toISOString().slice(0, 10);
  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const prevMonth = () => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  return (
    <Card tactical>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-zinc-200">{monthLabel}</span>
          <button onClick={nextMonth} className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="text-center text-[10px] font-medium text-zinc-600 py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {calendarDays.map((day, i) => {
            if (day === null) return <div key={`blank-${i}`} />;
            const dateKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayDeadlines = deadlinesByDate[dateKey] || [];
            const isToday = dateKey === today;
            const hasOverdue = dayDeadlines.some((d) => (d.status || computeStatus(d.due_date)) === 'overdue');
            const hasDueSoon = dayDeadlines.some((d) => (d.status || computeStatus(d.due_date)) === 'due_soon');

            return (
              <div
                key={dateKey}
                className={`relative flex flex-col items-center py-1 rounded-md text-xs transition-colors ${
                  isToday ? 'bg-orange-500/15 border border-orange-500/30' : ''
                } ${dayDeadlines.length > 0 ? 'cursor-pointer hover:bg-zinc-800/60' : ''}`}
                title={dayDeadlines.length > 0 ? `${dayDeadlines.length} deadline(s)` : ''}
              >
                <span className={`${isToday ? 'text-orange-400 font-bold' : 'text-zinc-400'}`}>{day}</span>
                {dayDeadlines.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {hasOverdue && <span className="w-1 h-1 rounded-full bg-red-500" />}
                    {hasDueSoon && <span className="w-1 h-1 rounded-full bg-amber-500" />}
                    {!hasOverdue && !hasDueSoon && <span className="w-1 h-1 rounded-full bg-green-500" />}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5">
          <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Overdue
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Due soon
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
            <span className="w-2 h-2 rounded-full bg-green-500" /> On track
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CompliancePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('due_date');
  const [sortDir, setSortDir] = useState('asc');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'calendar'
  const [selectedDeadline, setSelectedDeadline] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [autoGenOpen, setAutoGenOpen] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────

  const dashboardQuery = useQuery({
    queryKey: ['compliance', 'dashboard'],
    queryFn: () => apiGet('/api/compliance/dashboard'),
    staleTime: 30_000,
  });

  const deadlinesQuery = useQuery({
    queryKey: ['compliance', 'deadlines'],
    queryFn: () => apiGet('/api/compliance/deadlines'),
    staleTime: 30_000,
  });

  const overdueQuery = useQuery({
    queryKey: ['compliance', 'overdue'],
    queryFn: () => apiGet('/api/compliance/overdue'),
    staleTime: 30_000,
  });

  // ── Derived data ─────────────────────────────────────────────────────────

  const dashboard = dashboardQuery.data?.ok ? dashboardQuery.data.data : null;
  const allDeadlines = deadlinesQuery.data?.ok ? (deadlinesQuery.data.data || []) : [];
  const overdueList = overdueQuery.data?.ok ? (overdueQuery.data.data || []) : [];

  const kpis = useMemo(() => {
    if (dashboard) {
      return {
        totalActive: dashboard.total_active ?? allDeadlines.length,
        overdue:     dashboard.overdue ?? overdueList.length,
        dueThisWeek: dashboard.due_this_week ?? 0,
        dueThisMonth: dashboard.due_this_month ?? 0,
      };
    }
    // Fallback: compute from deadline list
    const now = new Date();
    const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    let overdue = 0, dueWeek = 0, dueMonth = 0;
    allDeadlines.forEach((d) => {
      if (!d.due_date) return;
      const due = new Date(d.due_date);
      if (due < now) overdue++;
      else if (due <= weekEnd) dueWeek++;
      if (due <= monthEnd && due >= now) dueMonth++;
    });
    return {
      totalActive: allDeadlines.filter((d) => d.status !== 'met').length,
      overdue,
      dueThisWeek: dueWeek,
      dueThisMonth: dueMonth,
    };
  }, [dashboard, allDeadlines, overdueList]);

  const filteredDeadlines = useMemo(() => {
    let list = [...allDeadlines];

    // Type filter
    if (typeFilter !== 'all') {
      list = list.filter((d) => d.deadline_type === typeFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((d) =>
        (d.claim_number || '').toLowerCase().includes(q) ||
        (d.client_name || '').toLowerCase().includes(q) ||
        (d.deadline_type || '').toLowerCase().includes(q) ||
        (d.statute_ref || '').toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let aVal, bVal;
      switch (sortField) {
        case 'due_date':
          aVal = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          bVal = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          break;
        case 'claim':
          aVal = a.claim_number || '';
          bVal = b.claim_number || '';
          break;
        case 'type':
          aVal = a.deadline_type || '';
          bVal = b.deadline_type || '';
          break;
        case 'status':
          aVal = a.status || computeStatus(a.due_date);
          bVal = b.status || computeStatus(b.due_date);
          break;
        default:
          aVal = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          bVal = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [allDeadlines, typeFilter, searchQuery, sortField, sortDir]);

  const isLoading = deadlinesQuery.isLoading;
  const isError = deadlinesQuery.isError;

  // ── Handlers ─────────────────────────────────────────────────────────────

  const toggleSort = useCallback((field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }, [sortField]);

  const handleRowClick = useCallback((deadline) => {
    setSelectedDeadline(deadline);
    setDetailOpen(true);
  }, []);

  const handleRefresh = useCallback(() => {
    dashboardQuery.refetch();
    deadlinesQuery.refetch();
    overdueQuery.refetch();
  }, [dashboardQuery, deadlinesQuery, overdueQuery]);

  // ── Sort header helper ───────────────────────────────────────────────────

  const SortHeader = ({ field, children, className = '' }) => (
    <button
      onClick={() => toggleSort(field)}
      className={`flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors ${className}`}
    >
      {children}
      {sortField === field ? (
        sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-40" />
      )}
    </button>
  );

  // ── Row color helper ─────────────────────────────────────────────────────

  const rowBg = (status) => {
    switch (status) {
      case 'overdue':  return 'bg-red-500/5 hover:bg-red-500/10';
      case 'due_soon': return 'bg-amber-500/5 hover:bg-amber-500/10';
      case 'met':      return 'bg-emerald-500/5 hover:bg-emerald-500/10';
      default:         return 'hover:bg-zinc-800/40';
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <ScrollArea className="flex-1">
        <div className="px-4 lg:px-6 py-4 space-y-5 max-w-[1400px] mx-auto">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-zinc-100">Compliance Dashboard</h1>
                <p className="text-xs text-zinc-500">FL statutory deadlines & compliance tracking</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              <Button variant="tacticalOutline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="w-4 h-4" /> Refresh
              </Button>
              <Button variant="tactical" size="sm" onClick={() => setAutoGenOpen(true)}>
                <Zap className="w-4 h-4" /> Auto-Generate
              </Button>
            </div>
          </div>

          {/* Alert Banner */}
          <AlertBanner overdue={kpis.overdue} dueSoon={kpis.dueThisWeek} />

          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard
              icon={CalendarDays}
              label="Active Deadlines"
              value={isLoading ? '--' : kpis.totalActive}
              color="bg-blue-500/10 text-blue-400"
            />
            <KPICard
              icon={AlertTriangle}
              label="Overdue"
              value={isLoading ? '--' : kpis.overdue}
              color="bg-red-500/10 text-red-400"
            />
            <KPICard
              icon={Clock}
              label="Due This Week"
              value={isLoading ? '--' : kpis.dueThisWeek}
              color="bg-amber-500/10 text-amber-400"
            />
            <KPICard
              icon={CalendarDays}
              label="Due This Month"
              value={isLoading ? '--' : kpis.dueThisMonth}
              color="bg-green-500/10 text-green-400"
            />
          </div>

          {/* Controls: Type filter tabs + Search + View toggle */}
          <div className="space-y-3">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
              {DEADLINE_TYPES.map((dt) => (
                <button
                  key={dt.key}
                  onClick={() => setTypeFilter(dt.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    typeFilter === dt.key
                      ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent'
                  }`}
                >
                  {dt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search claim, client, type, statute..."
                  className="pl-9"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex rounded-lg border border-white/10 overflow-hidden">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    viewMode === 'table' ? 'bg-orange-500/15 text-orange-400' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    viewMode === 'calendar' ? 'bg-orange-500/15 text-orange-400' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <CalendarIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Calendar View */}
          {viewMode === 'calendar' && (
            <MiniCalendar deadlines={filteredDeadlines} />
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <Card tactical>
              <div className="overflow-x-auto">
                {isLoading && <TableSkeleton />}
                {isError && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
                    <p className="text-sm text-zinc-400 mb-3">Failed to load deadlines</p>
                    <Button variant="tacticalOutline" size="sm" onClick={handleRefresh}>
                      <RefreshCw className="w-4 h-4" /> Retry
                    </Button>
                  </div>
                )}
                {!isLoading && !isError && filteredDeadlines.length === 0 && (
                  <EmptyDeadlines filterLabel={DEADLINE_TYPES.find((t) => t.key === typeFilter)?.label || 'All'} />
                )}
                {!isLoading && !isError && filteredDeadlines.length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="px-4 py-3 text-left">
                          <SortHeader field="claim">Claim #</SortHeader>
                        </th>
                        <th className="px-4 py-3 text-left hidden md:table-cell">
                          <span className="text-xs font-medium text-zinc-500">Client</span>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <SortHeader field="type">Type</SortHeader>
                        </th>
                        <th className="px-4 py-3 text-left hidden lg:table-cell">
                          <span className="text-xs font-medium text-zinc-500">Statute Ref</span>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <SortHeader field="due_date">Due Date</SortHeader>
                        </th>
                        <th className="px-4 py-3 text-left hidden sm:table-cell">
                          <span className="text-xs font-medium text-zinc-500">Remaining</span>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <SortHeader field="status">Status</SortHeader>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDeadlines.map((d) => {
                        const status = d.status || computeStatus(d.due_date);
                        const days = daysRemaining(d.due_date);
                        return (
                          <tr
                            key={d.id || d._id}
                            onClick={() => handleRowClick(d)}
                            className={`border-b border-white/5 cursor-pointer transition-colors ${rowBg(status)}`}
                          >
                            <td className="px-4 py-3">
                              <button
                                onClick={(e) => { e.stopPropagation(); navigate(`/claims/${d.claim_id}`); }}
                                className="text-orange-400 hover:text-orange-300 font-semibold text-sm transition-colors"
                              >
                                #{d.claim_number || d.claim_id || '--'}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-zinc-300 hidden md:table-cell">
                              {d.client_name || '--'}
                            </td>
                            <td className="px-4 py-3 text-zinc-300 capitalize">
                              {(d.deadline_type || '').replace(/_/g, ' ')}
                            </td>
                            <td className="px-4 py-3 text-zinc-500 text-xs font-mono hidden lg:table-cell">
                              {d.statute_ref || '--'}
                            </td>
                            <td className="px-4 py-3 text-zinc-300">
                              {formatDate(d.due_date)}
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                              <DaysRemainingCell days={days} />
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={status} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              {!isLoading && filteredDeadlines.length > 0 && (
                <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
                  <p className="text-xs text-zinc-500">
                    {filteredDeadlines.length} deadline{filteredDeadlines.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </Card>
          )}
        </div>
      </ScrollArea>

      {/* Modals */}
      <DeadlineDetailModal
        deadline={selectedDeadline}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
      <AutoGenerateModal open={autoGenOpen} onOpenChange={setAutoGenOpen} />
    </div>
  );
}
