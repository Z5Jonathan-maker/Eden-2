/**
 * HarvestProfileTab - Enzy-Style Profile with Premium Badge Collection
 * 
 * Personal stats, badge masonry grid by tier, and rewards progress.
 * Features animated badges, tier filtering, and gamification elements.
 * 
 * Badge Tiers:
 * - Legendary: Gold glow effect
 * - Epic: Purple ring
 * - Rare: Blue accent
 * - Common: Clean gray
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { 
  RefreshCw, Award, Trophy, Flame, Star, Gift, 
  Lock, ChevronRight, Crown, Sparkles, Gem, CheckCircle2,
  TrendingUp, Target, Zap
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Badge Tier Config - Enzy Style
const TIER_CONFIG = {
  legendary: {
    label: 'Legendary',
    icon: Crown,
    bgClass: 'bg-gradient-to-br from-amber-300 to-yellow-500',
    borderClass: 'border-amber-400 ring-4 ring-amber-300/50',
    textClass: 'text-amber-800',
    glowClass: 'shadow-xl shadow-amber-400/40',
    badgeBg: 'bg-amber-100 text-amber-700'
  },
  epic: {
    label: 'Epic',
    icon: Gem,
    bgClass: 'bg-gradient-to-br from-purple-400 to-violet-500',
    borderClass: 'border-purple-400 ring-2 ring-purple-300/50',
    textClass: 'text-purple-800',
    glowClass: 'shadow-lg shadow-purple-400/30',
    badgeBg: 'bg-purple-100 text-purple-700'
  },
  rare: {
    label: 'Rare',
    icon: Sparkles,
    bgClass: 'bg-gradient-to-br from-blue-400 to-cyan-500',
    borderClass: 'border-blue-400 ring-1 ring-blue-300/50',
    textClass: 'text-blue-800',
    glowClass: 'shadow-md shadow-blue-300/20',
    badgeBg: 'bg-blue-100 text-blue-700'
  },
  common: {
    label: 'Common',
    icon: Star,
    bgClass: 'bg-slate-200',
    borderClass: 'border-slate-300',
    textClass: 'text-slate-600',
    glowClass: '',
    badgeBg: 'bg-slate-100 text-slate-600'
  }
};

// Badge Card Component - Enzy Style
const BadgeCard = ({ badge, onClick }) => {
  const tier = badge.tier || badge.rarity || 'common';
  const config = TIER_CONFIG[tier] || TIER_CONFIG.common;
  const isEarned = badge.earned;
  
  return (
    <button
      onClick={() => onClick(badge)}
      className={`relative p-4 rounded-2xl border-2 transition-all duration-200 ${
        isEarned 
          ? `${config.borderClass} ${config.glowClass} bg-white hover:scale-105 active:scale-100` 
          : 'border-slate-200 bg-slate-50 opacity-50 hover:opacity-70'
      }`}
      data-testid={`badge-${badge.id}`}
    >
      <div className={`w-14 h-14 mx-auto rounded-xl flex items-center justify-center ${
        isEarned ? config.bgClass : 'bg-slate-200'
      }`}>
        {isEarned ? (
          <span className="text-3xl">{badge.icon || '🏆'}</span>
        ) : (
          <Lock className="w-6 h-6 text-slate-400" />
        )}
      </div>
      <p className={`text-sm mt-3 font-semibold truncate ${isEarned ? 'text-slate-900' : 'text-slate-400'}`}>
        {badge.name}
      </p>
      {isEarned && (
        <div className={`absolute -top-2 -right-2 w-6 h-6 ${config.bgClass} rounded-full flex items-center justify-center border-2 border-white shadow-md`}>
          <CheckCircle2 className="w-4 h-4 text-white" />
        </div>
      )}
    </button>
  );
};

// Badge Detail Modal - Enzy Style
const BadgeModal = ({ badge, onClose }) => {
  if (!badge) return null;
  
  const tier = badge.tier || badge.rarity || 'common';
  const config = TIER_CONFIG[tier] || TIER_CONFIG.common;
  const TierIcon = config.icon;
  
  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-sm w-full p-6 relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Tier Badge */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <Badge className={`${config.badgeBg} px-4 py-1 text-sm font-bold`}>
            <TierIcon className="w-4 h-4 mr-1.5" />
            {config.label}
          </Badge>
        </div>
        
        {/* Badge Icon */}
        <div className={`w-28 h-28 mx-auto rounded-2xl flex items-center justify-center ${config.bgClass} ${config.glowClass} mt-4`}>
          <span className="text-6xl">{badge.icon || '🏆'}</span>
        </div>
        
        {/* Badge Info */}
        <div className="text-center mt-5">
          <h3 className="harvest-h2 text-slate-900">{badge.name}</h3>
          <p className="text-slate-600 mt-2">{badge.description}</p>
          
          {badge.earned ? (
            <div className="mt-5 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <p className="text-sm text-emerald-700 font-medium flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Earned {badge.earned_at ? new Date(badge.earned_at).toLocaleDateString() : 'recently'}
              </p>
            </div>
          ) : (
            <div className="mt-5 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-sm text-slate-600 flex items-center justify-center gap-2">
                <Lock className="w-4 h-4" />
                {badge.criteria_description || `${badge.criteria_type} ≥ ${badge.criteria_value}`}
              </p>
            </div>
          )}
        </div>
        
        <Button className="w-full mt-5 harvest-btn-secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ icon: Icon, value, label, bgColor, textColor }) => (
  <div className={`p-4 rounded-2xl ${bgColor} transition-all hover:scale-[1.02]`}>
    <p className={`harvest-metric-value ${textColor}`}>{value}</p>
    <p className="harvest-metric-label mt-1">{label}</p>
  </div>
);

// Main Component
const HarvestProfileTab = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);
  
  // Data states
  const [stats, setStats] = useState({
    total_doors: 0,
    total_appointments: 0,
    total_contracts: 0,
    best_streak: 0
  });
  const [badgesByTier, setBadgesByTier] = useState({
    legendary: [],
    epic: [],
    rare: [],
    common: []
  });
  const [badgeCounts, setBadgeCounts] = useState({ earned: 0, total: 0 });
  const [rewardsProgress, setRewardsProgress] = useState([]);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [streakData, setStreakData] = useState({ current_streak: 0, best_streak: 0, multiplier: 1.0 });
  
  const token = localStorage.getItem('eden_token');
  
  // Fetch all data
  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [badgesRes, streakRes, rewardsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/harvest/badges/tiers`, { headers }),
        fetch(`${API_URL}/api/harvest/streak`, { headers }),
        fetch(`${API_URL}/api/harvest/progress/rewards`, { headers }),
        fetch(`${API_URL}/api/canvassing-map/stats`, { headers })
      ]);
      
      if (badgesRes.ok) {
        const data = await badgesRes.json();
        setBadgesByTier(data.badges_by_tier || {});
        setBadgeCounts({ earned: data.earned_count || 0, total: data.total_count || 0 });
      }
      
      if (streakRes.ok) {
        const data = await streakRes.json();
        setStreakData(data);
        setStats(prev => ({ ...prev, best_streak: data.best_streak || 0 }));
      }
      
      if (rewardsRes.ok) {
        const data = await rewardsRes.json();
        setRewardsProgress(data.rewards_progress || []);
        setCurrentPoints(data.current_points || 0);
      }
      
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(prev => ({
          ...prev,
          total_doors: data.week || 0,
          total_appointments: data.appointments || 0,
          total_contracts: data.signed || 0,
          total_points: data.total_points || 0
        }));
      }
    } catch (err) {
      console.error('Failed to fetch profile data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Get badges to display
  const getDisplayBadges = () => {
    if (selectedTier) return badgesByTier[selectedTier] || [];
    return [
      ...badgesByTier.legendary || [],
      ...badgesByTier.epic || [],
      ...badgesByTier.rare || [],
      ...badgesByTier.common || []
    ];
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50">
        <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }
  
  const displayBadges = getDisplayBadges();
  
  return (
    <div className="overflow-y-auto harvest-content bg-slate-50">
      {/* Profile Header */}
      <div className="bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 px-5 pt-6 pb-8 text-white">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-lg font-bold">Profile</h1>
          <Button variant="ghost" size="sm" onClick={() => fetchData(true)} disabled={refreshing} className="text-white hover:bg-white/10 rounded-full">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-5xl border-2 border-white/30 shadow-xl">
            {streakData.current_streak > 0 ? (
              <span className="harvest-flame">🔥</span>
            ) : '👤'}
          </div>
          <div>
            <p className="text-white/80 text-sm uppercase tracking-wide">Total Points</p>
            <p className="harvest-display text-white">{currentPoints}</p>
            <div className="flex items-center gap-2 mt-2">
              {streakData.current_streak > 0 && (
                <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm">
                  <Flame className="w-3 h-3 mr-1" />
                  {streakData.current_streak} day streak
                </Badge>
              )}
              {streakData.multiplier > 1 && (
                <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm">
                  <Zap className="w-3 h-3 mr-1" />
                  {streakData.multiplier}x
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-4 space-y-4 -mt-4">
        {/* This Week Stats */}
        <div className="harvest-card harvest-animate-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900">This Week</h3>
            <TrendingUp className="w-5 h-5 text-slate-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard value={stats.total_doors} label="Doors" bgColor="bg-blue-50" textColor="text-blue-600" />
            <StatCard value={stats.total_appointments} label="Appointments" bgColor="bg-emerald-50" textColor="text-emerald-600" />
            <StatCard value={stats.total_contracts} label="Contracts" bgColor="bg-purple-50" textColor="text-purple-600" />
            <StatCard value={streakData.best_streak} label="Best Streak" bgColor="bg-amber-50" textColor="text-amber-600" />
          </div>
        </div>
        
        {/* Badge Collection */}
        <div className="harvest-card harvest-animate-in harvest-animate-in-delay-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-orange-500" />
              <h3 className="font-bold text-slate-900">
                Badges ({badgeCounts.earned}/{badgeCounts.total})
              </h3>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </div>
          
          {/* Tier Filter - Pill Style */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-1 px-1">
            <Button 
              size="sm" 
              className={`rounded-full shrink-0 ${selectedTier === null ? 'harvest-btn-primary' : 'harvest-btn-secondary'}`}
              onClick={() => setSelectedTier(null)}
            >
              All
            </Button>
            {Object.entries(TIER_CONFIG).map(([tier, config]) => {
              const TierIcon = config.icon;
              const count = (badgesByTier[tier] || []).filter(b => b.earned).length;
              const total = (badgesByTier[tier] || []).length;
              return (
                <Button
                  key={tier}
                  size="sm"
                  className={`rounded-full shrink-0 ${
                    selectedTier === tier 
                      ? `${config.bgClass} text-white border-0` 
                      : 'harvest-btn-secondary'
                  }`}
                  onClick={() => setSelectedTier(tier)}
                >
                  <TierIcon className="w-3 h-3 mr-1.5" />
                  {config.label} ({count}/{total})
                </Button>
              );
            })}
          </div>
          
          {/* Badges Grid */}
          <div className="grid grid-cols-3 gap-3">
            {displayBadges.slice(0, 9).map((badge, idx) => (
              <BadgeCard 
                key={badge.id} 
                badge={badge}
                onClick={setSelectedBadge}
              />
            ))}
          </div>
          
          {displayBadges.length === 0 && (
            <div className="text-center py-8">
              <Award className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-slate-600 font-medium">No badges in this category</p>
            </div>
          )}
          
          {displayBadges.length > 9 && (
            <Button variant="outline" className="w-full mt-4 rounded-full">
              View All {displayBadges.length} Badges
            </Button>
          )}
        </div>
        
        {/* Rewards Progress */}
        <div className="harvest-card harvest-animate-in harvest-animate-in-delay-2">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-purple-500" />
            <h3 className="font-bold text-slate-900">Rewards Progress</h3>
          </div>
          
          <div className="space-y-3">
            {rewardsProgress.length > 0 ? (
              rewardsProgress.slice(0, 3).map(reward => (
                <div 
                  key={reward.reward_id}
                  className={`p-4 rounded-xl border transition-all ${
                    reward.can_redeem 
                      ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-400/20' 
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {reward.image_url ? (
                        <img src={reward.image_url} alt="" className="w-10 h-10 rounded-lg" />
                      ) : (
                        <div className="w-10 h-10 bg-purple-200 rounded-lg flex items-center justify-center">
                          <Trophy className="w-5 h-5 text-purple-600" />
                        </div>
                      )}
                      <span className="font-semibold text-slate-900">{reward.name}</span>
                    </div>
                    <span className="text-sm font-bold text-purple-600">
                      {reward.points_required} pts
                    </span>
                  </div>
                  <Progress value={reward.percent_complete} className="h-2" />
                  <div className="flex justify-between mt-2 text-sm">
                    <span className="text-slate-500">{reward.percent_complete}%</span>
                    {reward.can_redeem ? (
                      <span className="text-emerald-600 font-semibold">Ready to redeem!</span>
                    ) : (
                      <span className="text-slate-500">{reward.points_remaining} pts to go</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Gift className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-600 font-medium">No rewards available</p>
                <p className="text-sm text-slate-400 mt-1">Check back soon!</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Badge Detail Modal */}
      <BadgeModal badge={selectedBadge} onClose={() => setSelectedBadge(null)} />
    </div>
  );
};

export default HarvestProfileTab;
