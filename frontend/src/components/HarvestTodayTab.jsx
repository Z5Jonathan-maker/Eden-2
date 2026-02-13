/**
 * HarvestTodayTab - Enzy-Style Daily Overview with Premium Gamification
 *
 * "Athletic Luxury" theme with animated progress ring, streak indicators,
 * and competition cards. Mobile-first design with smooth animations.
 *
 * Features:
 * - Animated circular progress ring for daily goal
 * - Streak flame with multiplier badges
 * - Active Competitions section (Incentives Engine)
 * - Mission of the Day card
 * - Today's Challenges section
 * - Next Reward progress bar
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import {
  Flame,
  RefreshCw,
  Target,
  Gift,
  Trophy,
  Zap,
  Clock,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Award,
  Crown,
  Users,
  Sun,
  CloudSun,
  Sparkles,
} from 'lucide-react';
import { harvestService } from '../services/harvestService';
import StatCard from './harvest/StatCard';
import HarvestChallengeCard from './harvest/ChallengeCard';
import './harvest/HarvestAnimations.css';

const toFiniteNumber = (value, fallback = 0) => {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const clampPercent = (value) => Math.min(Math.max(toFiniteNumber(value, 0), 0), 100);

// Enzy-Style Progress Ring Component - Tactical Theme
const ProgressRing = ({ progress, size = 180, strokeWidth = 14, children }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#27272a"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle with gradient */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#tactical-progress-gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="harvest-progress-ring"
        />
        <defs>
          <linearGradient id="tactical-progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#EA580C" />
            <stop offset="50%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#FB923C" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
};

// Tactical Streak Banner Component
const StreakBanner = ({ streak, isAtRisk, isCritical, multiplier, doorsToday }) => {
  const getStreakEmoji = () => {
    if (streak >= 30) return '💎';
    if (streak >= 14) return '🔥';
    if (streak >= 7) return '⚡';
    if (streak > 0) return '🔥';
    return '❄️';
  };

  const getBgGradient = () => {
    if (isCritical) return 'from-red-600/80 to-rose-700/80';
    if (isAtRisk) return 'from-amber-600/80 to-orange-600/80';
    if (streak >= 14) return 'from-orange-600/80 via-red-600/80 to-pink-600/80';
    if (streak > 0) return 'from-orange-600/80 to-red-600/80';
    return 'from-zinc-700/80 to-zinc-800/80';
  };

  const streakGoal = 10;
  const doorsRemaining = Math.max(streakGoal - (doorsToday || 0), 0);

  return (
    <div
      className={`rounded-xl p-5 bg-gradient-to-r ${getBgGradient()} text-white harvest-animate-in border border-zinc-700/30`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className={`text-4xl ${streak > 0 ? 'harvest-flame' : ''}`}>
            {getStreakEmoji()}
          </span>
          <div>
            <p className="text-white/80 text-sm font-medium">
              {isCritical ? '⚠️ CRITICAL' : isAtRisk ? '⏰ AT RISK' : 'Current Streak'}
            </p>
            <p className="text-3xl font-bold">
              {streak} <span className="text-lg font-normal">{streak === 1 ? 'day' : 'days'}</span>
            </p>
          </div>
        </div>
        {multiplier > 1 && (
          <div className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5">
            <span className="text-sm font-bold">{multiplier}x</span>
            <span className="text-xs ml-1">multiplier</span>
          </div>
        )}
      </div>

      {doorsRemaining > 0 && (
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-white/80">
              {doorsRemaining} doors to {streak > 0 ? 'keep streak' : 'start streak'}
            </span>
            <span className="font-semibold">
              {doorsToday || 0}/{streakGoal}
            </span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${Math.min(((doorsToday || 0) / streakGoal) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Competition Card Component
const CompetitionCard = ({ competition }) => {
  const progress = clampPercent(competition?.my_progress?.progress_percent);

  return (
    <div
      className="card-tactical harvest-bp-card harvest-grid-overlay overflow-hidden harvest-animate-in"
      style={{ borderLeftWidth: '4px', borderLeftColor: competition.banner_color || '#EA580C' }}
    >
      <div className="flex items-start justify-between mb-3 p-4 pb-0">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{competition.icon || '🏆'}</span>
          <div>
            <h4 className="font-tactical font-bold text-white">{competition.name}</h4>
            <p className="text-sm text-zinc-500 font-mono">{competition.tagline}</p>
          </div>
        </div>
        <span className="px-2 py-1 rounded bg-blue-500/20 border border-blue-500/30 text-blue-400 font-mono text-xs flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {competition.time_remaining}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-3 px-4">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-zinc-500 font-mono">
            {competition.my_progress?.current_value || 0} /{' '}
            {competition.my_progress?.target_value || '?'} {competition.metric?.unit}
          </span>
          <span
            className="font-tactical font-bold"
            style={{ color: competition.banner_color || '#EA580C' }}
          >
            {toFiniteNumber(progress).toFixed(0)}%
          </span>
        </div>
        <Progress value={progress} className="h-2.5 bg-zinc-800/50" />
      </div>

      {/* Rank & Leader */}
      <div className="flex items-center justify-between text-sm p-4 pt-3 border-t border-zinc-700/30">
        <div className="flex items-center gap-1.5">
          {competition.my_progress?.rank <= 3 ? (
            <Crown
              className={`w-4 h-4 ${
                competition.my_progress?.rank === 1
                  ? 'text-amber-500'
                  : competition.my_progress?.rank === 2
                    ? 'text-zinc-400'
                    : 'text-orange-500'
              }`}
            />
          ) : (
            <Users className="w-4 h-4 text-zinc-500" />
          )}
          <span className="text-zinc-400 font-mono">
            Your Rank:{' '}
            <span className="font-tactical font-bold text-white">
              #{competition.my_progress?.rank || '-'}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-500 font-mono">
          <Crown className="w-4 h-4 text-amber-500" />
          <span>
            {competition.leader?.name} ({competition.leader?.value})
          </span>
        </div>
      </div>

      {/* Gap to qualify */}
      {competition.my_progress?.target_value &&
        competition.my_progress?.current_value < competition.my_progress?.target_value && (
          <p className="text-sm text-orange-400 px-4 pb-4 font-tactical font-medium flex items-center gap-1">
            <Target className="w-4 h-4" />
            {competition.my_progress.target_value - competition.my_progress.current_value} more to
            qualify!
          </p>
        )}
    </div>
  );
};

// Incentives Releases Panel
const IncentivesPanel = ({ data }) => {
  const { loading, error, season, phase, drops } = data || {};
  const featured = (drops || []).find((d) => d.featured) || (drops || [])[0];
  const progress = clampPercent(featured?.progress_percent);
  const isEligible = featured?.eligible;
  const missing = featured?.missing || [];

  return (
    <div className="card-tactical harvest-bp-card harvest-grid-overlay border border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-zinc-900/60 to-zinc-900/60 harvest-animate-in harvest-animate-in-delay-3 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-orange-400" />
          <h3 className="font-tactical font-bold text-white uppercase tracking-wide">
            Incentives Releases
          </h3>
        </div>
        {season?.name && (
          <span className="px-2 py-1 rounded bg-zinc-800/50 border border-zinc-700/30 text-zinc-300 font-mono text-xs">
            {phase ? phase.toUpperCase() : 'SEASON'} · {season.name}
          </span>
        )}
      </div>

      {loading && <div className="text-sm text-zinc-500 font-mono">Loading incentives...</div>}

      {!loading && error && <div className="text-sm text-orange-300 font-mono">{error}</div>}

      {!loading && !error && !featured && (
        <div className="text-center py-6">
          <div className="w-14 h-14 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-3 border border-zinc-700/30">
            <Sparkles className="w-7 h-7 text-zinc-600" />
          </div>
          <p className="font-tactical font-semibold text-zinc-300">No Active Drops</p>
          <p className="text-sm text-zinc-500 font-mono mt-1">Check back for the next release.</p>
        </div>
      )}

      {!loading && !error && featured && (
        <>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-zinc-800/60 border border-zinc-700/40 overflow-hidden flex items-center justify-center">
              {featured.image_url ? (
                <img
                  src={featured.image_url}
                  alt={featured.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Gift className="w-7 h-7 text-orange-400" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-tactical font-semibold text-white">{featured.name}</p>
                <span
                  className={`px-2 py-1 rounded text-xs font-mono border ${isEligible ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-zinc-800/60 text-zinc-300 border-zinc-700/40'}`}
                >
                  {isEligible ? 'UNLOCKED' : 'LOCKED'}
                </span>
              </div>
              <p className="text-sm text-zinc-500 font-mono">{featured.description}</p>
              {featured.next_target && !isEligible && (
                <p className="text-sm text-orange-400 font-tactical mt-1 flex items-center gap-1">
                  <Target className="w-4 h-4" />
                  {featured.next_target}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-zinc-500 font-mono">Progress</span>
              <span className="font-tactical font-bold text-orange-400">
                {toFiniteNumber(progress).toFixed(0)}%
              </span>
            </div>
            <Progress value={progress} className="h-2 bg-zinc-800/50" />
          </div>

          {missing.length > 0 && (
            <div className="mt-3 space-y-1 text-xs text-zinc-500 font-mono">
              {missing.slice(0, 2).map((req, idx) => (
                <div key={`${req.type}-${idx}`} className="flex items-center justify-between">
                  <span>{req.detail}</span>
                  <span>
                    {req.current} / {req.target}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Challenge Card Component - Tactical Theme
const LegacyChallengeCard = ({ challenge, onClaim }) => {
  const requirementValue = toFiniteNumber(challenge?.requirement_value, 0);
  const currentProgress = toFiniteNumber(challenge?.current_progress, 0);
  const progress =
    requirementValue > 0 ? clampPercent((currentProgress / requirementValue) * 100) : 0;
  const isCompleted = challenge.state === 'completed';
  const isClaimed = challenge.state === 'claimed';

  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        isCompleted
          ? 'bg-green-500/10 border-green-500/30'
          : isClaimed
            ? 'bg-zinc-800/30 border-zinc-700/30 opacity-60'
            : 'bg-zinc-800/30 border-zinc-700/30 hover:border-orange-500/30'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{challenge.icon || '🎯'}</span>
          <div>
            <p className="font-tactical font-semibold text-white">{challenge.name}</p>
            <p className="text-sm text-zinc-500 font-mono">{challenge.description}</p>
          </div>
        </div>
        {challenge.time_remaining_display && !isClaimed && (
          <span className="px-2 py-1 rounded bg-zinc-800/50 border border-zinc-700/30 text-[10px] font-mono text-zinc-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {challenge.time_remaining_display}
          </span>
        )}
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-zinc-500 font-mono">
            {challenge.current_progress}/{challenge.requirement_value}
          </span>
          <span className="font-tactical font-semibold text-orange-400">
            +{challenge.points_reward} pts
          </span>
        </div>
        <Progress
          value={progress}
          className={`h-2 ${isCompleted ? 'bg-green-500/20' : 'bg-zinc-800/50'}`}
        />
      </div>

      {isCompleted && !isClaimed && (
        <Button
          size="sm"
          className="w-full mt-3 bg-green-600 hover:bg-green-700 rounded-lg font-mono uppercase"
          onClick={() => onClaim(challenge.id)}
        >
          <CheckCircle2 className="w-4 h-4 mr-1" />
          Claim Reward
        </Button>
      )}
    </div>
  );
};

// Main Component
const HarvestTodayTab = ({ dailyGoal = 75 }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [stats, setStats] = useState({
    doors_today: 0,
    appointments_today: 0,
    signed_today: 0,
    points_today: 0,
  });
  const [streakData, setStreakData] = useState({
    current_streak: 0,
    multiplier: 1.0,
    is_at_risk: false,
    is_critical: false,
    doors_today: 0,
  });
  const [challenges, setChallenges] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [rewardProgress, setRewardProgress] = useState(null);
  const [activeCompetitions, setActiveCompetitions] = useState([]);
  const [incentives, setIncentives] = useState({
    loading: true,
    error: null,
    season: null,
    phase: null,
    drops: [],
  });

  // Fetch all data
  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);

    try {
      const [
        todayData,
        streakDataResponse,
        challengesData,
        campaignsData,
        rewardsData,
        competitionsData,
        incentivesActiveData,
        incentivesProgressData,
      ] = await Promise.all([
        harvestService.getToday(),
        harvestService.getStreak(),
        harvestService.getChallenges(),
        harvestService.getCampaigns(),
        harvestService.getRewardProgress(),
        harvestService.getCompetitionDashboard(),
        harvestService.getIncentivesActive(),
        harvestService.getIncentivesProgress(),
      ]);

      setStats({
        doors_today: todayData.doors_knocked || 0,
        appointments_today: todayData.appointments_set || 0,
        signed_today: todayData.signed_contracts || 0,
        points_today: todayData.total_points || 0,
      });
      if (todayData.streak_days !== undefined) {
        setStreakData((prev) => ({
          ...prev,
          current_streak: todayData.streak_days,
          doors_today: todayData.doors_knocked || 0,
        }));
      }

      setStreakData((prev) => ({
        ...streakDataResponse,
        doors_today: prev.doors_today || streakDataResponse.doors_today || 0,
      }));

      setChallenges(challengesData.challenges || []);
      setCampaigns(
        (campaignsData.campaigns || []).filter((c) => c.status === 'active').slice(0, 2)
      );
      setRewardProgress(rewardsData);
      setActiveCompetitions(competitionsData.active_competitions || []);

      // Incentives Releases (Harvest drops)
      let incentivesError = null;
      let incentivesSeason = null;
      let incentivesPhase = null;
      let incentivesDrops = [];

      incentivesSeason = incentivesProgressData.season || null;
      incentivesPhase = incentivesProgressData.phase || null;
      incentivesDrops = incentivesProgressData.drops_progress || [];
      incentivesSeason = incentivesActiveData.season || incentivesSeason;
      incentivesPhase = incentivesActiveData.phase || incentivesPhase;

      setIncentives({
        loading: false,
        error: incentivesError,
        season: incentivesSeason,
        phase: incentivesPhase,
        drops: incentivesDrops,
      });
    } catch (err) {
      console.error('Failed to fetch today data:', err);
      setIncentives((prev) => ({ ...prev, loading: false, error: 'Incentives fetch failed' }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Claim challenge reward
  const claimChallenge = async (challengeId) => {
    try {
      await harvestService.claimChallenge(challengeId);
      fetchData();
    } catch (err) {
      console.error('Failed to claim challenge:', err);
    }
  };

  const doorsProgress = Math.min((stats.doors_today / dailyGoal) * 100, 100);
  const greeting =
    new Date().getHours() < 12
      ? 'Good Morning'
      : new Date().getHours() < 17
        ? 'Good Afternoon'
        : 'Good Evening';
  const coachPulse = streakData.is_critical
    ? `Critical streak risk. Log ${Math.max(10 - (stats.doors_today || 0), 0)} more doors now.`
    : streakData.is_at_risk
      ? `Streak at risk. ${Math.max(10 - (stats.doors_today || 0), 0)} doors keeps momentum alive.`
      : rewardProgress?.next_reward?.points_remaining > 0
        ? `${rewardProgress.next_reward.points_remaining} points to unlock ${rewardProgress.next_reward.name}.`
        : 'Strong pace. Keep stacking doors to secure rank movement today.';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-zinc-900">
        <div className="spinner-tactical w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="overflow-y-auto harvest-content bg-zinc-900">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-700/50 px-5 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-500 font-mono flex items-center gap-1.5 uppercase">
              <Sun className="w-4 h-4 text-amber-500" />
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </p>
            <h1 className="text-2xl font-tactical font-bold text-white mt-0.5 uppercase tracking-wide">
              {greeting}
            </h1>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-lg border border-zinc-700/30 hover:border-orange-500/30 text-zinc-400 hover:text-orange-400 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Streak Banner */}
        <StreakBanner
          streak={streakData.current_streak}
          isAtRisk={streakData.is_at_risk}
          isCritical={streakData.is_critical}
          multiplier={streakData.multiplier}
          doorsToday={stats.doors_today}
        />

        {/* Coach Pulse */}
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 harvest-animate-in harvest-animate-in-delay-1">
          <p className="text-xs font-mono uppercase tracking-wider text-orange-300">
            Harvest Coach
          </p>
          <p className="text-sm text-zinc-300 mt-1">{coachPulse}</p>
        </div>

        {/* Progress Ring Card */}
        <div className="card-tactical harvest-bp-card harvest-grid-overlay p-6 harvest-animate-in harvest-animate-in-delay-2">
          <div className="flex flex-col items-center">
            <ProgressRing progress={doorsProgress} size={180} strokeWidth={14}>
              <div className="text-center">
                <p className="text-5xl font-tactical font-bold text-white">{stats.doors_today}</p>
                <p className="text-sm text-zinc-500 font-mono mt-1">of {dailyGoal} doors</p>
                {streakData.multiplier > 1 && (
                  <div className="px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 mt-2 inline-flex items-center gap-1">
                    <Zap className="w-3 h-3 text-orange-400" />
                    <span className="text-orange-400 font-tactical font-bold text-sm">
                      {streakData.multiplier}x
                    </span>
                  </div>
                )}
              </div>
            </ProgressRing>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 w-full">
              <StatCard
                label="Doors Knocked"
                value={stats.doors_today}
                tone="cyan"
                progress={doorsProgress}
                deltaLabel="+1 door"
              />
              <StatCard
                label="Appointments"
                value={stats.appointments_today}
                tone="emerald"
                progress={(stats.appointments_today / Math.max(1, dailyGoal / 5)) * 100}
                deltaLabel="+Lead"
              />
              <StatCard
                label="Contracts"
                value={stats.signed_today}
                tone="violet"
                progress={(stats.signed_today / Math.max(1, dailyGoal / 10)) * 100}
                deltaLabel="+Contract"
              />
              <StatCard
                label="Points"
                value={stats.points_today}
                tone="amber"
                progress={(stats.points_today / Math.max(1, dailyGoal * 5)) * 100}
                deltaLabel="+XP"
              />
            </div>
          </div>
        </div>

        {/* Active Competitions */}
        {activeCompetitions.length > 0 && (
          <div className="space-y-3 harvest-animate-in harvest-animate-in-delay-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-orange-500" />
                <h3 className="font-tactical font-bold text-white uppercase tracking-wide">
                  Active Competitions
                </h3>
              </div>
              <span className="px-2 py-1 rounded bg-orange-500/20 border border-orange-500/30 text-orange-400 font-mono text-xs">
                {activeCompetitions.length} active
              </span>
            </div>
            {activeCompetitions.slice(0, 2).map((comp) => (
              <CompetitionCard key={comp.id} competition={comp} />
            ))}
          </div>
        )}

        {/* Incentives Releases */}
        <IncentivesPanel data={incentives} />

        {/* Mission of the Day */}
        {campaigns.length > 0 && (
          <div className="card-tactical harvest-bp-card harvest-grid-overlay border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 harvest-animate-in harvest-animate-in-delay-3 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-blue-400" />
              <h3 className="font-tactical font-bold text-white uppercase tracking-wide">
                Mission of the Day
              </h3>
            </div>
            {campaigns.slice(0, 1).map((campaign) => (
              <div key={campaign.id}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-tactical font-semibold text-white">{campaign.name}</p>
                    <p className="text-sm text-zinc-500 font-mono">{campaign.description}</p>
                  </div>
                  <span className="text-2xl">{campaign.icon}</span>
                </div>
                <Progress value={campaign.my_percent || 0} className="h-2 mt-3 bg-zinc-800/50" />
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-zinc-500 font-mono">
                    {campaign.my_progress || 0}/{campaign.target_value}
                  </span>
                  {campaign.points_bonus > 0 && (
                    <span className="text-blue-400 font-tactical font-medium flex items-center gap-1">
                      <Award className="w-4 h-4" />+{campaign.points_bonus} bonus pts
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Today's Challenges */}
        <div className="card-tactical harvest-bp-card harvest-grid-overlay p-5 harvest-animate-in harvest-animate-in-delay-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" />
              <h3 className="font-tactical font-bold text-white uppercase tracking-wide">
                Today&apos;s Challenges
              </h3>
            </div>
            {challenges.length > 0 && (
              <span className="px-2 py-1 rounded bg-zinc-800/50 border border-zinc-700/30 text-zinc-400 font-mono text-xs">
                {challenges.filter((c) => c.state === 'completed').length}/{challenges.length}
              </span>
            )}
          </div>
          <div className="space-y-3">
            {challenges.length > 0 ? (
              challenges
                .slice(0, 3)
                .map((challenge, idx) => (
                  <HarvestChallengeCard
                    key={challenge.id}
                    challenge={challenge}
                    onClaim={claimChallenge}
                    index={idx}
                    completed={challenge.state === 'completed'}
                    justCompleted={challenge.state === 'completed'}
                  />
                ))
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-3 border border-zinc-700/30">
                  <Target className="w-8 h-8 text-zinc-600" />
                </div>
                <p className="font-tactical font-semibold text-zinc-300">No Active Challenges</p>
                <p className="text-sm text-zinc-500 font-mono mt-1">Check back soon!</p>
              </div>
            )}
          </div>
        </div>

        {/* Next Reward Progress */}
        {rewardProgress?.next_reward && (
          <div className="card-tactical harvest-bp-card harvest-grid-overlay bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-purple-400" />
                <span className="font-tactical font-bold text-white uppercase tracking-wide">
                  Next Reward
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </div>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center border border-purple-500/30">
                <Trophy className="w-7 h-7 text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="font-tactical font-semibold text-white">
                  {rewardProgress.next_reward.name}
                </p>
                <p className="text-sm text-zinc-500 font-mono">
                  {rewardProgress.next_reward.points_remaining} points to go
                </p>
              </div>
              <p className="text-xl font-tactical font-bold text-purple-400">
                {rewardProgress.next_reward.percent_complete}%
              </p>
            </div>
            <Progress
              value={rewardProgress.next_reward.percent_complete}
              className="h-2 mt-4 bg-zinc-800/50"
            />
          </div>
        )}

        {/* Motivation Footer */}
        <div className="text-center py-4">
          <p className="text-sm text-zinc-500 font-mono">
            {stats.doors_today >= dailyGoal
              ? '🎉 Goal reached! Keep the momentum going!'
              : `${dailyGoal - stats.doors_today} more doors to hit your daily goal`}
          </p>
          {streakData.is_at_risk && (
            <p className="text-sm text-amber-400 mt-1 font-tactical font-medium">
              ⚠️ Log {10 - streakData.doors_today} more doors to save your streak!
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default HarvestTodayTab;
