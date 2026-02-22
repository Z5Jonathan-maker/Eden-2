import React from 'react';
import { Shield } from 'lucide-react';

const PrincipleCard = ({ data }) => {
  const { principle_name, distilled_meaning, ownership_shift, principle_number } = data.content_payload;

  return (
    <div className="relative rounded-xl overflow-hidden border border-orange-600/30 bg-gradient-to-br from-zinc-900 via-zinc-800/90 to-zinc-900">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-orange-600 to-orange-500" />
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-orange-600/10 border border-orange-600/20 flex items-center justify-center">
            {principle_number ? (
              <span className="text-orange-500 font-bold text-lg font-mono">{principle_number}</span>
            ) : (
              <Shield className="w-5 h-5 text-orange-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-lg font-bold text-white tracking-tight">
              {principle_name}
            </h4>
            <p className="text-zinc-300 mt-2 leading-relaxed text-sm">
              {distilled_meaning}
            </p>
          </div>
        </div>
        {ownership_shift && (
          <div className="mt-5 bg-zinc-900/80 rounded-lg p-4 border border-zinc-700/50">
            <span className="text-orange-500 font-mono text-[10px] tracking-[0.3em] uppercase block mb-2">
              Ownership Shift
            </span>
            <p className="text-zinc-300 text-sm leading-relaxed">{ownership_shift}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrincipleCard;
