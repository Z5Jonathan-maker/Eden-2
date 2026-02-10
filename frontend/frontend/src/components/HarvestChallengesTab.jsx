/**
 * HarvestChallengesTab - Enzy-Style Challenges with Premium Gamification
 * 
 * Grid of challenge cards with progress tracking, rewards, and celebration effects.
 * Features visual state indicators, countdown timers, and reward claim flow.
 * 
 * Challenge States:
 * - locked: Gray, requires unlock criteria
 * - in_progress: Orange active border
 * - completed: Green glow, claim button
 * - claimed: Purple, faded
 * - expired: Red, faded
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { 
  RefreshCw, Target, Gift, Trophy, Zap, Clock, Lock,
  CheckCircle2, ChevronRight, Award, Flame, Star, 
  AlertCircle, PartyPopper, X, Sparkles
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Challenge State Config - Enzy Style
const STATE_CONFIG = {
  locked: {
    label: 'Locked',
    cardClass: 'harvest-challenge-locked',
    badgeClass: 'bg-slate-100 text-slate-500 border-slate-200',
    icon: Lock,
  },
  in_progress: {
    label: 'In Progress',
    cardClass: 'harvest-challenge-active',
    badgeClass: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: Zap,
  },
  completed: {
    label: 'Complete!',
    cardClass: 'harvest-challenge-completed',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: CheckCircle2,
  },
  claimed: {
    label: 'Claimed',
    cardClass: 'harvest-challenge-claimed',
    badgeClass: 'bg-purple-100 text-purple-600 border-purple-200',
    icon: Trophy,
  },
  expired: {
    label: 'Expired',
    cardClass: 'bg-red-50 border-red-200 opacity-60',
    badgeClass: 'bg-red-100 text-red-500 border-red-200',
    icon: AlertCircle,
  }
};

// Celebration Modal - Confetti Effect
const CelebrationModal = ({ challenge, onClose }) => {
  if (!challenge) return null;
  
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-8 relative text-center overflow-hidden">
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>
        
        {/* Confetti particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {['🎉', '🎊', '⭐', '✨', '🏆'].map((emoji, i) => (
            <span 
              key={i}
              className="absolute text-2xl harvest-confetti"
              style={{ 
                left: `${15 + i * 18}%`,
                animationDelay: `${i * 0.15}s`
              }}
            >
              {emoji}
            </span>
          ))}
        </div>
        
        {/* Trophy */}
        <div className="w-28 h-28 mx-auto bg-gradient-to-br from-amber-300 to-yellow-500 rounded-full flex items-center justify-center mb-5 shadow-2xl shadow-amber-300/50 relative">
          <span className="text-6xl">🏆</span>
          <div className="absolute -inset-2 rounded-full border-4 border-amber-200 animate-ping opacity-50" />
        </div>
        
        {/* Message */}
        <h2 className="harvest-h1 text-slate-900 mb-2">Challenge Complete!</h2>
        <p className="text-slate-600 mb-6">{challenge.name}</p>
        
        {/* Points earned */}
        <div className="bg-gradient-to-r from-orange-100 to-amber-100 rounded-2xl p-5 mb-5">
          <p className="text-sm text-slate-600 uppercase tracking-wide">Points Earned</p>
          <p className="harvest-display text-orange-600">+{challenge.points_reward}</p>
        </div>
        
        {/* Stats */}
        <p className="text-sm text-slate-500 mb-5">
          {challenge.current_progress}/{challenge.requirement_value} {challenge.requirement_type}
        </p>
        
        <Button 
          className="w-full harvest-btn-primary text-lg py-6"
          onClick={onClose}
        >
          <PartyPopper className="w-5 h-5 mr-2" />
          Awesome!
        </Button>
      </div>
    </div>
  );
};

// Challenge Card Component - Enzy Style
const ChallengeCard = ({ challenge, onClaim, index }) => {
  const state = challenge.state || 'in_progress';
  const config = STATE_CONFIG[state] || STATE_CONFIG.in_progress;
  const StateIcon = config.icon;
  
  const progress = challenge.requirement_value > 0 
    ? Math.min((challenge.current_progress / challenge.requirement_value) * 100, 100)
    : 0;
  
  const isLocked = state === 'locked';
  const isCompleted = state === 'completed';
  const isClaimed = state === 'claimed';
  const isExpired = state === 'expired';
  
  return (
    <div 
      className={`harvest-card ${config.cardClass} harvest-animate-in`}
      style={{ animationDelay: `${index * 0.05}s` }}
      data-testid={`challenge-card-${challenge.id}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
            isLocked ? 'bg-slate-200' : 
            isCompleted ? 'bg-emerald-200' :
            isClaimed ? 'bg-purple-200' :
            'bg-orange-200'
          }`}>
            {isLocked ? (
              <Lock className="w-6 h-6 text-slate-400" />
            ) : (
              <span className="text-2xl">{challenge.icon || '🎯'}</span>
            )}
          </div>
          
          {/* Title & Description */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`font-bold ${isLocked ? 'text-slate-400' : 'text-slate-900'}`}>
                {challenge.name}
              </h3>
              <Badge className={`text-xs ${config.badgeClass}`}>
                <StateIcon className="w-3 h-3 mr-1" />
                {config.label}
              </Badge>
            </div>
            <p className={`text-sm mt-1 ${isLocked ? 'text-slate-400' : 'text-slate-500'}`}>
              {challenge.description}
            </p>
          </div>
        </div>
        
        {/* Time remaining */}
        {!isLocked && !isClaimed && !isExpired && challenge.time_remaining_display && (
          <Badge 
            variant="outline" 
            className={`shrink-0 ml-2 ${
              challenge.time_remaining_display.includes('h') && !challenge.time_remaining_display.includes('d')
                ? 'border-amber-300 text-amber-600 bg-amber-50'
                : 'border-slate-200'
            }`}
          >
            <Clock className="w-3 h-3 mr-1" />
            {challenge.time_remaining_display}
          </Badge>
        )}
      </div>
      
      {/* Progress Section */}
      {!isLocked && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-600">
              {challenge.current_progress} / {challenge.requirement_value}
            </span>
            <span className={`text-sm font-bold ${
              isCompleted || isClaimed ? 'text-emerald-600' : 'text-orange-600'
            }`}>
              {Math.round(progress)}%
            </span>
          </div>
          <Progress 
            value={progress} 
            className={`h-2.5 ${isCompleted || isClaimed ? 'bg-emerald-100' : 'bg-orange-100'}`}
          />
        </div>
      )}
      
      {/* Locked Requirement */}
      {isLocked && challenge.unlock_requirement && (
        <div className="mt-4 p-3 bg-slate-100 rounded-xl">
          <p className="text-sm text-slate-500 flex items-center gap-2">
            <Lock className="w-4 h-4" />
            {challenge.unlock_requirement}
          </p>
        </div>
      )}
      
      {/* Reward Section */}
      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${isClaimed ? 'bg-purple-100' : 'bg-orange-100'}`}>
            <Gift className={`w-4 h-4 ${isClaimed ? 'text-purple-500' : 'text-orange-500'}`} />
          </div>
          <span className={`font-bold ${isClaimed ? 'text-purple-600' : 'text-orange-600'}`}>
            +{challenge.points_reward} points
          </span>
          {challenge.reward_id && (
            <Badge variant="outline" className="text-xs ml-1">
              <Sparkles className="w-3 h-3 mr-1" />
              Bonus
            </Badge>
          )}
        </div>
        
        {/* Claim Button */}
        {isCompleted && (
          <Button 
            size="sm"
            className="harvest-btn-primary py-2 px-4 animate-pulse"
            onClick={() => onClaim(challenge)}
            data-testid={`claim-${challenge.id}`}
          >
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Claim
          </Button>
        )}
        
        {isClaimed && challenge.claimed_at && (
          <span className="text-xs text-purple-500">
            Claimed {new Date(challenge.claimed_at).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
};

// Campaign Card Component
const CampaignCard = ({ campaign }) => (
  <div className="harvest-card border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{campaign.icon || '🎯'}</span>
        <div>
          <p className="font-bold text-slate-900">{campaign.name}</p>
          <p className="text-sm text-slate-500">{campaign.time_remaining}</p>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-slate-400" />
    </div>
    
    <Progress value={campaign.my_percent || 0} className="h-2.5" />
    
    <div className="flex justify-between mt-3 text-sm">
      <span className="text-slate-600">
        {campaign.my_progress || 0} / {campaign.target_value} {campaign.goal_type}
      </span>
      {campaign.points_bonus > 0 && (
        <span className="text-blue-600 font-semibold">+{campaign.points_bonus} pts</span>
      )}
    </div>
  </div>
);

// Main Component
const HarvestChallengesTab = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [challenges, setChallenges] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [celebrationChallenge, setCelebrationChallenge] = useState(null);
  const [filter, setFilter] = useState('active');
  
  const token = localStorage.getItem('eden_token');
  
  // Fetch data
  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [challengesRes, campaignsRes] = await Promise.all([
        fetch(`${API_URL}/api/harvest/challenges?include_completed=true`, { headers }),
        fetch(`${API_URL}/api/harvest/campaigns`, { headers })
      ]);
      
      if (challengesRes.ok) {
        const data = await challengesRes.json();
        setChallenges(data.challenges || []);
      }
      
      if (campaignsRes.ok) {
        const data = await campaignsRes.json();
        setCampaigns((data.campaigns || []).filter(c => c.status === 'active'));
      }
    } catch (err) {
      console.error('Failed to fetch challenges:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Claim challenge
  const claimChallenge = async (challenge) => {
    try {
      const res = await fetch(`${API_URL}/api/harvest/challenges/${challenge.id}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        setCelebrationChallenge(challenge);
        fetchData();
      }
    } catch (err) {
      console.error('Failed to claim challenge:', err);
    }
  };
  
  // Filter challenges
  const getFilteredChallenges = () => {
    switch (filter) {
      case 'active':
        return challenges.filter(c => ['in_progress', 'completed'].includes(c.state));
      case 'completed':
        return challenges.filter(c => ['claimed', 'completed'].includes(c.state));
      default:
        return challenges;
    }
  };
  
  // Stats
  const stats = {
    active: challenges.filter(c => c.state === 'in_progress').length,
    completed: challenges.filter(c => ['completed', 'claimed'].includes(c.state)).length,
    total: challenges.length,
    totalPoints: challenges.filter(c => c.state === 'claimed').reduce((sum, c) => sum + (c.points_reward || 0), 0)
  };
  
  const filteredChallenges = getFilteredChallenges();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50">
        <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }
  
  return (
    <div className="overflow-y-auto harvest-content bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-5 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="harvest-h1 text-slate-900">Challenges</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {stats.active} active · {stats.completed} completed
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => fetchData(true)} disabled={refreshing} className="rounded-full">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {/* Active Campaigns */}
        {campaigns.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900">Active Campaigns</h3>
            </div>
            {campaigns.map(campaign => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
        
        {/* Filter Tabs - Segmented Control Style */}
        <div className="flex bg-slate-100 rounded-full p-1">
          {[
            { id: 'active', label: 'Active', count: stats.active, icon: Zap },
            { id: 'completed', label: 'Done', count: stats.completed, icon: CheckCircle2 },
            { id: 'all', label: 'All', count: stats.total, icon: Target }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex-1 py-2.5 px-3 text-sm font-medium rounded-full transition-all duration-200 flex items-center justify-center gap-1.5 ${
                filter === tab.id 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              data-testid={`filter-${tab.id}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
        
        {/* Challenges List */}
        <div className="space-y-3">
          {filteredChallenges.length > 0 ? (
            filteredChallenges.map((challenge, idx) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                onClaim={claimChallenge}
                index={idx}
              />
            ))
          ) : (
            <div className="harvest-card py-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 mb-1">
                {filter === 'active' ? 'No Active Challenges' : 
                 filter === 'completed' ? 'No Completed Challenges' : 
                 'No Challenges Available'}
              </h3>
              <p className="text-sm text-slate-500 mb-5">
                {filter === 'active' 
                  ? 'Check back soon or join a campaign!'
                  : 'Complete challenges to see them here.'}
              </p>
              {campaigns.length === 0 && (
                <div className="p-4 bg-blue-50 rounded-xl inline-block">
                  <p className="text-sm text-blue-700">
                    💡 Ask your manager to create a campaign to unlock challenges!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Quick Stats Card */}
        <div className="harvest-card bg-gradient-to-r from-slate-50 to-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Award className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Points from Challenges</p>
                <p className="text-xl font-bold text-slate-900">{stats.totalPoints} pts</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase">Completed</p>
              <p className="text-2xl font-bold text-emerald-600">
                {challenges.filter(c => c.state === 'claimed').length}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Celebration Modal */}
      <CelebrationModal 
        challenge={celebrationChallenge} 
        onClose={() => setCelebrationChallenge(null)} 
      />
    </div>
  );
};

export default HarvestChallengesTab;
