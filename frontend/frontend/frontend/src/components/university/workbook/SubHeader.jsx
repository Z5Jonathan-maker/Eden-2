import React from 'react';

const SubHeader = ({ data }) => {
  const { title, context_label } = data.content_payload;

  return (
    <div className="col-span-full">
      <div className="flex items-center gap-4 py-4">
        <div className="h-px flex-1 bg-zinc-700/50" />
        <div className="text-center">
          {context_label && (
            <span className="block text-orange-500/70 font-mono text-[10px] tracking-[0.3em] uppercase mb-1">
              {context_label}
            </span>
          )}
          <h3 className="text-lg font-semibold text-zinc-200 tracking-wide">
            {title}
          </h3>
        </div>
        <div className="h-px flex-1 bg-zinc-700/50" />
      </div>
    </div>
  );
};

export default SubHeader;
