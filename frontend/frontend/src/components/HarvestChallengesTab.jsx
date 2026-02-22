import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Badge } from '../shared/ui/badge';
import { Button } from '../shared/ui/button';
import { Progress } from '../shared/ui/progress';
import {
  RefreshCw,
  Target,
  Gift,
  Trophy,
  Zap,
  Clock,
  Lock,
  CheckCircle2,
  ChevronRight,
  Award,
  Flame,
  AlertCircle,
  PartyPopper,
  X,
  Sparkles,
} from 'lucide-react';
import { harvestService } from '../services/harvestService';
import HarvestChallengeCard from './harvest/ChallengeCard';
import './harvest/HarvestAnimations.css';

const STATE_CONFIG = {
  locked: {
    label: 'Locked',
    cardClass: 'bg-zinc-800/40 border-zinc-700/40',
    badgeClass: 'bg-zinc-800/70 text-zinc-400 border-zinc-700/50',
    icon: Lock,
  },
  in_progress: {
    label: 'In Progress',
    cardClass: 'bg-orange-500/10 border-orange-500/30',
    badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    icon: Zap,
  },
  completed: {
    label: 'Complete',
    cardClass: 'bg-emerald-500/10 border-emerald-500/35',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    icon: CheckCircle2,
  },
  claimed: {
    label: 'Claimed',
    cardClass: 'bg-purple-500/10 border-purple-500/30',
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    icon: Trophy,
  },
  expired: {
    label: 'Expired',
    cardClass: 'bg-red-500/10 border-red-500/30 opacity-70',
    badgeClass: 'bg-red-500/20 text-red-300 border-red-500/40',
    icon: AlertCircle,
  },
};

const CelebrationModal = ({ challenge, onClose }) => {
  if (!challenge) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-zinc-700/60 bg-zinc-900 p-8 text-center">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full border border-orange-500/40 bg-gradient-to-br from-orange-500/40 to-amber-500/20">
          <PartyPopper className="h-10 w-10 text-orange-300" />
        </div>

        <h2 className="harvest-h1 mb-2 text-white">Challenge Complete</h2>
        <p className="mb-5 text-zinc-400">{challenge.name}</p>

        <div className="mb-5 rounded-2xl border border-orange-500/30 bg-gradient-to-r from-orange-500/20 to-amber-500/10 p-5">
          <p className="text-sm uppercase tracking-wide text-zinc-300">Points Earned</p>
          <p className="harvest-display text-orange-300">+{challenge.points_reward}</p>
        </div>

        <Button className="w-full harvest-btn-primary text-lg py-6" onClick={onClose}>
          Continue
        </Button>
      </div>
    </div>
  );
};

const LegacyChallengeCard = ({ challenge, onClaim, index }) => {
  const state = challenge.state || 'in_progress';
  const config = STATE_CONFIG[state] || STATE_CONFIG.in_progress;
  const StateIcon = config.icon;

  const progress =
    challenge.requirement_value > 0
      ? Math.min((challenge.current_progress / challenge.requirement_value) * 100, 100)
      : 0;

  const isLocked = state === 'locked';
  const isCompleted = state === 'completed';
  const isClaimed = state === 'claimed';
  const isExpired = state === 'expired';

  return (
    <div
      className={`harvest-card harvest-animate-in border ${config.cardClass}`}
      style={{ animationDelay: `${index * 0.05}s` }}
      data-testid={`challenge-card-${challenge.id}`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
              isLocked
                ? 'bg-zinc-800'
                : isCompleted
                  ? 'bg-emerald-500/20'
                  : isClaimed
                    ? 'bg-purple-500/20'
                    : 'bg-orange-500/20'
            }`}
          >
            {isLocked ? (
              <Lock className="h-6 w-6 text-zinc-500" />
            ) : (
              <Target className="h-6 w-6 text-zinc-200" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={`font-bold ${isLocked ? 'text-zinc-500' : 'text-zinc-100'}`}>
                {challenge.name}
              </h3>
              <Badge className={`text-xs ${config.badgeClass}`}>
                <StateIcon className="mr-1 h-3 w-3" />
                {config.label}
              </Badge>
            </div>
            <p className={`mt-1 text-sm ${isLocked ? 'text-zinc-600' : 'text-zinc-400'}`}>
              {challenge.description}
            </p>
          </div>
        </div>

        {!isLocked && !isClaimed && !isExpired && challenge.time_remaining_display && (
          <Badge
            variant="outline"
            className="ml-2 shrink-0 border-zinc-700/40 bg-zinc-800/50 text-zinc-400"
          >
            <Clock className="mr-1 h-3 w-3" />
            {challenge.time_remaining_display}
          </Badge>
        )}
      </div>

      {!isLocked && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-zinc-400">
              {challenge.current_progress} / {challenge.requirement_value}
            </span>
            <span
              className={`text-sm font-bold ${isCompleted || isClaimed ? 'text-emerald-300' : 'text-orange-300'}`}
            >
              {Math.round(progress)}%
            </span>
          </div>
          <Progress
            value={progress}
            className={`h-2.5 ${isCompleted || isClaimed ? 'bg-emerald-500/20' : 'bg-zinc-800/60'}`}
          />
        </div>
      )}

      {isLocked && challenge.unlock_requirement && (
        <div className="mt-4 rounded-xl border border-zinc-700/40 bg-zinc-800/60 p-3">
          <p className="flex items-center gap-2 text-sm text-zinc-400">
            <Lock className="h-4 w-4" />
            {challenge.unlock_requirement}
          </p>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-zinc-700/40 pt-4">
        <div className="flex items-center gap-2">
          <div
            className={`rounded-lg p-1.5 ${isClaimed ? 'bg-purple-500/20' : 'bg-orange-500/20'}`}
          >
            <Gift className={`h-4 w-4 ${isClaimed ? 'text-purple-300' : 'text-orange-300'}`} />
          </div>
          <span className={`font-bold ${isClaimed ? 'text-purple-300' : 'text-orange-300'}`}>
            +{challenge.points_reward} points
          </span>
          {challenge.reward_id && (
            <Badge variant="outline" className="ml-1 text-xs border-zinc-700/40 text-zinc-400">
              <Sparkles className="mr-1 h-3 w-3" />
              Bonus
            </Badge>
          )}
        </div>

        {isCompleted && (
          <Button
            size="sm"
            className="harvest-btn-primary animate-pulse px-4 py-2"
            onClick={() => onClaim(challenge)}
            data-testid={`claim-${challenge.id}`}
          >
            <CheckCircle2 className="mr-1 h-4 w-4" />
            Claim
          </Button>
        )}

        {isClaimed && challenge.claimed_at && (
          <span className="text-xs text-purple-300">
            Claimed {new Date(challenge.claimed_at).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
};

const CampaignCard = ({ campaign }) => (
  <div className="harvest-card border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 p-4">
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Flame className="h-6 w-6 text-blue-300" />
        <div>
          <p className="font-bold text-zinc-100">{campaign.name}</p>
          <p className="text-sm text-zinc-400">{campaign.time_remaining}</p>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-zinc-500" />
    </div>

    <Progress value={campaign.my_percent || 0} className="h-2.5" />

    <div className="mt-3 flex justify-between text-sm">
      <span className="text-zinc-400">
        {campaign.my_progress || 0} / {campaign.target_value} {campaign.goal_type}
      </span>
      {campaign.points_bonus > 0 && (
        <span className="font-semibold text-blue-300">+{campaign.points_bonus} pts</span>
      )}
    </div>
  </div>
);

const HarvestChallengesTab = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [challenges, setChallenges] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [celebrationChallenge, setCelebrationChallenge] = useState(null);
  const [filter, setFilter] = useState('active');

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);

    try {
      const [challengesData, campaignsData] = await Promise.all([
        harvestService.getChallenges(true),
        harvestService.getCampaigns(),
      ]);

      setChallenges(challengesData.challenges || []);
      setCampaigns((campaignsData.campaigns || []).filter((c) => c.status === 'active'));
    } catch (err) {
      console.error('Failed to fetch challenges:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const claimChallenge = async (challenge) => {
    try {
      await harvestService.claimChallenge(challenge.id);
      setCelebrationChallenge(challenge);
      fetchData();
    } catch (err) {
      console.error('Failed to claim challenge:', err);
    }
  };

  const filteredChallenges = useMemo(() => {
    if (filter === 'active')
      return challenges.filter((c) => ['in_progress', 'completed'].includes(c.state));
    if (filter === 'completed')
      return challenges.filter((c) => ['claimed', 'completed'].includes(c.state));
    return challenges;
  }, [challenges, filter]);

  const stats = useMemo(
    () => ({
      active: challenges.filter((c) => c.state === 'in_progress').length,
      completed: challenges.filter((c) => ['completed', 'claimed'].includes(c.state)).length,
      total: challenges.length,
      totalPoints: challenges
        .filter((c) => c.state === 'claimed')
        .reduce((sum, c) => sum + (c.points_reward || 0), 0),
    }),
    [challenges]
  );

  const coachPulse = useMemo(() => {
    if (stats.active === 0)
      return 'No active missions. Switch to All or wait for campaign refresh.';
    const readyToClaim = challenges.filter((c) => c.state === 'completed').length;
    if (readyToClaim > 0) return `${readyToClaim} reward(s) are ready to claim now.`;
    return `${stats.active} mission(s) in progress. Push for one completion before end of day.`;
  }, [stats, challenges]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center bg-zinc-900">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="harvest-content overflow-y-auto bg-zinc-900">
      <div className="border-b border-zinc-700/50 bg-zinc-900 px-5 pb-4 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="harvest-h1 text-white">Challenges</h1>
            <p className="mt-0.5 font-mono text-sm text-zinc-500">
              {stats.active} active � {stats.completed} completed
            </p>
          </div>
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
      </div>

      <div className="space-y-4 p-4">
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3">
          <p className="text-xs font-mono uppercase tracking-wider text-orange-300">
            Harvest Coach
          </p>
          <p className="mt-1 text-sm text-zinc-300">{coachPulse}</p>
        </div>

        {campaigns.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-blue-400" />
              <h3 className="font-bold text-white">Active Campaigns</h3>
            </div>
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}

        <div className="flex rounded-full border border-zinc-700/40 bg-zinc-800/70 p-1">
          {[
            { id: 'active', label: 'Active', count: stats.active, icon: Zap },
            { id: 'completed', label: 'Done', count: stats.completed, icon: CheckCircle2 },
            { id: 'all', label: 'All', count: stats.total, icon: Target },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                filter === tab.id
                  ? 'border border-orange-500/40 bg-orange-500/20 text-orange-300 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              data-testid={`filter-${tab.id}`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredChallenges.length > 0 ? (
            filteredChallenges.map((challenge, idx) => (
              <HarvestChallengeCard
                key={challenge.id}
                challenge={challenge}
                onClaim={claimChallenge}
                index={idx}
                completed={['completed', 'claimed'].includes(challenge.state)}
                justCompleted={challenge.state === 'completed'}
              />
            ))
          ) : (
            <div className="harvest-card border border-zinc-700/40 bg-zinc-800/30 py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-zinc-700/40 bg-zinc-800/60">
                <Target className="h-8 w-8 text-zinc-600" />
              </div>
              <h3 className="mb-1 text-lg font-bold text-zinc-300">
                {filter === 'active'
                  ? 'No Active Challenges'
                  : filter === 'completed'
                    ? 'No Completed Challenges'
                    : 'No Challenges Available'}
              </h3>
              <p className="mb-5 text-sm text-zinc-500">
                {filter === 'active'
                  ? 'Check back soon or join a campaign.'
                  : 'Complete challenges to see them here.'}
              </p>
            </div>
          )}
        </div>

        <div className="harvest-card border border-zinc-700/40 bg-gradient-to-r from-zinc-800/50 to-zinc-800/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-orange-500/30 bg-orange-500/20">
                <Award className="h-6 w-6 text-orange-300" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Points from Challenges</p>
                <p className="text-xl font-bold text-zinc-100">{stats.totalPoints} pts</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-zinc-500">Completed</p>
              <p className="text-2xl font-bold text-emerald-300">
                {challenges.filter((c) => c.state === 'claimed').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <CelebrationModal
        challenge={celebrationChallenge}
        onClose={() => setCelebrationChallenge(null)}
      />
    </div>
  );
};

export default HarvestChallengesTab;
