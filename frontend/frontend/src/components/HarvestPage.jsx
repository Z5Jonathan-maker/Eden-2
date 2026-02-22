/**
 * HarvestPage - Operation Eden Tactical Canvassing Experience
 *
 * Two modes:
 * - BASE MODE: 5-tab gamification dashboard (Map, Today, Leaderboard, Challenges, Profile)
 * - FIELD MODE: Map-only canvassing with 6-button quick-tap (DoorMamba-class UX)
 *
 * Field Mode entry: Prominent "GO FIELD" button on the map tab.
 * Field Mode exit: END button → Session Summary → back to base.
 */
import React, { useState, useEffect, useCallback } from 'react';
import HarvestMap from './HarvestMap';
import HarvestTodayTab from './HarvestTodayTab';
import HarvestProfileTab from './HarvestProfileTab';
import HarvestChallengesTab from './HarvestChallengesTab';
import FieldMode from './harvest/FieldMode';
import SessionSummary from './harvest/SessionSummary';
import { Badge } from '../shared/ui/badge';
import { Progress } from '../shared/ui/progress';
import {
  Map as MapIcon,
  Trophy,
  Target,
  User,
  Flame,
  ChevronUp,
  ChevronDown,
  Filter,
  RefreshCw,
  Loader2,
  Calendar,
  TrendingUp,
  Crown,
  Medal,
  Award,
  Zap,
  Crosshair,
} from 'lucide-react';
import { FEATURE_ICONS } from '../assets/badges';
import { apiGet } from '@/lib/api';

const API_URL = import.meta.env.REACT_APP_BACKEND_URL;

// ============================================
// ENZY-STYLE LEADERBOARD TAB
// ============================================

const LeaderboardTab = ({ leaderboard, period, setPeriod, loading, fetchLeaderboard }) => {
  const periods = [
    { value: 'day', label: 'Today' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'all', label: 'All Time' },
  ];

  const podiumPlayers = leaderboard.slice(0, 3);
  const restOfLeaderboard = leaderboard.slice(3);

  const getPodiumOrder = () => {
    if (podiumPlayers.length < 3) return podiumPlayers;
    return [podiumPlayers[1], podiumPlayers[0], podiumPlayers[2]];
  };

  const getTrendIcon = (trend) => {
    if (trend > 0) return <TrendingUp className="w-3 h-3 text-emerald-500" />;
    if (trend < 0) return <ChevronDown className="w-3 h-3 text-red-500" />;
    return null;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/95">
      {/* Period Filter */}
      <div className="px-4 pt-4 pb-2 bg-zinc-900 border-b border-zinc-700/50">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex bg-zinc-800/50 rounded-full p-1 border border-zinc-700/30">
            {periods.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`flex-1 py-2 px-3 text-sm font-mono uppercase tracking-wider rounded-full transition-all duration-200 ${
                  period === p.value
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                data-testid={`period-${p.value}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchLeaderboard}
            disabled={loading}
            className="w-10 h-10 bg-zinc-800/50 rounded-full flex items-center justify-center hover:bg-zinc-700/50 border border-zinc-700/30 transition-all active:scale-95 shrink-0"
            data-testid="refresh-leaderboard"
          >
            <RefreshCw className={`w-4 h-4 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto harvest-content bg-zinc-900/95">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="spinner-tactical w-8 h-8" />
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-20 h-20 bg-zinc-800/50 rounded-full flex items-center justify-center mb-4 border border-zinc-700/30">
              <Trophy className="w-10 h-10 text-zinc-600" />
            </div>
            <p className="text-lg font-tactical font-bold text-white uppercase">No Rankings Yet</p>
            <p className="text-sm text-zinc-500 font-mono mt-1">
              Start knocking doors to climb the leaderboard!
            </p>
          </div>
        ) : (
          <>
            {/* Podium */}
            {podiumPlayers.length >= 3 && (
              <div className="px-4 pt-6 pb-4 bg-gradient-to-b from-zinc-900 to-zinc-900/95">
                <div className="harvest-podium">
                  {getPodiumOrder().map((player, displayIdx) => {
                    const actualRank = displayIdx === 1 ? 1 : displayIdx === 0 ? 2 : 3;
                    const pillarClass =
                      actualRank === 1
                        ? 'harvest-podium-1st'
                        : actualRank === 2
                          ? 'harvest-podium-2nd'
                          : 'harvest-podium-3rd';
                    const medal = actualRank === 1 ? '🥇' : actualRank === 2 ? '🥈' : '🥉';

                    return (
                      <div key={player.user_id || displayIdx} className="harvest-podium-step">
                        <div className="relative">
                          <div
                            className={`harvest-podium-avatar ${
                              actualRank === 1
                                ? 'ring-4 ring-amber-400'
                                : actualRank === 2
                                  ? 'ring-4 ring-zinc-400'
                                  : 'ring-4 ring-orange-400'
                            }`}
                            style={{
                              backgroundColor: `hsl(${((player.user_id?.charCodeAt(0) || 0) * 30) % 360}, 70%, 45%)`,
                            }}
                          >
                            <div className="w-full h-full flex items-center justify-center text-white text-2xl font-tactical font-bold">
                              {(player.user_name || player.name || '?').charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <span className="absolute -bottom-1 -right-1 text-xl">{medal}</span>
                        </div>
                        <p className="text-sm font-tactical font-semibold text-white mt-2 truncate max-w-[80px]">
                          {player.user_name || player.name}
                        </p>
                        <p className="text-xs text-zinc-500 font-mono">{player.points || 0} pts</p>
                        <div className={pillarClass}>
                          <span className="text-lg font-tactical">{actualRank}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Rest */}
            <div className="px-4 space-y-2 pb-4">
              {(podiumPlayers.length < 3 ? leaderboard : restOfLeaderboard).map((entry, idx) => {
                const rank = podiumPlayers.length < 3 ? idx + 1 : idx + 4;
                return (
                  <div
                    key={entry.user_id || idx}
                    className="card-tactical flex items-center gap-3 p-4 harvest-animate-in"
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-tactical font-bold text-sm ${
                        rank <= 3
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/30'
                      }`}
                    >
                      {rank}
                    </div>

                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-tactical font-semibold"
                      style={{
                        backgroundColor: `hsl(${((entry.user_id?.charCodeAt(0) || 0) * 30) % 360}, 60%, 45%)`,
                      }}
                    >
                      {(entry.user_name || entry.name || '?').charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-tactical font-semibold text-white truncate">
                        {entry.user_name || entry.name}
                      </p>
                      <p className="text-xs text-zinc-500 font-mono">
                        {entry.visits || entry.total_visits || 0} doors
                      </p>
                    </div>

                    <div className="text-right flex items-center gap-2 shrink-0">
                      <div className="flex flex-col items-end">
                        <p className="font-tactical font-bold text-orange-400 text-lg">
                          {entry.points || 0}
                        </p>
                        <p className="text-xs text-zinc-600 font-mono">pts</p>
                      </div>
                      {getTrendIcon(entry.trend)}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ============================================
// MAIN HARVEST PAGE COMPONENT
// ============================================

const HarvestPage = () => {
  const [activeTab, setActiveTab] = useState('map');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState(['NA', 'NI', 'RN', 'FU', 'AP', 'DL']);

  // Field Mode state
  const [fieldModeActive, setFieldModeActive] = useState(false);
  const [sessionSummary, setSessionSummary] = useState(null);

  // Data states
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('day');
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [myStats, setMyStats] = useState({
    today: 0,
    week: 0,
    signed: 0,
    appointments: 0,
    streak: 0,
    multiplier: 1.0,
  });

  // Filter options — new 6-pin system
  const filterOptions = [
    { code: 'NA', label: 'No Answer', color: '#FBBF24' },
    { code: 'NI', label: 'Not Interested', color: '#EF4444' },
    { code: 'RN', label: 'Renter', color: '#F97316' },
    { code: 'FU', label: 'Follow Up', color: '#8B5CF6' },
    { code: 'AP', label: 'Appointment', color: '#3B82F6' },
    { code: 'DL', label: 'Deal', color: '#10B981' },
  ];

  const toggleFilter = (code) => {
    setActiveFilters((prev) =>
      prev.includes(code) ? prev.filter((f) => f !== code) : [...prev, code]
    );
  };

  const selectAllFilters = () => setActiveFilters(filterOptions.map((f) => f.code));
  const clearAllFilters = () => setActiveFilters([]);

  // Fetch functions
  const fetchLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    try {
      const res = await apiGet(`/api/canvassing-map/leaderboard?period=${leaderboardPeriod}`);
      if (res.ok) {
        setLeaderboard(res.data.leaderboard || res.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, [leaderboardPeriod]);

  const fetchMyStats = useCallback(async () => {
    try {
      const res = await apiGet('/api/canvassing-map/stats');
      if (res.ok) {
        setMyStats(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchMyStats();
    if (activeTab === 'leaderboard') fetchLeaderboard();
  }, [activeTab, fetchLeaderboard, fetchMyStats]);

  useEffect(() => {
    if (activeTab === 'leaderboard') fetchLeaderboard();
  }, [leaderboardPeriod, fetchLeaderboard, activeTab]);

  // Field Mode handlers
  const handleEnterFieldMode = () => {
    setFieldModeActive(true);
    setSessionSummary(null);
  };

  const handleEndFieldMode = (summary) => {
    setFieldModeActive(false);
    if (summary) {
      setSessionSummary(summary);
    }
    fetchMyStats();
  };

  const handleCloseSummary = () => {
    setSessionSummary(null);
  };

  // Tab configuration
  const tabs = [
    { id: 'map', label: 'Map', icon: MapIcon },
    { id: 'today', label: 'Today', icon: Calendar },
    { id: 'leaderboard', label: 'Ranks', icon: Trophy },
    { id: 'challenges', label: 'Challenges', icon: Target },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  // ---- FIELD MODE: Full takeover ----
  if (fieldModeActive) {
    return <FieldMode onEndSession={handleEndFieldMode} />;
  }

  // ---- SESSION SUMMARY: Payoff screen ----
  if (sessionSummary) {
    return <SessionSummary summary={sessionSummary} onClose={handleCloseSummary} />;
  }

  // ---- BASE MODE: Normal 5-tab dashboard ----
  return (
    <div className="h-[calc(100dvh-64px)] flex flex-col bg-zinc-900" data-testid="harvest-page">
      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {/* Map Tab */}
        {activeTab === 'map' && (
          <div className="h-full flex flex-col">
            {/* Top bar: Filter + GO FIELD button */}
            <div className="absolute top-3 right-3 z-[1100] flex items-center gap-2">
              {/* GO FIELD MODE button */}
              <button
                onClick={handleEnterFieldMode}
                className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-4 py-2 flex items-center gap-2 font-bold text-sm shadow-lg active:scale-95 transition-all"
                data-testid="enter-field-mode"
              >
                <Crosshair className="w-4 h-4" />
                GO FIELD
              </button>

              {/* Filter button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="bg-zinc-900/85 backdrop-blur-lg rounded-lg px-3 py-2 border border-zinc-700/50 flex items-center gap-1.5 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 transition-all shadow-lg"
                data-testid="toggle-filters"
              >
                <Filter className="w-4 h-4" />
                <span className="text-xs font-mono">Filter</span>
                {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {/* Filter Panel */}
              {showFilters && (
                <div
                  className="absolute top-full right-0 mt-2 bg-zinc-900/90 backdrop-blur-lg rounded-xl p-3 border border-zinc-700/50 min-w-[260px]"
                  data-testid="filter-panel"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Status</span>
                    <div className="flex gap-2">
                      <button onClick={selectAllFilters} className="text-[10px] text-orange-400 hover:underline font-mono" data-testid="select-all-filters">All</button>
                      <span className="text-zinc-700">|</span>
                      <button onClick={clearAllFilters} className="text-[10px] text-zinc-500 hover:underline font-mono" data-testid="clear-all-filters">None</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {filterOptions.map(({ code, label, color }) => (
                      <button
                        key={code}
                        onClick={() => toggleFilter(code)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-mono uppercase transition-all ${
                          activeFilters.includes(code)
                            ? 'text-white shadow-sm'
                            : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/30'
                        }`}
                        style={activeFilters.includes(code) ? { backgroundColor: color } : {}}
                        data-testid={`filter-${code}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Map */}
            <div className="flex-1 relative min-h-0">
              <HarvestMap onPinStatusChange={fetchMyStats} activeFilters={activeFilters} />
            </div>

            {/* Stats Footer */}
            <div className="bg-zinc-900 border-t border-zinc-800/50 px-3 py-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 font-mono">TODAY <span className="text-white font-bold">{myStats.today || 0}</span></span>
                  <span className="text-zinc-500 font-mono">WEEK <span className="text-white font-bold">{myStats.week || 0}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  {myStats.streak > 0 && (
                    <span className="text-orange-400 font-bold">🔥{myStats.streak}</span>
                  )}
                  <span className="text-zinc-500 font-mono">DEALS <span className="text-green-400 font-bold">{myStats.signed || myStats.deals || 0}</span></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Today Tab */}
        {activeTab === 'today' && <HarvestTodayTab dailyGoal={75} />}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <LeaderboardTab
            leaderboard={leaderboard}
            period={leaderboardPeriod}
            setPeriod={setLeaderboardPeriod}
            loading={loadingLeaderboard}
            fetchLeaderboard={fetchLeaderboard}
          />
        )}

        {/* Challenges Tab */}
        {activeTab === 'challenges' && <HarvestChallengesTab />}

        {/* Profile Tab */}
        {activeTab === 'profile' && <HarvestProfileTab />}
      </div>

      {/* Bottom Navigation */}
      <div className="bg-zinc-900 border-t border-zinc-700/50 px-1 py-1 safe-area-inset-bottom">
        <div className="grid grid-cols-5 max-w-lg mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1.5 rounded-lg transition-all ${
                  isActive
                    ? 'bg-orange-500/10 text-orange-400'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                data-testid={`harvest-${tab.id}-tab`}
              >
                <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-orange-400' : ''}`} />
                <span
                  className={`text-[9px] font-mono uppercase tracking-wider ${isActive ? 'text-orange-400' : ''}`}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-orange-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HarvestPage;
