import React from 'react';
import { X, ExternalLink, Copy } from 'lucide-react';
import { toast } from 'sonner';

const EvidenceDrawer = ({ evidence, onClose, onOpenRaw }) => {
  if (!evidence) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(evidence.id || '');
      toast.success('Evidence ID copied');
    } catch {
      toast.error('Failed to copy evidence ID');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-2xl h-full bg-zinc-950 border-l border-zinc-800 p-5 overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <p className="text-xs text-zinc-500 font-mono uppercase">Evidence Detail</p>
            <h3 className="text-lg font-semibold text-zinc-100 mt-1 break-all">
              {evidence.title || 'Untitled evidence'}
            </h3>
          </div>
          <button
            className="p-2 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded p-3">
              <p className="text-xs text-zinc-500 font-mono uppercase">Kind</p>
              <p className="text-zinc-200 mt-1">{evidence.kind || 'unknown'}</p>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800 rounded p-3">
              <p className="text-xs text-zinc-500 font-mono uppercase">Source</p>
              <p className="text-zinc-200 mt-1 break-all">{evidence.source_system}:{evidence.source_id}</p>
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded p-3">
            <p className="text-xs text-zinc-500 font-mono uppercase">Checksum</p>
            <p className="text-zinc-200 mt-1 break-all">{evidence.checksum || 'n/a'}</p>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded p-3">
            <p className="text-xs text-zinc-500 font-mono uppercase">Storage URI</p>
            <p className="text-zinc-200 mt-1 break-all">{evidence.storage_uri || 'n/a'}</p>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded p-3">
            <p className="text-xs text-zinc-500 font-mono uppercase">Message / Thread</p>
            <p className="text-zinc-200 mt-1 break-all">
              {evidence.message_id || 'n/a'} | {evidence.thread_id || 'n/a'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-5">
          <button
            onClick={handleCopy}
            className="px-3 py-2 rounded border border-zinc-700 text-zinc-300 hover:text-white text-xs uppercase font-mono flex items-center gap-2"
          >
            <Copy className="w-3 h-3" />
            Copy ID
          </button>
          <button
            onClick={() => onOpenRaw(evidence.id)}
            className="px-3 py-2 rounded border border-emerald-600/40 text-emerald-300 hover:text-emerald-200 text-xs uppercase font-mono flex items-center gap-2"
          >
            <ExternalLink className="w-3 h-3" />
            Open Raw Source
          </button>
        </div>
      </div>
    </div>
  );
};

export default EvidenceDrawer;

