/**
 * HarvestPage - Operation Eden Tactical Canvassing Experience
 *
 * Two modes:
 * - BASE MODE: 5-tab gamification dashboard (Map, Today, Leaderboard, Challenges, Profile)
 * - FIELD MODE: Map-only canvassing with 6-button quick-tap (DoorMamba-class UX)
 *
 * Field Mode entry: Prominent "GO FIELD" button on the map tab.
 * Field Mode exit: END button -> Session Summary -> back to base.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import HarvestMap from './HarvestMap';
import HarvestTodayTab from './HarvestTodayTab';
import HarvestProfileTab from './HarvestProfileTab';
import HarvestChallengesTab from './HarvestChallengesTab';
import FieldMode from './harvest/FieldMode';
import SessionSummary from './harvest/SessionSummary';
import {
  Map as MapIcon, Trophy, Target, User, Flame, ChevronUp, ChevronDown,
  Filter, RefreshCw, Calendar, TrendingUp, Crosshair, DoorOpen, BarChart3, MapPin,
} from 'lucide-react';
import { apiGet } from '@/lib/api';
import { toast } from 'sonner';

const DAILY_DOOR_TARGET = 75;

const DailyTargetWidget = ({ doorsToday, dailyTarget = DAILY_DOOR_TARGET }) => {
  const progress = Math.min((doorsToday / dailyTarget) * 100, 100);
  const isComplete = doorsToday >= dailyTarget;
  const remaining = Math.max(dailyTarget - doorsToday, 0);
  const progressColor = isComplete ? 'bg-emerald-500' : progress >= 75 ? 'bg-orange-400' : progress >= 50 ? 'bg-amber-500' : 'bg-zinc-500';
  const glowClass = isComplete ? 'shadow-[0_0_20px_rgba(16,185,129,0.3)]' : progress >= 75 ? 'shadow-[0_0_12px_rgba(249,115,22,0.2)]' : '';

  return (
    <div className={`bg-zinc-800/60 border border-zinc-700/40 rounded-xl p-4 transition-all duration-500 ${glowClass}`} data-testid="daily-target-widget">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isComplete ? 'bg-emerald-500/20' : 'bg-orange-500/15'}`}>
            <Target className={`w-4 h-4 ${isComplete ? 'text-emerald-400' : 'text-orange-400'}`} />
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-zinc-400">Daily Target</p>
            <p className="text-sm font-tactical font-bold text-white">{isComplete ? 'TARGET CRUSHED' : `${remaining} doors to go`}</p>
          </div>
        </div>
        <p className={`text-2xl font-tactical font-black ${isComplete ? 'text-emerald-400' : 'text-white'}`}>
          {doorsToday}<span className="text-sm text-zinc-500 font-normal">/{dailyTarget}</span>
        </p>
      </div>
      <div className="w-full h-2.5 bg-zinc-700/50 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ease-out ${progressColor}`} style={{ width: `${progress}%` }} />
      </div>
      <div className="flex justify-between mt-1.5">
        {[25, 50, 75, 100].map((pct) => (
          <span key={pct} className={`text-[10px] font-mono ${progress >= pct ? 'text-orange-400' : 'text-zinc-600'}`}>{pct}%</span>
        ))}
      </div>
    </div>
  );
};

// ============================================
// KPI STAT CARD
// ============================================

const KpiCard = ({ icon: Icon, label, value, subValue, accentColor = 'text-orange-400', bgAccent = 'bg-orange-500/15' }) => (
  <div className="bg-zinc-800/50 border border-zinc-700/30 rounded-xl p-3 hover:border-zinc-600/50 hover:bg-zinc-800/70 transition-all duration-200 group">
    <div className="flex items-center gap-2 mb-1.5">
      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${bgAccent} group-hover:scale-110 transition-transform`}>
        <Icon className={`w-3.5 h-3.5 ${accentColor}`} />
      </div>
      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">{label}</span>
    </div>
    <p className={`text-xl font-tactical font-black ${accentColor}`}>{value}</p>
    {subValue && (
      <p className="text-[10px] font-mono text-zinc-500 mt-0.5">{subValue}</p>
    )}
  </div>
);

// ============================================
// OPERATION HEADER
// ============================================

const OperationHeader = ({ myStats }) => {
  const doorsToday = myStats.today || 0;
  const conversions = myStats.signed || myStats.deals || 0;
  const streak = myStats.streak || 0;

  return (
    <div className="bg-gradient-to-r from-zinc-900 via-zinc-800/80 to-zinc-900 border-b border-zinc-700/40 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500/15 rounded-lg flex items-center justify-center border border-orange-500/20">
            <Crosshair className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-base font-tactical font-black text-white uppercase tracking-wide">
              Operation Harvest
            </h1>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
              Tactical Canvassing Command
            </p>
          </div>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 bg-orange-500/10 border border-orange-500/20 rounded-full px-2.5 py-1">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-xs font-tactical font-bold text-orange-400">{streak}</span>
          </div>
        )}
      </div>

      {/* Inline stats ticker */}
      <div className="flex items-center gap-4 mt-2.5 overflow-x-auto scrollbar-hide">
        <span className="text-[11px] font-mono text-zinc-400 whitespace-nowrap">
          <span className="text-white font-bold">{doorsToday}</span> doors knocked
        </span>
        <span className="w-px h-3 bg-zinc-700" />
        <span className="text-[11px] font-mono text-zinc-400 whitespace-nowrap">
          <span className="text-emerald-400 font-bold">{conversions}</span> conversions
        </span>
        <span className="w-px h-3 bg-zinc-700" />
        <span className="text-[11px] font-mono text-zinc-400 whitespace-nowrap">
          <span className="text-blue-400 font-bold">{myStats.appointments || 0}</span> appointments
        </span>
      </div>
    </div>
  );
};

// ============================================
// KPI STATS ROW
// ============================================

const KpiStatsRow = ({ myStats }) => {
  const doorsToday = myStats.today || 0;
  const weekDoors = myStats.week || 0;
  const conversions = myStats.signed || myStats.deals || 0;
  const conversionRate = weekDoors > 0 ? ((conversions / weekDoors) * 100).toFixed(1) : '0.0';
  const weeklyRank = myStats.rank || myStats.weekly_rank || '--';

  return (
    <div className="grid grid-cols-4 gap-2 px-4 py-3">
      <KpiCard
        icon={DoorOpen}
        label="Today"
        value={doorsToday}
        subValue={`${weekDoors} this week`}
        accentColor="text-orange-400"
        bgAccent="bg-orange-500/15"
      />
      <KpiCard
        icon={BarChart3}
        label="Conv. Rate"
        value={`${conversionRate}%`}
        subValue={`${conversions} deals`}
        accentColor="text-emerald-400"
        bgAccent="bg-emerald-500/15"
      />
      <KpiCard
        icon={MapPin}
        label="Territory"
        value={myStats.territory_name || myStats.active_territory || 'HQ'}
        subValue="active zone"
        accentColor="text-blue-400"
        bgAccent="bg-blue-500/15"
      />
      <KpiCard
        icon={Trophy}
        label="Rank"
        value={typeof weeklyRank === 'number' ? `#${weeklyRank}` : weeklyRank}
        subValue="weekly"
        accentColor="text-amber-400"
        bgAccent="bg-amber-500/15"
      />
    </div>
  );
};

// ============================================
// ENZY-STYLE LEADERBOARD TAB
// ============================================

const LEADERBOARD_PERIODS = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'all', label: 'All Time' },
];

const getTrendIcon = (trend) => {
  if (trend > 0) return <TrendingUp className="w-3 h-3 text-emerald-500" />;
  if (trend < 0) return <ChevronDown className="w-3 h-3 text-red-500" />;
  return null;
};

const avatarBg = (id) => `hsl(${((id?.charCodeAt(0) || 0) * 30) % 360}, 65%, 45%)`;
const initial = (entry) => (entry.user_name || entry.name || '?').charAt(0).toUpperCase();

const PodiumCard = ({ player, actualRank }) => {
  const ringClass = actualRank === 1 ? 'ring-4 ring-amber-400' : actualRank === 2 ? 'ring-4 ring-zinc-400' : 'ring-4 ring-orange-400';
  const pillarClass = actualRank === 1 ? 'harvest-podium-1st' : actualRank === 2 ? 'harvest-podium-2nd' : 'harvest-podium-3rd';
  const medal = actualRank === 1 ? '\u{1F947}' : actualRank === 2 ? '\u{1F948}' : '\u{1F949}';

  return (
    <div className="harvest-podium-step">
      <div className="relative">
        <div className={`harvest-podium-avatar ${ringClass}`} style={{ backgroundColor: avatarBg(player.user_id) }}>
          <div className="w-full h-full flex items-center justify-center text-white text-2xl font-tactical font-bold">{initial(player)}</div>
        </div>
        <span className="absolute -bottom-1 -right-1 text-xl">{medal}</span>
      </div>
      <p className="text-sm font-tactical font-semibold text-white mt-2 truncate max-w-[80px]">{player.user_name || player.name}</p>
      <p className="text-xs text-zinc-500 font-mono">{player.points || 0} pts</p>
      <div className={pillarClass}><span className="text-lg font-tactical">{actualRank}</span></div>
    </div>
  );
};

const LeaderboardRow = ({ entry, rank, delay }) => (
  <div className="card-tactical flex items-center gap-3 p-4 harvest-animate-in" style={{ animationDelay: `${delay}s` }}>
    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-tactical font-bold text-sm ${rank <= 3 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-zinc-800/50 text-zinc-400 border border-zinc-700/30'}`}>{rank}</div>
    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-tactical font-semibold" style={{ backgroundColor: avatarBg(entry.user_id) }}>{initial(entry)}</div>
    <div className="flex-1 min-w-0">
      <p className="font-tactical font-semibold text-white truncate">{entry.user_name || entry.name}</p>
      <p className="text-xs text-zinc-500 font-mono">{entry.visits || entry.total_visits || 0} doors</p>
    </div>
    <div className="text-right flex items-center gap-2 shrink-0">
      <div className="flex flex-col items-end">
        <p className="font-tactical font-bold text-orange-400 text-lg">{entry.points || 0}</p>
        <p className="text-xs text-zinc-600 font-mono">pts</p>
      </div>
      {getTrendIcon(entry.trend)}
    </div>
  </div>
);

const LeaderboardTab = ({ leaderboard, period, setPeriod, loading, fetchLeaderboard }) => {
  const podiumPlayers = leaderboard.slice(0, 3);
  const restOfLeaderboard = leaderboard.slice(3);
  const podiumOrder = podiumPlayers.length >= 3 ? [podiumPlayers[1], podiumPlayers[0], podiumPlayers[2]] : podiumPlayers;
  const rankMap = [2, 1, 3];

  return (
    <div className="flex flex-col h-full bg-zinc-900/95">
      <div className="px-4 pt-4 pb-2 bg-zinc-900 border-b border-zinc-700/50">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex bg-zinc-800/50 rounded-full p-1 border border-zinc-700/30">
            {LEADERBOARD_PERIODS.map((p) => (
              <button key={p.value} onClick={() => setPeriod(p.value)} className={`flex-1 py-2 px-3 text-sm font-mono uppercase tracking-wider rounded-full transition-all duration-200 ${period === p.value ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'text-zinc-500 hover:text-zinc-300'}`} data-testid={`period-${p.value}`}>{p.label}</button>
            ))}
          </div>
          <button onClick={fetchLeaderboard} disabled={loading} className="w-10 h-10 bg-zinc-800/50 rounded-full flex items-center justify-center hover:bg-zinc-700/50 border border-zinc-700/30 transition-all active:scale-95 shrink-0" data-testid="refresh-leaderboard">
            <RefreshCw className={`w-4 h-4 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto harvest-content bg-zinc-900/95">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="spinner-tactical w-8 h-8" /></div>
        ) : leaderboard.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-20 h-20 bg-zinc-800/50 rounded-full flex items-center justify-center mb-4 border border-zinc-700/30"><Trophy className="w-10 h-10 text-zinc-600" /></div>
            <p className="text-lg font-tactical font-bold text-white uppercase">No Rankings Yet</p>
            <p className="text-sm text-zinc-500 font-mono mt-1">Start knocking doors to climb the leaderboard!</p>
          </div>
        ) : (
          <>
            {podiumPlayers.length >= 3 && (
              <div className="px-4 pt-6 pb-4 bg-gradient-to-b from-zinc-900 to-zinc-900/95">
                <div className="harvest-podium">
                  {podiumOrder.map((player, i) => (
                    <PodiumCard key={player.user_id || i} player={player} actualRank={rankMap[i]} />
                  ))}
                </div>
              </div>
            )}
            <div className="px-4 space-y-2 pb-4">
              {(podiumPlayers.length < 3 ? leaderboard : restOfLeaderboard).map((entry, idx) => (
                <LeaderboardRow key={entry.user_id || idx} entry={entry} rank={podiumPlayers.length < 3 ? idx + 1 : idx + 4} delay={idx * 0.05} />
              ))}
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

  // Filter options -- 6-pin system
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
      } else if (res.status !== 401) {
        toast.error('Failed to load leaderboard');
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

  // Tab configuration with count badges
  const tabBadges = useMemo(() => ({
    today: myStats.today || 0,
    challenges: myStats.active_challenges || null,
  }), [myStats]);

  const tabs = [
    { id: 'map', label: 'Map', icon: MapIcon },
    { id: 'today', label: 'Today', icon: Calendar },
    { id: 'leaderboard', label: 'Ranks', icon: Trophy },
    { id: 'challenges', label: 'Ops', icon: Target },
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
    <div className="h-[calc(100dvh-64px)] flex flex-col bg-[#0a0a0a]" data-testid="harvest-page">
      {/* Operation Header */}
      <OperationHeader myStats={myStats} />

      {/* Non-map tabs get KPI row + daily target */}
      {activeTab !== 'map' && (
        <div className="bg-[#0a0a0a]">
          <KpiStatsRow myStats={myStats} />
          <div className="px-4 pb-3">
            <DailyTargetWidget doorsToday={myStats.today || 0} />
          </div>
        </div>
      )}

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
                className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-4 py-2 flex items-center gap-2 font-bold text-sm shadow-lg shadow-orange-500/20 active:scale-95 transition-all hover:shadow-orange-500/40"
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

            {/* Map Stats Footer with daily progress */}
            <div className="bg-[#0a0a0a] border-t border-zinc-800/50 px-3 py-2">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 font-mono">
                    TODAY <span className="text-white font-bold">{myStats.today || 0}</span>
                    <span className="text-zinc-600">/{DAILY_DOOR_TARGET}</span>
                  </span>
                  <span className="text-zinc-500 font-mono">WEEK <span className="text-white font-bold">{myStats.week || 0}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  {myStats.streak > 0 && (
                    <span className="text-orange-400 font-bold flex items-center gap-0.5">
                      <Flame className="w-3 h-3" />{myStats.streak}
                    </span>
                  )}
                  <span className="text-zinc-500 font-mono">DEALS <span className="text-green-400 font-bold">{myStats.signed || myStats.deals || 0}</span></span>
                </div>
              </div>
              {/* Mini progress bar */}
              <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500/80 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(((myStats.today || 0) / DAILY_DOOR_TARGET) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Today Tab */}
        {activeTab === 'today' && <HarvestTodayTab dailyGoal={DAILY_DOOR_TARGET} />}

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

      {/* Bottom Navigation -- upgraded with badges */}
      <div className="bg-[#0a0a0a] border-t border-zinc-700/40 px-1 py-1 safe-area-inset-bottom">
        <div className="grid grid-cols-5 max-w-lg mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const badge = tabBadges[tab.id];

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1.5 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-orange-500/10 text-orange-400'
                    : 'text-zinc-500 hover:text-zinc-300 active:scale-95'
                }`}
                data-testid={`harvest-${tab.id}-tab`}
              >
                <div className="relative">
                  <Icon className={`w-4 h-4 mb-0.5 transition-colors ${isActive ? 'text-orange-400' : ''}`} />
                  {badge != null && badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[14px] h-[14px] bg-orange-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[9px] font-mono uppercase tracking-wider transition-colors ${isActive ? 'text-orange-400' : ''}`}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-orange-500 rounded-full" />
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
