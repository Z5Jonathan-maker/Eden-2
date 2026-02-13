import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, Gift, Lock, Target } from 'lucide-react';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import RankBadge from './RankBadge';
import './HarvestAnimations.css';

const rarityByPoints = (points = 0) => {
  if (points >= 100) return 'legendary';
  if (points >= 60) return 'epic';
  if (points >= 30) return 'rare';
  return 'common';
};

const rarityClass = {
  common: 'border-slate-600/60',
  rare: 'border-cyan-500/40',
  epic: 'border-violet-500/40',
  legendary: 'border-amber-500/45',
};

const toTiltDeg = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : '0.00';
};

const ChallengeCard = ({
  challenge,
  onClaim,
  index = 0,
  completed = false,
  justCompleted = false,
  rarity,
}) => {
  const [tilt, setTilt] = useState({});
  const state = challenge?.state || 'in_progress';
  const isLocked = state === 'locked';
  const isCompleted = completed || state === 'completed';
  const isClaimed = state === 'claimed';
  const challengeRarity = rarity || challenge?.rarity || rarityByPoints(challenge?.points_reward);
  const progress =
    challenge?.requirement_value > 0
      ? Math.min((challenge.current_progress / challenge.requirement_value) * 100, 100)
      : 0;
  const delay = useMemo(() => ({ animationDelay: `${index * 0.05}s` }), [index]);

  return (
    <article
      className={`harvest-bp-card harvest-grid-overlay relative ${rarityClass[challengeRarity] || rarityClass.common} ${justCompleted ? 'harvest-slide-up' : 'harvest-fade-in'} ${isClaimed ? 'opacity-80' : ''}`}
      style={{ ...tilt, ...delay }}
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
      {justCompleted && (
        <div className="absolute inset-0 rounded-[inherit] harvest-glow-sweep pointer-events-none" />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{challenge.name}</p>
          <p className="text-xs text-zinc-500 mt-1">{challenge.description}</p>
        </div>
        <RankBadge
          rank={challenge.points_reward || 0}
          justRankedUp={justCompleted}
          label={challengeRarity}
        />
      </div>

      {!isLocked && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span>
              {challenge.current_progress}/{challenge.requirement_value}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-zinc-800/50" />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="inline-flex items-center gap-1 text-xs text-zinc-500">
          <Clock className="h-3 w-3" />
          {challenge.time_remaining_display || 'Today'}
        </div>
        <div className="inline-flex items-center gap-1 text-xs text-amber-300">
          <Gift className="h-3 w-3" /> +{challenge.points_reward}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        {isLocked && (
          <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
            <Lock className="h-3 w-3" />
            Locked
          </span>
        )}
        {isCompleted && !isClaimed && (
          <Button
            size="sm"
            className="harvest-btn-primary"
            onClick={() => onClaim?.(challenge?.id)}
            disabled={!challenge?.id}
          >
            <CheckCircle2
              className={`h-4 w-4 mr-1 ${justCompleted ? 'harvest-checkmark-sweep' : ''}`}
            />
            Claim
          </Button>
        )}
        {isClaimed && (
          <span className="text-xs text-emerald-300 inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Claimed
          </span>
        )}
        {!isLocked && !isCompleted && !isClaimed && (
          <span className="text-xs text-cyan-300 inline-flex items-center gap-1">
            <Target className="h-3 w-3" /> In Progress
          </span>
        )}
      </div>
    </article>
  );
};

export default ChallengeCard;
