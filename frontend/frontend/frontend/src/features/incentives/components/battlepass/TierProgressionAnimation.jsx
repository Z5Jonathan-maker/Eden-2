import React from 'react';
import { Sparkles } from 'lucide-react';

const TierProgressionAnimation = ({ active, tier }) => {
  if (!active) return null;
  return (
    <div className="bp-tierup-overlay" aria-live="polite">
      <div className="bp-tierup-card">
        <Sparkles className="w-6 h-6 text-orange-300" />
        <p className="font-tactical text-white text-lg uppercase tracking-wider">Tier Up</p>
        <p className="font-mono text-orange-300 text-sm">Unlocked Tier {tier}</p>
      </div>
    </div>
  );
};

export default TierProgressionAnimation;
