import React from 'react';
import { GitBranch, ArrowDown, ArrowRight, CheckCircle, XCircle } from 'lucide-react';

const FlowNode = ({ node, isLast }) => {
  const getNodeStyle = () => {
    switch (node.type) {
      case 'start':
        return 'bg-orange-600/20 border-orange-500/40 text-orange-300';
      case 'decision':
        return 'bg-zinc-800 border-zinc-600/50 text-zinc-200 rotate-0';
      case 'correct':
        return 'bg-green-950/30 border-green-600/40 text-green-300';
      case 'incorrect':
        return 'bg-red-950/30 border-red-600/40 text-red-300';
      case 'outcome':
        return 'bg-zinc-900/80 border-zinc-600/30 text-zinc-300';
      default:
        return 'bg-zinc-800 border-zinc-700/50 text-zinc-200';
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className={`rounded-lg border px-5 py-3 text-sm text-center max-w-xs ${getNodeStyle()}`}>
        <div className="flex items-center gap-2 justify-center">
          {node.type === 'correct' && <CheckCircle className="w-4 h-4 text-green-500" />}
          {node.type === 'incorrect' && <XCircle className="w-4 h-4 text-red-500" />}
          <span>{node.label}</span>
        </div>
        {node.description && (
          <p className="text-xs mt-1 opacity-70">{node.description}</p>
        )}
      </div>
      {!isLast && (
        <div className="py-2">
          <ArrowDown className="w-4 h-4 text-zinc-600" />
        </div>
      )}
    </div>
  );
};

const FlowBranch = ({ branch }) => {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-xs font-mono tracking-wider uppercase mb-2 ${
        branch.path === 'correct' ? 'text-green-500' : 'text-red-500'
      }`}>
        {branch.label || branch.path}
      </span>
      <div className="space-y-0">
        {branch.nodes.map((node, i) => (
          <FlowNode key={i} node={node} isLast={i === branch.nodes.length - 1} />
        ))}
      </div>
    </div>
  );
};

const FlowDiagram = ({ data }) => {
  const { title, start_node, branches, linear_flow } = data.content_payload;

  return (
    <div className="col-span-full rounded-xl border border-zinc-700/50 bg-zinc-800/60 overflow-hidden">
      <div className="bg-zinc-900/80 px-6 py-4 border-b border-zinc-700/30 flex items-center gap-3">
        <GitBranch className="w-5 h-5 text-orange-500" />
        <span className="text-orange-500 font-mono text-[10px] tracking-[0.3em] uppercase">Decision Flow</span>
        {title && <span className="text-zinc-400 text-sm ml-2">{title}</span>}
      </div>

      <div className="p-6 overflow-x-auto">
        {linear_flow ? (
          <div className="flex flex-col items-center gap-0">
            {linear_flow.map((node, i) => (
              <FlowNode key={i} node={node} isLast={i === linear_flow.length - 1} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {start_node && (
              <>
                <FlowNode node={start_node} isLast={false} />
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-zinc-600" />
                  <span className="text-zinc-500 text-xs font-mono">branches</span>
                  <ArrowRight className="w-4 h-4 text-zinc-600" />
                </div>
              </>
            )}
            {branches && (
              <div className="flex flex-wrap gap-8 justify-center">
                {branches.map((branch, i) => (
                  <FlowBranch key={i} branch={branch} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FlowDiagram;
