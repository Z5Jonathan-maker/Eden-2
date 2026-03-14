import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DollarSign, TrendingUp, TrendingDown, Clock, BarChart3,
  Search, Filter, Download, FileText, ChevronUp, ChevronDown,
  Plus, Minus, ArrowUpRight, ArrowDownRight, Target, Users,
  UserCheck, Share2, Receipt, CalendarDays, Hash, StickyNote,
  Loader2, Banknote, PiggyBank, CircleDollarSign, AlertCircle,
} from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../shared/ui/card';
import { Button } from '../shared/ui/button';
import { Badge } from '../shared/ui/badge';
import { Input } from '../shared/ui/input';
import { Progress } from '../shared/ui/progress';
import { Skeleton } from '../shared/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../shared/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../shared/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../shared/ui/table';

/* ═══════════════════════════════════════════════════════════
   Constants & Helpers
   ═══════════════════════════════════════════════════════════ */

const PAYMENT_STATUSES = ['all', 'pending', 'invoiced', 'received', 'paid_out'];

const STATUS_CONFIG = {
  pending:  { label: 'Pending',   variant: 'warning', dot: 'bg-amber-400' },
  invoiced: { label: 'Invoiced',  variant: 'info',    dot: 'bg-blue-400' },
  received: { label: 'Received',  variant: 'success', dot: 'bg-green-400' },
  paid_out: { label: 'Paid Out',  variant: 'success', dot: 'bg-emerald-400' },
};

const USD = (val) => {
  if (val == null || isNaN(val)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(val);
};

const USDFull = (val) => {
  if (val == null || isNaN(val)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(val);
};

const PCT = (val) => {
  if (val == null || isNaN(val)) return '0%';
  return `${(val * 100).toFixed(1)}%`;
};

const fmtDate = (d) => {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const SORT_FIELDS = [
  { key: 'claim_number', label: 'Claim #' },
  { key: 'client_name', label: 'Client' },
  { key: 'settlement_amount', label: 'Settlement' },
  { key: 'net_revenue', label: 'Net Revenue' },
  { key: 'created_at', label: 'Date' },
];

/* ═══════════════════════════════════════════════════════════
   Mock Data (used when backend APIs return no data)
   ═══════════════════════════════════════════════════════════ */

const MOCK_SUMMARY = {
  total_revenue: 0,
  total_revenue_trend: 0,
  month_revenue: 0,
  last_month_revenue: 0,
  pipeline_revenue: 0,
  pipeline_count: 0,
  avg_fee_per_claim: 0,
  avg_fee_trend: 0,
  monthly_revenue: [],
  revenue_goal: 100000,
  revenue_goal_progress: 0,
};

const EMPTY_CLAIMS = [];
const EMPTY_ADJUSTERS = [];
const EMPTY_REFERRALS = [];
const EMPTY_PIPELINE = [];

/* ═══════════════════════════════════════════════════════════
   Sub-Components
   ═══════════════════════════════════════════════════════════ */

const TrendIndicator = ({ value, suffix = '' }) => {
  if (value == null || value === 0) return <span className="text-xs text-zinc-500">--</span>;
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-emerald-400' : 'text-red-400'}`}>
      <Icon className="w-3 h-3" />
      {Math.abs(value).toFixed(1)}%{suffix}
    </span>
  );
};

const PaymentStatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <Badge variant={cfg.variant} className="gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </Badge>
  );
};

const KpiCard = ({ icon: Icon, iconColor, label, value, subValue, trend, loading }) => (
  <Card tactical className="relative overflow-hidden group">
    <CardContent className="p-5">
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-24 bg-zinc-800" />
          <Skeleton className="h-8 w-32 bg-zinc-800" />
          <Skeleton className="h-3 w-20 bg-zinc-800" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</span>
            <div className={`w-8 h-8 rounded-lg ${iconColor} flex items-center justify-center`}>
              <Icon className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
          <div className="flex items-center gap-2 mt-1">
            {trend != null && <TrendIndicator value={trend} />}
            {subValue && <span className="text-xs text-zinc-500">{subValue}</span>}
          </div>
        </>
      )}
    </CardContent>
    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-orange-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
  </Card>
);

const SortHeader = ({ field, label, sortKey, sortDir, onSort, className = '' }) => {
  const active = sortKey === field;
  return (
    <TableHead
      className={`cursor-pointer select-none hover:text-zinc-200 transition-colors ${className}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </span>
    </TableHead>
  );
};

/* ── Sidebar: Revenue by Adjuster ── */
const AdjusterPanel = ({ data, loading }) => (
  <Card tactical>
    <CardHeader className="pb-3">
      <CardTitle className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
        <UserCheck className="w-4 h-4 text-orange-400" />
        Revenue by Adjuster
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      {loading ? (
        Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-20 bg-zinc-800" />
            <Skeleton className="h-2 flex-1 bg-zinc-800" />
            <Skeleton className="h-3 w-14 bg-zinc-800" />
          </div>
        ))
      ) : data.length === 0 ? (
        <p className="text-xs text-zinc-600 text-center py-4">No adjuster data yet</p>
      ) : (
        data.map((adj, i) => {
          const maxRevenue = data[0]?.total_revenue || 1;
          const pct = (adj.total_revenue / maxRevenue) * 100;
          return (
            <div key={adj.adjuster_id || i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-300 font-medium truncate max-w-[120px]">{adj.adjuster_name}</span>
                <span className="text-xs font-semibold text-white">{USD(adj.total_revenue)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] text-zinc-600">{adj.claim_count || 0} claims</span>
            </div>
          );
        })
      )}
    </CardContent>
  </Card>
);

/* ── Sidebar: Revenue by Referral Source ── */
const ReferralPanel = ({ data, loading }) => {
  const COLORS = [
    'bg-orange-400', 'bg-blue-400', 'bg-emerald-400', 'bg-purple-400',
    'bg-pink-400', 'bg-cyan-400', 'bg-amber-400', 'bg-rose-400',
  ];
  const total = data.reduce((s, r) => s + (r.total_revenue || 0), 0) || 1;

  return (
    <Card tactical>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          <Share2 className="w-4 h-4 text-blue-400" />
          Revenue by Referral Source
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full bg-zinc-800" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <p className="text-xs text-zinc-600 text-center py-4">No referral data yet</p>
        ) : (
          <>
            {/* Mini donut via stacked bar */}
            <div className="flex h-3 rounded-full overflow-hidden mb-4">
              {data.map((ref, i) => (
                <div
                  key={ref.source || i}
                  className={`${COLORS[i % COLORS.length]} transition-all duration-300`}
                  style={{ width: `${(ref.total_revenue / total) * 100}%` }}
                  title={`${ref.source}: ${USD(ref.total_revenue)}`}
                />
              ))}
            </div>
            <div className="space-y-2">
              {data.map((ref, i) => (
                <div key={ref.source || i} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs text-zinc-400">
                    <span className={`w-2 h-2 rounded-full ${COLORS[i % COLORS.length]}`} />
                    <span className="truncate max-w-[110px]">{ref.source || 'Direct'}</span>
                  </span>
                  <span className="text-xs font-medium text-zinc-300">{USD(ref.total_revenue)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

/* ── Sidebar: Pipeline ── */
const PipelinePanel = ({ data, loading }) => (
  <Card tactical>
    <CardHeader className="pb-3">
      <CardTitle className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-400" />
        Pipeline
      </CardTitle>
    </CardHeader>
    <CardContent>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full bg-zinc-800" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="text-xs text-zinc-600 text-center py-4">No pending settlements</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
          {data.slice(0, 10).map((item, i) => (
            <div
              key={item.claim_id || i}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-700/30 hover:border-amber-500/30 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-zinc-200 truncate">{item.claim_number || `Claim ${i + 1}`}</p>
                <p className="text-[10px] text-zinc-500">{item.client_name || 'Client'}</p>
              </div>
              <span className="text-xs font-semibold text-amber-400 whitespace-nowrap ml-2">
                {USD(item.expected_revenue)}
              </span>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

/* ── Revenue Goal Progress ── */
const RevenueGoalBar = ({ current, target, loading }) => {
  if (loading) return <Skeleton className="h-16 w-full bg-zinc-800 rounded-xl" />;
  if (!target || target <= 0) return null;

  const pct = Math.min((current / target) * 100, 100);

  return (
    <Card tactical className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-2 text-xs font-medium text-zinc-400">
            <Target className="w-3.5 h-3.5 text-orange-400" />
            Revenue Goal
          </span>
          <span className="text-xs text-zinc-500">
            {USD(current)} / {USD(target)}
          </span>
        </div>
        <Progress
          value={pct}
          className="h-2.5 bg-zinc-800"
        />
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-zinc-600">{pct.toFixed(0)}% of target</span>
          <span className="text-[10px] text-zinc-600">{USD(target - current)} remaining</span>
        </div>
      </CardContent>
    </Card>
  );
};

/* ── Monthly Revenue Chart (pure CSS bars) ── */
const MonthlyRevenueChart = ({ data, loading }) => {
  if (loading) {
    return (
      <Card tactical>
        <CardContent className="p-5">
          <Skeleton className="h-4 w-32 bg-zinc-800 mb-4" />
          <div className="flex items-end gap-2 h-32">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="flex-1 bg-zinc-800" style={{ height: `${30 + Math.random() * 70}%` }} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map(d => d.revenue || 0), 1);

  return (
    <Card tactical>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          Monthly Revenue Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1.5 h-36">
          {data.map((m, i) => {
            const h = ((m.revenue || 0) / maxVal) * 100;
            return (
              <div key={m.month || i} className="flex-1 flex flex-col items-center gap-1 group">
                <span className="text-[10px] text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  {USD(m.revenue)}
                </span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-orange-600 to-orange-400 transition-all duration-500 hover:from-orange-500 hover:to-amber-300 cursor-default min-h-[2px]"
                  style={{ height: `${Math.max(h, 2)}%` }}
                  title={`${m.label || m.month}: ${USD(m.revenue)}`}
                />
                <span className="text-[9px] text-zinc-600 truncate max-w-full">
                  {m.label || m.month}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

/* ═══════════════════════════════════════════════════════════
   Commission Detail Modal
   ═══════════════════════════════════════════════════════════ */

const CommissionDetailModal = ({ claim, open, onOpenChange }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [newExpense, setNewExpense] = useState({ description: '', amount: '' });
  const [showAddExpense, setShowAddExpense] = useState(false);

  const { data: detail, isLoading } = useQuery({
    queryKey: ['commission-detail', claim?.claim_id],
    queryFn: async () => {
      const res = await apiGet(`/api/commissions/claims/${claim.claim_id}`);
      return res.ok ? res.data : null;
    },
    enabled: !!claim?.claim_id && open,
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates) => {
      const res = await apiPatch(`/api/commissions/claims/${claim.claim_id}`, updates);
      if (!res.ok) throw new Error(res.error || 'Update failed');
      return res.data;
    },
    onSuccess: () => {
      toast.success('Commission updated');
      queryClient.invalidateQueries({ queryKey: ['commission-detail', claim?.claim_id] });
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
    },
    onError: (err) => toast.error(err.message),
  });

  const addExpenseMutation = useMutation({
    mutationFn: async (expense) => {
      const res = await apiPost(`/api/commissions/claims/${claim.claim_id}/expenses`, expense);
      if (!res.ok) throw new Error(res.error || 'Failed to add expense');
      return res.data;
    },
    onSuccess: () => {
      toast.success('Expense added');
      setNewExpense({ description: '', amount: '' });
      setShowAddExpense(false);
      queryClient.invalidateQueries({ queryKey: ['commission-detail', claim?.claim_id] });
    },
    onError: (err) => toast.error(err.message),
  });

  const d = detail || claim || {};
  const grossFee = (d.settlement_amount || 0) * (d.fee_percentage || 0);
  const referralFee = d.referral_fee || 0;
  const totalExpenses = (d.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
  const netRevenue = grossFee - referralFee - totalExpenses;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-orange-400" />
            Commission Detail
            {d.claim_number && (
              <Badge variant="outline" className="ml-2 text-xs">#{d.claim_number}</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {d.client_name || 'Client'} — Full financial breakdown
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full bg-zinc-800" />
            ))}
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Financial Breakdown */}
            <div className="rounded-xl bg-zinc-900/60 border border-zinc-700/30 p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Financial Breakdown</h4>
              <Row label="Settlement Amount" value={USDFull(d.settlement_amount)} highlight />
              <Row label="Fee Percentage" value={PCT(d.fee_percentage)} />
              <Row label="Gross Fee" value={USDFull(grossFee)} highlight />
              <div className="border-t border-zinc-700/30 my-2" />
              <Row label="Referral Fee" value={`-${USDFull(referralFee)}`} negative />
              <Row label="Expenses" value={`-${USDFull(totalExpenses)}`} negative />
              <div className="border-t border-zinc-700/50 my-2" />
              <Row label="Net Revenue" value={USDFull(netRevenue)} bold />
            </div>

            {/* Adjuster Splits */}
            {d.adjuster_splits && d.adjuster_splits.length > 0 && (
              <div className="rounded-xl bg-zinc-900/60 border border-zinc-700/30 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Adjuster Splits</h4>
                <div className="space-y-2">
                  {d.adjuster_splits.map((split, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-300">{split.adjuster_name}</span>
                      <span className="text-zinc-400">
                        {PCT(split.split_percentage)} = <span className="text-white font-medium">{USDFull(grossFee * (split.split_percentage || 0))}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Referral Breakdown */}
            {d.referral_source && (
              <div className="rounded-xl bg-zinc-900/60 border border-zinc-700/30 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Referral</h4>
                <Row label="Source" value={d.referral_source} />
                <Row label="Referral Fee" value={USDFull(referralFee)} />
                {d.referral_percentage && <Row label="Referral %" value={PCT(d.referral_percentage)} />}
              </div>
            )}

            {/* Expenses */}
            <div className="rounded-xl bg-zinc-900/60 border border-zinc-700/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Expenses</h4>
                {isAdmin && (
                  <Button
                    variant="tacticalGhost"
                    size="sm"
                    onClick={() => setShowAddExpense(!showAddExpense)}
                  >
                    {showAddExpense ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    {showAddExpense ? 'Cancel' : 'Add'}
                  </Button>
                )}
              </div>
              {(d.expenses || []).length === 0 && !showAddExpense && (
                <p className="text-xs text-zinc-600 text-center py-2">No expenses recorded</p>
              )}
              {(d.expenses || []).map((exp, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1">
                  <span className="text-zinc-400">{exp.description}</span>
                  <span className="text-red-400 font-medium">-{USDFull(exp.amount)}</span>
                </div>
              ))}
              {showAddExpense && (
                <div className="flex gap-2 mt-3">
                  <Input
                    tactical
                    placeholder="Description"
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                    className="flex-1 h-8 text-xs"
                  />
                  <Input
                    tactical
                    placeholder="$0.00"
                    type="number"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                    className="w-24 h-8 text-xs"
                  />
                  <Button
                    variant="tactical"
                    size="sm"
                    className="h-8"
                    disabled={!newExpense.description || !newExpense.amount || addExpenseMutation.isPending}
                    onClick={() => addExpenseMutation.mutate({
                      description: newExpense.description,
                      amount: parseFloat(newExpense.amount),
                    })}
                  >
                    {addExpenseMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
                  </Button>
                </div>
              )}
            </div>

            {/* Payment Timeline */}
            <div className="rounded-xl bg-zinc-900/60 border border-zinc-700/30 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Payment Timeline</h4>
              <div className="space-y-2">
                <Row label="Status" value={<PaymentStatusBadge status={d.payment_status || 'pending'} />} />
                <Row label="Invoice #" value={d.invoice_number || '--'} />
                <Row label="Invoiced Date" value={fmtDate(d.invoiced_at)} />
                <Row label="Received Date" value={fmtDate(d.received_at)} />
                <Row label="Paid Out Date" value={fmtDate(d.paid_out_at)} />
              </div>
            </div>

            {/* Notes */}
            {d.notes && (
              <div className="rounded-xl bg-zinc-900/60 border border-zinc-700/30 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1.5">
                  <StickyNote className="w-3 h-3" />
                  Notes
                </h4>
                <p className="text-sm text-zinc-400 whitespace-pre-wrap">{d.notes}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="tacticalOutline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="tacticalOutline"
            size="sm"
            onClick={() => toast.info('Invoice generation coming soon')}
          >
            <FileText className="w-3.5 h-3.5" />
            Generate Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Row = ({ label, value, highlight, negative, bold }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-zinc-500">{label}</span>
    <span className={`
      ${highlight ? 'text-white font-medium' : ''}
      ${negative ? 'text-red-400' : ''}
      ${bold ? 'text-emerald-400 font-bold text-base' : ''}
      ${!highlight && !negative && !bold ? 'text-zinc-300' : ''}
    `}>
      {value}
    </span>
  </div>
);

/* ═══════════════════════════════════════════════════════════
   Empty State
   ═══════════════════════════════════════════════════════════ */

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
    <div className="w-20 h-20 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-6">
      <CircleDollarSign className="w-10 h-10 text-orange-400" />
    </div>
    <h3 className="text-lg font-bold text-white mb-2">No Commissions Yet</h3>
    <p className="text-sm text-zinc-500 max-w-sm mb-6">
      Start logging settlements to track revenue, calculate fees, and see your financial dashboard come to life.
    </p>
    <Button variant="tactical" size="lg" onClick={() => toast.info('Commission creation will be available once claims have settlements logged')}>
      <Plus className="w-4 h-4" />
      Log First Settlement
    </Button>
  </div>
);

/* ═══════════════════════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════════════════════ */

export default function CommissionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  /* ── State ── */
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [adjusterFilter, setAdjusterFilter] = useState('all');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  /* ── Queries ── */
  const summaryQuery = useQuery({
    queryKey: ['commissions', 'summary'],
    queryFn: async () => {
      const res = await apiGet('/api/commissions/summary');
      return res.ok ? res.data : MOCK_SUMMARY;
    },
    staleTime: 60_000,
    placeholderData: MOCK_SUMMARY,
  });

  const claimsQuery = useQuery({
    queryKey: ['commissions', 'claims', statusFilter, adjusterFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (adjusterFilter !== 'all') params.set('adjuster', adjusterFilter);
      const res = await apiGet(`/api/commissions/claims?${params.toString()}`);
      return res.ok ? (res.data?.claims || res.data || EMPTY_CLAIMS) : EMPTY_CLAIMS;
    },
    staleTime: 30_000,
    placeholderData: EMPTY_CLAIMS,
  });

  const adjustersQuery = useQuery({
    queryKey: ['commissions', 'by-adjuster'],
    queryFn: async () => {
      const res = await apiGet('/api/commissions/by-adjuster');
      return res.ok ? (res.data?.adjusters || res.data || EMPTY_ADJUSTERS) : EMPTY_ADJUSTERS;
    },
    staleTime: 60_000,
    placeholderData: EMPTY_ADJUSTERS,
  });

  const referralsQuery = useQuery({
    queryKey: ['commissions', 'by-referral'],
    queryFn: async () => {
      const res = await apiGet('/api/commissions/by-referral');
      return res.ok ? (res.data?.referrals || res.data || EMPTY_REFERRALS) : EMPTY_REFERRALS;
    },
    staleTime: 60_000,
    placeholderData: EMPTY_REFERRALS,
  });

  const pipelineQuery = useQuery({
    queryKey: ['commissions', 'pipeline'],
    queryFn: async () => {
      const res = await apiGet('/api/commissions/pipeline');
      return res.ok ? (res.data?.pipeline || res.data || EMPTY_PIPELINE) : EMPTY_PIPELINE;
    },
    staleTime: 30_000,
    placeholderData: EMPTY_PIPELINE,
  });

  const summary = summaryQuery.data || MOCK_SUMMARY;
  const claims = claimsQuery.data || EMPTY_CLAIMS;
  const adjusters = adjustersQuery.data || EMPTY_ADJUSTERS;
  const referrals = referralsQuery.data || EMPTY_REFERRALS;
  const pipeline = pipelineQuery.data || EMPTY_PIPELINE;

  /* ── Inline status update ── */
  const queryClient = useQueryClient();
  const statusMutation = useMutation({
    mutationFn: async ({ claimId, status }) => {
      const res = await apiPatch(`/api/commissions/claims/${claimId}`, { payment_status: status });
      if (!res.ok) throw new Error(res.error || 'Update failed');
      return res.data;
    },
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
    },
    onError: (err) => toast.error(err.message),
  });

  /* ── Filtering & Sorting ── */
  const handleSort = useCallback((field) => {
    setSortDir(prev => (sortKey === field ? (prev === 'asc' ? 'desc' : 'asc') : 'desc'));
    setSortKey(field);
  }, [sortKey]);

  const filteredClaims = useMemo(() => {
    let result = [...claims];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        (c.claim_number || '').toLowerCase().includes(q) ||
        (c.client_name || '').toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      const cmp = typeof aVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [claims, search, sortKey, sortDir]);

  /* ── CSV Export ── */
  const handleExport = useCallback(() => {
    if (filteredClaims.length === 0) {
      toast.error('No data to export');
      return;
    }
    const headers = ['Claim #', 'Client', 'Settlement', 'Fee %', 'Gross Fee', 'Referral Fee', 'Net Revenue', 'Status'];
    const rows = filteredClaims.map(c => {
      const gross = (c.settlement_amount || 0) * (c.fee_percentage || 0);
      const ref = c.referral_fee || 0;
      return [
        c.claim_number, c.client_name, c.settlement_amount, (c.fee_percentage || 0) * 100,
        gross.toFixed(2), ref.toFixed(2), (gross - ref).toFixed(2), c.payment_status,
      ];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eden-commissions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  }, [filteredClaims]);

  /* ── Unique adjusters for filter dropdown ── */
  const adjusterOptions = useMemo(() => {
    const unique = new Map();
    claims.forEach(c => {
      if (c.adjuster_name && c.adjuster_id) {
        unique.set(c.adjuster_id, c.adjuster_name);
      }
    });
    return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
  }, [claims]);

  /* ── Month-over-month comparison ── */
  const monthDelta = summary.last_month_revenue > 0
    ? ((summary.month_revenue - summary.last_month_revenue) / summary.last_month_revenue) * 100
    : null;

  const isLoading = summaryQuery.isLoading;
  const hasData = claims.length > 0 || summary.total_revenue > 0;

  /* ═══════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════ */

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            Commission & Revenue
          </h1>
          <p className="text-sm text-zinc-500 mt-1 ml-[52px]">Track settlements, fees, and revenue across your claims</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="tacticalOutline" size="sm" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Revenue Goal */}
      <RevenueGoalBar
        current={summary.month_revenue || 0}
        target={summary.revenue_goal || 0}
        loading={isLoading}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Banknote}
          iconColor="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
          label="Total Revenue"
          value={USD(summary.total_revenue)}
          trend={summary.total_revenue_trend}
          subValue="all time"
          loading={isLoading}
        />
        <KpiCard
          icon={TrendingUp}
          iconColor="bg-orange-500/10 border border-orange-500/20 text-orange-400"
          label="This Month"
          value={USD(summary.month_revenue)}
          trend={monthDelta}
          subValue={`vs ${USD(summary.last_month_revenue)} last month`}
          loading={isLoading}
        />
        <KpiCard
          icon={PiggyBank}
          iconColor="bg-amber-500/10 border border-amber-500/20 text-amber-400"
          label="Pipeline Revenue"
          value={USD(summary.pipeline_revenue)}
          subValue={`${summary.pipeline_count || 0} pending settlements`}
          loading={isLoading}
        />
        <KpiCard
          icon={BarChart3}
          iconColor="bg-blue-500/10 border border-blue-500/20 text-blue-400"
          label="Avg Fee / Claim"
          value={USD(summary.avg_fee_per_claim)}
          trend={summary.avg_fee_trend}
          subValue="efficiency metric"
          loading={isLoading}
        />
      </div>

      {/* Main Content: Table + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Claims Revenue Table (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <Card tactical>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input
                    tactical
                    placeholder="Search claim # or client..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px] h-9">
                    <Filter className="w-3.5 h-3.5 text-zinc-500 mr-1.5" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="invoiced">Invoiced</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                    <SelectItem value="paid_out">Paid Out</SelectItem>
                  </SelectContent>
                </Select>
                {adjusterOptions.length > 0 && (
                  <Select value={adjusterFilter} onValueChange={setAdjusterFilter}>
                    <SelectTrigger className="w-[160px] h-9">
                      <Users className="w-3.5 h-3.5 text-zinc-500 mr-1.5" />
                      <SelectValue placeholder="Adjuster" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Adjusters</SelectItem>
                      {adjusterOptions.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card tactical className="overflow-hidden">
            {!hasData && !claimsQuery.isLoading ? (
              <EmptyState />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-700/30 hover:bg-transparent">
                      <SortHeader field="claim_number" label="Claim #" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader field="client_name" label="Client" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader field="settlement_amount" label="Settlement" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right" />
                      <TableHead className="text-right">Fee %</TableHead>
                      <TableHead className="text-right">Gross Fee</TableHead>
                      <TableHead className="text-right">Ref. Fee</TableHead>
                      <SortHeader field="net_revenue" label="Net Rev." sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right" />
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {claimsQuery.isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i} className="border-zinc-800/30">
                          {Array.from({ length: 8 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-full bg-zinc-800" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : filteredClaims.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2">
                            <AlertCircle className="w-8 h-8 text-zinc-700" />
                            <p className="text-sm text-zinc-500">No claims match your filters</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredClaims.map((c) => {
                        const gross = (c.settlement_amount || 0) * (c.fee_percentage || 0);
                        const ref = c.referral_fee || 0;
                        const net = gross - ref;
                        return (
                          <TableRow
                            key={c.claim_id || c.claim_number}
                            className="border-zinc-800/30 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                            onClick={() => { setSelectedClaim(c); setDetailOpen(true); }}
                          >
                            <TableCell className="font-mono text-xs text-orange-400 font-medium">
                              {c.claim_number || '--'}
                            </TableCell>
                            <TableCell className="text-sm text-zinc-300 max-w-[140px] truncate">
                              {c.client_name || '--'}
                            </TableCell>
                            <TableCell className="text-right text-sm text-white font-medium tabular-nums">
                              {USD(c.settlement_amount)}
                            </TableCell>
                            <TableCell className="text-right text-sm text-zinc-400 tabular-nums">
                              {c.fee_percentage ? `${(c.fee_percentage * 100).toFixed(0)}%` : '--'}
                            </TableCell>
                            <TableCell className="text-right text-sm text-zinc-300 tabular-nums">
                              {USD(gross)}
                            </TableCell>
                            <TableCell className="text-right text-sm text-zinc-500 tabular-nums">
                              {ref > 0 ? `-${USD(ref)}` : '--'}
                            </TableCell>
                            <TableCell className="text-right text-sm font-semibold tabular-nums text-emerald-400">
                              {USD(net)}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              {isAdmin ? (
                                <Select
                                  value={c.payment_status || 'pending'}
                                  onValueChange={(val) => statusMutation.mutate({
                                    claimId: c.claim_id,
                                    status: val,
                                  })}
                                >
                                  <SelectTrigger className="h-7 w-[110px] text-xs border-zinc-700/30 bg-transparent">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="invoiced">Invoiced</SelectItem>
                                    <SelectItem value="received">Received</SelectItem>
                                    <SelectItem value="paid_out">Paid Out</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <PaymentStatusBadge status={c.payment_status || 'pending'} />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          {/* Monthly Revenue Chart */}
          <MonthlyRevenueChart
            data={summary.monthly_revenue || []}
            loading={isLoading}
          />
        </div>

        {/* Right Column — Sidebar Panels (1/3) */}
        <div className="space-y-4">
          <AdjusterPanel
            data={adjusters}
            loading={adjustersQuery.isLoading}
          />
          <ReferralPanel
            data={referrals}
            loading={referralsQuery.isLoading}
          />
          <PipelinePanel
            data={pipeline}
            loading={pipelineQuery.isLoading}
          />

          {/* Fee Structure (Admin only) */}
          {isAdmin && (
            <Card tactical>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                  <Hash className="w-4 h-4 text-purple-400" />
                  Fee Structure
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <FeeRow label="Standard PA Fee" value="10%" />
                  <FeeRow label="Re-inspection Fee" value="15%" />
                  <FeeRow label="Supplement Fee" value="10%" />
                  <FeeRow label="Referral Split" value="20%" />
                  <div className="pt-2">
                    <Button
                      variant="tacticalGhost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => toast.info('Fee structure editor coming in next release')}
                    >
                      Edit Fee Structure
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Commission Detail Modal */}
      <CommissionDetailModal
        claim={selectedClaim}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelectedClaim(null);
        }}
      />
    </div>
  );
}

/* Small helper for fee structure display */
const FeeRow = ({ label, value }) => (
  <div className="flex items-center justify-between">
    <span className="text-xs text-zinc-500">{label}</span>
    <span className="text-xs font-semibold text-white bg-zinc-800 px-2 py-0.5 rounded">{value}</span>
  </div>
);
