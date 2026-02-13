import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import {
  FolderOpen,
  Clock,
  CheckCircle2,
  Camera,
  TrendingUp,
  ArrowRight,
  Plus,
  Loader2,
  CheckCircle,
  XCircle,
  Target,
  Activity,
  Zap,
  Shield,
  ChevronRight,
  AlertTriangle,
  Trophy,
} from 'lucide-react';
import { getTierBadge, UI_ICONS, PAGE_ICONS } from '../assets/badges';

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [battlePassProgress, setBattlePassProgress] = useState(null);

  // Fetch Battle Pass progress
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
        let attempts = 0;
        const maxAttempts = 5;
        const pollInterval = 2000;

        const pollStatus = async () => {
          if (attempts >= maxAttempts) {
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
            setTimeout(pollStatus, pollInterval);
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

  useEffect(() => {
    fetchDashboardData();
    fetchBattlePassProgress();
    checkPaymentStatus();
  }, [checkPaymentStatus, fetchBattlePassProgress]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await apiGet('/api/claims/');

      if (!res.ok) {
        throw new Error(res.error || 'Failed to fetch claims');
      }

      const claims = res.data || [];
      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();

      const dashboardStats = {
        totalClaims: claims.length,
        activeClaims: claims.filter((c) => !['Completed', 'Closed'].includes(c.status)).length,
        completedThisMonth: claims.filter((c) => {
          const createdAt = new Date(c.created_at);
          return (
            c.status === 'Completed' &&
            createdAt.getMonth() === thisMonth &&
            createdAt.getFullYear() === thisYear
          );
        }).length,
        pendingInspections: claims.filter((c) => c.status === 'Under Review').length,
        totalValue: claims.reduce((sum, c) => sum + (c.estimated_value || 0), 0),
        avgProcessingTime: '12 days', // Would need more data to calculate
        recentClaims: claims.slice(0, 4),
      };

      setStats(dashboardStats);
      setError('');
    } catch (err) {
      setError(err.message);
      setStats({
        totalClaims: 0,
        activeClaims: 0,
        completedThisMonth: 0,
        pendingInspections: 0,
        totalValue: 0,
        recentClaims: [],
      });
    } finally {
      setLoading(false);
    }
  };

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
      <div className="p-8 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-tactical w-12 h-12 mx-auto mb-4" />
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">
            Initializing Command Center...
          </p>
        </div>
      </div>
    );
  }

  const recentClaims = stats?.recentClaims || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen page-enter">
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
            className="text-zinc-500 hover:text-zinc-300"
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
            className="w-12 h-12 sm:w-16 sm:h-16 object-contain animate-glow-breathe"
            style={{ filter: 'drop-shadow(0 0 15px rgba(249, 115, 22, 0.5))' }}
          />
          <div>
            <h1 className="text-xl sm:text-3xl font-tactical font-bold text-white tracking-wide text-glow-orange">
              COMMAND CENTER
            </h1>
            <p className="text-zinc-500 font-mono text-xs sm:text-sm uppercase tracking-wider">
              Operational Overview // Real-time Status
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid - HUD Style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8 stagger-children">
        {/* Total Claims */}
        <div
          className="card-tactical card-tactical-hover p-3 sm:p-5 group cursor-pointer shadow-tactical hover-lift-sm"
          onClick={() => navigate('/claims')}
          data-testid="stat-total-claims"
        >
          <div className="flex items-start justify-between mb-2 sm:mb-3">
            <div className="p-1.5 sm:p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 group-hover:border-blue-500/40 transition-colors">
              <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 group-hover:animate-bounce-gentle" />
            </div>
            <span className="text-[9px] sm:text-[10px] font-mono text-zinc-600 uppercase">
              Total
            </span>
          </div>
          <p
            className="text-2xl sm:text-4xl font-tactical font-bold text-white mb-1 stat-glow"
            style={{ color: '#60a5fa' }}
          >
            {stats?.totalClaims || 0}
          </p>
          <p className="text-[10px] sm:text-xs font-mono text-zinc-500 uppercase tracking-wider">
            Claims Tracked
          </p>
        </div>

        {/* Active Claims */}
        <div
          className="card-tactical card-tactical-hover p-3 sm:p-5 group cursor-pointer shadow-tactical hover-lift-sm"
          onClick={() => navigate('/claims')}
          data-testid="stat-active-claims"
        >
          <div className="flex items-start justify-between mb-2 sm:mb-3">
            <div className="p-1.5 sm:p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 group-hover:border-orange-500/40 transition-colors">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400 group-hover:animate-bounce-gentle" />
            </div>
            <span className="text-[9px] sm:text-[10px] font-mono text-zinc-600 uppercase">
              Active
            </span>
          </div>
          <p className="text-2xl sm:text-4xl font-tactical font-bold text-orange-400 mb-1">
            {stats?.activeClaims || 0}
          </p>
          <p className="text-[10px] sm:text-xs font-mono text-zinc-500 uppercase tracking-wider">
            In Progress
          </p>
        </div>

        {/* Completed */}
        <div
          className="card-tactical card-tactical-hover p-3 sm:p-5 group cursor-pointer shadow-tactical hover-lift-sm"
          data-testid="stat-completed"
        >
          <div className="flex items-start justify-between mb-2 sm:mb-3">
            <div className="p-1.5 sm:p-2.5 rounded-lg bg-green-500/10 border border-green-500/20 group-hover:border-green-500/40 transition-colors">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 group-hover:animate-bounce-gentle" />
            </div>
            <span className="text-[9px] sm:text-[10px] font-mono text-zinc-600 uppercase">
              Done
            </span>
          </div>
          <p className="text-2xl sm:text-4xl font-tactical font-bold text-green-400 mb-1">
            {stats?.completedThisMonth || 0}
          </p>
          <p className="text-[10px] sm:text-xs font-mono text-zinc-500 uppercase tracking-wider">
            This Month
          </p>
        </div>

        {/* Inspections */}
        <div
          className="card-tactical card-tactical-hover p-3 sm:p-5 group cursor-pointer shadow-tactical hover-lift-sm"
          onClick={() => navigate('/inspections')}
          data-testid="stat-inspections"
        >
          <div className="flex items-start justify-between mb-2 sm:mb-3">
            <div className="p-1.5 sm:p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 group-hover:border-purple-500/40 transition-colors">
              <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 group-hover:animate-bounce-gentle" />
            </div>
            <span className="text-[9px] sm:text-[10px] font-mono text-zinc-600 uppercase">
              Recon
            </span>
          </div>
          <p className="text-2xl sm:text-4xl font-tactical font-bold text-purple-400 mb-1">
            {stats?.pendingInspections || 0}
          </p>
          <p className="text-[10px] sm:text-xs font-mono text-zinc-500 uppercase tracking-wider">
            Pending
          </p>
        </div>
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
              className="btn-tactical px-4 py-2 text-xs flex items-center gap-2"
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
              <p className="text-zinc-500 mb-4 font-mono text-sm">No active missions</p>
              <button
                onClick={() => navigate('/claims/new')}
                className="btn-tactical px-6 py-2.5 text-sm"
              >
                Initialize First Mission
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentClaims.map((claim, index) => (
                <div
                  key={claim.id}
                  className="p-4 rounded-lg bg-zinc-800/30 border border-zinc-700/30 hover:border-orange-500/30 hover:bg-zinc-800/50 cursor-pointer transition-all duration-200 group hover-lift-sm"
                  onClick={() => navigate(`/claims/${claim.id}`)}
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
                      <p className="text-xs text-zinc-500 truncate font-mono">
                        {claim.property_address}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-tactical font-bold text-orange-400">
                        ${((claim.estimated_value || 0) / 1000).toFixed(0)}K
                      </p>
                      <p className="text-[10px] text-zinc-600 font-mono uppercase">
                        {claim.claim_type}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-orange-500 transition-colors flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => navigate('/claims')}
            className="w-full mt-4 py-3 rounded-lg border border-zinc-700/50 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 transition-all duration-200 font-tactical text-sm uppercase tracking-wider flex items-center justify-center gap-2"
            data-testid="view-all-claims"
          >
            View All Missions
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Side Stats Panel */}
        <div className="space-y-6 animate-fade-in-right">
          {/* Battle Pass Progress Widget */}
          {battlePassProgress && (
            <div
              className="card-tactical p-5 cursor-pointer hover:border-orange-500/30 transition-all shadow-tactical hover-lift-sm"
              onClick={() => navigate('/battle-pass')}
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
                  className="w-16 h-16 object-contain drop-shadow-lg badge-icon animate-glow-breathe"
                />
                <div className="flex-1">
                  <p className="text-zinc-500 font-mono text-[10px] uppercase">
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
                          className="w-3 h-3 object-contain animate-spin-slow"
                        />
                        <p className="text-[10px] font-mono text-orange-400">
                          {(battlePassProgress.current_xp || 0).toLocaleString()} XP
                        </p>
                      </div>
                      <p className="text-[10px] font-mono text-zinc-600">
                        Next: {(battlePassProgress.xp_needed_for_next || 1000).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Value Stats */}
          <div className="card-tactical p-5 shadow-tactical">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-orange-500 animate-scale-pulse" />
              <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">
                Intel Report
              </h3>
            </div>
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-zinc-800/30 border-l-2 border-orange-500">
                <p className="text-[10px] font-mono text-zinc-500 uppercase mb-1">
                  Total Asset Value
                </p>
                <p className="text-2xl font-tactical font-bold text-white">
                  ${((stats?.totalValue || 0) / 1000000).toFixed(2)}M
                </p>
              </div>
              <div className="p-3 rounded-lg bg-zinc-800/30 border-l-2 border-blue-500">
                <p className="text-[10px] font-mono text-zinc-500 uppercase mb-1">Avg Processing</p>
                <p className="text-lg font-tactical text-zinc-300">
                  {stats?.avgProcessingTime || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card-tactical p-5 shadow-tactical">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-orange-500 animate-bounce-gentle" />
              <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">
                Quick Deploy
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate('/inspections')}
                className="p-4 rounded-lg bg-zinc-800/30 border border-zinc-700/30 hover:border-orange-500/30 hover:bg-zinc-800/50 transition-all duration-200 group hover-lift-sm shadow-tactical"
                data-testid="quick-action-inspection"
              >
                <Camera className="w-6 h-6 text-zinc-500 group-hover:text-orange-400 mx-auto mb-2 transition-colors group-hover:animate-bounce-gentle" />
                <p className="text-xs font-mono text-zinc-500 group-hover:text-zinc-300 uppercase">
                  Recon
                </p>
              </button>
              <button
                onClick={() => navigate('/eve')}
                className="p-4 rounded-lg bg-zinc-800/30 border border-zinc-700/30 hover:border-orange-500/30 hover:bg-zinc-800/50 transition-all duration-200 group hover-lift-sm shadow-tactical"
                data-testid="quick-action-ai"
              >
                <Zap className="w-6 h-6 text-zinc-500 group-hover:text-orange-400 mx-auto mb-2 transition-colors group-hover:animate-wiggle" />
                <p className="text-xs font-mono text-zinc-500 group-hover:text-zinc-300 uppercase">
                  Eve AI
                </p>
              </button>
              <button
                onClick={() => navigate('/contracts')}
                className="p-4 rounded-lg bg-zinc-800/30 border border-zinc-700/30 hover:border-orange-500/30 hover:bg-zinc-800/50 transition-all duration-200 group hover-lift-sm shadow-tactical"
                data-testid="quick-action-contracts"
              >
                <FolderOpen className="w-6 h-6 text-zinc-500 group-hover:text-orange-400 mx-auto mb-2 transition-colors group-hover:animate-bounce-gentle" />
                <p className="text-xs font-mono text-zinc-500 group-hover:text-zinc-300 uppercase">
                  Contracts
                </p>
              </button>
              <button
                onClick={() => navigate('/documents')}
                className="p-4 rounded-lg bg-zinc-800/30 border border-zinc-700/30 hover:border-orange-500/30 hover:bg-zinc-800/50 transition-all duration-200 group hover-lift-sm shadow-tactical"
                data-testid="quick-action-documents"
              >
                <FolderOpen className="w-6 h-6 text-zinc-500 group-hover:text-orange-400 mx-auto mb-2 transition-colors group-hover:animate-bounce-gentle" />
                <p className="text-xs font-mono text-zinc-500 group-hover:text-zinc-300 uppercase">
                  Docs
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
