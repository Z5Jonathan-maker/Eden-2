import React, { useEffect, useRef, useState } from 'react';

interface Props {
  currentXp: number;
  levelStartXp: number;
  levelEndXp: number;
  recentGain: number;
}

const XPBar: React.FC<Props> = ({ currentXp, levelStartXp, levelEndXp, recentGain }) => {
  const inLevel = Math.max(0, currentXp - levelStartXp);
  const required = Math.max(1, levelEndXp - levelStartXp);
  const percent = Math.min(100, Math.round((inLevel / required) * 100));
  const nearLevelUp = percent >= 80;
  const prevXpRef = useRef(currentXp);
  const [xpPulse, setXpPulse] = useState(false);
  const [floatingGain, setFloatingGain] = useState(0);
  const [floatKey, setFloatKey] = useState(0);

  useEffect(() => {
    const diff = currentXp - prevXpRef.current;
    if (diff > 0) {
      setXpPulse(true);
      setFloatingGain(diff);
      setFloatKey((key) => key + 1);
      const pulseTimer = setTimeout(() => setXpPulse(false), 900);
      const gainTimer = setTimeout(() => setFloatingGain(0), 1200);
      prevXpRef.current = currentXp;
      return () => {
        clearTimeout(pulseTimer);
        clearTimeout(gainTimer);
      };
    }
    prevXpRef.current = currentXp;
    return undefined;
  }, [currentXp]);

  return (
    <div
      className={`${nearLevelUp ? 'bp-xp-near-level' : ''} ${xpPulse ? 'bp-xp-pulse-on-change animate-xpPulse' : ''}`}
    >
      <div className="mb-2 flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-zinc-400">
        <span>Tier Progress</span>
        <span>
          {inLevel.toLocaleString()} / {required.toLocaleString()} XP
        </span>
      </div>
      <div className="bp-xp-shell">
        <div className="bp-xp-fill" style={{ width: `${percent}%` }} />
        {(recentGain > 0 || floatingGain > 0) && (
          <span key={floatKey} className="bp-xp-float animate-floatUp">
            +{recentGain > 0 ? recentGain : floatingGain} XP
          </span>
        )}
      </div>
    </div>
  );
};

export default XPBar;
