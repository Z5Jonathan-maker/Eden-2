import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import {
  Target, DollarSign, AlertTriangle, Clock, TrendingUp,
  ChevronRight, Loader2, ListChecks, BarChart3, Users,
  PieChart, Timer, CheckCircle2,
} from 'lucide-react';
import { NAV_ICONS } from '../../../assets/badges';

const GardenDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    const res = await apiGet('/api/garden/dashboard', { cache: false });
    if (res.ok) setData(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!data) return null;

  const pipelineOrder = ['New', 'In Progress', 'Under Review', 'Approved', 'Denied', 'Completed', 'Closed'];
  const pipelineColors = {
    New: 'bg-zinc-500', 'In Progress': 'bg-blue-500', 'Under Review': 'bg-purple-500',
    Approved: 'bg-green-500', Denied: 'bg-red-500', Completed: 'bg-emerald-500', Closed: 'bg-zinc-600',
  };

  const maxPipelineCount = Math.max(1, ...pipelineOrder.map(s => data.pipeline[s]?.count || 0));

  // Aging colors
  const agingColors = {
    '0-7': 'bg-green-500', '8-14': 'bg-emerald-500', '15-30': 'bg-yellow-500',
    '31-60': 'bg-orange-500', '61-90': 'bg-red-500', '90+': 'bg-red-700',
  };
  const agingBuckets = data.aging || {};
  const maxAging = Math.max(1, ...Object.values(agingBuckets));

  // Type breakdown
  const typeData = data.claims_by_type || [];
  const maxTypeCount = Math.max(1, ...typeData.map(t => t.count || 0));

  // Adjuster workload
  const adjusterData = data.adjuster_workload || [];
  const maxAdjusterClaims = Math.max(1, ...adjusterData.map(a => a.claims || 0));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="card-tactical p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-orange-500" />
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Total Claims</span>
          </div>
          <p className="text-2xl font-tactical font-bold text-white">{data.total_claims}</p>
        </div>
        <div className="card-tactical p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-green-500" />
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Pipeline Value</span>
          </div>
          <p className="text-2xl font-tactical font-bold text-green-400">
            ${(data.total_value / 1000).toFixed(0)}K
          </p>
        </div>
        <div className="card-tactical p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Overdue Tasks</span>
          </div>
          <p className={`text-2xl font-tactical font-bold ${data.tasks.overdue > 0 ? 'text-red-400' : 'text-zinc-400'}`}>
            {data.tasks.overdue}
          </p>
        </div>
        <div className="card-tactical p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Avg Value</span>
          </div>
          <p className="text-2xl font-tactical font-bold text-purple-400">
            ${((data.financials?.avg_claim_value || 0) / 1000).toFixed(0)}K
          </p>
        </div>
        <div className="card-tactical p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Settlement Rate</span>
          </div>
          <p className="text-2xl font-tactical font-bold text-emerald-400">
            {data.settlement_rate || 0}%
          </p>
        </div>
        <div className="card-tactical p-4">
          <div className="flex items-center gap-2 mb-2">
            <Timer className="w-4 h-4 text-cyan-500" />
            <span className="text-[10px] font-mono text-zinc-500 uppercase">New (30d)</span>
          </div>
          <p className="text-2xl font-tactical font-bold text-cyan-400">
            {data.new_last_30 || 0}
          </p>
        </div>
      </div>

      {/* Row: Pipeline + Aging Report */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Bar Chart */}
        <div className="card-tactical p-5">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-5 h-5 text-orange-500" />
            <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">Pipeline</h3>
          </div>
          <div className="space-y-3">
            {pipelineOrder.map(status => {
              const info = data.pipeline[status];
              if (!info) return null;
              const pct = (info.count / maxPipelineCount) * 100;
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-zinc-400 w-28 truncate">{status}</span>
                  <div className="flex-1 h-6 bg-zinc-800/50 rounded overflow-hidden relative">
                    <div
                      className={`h-full ${pipelineColors[status] || 'bg-zinc-500'} rounded transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                    <span className="absolute inset-0 flex items-center px-2 text-[10px] font-mono text-white">
                      {info.count} — ${(info.value / 1000).toFixed(0)}K
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Aging Report */}
        <div className="card-tactical p-5">
          <div className="flex items-center gap-3 mb-4">
            <Timer className="w-5 h-5 text-amber-500" />
            <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">Aging Report</h3>
          </div>
          <div className="space-y-3">
            {Object.entries(agingBuckets).map(([bucket, count]) => {
              const pct = (count / maxAging) * 100;
              return (
                <div key={bucket} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-zinc-400 w-16">{bucket}d</span>
                  <div className="flex-1 h-6 bg-zinc-800/50 rounded overflow-hidden relative">
                    <div
                      className={`h-full ${agingColors[bucket] || 'bg-zinc-500'} rounded transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                    <span className="absolute inset-0 flex items-center px-2 text-[10px] font-mono text-white">
                      {count} claim{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row: Type Breakdown + Adjuster Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Claims by Type */}
        <div className="card-tactical p-5">
          <div className="flex items-center gap-3 mb-4">
            <PieChart className="w-5 h-5 text-blue-500" />
            <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">By Type</h3>
          </div>
          {typeData.length === 0 ? (
            <p className="text-zinc-500 text-sm font-mono">No data</p>
          ) : (
            <div className="space-y-2.5">
              {typeData.slice(0, 8).map(row => {
                const pct = (row.count / maxTypeCount) * 100;
                return (
                  <div key={row.type} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-zinc-400 w-28 truncate">{row.type}</span>
                    <div className="flex-1 h-5 bg-zinc-800/50 rounded overflow-hidden relative">
                      <div className="h-full bg-blue-500/70 rounded transition-all duration-500" style={{ width: `${pct}%` }} />
                      <span className="absolute inset-0 flex items-center px-2 text-[10px] font-mono text-white">
                        {row.count} — ${((row.value || 0) / 1000).toFixed(0)}K
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Adjuster Workload */}
        <div className="card-tactical p-5">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-5 h-5 text-purple-500" />
            <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">Adjuster Workload</h3>
          </div>
          {adjusterData.length === 0 ? (
            <p className="text-zinc-500 text-sm font-mono">No data</p>
          ) : (
            <div className="space-y-2.5">
              {adjusterData.slice(0, 10).map(adj => {
                const pct = (adj.claims / maxAdjusterClaims) * 100;
                return (
                  <div key={adj.name} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-zinc-400 w-28 truncate">{adj.name}</span>
                    <div className="flex-1 h-5 bg-zinc-800/50 rounded overflow-hidden relative">
                      <div className="h-full bg-purple-500/70 rounded transition-all duration-500" style={{ width: `${pct}%` }} />
                      <span className="absolute inset-0 flex items-center px-2 text-[10px] font-mono text-white">
                        {adj.claims} — ${((adj.value || 0) / 1000).toFixed(0)}K
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Row: Financial Summary + Stale Claims + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financial Summary */}
        <div className="card-tactical p-5">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="w-5 h-5 text-green-500" />
            <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">Financials</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Total Estimated', value: data.financials?.total_estimated },
              { label: 'Total Settlement', value: data.financials?.total_settlement },
              { label: 'Total ACV', value: data.financials?.total_acv },
              { label: 'Total RCV', value: data.financials?.total_rcv },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-xs font-mono text-zinc-500">{row.label}</span>
                <span className="text-sm font-tactical font-bold text-green-400">
                  ${((row.value || 0) / 1000).toFixed(0)}K
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stale Claims Alert */}
        <div className="card-tactical p-5">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-5 h-5 text-amber-500" />
            <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">
              Stale ({data.stale_claims.length})
            </h3>
          </div>
          {data.stale_claims.length === 0 ? (
            <p className="text-zinc-500 text-sm font-mono">All claims active.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {data.stale_claims.map(claim => (
                <button
                  key={claim.id}
                  onClick={() => navigate(`/claims/${claim.id}`)}
                  className="w-full flex items-center justify-between p-2.5 bg-zinc-800/30 rounded border border-zinc-700/30 hover:border-amber-500/30 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-tactical text-white truncate">{claim.claim_number}</p>
                    <p className="text-[10px] font-mono text-zinc-500 truncate">{claim.client_name}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono text-amber-400">
                      {claim.updated_at ? new Date(claim.updated_at).toLocaleDateString() : 'N/A'}
                    </span>
                    <ChevronRight className="w-3 h-3 text-zinc-600" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card-tactical p-5">
          <div className="flex items-center gap-3 mb-4">
            <ListChecks className="w-5 h-5 text-blue-500" />
            <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">
              Recent Activity
            </h3>
          </div>
          {data.recent_activity.length === 0 ? (
            <p className="text-zinc-500 text-sm font-mono">No recent activity.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {data.recent_activity.map(claim => (
                <button
                  key={claim.id}
                  onClick={() => navigate(`/claims/${claim.id}`)}
                  className="w-full flex items-center justify-between p-2.5 bg-zinc-800/30 rounded border border-zinc-700/30 hover:border-blue-500/30 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-tactical text-white truncate">{claim.claim_number}</p>
                    <p className="text-[10px] font-mono text-zinc-500 truncate">{claim.client_name}</p>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 badge-common px-2 py-0.5 rounded">
                    {claim.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GardenDashboard;
