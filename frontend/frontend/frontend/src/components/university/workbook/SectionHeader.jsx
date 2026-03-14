import React from 'react';

const SectionHeader = ({ data }) => {
  const { title, subtitle, section_number } = data.content_payload;
  const isFullWidth = data.layout_style === 'full_width';

  return (
    <div className={`relative overflow-hidden rounded-xl ${isFullWidth ? 'col-span-full' : ''}`}>
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 border border-zinc-700/50 px-8 py-10">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600/5 to-transparent" />
        <div className="relative">
          {section_number && (
            <span className="inline-block text-orange-500 font-mono text-xs tracking-[0.3em] uppercase mb-3">
              Section {section_number}
            </span>
          )}
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-zinc-400 mt-3 text-lg max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}
          <div className="mt-6 h-1 w-16 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full" />
        </div>
      </div>
    </div>
  );
};

export default SectionHeader;
