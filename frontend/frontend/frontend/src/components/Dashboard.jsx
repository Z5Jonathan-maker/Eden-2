import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import {
  FolderOpen,
  Activity,
  ArrowRight,
  Plus,
  Loader2,
  CheckCircle,
  XCircle,
  Shield,
  ChevronRight,
  AlertTriangle,
  Trophy,
} from 'lucide-react';
import { getTierBadge, UI_ICONS, PAGE_ICONS } from '../assets/badges';
import KpiCards from './dashboard/KpiCards';
import StatusDistribution from './dashboard/StatusDistribution';
import ClaimPilotWidget from './dashboard/ClaimPilotWidget';
import SuggestedActions from './dashboard/SuggestedActions';

const COMPLETED_STATUSES = ['Completed', 'Closed'];
const ACTIVE_STATUSES_EXCLUDED = COMPLETED_STATUSES;

const computeAvgProcessingDays = (claims) => {
  const completed = claims.filter(
    (c) => c.status === 'Completed' && c.created_at && c.updated_at
  );
  if (completed.length === 0) return null;

  const totalDays = completed.reduce((sum, c) => {
    const start = new Date(c.created_at);
    const end = new Date(c.updated_at);
    const diffMs = end - start;
    const diffDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
    return sum + diffDays;
  }, 0);

  return Math.round(totalDays / completed.length);
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState(null);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [battlePassProgress, setBattlePassProgress] = useState(null);

  const fetchBattlePassProgress = useCallback(async () => {
    try {
      const res = await apiGet('/api/battle-pass/progress');
      if (res.ok) {
        setBattlePassProgress(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch battle pass progress:', err);
    }
  }, []);

  const checkPaymentStatus = useCallback(async () => {
    const sessionId = searchParams.get('session_id');
    const payment = searchParams.get('payment');

    if (sessionId && payment === 'success') {
      try {
        const MAX_ATTEMPTS = 5;
        const POLL_INTERVAL_MS = 2000;
        let attempts = 0;

        const pollStatus = async () => {
          if (attempts >= MAX_ATTEMPTS) {
            setPaymentStatus({
              type: 'info',
              message: 'Payment is being processed. Please check your email for confirmation.',
            });
            return;
          }

          const res = await apiGet(`/api/payments/status/${sessionId}`);

          if (res.ok && res.data.payment_status === 'paid') {
            setPaymentStatus({
              type: 'success',
              message: `Payment successful! Your ${res.data.package_id || 'subscription'} plan is now active.`,
            });
            window.history.replaceState({}, '', '/dashboard');
          } else if (res.ok && res.data.status === 'expired') {
            setPaymentStatus({
              type: 'error',
              message: 'Payment session expired. Please try again.',
            });
          } else {
            attempts++;
            setTimeout(pollStatus, POLL_INTERVAL_MS);
          }
        };

        await pollStatus();
      } catch (err) {
        console.error('Payment status check error:', err);
        setPaymentStatus({
          type: 'info',
          message: 'Unable to verify payment status. Please check your account settings.',
        });
      }
    }
  }, [searchParams]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet('/api/claims/');

      if (!res.ok) {
        throw new Error(res.error || 'Failed to fetch claims');
      }

      const claimsData = Array.isArray(res.data) ? res.data : [];
      setClaims(claimsData);

      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();

      const activeClaims = claimsData.filter(
        (c) => !ACTIVE_STATUSES_EXCLUDED.includes(c.status)
      );

      const avgDays = computeAvgProcessingDays(claimsData);

      const dashboardStats = {
        totalClaims: claimsData.length,
        activeClaims: activeClaims.length,
        completedThisMonth: claimsData.filter((c) => {
          const createdAt = new Date(c.created_at);
          return (
            c.status === 'Completed' &&
            createdAt.getMonth() === thisMonth &&
            createdAt.getFullYear() === thisYear
          );
        }).length,
        pendingInspections: claimsData.filter((c) => c.status === 'Under Review').length,
        totalValue: claimsData.reduce((sum, c) => sum + (c.estimated_value || 0), 0),
        pipelineValue: activeClaims.reduce((sum, c) => sum + (c.estimated_value || 0), 0),
        avgProcessingTime: avgDays !== null ? `${avgDays} days` : 'N/A',
        stalledCount: claimsData.filter((c) => {
          if (COMPLETED_STATUSES.includes(c.status)) return false;
          const lastUpdate = new Date(c.updated_at || c.created_at);
          const daysSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60 * 24);
          return daysSinceUpdate > 7;
        }).length,
        recentClaims: claimsData.slice(0, 4),
      };

      setStats(dashboardStats);
      setError('');
    } catch (err) {
      setError(err.message);
      setClaims([]);
      setStats({
        totalClaims: 0,
        activeClaims: 0,
        completedThisMonth: 0,
        pendingInspections: 0,
        totalValue: 0,
        pipelineValue: 0,
        avgProcessingTime: 'N/A',
        stalledCount: 0,
        recentClaims: [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    fetchBattlePassProgress();
    checkPaymentStatus();
  }, [fetchDashboardData, checkPaymentStatus, fetchBattlePassProgress]);

  const getStatusBadge = (status) => {
    if (status === 'In Progress') return 'badge-rare';
    if (status === 'Under Review') return 'badge-epic';
    if (status === 'Completed') return 'badge-uncommon';
    return 'badge-common';
  };

  const getPriorityBadge = (priority) => {
    if (priority === 'High') return 'badge-mythic';
    if (priority === 'Medium') return 'badge-legendary';
    return 'badge-uncommon';
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 min-h-screen">
        <div className="mb-6 sm:mb-8 flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg bg-zinc-800 animate-pulse" />
          <div>
            <div className="h-6 sm:h-8 w-48 bg-zinc-800 rounded animate-pulse mb-2" />
            <div className="h-3 w-64 bg-zinc-800/60 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card-tactical p-3 sm:p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-zinc-800 animate-pulse" />
                <div className="h-3 w-10 bg-zinc-800/60 rounded animate-pulse" />
              </div>
              <div className="h-8 sm:h-10 w-16 bg-zinc-800 rounded animate-pulse mb-2" />
              <div className="h-3 w-24 bg-zinc-800/60 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="card-tactical p-5">
          <div className="h-5 w-40 bg-zinc-800 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/30">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse mb-1.5" />
                  <div className="h-3 w-48 bg-zinc-800/60 rounded animate-pulse" />
                </div>
                <div className="h-5 w-16 bg-zinc-800 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const recentClaims = stats?.recentClaims || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen page-enter">
      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 rounded-lg flex items-center gap-3 border bg-red-500/10 border-red-500/30 text-red-400">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm flex-1 font-mono">{error}</span>
          <button
            onClick={fetchDashboardData}
            className="text-sm text-zinc-400 hover:text-orange-400 font-mono uppercase focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Payment Status Banner */}
      {paymentStatus && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center gap-3 border ${
            paymentStatus.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : paymentStatus.type === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
          }`}
        >
          {paymentStatus.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : paymentStatus.type === 'error' ? (
            <XCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />
          )}
          <span className="text-sm flex-1 font-mono">{paymentStatus.message}</span>
          <button
            onClick={() => setPaymentStatus(null)}
            className="text-zinc-500 hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
            aria-label="Dismiss payment status"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 sm:mb-8 animate-fade-in-up">
        <div className="flex items-center gap-3 sm:gap-4 mb-2">
          <img
            src={PAGE_ICONS.command_center}
            alt="Command Center"
            width={48}
            height={48}
            className="w-12 h-12 sm:w-16 sm:h-16 object-contain animate-glow-breathe glow-orange-lg"
          />
          <div>
            <h1 className="text-xl sm:text-3xl font-tactical font-bold text-white tracking-wide text-glow-orange">
              COMMAND CENTER
            </h1>
            <p className="text-zinc-400 font-mono text-xs sm:text-sm uppercase tracking-wider">
              Operational Overview // Real-time Status
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards (5 cards including Pipeline Value) */}
      <KpiCards stats={stats} onNavigate={navigate} />

      {/* Status Distribution Bar */}
      <div className="mb-6 sm:mb-8">
        <StatusDistribution claims={claims} />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* Recent Activity - Mission Log */}
        <div className="lg:col-span-2 card-tactical p-4 sm:p-5 animate-fade-in-left shadow-tactical">
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 animate-scale-pulse" />
              <h2 className="text-base sm:text-lg font-tactical font-bold text-white uppercase tracking-wide">
                Mission Log
              </h2>
            </div>
            <button
              onClick={() => navigate('/claims/new')}
              className="btn-tactical px-4 py-2 text-xs flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
              data-testid="dashboard-new-claim"
            >
              <Plus className="w-4 h-4" />
              <span>New Mission</span>
            </button>
          </div>

          {recentClaims.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800/50 flex items-center justify-center border border-zinc-700/50">
                <FolderOpen className="w-8 h-8 text-zinc-600" />
              </div>
              <p className="text-zinc-400 mb-4 font-mono text-sm">No active missions</p>
              <button
                onClick={() => navigate('/claims/new')}
                className="btn-tactical px-6 py-2.5 text-sm focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
              >
                Initialize First Mission
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="p-4 rounded-lg bg-zinc-800/30 border border-zinc-700/30 hover:border-orange-500/30 hover:bg-zinc-800/50 cursor-pointer transition-all duration-200 group hover-lift-sm focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                  onClick={() => navigate(`/claims/${claim.id}`)}
                  tabIndex={0}
                  data-testid={`recent-claim-${claim.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-tactical font-bold text-white text-sm">
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
                      <p className="text-sm text-zinc-300 font-medium mb-1 truncate">
                        {claim.client_name}
                      </p>
                      <p className="text-xs text-zinc-400 truncate font-mono">
                        {claim.property_address}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-tactical font-bold text-orange-400">
                        ${((claim.estimated_value || 0) / 1000).toFixed(0)}K
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono uppercase">
                        {claim.claim_type}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-orange-500 transition-colors flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => navigate('/claims')}
            className="w-full mt-4 py-3 rounded-lg border border-zinc-700/50 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 transition-all duration-200 font-tactical text-sm uppercase tracking-wider flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
            data-testid="view-all-claims"
          >
            View All Missions
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Right Column */}
        <div className="space-y-6 animate-fade-in-right">
          {/* Battle Pass Progress Widget */}
          {battlePassProgress && (
            <div
              className="card-tactical p-5 cursor-pointer hover:border-orange-500/30 transition-all shadow-tactical hover-lift-sm focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
              onClick={() => navigate('/battle-pass')}
              tabIndex={0}
              data-testid="battle-pass-widget"
            >
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-yellow-500 animate-float" />
                <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">
                  Battle Pass
                </h3>
              </div>
              <div className="flex items-center gap-4">
                <img
                  src={getTierBadge(battlePassProgress.current_tier || 1)}
                  alt="Current Tier"
                  width={64}
                  height={64}
                  className="w-16 h-16 object-contain drop-shadow-lg badge-icon animate-glow-breathe"
                />
                <div className="flex-1">
                  <p className="text-zinc-400 font-mono text-[10px] uppercase">
                    Tier {battlePassProgress.current_tier || 1}
                  </p>
                  <p className="text-lg font-tactical font-bold text-white">
                    {battlePassProgress.current_tier_info?.reward_name || 'Recruit'}
                  </p>
                  <div className="mt-2">
                    <div className="xp-bar h-2">
                      <div
                        className="xp-bar-fill h-full"
                        style={{ width: `${battlePassProgress.tier_progress_percent || 0}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1">
                        <img
                          src={UI_ICONS.xp_orb}
                          alt=""
                          width={12}
                          height={12}
                          className="w-3 h-3 object-contain animate-spin-slow"
                        />
                        <p className="text-[10px] font-mono text-orange-400">
                          {(battlePassProgress.current_xp || 0).toLocaleString()} XP
                        </p>
                      </div>
                      <p className="text-[10px] font-mono text-zinc-500">
                        Next: {(battlePassProgress.xp_needed_for_next || 1000).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ClaimPilot AI Insights */}
          <ClaimPilotWidget onNavigate={navigate} />

          {/* Intel Report */}
          <div className="card-tactical p-5 shadow-tactical">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-orange-500 animate-scale-pulse" />
              <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">
                Intel Report
              </h3>
            </div>
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-zinc-800/30 border-l-2 border-orange-500">
                <p className="text-[10px] font-mono text-zinc-400 uppercase mb-1">
                  Total Asset Value
                </p>
                <p className="text-2xl font-tactical font-bold text-white">
                  ${((stats?.totalValue || 0) / 1000000).toFixed(2)}M
                </p>
              </div>
              <div className="p-3 rounded-lg bg-zinc-800/30 border-l-2 border-blue-500">
                <p className="text-[10px] font-mono text-zinc-400 uppercase mb-1">Avg Processing</p>
                <p className="text-lg font-tactical text-zinc-300">
                  {stats?.avgProcessingTime || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Suggested Actions (replaces Quick Deploy) */}
          <SuggestedActions
            stalledCount={stats?.stalledCount || 0}
            pendingInspections={stats?.pendingInspections || 0}
            onNavigate={navigate}
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
