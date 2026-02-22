import React, { useEffect, useRef, useState } from 'react';
import './HarvestAnimations.css';

const toTiltDeg = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : '0.00';
};

const StatCard = ({ label, value, tone = 'cyan', progress = null, deltaLabel = '+1' }) => {
  const prevRef = useRef(value);
  const [pulse, setPulse] = useState(false);
  const [float, setFloat] = useState(false);
  const [tilt, setTilt] = useState({});

  useEffect(() => {
    if (value > prevRef.current) {
      setPulse(true);
      setFloat(true);
      const t1 = setTimeout(() => setPulse(false), 800);
      const t2 = setTimeout(() => setFloat(false), 900);
      prevRef.current = value;
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    prevRef.current = value;
    return undefined;
  }, [value]);

  const toneClass =
    {
      cyan: 'text-cyan-300 border-cyan-500/30',
      amber: 'text-amber-300 border-amber-500/30',
      emerald: 'text-emerald-300 border-emerald-500/30',
      violet: 'text-violet-300 border-violet-500/30',
    }[tone] || 'text-cyan-300 border-cyan-500/30';

  return (
    <div
      className={`harvest-bp-card harvest-grid-overlay relative overflow-hidden ${toneClass} ${pulse ? 'harvest-xp-pulse' : ''}`}
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
      {float && (
        <span className="absolute right-3 top-2 text-xs font-mono text-cyan-300 harvest-float-up">
          {deltaLabel}
        </span>
      )}
      <p className="text-2xl font-tactical font-bold text-white">{value}</p>
      <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 mt-1">{label}</p>
      {progress !== null && (
        <div className="harvest-xp-shell mt-3">
          <div
            className="harvest-xp-fill"
            style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default StatCard;
