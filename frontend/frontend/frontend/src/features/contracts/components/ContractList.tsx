import React from 'react';
import { FileText, Plus } from 'lucide-react';
import ContractRow from './ContractRow';
import { ContractItem } from '../types/types';

interface Props {
  contracts: ContractItem[];
  onCreate: () => void;
  onOpen: (contract: ContractItem) => void;
  onDownload: (contract: ContractItem) => void;
  onRegenerate: (contract: ContractItem) => void;
}

const ContractList: React.FC<Props> = ({
  contracts,
  onCreate,
  onOpen,
  onDownload,
  onRegenerate,
}) => {
  if (!contracts.length) {
    return (
      <div className="rounded-2xl border border-zinc-700/40 bg-zinc-900/45 p-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-zinc-700/60 bg-zinc-900/70">
          <FileText className="h-7 w-7 text-zinc-500" />
        </div>
        <h3 className="text-lg font-bold text-white uppercase tracking-wide">No Contracts Yet</h3>
        <p className="mt-2 text-sm text-zinc-400">Generate a contract from any claim</p>
        <button
          type="button"
          onClick={onCreate}
          className="btn-tactical mt-6 inline-flex items-center gap-2 px-4 py-2 text-xs uppercase"
        >
          <Plus className="h-4 w-4" />
          Create Contract
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {contracts.map((contract) => (
        <ContractRow
          key={contract.id}
          contract={contract}
          onOpen={onOpen}
          onDownload={onDownload}
          onRegenerate={onRegenerate}
        />
      ))}
    </div>
  );
};

export default ContractList;
