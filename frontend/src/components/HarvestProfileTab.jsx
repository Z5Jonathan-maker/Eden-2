import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import {
  RefreshCw,
  Award,
  Trophy,
  Flame,
  Star,
  Gift,
  Lock,
  ChevronRight,
  Crown,
  Sparkles,
  Gem,
  CheckCircle2,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { harvestService } from '../services/harvestService';
import StatCard from './harvest/StatCard';
import ProfileCard from './harvest/ProfileCard';
import RankBadge from './harvest/RankBadge';
import './harvest/HarvestAnimations.css';

const TIER_CONFIG = {
  legendary: {
    label: 'Legendary',
    icon: Crown,
    bgClass: 'bg-gradient-to-br from-amber-400 to-yellow-500',
    borderClass: 'border-amber-400 ring-2 ring-amber-400/40',
    glowClass: 'shadow-xl shadow-amber-500/30',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  epic: {
    label: 'Epic',
    icon: Gem,
    bgClass: 'bg-gradient-to-br from-purple-400 to-violet-500',
    borderClass: 'border-purple-400 ring-1 ring-purple-400/40',
    glowClass: 'shadow-lg shadow-purple-500/20',
    badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
  rare: {
    label: 'Rare',
    icon: Sparkles,
    bgClass: 'bg-gradient-to-br from-blue-400 to-cyan-500',
    borderClass: 'border-blue-400 ring-1 ring-blue-400/35',
    glowClass: 'shadow-md shadow-blue-500/20',
    badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  common: {
    label: 'Common',
    icon: Star,
    bgClass: 'bg-zinc-700',
    borderClass: 'border-zinc-600',
    glowClass: '',
    badgeBg: 'bg-zinc-700/60 text-zinc-300 border-zinc-600',
  },
};

const getStreakHeat = (days) => {
  if (days >= 30)
    return { label: 'On Fire', className: 'text-red-300 border-red-500/40 bg-red-500/20' };
  if (days >= 14)
    return { label: 'Hot', className: 'text-orange-300 border-orange-500/40 bg-orange-500/20' };
  if (days >= 7)
    return { label: 'Warm', className: 'text-amber-300 border-amber-500/40 bg-amber-500/20' };
  if (days >= 1)
    return { label: 'Active', className: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/20' };
  return { label: 'Cold', className: 'text-zinc-400 border-zinc-600 bg-zinc-700/50' };
};

const BadgeCard = ({ badge, onClick }) => {
  const tier = badge.tier || badge.rarity || 'common';
  const config = TIER_CONFIG[tier] || TIER_CONFIG.common;
  const isEarned = badge.earned;

  return (
    <button
      onClick={() => onClick(badge)}
      className={`relative rounded-2xl border p-4 transition-all duration-200 ${
        isEarned
          ? `${config.borderClass} ${config.glowClass} bg-zinc-900 hover:scale-105 active:scale-100`
          : 'border-zinc-700 bg-zinc-800/40 opacity-60 hover:opacity-80'
      }`}
      data-testid={`badge-${badge.id}`}
    >
      <div className="mx-auto">
        <RankBadge
          rank={badge.points || badge.criteria_value || 0}
          justRankedUp={false}
          label={config.label}
        />
      </div>
      <p
        className={`mt-3 truncate text-sm font-semibold ${isEarned ? 'text-zinc-100' : 'text-zinc-500'}`}
      >
        {badge.name}
      </p>
      {isEarned && (
        <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-zinc-900 bg-emerald-500 shadow-md">
          <CheckCircle2 className="h-4 w-4 text-white" />
        </div>
      )}
    </button>
  );
};

const BadgeModal = ({ badge, onClose }) => {
  if (!badge) return null;

  const tier = badge.tier || badge.rarity || 'common';
  const config = TIER_CONFIG[tier] || TIER_CONFIG.common;
  const TierIcon = config.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl border border-zinc-700/60 bg-zinc-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <Badge className={`${config.badgeBg} border px-4 py-1 text-sm font-bold`}>
            <TierIcon className="mr-1.5 h-4 w-4" />
            {config.label}
          </Badge>
        </div>

        <div
          className={`mx-auto mt-4 flex h-28 w-28 items-center justify-center rounded-2xl ${config.bgClass} ${config.glowClass}`}
        >
          <Award className="h-14 w-14 text-white" />
        </div>

        <div className="mt-5 text-center">
          <h3 className="harvest-h2 text-white">{badge.name}</h3>
          <p className="mt-2 text-zinc-400">{badge.description}</p>

          {badge.earned ? (
            <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="flex items-center justify-center gap-2 text-sm font-medium text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
                Earned{' '}
                {badge.earned_at ? new Date(badge.earned_at).toLocaleDateString() : 'recently'}
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-zinc-700/40 bg-zinc-800/60 p-4">
              <p className="flex items-center justify-center gap-2 text-sm text-zinc-300">
                <Lock className="h-4 w-4" />
                {badge.criteria_description || `${badge.criteria_type} >= ${badge.criteria_value}`}
              </p>
            </div>
          )}
        </div>

        <Button className="mt-5 w-full harvest-btn-secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
};

const LegacyStatCard = ({ value, label, tone }) => (
  <div className={`rounded-2xl border p-4 ${tone}`}>
    <p className="harvest-metric-value text-zinc-100">{value}</p>
    <p className="harvest-metric-label mt-1 text-zinc-400">{label}</p>
  </div>
);

const HarvestProfileTab = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);

  const [stats, setStats] = useState({
    total_doors: 0,
    total_appointments: 0,
    total_contracts: 0,
    best_streak: 0,
  });
  const [badgesByTier, setBadgesByTier] = useState({
    legendary: [],
    epic: [],
    rare: [],
    common: [],
  });
  const [badgeCounts, setBadgeCounts] = useState({ earned: 0, total: 0 });
  const [rewardsProgress, setRewardsProgress] = useState([]);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [streakData, setStreakData] = useState({
    current_streak: 0,
    best_streak: 0,
    multiplier: 1.0,
    is_at_risk: false,
  });

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);

    try {
      const [badgesData, streakDataResponse, rewardsData, statsData] = await Promise.all([
        harvestService.getBadgesByTier(),
        harvestService.getStreak(),
        harvestService.getRewardProgress(),
        harvestService.getCanvassingStats(),
      ]);
      setBadgesByTier(badgesData.badges_by_tier || {});
      setBadgeCounts({ earned: badgesData.earned_count || 0, total: badgesData.total_count || 0 });
      setStreakData(streakDataResponse);
      setStats((prev) => ({ ...prev, best_streak: streakDataResponse.best_streak || 0 }));
      setRewardsProgress(rewardsData.rewards_progress || []);
      setCurrentPoints(rewardsData.current_points || 0);
      setStats((prev) => ({
        ...prev,
        total_doors: statsData.week || 0,
        total_appointments: statsData.appointments || 0,
        total_contracts: statsData.signed || 0,
        total_points: statsData.total_points || 0,
      }));
    } catch (err) {
      console.error('Failed to fetch profile data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const displayBadges = useMemo(() => {
    if (selectedTier) return badgesByTier[selectedTier] || [];
    return [
      ...(badgesByTier.legendary || []),
      ...(badgesByTier.epic || []),
      ...(badgesByTier.rare || []),
      ...(badgesByTier.common || []),
    ];
  }, [badgesByTier, selectedTier]);

  const streakHeat = getStreakHeat(streakData.current_streak || 0);
  const nextReward = rewardsProgress[0];

  const coachPulse = useMemo(() => {
    if (streakData.is_at_risk)
      return 'Streak risk detected. Log activity before day end to protect your multiplier.';
    if (nextReward && !nextReward.can_redeem)
      return `${nextReward.points_remaining} points to unlock ${nextReward.name}.`;
    if (nextReward && nextReward.can_redeem)
      return `${nextReward.name} is ready. Submit redemption from Rewards.`;
    return 'Profile is stable. Keep daily consistency to climb rarity tiers.';
  }, [streakData.is_at_risk, nextReward]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center bg-zinc-900">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="harvest-content overflow-y-auto bg-zinc-900">
      <div className="border-b border-zinc-700/50 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 px-5 pb-8 pt-6 text-white">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-lg font-bold">Profile</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="rounded-full text-zinc-300 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/20 text-5xl shadow-xl">
            <Flame className="h-10 w-10 text-orange-300" />
          </div>
          <div>
            <p className="text-sm uppercase tracking-wide text-zinc-400">Total Points</p>
            <p className="harvest-display text-white">{currentPoints}</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge className={`border ${streakHeat.className}`}>
                <Flame className="mr-1 h-3 w-3" />
                {streakData.current_streak}d � {streakHeat.label}
              </Badge>
              {streakData.multiplier > 1 && (
                <Badge className="border border-orange-500/40 bg-orange-500/20 text-orange-300">
                  <Zap className="mr-1 h-3 w-3" />
                  {streakData.multiplier}x
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="-mt-4 space-y-4 p-4">
        <ProfileCard
          currentPoints={currentPoints}
          streakData={streakData}
          stats={stats}
          nextReward={nextReward}
        />

        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3">
          <p className="text-xs font-mono uppercase tracking-wider text-orange-300">
            Harvest Coach
          </p>
          <p className="mt-1 text-sm text-zinc-300">{coachPulse}</p>
        </div>

        <div className="harvest-card harvest-animate-in border border-zinc-700/40 bg-zinc-800/30">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-zinc-100">This Week</h3>
            <TrendingUp className="h-5 w-5 text-zinc-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              value={stats.total_doors}
              label="Doors"
              tone="border-blue-500/30 bg-blue-500/10"
            />
            <StatCard
              value={stats.total_appointments}
              label="Appointments"
              tone="border-emerald-500/30 bg-emerald-500/10"
            />
            <StatCard
              value={stats.total_contracts}
              label="Contracts"
              tone="border-purple-500/30 bg-purple-500/10"
            />
            <StatCard
              value={streakData.best_streak}
              label="Best Streak"
              tone="border-amber-500/30 bg-amber-500/10"
            />
          </div>
        </div>

        <div className="harvest-card harvest-animate-in harvest-animate-in-delay-1 border border-zinc-700/40 bg-zinc-800/30">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-orange-400" />
              <h3 className="font-bold text-zinc-100">
                Badges ({badgeCounts.earned}/{badgeCounts.total})
              </h3>
            </div>
            <ChevronRight className="h-5 w-5 text-zinc-500" />
          </div>

          <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-2">
            <Button
              size="sm"
              className={`shrink-0 rounded-full ${selectedTier === null ? 'harvest-btn-primary' : 'harvest-btn-secondary'}`}
              onClick={() => setSelectedTier(null)}
            >
              All
            </Button>
            {Object.entries(TIER_CONFIG).map(([tier, config]) => {
              const TierIcon = config.icon;
              const count = (badgesByTier[tier] || []).filter((b) => b.earned).length;
              const total = (badgesByTier[tier] || []).length;
              return (
                <Button
                  key={tier}
                  size="sm"
                  className={`shrink-0 rounded-full ${
                    selectedTier === tier
                      ? `${config.bgClass} border-0 text-white`
                      : 'harvest-btn-secondary'
                  }`}
                  onClick={() => setSelectedTier(tier)}
                >
                  <TierIcon className="mr-1.5 h-3 w-3" />
                  {config.label} ({count}/{total})
                </Button>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {displayBadges.slice(0, 9).map((badge) => (
              <BadgeCard key={badge.id} badge={badge} onClick={setSelectedBadge} />
            ))}
          </div>

          {displayBadges.length === 0 && (
            <div className="py-8 text-center">
              <Award className="mx-auto mb-3 h-12 w-12 text-zinc-600" />
              <p className="font-medium text-zinc-400">No badges in this category</p>
            </div>
          )}

          {displayBadges.length > 9 && (
            <Button
              variant="outline"
              className="mt-4 w-full rounded-full border-zinc-700/50 text-zinc-300 hover:bg-zinc-800"
            >
              View All {displayBadges.length} Badges
            </Button>
          )}
        </div>

        <div className="harvest-card harvest-animate-in harvest-animate-in-delay-2 border border-zinc-700/40 bg-zinc-800/30">
          <div className="mb-4 flex items-center gap-2">
            <Gift className="h-5 w-5 text-purple-300" />
            <h3 className="font-bold text-zinc-100">Rewards Progress</h3>
          </div>

          <div className="space-y-3">
            {rewardsProgress.length > 0 ? (
              rewardsProgress.slice(0, 3).map((reward) => (
                <div
                  key={reward.reward_id}
                  className={`rounded-xl border p-4 transition-all ${
                    reward.can_redeem
                      ? 'border-emerald-500/40 bg-emerald-500/10 ring-1 ring-emerald-500/30'
                      : 'border-zinc-700/50 bg-zinc-900/40'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {reward.image_url ? (
                        <img src={reward.image_url} alt="" className="h-10 w-10 rounded-lg" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                          <Trophy className="h-5 w-5 text-purple-300" />
                        </div>
                      )}
                      <span className="font-semibold text-zinc-100">{reward.name}</span>
                    </div>
                    <span className="text-sm font-bold text-purple-300">
                      {reward.points_required} pts
                    </span>
                  </div>
                  <Progress value={reward.percent_complete} className="h-2" />
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-zinc-500">{reward.percent_complete}%</span>
                    {reward.can_redeem ? (
                      <span className="font-semibold text-emerald-300">Ready to redeem</span>
                    ) : (
                      <span className="text-zinc-500">{reward.points_remaining} pts to go</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center">
                <Gift className="mx-auto mb-3 h-12 w-12 text-zinc-600" />
                <p className="font-medium text-zinc-400">No rewards available</p>
                <p className="mt-1 text-sm text-zinc-500">Check back soon.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <BadgeModal badge={selectedBadge} onClose={() => setSelectedBadge(null)} />
    </div>
  );
};

export default HarvestProfileTab;
