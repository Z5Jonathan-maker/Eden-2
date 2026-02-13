import React, { useCallback, useState } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import RewardBadge from './RewardBadge';
import { rarityBorderClass } from './RarityStyles';
import { BattlePassTier } from './types';

interface Props {
  tier: BattlePassTier;
  currentLevel: number;
  currentXp: number;
  claimed: boolean;
  unlockFx: boolean;
  justUnlocked?: boolean;
  onClaim: (tier: BattlePassTier) => void;
}

const TierCard: React.FC<Props> = ({
  tier,
  currentLevel,
  currentXp,
  claimed,
  unlockFx,
  justUnlocked,
  onClaim,
}) => {
  const unlocked = currentLevel >= tier.level;
  const levelProgress = tier.xpRequired
    ? Math.min(100, Math.round((currentXp / tier.xpRequired) * 100))
    : 100;
  const isJustUnlocked = Boolean(justUnlocked ?? unlockFx);
  const [transformStyle, setTransformStyle] = useState<React.CSSProperties>({});

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    setTransformStyle({
      transform: `perspective(900px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg) translateY(-2px) scale(1.01)`,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTransformStyle({
      transform: 'perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0)',
    });
  }, []);

  return (
    <article
      className={`bp-tier-card bp-hover-glow ${rarityBorderClass[tier.reward.rarity]} ${isJustUnlocked ? 'bp-tier-unlock animate-tierUnlock' : ''}`}
      style={transformStyle}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="bp-grid-bg absolute inset-0 rounded-[inherit] opacity-25" />
      {isJustUnlocked && (
        <div className="bp-glow-sweep absolute inset-0 rounded-[inherit] pointer-events-none" />
      )}
      <div className="relative flex items-center justify-between">
        <span className="rounded-full border border-zinc-700 bg-zinc-900/80 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
          Tier {tier.level}
        </span>
        {isJustUnlocked && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300">
            Unlocked
          </span>
        )}
      </div>

      <div className="relative mt-3 flex items-start gap-3">
        <RewardBadge
          reward={tier.reward}
          unlocked={unlocked}
          claimed={claimed}
          unlockFx={isJustUnlocked}
        />
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-white">{tier.reward.name}</h4>
          <p className="mt-1 text-xs text-zinc-400">{tier.reward.description}</p>
          <p className="mt-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            {tier.xpRequired.toLocaleString()} XP Required
          </p>
        </div>
      </div>

      <div className="relative mt-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-gradient-to-r from-zinc-500 via-cyan-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${unlocked ? 100 : levelProgress}%` }}
          />
        </div>
      </div>

      <div className="relative mt-4">
        {!unlocked && (
          <div className="inline-flex items-center gap-1 rounded-md border border-zinc-700/80 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            <Lock className="h-3 w-3" />
            Locked
          </div>
        )}
        {unlocked && !claimed && (
          <button
            type="button"
            onClick={() => onClaim(tier)}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-500/60 bg-emerald-500/15 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-emerald-300 hover:bg-emerald-500/20"
          >
            <Sparkles className="h-3 w-3" />
            Claim Reward
          </button>
        )}
        {claimed && (
          <span className="inline-flex rounded-md border border-emerald-500/35 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-emerald-300">
            Claimed
          </span>
        )}
      </div>
    </article>
  );
};

export default TierCard;
