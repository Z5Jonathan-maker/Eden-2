import React from 'react';
import { CheckCircle2, Plus, Timer, Trophy } from 'lucide-react';
import { rarityBorderClass, rarityTextClass } from './RarityStyles';
import { Mission } from './types';

interface Props {
  mission: Mission;
  completed: boolean;
  timeRemaining: string;
  claimFx: boolean;
  justCompleted?: boolean;
  onAdvance: (missionId: string) => void;
  onClaim: (missionId: string) => void;
}

const MissionCard: React.FC<Props> = ({
  mission,
  completed,
  timeRemaining,
  claimFx,
  justCompleted = false,
  onAdvance,
  onClaim,
}) => {
  const percent = Math.min(100, Math.round((mission.progress / Math.max(1, mission.target)) * 100));
  const canClaim = mission.progress >= mission.target && !completed;
  const completionFx = claimFx || justCompleted;

  return (
    <article
      className={`bp-mission-card bp-hover-glow ${rarityBorderClass[mission.rarity]} p-4 ${completionFx ? 'bp-mission-complete animate-missionComplete' : ''} ${completed ? 'bp-mission-collapsed' : ''}`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-white">{mission.title}</h4>
          <p className="mt-1 text-xs text-zinc-400">{mission.description}</p>
        </div>
        <span
          className={`rounded-full border px-2 py-1 text-[10px] font-mono uppercase tracking-wider ${rarityTextClass[mission.rarity]} border-current/35`}
        >
          {mission.rarity}
        </span>
      </div>

      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-zinc-500">
          <span>
            {mission.progress}/{mission.target}
          </span>
          <span>{percent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 via-emerald-500 to-amber-400 transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
          <span className="inline-flex items-center gap-1 text-amber-300">
            <Trophy className="h-3 w-3" />+{mission.xp} XP
          </span>
          <span className="inline-flex items-center gap-1">
            <Timer className="h-3 w-3" />
            {timeRemaining}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!completed && !canClaim && (
            <button
              type="button"
              onClick={() => onAdvance(mission.id)}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-600 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-300 hover:border-cyan-500 hover:text-cyan-300"
            >
              <Plus className="h-3 w-3" />
              Advance
            </button>
          )}
          {canClaim && (
            <button
              type="button"
              onClick={() => onClaim(mission.id)}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/60 bg-emerald-500/15 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-emerald-300"
            >
              Claim
            </button>
          )}
          {completed && (
            <span className="bp-completion-check inline-flex items-center gap-1 rounded-md border border-emerald-500/40 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-emerald-300">
              <CheckCircle2 className="h-3 w-3" />
              Completed
            </span>
          )}
        </div>
      </div>
      {completionFx && (
        <span className="bp-mission-xp-float animate-floatUp">+{mission.xp} XP</span>
      )}
    </article>
  );
};

export default MissionCard;
