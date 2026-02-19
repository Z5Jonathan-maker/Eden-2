/**
 * Rich Markdown Renderer for University Lessons
 * Custom callout blocks, styled headings, expandable sections, pro typography
 */
import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { Lightbulb, AlertTriangle, BookOpen, FileText, ChevronDown } from 'lucide-react';

/* ─── Callout config ─── */
const CALLOUT_STYLES = {
  tip:        { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: Lightbulb,      color: 'text-emerald-400', label: 'Pro Tip' },
  warning:    { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   icon: AlertTriangle,  color: 'text-amber-400',   label: 'Warning' },
  'key-term': { bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    icon: BookOpen,        color: 'text-blue-400',    label: 'Key Term' },
  example:    { bg: 'bg-purple-500/10',   border: 'border-purple-500/30',  icon: FileText,        color: 'text-purple-400',  label: 'Example' },
};

function CalloutBox({ type, children }) {
  const style = CALLOUT_STYLES[type] || CALLOUT_STYLES.tip;
  const Icon = style.icon;
  return (
    <div className={`${style.bg} ${style.border} border rounded-xl p-4 my-5`}>
      <div className={`flex items-center gap-2 mb-2 ${style.color} font-semibold text-sm uppercase tracking-wider`}>
        <Icon className="w-4 h-4" />
        {style.label}
      </div>
      <div className="text-zinc-300 text-[14px] leading-relaxed [&>p]:mb-2 [&>p:last-child]:mb-0 [&_strong]:text-white">
        <ReactMarkdown components={inlineComponents}>{children}</ReactMarkdown>
      </div>
    </div>
  );
}

/* ─── Parse :::type ... ::: blocks ─── */
function parseContent(markdown) {
  if (!markdown) return [{ type: 'markdown', content: '' }];
  const segments = [];
  const regex = /^:::(tip|warning|key-term|example)\s*\n([\s\S]*?)^:::\s*$/gm;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'markdown', content: markdown.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'callout', calloutType: match[1], content: match[2].trim() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < markdown.length) {
    segments.push({ type: 'markdown', content: markdown.slice(lastIndex) });
  }
  return segments;
}

/* ─── Inline-only components (for inside callouts) ─── */
const inlineComponents = {
  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
  em: ({ children }) => <em className="text-zinc-200 italic">{children}</em>,
  code: ({ children }) => (
    <code className="text-orange-400 bg-zinc-800 rounded px-1.5 py-0.5 text-[13px] font-mono">{children}</code>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-orange-400 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>
  ),
};

/* ─── Full component overrides for ReactMarkdown ─── */
const markdownComponents = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-white border-b border-zinc-700/60 pb-3 mb-6 mt-2">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-bold text-orange-400 mt-10 mb-4 flex items-center gap-2">
      <span className="w-1 h-6 bg-orange-500 rounded-full inline-block flex-shrink-0" />
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold text-zinc-100 mt-7 mb-3 flex items-center gap-2">
      <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full inline-block flex-shrink-0" />
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-base font-semibold text-zinc-200 mt-5 mb-2">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="text-zinc-300 text-[15px] leading-7 mb-4">{children}</p>
  ),
  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
  em: ({ children }) => <em className="text-zinc-200 italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-orange-500/60 bg-zinc-800/40 rounded-r-lg py-3 px-5 my-5 text-zinc-300 italic [&>p]:mb-1 [&>p:last-child]:mb-0">
      {children}
    </blockquote>
  ),
  ul: ({ children }) => <ul className="space-y-1.5 my-4 pl-1">{children}</ul>,
  ol: ({ children }) => <ol className="space-y-1.5 my-4 pl-1 list-decimal list-inside [&>li]:pl-1">{children}</ol>,
  li: ({ children, ordered }) => (
    <li className="text-zinc-300 text-[15px] leading-relaxed flex items-start gap-2">
      {!ordered && <span className="text-orange-500 mt-1.5 flex-shrink-0 text-[8px]">●</span>}
      <span className="flex-1">{children}</span>
    </li>
  ),
  code: ({ inline, className, children }) => {
    if (inline || !className) {
      return (
        <code className="text-orange-400 bg-zinc-800 rounded-md px-1.5 py-0.5 text-[13px] font-mono border border-zinc-700/50">
          {children}
        </code>
      );
    }
    return (
      <code className={`block text-[13px] font-mono ${className || ''}`}>{children}</code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 my-5 overflow-x-auto text-sm leading-relaxed">
      {children}
    </pre>
  ),
  hr: () => (
    <div className="my-8 flex items-center gap-3">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
    </div>
  ),
  table: ({ children }) => (
    <div className="my-5 overflow-x-auto rounded-xl border border-zinc-700">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-zinc-800/80">{children}</thead>,
  th: ({ children }) => <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-300 uppercase tracking-wider">{children}</th>,
  td: ({ children }) => <td className="px-4 py-3 text-zinc-300 border-t border-zinc-800">{children}</td>,
  tr: ({ children }) => <tr className="hover:bg-zinc-800/30 transition-colors">{children}</tr>,
  a: ({ href, children }) => (
    <a href={href} className="text-orange-400 hover:text-orange-300 hover:underline transition-colors" target="_blank" rel="noopener noreferrer">{children}</a>
  ),
  details: ({ children }) => (
    <div className="border border-zinc-700/60 rounded-xl my-5 overflow-hidden bg-zinc-800/20">
      {children}
    </div>
  ),
  summary: ({ children }) => (
    <summary className="bg-zinc-800/50 px-5 py-3.5 cursor-pointer flex items-center justify-between font-medium text-zinc-200 hover:bg-zinc-800 transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
      <span>{children}</span>
      <ChevronDown className="w-4 h-4 text-zinc-400 transition-transform [[open]>&]:rotate-180" />
    </summary>
  ),
  img: ({ src, alt }) => (
    <img src={src} alt={alt} className="rounded-xl border border-zinc-700 my-5 max-w-full" />
  ),
};

/* ─── Main Export ─── */
export default function LessonMarkdown({ content }) {
  const segments = useMemo(() => parseContent(content), [content]);

  return (
    <div className="lesson-markdown">
      {segments.map((seg, i) =>
        seg.type === 'callout' ? (
          <CalloutBox key={i} type={seg.calloutType}>{seg.content}</CalloutBox>
        ) : (
          <div key={i} className="prose-eden">
            <ReactMarkdown
              components={markdownComponents}
              rehypePlugins={[rehypeRaw]}
            >
              {seg.content}
            </ReactMarkdown>
          </div>
        )
      )}
    </div>
  );
}
