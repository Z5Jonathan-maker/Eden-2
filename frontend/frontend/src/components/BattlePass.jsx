/**
 * BattlePass.jsx - Tactical Ops Battle Pass System
 * A gamified progression system with XP, tiers, missions, and rewards
 * Features AAA game-quality badge artwork
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Trophy, Target, Zap, Shield, Star, ChevronRight, 
  Gift, Lock, Check, Clock, Flame, Award, Crown,
  Crosshair, Medal, TrendingUp, Calendar, Users
} from 'lucide-react';
import { toast } from 'sonner';
import { TIER_BADGES, UI_ICONS, getTierBadge, PAGE_ICONS } from '../assets/badges';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const BattlePass = () => {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(null);
  const [missions, setMissions] = useState({ daily: [], weekly: [] });
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeTab, setActiveTab] = useState('progress');
  const [claimingTier, setClaimingTier] = useState(null);

  const fetchProgress = useCallback(async () => {
    try {
      const token = localStorage.getItem('eden_token');
      const res = await fetch(`${API_URL}/api/battle-pass/progress`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProgress(data);
      }
    } catch (err) {
      console.error('Failed to fetch progress:', err);
    }
  }, []);

  const fetchMissions = useCallback(async () => {
    try {
      const token = localStorage.getItem('eden_token');
      const res = await fetch(`${API_URL}/api/battle-pass/missions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMissions({
          daily: data.daily_missions || [],
          weekly: data.weekly_missions || []
        });
      }
    } catch (err) {
      console.error('Failed to fetch missions:', err);
    }
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const token = localStorage.getItem('eden_token');
      const res = await fetch(`${API_URL}/api/battle-pass/leaderboard?limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchProgress(), fetchMissions(), fetchLeaderboard()]);
      setLoading(false);
    };
    loadData();
  }, [fetchProgress, fetchMissions, fetchLeaderboard]);

  const claimReward = useCallback(async (tier) => {
    setClaimingTier(tier);
    try {
      const token = localStorage.getItem('eden_token');
      const res = await fetch(`${API_URL}/api/battle-pass/rewards/${tier}/claim`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Reward claimed: ${data.reward.reward_name}!`);
        fetchProgress();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to claim reward');
      }
    } catch (err) {
      toast.error('Failed to claim reward');
    } finally {
      setClaimingTier(null);
    }
  }, [fetchProgress]);

  const getRarityColor = (rarity) => {
    const colors = {
      common: 'border-zinc-500/30 bg-zinc-600/20 text-zinc-300',
      uncommon: 'border-green-500/30 bg-green-600/20 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]',
      rare: 'border-blue-500/30 bg-blue-600/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]',
      epic: 'border-purple-500/30 bg-purple-600/20 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]',
      legendary: 'border-yellow-500/30 bg-yellow-600/20 text-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.3)]',
      mythic: 'border-red-500/30 bg-red-600/20 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse',
    };
    return colors[rarity] || colors.common;
  };

  const getRarityGlow = (rarity) => {
    const glows = {
      common: '',
      uncommon: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]',
      rare: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]',
      epic: 'shadow-[0_0_25px_rgba(168,85,247,0.3)]',
      legendary: 'shadow-[0_0_30px_rgba(234,179,8,0.4)]',
      mythic: 'shadow-[0_0_35px_rgba(239,68,68,0.4)]',
    };
    return glows[rarity] || '';
  };

  const getRewardIcon = (type) => {
    switch (type) {
      case 'badge': return <Medal className="w-5 h-5" />;
      case 'title': return <Crown className="w-5 h-5" />;
      case 'bonus_multiplier': return <TrendingUp className="w-5 h-5" />;
      case 'cosmetic': return <Star className="w-5 h-5" />;
      default: return <Gift className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-tactical w-12 h-12 mx-auto mb-4" />
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">Loading Battle Pass...</p>
        </div>
      </div>
    );
  }

  const season = progress?.season || {};
  const currentTier = progress?.current_tier || 1;
  const currentXp = progress?.current_xp || 0;
  const tierProgressPercent = progress?.tier_progress_percent || 0;
  const claimedRewards = progress?.claimed_rewards || [];

  // Get tiers from season data with badge images
  const allTiers = [
    { tier: 1, xp_required: 0, reward_type: "badge", reward_id: "recruit", reward_name: "Recruit", reward_description: "Welcome to Eden Tactical Ops", rarity: "common", badge_image: TIER_BADGES.recruit },
    { tier: 5, xp_required: 4000, reward_type: "badge", reward_id: "field_agent", reward_name: "Field Agent", reward_description: "Field operations certified", rarity: "common", badge_image: TIER_BADGES.recruit },
    { tier: 10, xp_required: 9000, reward_type: "badge", reward_id: "specialist", reward_name: "Specialist", reward_description: "Advanced tactical training", rarity: "uncommon", badge_image: TIER_BADGES.agent },
    { tier: 15, xp_required: 14000, reward_type: "badge", reward_id: "veteran", reward_name: "Veteran", reward_description: "Proven field experience", rarity: "rare", badge_image: TIER_BADGES.veteran },
    { tier: 20, xp_required: 21000, reward_type: "badge", reward_id: "elite", reward_name: "Elite", reward_description: "Top tier operator", rarity: "rare", badge_image: TIER_BADGES.elite },
    { tier: 25, xp_required: 27000, reward_type: "badge", reward_id: "commander", reward_name: "Commander", reward_description: "Leadership excellence", rarity: "epic", badge_image: TIER_BADGES.commander },
    { tier: 35, xp_required: 39000, reward_type: "badge", reward_id: "apex_closer", reward_name: "Apex Closer", reward_description: "Master negotiator", rarity: "epic", badge_image: TIER_BADGES.apex },
    { tier: 40, xp_required: 45000, reward_type: "badge", reward_id: "legend", reward_name: "Legend", reward_description: "Hall of fame status", rarity: "legendary", badge_image: TIER_BADGES.legend },
    { tier: 45, xp_required: 51000, reward_type: "badge", reward_id: "legendary", reward_name: "Legendary", reward_description: "Ultimate recognition", rarity: "legendary", badge_image: TIER_BADGES.legend },
    { tier: 50, xp_required: 60000, reward_type: "badge", reward_id: "field_marshal", reward_name: "Field Marshal", reward_description: "Mastered Season 1", rarity: "mythic", badge_image: TIER_BADGES.field_marshal },
  ];

  return (
    <div className="p-3 sm:p-6 lg:p-8 min-h-screen page-enter" data-testid="battle-pass-page">
      {/* Header */}
      <div className="mb-4 sm:mb-6 animate-fade-in-up">
        <div className="flex items-center gap-3 sm:gap-4 mb-2">
          <img 
            src={PAGE_ICONS.battle_pass} 
            alt="Battle Pass" 
            className="w-12 h-12 sm:w-16 sm:h-16 object-contain animate-glow-breathe"
            style={{ filter: 'drop-shadow(0 0 15px rgba(249, 115, 22, 0.5))' }}
          />
          <h1 className="text-xl sm:text-3xl font-tactical font-bold text-white tracking-wide text-glow-orange" data-testid="battle-pass-title">BATTLE PASS</h1>
        </div>
        <p className="text-zinc-500 font-mono text-xs sm:text-sm uppercase tracking-wider" data-testid="battle-pass-season">
          {season.name || 'Season 1: Field Commander'} // Progress & Rewards
        </p>
      </div>

      {/* XP Progress Card */}
      <div className="card-tactical p-3 sm:p-5 mb-4 sm:mb-6 relative overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.1s' }} data-testid="xp-progress-card">
        {/* Background glow effect */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl animate-glow-pulse" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            {/* Current Tier Badge Image */}
            <div className="relative">
              <img 
                src={getTierBadge(currentTier)} 
                alt={`Tier ${currentTier}`} 
                className={`w-16 h-16 sm:w-24 sm:h-24 object-contain drop-shadow-2xl badge-icon animate-glow-breathe ${getRarityGlow(progress?.current_tier_info?.rarity || 'common')}`}
                data-testid="current-tier-badge"
              />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center font-tactical font-bold text-white text-sm border-2 border-zinc-900 animate-scale-pulse">
                {currentTier}
              </div>
            </div>
            <div>
              <p className="text-zinc-500 font-mono text-xs uppercase tracking-wider">Current Tier</p>
              <p className="text-2xl font-tactical font-bold text-white" data-testid="current-tier-name">
                {progress?.current_tier_info?.reward_name || 'Recruit'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <img src={UI_ICONS.xp_orb} alt="" className="w-5 h-5 object-contain animate-spin-slow" />
                <p className="text-sm text-orange-400 font-mono font-semibold" data-testid="total-xp">
                  {currentXp.toLocaleString()} XP
                </p>
              </div>
            </div>
          </div>

          {/* XP Bar */}
          <div className="flex-1 max-w-md">
            <div className="flex justify-between text-xs font-mono text-zinc-500 mb-2">
              <span>Tier {currentTier}</span>
              <span>Tier {Math.min(currentTier + 1, 50)}</span>
            </div>
            <div className="xp-bar h-4" data-testid="xp-progress-bar">
              <div 
                className="xp-bar-fill h-full" 
                style={{ width: `${tierProgressPercent}%` }}
              />
            </div>
            <p className="text-center text-xs font-mono text-zinc-500 mt-2" data-testid="xp-progress-text">
              {progress?.xp_in_tier?.toLocaleString() || 0} / {progress?.xp_needed_for_next?.toLocaleString() || 1000} XP to next tier
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 animate-fade-in-up" style={{ animationDelay: '0.2s' }} data-testid="battle-pass-tabs">
        {[
          { id: 'progress', label: 'Tier Progress', icon: <TrendingUp className="w-4 h-4" /> },
          { id: 'missions', label: 'Missions', icon: <Target className="w-4 h-4" /> },
          { id: 'leaderboard', label: 'Leaderboard', icon: <Users className="w-4 h-4" /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`tab-${tab.id}`}
            className={`flex items-center gap-2 px-4 py-2.5 rounded font-tactical text-sm uppercase tracking-wider whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50 animate-shimmer'
                : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:border-orange-500/30'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'progress' && (
        <div className="card-tactical p-5">
          <div className="flex items-center gap-2 mb-5">
            <Award className="w-5 h-5 text-orange-500" />
            <h2 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">Tier Rewards</h2>
          </div>

          {/* Tier Grid with Badge Images */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {allTiers.map((tier, idx) => {
              const isUnlocked = currentTier >= tier.tier;
              const isClaimed = claimedRewards.includes(tier.tier);
              const canClaim = isUnlocked && !isClaimed;

              return (
                <div
                  key={tier.tier}
                  className={`relative p-4 rounded-lg border transition-all duration-300 stagger-item ${
                    isUnlocked 
                      ? `${getRarityColor(tier.rarity)} ${canClaim ? 'hover:scale-105 cursor-pointer' : ''}`
                      : 'border-zinc-800/50 bg-zinc-900/30'
                  }`}
                  style={{ animationDelay: `${idx * 0.06}s` }}
                  onClick={() => canClaim && claimReward(tier.tier)}
                >
                  {/* Tier Number Badge */}
                  <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 ${
                    isUnlocked ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/50 animate-scale-pulse' : 'bg-zinc-700 text-zinc-400'
                  }`}>
                    {tier.tier}
                  </div>

                  {/* Badge Image */}
                  <div className="flex justify-center mb-3 relative">
                    {isUnlocked ? (
                      <img 
                        src={tier.badge_image} 
                        alt={tier.reward_name}
                        className={`w-20 h-20 object-contain transition-all duration-300 badge-icon ${
                          tier.rarity === 'mythic' ? 'badge-icon-glow badge-icon-spin' :
                          tier.rarity === 'legendary' ? 'badge-icon-glow animate-float' :
                          tier.rarity === 'epic' ? 'badge-icon-glow' :
                          isClaimed ? 'opacity-100' : 'opacity-90 hover:opacity-100 hover:scale-110'
                        } ${getRarityGlow(tier.rarity)}`}
                      />
                    ) : (
                      <div className="w-20 h-20 flex items-center justify-center bg-zinc-800/50 rounded-lg">
                        <Lock className="w-8 h-8 text-zinc-600" />
                      </div>
                    )}
                    {isClaimed && (
                      <div className="absolute bottom-0 right-0 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50 animate-zoom-in">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Reward Info */}
                  <p className={`font-tactical font-semibold text-sm mb-1 text-center ${isUnlocked ? 'text-white' : 'text-zinc-600'}`}>
                    {tier.reward_name}
                  </p>
                  <p className={`text-[10px] font-mono uppercase text-center ${
                    tier.rarity === 'mythic' ? 'text-red-400' :
                    tier.rarity === 'legendary' ? 'text-yellow-400' :
                    tier.rarity === 'epic' ? 'text-purple-400' :
                    tier.rarity === 'rare' ? 'text-blue-400' :
                    tier.rarity === 'uncommon' ? 'text-green-400' :
                    'text-zinc-500'
                  }`}>
                    {tier.rarity}
                  </p>

                  {/* XP Required */}
                  {!isUnlocked && (
                    <p className="text-[10px] font-mono text-zinc-600 mt-2 text-center">
                      {tier.xp_required.toLocaleString()} XP
                    </p>
                  )}

                  {/* Claim Button */}
                  {canClaim && (
                    <button
                      className="w-full mt-3 py-2 rounded text-xs font-tactical uppercase bg-orange-500 text-white border border-orange-400/50 hover:bg-orange-400 shadow-lg shadow-orange-500/30 transition-all"
                      disabled={claimingTier === tier.tier}
                      data-testid={`claim-tier-${tier.tier}`}
                    >
                      {claimingTier === tier.tier ? 'Claiming...' : 'Claim Reward'}
                    </button>
                  )}

                  {isClaimed && (
                    <p className="text-[10px] font-mono text-green-400 mt-2 text-center uppercase font-semibold" data-testid={`claimed-tier-${tier.tier}`}>
                      Claimed
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'missions' && (
        <div className="space-y-6">
          {/* Daily Missions */}
          <div className="card-tactical p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                <h2 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">Daily Ops</h2>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                <Clock className="w-3 h-3" />
                <span>Resets Daily</span>
              </div>
            </div>

            <div className="space-y-3">
              {missions.daily.map((mission) => (
                <div
                  key={mission.id}
                  className={`p-4 rounded-lg border transition-all ${
                    mission.is_completed
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-zinc-700/30 bg-zinc-800/30 hover:border-orange-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Crosshair className="w-4 h-4 text-orange-500" />
                        <span className="font-tactical font-semibold text-white text-sm">{mission.name}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${getRarityColor(mission.rarity)}`}>
                          {mission.rarity}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mb-2 font-mono">{mission.description}</p>
                      
                      {/* Progress Bar */}
                      <div className="progress-tactical">
                        <div 
                          className="progress-tactical-fill"
                          style={{ width: `${mission.progress_percent}%` }}
                        />
                      </div>
                      <p className="text-[10px] font-mono text-zinc-600 mt-1">
                        {mission.current_progress} / {mission.target_value}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 text-orange-400">
                        <Zap className="w-4 h-4" />
                        <span className="font-tactical font-bold">+{mission.xp_reward}</span>
                      </div>
                      <p className="text-[10px] font-mono text-zinc-600">XP</p>
                    </div>

                    {mission.is_completed && (
                      <Check className="w-6 h-6 text-green-400 flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))}

              {missions.daily.length === 0 && (
                <div className="text-center py-8">
                  <Target className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
                  <p className="text-sm text-zinc-500 font-mono">No daily missions available</p>
                </div>
              )}
            </div>
          </div>

          {/* Weekly Missions */}
          <div className="card-tactical p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-500" />
                <h2 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">Weekly Ops</h2>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                <Clock className="w-3 h-3" />
                <span>Resets Weekly</span>
              </div>
            </div>

            <div className="space-y-3">
              {missions.weekly.map((mission) => (
                <div
                  key={mission.id}
                  className={`p-4 rounded-lg border transition-all ${
                    mission.is_completed
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-zinc-700/30 bg-zinc-800/30 hover:border-purple-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-4 h-4 text-purple-500" />
                        <span className="font-tactical font-semibold text-white text-sm">{mission.name}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${getRarityColor(mission.rarity)}`}>
                          {mission.rarity}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mb-2 font-mono">{mission.description}</p>
                      
                      {/* Progress Bar */}
                      <div className="progress-tactical">
                        <div 
                          className="progress-tactical-fill bg-gradient-to-r from-purple-600 to-purple-400"
                          style={{ width: `${mission.progress_percent}%` }}
                        />
                      </div>
                      <p className="text-[10px] font-mono text-zinc-600 mt-1">
                        {mission.current_progress} / {mission.target_value}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 text-purple-400">
                        <Zap className="w-4 h-4" />
                        <span className="font-tactical font-bold">+{mission.xp_reward}</span>
                      </div>
                      <p className="text-[10px] font-mono text-zinc-600">XP</p>
                    </div>

                    {mission.is_completed && (
                      <Check className="w-6 h-6 text-green-400 flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))}

              {missions.weekly.length === 0 && (
                <div className="text-center py-8">
                  <Calendar className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
                  <p className="text-sm text-zinc-500 font-mono">No weekly missions available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div className="card-tactical p-5">
          <div className="flex items-center gap-2 mb-5">
            <img src={UI_ICONS.leaderboard_crown} alt="" className="w-8 h-8 object-contain" />
            <h2 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">XP Leaderboard</h2>
          </div>

          <div className="space-y-3">
            {leaderboard.map((entry, idx) => (
              <div
                key={entry.user_id}
                className={`flex items-center gap-4 p-4 rounded-lg border transition-all stagger-item ${
                  idx === 0 ? 'border-yellow-500/50 bg-gradient-to-r from-yellow-500/10 to-transparent shadow-lg shadow-yellow-500/10' :
                  idx === 1 ? 'border-zinc-400/50 bg-gradient-to-r from-zinc-400/10 to-transparent' :
                  idx === 2 ? 'border-orange-700/50 bg-gradient-to-r from-orange-700/10 to-transparent' :
                  'border-zinc-700/30 bg-zinc-800/30'
                }`}
              >
                {/* Rank with special icons for top 3 */}
                {idx === 0 ? (
                  <img src={UI_ICONS.leaderboard_crown} alt="1st" className="w-12 h-12 object-contain badge-icon animate-float" />
                ) : (
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-tactical font-bold text-lg ${
                    idx === 1 ? 'bg-zinc-400/20 text-zinc-300' :
                    idx === 2 ? 'bg-orange-700/20 text-orange-600' :
                    'bg-zinc-800/50 text-zinc-500'
                  }`}>
                    #{entry.rank}
                  </div>
                )}

                {/* User Badge */}
                <img 
                  src={getTierBadge(entry.current_tier || 1)} 
                  alt="" 
                  className="w-12 h-12 object-contain"
                />

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-tactical font-semibold text-white text-sm truncate">
                    {entry.user_name}
                  </p>
                  <p className="text-xs font-mono text-zinc-500">
                    Tier {entry.current_tier} • {entry.tier_info?.reward_name || 'Recruit'}
                  </p>
                </div>

                {/* XP */}
                <div className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <img src={UI_ICONS.xp_orb} alt="" className="w-5 h-5 object-contain" />
                    <p className="font-tactical font-bold text-orange-400">
                      {entry.current_xp?.toLocaleString()}
                    </p>
                  </div>
                  <p className="text-[10px] font-mono text-zinc-600">XP</p>
                </div>
              </div>
            ))}

            {leaderboard.length === 0 && (
              <div className="text-center py-8">
                <img src={UI_ICONS.leaderboard_crown} alt="" className="w-16 h-16 mx-auto mb-2 opacity-30" />
                <p className="text-sm text-zinc-500 font-mono">No rankings yet</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BattlePass;
