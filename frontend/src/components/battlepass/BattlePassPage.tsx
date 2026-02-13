import React, { useEffect, useMemo, useState } from 'react';
import { Award, ListChecks, ShieldAlert, Trophy, Zap } from 'lucide-react';
import { toast } from 'sonner';
import TierProgressTab from './TierProgressTab';
import MissionsTab from './MissionsTab';
import LeaderboardTab from './LeaderboardTab';
import { leaderboardSeed, missionsSeed, tiers } from './mockData';
import { BattlePassState, LeaderboardEntry, Mission } from './types';
import './AnimationStyles.css';

type TabKey = 'progress' | 'missions' | 'leaderboard';
const API_URL = process.env.REACT_APP_BACKEND_URL || '';
const STORAGE_KEY = 'eden_battle_pass_state_v3';

const initialState: BattlePassState = {
  currentXp: 820,
  currentLevel: 2,
  claimedRewardIds: [],
  completedMissionIds: [],
};

const getLevelFromXp = (xp: number) => {
  let level = 1;
  for (const tier of tiers) {
    if (xp >= tier.xpRequired) level = tier.level;
  }
  return level;
};

const mapRemoteMission = (raw: any, fallbackType: 'daily' | 'weekly' | 'seasonal'): Mission => ({
  id: String(raw.id || `${fallbackType}-${raw.name || raw.title || Math.random()}`),
  title: raw.name || raw.title || 'Mission',
  description: raw.description || 'Complete objective for XP.',
  rarity: raw.rarity || 'common',
  type: raw.type || fallbackType,
  progress: Number(raw.current_progress ?? raw.progress ?? 0),
  target: Number(raw.target_value ?? raw.target ?? 1),
  xp: Number(raw.xp_reward ?? raw.xp ?? 100),
});

const getResetString = (type: 'daily' | 'weekly' | 'seasonal', seasonEndsAt: Date) => {
  const now = new Date();
  let target = new Date(now);
  if (type === 'daily') {
    target.setHours(24, 0, 0, 0);
  } else if (type === 'weekly') {
    const day = now.getDay();
    const daysToMonday = (8 - day) % 7 || 7;
    target.setDate(now.getDate() + daysToMonday);
    target.setHours(0, 0, 0, 0);
  } else {
    target = seasonEndsAt;
  }
  const ms = Math.max(0, target.getTime() - now.getTime());
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
};

const BattlePassPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('progress');
  const [state, setState] = useState<BattlePassState>(initialState);
  const [missions, setMissions] = useState<Mission[]>(missionsSeed);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(leaderboardSeed);
  const [seasonEndsAt, setSeasonEndsAt] = useState<Date>(
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 42)
  );
  const [recentXpGain, setRecentXpGain] = useState(0);
  const [recentUnlockedTier, setRecentUnlockedTier] = useState<number | null>(null);
  const [claimFxMissionId, setClaimFxMissionId] = useState<string | null>(null);
  const [tierShake, setTierShake] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const persisted = localStorage.getItem(STORAGE_KEY);
      if (!persisted) return;
      const parsed = JSON.parse(persisted);
      if (parsed?.state) setState(parsed.state);
      if (Array.isArray(parsed?.missions)) setMissions(parsed.missions);
      if (Array.isArray(parsed?.leaderboard)) setLeaderboard(parsed.leaderboard);
      if (parsed?.seasonEndsAt) setSeasonEndsAt(new Date(parsed.seasonEndsAt));
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state, missions, leaderboard, seasonEndsAt: seasonEndsAt.toISOString() })
    );
  }, [state, missions, leaderboard, seasonEndsAt]);

  useEffect(() => {
    let alive = true;
    const token = localStorage.getItem('eden_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

    const hydrate = async () => {
      try {
        if (!API_URL) return;
        const [progressRes, missionsRes, leaderboardRes] = await Promise.all([
          fetch(`${API_URL}/api/battle-pass/progress`, { headers }),
          fetch(`${API_URL}/api/battle-pass/missions`, { headers }),
          fetch(`${API_URL}/api/battle-pass/leaderboard?limit=20`, { headers }),
        ]);

        if (alive && progressRes.ok) {
          const data = await progressRes.json();
          const remoteXp = Number(data.current_xp || 0);
          const remoteLevel = Number(data.current_tier || getLevelFromXp(remoteXp));
          setState((prev) => ({
            ...prev,
            currentXp: remoteXp || prev.currentXp,
            currentLevel: remoteLevel || prev.currentLevel,
            claimedRewardIds: Array.isArray(data.claimed_rewards)
              ? data.claimed_rewards
                  .map((tierLevel: number) => tiers.find((t) => t.level === tierLevel)?.reward.id)
                  .filter(Boolean)
              : prev.claimedRewardIds,
          }));
          if (data.season?.end_date) {
            const parsed = new Date(data.season.end_date);
            if (!Number.isNaN(parsed.getTime())) setSeasonEndsAt(parsed);
          }
        }

        if (alive && missionsRes.ok) {
          const data = await missionsRes.json();
          const merged: Mission[] = [
            ...(Array.isArray(data.daily_missions)
              ? data.daily_missions.map((m: any) => mapRemoteMission(m, 'daily'))
              : missionsSeed.filter((m) => m.type === 'daily')),
            ...(Array.isArray(data.weekly_missions)
              ? data.weekly_missions.map((m: any) => mapRemoteMission(m, 'weekly'))
              : missionsSeed.filter((m) => m.type === 'weekly')),
            ...missionsSeed.filter((m) => m.type === 'seasonal'),
          ];
          setMissions(merged);
        }

        if (alive && leaderboardRes.ok) {
          const data = await leaderboardRes.json();
          const remoteRows = Array.isArray(data?.leaderboard) ? data.leaderboard : [];
          if (remoteRows.length) {
            setLeaderboard(
              remoteRows.map((row: any, idx: number) => ({
                id: String(row.user_id || row.id || idx),
                name: row.user_name || row.name || 'Operator',
                title: row.tier_info?.reward_name || 'Field Ops',
                avatarUrl: row.avatar_url || '/icons/tier_recruit.png',
                totalXp: Number(row.current_xp || 0),
                tierLevel: Number(row.current_tier || 1),
                missionsCompleted: Number(row.missions_completed || 0),
                rewardsClaimed: Number(row.rewards_claimed || 0),
                streakDaily: Number(row.streak_daily || 0),
                streakWeekly: Number(row.streak_weekly || 0),
                change: Number(row.rank_delta || 0),
              }))
            );
          }
        }
      } catch {
        // fallback is local seed data
      } finally {
        if (alive) setLoading(false);
      }
    };

    hydrate();
    if (!API_URL) setLoading(false);
    return () => {
      alive = false;
    };
  }, []);

  const applyXp = (gain: number) => {
    setState((prev) => {
      const nextXp = prev.currentXp + gain;
      const nextLevel = getLevelFromXp(nextXp);
      if (nextLevel > prev.currentLevel) {
        setRecentUnlockedTier(nextLevel);
        setTierShake(true);
        setTimeout(() => setTierShake(false), 520);
        setTimeout(() => setRecentUnlockedTier(null), 1400);
        toast.success(`Tier Up: Level ${nextLevel} unlocked`);
      }
      return { ...prev, currentXp: nextXp, currentLevel: nextLevel };
    });
    setRecentXpGain(gain);
    setTimeout(() => setRecentXpGain(0), 1100);
  };

  const claimReward = (tier: { reward: { id: string; name: string } }) => {
    if (state.claimedRewardIds.includes(tier.reward.id)) return;
    setState((prev) => ({ ...prev, claimedRewardIds: [...prev.claimedRewardIds, tier.reward.id] }));
    toast.success(`Reward claimed: ${tier.reward.name}`);
  };

  const advanceMission = (missionId: string) => {
    setMissions((prev) =>
      prev.map((m) => {
        if (m.id !== missionId) return m;
        if (state.completedMissionIds.includes(m.id)) return m;
        const step = Math.max(1, Math.ceil(m.target / 4));
        return { ...m, progress: Math.min(m.target, m.progress + step) };
      })
    );
  };

  const claimMission = (missionId: string) => {
    const mission = missions.find((m) => m.id === missionId);
    if (!mission) return;
    if (state.completedMissionIds.includes(missionId)) return;
    if (mission.progress < mission.target) {
      toast.error('Mission not complete yet');
      return;
    }

    setState((prev) => ({
      ...prev,
      completedMissionIds: [...prev.completedMissionIds, missionId],
    }));
    setClaimFxMissionId(missionId);
    setTimeout(() => setClaimFxMissionId(null), 900);
    applyXp(mission.xp);
    toast.success(`Mission complete: +${mission.xp} XP`);
  };

  const missionCompletedCount = state.completedMissionIds.length;
  const rewardsClaimedCount = state.claimedRewardIds.length;

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'progress', label: 'Tier Progress', icon: <Award className="h-4 w-4" /> },
    { key: 'missions', label: 'Missions', icon: <ListChecks className="h-4 w-4" /> },
    { key: 'leaderboard', label: 'Leaderboard', icon: <Trophy className="h-4 w-4" /> },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="text-center">
          <div className="spinner-tactical mx-auto mb-4 h-12 w-12" />
          <p className="text-xs font-mono uppercase tracking-wider text-zinc-500">
            Loading Battle Pass...
          </p>
        </div>
      </div>
    );
  }

  return (
    <main
      className={`bp-shell bp-grid-bg min-h-screen p-4 md:p-8 ${tierShake ? 'bp-tier-shake' : ''}`}
    >
      <header className="mb-6 rounded-xl border border-zinc-700/60 bg-zinc-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-[0.18em] text-white md:text-2xl">
              Battle Pass
            </h1>
            <p className="mt-1 text-xs font-mono uppercase tracking-wider text-zinc-500">
              Tactical progression, missions, and operator rankings
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border border-zinc-700/70 bg-zinc-950/70 px-3 py-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Level</p>
              <p className="text-sm font-semibold text-cyan-300">{state.currentLevel}</p>
            </div>
            <div className="rounded-md border border-zinc-700/70 bg-zinc-950/70 px-3 py-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Missions
              </p>
              <p className="text-sm font-semibold text-emerald-300">{missionCompletedCount}</p>
            </div>
            <div className="rounded-md border border-zinc-700/70 bg-zinc-950/70 px-3 py-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Rewards
              </p>
              <p className="text-sm font-semibold text-amber-300">{rewardsClaimedCount}</p>
            </div>
          </div>
        </div>
      </header>

      <nav className="mb-5 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`bp-tab inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-mono uppercase tracking-wider text-zinc-400 ${activeTab === tab.key ? 'bp-tab-active' : ''}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'progress' && (
        <TierProgressTab
          tiers={tiers}
          currentXp={state.currentXp}
          currentLevel={state.currentLevel}
          claimedRewardIds={state.claimedRewardIds}
          recentXpGain={recentXpGain}
          recentUnlockedTier={recentUnlockedTier}
          onClaimReward={claimReward}
        />
      )}

      {activeTab === 'missions' && (
        <MissionsTab
          missions={missions}
          completedMissionIds={state.completedMissionIds}
          claimFxMissionId={claimFxMissionId}
          onAdvanceMission={advanceMission}
          onClaimMission={claimMission}
          getTimeRemaining={(type) => getResetString(type, seasonEndsAt)}
        />
      )}

      {activeTab === 'leaderboard' && <LeaderboardTab entries={leaderboard} />}

      {!API_URL && (
        <div className="mt-6 inline-flex items-center gap-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-amber-300">
          <ShieldAlert className="h-3 w-3" />
          Running in local data mode
        </div>
      )}

      <button
        type="button"
        onClick={() => applyXp(120)}
        className="fixed bottom-5 right-5 inline-flex items-center gap-2 rounded-full border border-cyan-500/50 bg-cyan-500/20 px-4 py-2 text-xs font-mono uppercase tracking-wider text-cyan-200 hover:bg-cyan-500/30"
      >
        <Zap className="h-4 w-4" />
        +XP Debug
      </button>
    </main>
  );
};

export default BattlePassPage;
