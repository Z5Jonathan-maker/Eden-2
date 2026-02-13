import React from 'react';
import { ContractStatus } from './types';

interface Props {
  status: ContractStatus;
}

const statusMap: Record<ContractStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-zinc-700/50 text-zinc-300 border-zinc-600/70' },
  sent: { label: 'Sent', cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40' },
  viewed: { label: 'Viewed', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
  signed: { label: 'Signed', cls: 'bg-green-500/20 text-green-300 border-green-500/50' },
};

const StatusChip: React.FC<Props> = ({ status }) => {
  const item = statusMap[status] || statusMap.draft;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider ${item.cls}`}
    >
      {item.label}
    </span>
  );
};

export default StatusChip;
