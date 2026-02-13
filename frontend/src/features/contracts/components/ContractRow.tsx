import React from 'react';
import { Eye, Download, RotateCcw } from 'lucide-react';
import StatusChip from './StatusChip';
import { ContractItem } from '../types/types';

interface Props {
  contract: ContractItem;
  onOpen: (contract: ContractItem) => void;
  onDownload: (contract: ContractItem) => void;
  onRegenerate: (contract: ContractItem) => void;
}

const ContractRow: React.FC<Props> = ({ contract, onOpen, onDownload, onRegenerate }) => {
  return (
    <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/55 p-4 transition-all hover:border-cyan-500/40 hover:shadow-[0_0_0_1px_rgba(6,182,212,0.2)]">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-white">{contract.name}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
            <span>{contract.type}</span>
            <span className="text-zinc-600">|</span>
            <span>Updated {new Date(contract.updatedAt).toLocaleDateString()}</span>
            <StatusChip status={contract.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpen(contract)}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200 hover:border-cyan-500 hover:text-cyan-300"
          >
            <Eye className="h-4 w-4" />
            Open
          </button>
          <button
            type="button"
            onClick={() => onDownload(contract)}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200 hover:border-emerald-500 hover:text-emerald-300"
          >
            <Download className="h-4 w-4" />
            PDF
          </button>
          <button
            type="button"
            onClick={() => onRegenerate(contract)}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200 hover:border-orange-500 hover:text-orange-300"
          >
            <RotateCcw className="h-4 w-4" />
            Regenerate
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContractRow;
