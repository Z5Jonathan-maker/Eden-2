import React from 'react';
import { Download, Mail, MessageSquare, PenSquare, RefreshCcw } from 'lucide-react';
import StatusChip from './StatusChip';
import { ContractItem } from '../types/types';

interface Props {
  contract: ContractItem | null;
  open: boolean;
  pdfUrl: string;
  onClose: () => void;
  onOpenSignOnDevice: () => void;
  onOpenInvite: (mode: 'email' | 'sms') => void;
  onDownload: () => void;
  onRegenerate: () => void;
}

const ContractDetail: React.FC<Props> = ({
  contract,
  open,
  pdfUrl,
  onClose,
  onOpenSignOnDevice,
  onOpenInvite,
  onDownload,
  onRegenerate,
}) => {
  if (!open || !contract) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-xl border border-zinc-700 bg-zinc-900 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-tactical text-lg text-white uppercase tracking-wide">
              {contract.name}
            </h3>
            <div className="mt-2 flex items-center gap-2">
              <StatusChip status={contract.status} />
              <span className="text-xs text-zinc-500">
                Updated {new Date(contract.updatedAt).toLocaleString()}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white">
            Close
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="min-h-[65vh] rounded-lg border border-zinc-800 bg-zinc-950">
            {pdfUrl ? (
              <iframe
                title="Contract preview"
                src={pdfUrl}
                className="h-[65vh] w-full rounded-lg"
              />
            ) : (
              <div className="flex h-[65vh] items-center justify-center text-zinc-500">
                Contract preview unavailable
              </div>
            )}
          </div>
          <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <p className="text-xs font-mono uppercase tracking-wider text-zinc-500">Actions</p>
            <button
              type="button"
              onClick={onOpenSignOnDevice}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-cyan-500/40 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-500/10"
            >
              <PenSquare className="h-4 w-4" />
              Sign On Device
            </button>
            <button
              type="button"
              onClick={() => onOpenInvite('email')}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-emerald-500 hover:text-emerald-300"
            >
              <Mail className="h-4 w-4" />
              Send to Email
            </button>
            <button
              type="button"
              onClick={() => onOpenInvite('sms')}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-amber-500 hover:text-amber-300"
            >
              <MessageSquare className="h-4 w-4" />
              Send to Text
            </button>
            <button
              type="button"
              onClick={onDownload}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-sky-500 hover:text-sky-300"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
            <button
              type="button"
              onClick={onRegenerate}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-orange-500 hover:text-orange-300"
            >
              <RefreshCcw className="h-4 w-4" />
              Regenerate
            </button>
            <div className="mt-4 border-t border-zinc-800 pt-3 text-xs text-zinc-500">
              <p>Client: {contract.clientName || 'Unknown'}</p>
              <p>Email: {contract.clientEmail || 'N/A'}</p>
              <p>Phone: {contract.clientPhone || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractDetail;
