import React from 'react';

const BodyBlock = ({ data }) => {
  const { text, emphasis, label, call_to_action } = data.content_payload;
  const isPrimary = data.visual_weight === 'primary';
  const isAccent = data.visual_weight === 'accent';

  return (
    <div className={`rounded-xl border ${
      isPrimary
        ? 'bg-zinc-800/80 border-zinc-700/50'
        : isAccent
          ? 'bg-orange-950/20 border-orange-800/30'
          : 'bg-zinc-900/50 border-zinc-800/40'
    } p-6`}>
      {label && (
        <span className="inline-block text-orange-500 font-mono text-[10px] tracking-[0.3em] uppercase mb-3">
          {label}
        </span>
      )}
      <p className={`leading-relaxed ${isPrimary ? 'text-zinc-200 text-base' : 'text-zinc-400 text-sm'}`}>
        {text}
      </p>
      {emphasis && (
        <p className="mt-4 text-orange-400 font-medium text-sm border-l-2 border-orange-500/50 pl-4 italic">
          {emphasis}
        </p>
      )}
      {call_to_action && (
        <div className="mt-5 bg-zinc-900/80 rounded-lg px-5 py-4 border border-orange-600/20">
          <span className="text-orange-500 font-mono text-[10px] tracking-[0.2em] uppercase block mb-1">Action Required</span>
          <p className="text-zinc-300 text-sm">{call_to_action}</p>
        </div>
      )}
    </div>
  );
};

export default BodyBlock;
