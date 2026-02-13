import React from 'react';
import { Award, Zap } from 'lucide-react';
import TierCard from './TierCard';
import XPBar from './XPBar';
import { BattlePassTier } from './types';

interface Props {
  tiers: BattlePassTier[];
  currentXp: number;
  currentLevel: number;
  claimedRewardIds: string[];
  recentXpGain: number;
  recentUnlockedTier: number | null;
  onClaimReward: (tier: BattlePassTier) => void;
}

const TierProgressTab: React.FC<Props> = ({
  tiers,
  currentXp,
  currentLevel,
  claimedRewardIds,
  recentXpGain,
  recentUnlockedTier,
  onClaimReward,
}) => {
  const currentTierIndex = Math.max(
    0,
    tiers.findIndex((t) => t.level === currentLevel)
  );
  const currentTier = tiers[currentTierIndex] || tiers[0];
  const nextTier = tiers[currentTierIndex + 1] || currentTier;
  const levelStartXp = currentTier?.xpRequired || 0;
  const levelEndXp = nextTier?.xpRequired || currentXp + 1;

  return (
    <section className="space-y-5">
      <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/65 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-cyan-300" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-100">
              Tier Progress
            </h3>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
            <Zap className="h-3 w-3 text-amber-300" />
            Level {currentLevel}
          </div>
        </div>
        <XPBar
          currentXp={currentXp}
          levelStartXp={levelStartXp}
          levelEndXp={levelEndXp}
          recentGain={recentXpGain}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tiers.map((tier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            currentLevel={currentLevel}
            currentXp={currentXp}
            claimed={claimedRewardIds.includes(tier.reward.id)}
            unlockFx={recentUnlockedTier === tier.level}
            justUnlocked={recentUnlockedTier === tier.level}
            onClaim={onClaimReward}
          />
        ))}
      </div>
    </section>
  );
};

export default TierProgressTab;
