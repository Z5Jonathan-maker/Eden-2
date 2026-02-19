import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import {
  Target, DollarSign, AlertTriangle, Clock, TrendingUp,
  ChevronRight, Loader2, ListChecks, BarChart3, Users,
  PieChart, Timer, CheckCircle2, RefreshCw, ArrowUpRight,
  ArrowDownRight, Activity, Zap, ShieldAlert,
} from 'lucide-react';

/* ─── Helpers ─── */
const fmtK = (v) => {
  if (!v && v !== 0) return '$0';
  const num = Number(v);
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toLocaleString()}`;
};

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / 86400000);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const daysSince = (dateStr) => {
  if (!dateStr) return 999;
  return Math.floor((new Date() - new Date(dateStr)) / 86400000);
};

/* ─── Animated Number ─── */
const AnimatedNumber = ({ value, prefix = '', suffix = '' }) => {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    const target = Number(value) || 0;
    if (target === 0) { setDisplayed(0); return; }
    const duration = 600;
    const start = performance.now();
    const animate = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplayed(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);
  return <>{prefix}{displayed.toLocaleString()}{suffix}</>;
};

/* ─── KPI Card ─── */
const KpiCard = ({ icon: Icon, iconColor, label, value, valueColor = 'text-white', prefix = '', suffix = '', subtitle }) => (
  <div className="relative overflow-hidden rounded-2xl bg-zinc-900/80 border border-zinc-800/60 p-4 hover:border-zinc-700/60 transition-all group">
    <div className="flex items-center gap-2 mb-3">
      <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${iconColor} flex items-center justify-center`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{label}</span>
    </div>
    <p className={`text-2xl font-bold ${valueColor} tabular-nums`}>
      <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />
    </p>
    {subtitle && <p className="text-[10px] text-zinc-600 mt-1 font-medium">{subtitle}</p>}
    {/* Subtle glow on hover */}
    <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-0 group-hover:opacity-10 transition-opacity ${iconColor}`} />
  </div>
);

/* ─── Section Header ─── */
const SectionHeader = ({ icon: Icon, color, title, badge }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2.5">
      <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center`}>
        <Icon className="w-3.5 h-3.5 text-white" />
      </div>
      <h3 className="font-bold text-white text-sm tracking-wide">{title}</h3>
    </div>
    {badge !== undefined && (
      <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{badge}</span>
    )}
  </div>
);

/* ─── Horizontal Bar ─── */
const HBar = ({ pct, color, label, value, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 group ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
  >
    <span className="text-[11px] font-mono text-zinc-400 w-24 truncate text-right">{label}</span>
    <div className="flex-1 h-7 bg-zinc-800/40 rounded-full overflow-hidden relative">
      <div
        className={`h-full ${color} rounded-full transition-all duration-700 ease-out`}
        style={{ width: `${Math.max(pct, 2)}%` }}
      />
      <span className="absolute inset-0 flex items-center px-3 text-[10px] font-mono text-white/90 font-medium">
        {value}
      </span>
    </div>
  </button>
);

/* ─── Status Colors ─── */
const STATUS_COLORS = {
  New: { bar: 'bg-zinc-500', pill: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30' },
  'In Progress': { bar: 'bg-blue-500', pill: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  'Under Review': { bar: 'bg-purple-500', pill: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  Approved: { bar: 'bg-green-500', pill: 'bg-green-500/15 text-green-300 border-green-500/30' },
  Denied: { bar: 'bg-red-500', pill: 'bg-red-500/15 text-red-300 border-red-500/30' },
  Completed: { bar: 'bg-emerald-500', pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  Closed: { bar: 'bg-zinc-600', pill: 'bg-zinc-600/15 text-zinc-400 border-zinc-600/30' },
};

const AGING_COLORS = {
  '0-7': 'bg-emerald-500', '8-14': 'bg-green-500', '15-30': 'bg-yellow-500',
  '31-60': 'bg-orange-500', '61-90': 'bg-red-500', '90+': 'bg-red-700',
};

const TYPE_COLORS = [
  'bg-blue-500', 'bg-cyan-500', 'bg-teal-500', 'bg-indigo-500',
  'bg-violet-500', 'bg-pink-500', 'bg-amber-500', 'bg-rose-500',
];

/* ─── Main Dashboard ─── */
const GardenDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async () => {
    if (data) setRefreshing(true); else setLoading(true);
    const res = await apiGet('/api/garden/dashboard', { cache: false });
    if (res.ok) { setData(res.data); setLastRefresh(new Date()); }
    setLoading(false);
    setRefreshing(false);
  }, [data]);

  useEffect(() => { fetchDashboard(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-orange-500" />
        <span className="text-xs text-zinc-600 font-medium">Loading metrics...</span>
      </div>
    );
  }

  if (!data) return null;

  const pipelineOrder = ['New', 'In Progress', 'Under Review', 'Approved', 'Denied', 'Completed', 'Closed'];
  const maxPipeline = Math.max(1, ...pipelineOrder.map(s => data.pipeline[s]?.count || 0));

  const agingBuckets = data.aging || {};
  const maxAging = Math.max(1, ...Object.values(agingBuckets));

  const typeData = data.claims_by_type || [];
  const maxType = Math.max(1, ...typeData.map(t => t.count || 0));

  const adjusterData = data.adjuster_workload || [];
  const maxAdj = Math.max(1, ...adjusterData.map(a => a.claims || 0));

  const totalTasks = (data.tasks?.total || 0);
  const overdueTasks = (data.tasks?.overdue || 0);

  return (
    <div className="space-y-6">
      {/* ── Refresh bar ── */}
      <div className="flex items-center justify-end gap-3">
        {lastRefresh && (
          <span className="text-[10px] text-zinc-600 font-mono">
            Updated {timeAgo(lastRefresh.toISOString())}
          </span>
        )}
        <button onClick={fetchDashboard} disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors">
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={Target} iconColor="from-orange-600 to-orange-700" label="Total Claims" value={data.total_claims} />
        <KpiCard icon={DollarSign} iconColor="from-green-600 to-green-700" label="Pipeline Value" value={Math.round((data.total_value || 0) / 1000)} prefix="$" suffix="K" valueColor="text-green-400" />
        <KpiCard icon={AlertTriangle} iconColor="from-red-600 to-red-700" label="Overdue Tasks"
          value={overdueTasks}
          valueColor={overdueTasks > 0 ? 'text-red-400' : 'text-zinc-400'}
          subtitle={totalTasks > 0 ? `of ${totalTasks} total` : undefined}
        />
        <KpiCard icon={TrendingUp} iconColor="from-purple-600 to-purple-700" label="Avg Value"
          value={Math.round((data.financials?.avg_claim_value || 0) / 1000)} prefix="$" suffix="K" valueColor="text-purple-400" />
        <KpiCard icon={CheckCircle2} iconColor="from-emerald-600 to-emerald-700" label="Settlement Rate"
          value={data.settlement_rate || 0} suffix="%" valueColor="text-emerald-400" />
        <KpiCard icon={Zap} iconColor="from-cyan-600 to-cyan-700" label="New (30d)"
          value={data.new_last_30 || 0} valueColor="text-cyan-400" />
      </div>

      {/* ── Row: Pipeline + Aging ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pipeline */}
        <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800/60 p-5">
          <SectionHeader icon={BarChart3} color="bg-orange-600" title="Pipeline" badge={data.total_claims} />
          <div className="space-y-2.5">
            {pipelineOrder.map(status => {
              const info = data.pipeline[status];
              if (!info) return null;
              const pct = (info.count / maxPipeline) * 100;
              return (
                <HBar key={status} pct={pct} color={STATUS_COLORS[status]?.bar || 'bg-zinc-500'}
                  label={status} value={`${info.count} — ${fmtK(info.value)}`}
                />
              );
            })}
          </div>
        </div>

        {/* Aging Report */}
        <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800/60 p-5">
          <SectionHeader icon={Timer} color="bg-amber-600" title="Aging Report" />
          {Object.keys(agingBuckets).length === 0 ? (
            <p className="text-zinc-600 text-sm text-center py-8">No aging data available</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(agingBuckets).map(([bucket, count]) => {
                const pct = (count / maxAging) * 100;
                return (
                  <HBar key={bucket} pct={pct} color={AGING_COLORS[bucket] || 'bg-zinc-500'}
                    label={`${bucket} days`} value={`${count} claim${count !== 1 ? 's' : ''}`}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Row: Type Breakdown + Adjuster Workload ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Claims by Type */}
        <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800/60 p-5">
          <SectionHeader icon={PieChart} color="bg-blue-600" title="By Type" badge={typeData.length} />
          {typeData.length === 0 ? (
            <p className="text-zinc-600 text-sm text-center py-8">No type data</p>
          ) : (
            <div className="space-y-2">
              {typeData.slice(0, 8).map((row, i) => {
                const pct = (row.count / maxType) * 100;
                return (
                  <HBar key={row.type} pct={pct} color={TYPE_COLORS[i % TYPE_COLORS.length]}
                    label={row.type} value={`${row.count} — ${fmtK(row.value)}`}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Adjuster Workload */}
        <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800/60 p-5">
          <SectionHeader icon={Users} color="bg-purple-600" title="Adjuster Workload" badge={adjusterData.length} />
          {adjusterData.length === 0 ? (
            <p className="text-zinc-600 text-sm text-center py-8">No adjuster data</p>
          ) : (
            <div className="space-y-2">
              {adjusterData.slice(0, 8).map((adj, i) => {
                const pct = (adj.claims / maxAdj) * 100;
                return (
                  <HBar key={adj.name} pct={pct} color={`bg-purple-${500 - i * 50 > 300 ? 500 - i * 50 : 400}`}
                    label={adj.name} value={`${adj.claims} — ${fmtK(adj.value)}`}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Row: Financials + Stale + Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Financials */}
        <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800/60 p-5">
          <SectionHeader icon={DollarSign} color="bg-green-600" title="Financials" />
          <div className="space-y-3.5">
            {[
              { label: 'Total Estimated', value: data.financials?.total_estimated, color: 'text-green-400' },
              { label: 'Total Settlement', value: data.financials?.total_settlement, color: 'text-emerald-400' },
              { label: 'Total ACV', value: data.financials?.total_acv, color: 'text-cyan-400' },
              { label: 'Total RCV', value: data.financials?.total_rcv, color: 'text-blue-400' },
            ].map(row => {
              const maxFin = Math.max(1, data.financials?.total_estimated || 1);
              const pct = ((row.value || 0) / maxFin) * 100;
              return (
                <div key={row.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-mono text-zinc-500">{row.label}</span>
                    <span className={`text-sm font-bold tabular-nums ${row.color}`}>{fmtK(row.value)}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800/60 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full bg-green-500/50 transition-all duration-700`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stale Claims */}
        <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800/60 p-5">
          <SectionHeader icon={ShieldAlert} color="bg-amber-600" title="Stale Claims" badge={data.stale_claims?.length || 0} />
          {!data.stale_claims?.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-zinc-600">
              <CheckCircle2 className="w-8 h-8 mb-2 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-400">All claims active</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {data.stale_claims.map(claim => {
                const days = daysSince(claim.updated_at);
                const urgency = days > 30 ? 'text-red-400 bg-red-500/10' : days > 14 ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-400 bg-zinc-800';
                return (
                  <button key={claim.id} onClick={() => navigate(`/claims/${claim.id}`)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-800/30 hover:bg-zinc-800/60 border border-zinc-700/20 hover:border-amber-500/30 transition-all text-left group">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate group-hover:text-orange-400 transition-colors">
                        {claim.claim_number}
                      </p>
                      <p className="text-[10px] text-zinc-500 truncate">{claim.client_name}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full ${urgency}`}>
                        {days}d
                      </span>
                      <ChevronRight className="w-3 h-3 text-zinc-600 group-hover:text-orange-500 transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800/60 p-5">
          <SectionHeader icon={Activity} color="bg-blue-600" title="Recent Activity" badge={data.recent_activity?.length || 0} />
          {!data.recent_activity?.length ? (
            <div className="flex flex-col items-center justify-center py-8 text-zinc-600">
              <ListChecks className="w-8 h-8 mb-2" />
              <p className="text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {data.recent_activity.map(claim => {
                const statusStyle = STATUS_COLORS[claim.status]?.pill || 'bg-zinc-800 text-zinc-400 border-zinc-700';
                return (
                  <button key={claim.id} onClick={() => navigate(`/claims/${claim.id}`)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-800/30 hover:bg-zinc-800/60 border border-zinc-700/20 hover:border-blue-500/30 transition-all text-left group">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate group-hover:text-orange-400 transition-colors">
                        {claim.claim_number}
                      </p>
                      <p className="text-[10px] text-zinc-500 truncate">{claim.client_name}</p>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusStyle}`}>
                      {claim.status}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GardenDashboard;
