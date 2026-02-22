import React from 'react';

const Divider = ({ data }) => {
  const style = data?.visual_weight || 'secondary';

  if (style === 'primary') {
    return (
      <div className="col-span-full py-6">
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-orange-600/30 to-transparent" />
          <div className="w-2 h-2 rounded-full bg-orange-600/30" />
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-orange-600/30 to-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="col-span-full py-4">
      <div className="h-px bg-zinc-800/50" />
    </div>
  );
};

export default Divider;
