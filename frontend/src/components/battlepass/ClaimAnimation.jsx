import React from 'react';
import { CheckCircle2 } from 'lucide-react';

const ClaimAnimation = ({ active }) => {
  if (!active) return null;
  return (
    <div className="bp-claim-overlay" aria-hidden="true">
      <CheckCircle2 className="w-8 h-8 text-emerald-300 bp-claim-icon" />
      <span className="bp-claimed-pill">Claimed</span>
    </div>
  );
};

export default ClaimAnimation;
