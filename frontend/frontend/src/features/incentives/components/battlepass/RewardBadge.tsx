import React, { useCallback, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { rarityGlowColor, rarityTextClass } from './RarityStyles';
import { Reward } from './types';

interface Props {
  reward: Reward;
  unlocked: boolean;
  claimed: boolean;
  unlockFx: boolean;
}

const RewardBadge: React.FC<Props> = ({ reward, unlocked, claimed, unlockFx }) => {
  const particles = useMemo(() => new Array(14).fill(0).map((_, i) => i), []);
  const [transformStyle, setTransformStyle] = useState<React.CSSProperties>({});

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    setTransformStyle({
      transform: `perspective(700px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg) translateY(-2px)`,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTransformStyle({
      transform: 'perspective(700px) rotateX(0deg) rotateY(0deg) translateY(0)',
    });
  }, []);

  return (
    <div className="relative flex flex-col items-center gap-2">
      <div
        className="relative h-20 w-20 bp-hover-glow"
        style={transformStyle}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className={`bp-reward-badge h-full w-full ${unlockFx ? 'bp-badge-unlock animate-spin-fast' : 'bp-badge-idle bp-badge-hover animate-spin-slow'} ${unlocked ? '' : 'opacity-65'}`}
        >
          <img
            src={reward.iconUrl}
            alt={reward.name}
            className="h-full w-full rounded-full p-3 object-contain"
          />
        </div>
        {(unlockFx || claimed) && (
          <div className="bp-particle-ring">
            {particles.map((id) => (
              <span
                key={id}
                className="bp-particle"
                style={
                  {
                    '--particle-angle': `${(360 / particles.length) * id}deg`,
                    background: rarityGlowColor[reward.rarity],
                    boxShadow: `0 0 10px ${rarityGlowColor[reward.rarity]}`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        )}
        {claimed && (
          <div className="absolute -bottom-1 -right-1 rounded-full bg-emerald-500 p-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-950" />
          </div>
        )}
      </div>
      <div className="text-center">
        <p className={`text-xs font-semibold ${rarityTextClass[reward.rarity]}`}>{reward.name}</p>
        <p className="mt-1 text-[10px] text-zinc-500">
          {claimed ? 'Claimed' : unlocked ? 'Unlocked' : 'Locked'}
        </p>
      </div>
    </div>
  );
};

export default RewardBadge;
