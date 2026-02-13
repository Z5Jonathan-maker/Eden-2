import React, { useCallback, useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import './HarvestAnimations.css';

const toTiltDeg = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : '0.00';
};

const RankBadge = ({ rank = 0, justRankedUp = false, label = 'Rank' }) => {
  const [tilt, setTilt] = useState({});
  const particles = useMemo(() => new Array(12).fill(0).map((_, i) => i), []);

  const onMouseMove = useCallback((event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect?.width || !rect?.height) {
      return;
    }
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      transform: `perspective(700px) rotateX(${toTiltDeg(-y * 6)}deg) rotateY(${toTiltDeg(x * 6)}deg) translateY(-2px)`,
    });
  }, []);

  const onMouseLeave = useCallback(() => {
    setTilt({ transform: 'perspective(700px) rotateX(0deg) rotateY(0deg) translateY(0)' });
  }, []);

  return (
    <div
      className="relative flex flex-col items-center gap-2"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={tilt}
    >
      <div
        className={`harvest-rank-badge ${justRankedUp ? 'harvest-rank-unlock harvest-rank-spin-fast' : 'harvest-rank-spin-slow'} flex items-center justify-center`}
      >
        <Trophy className="h-8 w-8 text-cyan-300" />
      </div>
      {justRankedUp && (
        <div className="harvest-particle-ring">
          {particles.map((id) => (
            <span
              key={id}
              className="harvest-particle"
              style={{
                '--particle-angle': `${(360 / particles.length) * id}deg`,
                background: 'rgba(34,211,238,0.95)',
              }}
            />
          ))}
        </div>
      )}
      <p className="text-xs font-mono uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="text-lg font-bold text-cyan-300">#{rank || '-'}</p>
    </div>
  );
};

export default RankBadge;
