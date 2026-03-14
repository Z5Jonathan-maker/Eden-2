import React, { useMemo, useState } from 'react';
import { Flame, Gauge, Target, TrendingUp, Zap } from 'lucide-react';
import { Progress } from '../../shared/ui/progress';
import './HarvestAnimations.css';

const safePercent = (value) => (Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0);
const toTiltDeg = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : '0.00';
};

const ProfileCard = ({ currentPoints = 0, streakData = {}, stats = {}, nextReward = null }) => {
  const [tilt, setTilt] = useState({});
  const accuracy = useMemo(
    () =>
      safePercent(((stats.total_appointments || 0) / Math.max(1, stats.total_doors || 1)) * 100),
    [stats]
  );
  const efficiency = useMemo(
    () =>
      safePercent(
        ((stats.total_contracts || 0) / Math.max(1, stats.total_appointments || 1)) * 100
      ),
    [stats]
  );
  const xpProgress = safePercent(nextReward?.percent_complete || 0);

  return (
    <div
      className="harvest-bp-card harvest-grid-overlay relative overflow-hidden"
      style={tilt}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (!rect?.width || !rect?.height) {
          return;
        }
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        setTilt({
          transform: `perspective(760px) rotateX(${toTiltDeg(-y * 4)}deg) rotateY(${toTiltDeg(x * 4)}deg) translateY(-2px)`,
        });
      }}
      onMouseLeave={() =>
        setTilt({ transform: 'perspective(760px) rotateX(0deg) rotateY(0deg) translateY(0)' })
      }
    >
      <div className="absolute inset-0 harvest-glow-sweep pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-200" />
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 rounded-full border border-cyan-400/40 bg-slate-900/90 flex items-center justify-center">
          <div className="absolute inset-1 rounded-full border border-cyan-400/40 harvest-profile-ring" />
          <Flame className="h-9 w-9 text-orange-300" />
        </div>
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-zinc-500">Operator HUD</p>
          <p className="text-3xl font-tactical font-bold text-white">{currentPoints}</p>
          <p className="text-sm text-zinc-400">Current Points</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/70 p-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
            <Target className="h-3 w-3 text-cyan-300" /> Accuracy
          </p>
          <p className="text-lg font-semibold text-cyan-300">{Math.round(accuracy)}%</p>
        </div>
        <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/70 p-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
            <Gauge className="h-3 w-3 text-emerald-300" /> Efficiency
          </p>
          <p className="text-lg font-semibold text-emerald-300">{Math.round(efficiency)}%</p>
        </div>
        <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/70 p-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
            <Zap className="h-3 w-3 text-amber-300" /> Streak
          </p>
          <p className="text-lg font-semibold text-amber-300">{streakData.current_streak || 0}d</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-cyan-300" /> Next rank progress
          </span>
          <span>{Math.round(xpProgress)}%</span>
        </div>
        <Progress value={xpProgress} className="h-2 bg-zinc-800/50" />
      </div>
    </div>
  );
};

export default ProfileCard;
