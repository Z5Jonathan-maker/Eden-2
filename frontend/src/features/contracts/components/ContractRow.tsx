import React from 'react';
import { Eye, Download, RotateCcw, FileText, ScrollText } from 'lucide-react';
import StatusChip from './StatusChip';
import { ContractItem } from '../types/types';

interface Props {
  contract: ContractItem;
  onOpen: (contract: ContractItem) => void;
  onDownload: (contract: ContractItem) => void;
  onRegenerate: (contract: ContractItem) => void;
}

const isLor = (c: ContractItem) =>
  c.type?.toLowerCase().includes('letter') ||
  c.type?.toLowerCase().includes('lor') ||
  c.name?.toLowerCase().includes('lor');

const ContractRow: React.FC<Props> = ({ contract, onOpen, onDownload, onRegenerate }) => {
  const lor = isLor(contract);
  return (
    <div className={`rounded-xl border p-4 transition-all ${
      lor
        ? 'border-orange-500/30 bg-zinc-900/55 hover:border-orange-500/50 hover:shadow-[0_0_0_1px_rgba(249,115,22,0.2)]'
        : 'border-zinc-700/40 bg-zinc-900/55 hover:border-cyan-500/40 hover:shadow-[0_0_0_1px_rgba(6,182,212,0.2)]'
    }`}>
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {lor
              ? <ScrollText className="h-4 w-4 text-orange-400 flex-shrink-0" />
              : <FileText className="h-4 w-4 text-cyan-400 flex-shrink-0" />
            }
            <h3 className="truncate text-sm font-semibold text-white">{contract.name}</h3>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
              lor
                ? 'border-orange-500/30 bg-orange-500/10 text-orange-400'
                : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
            }`}>
              {lor ? 'LOR' : 'PA Agreement'}
            </span>
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
